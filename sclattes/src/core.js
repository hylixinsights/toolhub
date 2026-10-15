'use strict';
/* ============================================================ core */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmt1 = (n, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const SVGNS = 'http://www.w3.org/2000/svg';

function ordinalRank(n) { return '#' + fmt(n); }

async function getBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
  let buf;
  if (url.endsWith('.txt')) {
    // payloads are base64 text (served everywhere as text/plain)
    const b64 = (await r.text()).trim(), bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    buf = u.buffer;
  } else buf = await r.arrayBuffer();
  const u8 = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress the data files. Please use a recent browser.');
    const ds = new DecompressionStream('gzip');
    buf = await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
  }
  return buf;
}
const getText = async url => new TextDecoder().decode(await getBuf(url));

/* ------------------------------------------------------------ data store */
const D = {
  meta: null, mesh: null, cells: null, R: null,
  ready: {}, // promises
  meshIndexByName: null,
};

function parseCells(buf, N) {
  return {
    N,
    x: new Float32Array(buf, 0, N), y: new Float32Array(buf, 4 * N, N),
    r: new Uint32Array(buf, 8 * N, N), T: new Float32Array(buf, 12 * N, N), cl: new Uint8Array(buf, 16 * N, N),
  };
}

function parseResearchers(text) {
  const cols = text.split('\x1e').map(c => c.split('\n'));
  const [id, name, fy, fe, ly, le, tot, en, pm, fpm, lpm] = cols;
  const n = id.length;
  const toI = a => { const o = new Int32Array(n); for (let i = 0; i < n; i++) { const v = a[i]; o[i] = v === '' || v === undefined ? -1 : +v; } return o; };
  const R = { n, id, name, fy: toI(fy), fe: toI(fe), ly: toI(ly), le: toI(le), tot: toI(tot), en: toI(en), pm: toI(pm), fpm: toI(fpm), lpm: toI(lpm) };
  // competition rank by PubMed-linked records (rows are sorted by pm, descending)
  R.rank = new Int32Array(n);
  for (let i = 0; i < n; i++) R.rank[i] = i > 0 && R.pm[i] === R.pm[i - 1] ? R.rank[i - 1] : i + 1;
  R.ties = new Int32Array(n);
  { let i = 0; while (i < n) { let j = i; while (j < n && R.pm[j] === R.pm[i]) j++; for (let t = i; t < j; t++) R.ties[t] = j - i; i = j; } }
  R.cellOf = new Int32Array(n).fill(-1);
  return R;
}

function linkCells() {
  const { cells: C, R, meta } = D;
  for (let c = 0; c < C.N; c++) R.cellOf[C.r[c]] = c;
  // cells per cluster ordered by researcher index (= PubMed count, descending)
  const order = Array.from({ length: C.N }, (_, i) => i).sort((a, b) => C.r[a] - C.r[b]);
  const K = meta.clusters.length;
  const members = Array.from({ length: K }, () => []);
  for (const c of order) members[C.cl[c]].push(c);
  D.members = members.map(a => Uint32Array.from(a));
  D.clRank = new Int32Array(C.N);
  for (const m of D.members) {
    for (let i = 0; i < m.length; i++) {
      const c = m[i], prev = i > 0 ? m[i - 1] : -1;
      D.clRank[c] = prev >= 0 && R.pm[C.r[c]] === R.pm[C.r[prev]] ? D.clRank[prev] : i + 1;
    }
  }
  D.zeroSet = new Set(meta.zeroProfileIds);
}

let _normNames = null;
function normNames() {
  if (!_normNames) { const R = D.R; _normNames = new Array(R.n); for (let i = 0; i < R.n; i++) _normNames[i] = ' ' + norm(R.name[i]); }
  return _normNames;
}

/* researcher name search: every query token must start a word in the name */
function searchResearchers(q, { limit = 10, onlyMapped = false } = {}) {
  const toks = norm(q).trim().split(/[\s.,]+/).filter(Boolean);
  if (!toks.length || !D.R) return [];
  const names = normNames(), out = [], R = D.R, pre = toks.map(t => ' ' + t);
  for (let i = 0; i < R.n && out.length < limit; i++) {
    if (onlyMapped && R.cellOf[i] < 0) continue;
    const s = names[i]; let ok = true;
    for (const t of pre) { if (s.indexOf(t) < 0) { ok = false; break; } }
    if (ok) out.push(i);
  }
  return out;
}

