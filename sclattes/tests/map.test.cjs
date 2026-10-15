const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const frames = new Map(); let nextFrame = 1;
const context = vm.createContext({
  window: {devicePixelRatio: 2},
  requestAnimationFrame: cb => { const id = nextFrame++; frames.set(id, cb); return id; },
  cancelAnimationFrame: id => frames.delete(id),
  clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8') + '\nthis.MapView = MapView;', context);
let bounds = {width: 1000, height: 600};
const map = Object.create(context.MapView.prototype);
Object.assign(map, {
  root: {getBoundingClientRect: () => bounds}, base: {}, top: {},
  opts: {mini: false}, core: [0, 40, 0, 70], w: 0, h: 0, dpr: 1,
  view: {cx: 20, cy: 35, k: 1}, _raf: 0, _fly: 0,
});
map.resize(); map.view.k = map.kFit * 2.5;
const original = {...map.view}, fit = map.kFit;
for (let i = 0; i < 30; i++) {
  bounds = {width: 0, height: 0}; map.resize();
  assert.equal(map.w, 1000); assert.equal(map.h, 600);
  bounds = {width: 1000, height: 600}; map.resize();
  assert.equal(map.view.k, original.k); assert.equal(map.kFit, fit);
}
for (let i = 0; i < 20; i++) {
  bounds = {width: 390, height: 700}; map.resize();
  assert.ok(Math.abs(map.view.k / map.kFit - 2.5) < 1e-12);
  bounds = {width: 1000, height: 600}; map.resize();
}
assert.ok(Math.abs(map.view.k - original.k) < 1e-12);
assert.equal(map.view.cx, original.cx); assert.equal(map.view.cy, original.cy);
map._fly = context.requestAnimationFrame(() => { throw Error('Stale animation'); });
const fly = map._fly, k = map.view.k; map.zoomBy(1.6);
assert.equal(frames.has(fly), false); assert.equal(map._fly, 0);
assert.ok(Math.abs(map.view.k - k * 1.6) < 1e-12);
let draws = 0; map._draw = () => draws++;
frames.clear(); map._raf = 0;
for (let i = 0; i < 100; i++) map.render(true);
assert.equal(frames.size, 1);
for (const cb of frames.values()) cb(); frames.clear();
assert.equal(draws, 1);
console.log('PASS: 30 hidden-tab round trips preserve scale; 20 responsive round trips preserve zoom and center; manual zoom cancels animation; 100 render requests draw once.');
