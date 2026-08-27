import assert from 'node:assert/strict';
import test from 'node:test';

Object.defineProperty(globalThis, 'location', {
  value: new URL('https://kevinlabens-del.github.io/creatix-project/soutien/'),
  configurable: true
});

const { loadProjects, normalizeCategory, normalizeNode, safeHttps } = await import('../projects.js');
const config = { mapApiUrl: 'https://map.example.test/registry', mapFallbackUrl: 'https://site.example.test/projects.json' };

test.afterEach(() => { delete globalThis.fetch; });

test('normalise les champs MAP et résout les icônes relatives depuis la racine MAP', () => {
  const project = normalizeNode({ id: 'boutik', title: 'CR3@TIX BOUTIK', type: 'DESIGN', url: 'https://example.test/boutik', icon: 'assets/project-icons/boutik.svg' });
  assert.equal(project.icon, 'https://kevinlabens-del.github.io/creatix-project/assets/project-icons/boutik.svg');
  assert.equal(safeHttps('javascript:alert(1)'), '');
  assert.equal(normalizeCategory('Jeux'), 'JEU');
  assert.equal(normalizeCategory('jeu'), 'JEU');
});

test('répercute une modification et une suppression du registre sans état manuel local', async () => {
  const snapshots = [
    { nodes: [
      { id: 'games', title: 'Jeux', type: 'BRANCHE', url: 'https://example.test/jeux' },
      { id: 'snake', title: 'Snake 2.0', type: 'JEU', desc: 'Version initiale', url: 'https://example.test/snake' },
      { id: 'runner', title: 'Runner', type: 'JEU', url: 'https://example.test/runner' }
    ] },
    { nodes: [{ id: 'snake', title: 'Snake 3.0', type: 'JEU', desc: 'Version modifiée', url: 'https://example.test/snake-v3' }] }
  ];
  globalThis.fetch = async () => new Response(JSON.stringify(snapshots.shift()));
  const first = await loadProjects(config);
  assert.deepEqual(first.projects.map(project => project.id), ['snake', 'runner']);
  const second = await loadProjects(config);
  assert.deepEqual(second.projects.map(project => project.id), ['snake']);
  assert.equal(second.projects[0].name, 'Snake 3.0');
  assert.equal(second.projects[0].url, 'https://example.test/snake-v3');
});

test('utilise le manifeste généré lorsque l’API MAP est temporairement indisponible', async () => {
  globalThis.fetch = async url => {
    if (String(url) === config.mapApiUrl) throw new Error('offline');
    return new Response(JSON.stringify({ nodes: [{ id: 'breizh', title: 'Breizh’ Balade', type: 'APPLICATION', url: 'https://example.test/breizh' }] }));
  };
  const result = await loadProjects(config);
  assert.equal(result.source, 'map-snapshot');
  assert.equal(result.projects[0].id, 'breizh');
});