/* MeSH search over retained + excluded terms */
let _meshNorm = null, _excNorm = null;
function searchMesh(q, limit = 12) {
  const M = D.mesh; if (!M) return [];
  if (!_meshNorm) { _meshNorm = M.names.map(norm); _excNorm = M.excluded.names.map(norm); }
  const s = norm(q).trim(); if (!s) return [];
  const hits = [];
  for (let j = 0; j < M.n; j++) {
    const t = _meshNorm[j], p = t.indexOf(s);
    if (p < 0) continue;
    const score = (t === s ? 0 : p === 0 ? 1 : t.indexOf(' ' + s) >= 0 || t.indexOf(', ' + s) >= 0 ? 2 : 3);
    hits.push({ j, score, df: M.df[j] });
  }
  hits.sort((a, b) => a.score - b.score || b.df - a.df);
  const out = hits.slice(0, limit).map(h => ({ kind: 'mesh', j: h.j }));
  if (out.length < limit) {
    const ex = [];
    for (let i = 0; i < _excNorm.length; i++) {
      const t = _excNorm[i], p = t.indexOf(s);
      if (p < 0) continue;
      ex.push({ i, score: t === s ? 0 : p === 0 ? 1 : 3, n: M.excluded.n[i] });
    }
    ex.sort((a, b) => a.score - b.score || b.n - a.n);
    for (const e of ex.slice(0, Math.min(4, limit - out.length))) out.push({ kind: 'excluded', i: e.i });
  }
  return out;
}

/* ------------------------------------------------------------ shard access */
function shardOf(starts, i) { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= i) lo = m; else hi = m - 1; } return lo; }
function prefix(arr) { const o = new Uint32Array(arr.length + 1); for (let i = 0; i < arr.length; i++) o[i + 1] = o[i] + arr[i]; return o; }

const _meshShards = new Map();
function meshShard(s) {
  if (!_meshShards.has(s)) {
    const starts = D.mesh.shards, k = (s + 1 < starts.length ? starts[s + 1] : D.mesh.n) - starts[s];
    _meshShards.set(s, getBuf(`data/mesh/m${String(s).padStart(3, '0')}.txt`).then(buf => {
      const n = new Uint32Array(buf, 0, k), off = prefix(n), nnz = off[k];
      return { start: starts[s], n, off, d: new Uint16Array(buf, 4 * k, nnz), v: new Uint16Array(buf, 4 * k + 2 * nnz, nnz) };
    }));
  }
  return _meshShards.get(s);
}
const _termCache = new Map();
async function termData(j) {
  if (_termCache.has(j)) return _termCache.get(j);
  const sh = await meshShard(shardOf(D.mesh.shards, j));
  const li = j - sh.start, a = sh.off[li], b = sh.off[li + 1], m = b - a;
  const cells = new Uint32Array(m), counts = new Uint16Array(m), y = new Float32Array(m);
  let c = 0;
  for (let t = 0; t < m; t++) {
    c = t === 0 ? sh.d[a] : c + sh.d[a + t];
    cells[t] = c; counts[t] = sh.v[a + t];
    y[t] = Math.log1p(counts[t] / D.cells.T[c] * 1e4);
  }
  const td = { j, cells, counts, y };
  _termCache.set(j, td);
  return td;
}

