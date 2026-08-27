import { describe, expect, it } from 'vitest';
import { csvCell, isUuid, randomToken, sanitizePublicName, sessionTokenHash, sha256Hex, verifyPassword } from '../src/security';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function passwordHash(password: string): Promise<string> {
  const salt = new Uint8Array(16).fill(7);
  const iterations = 210000;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
  return `pbkdf2_sha256$${iterations}$${base64Url(salt)}$${base64Url(derived)}`;
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

  it('verifies PBKDF2 admin passwords without accepting malformed hashes', async () => {
    const encoded = await passwordHash('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', encoded)).toBe(true);
    expect(await verifyPassword('wrong', encoded)).toBe(false);
    expect(await verifyPassword('anything', 'pbkdf2_sha256$2$bad$bad')).toBe(false);
  });
});
