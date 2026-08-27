import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../src/env';
import { fetchRegistry, resolveProject } from '../src/registry';

const env = {
  MAP_API_URL: 'https://map.example.test/projects',
  FRONTEND_BASE_URL: 'https://example.test/soutien/',
  PAYMENT_MODE: 'disabled'
} as unknown as AppEnv;

afterEach(() => vi.unstubAllGlobals());

describe('MAP registry', () => {
  it('normalizes projects, derives GitHub repositories, and ignores branches', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ nodes: [
      { id: 'root', title: 'CR3@TIX', url: 'https://example.test/' },
      { id: 'branch', title: 'Jeux', type: 'BRANCHE', url: 'https://example.test/jeux' },
      { id: 'snake', title: 'Snake', type: 'JEU', desc: 'Arcade', url: 'https://kevinlabens-del.github.io/snake/' },
      { id: 'unsafe', title: 'Unsafe', type: 'OUTIL', url: 'javascript:alert(1)' }
    ] }), { headers: { 'content-type': 'application/json' } })));

    await expect(fetchRegistry(env)).resolves.toEqual([{
      id: 'snake',
      name: 'Snake',
      url: 'https://kevinlabens-del.github.io/snake/',
      category: 'JEU',
      description: 'Arcade',
      icon: null,
      repository_url: 'https://github.com/kevinlabens-del/snake'
    }]);
  });

  it('provides the ecosystem-wide support target without calling MAP', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(resolveProject(env, 'global')).resolves.toMatchObject({ id: 'global', category: 'ÉCOSYSTÈME' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown MAP project', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"nodes":[]}')));
    await expect(resolveProject(env, 'missing')).rejects.toMatchObject({ status: 404, message: 'unknown_project' });
  });
});