const _cellShards = new Map();
function cellShard(s) {
  if (!_cellShards.has(s)) {
    const starts = D.meta.shards.cells, k = (s + 1 < starts.length ? starts[s + 1] : D.cells.N) - starts[s];
    _cellShards.set(s, getBuf(`data/cells/c${String(s).padStart(3, '0')}.txt`).then(buf => {
      const n = new Uint16Array(buf, 0, k), off = prefix(n), nnz = off[k];
      return { start: starts[s], n, off, d: new Uint16Array(buf, 2 * k, nnz), v: new Uint16Array(buf, 2 * k + 2 * nnz, nnz) };
    }));
  }
  return _cellShards.get(s);
}
async function cellTerms(c) {
  const sh = await cellShard(shardOf(D.meta.shards.cells, c));
  const li = c - sh.start, a = sh.off[li], b = sh.off[li + 1], m = b - a;
  const terms = new Uint32Array(m), counts = new Uint16Array(m);
  let t = 0;
  for (let i = 0; i < m; i++) { t = i === 0 ? sh.d[a] : t + sh.d[a + i]; terms[i] = t; counts[i] = sh.v[a + i]; }
  return { terms, counts };
}
/* rank a researcher's terms; mode: count | z | tfidf */
function scoreTerms(c, ct, mode, minCount) {
  const M = D.mesh, N = D.cells.N, T = D.cells.T[c], out = [];
  for (let i = 0; i < ct.terms.length; i++) {
    const j = ct.terms[i], n = ct.counts[i];
    if (n < minCount) continue;
    const y = Math.log1p(n / T * 1e4);
    const z = M.sd[j] > 0 ? (y - M.mu[j]) / M.sd[j] : 0;
    const tf = n * Math.log(N / M.df[j]);
    out.push({ j, n, z, tf, s: mode === 'z' ? z : mode === 'tfidf' ? tf : n + z * 1e-6 });
  }
  out.sort((a, b) => b.s - a.s);
  return out;
}

const _yearShards = new Map();
function yearShard(s) {
  if (!_yearShards.has(s)) {
    const starts = D.meta.shards.years, k = (s + 1 < starts.length ? starts[s + 1] : D.R.n) - starts[s];
    _yearShards.set(s, getBuf(`data/years/y${String(s).padStart(3, '0')}.txt`).then(buf => {
      const cnt = new Uint16Array(buf, 0, k), off = prefix(cnt);
      return { start: starts[s], cnt, off, e: new Uint16Array(buf, 2 * k, 4 * off[k]) };
    }));
  }
  return _yearShards.get(s);
}
async function researcherYears(r) {
  const sh = await yearShard(shardOf(D.meta.shards.years, r));
  const li = r - sh.start, a = sh.off[li], b = sh.off[li + 1], out = [];
  for (let i = a; i < b; i++) out.push({ y: sh.e[4 * i], t: sh.e[4 * i + 1], e: sh.e[4 * i + 2], p: sh.e[4 * i + 3] });
  return out;
}

