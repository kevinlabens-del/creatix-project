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
  assert.ok(read('_site/sw.js').includes('cr3atix-map-v1.16.38-support-links'));
  assert.ok(read('_site/sw.js').includes("'./cosmic-background.css'"));
});

test('mobile fit includes the whole map and manual zoom can reach 5%', async () => {
  const { runInNewContext } = await import('node:vm');
  const app = read('_site/app.js');
  const fit = app.match(/^function fit\(\).*$/m)[0];
  const zoom = app.match(/^function zoomAt\(.*$/m)[0];
  const context = {nodes:[{x:-740,y:100},{x:1510,y:3300}], view:{x:0,y:0,scale:1},
    viewport:{getBoundingClientRect:()=>({width:360,height:700,left:0,top:54})}, applyView:()=>{}};
  runInNewContext(fit + '\n' + zoom + '\nfit();', context);
  assert.ok(context.view.scale < .22);
  for (const n of context.nodes) {
    assert.ok(n.x * context.view.scale + context.view.x >= 0);
    assert.ok((n.x + 230) * context.view.scale + context.view.x <= 360);
    assert.ok(n.y * context.view.scale + context.view.y >= 0);
    assert.ok((n.y + 280) * context.view.scale + context.view.y <= 700);
  }
  runInNewContext('for(let i=0;i<40;i++) zoomAt(.86,180,404);', context);
  assert.equal(context.view.scale,.05);
  runInNewContext('zoomAt(1.16,180,404);',context);
  assert.ok(context.view.scale > .05);
  assert.equal((app.match(/Math.max\(\.05,Math.min\(/g)||[]).length,3,
    'fit, buttons/wheel and pinch must share the same lower limit');
});
