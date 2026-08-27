import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(`${root}${name}`, 'utf8');

function idsFrom(html) { return [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]); }
function byIdReferences(script) { return [...script.matchAll(/\bbyId\(['"]([^'"]+)['"]\)/g)].map(match => match[1]); }

test('toutes les références DOM du frontend existent et les identifiants sont uniques', () => {
  const html = read('index.html'), ids = idsFrom(html);
  assert.equal(new Set(ids).size, ids.length, 'identifiant HTML dupliqué');
  const missing = [...new Set(byIdReferences(read('app.js')))].filter(id => !ids.includes(id));
  assert.deepEqual(missing, []);
});

test('toutes les références DOM de l’administration existent', () => {
  const html = read('admin.html'), ids = idsFrom(html);
  assert.equal(new Set(ids).size, ids.length, 'identifiant admin dupliqué');
  const missing = [...new Set(byIdReferences(read('admin.js')))].filter(id => !ids.includes(id));
  assert.deepEqual(missing, []);
});

test('la CSP refuse inline/eval et les ressources PWA déclarées existent', () => {
  for (const page of ['index.html', 'admin.html', 'legal.html']) {
    const html = read(page);
    assert.match(html, /Content-Security-Policy/);
    assert.doesNotMatch(html, /'unsafe-inline'|'unsafe-eval'/);
  }
  assert.match(read('styles.css'), /\[hidden\]\{display:none!important\}/);
  assert.match(read('sw.js'), /cr3atix-soutien-v1\.0\.4/);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) assert.ok(existsSync(`${root}${icon.src}`), `icône absente : ${icon.src}`);
  for (const shellPath of ['./index.html','./styles.css','./app.js','./projects.js','./config.js','./legal.html','./admin.html','./admin.css','./admin.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png']) {
    assert.ok(existsSync(`${root}${shellPath.slice(2)}`), `ressource de cache absente : ${shellPath}`);
  }
});