/* ------------------------------------------------------------ colours */
const COL = { cluster: [], lut: [], lutN: 32 };
function hexToRgb(h) {
  h = h.trim();
  if (h.startsWith('rgb')) { const m = h.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2]]; }
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const rgbStr = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function readColors() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  COL.cluster = Array.from({ length: 24 }, (_, k) => v('--c' + k));
  for (const k of ['ink', 'ink-2', 'muted', 'paper', 'surface', 'sunken', 'rule', 'rule-2', 'zero', 'accent', 'eosin', 'halo']) COL[k] = v('--' + k);
  const r0 = hexToRgb(v('--ramp-0')), r1 = hexToRgb(v('--ramp-1')), r2 = hexToRgb(v('--ramp-2'));
  COL.lut = Array.from({ length: COL.lutN }, (_, i) => { const t = i / (COL.lutN - 1); return rgbStr(t < 0.5 ? mix(r0, r1, t * 2) : mix(r1, r2, (t - 0.5) * 2)); });
  COL.rampCss = `linear-gradient(90deg, ${rgbStr(r0)}, ${rgbStr(r1)}, ${rgbStr(r2)})`;
}
const themeListeners = [];
function onTheme(fn) { themeListeners.push(fn); }
function themeChanged() { readColors(); themeListeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

const clusterName = k => D.meta.clusters[k].label;
const clusterDot = k => `<span class="dot" style="background:var(--c${k})"></span>`;
const clusterChip = (k, extra = '') => `<span class="chip">${clusterDot(k)}<span>${esc(clusterName(k))}</span>${extra}</span>`;

/* ------------------------------------------------------------ tooltip */
const tip = { el: null };
function showTip(html, x, y) {
  const el = tip.el || (tip.el = $('#tip'));
  el.innerHTML = html; el.classList.add('on');
  const w = el.offsetWidth, h = el.offsetHeight, W = window.innerWidth, H = window.innerHeight;
  let left = x + 14, top = y + 14;
  if (left + w > W - 8) left = x - w - 14;
  if (top + h > H - 8) top = y - h - 14;
  el.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
}
function hideTip() { (tip.el || $('#tip')).classList.remove('on'); }

/* ------------------------------------------------------------ combobox */
function combobox({ root, search, render, onPick, emptyText = 'No matches', minChars = 1, pending }) {
  const input = $('input', root), list = $('.listbox', root);
  let items = [], active = -1, idBase = list.id + '-o';
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const paint = () => {
    $$('li[role=option]', list).forEach((li, i) => li.setAttribute('aria-selected', i === active ? 'true' : 'false'));
    if (active >= 0) { input.setAttribute('aria-activedescendant', idBase + active); const li = $('#' + idBase + active); li && li.scrollIntoView({ block: 'nearest' }); }
  };
  const update = () => {
    const q = input.value;
    if (q.trim().length < minChars) { close(); return; }
    if (pending && pending()) { list.innerHTML = `<li class="lb-note">${esc(pending())}</li>`; list.hidden = false; return; }
    items = search(q);
    if (!items.length) { list.innerHTML = `<li class="lb-note">${esc(emptyText)}</li>`; }
    else list.innerHTML = items.map((it, i) => { const r = render(it, q); return `<li role="option" id="${idBase}${i}" data-i="${i}" class="${r.off ? 'off' : ''}" aria-selected="false" aria-disabled="${r.off ? 'true' : 'false'}">${r.html}</li>`; }).join('');
    active = items.length ? 0 : -1; list.hidden = false; input.setAttribute('aria-expanded', 'true'); paint();
  };
  const pick = i => { const it = items[i]; if (!it) return; const r = render(it, input.value); if (r.off) return; close(); onPick(it, input); };
  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (input.value.trim().length >= minChars) update(); });
  input.addEventListener('keydown', e => {
    if (list.hidden && (e.key === 'ArrowDown')) { update(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) pick(active); }
    else if (e.key === 'Escape') { close(); }
  });
  list.addEventListener('pointerdown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { refresh: update, close, input };
}
function hl(text, q) {
  const toks = norm(q).trim().split(/[\s.,]+/).filter(Boolean); if (!toks.length) return esc(text);
  const nt = norm(text); const marks = new Array(text.length).fill(false);
  for (const t of toks) { let p = nt.indexOf(t); while (p >= 0) { if (p === 0 || /[\s,(-]/.test(nt[p - 1])) { for (let i = p; i < p + t.length && i < text.length; i++) marks[i] = true; break; } p = nt.indexOf(t, p + 1); } }
  let out = '', on = false;
  for (let i = 0; i < text.length; i++) { if (marks[i] !== on) { out += marks[i] ? '<mark>' : '</mark>'; on = marks[i]; } out += esc(text[i]); }
  return out + (on ? '</mark>' : '');
}

/* ------------------------------------------------------------ small helpers */
function countUp(el, to, dur = 900, fmtFn = fmt) {
  if (reducedMotion()) { el.textContent = fmtFn(to); return; }
  const t0 = performance.now();
  const step = now => { const t = clamp((now - t0) / dur, 0, 1); el.textContent = fmtFn(to * ease(t)); if (t < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
function niceTicks(max, n = 4) {
  if (max <= 0) return [0];
  const raw = max / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const out = []; for (let v = 0; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  if (out[out.length - 1] < max) out.push(+(out[out.length - 1] + step).toFixed(10));
  return out;
}
const shortNum = v => { const f = (x, u) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, '')) + u; return v >= 1e6 ? f(v / 1e6, 'M') : v >= 1e3 ? f(v / 1e3, 'k') : String(+v.toFixed(2)); };
function onResize(el, fn) { let w = el.clientWidth; const ro = new ResizeObserver(() => { const nw = el.clientWidth; if (Math.abs(nw - w) > 2) { w = nw; fn(); } }); ro.observe(el); return ro; }
