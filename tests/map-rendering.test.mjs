import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('built camera uses flat 2D transforms for pan and zoom', () => {
  const app = read('_site/app.js');
  assert.ok(app.includes('translate(${view.x}px,${view.y}px) scale(${view.scale})'));
  assert.ok(!app.includes("transformStyle='preserve-3d'"));
  assert.ok(!app.includes('translate3d(${view.x}'));
});
test('flat rendering overrides legacy CSS and keeps negative-position cards visible', () => {
  const css = read('_site/cosmic-background.css');
  assert.match(css, /transform-style:\s*flat\s*!important/);
  assert.match(css, /backface-visibility:\s*visible\s*!important/);
  assert.match(css, /will-change:\s*auto\s*!important/);
  assert.match(css, /#world > #nodes,[\s\S]*?overflow:\s*visible/);
  assert.match(css, /#world > #nodes > \.node-card\s*\{\s*pointer-events:\s*auto/);
  assert.match(css, /#world > #plusLayer > \.plus-node\s*\{\s*pointer-events:\s*auto/);
});
test('published page loads the fix and updates installed app cache', () => {
  assert.ok(read('_site/index.html').includes('href="cosmic-background.css"'));
  assert.ok(read('_site/sw.js').includes('cr3atix-map-v1.16.35-flat-cards'));
  assert.ok(read('_site/sw.js').includes("'./cosmic-background.css'"));
});
