import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('thumbnail and fullscreen card have accessible printer controls', () => {
  const js = read('business-card.js');
  assert.ok(js.includes("cardPrint.id = 'cr3-card-print-control'"));
  assert.ok(js.includes('id="cr3-card-modal-print"'));
  assert.ok(js.includes('aria-label="Imprimer la carte de visite"'));
  assert.ok(js.includes("cardPrint.addEventListener('click', printBusinessCard)"));
  assert.ok(js.includes("modal.querySelector('#cr3-card-modal-print').addEventListener('click', printBusinessCard)"));
  assert.ok(js.includes('event.stopPropagation()'));
});
test('native printing includes image only and preserves its proportions', () => {
  const js = read('business-card.js');
  assert.ok(js.includes('@page{size:85mm 55mm;margin:0}'));
  assert.ok(js.includes('body > :not(#cr3-card-print-sheet){display:none!important}'));
  assert.ok(js.includes('object-fit:contain!important'));
  assert.ok(js.includes("printSheet.innerHTML = '<img src="));
  assert.ok(js.includes('window.print()'));
  assert.ok(!js.includes('window.open('));
});
test('published PWA uses the updated asset and cache version', () => {
  assert.equal(read('_site/business-card.js'), read('business-card.js'));
  assert.ok(read('_site/index.html').includes('business-card.js?v=1.16.41'));
  assert.ok(read('_site/sw.js').includes("'./business-card.js?v=1.16.41'"));
  assert.ok(read('_site/sw.js').includes('cr3atix-map-v1.16.41-card-print'));
});
