import { describe, expect, it } from 'vitest';
import { csvCell, isUuid, randomToken, sanitizePublicName, sessionTokenHash, sha256Hex, verifyPassword } from '../src/security';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function passwordHash(password: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(password)));
  return `hmac_sha256$${base64Url(digest)}`;
}

describe('security primitives', () => {
  it('normalizes only safe, consented public aliases', () => {
    expect(sanitizePublicName('  Kévin   CR3@TIX  ')).toBe('Kévin CR3@TIX');
    expect(sanitizePublicName('<script>alert(1)</script>')).toBeNull();
    expect(sanitizePublicName('x')).toBeNull();
  });

  it('accepts RFC 4122 version 4 identifiers only', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
  });

  it('prevents spreadsheet formula injection in CSV exports', () => {
    expect(csvCell('=HYPERLINK("https://example.test")')).toBe('"\'=HYPERLINK(""https://example.test"")"');
    expect(csvCell('normal')).toBe('"normal"');
  });

  it('hashes deterministically and creates high-entropy session tokens', async () => {
    expect(await sha256Hex('CR3@TIX')).toHaveLength(64);
    expect(await sessionTokenHash('token', 'a'.repeat(32))).not.toBe(await sessionTokenHash('token', 'b'.repeat(32)));
    const first = randomToken(), second = randomToken();
    expect(first).toHaveLength(43);
    expect(second).not.toBe(first);
  });

  it('verifies keyed admin passwords without accepting malformed or legacy hashes', async () => {
    const pepper = 'a'.repeat(64);
    const encoded = await passwordHash('correct horse battery staple', pepper);
    expect(await verifyPassword('correct horse battery staple', encoded, pepper)).toBe(true);
    expect(await verifyPassword('wrong password value', encoded, pepper)).toBe(false);
    expect(await verifyPassword('correct horse battery staple', encoded, 'b'.repeat(64))).toBe(false);
    expect(await verifyPassword('correct horse battery staple', 'hmac_sha256$bad', pepper)).toBe(false);
    expect(await verifyPassword('correct horse battery staple', 'pbkdf2_sha256$210000$bad$bad', pepper)).toBe(false);
  });
});
