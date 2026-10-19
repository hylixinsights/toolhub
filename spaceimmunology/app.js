(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MINUS = '−';
const fmtN = d3.format(',');
const sgn = (v, d = 2) => v == null ? 'NA' : (v < 0 ? MINUS : v > 0 ? '+' : '') + Math.abs(v).toFixed(d);
const fmtP = p => p == null ? 'NA' : p < 0.001 ? p.toExponential(1).replace('-', MINUS) : p < 0.01 ? p.toFixed(4) : p.toPrecision(2);
const AGE = {YNG: 'young', OLD: 'older'};
const AGES = ['YNG', 'OLD'];
const TNAME = {Femur: 'Femur bone marrow', Humerus: 'Humerus bone marrow', PBMC: 'Blood (PBMC)', Spleen: 'Spleen'};
const LIN = ['Whole tissue','HSC/Progenitors','Pro-B cells','Pre-B cells','Mature B cells','Plasma cells','T cells','NK cells',
  'Granulocyte progenitors','Neutrophils','Basophils','Monocyte progenitors','Classical Monocytes','Inflammatory Monocytes',
  'Patrolling Monocytes','C1q+ Macrophages','Red Pulp Macrophages','Plasmacytoid DCs','Megakaryocytes','Erythroids',
  'Erythroids (mature)','Osteoblasts','Osteoblasts/Stromal','Stromal/Adipocytes','Endothelial cells','Neurons'];
const linIdx = ct => { const i = LIN.indexOf(ct); return i < 0 ? 99 : i; };
const CTC = {'HSC/Progenitors':'#6B7A8F','Pro-B cells':'#97BE5C','Pre-B cells':'#3E8E3A','Mature B cells':'#1D6A4C','Plasma cells':'#5FBF9C',
  'T cells':'#7556A8','NK cells':'#B49AD6','Granulocyte progenitors':'#E2A33A','Neutrophils':'#C2741A','Basophils':'#E6C766',
  'Monocyte progenitors':'#DB866E','Classical Monocytes':'#C0503A','Inflammatory Monocytes':'#E8735F','Patrolling Monocytes':'#93362A',
  'C1q+ Macrophages':'#8C5A3C','Red Pulp Macrophages':'#B88A64','Plasmacytoid DCs':'#D2689F','Megakaryocytes':'#4D7EC6',
  'Erythroids':'#B23A57','Erythroids (mature)':'#E48B9F','Osteoblasts':'#8D8C36','Osteoblasts/Stromal':'#8D8C36',
  'Stromal/Adipocytes':'#BDB25C','Endothelial cells':'#4FA6B9','Neurons':'#5B5B5B'};
const ctColor = ct => CTC[ct] || '#888';
const CURATED = [
  ['Cell cycle', ['mitotic nuclear division','chromosome segregation','dna replication']],
  ['Energy metabolism', ['oxidative phosphorylation','atp synthesis coupled electron transport','cellular respiration']],
  ['Immune response', ['lymphocyte activation','adaptive immune response','humoral immune response','inflammatory response']]];
const PB_TERMS = ['mitotic nuclear division','chromosome segregation','dna replication','cell cycle g2 m phase transition','cell cycle checkpoint signaling'];

/* ---------- data ---------- */
const cache = new Map();
function load(path) {
  if (!cache.has(path)) {
    const pr = (async () => {
      const r = await fetch('data/' + path);
      if (!r.ok) throw new Error('Could not load ' + path + ' (' + r.status + ')');
      let buf = new Uint8Array(await r.arrayBuffer());
      if (buf[0] === 0x48 && buf[1] === 0x34 && buf[2] === 0x73 && buf[3] === 0x49) { // base64 of gzip ("H4sI")
        const b = atob(new TextDecoder().decode(buf).trim()); const u = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); buf = u;
      }
      let txt;
      if (buf[0] === 0x1f && buf[1] === 0x8b) {
        const st = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
        txt = await new Response(st).text();
      } else txt = new TextDecoder().decode(buf);
      return JSON.parse(txt);
    })();
    pr.catch(() => cache.delete(path));
    cache.set(path, pr);
  }
  return cache.get(path);
}
let M; // meta
const ckey = new Map();
const cid = (t, ct, a) => ckey.get(t + '|' + ct + '|' + a);
const shard = g => { const c = g[0].toUpperCase(); return /[A-Z]/.test(c) ? c : '0'; };
let GS = null; // gsea indexes
async function gsea() {
  if (GS) return GS;
  const [g, paths] = await Promise.all([load('gsea.jgz.txt'), load('pathways.jgz.txt')]);
  const byC = new Map(), byP = new Map();
  for (let i = 0; i < g.c.length; i++) {
    const r = {c: g.c[i], p: g.p[i], n: g.n[i], q: g.q[i], s: g.s[i]};
    (byC.get(r.c) || byC.set(r.c, []).get(r.c)).push(r);
    (byP.get(r.p) || byP.set(r.p, []).get(r.p)).push(r);
  }
  const pid = new Map(paths.map((p, i) => [p, i]));
  GS = {byC, byP, paths, pid};
  return GS;
}

/* ---------- colors ---------- */
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let C = {};
function palette() {
  ['--ink','--ink-2','--ink-3','--rule','--rule-2','--panel','--sunk','--ground','--flight','--young','--older',
   '--div-g2','--div-g1','--div-0','--div-f1','--div-f2','--age-y2','--age-y1','--age-o1','--age-o2','--seq-0','--seq-1']
    .forEach(k => C[k.slice(2)] = cssv(k));
}
const divScale = m => d3.scaleLinear().domain([-m, -m / 2, 0, m / 2, m])
  .range([C['div-g2'], C['div-g1'], C['div-0'], C['div-f1'], C['div-f2']]).interpolate(d3.interpolateLab).clamp(true);
const ageScale = m => d3.scaleLinear().domain([-m, -m / 2, 0, m / 2, m])
  .range([C['age-y2'], C['age-y1'], C['div-0'], C['age-o1'], C['age-o2']]).interpolate(d3.interpolateLab).clamp(true);
const seqScale = (a, b) => d3.scaleLinear().domain([a, b]).range([C['seq-0'], C['seq-1']]).interpolate(d3.interpolateLab).clamp(true);
const inkOn = col => { const c = d3.lab(col); return c.l > 58 ? '#121C26' : '#FFFFFF'; };
const condColor = id => id[0] === 'F' ? C.flight : C.ground;
function rampCSS(sc, m) { return 'linear-gradient(90deg,' + d3.range(0, 1.01, 0.125).map(t => sc(-m + 2 * m * t)).join(',') + ')'; }

/* ---------- tooltip ---------- */
const tip = $('#tip');
function showTip(e, html) {
  tip.innerHTML = html; tip.style.opacity = 1;
  const w = tip.offsetWidth, h = tip.offsetHeight, pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + w > innerWidth - 8) x = e.clientX - w - pad;
  if (y + h > innerHeight - 8) y = e.clientY - h - pad;
  tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
}
const hideTip = () => { tip.style.opacity = 0; };
document.addEventListener('scroll', hideTip, {passive: true});

/* ---------- small helpers ---------- */
function svgIn(el, W, H) {
  el.innerHTML = '';
  return d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
    .style('width', W + 'px').style('max-width', 'none');
}
function widthOf(el, min = 0) { return Math.max(min, Math.floor(el.clientWidth || el.parentNode.clientWidth || 600)); }
function seg(el, items, cur, onPick) {
  el.innerHTML = '';
  items.forEach(([v, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.setAttribute('aria-pressed', String(v === cur));
    b.onclick = () => onPick(v);
    el.appendChild(b);
  });
}
function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function compLabel(c) { return `${c.tissue} · ${c.ct} · ${AGE[c.age]}`; }
function canvasIn(el, W, H) {
  const cv = document.createElement('canvas'); const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.style.maxWidth = '100%';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  return {cv, ctx};
}
function spearman(a, b) {
  const rank = v => { const idx = v.map((x, i) => i).sort((i, j) => v[i] - v[j]); const r = new Array(v.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++;
      const rk = (i + j) / 2; for (let k = i; k <= j; k++) r[idx[k]] = rk; i = j + 1; } return r; };
  const ra = rank(a), rb = rank(b); const ma = d3.mean(ra), mb = d3.mean(rb);
  let n = 0, da = 0, db = 0; for (let i = 0; i < ra.length; i++) { n += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
}
function xAxis(g, x, H, ticks = 5, label) {
  const a = g.append('g').attr('class', 'ax').attr('transform', `translate(0,${H})`).call(d3.axisBottom(x).ticks(ticks).tickSizeOuter(0).tickFormat(d => (d < 0 ? MINUS : '') + Math.abs(d)));
  if (label) g.append('text').attr('x', x.range()[1]).attr('y', H + 30).attr('text-anchor', 'end').text(label);
  return a;
}
function yAxis(g, y, ticks = 5, label, fmt) {
  g.append('g').attr('class', 'ax').call(d3.axisLeft(y).ticks(ticks).tickSizeOuter(0).tickFormat(fmt || (d => (d < 0 ? MINUS : '') + Math.abs(d))));
  if (label) g.append('text').attr('x', 0).attr('y', -10).attr('text-anchor', 'start').text(label);
}

/* ---------- search box ---------- */
function makeSearch(root, getList, onPick, fmt = s => s) {
  const inp = root.querySelector('input'), ul = root.querySelector('ul');
  let items = [], act = -1;
  const close = () => { ul.hidden = true; act = -1; };
  const draw = () => {
    ul.innerHTML = items.map((s, i) => `<li role="option" data-i="${i}" aria-selected="${i === act}">${fmt(esc(s))}</li>`).join('');
    ul.hidden = !items.length;
  };
  inp.addEventListener('input', async () => {
    const q = inp.value.trim().toLowerCase(); if (!q) { items = []; close(); return; }
    const list = await getList();
    const a = [], b = [];
    for (const s of list) { const l = s.toLowerCase(); if (l.startsWith(q)) a.push(s); else if (l.includes(q)) b.push(s); if (a.length > 40) break; }
    a.sort((x, y) => x.length - y.length);
    items = a.concat(b).slice(0, 30); act = items.length ? 0 : -1; draw();
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && items.length) { act = (act + 1) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && items.length) { act = (act - 1 + items.length) % items.length; draw(); e.preventDefault(); }
    else if (e.key === 'Enter') { if (act >= 0 && items[act]) { onPick(items[act]); inp.value = ''; close(); } e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  ul.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { onPick(items[+li.dataset.i]); inp.value = ''; close(); e.preventDefault(); } });
  inp.addEventListener('blur', () => setTimeout(close, 120));
}

/* ---------- state & routing ---------- */
const S = {view: 'overview', gene: 'Bub1', pmT: null, pmCt: null, tissue: 'Femur', ct: 'Pre-B cells', age: 'YNG', color: 'ct', dir: 'dn',
  path: 'mitotic nuclear division', pcell: null, aT: 'Femur', aCt: 'Pre-B cells', cT: 'Femur', mT: 'Femur', mA: 'YNG', mSt: 'all', mQ: '', mN: 40, leN: 12, cycT: 'Femur'};
const VIEWS = ['overview','insights','gene','tissue','age','pathway','composition','communication','preb'];
const R = {};
function go(v, opts) {
  Object.assign(S, opts || {});
  S.view = v;
  VIEWS.forEach(x => { $('#v-' + x).hidden = x !== v; });
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  const btn = document.querySelector(`#tabs button[data-v="${v}"]`); if (btn && btn.scrollIntoView) btn.scrollIntoView({block: 'nearest', inline: 'nearest'});
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  hideTip();
  render();
  if (opts && opts.top !== false) window.scrollTo({top: 0});
}
function render() { palette(); $('#keyramp').style.background = rampCSS(divScale(1), 1); const f = R[S.view]; if (f) Promise.resolve(f()).catch(err => console.error(err)); }
const openGene = g => go('gene', {gene: g, pmT: null, pmCt: null});
const openComp = (t, ct, age) => go('tissue', {tissue: t, ct, age});
const openPath = (p, c) => go('pathway', {path: p, pcell: c == null ? null : c});

/* ================= OVERVIEW ================= */
R.overview = () => {
  const nComp = M.comps.filter(c => c.ct !== 'Whole tissue').length, nW = M.comps.length - nComp;
  const goFDR = d3.sum(M.comps, c => c.pathFDR || 0);
  const stats = [[fmtN(M.nCells), 'cells after quality control'], ['16', 'mice per tissue, 4 per group'], ['4', 'tissues: femur, humerus, blood, spleen'],
    [String(nComp), `cell-type comparisons, plus ${nW} whole-tissue`], ['0 / 11', 'FDR < 0.05 results: within cell type / whole tissue'], [fmtN(goFDR), 'significant pathway–comparison results; 1,272 unique GO terms']];
  $('#ov-stats').innerHTML = stats.map(s => `<div class="stat"><b>${s[0]}</b><span>${esc(s[1])}</span></div>`).join('');
  const lf = M.liana.find(d => d.tissue === 'Femur' && d.age === 'YNG'), lo = M.liana.find(d => d.tissue === 'Femur' && d.age === 'OLD');
  const rho = (a, b, g) => M.concordance.find(r => r[0] === a && r[1] === b && r[2] === g)[3];
  const F = [
    ['No composition differences detected at FDR < 0.05', `None of the ${M.compTests.length} tests reaches FDR < 0.05. This does not establish equivalence or unchanged absolute cell numbers.`, 'composition', 'See proportions per mouse'],
    ['Responses vary across tissues', `Young femur and humerus fold changes correlate (ρ = ${rho('Femur','Humerus','YNG').toFixed(2)}). They are paired sites from the same animals.`, 'overview-conc', 'See tissue concordance'],
    ['Coordinated transcriptional programs', 'No within-cell-type gene test passes FDR; 11 whole-tissue results do. GSEA identifies metabolic, immune and lineage-associated programs.', 'pathway-ox', 'Open oxidative phosphorylation'],
    ['Lower pre-B proliferation programs', 'Cell-cycle programs are reduced in young marrow. The femoral mitotic-cluster fraction is 22% vs 8%, but its mouse-level comparison is not significant (p = 0.218).', 'preb', 'Open the pre-B view'],
    ['Inferred communication depends on sampling', `Young femur has ${fmtN(lf.lost)} ground-only and ${fmtN(lf.gained)} flight-only interactions. These are detection categories, not differential-signaling tests.`, 'communication', 'Open communication'],
    ['Pre-B flight shifts differ from the measured age contrast', 'Split-control maps do not support alignment in this population. This does not exclude systemic aging or imply rejuvenation.', 'age', 'Compare ages']];
  const host = $('#ov-find'); host.innerHTML = '';
  F.forEach(f => {
    const d = document.createElement('div'); d.className = 'finding';
    d.innerHTML = `<h4>${esc(f[0])}</h4><p>${esc(f[1])}</p>`;
    const b = document.createElement('button'); b.className = 'lnk'; b.type = 'button'; b.textContent = f[3] + ' →';
    b.onclick = () => {
      if (f[2] === 'overview-conc') $('#ov-conc').scrollIntoView({behavior: 'smooth', block: 'center'});
      else if (f[2] === 'pathway-ox') openPath('oxidative phosphorylation');
      else go(f[2]);
    };
    d.appendChild(b); host.appendChild(d);
  });
  $('#ov-ins').onclick = () => go('insights');
  drawMatrix();
  drawConc();
  drawRoster();
};
function matrixLayout(el, minW = 680) {
  const W = widthOf(el, minW);
  const rows = LIN.filter(ct => M.comps.some(c => c.ct === ct));
  const lw = Math.min(190, Math.max(130, W * 0.2)), top = 44, rh = 24;
  const cols = []; M.tissues.forEach(t => AGES.forEach(a => cols.push({t, a})));
  const cw = (W - lw - 8) / cols.length;
  return {W, rows, lw, top, rh, cols, cw, H: top + rows.length * rh + 6};
}
function matrixFrame(svg, L) {
  const g = svg.append('g');
  M.tissues.forEach((t, i) => {
    const x0 = L.lw + i * 2 * L.cw;
    g.append('text').attr('x', x0 + L.cw).attr('y', 14).attr('text-anchor', 'middle').style('font-weight', 700).style('fill', C.ink).text(t);
    AGES.forEach((a, j) => g.append('text').attr('x', x0 + (j + .5) * L.cw).attr('y', 32).attr('text-anchor', 'middle')
      .style('fill', a === 'YNG' ? C.young : C.older).style('font-weight', 600).text(AGE[a]));
    if (i) g.append('line').attr('x1', x0).attr('x2', x0).attr('y1', 4).attr('y2', L.H).attr('stroke', C.rule);
  });
  L.rows.forEach((ct, r) => {
    const y = L.top + r * L.rh;
    if (r % 2 === 0) g.append('rect').attr('x', 0).attr('y', y).attr('width', L.W).attr('height', L.rh).attr('fill', C.sunk).attr('opacity', .6);
    g.append('text').attr('x', L.lw - 10).attr('y', y + L.rh / 2 + 4).attr('text-anchor', 'end').style('fill', ct === 'Whole tissue' ? C.ink : C['ink-2'])
      .style('font-weight', ct === 'Whole tissue' ? 700 : 400).text(trunc(ct, 26));
  });
  return g;
}
function drawMatrix() {
  const el = $('#ov-matrix'); const L = matrixLayout(el); const svg = svgIn(el, L.W, L.H); matrixFrame(svg, L);
  const max = d3.max(M.comps, c => c.up + c.down);
  const rs = d3.scaleSqrt().domain([0, max]).range([0, Math.min(L.cw, L.rh) / 2 + 2]);
  const col = divScale(1);
  L.rows.forEach((ct, r) => L.cols.forEach((cc, j) => {
    const id = cid(cc.t, ct, cc.a); const cx = L.lw + (j + .5) * L.cw, cy = L.top + (r + .5) * L.rh;
    if (id == null) return;
    const c = M.comps[id], n = c.up + c.down, bal = n ? (c.up - c.down) / n : 0;
    const g = svg.append('g').style('cursor', 'pointer');
    if (n) g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', Math.max(2.5, rs(n))).attr('fill', col(bal)).attr('stroke', C.panel).attr('stroke-width', 1);
    else g.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 2.5).attr('fill', 'none').attr('stroke', C['ink-3']);
    g.append('rect').attr('class', 'hit').attr('x', cx - L.cw / 2).attr('y', cy - L.rh / 2).attr('width', L.cw).attr('height', L.rh)
      .on('pointermove', e => showTip(e, `<b>${esc(compLabel(c))}</b><br><span class="mono">${c.up} up · ${c.down} down</span> (p &lt; 0.05, |log2FC| &gt; 1)<br>` +
        (c.pathFDR != null ? `${c.pathFDR} GO terms at FDR &lt; 0.05<br>` : '') + `${c.nGC} ground vs ${c.nFLT} flight mice · ${fmtN(c.nCells)} cells`))
      .on('pointerleave', hideTip).on('click', () => openComp(cc.t, ct, cc.a));
  }));
  const leg = $('#ov-matrix-leg');
  leg.innerHTML = `<span>mostly down in flight <span class="bar8" style="background:${rampCSS(col, 1)}"></span> mostly up</span>` +
    [10, 50, 200].map(v => `<span><svg width="${2 * rs(v) + 2}" height="${2 * rs(v) + 2}" style="vertical-align:middle;margin-right:4px"><circle cx="${rs(v) + 1}" cy="${rs(v) + 1}" r="${rs(v)}" fill="none" stroke="${C['ink-3']}"/></svg>${v} genes</span>`).join('') +
    `<span><svg width="8" height="8" style="vertical-align:middle;margin-right:4px"><circle cx="4" cy="4" r="2.5" fill="none" stroke="${C['ink-3']}"/></svg>none</span>`;
}
function drawConc() {
  const host = $('#ov-conc'); host.innerHTML = '';
  const sc = seqScale(0, 0.6);
  AGES.forEach(a => {
    const d = document.createElement('div'); host.appendChild(d);
    const W = Math.max(220, widthOf(d)), lw = 62, n = 4, cs = Math.min(52, (W - lw) / n), H = 20 + n * cs + 4;
    const svg = svgIn(d, lw + n * cs, H);
    svg.append('text').attr('x', 0).attr('y', 12).style('font-weight', 700).style('fill', a === 'YNG' ? C.young : C.older).text(AGE[a][0].toUpperCase() + AGE[a].slice(1));
    M.tissues.forEach((t1, i) => {
      svg.append('text').attr('x', lw - 6).attr('y', 20 + i * cs + cs / 2 + 4).attr('text-anchor', 'end').text(t1);
      M.tissues.forEach((t2, j) => {
        const v = M.concordance.find(r => r[0] === t1 && r[1] === t2 && r[2] === a)[3];
        const x = lw + j * cs, y = 20 + i * cs;
        const diag = i === j;
        svg.append('rect').attr('x', x + 1).attr('y', y + 1).attr('width', cs - 2).attr('height', cs - 2).attr('rx', 2)
          .attr('fill', diag ? C.sunk : sc(v));
        svg.append('text').attr('x', x + cs / 2).attr('y', y + cs / 2 + 4).attr('text-anchor', 'middle').attr('class', 'mono')
          .style('font-family', 'var(--f-mono)').style('font-size', '11px').style('fill', diag ? C['ink-3'] : inkOn(sc(v)))
          .text(diag ? t1.slice(0, 3) : (v < 0 ? MINUS : '') + Math.abs(v).toFixed(2));
      });
    });
  });
}
function drawRoster() {
  const groups = [['GY', 'Young · ground'], ['FY', 'Young · flight'], ['GO', 'Older · ground'], ['FO', 'Older · flight']];
  let h = '<table class="t"><thead><tr><th>Mouse</th><th>Group</th>' + M.tissues.map(t => `<th class="r">${t}</th>`).join('') + '</tr></thead><tbody>';
  groups.forEach(([p, lab]) => {
    const ms = M.mice.filter(m => m.startsWith(p)).sort((a, b) => +a.slice(2) - +b.slice(2));
    ms.forEach(m => {
      h += `<tr><td class="mono">${m}</td><td class="nw"><span style="color:${p[0] === 'F' ? C.flight : C.ground}">●</span> ${lab}</td>` +
        M.tissues.map(t => `<td class="r num">${M.roster[m] && M.roster[m][t] ? fmtN(M.roster[m][t]) : '<span style="color:var(--ink-3)">—</span>'}</td>`).join('') + '</tr>';
    });
  });
  $('#ov-roster').innerHTML = h + '</tbody></table><p class="note">Bone and blood/spleen samples share most animals; one mouse per group differs between the two sets.</p>';
}

/* ================= GENE ================= */
let geneList = null;
const getGenes = async () => geneList || (geneList = await load('genelist.jgz.txt'));
R.gene = async () => {
  const sugg = ['Bub1','Mki67','Top2a','Igll1','Vpreb1','Camp','Hmgn2','B2m','Tgfb1','Cxcl12','Cd74'];
  $('#g-sugg').innerHTML = '<span class="chiplabel">Try</span>' + sugg.map(g => `<button type="button" class="chip gene${g === S.gene ? ' on' : ''}" data-g="${g}">${g}</button>`).join('');
  $('#g-sugg').onclick = e => { const b = e.target.closest('.chip'); if (b) openGene(b.dataset.g); };
  const g = S.gene;
  $('#g-name').textContent = g;
  $('#g-kv').innerHTML = '<span class="loading">Loading…</span>';
  ['#g-forest', '#g-pm', '#g-le'].forEach(s => $(s).innerHTML = '');
  const sh = await load('genes/' + shard(g) + '.jgz.txt');
  if (S.gene !== g || S.view !== 'gene') return;
  const rows = (sh[g] || []).map(r => ({c: r[0], l: r[1], se: r[2], p: r[3], q: r[4], b: r[5], comp: M.comps[r[0]]}));
  if (!rows.length) { $('#g-kv').innerHTML = 'Not tested: below the expression filter in every comparison.'; return; }
  const sig = rows.filter(r => r.p != null && r.p < 0.05);
  const minq = d3.min(rows, r => r.q);
  const best = d3.least(rows.filter(r => r.p != null), r => r.p);
  $('#g-kv').innerHTML = `<span>Tested in <b>${rows.length}</b> of ${M.comps.length} comparisons</span>` +
    `<span>Nominal p &lt; 0.05 in <b>${sig.length}</b> (<span class="up">${sig.filter(r => r.l > 0).length} up</span>, <span class="dn">${sig.filter(r => r.l < 0).length} down</span>)</span>` +
    `<span>Lowest FDR <b class="num">${fmtP(minq)}</b></span>` +
    (best ? `<span>Strongest: <b>${esc(compLabel(best.comp))}</b>, log2FC <b class="num">${sgn(best.l)}</b></span>` : '');
  // forest
  const byT = d3.group(rows, r => r.comp.tissue);
  const xm = Math.min(8, Math.max(1, d3.max(rows, r => Math.abs(r.l) + 1.96 * (r.se || 0))));
  if (!S.pmT) { const cand = rows.filter(r => r.p != null && r.comp.ct !== 'Whole tissue' && M.pbsets.some(p => p.tissue === r.comp.tissue && p.ct === r.comp.ct));
    const b = d3.least(cand, r => r.p); if (b) { S.pmT = b.comp.tissue; S.pmCt = b.comp.ct; } }
  const host = $('#g-forest');
  M.tissues.forEach(t => {
    const d = document.createElement('div'); host.appendChild(d);
    const tr = byT.get(t) || [];
    const cts = [...new Set(tr.map(r => r.comp.ct))].sort((a, b) => linIdx(a) - linIdx(b));
    const W = Math.max(280, widthOf(d)), lw = Math.min(150, W * 0.38), rh = 24, top = 26, H = top + Math.max(1, cts.length) * rh + 30;
    const svg = svgIn(d, W, H);
    svg.append('text').attr('x', 0).attr('y', 14).style('font-weight', 700).style('fill', C.ink).style('font-size', '12.5px').text(TNAME[t]);
    if (!cts.length) { svg.append('text').attr('x', 0).attr('y', 44).text('Not expressed enough to test'); return; }
    const x = d3.scaleLinear().domain([-xm, xm]).range([lw + 6, W - 8]).nice();
    const g = svg.append('g');
    g.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(5)).join('line').attr('x1', x).attr('x2', x).attr('y1', top).attr('y2', top + cts.length * rh);
    g.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top).attr('y2', top + cts.length * rh);
    xAxis(g, x, top + cts.length * rh, 5);
    cts.forEach((ct, i) => {
      const y = top + i * rh;
      const on = S.pmT === t && S.pmCt === ct;
      if (on) g.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', C.sunk);
      g.append('text').attr('x', lw - 4).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('fill', on ? C.ink : C['ink-2']).style('font-weight', on || ct === 'Whole tissue' ? 700 : 400).text(trunc(ct, 22));
      const rr = {};
      AGES.forEach((a, k) => {
        const r = tr.find(z => z.comp.ct === ct && z.comp.age === a); rr[a] = r; if (!r) return;
        const yy = y + rh / 2 + (k ? 4 : -4);
        const s = r.p != null && r.p < 0.05; const col = s ? (r.l > 0 ? C.flight : C.ground) : C['ink-3'];
        const lo = x(Math.max(-xm, r.l - 1.96 * r.se)), hi = x(Math.min(xm, r.l + 1.96 * r.se));
        g.append('line').attr('x1', lo).attr('x2', hi).attr('y1', yy).attr('y2', yy).attr('stroke', col).attr('stroke-width', 1.5).attr('opacity', .7);
        const cx = x(Math.max(-xm, Math.min(xm, r.l)));
        if (a === 'YNG') g.append('circle').attr('cx', cx).attr('cy', yy).attr('r', 3.8).attr('fill', s ? col : C.panel).attr('stroke', col).attr('stroke-width', 1.5);
        else g.append('rect').attr('x', cx - 3.4).attr('y', yy - 3.4).attr('width', 6.8).attr('height', 6.8).attr('transform', `rotate(45 ${cx} ${yy})`).attr('fill', s ? col : C.panel).attr('stroke', col).attr('stroke-width', 1.5);
      });
      const line = (a) => { const r = rr[a]; if (!r) return `${AGE[a]}: not tested`;
        return `${AGE[a]}: <span class="mono">log2FC ${sgn(r.l)} ± ${r.se.toFixed(2)} · p ${fmtP(r.p)} · FDR ${fmtP(r.q)}</span> · ${r.comp.nGC} vs ${r.comp.nFLT} mice`; };
      g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh)
        .on('pointermove', e => showTip(e, `<b>${esc(t)} · ${esc(ct)}</b><br>${line('YNG')}<br>${line('OLD')}`))
        .on('pointerleave', hideTip).on('click', () => { S.pmT = t; S.pmCt = ct; hideTip(); R.gene(); });
    });
  });
  $('#g-forest-leg').innerHTML = `<span><svg width="10" height="10" style="vertical-align:-1px;margin-right:5px"><circle cx="5" cy="5" r="3.8" fill="none" stroke="${C['ink-2']}" stroke-width="1.5"/></svg>Young</span>` +
    `<span><svg width="12" height="12" style="vertical-align:-2px;margin-right:5px"><rect x="3" y="3" width="6" height="6" transform="rotate(45 6 6)" fill="none" stroke="${C['ink-2']}" stroke-width="1.5"/></svg>Older</span>` +
    `<span><i style="background:${C.flight}"></i>higher in flight, p &lt; 0.05</span><span><i style="background:${C.ground}"></i>higher on ground, p &lt; 0.05</span><span><i style="background:none;border:1.5px solid ${C['ink-3']}"></i>p ≥ 0.05</span>`;
  drawPerMouse(g, rows);
  drawGeneLE(g);
};
async function drawPerMouse(g, rows) {
  const el = $('#g-pm'), t = S.pmT, ct = S.pmCt;
  $('#g-pm-title').textContent = t ? `Each mouse · ${t} · ${ct}` : 'Each mouse';
  if (!t) { el.innerHTML = '<p class="empty">Click a row above.</p>'; return; }
  const pid = M.pbsets.findIndex(p => p.tissue === t && p.ct === ct);
  if (pid < 0) { el.innerHTML = '<p class="empty">Per-mouse values exist for single cell types only. Pick a cell-type row.</p>'; return; }
  const pb = await load('pb/' + shard(g) + '.jgz.txt');
  if (S.gene !== g) return;
  const vals = pb[g] && pb[g][pid];
  const set = M.pbsets[pid];
  if (!vals) { el.innerHTML = '<p class="empty">Below the expression filter in this cell type (at least 5 counts in 2 mice).</p>'; return; }
  const pts = set.mice.map((m, i) => ({m, v: vals[i], n: set.nCells[i], grp: (m[1] === 'Y' ? 'YNG' : 'OLD') + '_' + (m[0] === 'F' ? 'FLT' : 'GC')}));
  const st = {}; AGES.forEach(a => { const r = rows.find(z => z.comp.tissue === t && z.comp.ct === ct && z.comp.age === a); st[a] = r; });
  dotGroups(el, pts, {ylab: 'log2 CPM', fmt: v => v.toFixed(2), unit: '', stats: a => st[a] ? `log2FC ${sgn(st[a].l)} · p ${fmtP(st[a].p)}` : 'not tested',
    tipExtra: p => `${fmtN(p.n)} cells`});
  $('#g-pm-sub').textContent = 'log2 CPM of summed counts per mouse (mice with at least 10 cells of this type).';
}
function dotGroups(el, pts, o) {
  const W = Math.max(300, widthOf(el)), H = 262, m = {l: 44, r: 8, t: 52, b: 30};
  const svg = svgIn(el, W, H);
  const grps = ['YNG_GC', 'YNG_FLT', 'OLD_GC', 'OLD_FLT'];
  const x = d3.scaleBand().domain(grps).range([m.l, W - m.r]).paddingInner(.15).paddingOuter(.1);
  const ext = d3.extent(pts, p => p.v); const pad = (ext[1] - ext[0]) * .12 || 1;
  const y = d3.scaleLinear().domain([o.zero ? 0 : ext[0] - pad, ext[1] + pad]).range([H - m.b, m.t]).nice();
  const g = svg.append('g');
  g.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  g.append('g').attr('transform', `translate(${m.l},0)`).call(gg => yAxis(gg, y, 5, null, o.yfmt));
  g.append('text').attr('x', 0).attr('y', 11).attr('text-anchor', 'start').style('fill', C['ink-3']).text(o.ylab);
  AGES.forEach((a, k) => {
    const x0 = x(grps[2 * k]), x1 = x(grps[2 * k + 1]) + x.bandwidth();
    g.append('text').attr('x', (x0 + x1) / 2).attr('y', m.t - 26).attr('text-anchor', 'middle').style('font-weight', 700).style('fill', a === 'YNG' ? C.young : C.older).text(AGE[a][0].toUpperCase() + AGE[a].slice(1));
    g.append('text').attr('x', (x0 + x1) / 2).attr('y', m.t - 12).attr('text-anchor', 'middle').attr('class', 'mono').style('font-family', 'var(--f-mono)').style('font-size', '10.5px').text(o.stats(a));
  });
  grps.forEach(gr => {
    const ps = pts.filter(p => p.grp === gr && p.v != null); const cx = x(gr) + x.bandwidth() / 2;
    const col = gr.endsWith('FLT') ? C.flight : C.ground;
    g.append('text').attr('x', cx).attr('y', H - m.b + 18).attr('text-anchor', 'middle').text(gr.endsWith('FLT') ? 'flight' : 'ground');
    if (!ps.length) return;
    const mu = d3.mean(ps, p => p.v);
    g.append('line').attr('x1', cx - x.bandwidth() * .32).attr('x2', cx + x.bandwidth() * .32).attr('y1', y(mu)).attr('y2', y(mu)).attr('stroke', col).attr('stroke-width', 2.5);
    ps.forEach((p, i) => {
      const jx = cx + (i - (ps.length - 1) / 2) * Math.min(12, x.bandwidth() / (ps.length + 1));
      g.append('circle').attr('cx', jx).attr('cy', y(p.v)).attr('r', 5).attr('fill', col).attr('fill-opacity', .85).attr('stroke', C.panel).attr('stroke-width', 1.5);
      g.append('circle').attr('class', 'hit').attr('cx', jx).attr('cy', y(p.v)).attr('r', 10)
        .on('pointermove', e => showTip(e, `<b class="mono">${p.m}</b> · ${gr.endsWith('FLT') ? 'flight' : 'ground'}, ${AGE[gr.slice(0, 3)]}<br><span class="mono">${o.fmt(p.v)}${o.unit}</span>${o.tipExtra ? ' · ' + o.tipExtra(p) : ''}`))
        .on('pointerleave', hideTip);
    });
  });
}
async function drawGeneLE(g) {
  const el = $('#g-le'); el.innerHTML = '<p class="loading">Loading…</p>';
  const [gs, le] = await Promise.all([gsea(), load('gsea_le.jgz.txt')]);
  if (S.gene !== g) return;
  const hits = [];
  for (const k in le) {
    const genes = le[k]; if (genes.indexOf(g) < 0) continue;
    if (!genes.split(';').includes(g)) continue;
    const [c, p] = k.split('|').map(Number); const r = gs.byC.get(c).find(z => z.p === p);
    if (r && r.q < 0.05) hits.push(r);
  }
  hits.sort((a, b) => a.q - b.q);
  if (!hits.length) { el.innerHTML = '<p class="empty">Not found in the exported leading-edge lists at FDR &lt; 0.05 (lists are truncated to 20 genes).</p>'; return; }
  const show = () => { let h = `<div class="tw"><table class="t"><thead><tr><th>GO term</th><th>Comparison</th><th class="r">NES</th><th class="r">FDR</th></tr></thead><tbody>`;
  hits.slice(0, S.leN).forEach((r, i) => {
    h += `<tr class="click" data-i="${i}"><td>${esc(trunc(gs.paths[r.p], 46))}</td><td>${esc(compLabel(M.comps[r.c]))}</td><td class="r num ${r.n > 0 ? 'up' : 'dn'}">${sgn(r.n)}</td><td class="r num">${fmtP(r.q)}</td></tr>`;
  });
  el.innerHTML = h + '</tbody></table></div>' + (hits.length > S.leN ? `<p class="note">Showing ${S.leN} of ${hits.length}. <button type="button" class="lnk">Show more</button></p>` : `<p class="note">${hits.length} terms.</p>`);
  el.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { const r = hits[+tr.dataset.i]; openPath(gs.paths[r.p], r.c); });
  const b = el.querySelector('button.lnk'); if (b) b.onclick = () => { S.leN += 20; show(); }; };
  S.leN = 12; show();
}

/* ================= TISSUE ================= */
R.tissue = async () => {
  const t = S.tissue;
  if (!M.comps.some(c => c.tissue === t && c.ct === S.ct)) S.ct = 'Whole tissue';
  if (cid(t, S.ct, S.age) == null) S.age = AGES.find(a => cid(t, S.ct, a) != null) || 'YNG';
  $('#t-title').textContent = TNAME[t];
  seg($('#t-tis'), M.tissues.map(x => [x, x]), t, v => { S.tissue = v; render(); });
  $('#t-color').value = S.color; $('#t-color').onchange = e => { S.color = e.target.value; drawUmap(); };
  drawCtTable(); drawUmap(); drawSel();
};
function ctCounts(t) {
  const m = new Map(); M.compPerMouse.forEach(r => { if (r[0] === t) m.set(r[2], (m.get(r[2]) || 0) + r[3]); }); return m;
}
function drawCtTable() {
  const t = S.tissue, cnt = ctCounts(t);
  const cts = ['Whole tissue', ...M.celltypes[t].slice().sort((a, b) => linIdx(a) - linIdx(b))];
  const cell = (ct, a) => { const id = cid(t, ct, a); if (id == null) return '<td class="r" colspan="1"><span style="color:var(--ink-3)">—</span></td>';
    const c = M.comps[id]; return `<td class="r num"><span class="up">${c.up}</span> / <span class="dn">${c.down}</span></td>`; };
  const go_ = (ct, a) => { const id = cid(t, ct, a); return id == null || M.comps[id].pathFDR == null ? '—' : M.comps[id].pathFDR; };
  let h = '<table class="t"><thead><tr><th>Cell type</th><th class="r">Cells</th><th class="r" style="color:var(--young)">Young</th><th class="r" style="color:var(--older)">Older</th><th class="r">GO Y / O</th></tr></thead><tbody>';
  cts.forEach(ct => {
    const n = ct === 'Whole tissue' ? M.umap[t].nTotal : cnt.get(ct) || 0;
    const has = M.comps.some(c => c.tissue === t && c.ct === ct);
    h += `<tr class="${has ? 'click' : ''}${ct === S.ct ? ' on' : ''}" data-ct="${esc(ct)}"${has ? '' : ' title="Too few cells per mouse to compare"'}><td>${ct === 'Whole tissue' ? '<b>Whole tissue</b>' : `<span style="color:${ctColor(ct)}">●</span> ${esc(ct)}`}</td><td class="r num">${fmtN(n)}</td>${cell(ct, 'YNG')}${cell(ct, 'OLD')}<td class="r num">${go_(ct, 'YNG')} / ${go_(ct, 'OLD')}</td></tr>`;
  });
  $('#t-table').innerHTML = h + '</tbody></table>';
  $('#t-table').querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { S.ct = tr.dataset.ct; R.tissue(); });
}
async function drawUmap() {
  const t = S.tissue, el = $('#t-umap');
  const u = await load('umap/' + t + '.jgz.txt'); if (S.tissue !== t) return;
  el.innerHTML = '';
  const W = Math.min(widthOf(el, 260), 640), H = W;
  const {cv, ctx} = canvasIn(el, W, H); el.appendChild(cv);
  const lab = document.createElement('div'); lab.className = 'ulabels'; lab.style.width = W + 'px'; lab.style.height = H + 'px'; el.appendChild(lab);
  const pad = 10;
  const x = d3.scaleLinear().domain(d3.extent(u.x)).range([pad, W - pad]), y = d3.scaleLinear().domain(d3.extent(u.y)).range([H - pad, pad]);
  const cts = M.celltypes[t];
  const colOf = i => S.color === 'ct' ? ctColor(cts[u.c[i]]) : S.color === 'cond' ? condColor(M.mice[u.m[i]]) : (M.mice[u.m[i]][1] === 'Y' ? C.young : C.older);
  const selIdx = cts.indexOf(S.ct);
  const r = W > 420 ? 1.5 : 1.15;
  const drawPts = (filter, alpha) => { ctx.globalAlpha = alpha;
    for (let i = 0; i < u.x.length; i++) { if (!filter(i)) continue; ctx.fillStyle = colOf(i); ctx.beginPath(); ctx.arc(x(u.x[i]), y(u.y[i]), r, 0, 6.283); ctx.fill(); } };
  if (selIdx >= 0 && S.color === 'ct') { drawPts(i => u.c[i] !== selIdx, .35); drawPts(i => u.c[i] === selIdx, .95); }
  else drawPts(() => true, .7);
  ctx.globalAlpha = 1;
  if (S.color === 'ct') {
    cts.forEach((ct, k) => {
      const xs = [], ys = []; for (let i = 0; i < u.x.length; i++) if (u.c[i] === k) { xs.push(u.x[i]); ys.push(u.y[i]); }
      if (xs.length < 40) return;
      const s = document.createElement('span'); s.textContent = ct; s.style.left = (x(d3.median(xs)) / W * 100) + '%'; s.style.top = (y(d3.median(ys)) / H * 100) + '%';
      if (k === selIdx) s.style.textDecoration = 'underline';
      lab.appendChild(s);
      const hw = s.offsetWidth / 2 + 2, cx = x(d3.median(xs));
      s.style.left = Math.max(hw, Math.min(W - hw, cx)) + 'px';
    });
  }
  const leg = $('#t-umap-leg');
  if (S.color === 'ct') leg.innerHTML = cts.slice().sort((a, b) => linIdx(a) - linIdx(b)).map(ct => `<button type="button" class="chip${ct === S.ct ? ' on' : ''}" data-ct="${esc(ct)}"><i style="background:${ctColor(ct)}"></i>${esc(ct)}</button>`).join('');
  else if (S.color === 'cond') leg.innerHTML = `<span><i style="background:${C.ground}"></i>Ground control</span><span><i style="background:${C.flight}"></i>Flight</span>`;
  else leg.innerHTML = `<span><i style="background:${C.young}"></i>Young</span><span><i style="background:${C.older}"></i>Older</span>`;
  leg.onclick = e => { const b = e.target.closest('.chip'); if (b) { S.ct = b.dataset.ct; R.tissue(); } };
  leg.insertAdjacentHTML('beforeend', `<span style="color:var(--ink-3);margin-left:auto">${fmtN(M.umap[t].nShown)} of ${fmtN(M.umap[t].nTotal)} cells drawn</span>`);
}
async function drawSel() {
  const t = S.tissue, ct = S.ct;
  seg($('#t-age'), AGES.filter(a => cid(t, ct, a) != null).map(a => [a, AGE[a][0].toUpperCase() + AGE[a].slice(1)]), S.age, v => { S.age = v; drawSel(); });
  const id = cid(t, ct, S.age), c = M.comps[id];
  $('#t-sel-eyebrow').textContent = TNAME[t] + ' · ' + AGE[S.age] + ' mice';
  $('#t-sel-title').textContent = ct;
  $('#t-sel-kv').innerHTML = `<span><b>${c.nGC}</b> ground vs <b>${c.nFLT}</b> flight mice</span><span><b>${fmtN(c.nCells)}</b> cells</span><span><b>${fmtN(c.nGenes)}</b> genes tested</span>` +
    `<span><b class="up">${c.up}</b> up · <b class="dn">${c.down}</b> down</span><span>lowest FDR <b class="num">${fmtP(c.minPadj)}</b></span>` + (c.pathFDR != null ? `<span><b>${c.pathFDR}</b> GO terms at FDR &lt; 0.05</span>` : '');
  seg($('#t-dir'), [['dn', 'Down in flight'], ['up', 'Up in flight']], S.dir, v => { S.dir = v; drawSel(); });
  const mk = M.markers[t + '|' + ct];
  $('#t-markers').innerHTML = mk ? '<table class="t"><thead><tr><th>Gene</th><th class="r">log2FC</th><th class="r">% in</th><th class="r">% out</th></tr></thead><tbody>' +
    mk.map(r => `<tr class="click" data-g="${esc(r[0])}"><td class="gene">${esc(r[0])}</td><td class="r num">${sgn(r[1])}</td><td class="r num">${Math.round(r[2] * 100)}</td><td class="r num">${Math.round(r[3] * 100)}</td></tr>`).join('') + '</tbody></table>'
    : '<p class="empty">Markers are defined per cell type.</p>';
  $('#t-markers').querySelectorAll('tr.click').forEach(tr => tr.onclick = () => openGene(tr.dataset.g));
  const d = await load('comp/' + id + '.jgz.txt');
  if (cid(S.tissue, S.ct, S.age) !== id) return;
  drawVolcano($('#t-volcano'), d);
  // top genes
  const idx = d3.range(d.g.length).filter(i => d.p[i] != null && d.p[i] < 0.05 && (S.dir === 'up' ? d.l[i] > 0 : d.l[i] < 0)).slice(0, 20);
  $('#t-genes').innerHTML = idx.length ? '<table class="t"><thead><tr><th>Gene</th><th class="r">log2FC</th><th class="r">p</th><th class="r">FDR</th></tr></thead><tbody>' +
    idx.map(i => `<tr class="click" data-g="${esc(d.g[i])}"><td class="gene">${esc(d.g[i])}</td><td class="r num ${d.l[i] > 0 ? 'up' : 'dn'}">${sgn(d.l[i])}</td><td class="r num">${fmtP(d.p[i])}</td><td class="r num">${fmtP(d.q[i])}</td></tr>`).join('') + '</tbody></table>'
    : '<p class="empty">No gene at p &lt; 0.05 in this direction.</p>';
  $('#t-genes').querySelectorAll('tr.click').forEach(tr => tr.onclick = () => openGene(tr.dataset.g));
  drawGseaBars($('#t-gsea'), id);
}
function drawVolcano(el, d) {
  el.innerHTML = '';
  const W = Math.max(300, widthOf(el)), H = Math.max(280, Math.round(W * .6)), m = {l: 46, r: 12, t: 12, b: 40};
  const n = d.g.length, xs = [], ys = [];
  for (let i = 0; i < n; i++) { xs.push(d.l[i]); ys.push(d.p[i] == null ? null : -Math.log10(Math.max(d.p[i], 1e-300))); }
  const xm = Math.min(10, Math.max(2, d3.max(xs, Math.abs) * 1.05)), ym = Math.max(2, d3.max(ys) * 1.08);
  const x = d3.scaleLinear().domain([-xm, xm]).range([m.l, W - m.r]).nice(), y = d3.scaleLinear().domain([0, ym]).range([H - m.b, m.t]).nice();
  el.style.height = H + 'px';
  const {cv, ctx} = canvasIn(el, W, H); cv.style.position = 'absolute'; cv.style.left = 0; cv.style.top = 0; el.appendChild(cv);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).style('position', 'absolute').style('left', 0).style('top', 0);
  const g = svg.append('g');
  g.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  xAxis(g, x, H - m.b, 7); g.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text('log2FC, flight vs ground →');
  g.append('g').attr('transform', `translate(${m.l},0)`).call(gg => yAxis(gg, y, 5));
  g.append('text').attr('x', m.l + 6).attr('y', m.t + 10).style('fill', C['ink-3']).text('−log10 p');
  const thr = -Math.log10(0.05);
  g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(thr)).attr('y2', y(thr)).attr('stroke', C['ink-3']).attr('stroke-dasharray', '3 3');
  [-1, 1].forEach(v => g.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', C['ink-3']).attr('stroke-dasharray', '3 3'));
  const isSig = i => ys[i] != null && ys[i] > thr && Math.abs(xs[i]) > 1;
  const pts = [];
  ctx.fillStyle = C['ink-3']; ctx.globalAlpha = .28;
  for (let i = 0; i < n; i++) { if (ys[i] == null) continue; const px = x(xs[i]), py = y(ys[i]); pts.push([px, py, i]); if (!isSig(i)) { ctx.beginPath(); ctx.arc(px, py, 1.7, 0, 6.283); ctx.fill(); } }
  ctx.globalAlpha = .9;
  for (let i = 0; i < n; i++) { if (!isSig(i)) continue; ctx.fillStyle = xs[i] > 0 ? C.flight : C.ground; ctx.beginPath(); ctx.arc(x(xs[i]), y(ys[i]), 2.8, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  const lab = d3.range(n).filter(isSig).slice(0, W < 520 ? 6 : 10);
  const placed = [];
  lab.forEach(i => { const px = x(xs[i]), py = y(ys[i]); const left = xs[i] > 0; let ty = py - 5;
    for (const q of placed) if (Math.abs(q[0] - px) < 60 && Math.abs(q[1] - ty) < 11) ty = q[1] - 11;
    placed.push([px, ty]);
    g.append('text').attr('x', px + (left ? 5 : -5)).attr('y', ty).attr('text-anchor', left ? 'start' : 'end').style('font-style', 'italic').style('fill', C.ink).style('font-size', '11px').text(d.g[i]); });
  const ring = g.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 1.5).style('display', 'none');
  const del = d3.Delaunay.from(pts, p => p[0], p => p[1]);
  let cur = -1;
  svg.on('pointermove', e => { const [mx, my] = d3.pointer(e); const k = del.find(mx, my); if (k < 0) return; const p = pts[k];
    if (Math.hypot(p[0] - mx, p[1] - my) > 14) { ring.style('display', 'none'); cur = -1; hideTip(); svg.style('cursor', null); return; }
    cur = p[2]; ring.attr('cx', p[0]).attr('cy', p[1]).style('display', null); svg.style('cursor', 'pointer');
    showTip(e, `<b class="gene">${esc(d.g[cur])}</b><br><span class="mono">log2FC ${sgn(d.l[cur])} · p ${fmtP(d.p[cur])} · FDR ${fmtP(d.q[cur])}<br>baseMean ${d.b[cur]}</span>`); })
    .on('pointerleave', () => { ring.style('display', 'none'); cur = -1; hideTip(); })
    .on('click', () => { if (cur >= 0) openGene(d.g[cur]); });
}
async function drawGseaBars(el, id) {
  el.innerHTML = '';
  if (!M.comps[id].gsea) { el.innerHTML = '<p class="empty">No GSEA for this comparison.</p>'; return; }
  const gs = await gsea();
  const rows = gs.byC.get(id) || [];
  const pick = sign => rows.filter(r => sign > 0 ? r.n > 0 : r.n < 0).sort((a, b) => a.q - b.q || Math.abs(b.n) - Math.abs(a.n)).slice(0, 8);
  const up = pick(1), dn = pick(-1);
  const data = [...up.sort((a, b) => b.n - a.n), ...dn.sort((a, b) => b.n - a.n)];
  const W = Math.max(320, widthOf(el)), rh = 22, H = data.length * rh + 34;
  const lw = Math.min(W * .58, 360);
  const svg = svgIn(el, W, H);
  const xm = Math.max(2, d3.max(data, r => Math.abs(r.n)));
  const x = d3.scaleLinear().domain([-xm, xm]).range([lw + 8, W - 24]).nice();
  const g = svg.append('g');
  g.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(5)).join('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', data.length * rh);
  xAxis(g, x, data.length * rh, 5); g.append('text').attr('x', W - 24).attr('y', data.length * rh + 30).attr('text-anchor', 'end').text('NES');
  const cw = 6.3;
  data.forEach((r, i) => {
    const y = i * rh;
    if (i === up.length && up.length) g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y).attr('y2', y).attr('stroke', C.rule);
    g.append('text').attr('x', lw).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('fill', r.q < 0.05 ? C.ink : C['ink-3']).text(trunc(gs.paths[r.p], Math.floor(lw / cw)));
    const x0 = x(0), x1 = x(r.n);
    g.append('rect').attr('x', Math.min(x0, x1)).attr('y', y + 5).attr('width', Math.abs(x1 - x0)).attr('height', rh - 10).attr('rx', 2)
      .attr('fill', r.n > 0 ? C.flight : C.ground).attr('opacity', r.q < 0.05 ? 1 : .4);
    if (r.q < 0.05) g.append('text').attr('x', x0 + (r.n > 0 ? -5 : 5)).attr('y', y + rh / 2 + 5).attr('text-anchor', r.n > 0 ? 'end' : 'start').style('fill', C.ink).style('font-weight', 700).text('*');
    g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh)
      .on('pointermove', e => showTip(e, `<b>${esc(gs.paths[r.p])}</b><br><span class="mono">NES ${sgn(r.n)} · FDR ${fmtP(r.q)} · ${r.s} genes</span>`))
      .on('pointerleave', hideTip).on('click', () => openPath(gs.paths[r.p], id));
  });
  g.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', data.length * rh);
}

/* ================= AGE ================= */
R.age = async () => {
  drawDumbbell();
  lianaSummary($('#a-liana'), false);
  const tsel = $('#a-tis'), csel = $('#a-ct');
  tsel.innerHTML = M.tissues.map(t => `<option ${t === S.aT ? 'selected' : ''}>${t}</option>`).join('');
  const both = t => ['Whole tissue', ...M.celltypes[t]].filter(ct => cid(t, ct, 'YNG') != null && cid(t, ct, 'OLD') != null).sort((a, b) => linIdx(a) - linIdx(b));
  if (!both(S.aT).includes(S.aCt)) S.aCt = both(S.aT)[0];
  csel.innerHTML = both(S.aT).map(ct => `<option ${ct === S.aCt ? 'selected' : ''}>${esc(ct)}</option>`).join('');
  tsel.onchange = () => { S.aT = tsel.value; R.age(); };
  csel.onchange = () => { S.aCt = csel.value; R.age(); };
  const pre = await load('preb.jgz.txt');
  splitCard($('#a-split'), pre);
  const iy = cid(S.aT, S.aCt, 'YNG'), io = cid(S.aT, S.aCt, 'OLD');
  const [dy, dO] = await Promise.all([load('comp/' + iy + '.jgz.txt'), load('comp/' + io + '.jgz.txt')]);
  if (S.view !== 'age') return;
  const mo = new Map(dO.g.map((g, i) => [g, i]));
  const pts = [];
  dy.g.forEach((g, i) => { const j = mo.get(g); if (j == null) return; pts.push({k: g, x: dy.l[i], y: dO.l[j], sx: dy.p[i] != null && dy.p[i] < 0.05, sy: dO.p[j] != null && dO.p[j] < 0.05, tip: `<b class="gene">${esc(g)}</b><br><span class="mono">young ${sgn(dy.l[i])} (p ${fmtP(dy.p[i])})<br>older ${sgn(dO.l[j])} (p ${fmtP(dO.p[j])})</span>`}); });
  scatterYO($('#a-sc-gene'), pts, 'Genes · log2FC', g => openGene(g.k), true);
  if (M.comps[iy].gsea && M.comps[io].gsea) {
    const gs = await gsea();
    const ro = new Map((gs.byC.get(io) || []).map(r => [r.p, r]));
    const pp = (gs.byC.get(iy) || []).filter(r => ro.has(r.p)).map(r => { const o = ro.get(r.p); return {k: r.p, x: r.n, y: o.n, sx: r.q < 0.05, sy: o.q < 0.05,
      tip: `<b>${esc(gs.paths[r.p])}</b><br><span class="mono">young NES ${sgn(r.n)} (FDR ${fmtP(r.q)})<br>older NES ${sgn(o.n)} (FDR ${fmtP(o.q)})</span>`}; });
    scatterYO($('#a-sc-path'), pp, 'GO terms · NES', p => openPath(gs.paths[p.k]), false);
  } else $('#a-sc-path').innerHTML = '<p class="empty">GSEA was not run for both ages here (whole-tissue comparisons have gene-level results only).</p>';
};
function drawDumbbell() {
  const el = $('#a-dumb');
  const rows = [];
  M.tissues.forEach(t => {
    const cts = ['Whole tissue', ...M.celltypes[t]].filter(ct => cid(t, ct, 'YNG') != null && cid(t, ct, 'OLD') != null);
    const rr = cts.map(ct => { const y = M.comps[cid(t, ct, 'YNG')], o = M.comps[cid(t, ct, 'OLD')]; return {t, ct, y, o, vy: y.up + y.down, vo: o.up + o.down}; })
      .sort((a, b) => Math.max(b.vy, b.vo) - Math.max(a.vy, a.vo));
    rows.push({head: t}); rr.forEach(r => rows.push(r));
  });
  const W = Math.max(320, widthOf(el)), rh = 20, lw = Math.min(190, W * .36), H = rows.length * rh + 34;
  const svg = svgIn(el, W, H);
  const xmax = d3.max(rows.filter(r => !r.head), r => Math.max(r.vy, r.vo));
  const x = d3.scaleSqrt().domain([0, xmax]).range([lw + 10, W - 16]).nice();
  const g = svg.append('g');
  const ticks = [0, 10, 50, 100, 200, 300].filter(v => v <= x.domain()[1]);
  g.append('g').attr('class', 'grid').selectAll('line').data(ticks).join('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', rows.length * rh);
  g.append('g').attr('class', 'ax').attr('transform', `translate(0,${rows.length * rh})`).call(d3.axisBottom(x).tickValues(ticks).tickSizeOuter(0));
  g.append('text').attr('x', W - 16).attr('y', H - 2).attr('text-anchor', 'end').text('genes changed (square-root scale)');
  rows.forEach((r, i) => {
    const y = i * rh + rh / 2;
    if (r.head) { g.append('text').attr('x', 0).attr('y', y + 5).style('font-weight', 700).style('fill', C.ink).text(TNAME[r.head]); return; }
    g.append('text').attr('x', lw).attr('y', y + 4).attr('text-anchor', 'end').style('fill', r.ct === 'Whole tissue' ? C.ink : C['ink-2']).text(trunc(r.ct, 26));
    g.append('line').attr('x1', x(r.vy)).attr('x2', x(r.vo)).attr('y1', y).attr('y2', y).attr('stroke', C.rule).attr('stroke-width', 3);
    g.append('circle').attr('cx', x(r.vo)).attr('cy', y).attr('r', 5).attr('fill', C.older).attr('stroke', C.panel).attr('stroke-width', 1.5);
    g.append('circle').attr('cx', x(r.vy)).attr('cy', y).attr('r', 5).attr('fill', C.young).attr('stroke', C.panel).attr('stroke-width', 1.5);
    g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y - rh / 2).attr('width', W).attr('height', rh)
      .on('pointermove', e => showTip(e, `<b>${esc(r.t)} · ${esc(r.ct)}</b><br><span class="mono">young ${r.y.up} up / ${r.y.down} down<br>older ${r.o.up} up / ${r.o.down} down</span>`))
      .on('pointerleave', hideTip).on('click', () => openComp(r.t, r.ct, r.vy >= r.vo ? 'YNG' : 'OLD'));
  });
}
function lianaSummary(el, clickable) {
  const rows = []; M.tissues.forEach(t => AGES.forEach(a => rows.push(M.liana.find(d => d.tissue === t && d.age === a))));
  const W = Math.max(320, widthOf(el)), rh = 28, lw = 128, rw = 86, H = rows.length * rh + 40;
  const svg = svgIn(el, W, H);
  const m = d3.max(rows, r => Math.max(r.lost, r.gained));
  const x = d3.scaleLinear().domain([-m, m]).range([lw + 52, W - rw - 8]).nice();
  const g = svg.append('g').attr('transform', 'translate(0,20)');
  g.append('text').attr('x', x(0) - 6).attr('y', -6).attr('text-anchor', 'end').style('fill', C.ground).style('font-weight', 600).text('← lost (ground only)');
  g.append('text').attr('x', x(0) + 6).attr('y', -6).style('fill', C.flight).style('font-weight', 600).text('gained (flight only) →');
  g.append('text').attr('x', W).attr('y', -6).attr('text-anchor', 'end').style('fill', C['ink-3']).text('shared');
  rows.forEach((r, i) => {
    const y = i * rh; const on = clickable && r.tissue === S.mT && r.age === S.mA;
    if (on) g.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).attr('fill', C.sunk);
    if (i % 2 === 0 && i) g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y).attr('y2', y).attr('stroke', C['rule-2']);
    g.append('text').attr('x', 0).attr('y', y + rh / 2 + 4).style('font-weight', i % 2 ? 400 : 700).style('fill', i % 2 ? 'transparent' : C.ink).text(r.tissue);
    g.append('text').attr('x', lw).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('fill', r.age === 'YNG' ? C.young : C.older).style('font-weight', 600).text(AGE[r.age]);
    g.append('rect').attr('x', x(-r.lost)).attr('y', y + 6).attr('width', x(0) - x(-r.lost)).attr('height', rh - 12).attr('rx', 2).attr('fill', C.ground);
    g.append('rect').attr('x', x(0)).attr('y', y + 6).attr('width', x(r.gained) - x(0)).attr('height', rh - 12).attr('rx', 2).attr('fill', C.flight);
    g.append('text').attr('x', x(-r.lost) - 4).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('class', 'mono').style('font-family', 'var(--f-mono)').text(fmtN(r.lost));
    g.append('text').attr('x', x(r.gained) + 4).attr('y', y + rh / 2 + 4).style('font-family', 'var(--f-mono)').text(fmtN(r.gained));
    g.append('text').attr('x', W).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('font-family', 'var(--f-mono)').style('fill', C['ink-3']).text(fmtN(r.shared));
    const hit = g.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh)
      .on('pointermove', e => showTip(e, `<b>${esc(r.tissue)} · ${AGE[r.age]}</b><br><span class="mono">${fmtN(r.lost)} lost · ${fmtN(r.shared)} shared · ${fmtN(r.gained)} gained</span>`))
      .on('pointerleave', hideTip);
    if (clickable) hit.on('click', () => { S.mT = r.tissue; S.mA = r.age; R.communication(); });
    else hit.on('click', () => go('communication', {mT: r.tissue, mA: r.age}));
  });
  g.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', rows.length * rh);
}
function splitCard(el, pre) {
  const row = a => pre.split.find(r => r[0] === a);
  el.innerHTML = '<div class="grid g2" style="gap:12px">' + AGES.map(a => { const r = row(a);
    return `<div><div class="eyebrow" style="color:${a === 'YNG' ? 'var(--young)' : 'var(--older)'}">${AGE[a]} mice</div><div class="big num">ρ ${sgn(r[1])}</div>
      <div class="note mono">range ${sgn(r[2])} to ${sgn(r[3])} over 6 splits</div></div>`; }).join('') + '</div>' +
    '<p class="note">A positive ρ would mean flight moves pre-B cells toward the state of older ground mice. It is negative in young mice and near zero in older mice. Reusing the same ground mice in both maps inflates the correlation, so this test keeps them apart.</p>';
}
function scatterYO(el, pts, label, onClick, canvas) {
  el.innerHTML = '';
  if (!pts.length) { el.innerHTML = '<p class="empty">Nothing tested in both ages.</p>'; return; }
  const W = Math.max(280, widthOf(el)), H = Math.min(W, 420), m = {l: 42, r: 10, t: 30, b: 40};
  const ext = d3.max(pts, p => Math.max(Math.abs(p.x), Math.abs(p.y)));
  const lim = Math.min(canvas ? 6 : 4, ext * 1.05);
  const x = d3.scaleLinear().domain([-lim, lim]).range([m.l, W - m.r]).nice(), y = d3.scaleLinear().domain([-lim, lim]).range([H - m.b, m.t]).nice();
  const cl = v => Math.max(-lim, Math.min(lim, v));
  el.style.height = H + 'px'; el.style.position = 'relative';
  const {cv, ctx} = canvasIn(el, W, H); cv.style.position = 'absolute'; cv.style.left = 0; cv.style.top = 0; el.appendChild(cv);
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).style('position', 'absolute').style('left', 0).style('top', 0);
  const g = svg.append('g');
  g.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(5)).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t).attr('y2', H - m.b);
  g.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  g.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b);
  g.append('line').attr('class', 'zero').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0));
  g.append('line').attr('x1', x(-lim)).attr('y1', y(-lim)).attr('x2', x(lim)).attr('y2', y(lim)).attr('stroke', C['ink-3']).attr('stroke-dasharray', '2 4');
  xAxis(g, x, H - m.b, 5); g.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').style('fill', C.young).style('font-weight', 600).text('young →');
  g.append('g').attr('transform', `translate(${m.l},0)`).call(gg => yAxis(gg, y, 5));
  g.append('text').attr('x', m.l + 6).attr('y', m.t + 10).style('fill', C.older).style('font-weight', 600).text('↑ older');
  const rho = spearman(pts.map(p => p.x), pts.map(p => p.y));
  g.append('text').attr('x', 0).attr('y', 14).style('font-weight', 700).style('fill', C.ink).text(label);
  g.append('text').attr('x', W - m.r).attr('y', 14).attr('text-anchor', 'end').style('font-family', 'var(--f-mono)').text(`Spearman ρ = ${sgn(rho)} · n = ${fmtN(pts.length)}`);
  const colOf = p => p.sx && p.sy ? C.ink : p.sx ? C.young : p.sy ? C.older : C['ink-3'];
  const order = pts.slice().sort((a, b) => (a.sx + a.sy) - (b.sx + b.sy));
  order.forEach(p => { const s = p.sx || p.sy; ctx.globalAlpha = s ? .85 : .25; ctx.fillStyle = colOf(p); ctx.beginPath(); ctx.arc(x(cl(p.x)), y(cl(p.y)), s ? 2.6 : 1.8, 0, 6.283); ctx.fill(); });
  ctx.globalAlpha = 1;
  const P = pts.map(p => [x(cl(p.x)), y(cl(p.y)), p]);
  const del = d3.Delaunay.from(P, p => p[0], p => p[1]);
  const ring = g.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 1.5).style('display', 'none');
  let cur = null;
  svg.on('pointermove', e => { const [mx, my] = d3.pointer(e); const k = del.find(mx, my); const p = P[k];
    if (!p || Math.hypot(p[0] - mx, p[1] - my) > 14) { ring.style('display', 'none'); cur = null; hideTip(); svg.style('cursor', null); return; }
    cur = p[2]; ring.attr('cx', p[0]).attr('cy', p[1]).style('display', null); svg.style('cursor', 'pointer'); showTip(e, cur.tip); })
    .on('pointerleave', () => { ring.style('display', 'none'); hideTip(); }).on('click', () => { if (cur) onClick(cur); });
  const leg = document.createElement('div'); leg.className = 'legend'; leg.style.position = 'absolute'; leg.style.top = (H + 2) + 'px'; leg.style.left = 0;
  el.style.marginBottom = '34px';
  leg.innerHTML = `<span><i style="background:${C.young}"></i>p &lt; 0.05 young</span><span><i style="background:${C.older}"></i>older</span><span><i style="background:${C.ink}"></i>both</span>`;
  if (!canvas) leg.innerHTML = leg.innerHTML.replace(/p &lt; 0.05/, 'FDR &lt; 0.05');
  el.appendChild(leg);
}

/* ================= PATHWAY ================= */
R.pathway = async () => {
  const sug = $('#p-sugg');
  sug.innerHTML = CURATED.map(([grp, ts]) => `<span class="chiplabel">${grp}</span>` + ts.map(t => `<button type="button" class="chip${t === S.path ? ' on' : ''}" data-p="${esc(t)}">${esc(t)}</button>`).join('')).join('');
  sug.onclick = e => { const b = e.target.closest('.chip'); if (b) openPath(b.dataset.p); };
  const gs = await gsea();
  const pid = gs.pid.get(S.path);
  $('#p-name').textContent = S.path;
  const rows = gs.byP.get(pid) || [];
  const byc = new Map(rows.map(r => [r.c, r]));
  const sig = rows.filter(r => r.q < 0.05);
  $('#p-kv').innerHTML = `<span>Tested in <b>${rows.length}</b> comparisons</span><span>FDR &lt; 0.05 in <b>${sig.length}</b> (<span class="up">${sig.filter(r => r.n > 0).length} up</span>, <span class="dn">${sig.filter(r => r.n < 0).length} down</span> after flight)</span>` +
    (rows.length ? `<span>Genes in set: <b>${d3.max(rows, r => r.s)}</b> at most</span>` : '');
  if (S.pcell == null || !byc.has(S.pcell)) { const b = d3.least(rows, r => r.q); S.pcell = b ? b.c : null; }
  // heatmap
  const el = $('#p-heat'), L = matrixLayout(el, 640); L.rows = L.rows.filter(ct => ct !== 'Whole tissue'); L.H = L.top + L.rows.length * L.rh + 6;
  const svg = svgIn(el, L.W, L.H); matrixFrame(svg, L);
  const col = divScale(2.5);
  L.rows.forEach((ct, r) => L.cols.forEach((cc, j) => {
    const id = cid(cc.t, ct, cc.a); const x = L.lw + j * L.cw, y = L.top + r * L.rh;
    if (id == null) return;
    const v = byc.get(id);
    const on = id === S.pcell;
    if (!v) { svg.append('text').attr('x', x + L.cw / 2).attr('y', y + L.rh / 2 + 4).attr('text-anchor', 'middle').style('fill', C['ink-3']).text('·'); return; }
    svg.append('rect').attr('x', x + 2).attr('y', y + 2).attr('width', L.cw - 4).attr('height', L.rh - 4).attr('rx', 2).attr('fill', col(v.n))
      .attr('stroke', on ? C.ink : 'none').attr('stroke-width', 2);
    if (v.q < 0.05) svg.append('text').attr('x', x + L.cw / 2).attr('y', y + L.rh / 2 + 6).attr('text-anchor', 'middle').style('font-weight', 700).style('font-size', '14px').style('fill', inkOn(col(v.n))).text('*');
    svg.append('rect').attr('class', 'hit').attr('x', x).attr('y', y).attr('width', L.cw).attr('height', L.rh)
      .on('pointermove', e => showTip(e, `<b>${esc(compLabel(M.comps[id]))}</b><br><span class="mono">NES ${sgn(v.n)} · FDR ${fmtP(v.q)} · ${v.s} genes</span>`))
      .on('pointerleave', hideTip).on('click', () => { S.pcell = id; R.pathway(); });
  }));
  $('#p-heat-leg').innerHTML = `<span>NES ${MINUS}2.5 <span class="bar8" style="background:${rampCSS(col, 2.5)}"></span> +2.5</span><span><b>*</b> FDR &lt; 0.05</span><span><b>·</b> not available in the exported results</span><span>Click a cell for its leading-edge genes</span>`;
  // leading edge
  const le = await load('gsea_le.jgz.txt');
  const leHost = $('#p-le');
  if (S.pcell == null) { leHost.innerHTML = ''; $('#p-le-title').textContent = 'Leading edge'; }
  else {
    const v = byc.get(S.pcell); const c = M.comps[S.pcell];
    $('#p-le-title').textContent = 'Leading edge · ' + compLabel(c);
    const str = le[S.pcell + '|' + pid];
    $('#p-le-sub').innerHTML = `NES <span class="num ${v.n > 0 ? 'up' : 'dn'}">${sgn(v.n)}</span>, FDR <span class="num">${fmtP(v.q)}</span>. ` + (str ? 'Up to 20 genes driving the score; click one to open it.' : 'Leading-edge genes are stored for FDR &lt; 0.25 only.');
    leHost.innerHTML = str ? str.split(';').map(g => `<button type="button" class="chip gene" data-g="${esc(g)}">${esc(g)}</button>`).join('') : '';
    leHost.onclick = e => { const b = e.target.closest('.chip'); if (b) openGene(b.dataset.g); };
  }
  drawPrograms(gs);
};
function drawPrograms(gs) {
  const el = $('#p-prog');
  const terms = CURATED.flatMap(([grp, ts]) => ts.map(t => ({grp, t, p: gs.pid.get(t)})));
  const comps = M.comps.map((c, i) => i).filter(i => M.comps[i].gsea).filter(i => {
    const rs = gs.byC.get(i) || []; return terms.filter(t => rs.some(r => r.p === t.p && r.q < 0.05)).length >= 2; })
    .sort((a, b) => { const A = M.comps[a], B = M.comps[b]; return M.tissues.indexOf(A.tissue) - M.tissues.indexOf(B.tissue) || linIdx(A.ct) - linIdx(B.ct) || (A.age === 'YNG' ? -1 : 1); });
  const W = Math.max(widthOf(el), 680), lw = 230, top = 130, rh = 22, cw = (W - lw - 70) / terms.length, H = top + comps.length * rh + 6;
  const svg = svgIn(el, W, H); const col = divScale(2.5);
  let gx = lw;
  CURATED.forEach(([grp, ts]) => { svg.append('text').attr('x', gx + 2).attr('y', 14).style('font-weight', 700).style('fill', C.ink).text(grp);
    svg.append('line').attr('x1', gx + 2).attr('x2', gx + ts.length * cw - 4).attr('y1', 20).attr('y2', 20).attr('stroke', C.rule); gx += ts.length * cw; });
  terms.forEach((t, j) => svg.append('text').attr('transform', `translate(${lw + j * cw + cw / 2 + 4},${top - 8}) rotate(-50)`).style('font-size', '10.5px').text(trunc(t.t, 26)).style('cursor', 'pointer').on('click', () => openPath(t.t)));
  comps.forEach((i, r) => {
    const c = M.comps[i], y = top + r * rh;
    svg.append('text').attr('x', lw - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').text(`${c.tissue} · ${trunc(c.ct, 20)} · `).append('tspan').style('fill', c.age === 'YNG' ? C.young : C.older).style('font-weight', 600).text(AGE[c.age]);
    const rs = gs.byC.get(i) || [];
    terms.forEach((t, j) => { const v = rs.find(z => z.p === t.p); const x = lw + j * cw; if (!v) return;
      svg.append('rect').attr('x', x + 2).attr('y', y + 2).attr('width', cw - 4).attr('height', rh - 4).attr('rx', 2).attr('fill', col(v.n));
      if (v.q < 0.05) svg.append('text').attr('x', x + cw / 2).attr('y', y + rh / 2 + 6).attr('text-anchor', 'middle').style('font-weight', 700).style('font-size', '13px').style('fill', inkOn(col(v.n))).text('*');
      svg.append('rect').attr('class', 'hit').attr('x', x).attr('y', y).attr('width', cw).attr('height', rh)
        .on('pointermove', e => showTip(e, `<b>${esc(t.t)}</b><br>${esc(compLabel(c))}<br><span class="mono">NES ${sgn(v.n)} · FDR ${fmtP(v.q)}</span>`))
        .on('pointerleave', hideTip).on('click', () => openPath(t.t, i)); });
  });
}

/* ================= COMPOSITION ================= */
R.composition = () => {
  const t = S.cT;
  seg($('#c-tis'), M.tissues.map(x => [x, x]), t, v => { S.cT = v; R.composition(); });
  $('#c-title').textContent = 'Proportions per mouse · ' + TNAME[t];
  const pm = M.compPerMouse.filter(r => r[0] === t);
  const tot = new Map(); pm.forEach(r => tot.set(r[1], r[4]));
  const mice = [...tot.keys()];
  const cts = [...new Set(pm.map(r => r[2]))];
  const tests = M.compTests.filter(r => r.tissue === t);
  const items = cts.map(ct => {
    const pts = mice.map(m => { const r = pm.find(z => z[1] === m && z[2] === ct); return {m, v: (r ? r[3] / r[4] : 0) * 100, n: r ? r[3] : 0, grp: (m[1] === 'Y' ? 'YNG' : 'OLD') + '_' + (m[0] === 'F' ? 'FLT' : 'GC')}; });
    const ts = {}; AGES.forEach(a => ts[a] = tests.find(z => z.ct === ct && z.age === a));
    const minp = d3.min(AGES, a => ts[a] ? ts[a].p : 1);
    return {ct, pts, ts, minp};
  }).sort((a, b) => a.minp - b.minp);
  const host = $('#c-grid'); host.innerHTML = '';
  items.forEach(it => {
    const d = document.createElement('div'); d.className = 'mini';
    d.innerHTML = `<h5><span style="color:${ctColor(it.ct)}">●</span> ${esc(it.ct)}</h5>`;
    const ch = document.createElement('div'); ch.className = 'chart'; d.appendChild(ch);
    const f = document.createElement('div'); f.className = 'm';
    f.innerHTML = AGES.map(a => { const z = it.ts[a]; return `<div><span style="color:${a === 'YNG' ? 'var(--young)' : 'var(--older)'}">${AGE[a]}</span> ${z ? `${sgn(z.lfc)} · p ${fmtP(z.p)} · FDR ${fmtP(z.fdr)}` : 'not tested'}</div>`; }).join('');
    d.appendChild(f); host.appendChild(d);
    miniDots(ch, it.pts);
  });
};
function miniDots(el, pts) {
  const W = Math.max(180, widthOf(el)), H = 120, m = {l: 30, r: 4, t: 8, b: 18};
  const svg = svgIn(el, W, H);
  const grps = ['YNG_GC', 'YNG_FLT', 'OLD_GC', 'OLD_FLT'];
  const x = d3.scaleBand().domain(grps).range([m.l, W - m.r]).paddingInner(.2);
  const y = d3.scaleLinear().domain([0, d3.max(pts, p => p.v) * 1.1 || 1]).range([H - m.b, m.t]).nice(3);
  svg.append('g').attr('class', 'grid').selectAll('line').data(y.ticks(3)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
  svg.append('g').attr('class', 'ax').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(3).tickSize(0).tickFormat(d => d + '%')).call(g => g.select('.domain').remove());
  AGES.forEach((a, k) => svg.append('text').attr('x', (x(grps[2 * k]) + x(grps[2 * k + 1]) + x.bandwidth()) / 2).attr('y', H - 4).attr('text-anchor', 'middle').style('font-size', '10px').style('fill', a === 'YNG' ? C.young : C.older).text(AGE[a]));
  svg.append('line').attr('x1', (x(grps[1]) + x.bandwidth() + x(grps[2])) / 2).attr('x2', (x(grps[1]) + x.bandwidth() + x(grps[2])) / 2).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', C['rule-2']);
  grps.forEach(gr => {
    const ps = pts.filter(p => p.grp === gr); if (!ps.length) return; const cx = x(gr) + x.bandwidth() / 2; const col = gr.endsWith('FLT') ? C.flight : C.ground;
    const mu = d3.mean(ps, p => p.v);
    svg.append('line').attr('x1', cx - x.bandwidth() * .38).attr('x2', cx + x.bandwidth() * .38).attr('y1', y(mu)).attr('y2', y(mu)).attr('stroke', col).attr('stroke-width', 2);
    ps.forEach((p, i) => { const jx = cx + (i - (ps.length - 1) / 2) * Math.min(6, x.bandwidth() / (ps.length + 1));
      svg.append('circle').attr('cx', jx).attr('cy', y(p.v)).attr('r', 3.2).attr('fill', col).attr('fill-opacity', .85).attr('stroke', C.panel).attr('stroke-width', 1);
      svg.append('circle').attr('class', 'hit').attr('cx', jx).attr('cy', y(p.v)).attr('r', 7)
        .on('pointermove', e => showTip(e, `<b class="mono">${p.m}</b><br><span class="mono">${p.v.toFixed(2)}% · ${fmtN(p.n)} cells</span>`)).on('pointerleave', hideTip); });
  });
}

/* ================= COMMUNICATION ================= */
R.communication = async () => {
  lianaSummary($('#m-sum'), true);
  seg($('#m-tis'), M.tissues.map(x => [x, x]), S.mT, v => { S.mT = v; R.communication(); });
  seg($('#m-age'), AGES.map(a => [a, AGE[a][0].toUpperCase() + AGE[a].slice(1)]), S.mA, v => { S.mA = v; R.communication(); });
  seg($('#m-st'), [['all', 'All'], ['G', 'Gained'], ['L', 'Lost'], ['S', 'Shared']], S.mSt, v => { S.mSt = v; S.mN = 40; R.communication(); });
  const q = $('#m-q'); q.value = S.mQ; q.oninput = () => { S.mQ = q.value; S.mN = 40; drawLianaTable(); };
  const L = await load('liana.jgz.txt'); if (S.view !== 'communication') return;
  // heatmap
  const sr = L.sr.filter(r => r[0] === S.mT && r[1] === S.mA);
  const cts = [...new Set(sr.flatMap(r => [r[2], r[3]]))].sort((a, b) => linIdx(a) - linIdx(b));
  const el = $('#m-heat');
  const lw = 150, top = 110, cs = Math.max(20, Math.min(34, (widthOf(el) - lw - 60) / cts.length));
  const W = lw + cts.length * cs + 60, H = top + cts.length * cs + 4;
  const svg = svgIn(el, W, H);
  const mx = d3.max(sr, r => Math.abs(r[4] - r[5])) || 1; const col = divScale(mx);
  svg.append('text').attr('x', lw - 8).attr('y', top - 8).attr('text-anchor', 'end').style('fill', C['ink-3']).text('sender ↓  receiver →');
  cts.forEach((ct, i) => {
    svg.append('text').attr('x', lw - 8).attr('y', top + i * cs + cs / 2 + 4).attr('text-anchor', 'end').text(trunc(ct, 22));
    svg.append('text').attr('transform', `translate(${lw + i * cs + cs / 2 + 3},${top - 8}) rotate(-55)`).text(trunc(ct, 18));
  });
  const idx = new Map(cts.map((c, i) => [c, i]));
  for (let i = 0; i < cts.length; i++) for (let j = 0; j < cts.length; j++) svg.append('rect').attr('x', lw + j * cs + 1).attr('y', top + i * cs + 1).attr('width', cs - 2).attr('height', cs - 2).attr('fill', C.sunk);
  sr.forEach(r => { const i = idx.get(r[2]), j = idx.get(r[3]), net = r[4] - r[5];
    const x = lw + j * cs, y = top + i * cs;
    svg.append('rect').attr('x', x + 1).attr('y', y + 1).attr('width', cs - 2).attr('height', cs - 2).attr('rx', 1.5).attr('fill', col(net));
    if (cs >= 24 && net) svg.append('text').attr('x', x + cs / 2).attr('y', y + cs / 2 + 4).attr('text-anchor', 'middle').style('font-family', 'var(--f-mono)').style('font-size', '9.5px').style('fill', inkOn(col(net))).text((net > 0 ? '+' : MINUS) + Math.abs(net));
    svg.append('rect').attr('class', 'hit').attr('x', x).attr('y', y).attr('width', cs).attr('height', cs)
      .on('pointermove', e => showTip(e, `<b>${esc(r[2])} → ${esc(r[3])}</b><br><span class="mono">${r[4]} gained · ${r[5]} lost · net ${(net > 0 ? '+' : net < 0 ? MINUS : '') + Math.abs(net)}</span>`))
      .on('pointerleave', hideTip).on('click', () => { S.mQ = r[2]; S.mN = 40; $('#m-q').value = r[2]; drawLianaTable(); $('#m-table').scrollIntoView({behavior: 'smooth', block: 'start'}); });
  });
  $('#m-heat-leg').innerHTML = `<span>net lost ${mx} <span class="bar8" style="background:${rampCSS(col, mx)}"></span> net gained ${mx}</span>`;
  // ligands
  const lg = L.lig.filter(r => r[0] === S.mT && r[1] === S.mA).map(r => ({l: r[2], g: r[3], o: r[4], n: r[3] - r[4]}))
    .sort((a, b) => Math.abs(b.n) - Math.abs(a.n) || (b.g + b.o) - (a.g + a.o)).slice(0, 14).sort((a, b) => b.n - a.n);
  const el2 = $('#m-lig'); const W2 = Math.max(260, widthOf(el2)), rh = 22, H2 = lg.length * rh + 30, lw2 = 80;
  const s2 = svgIn(el2, W2, H2); const xm = d3.max(lg, d => Math.abs(d.n)) || 1;
  const x = d3.scaleLinear().domain([-xm, xm]).range([lw2 + 30, W2 - 30]).nice();
  xAxis(s2.append('g'), x, lg.length * rh, 4);
  lg.forEach((d, i) => { const y = i * rh;
    s2.append('text').attr('x', lw2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('font-style', 'italic').style('fill', C.ink).text(d.l);
    s2.append('rect').attr('x', Math.min(x(0), x(d.n))).attr('y', y + 5).attr('width', Math.abs(x(d.n) - x(0))).attr('height', rh - 10).attr('rx', 2).attr('fill', d.n > 0 ? C.flight : C.ground);
    s2.append('text').attr('x', x(d.n) + (d.n >= 0 ? 4 : -4)).attr('y', y + rh / 2 + 4).attr('text-anchor', d.n >= 0 ? 'start' : 'end').style('font-family', 'var(--f-mono)').text((d.n > 0 ? '+' : d.n < 0 ? MINUS : '') + Math.abs(d.n));
    s2.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W2).attr('height', rh)
      .on('pointermove', e => showTip(e, `<b class="gene">${esc(d.l)}</b><br><span class="mono">${d.g} gained · ${d.o} lost</span>`)).on('pointerleave', hideTip)
      .on('click', () => { S.mQ = d.l; S.mN = 40; $('#m-q').value = d.l; drawLianaTable(); });
  });
  s2.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', lg.length * rh);
  drawLianaTable();
};
async function drawLianaTable() {
  const L = await load('liana.jgz.txt');
  const q = S.mQ.trim().toLowerCase();
  const so = {G: 0, L: 1, S: 2};
  const rows = L.rows.filter(r => r[0] === S.mT && r[1] === S.mA && (S.mSt === 'all' || r[8] === S.mSt) &&
    (!q || r[2].toLowerCase().includes(q) || r[3].toLowerCase().includes(q) || r[4].toLowerCase().includes(q) || r[5].toLowerCase().includes(q)))
    .sort((a, b) => so[a[8]] - so[b[8]] || Math.max(b[6] || 0, b[7] || 0) - Math.max(a[6] || 0, a[7] || 0));
  const lab = {G: 'Gained', L: 'Lost', S: 'Shared'};
  const f = v => v == null ? '<span style="color:var(--ink-3)">—</span>' : v.toFixed(2);
  $('#m-table').innerHTML = rows.length ? '<table class="t"><thead><tr><th>Sender → receiver</th><th>Ligand → receptor</th><th class="r">Mean, ground</th><th class="r">Mean, flight</th><th>Status</th></tr></thead><tbody>' +
    rows.slice(0, S.mN).map(r => `<tr><td>${esc(r[2])} → ${esc(r[3])}</td><td><span class="gene">${esc(r[4])}</span> → <span class="gene">${esc(r[5])}</span></td><td class="r num">${f(r[6])}</td><td class="r num">${f(r[7])}</td><td><span class="pill ${r[8]}">${lab[r[8]]}</span></td></tr>`).join('') +
    '</tbody></table>' + `<p class="note">${rows.length > S.mN ? `Showing ${fmtN(S.mN)} of ${fmtN(rows.length)} interactions. <button type="button" class="lnk" id="m-more">Show 40 more</button>` : `${fmtN(rows.length)} interactions.`} Mean is the average of ligand and receptor expression in sender and receiver.</p>`
    : '<p class="empty">No interactions match.</p>';
  const mb = $('#m-more'); if (mb) mb.onclick = () => { S.mN += 40; drawLianaTable(); };
}

/* ================= PRE-B ================= */
R.preb = async () => {
  const pre = await load('preb.jgz.txt'); if (S.view !== 'preb') return;
  const host = $('#b-maps'); host.innerHTML = '';
  const u = pre.umap;
  const ccHi = d3.quantile(u.ccs.slice().sort(d3.ascending), .99);
  const panels = [
    {title: 'Cell-cycle score', sub: 'max of S and G2/M, smoothed', x: u.x, y: u.y, v: u.ccs, sc: seqScale(d3.min(u.ccs), ccHi), leg: [`${d3.min(u.ccs).toFixed(2).replace('-', MINUS)}`, `${ccHi.toFixed(2)}`], ramp: seqScale(0, 1), seq: true},
    {title: 'Aging, ground mice', sub: 'older vs young', ...pre.maps['Aging (ground)'], sc: ageScale(2.5), leg: ['young-enriched', 'older-enriched'], ramp: ageScale(1)},
    {title: 'Flight, young mice', sub: 'flight vs ground', ...pre.maps['Flight (young)'], sc: divScale(2.5), leg: ['ground-enriched', 'flight-enriched'], ramp: divScale(1)},
    {title: 'Flight, older mice', sub: 'flight vs ground', ...pre.maps['Flight (older)'], sc: divScale(2.5), leg: ['ground-enriched', 'flight-enriched'], ramp: divScale(1)}];
  const xd = d3.extent(u.x), yd = d3.extent(u.y);
  panels.forEach(p => {
    const d = document.createElement('div'); host.appendChild(d);
    d.innerHTML = `<h5>${esc(p.title)} <span style="font-weight:400;color:var(--ink-3)">· ${esc(p.sub)}</span></h5>`;
    const ch = document.createElement('div'); d.appendChild(ch);
    const W = Math.max(180, widthOf(d)), H = W;
    const {cv, ctx} = canvasIn(ch, W, H); ch.appendChild(cv);
    const x = d3.scaleLinear().domain(xd).range([6, W - 6]), y = d3.scaleLinear().domain(yd).range([H - 6, 6]);
    const v = p.v || [];
    const ord = d3.range(p.x.length).sort((a, b) => (p.seq ? v[a] - v[b] : Math.abs(v[a]) - Math.abs(v[b])));
    ctx.fillStyle = C['rule-2'];
    for (let i = 0; i < u.x.length; i++) { ctx.beginPath(); ctx.arc(x(u.x[i]), y(u.y[i]), 1.6, 0, 6.283); ctx.fill(); }
    ord.forEach(i => { ctx.fillStyle = p.sc(v[i]); ctx.beginPath(); ctx.arc(x(p.x[i]), y(p.y[i]), 2, 0, 6.283); ctx.fill(); });
    const lg = document.createElement('div'); lg.className = 'legend';
    lg.innerHTML = `<span>${esc(p.leg[0])}<span class="bar8" style="width:56px;background:linear-gradient(90deg,${d3.range(0, 1.01, .125).map(t => p.seq ? p.ramp(t) : p.ramp(-1 + 2 * t)).join(',')})"></span>${esc(p.leg[1])}</span>`;
    d.appendChild(lg);
  });
  const mitT = pre.mitT;
  dotGroups($('#b-mit'), pre.mit.map(r => ({m: r[0], v: r[4], n: r[3], grp: r[1] + '_' + r[2]})),
    {ylab: '% of pre-B cells', fmt: v => v.toFixed(1), unit: '%', zero: true, yfmt: d => d + '%', tipExtra: p => `${fmtN(p.n)} pre-B cells`,
      stats: a => { const r = mitT.find(z => z[1] === a); return r ? `${r[2].toFixed(1)}% → ${r[3].toFixed(1)}% · p ${fmtP(r[4])}` : ''; }});
  seg($('#b-cyc-tis'), [['Femur', 'Femur'], ['Humerus', 'Humerus']], S.cycT, v => { S.cycT = v; R.preb(); });
  dotGroups($('#b-cyc'), pre.cyc.filter(r => r[0] === S.cycT).map(r => ({m: r[1], v: r[5] * 100, n: r[4], grp: r[2] + '_' + r[3]})),
    {ylab: '% cycling', fmt: v => v.toFixed(1), unit: '%', zero: true, yfmt: d => d + '%', tipExtra: p => `${fmtN(p.n)} pre-B cells`,
      stats: a => { const r = pre.cycT.find(z => z[0] === S.cycT && z[1] === a); return r ? `${(r[2] * 100).toFixed(0)}% → ${(r[3] * 100).toFixed(0)}% · p ${fmtP(r[4])}` : ''; }});
  splitCard($('#b-split'), pre);
  // NES heat
  const gs = await gsea(); const el = $('#b-nes');
  const cols = []; M.tissues.forEach(t => AGES.forEach(a => { const id = cid(t, 'Pre-B cells', a); if (id != null && M.comps[id].gsea) cols.push({t, a, id}); }));
  const W = Math.max(widthOf(el), 520), lw = 200, top = 42, rh = 28, cw = (W - lw - 4) / cols.length, H = top + PB_TERMS.length * rh + 4;
  const svg = svgIn(el, W, H); const col = divScale(3);
  const tset = [...new Set(cols.map(c => c.t))];
  tset.forEach(t => { const cs = cols.map((c, i) => [c, i]).filter(z => z[0].t === t); const x0 = lw + cs[0][1] * cw, x1 = lw + (cs[cs.length - 1][1] + 1) * cw;
    svg.append('text').attr('x', (x0 + x1) / 2).attr('y', 14).attr('text-anchor', 'middle').style('font-weight', 700).style('fill', C.ink).text(t);
    if (x0 > lw) svg.append('line').attr('x1', x0).attr('x2', x0).attr('y1', 4).attr('y2', H).attr('stroke', C.rule); });
  cols.forEach((c, j) => svg.append('text').attr('x', lw + (j + .5) * cw).attr('y', 32).attr('text-anchor', 'middle').style('fill', c.a === 'YNG' ? C.young : C.older).style('font-weight', 600).text(AGE[c.a]));
  PB_TERMS.forEach((term, r) => {
    const pid = gs.pid.get(term), y = top + r * rh;
    svg.append('text').attr('x', lw - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').text(trunc(term, 32)).style('cursor', 'pointer').on('click', () => openPath(term));
    cols.forEach((c, j) => { const v = (gs.byC.get(c.id) || []).find(z => z.p === pid); const x = lw + j * cw; if (!v) return;
      svg.append('rect').attr('x', x + 2).attr('y', y + 2).attr('width', cw - 4).attr('height', rh - 4).attr('rx', 2).attr('fill', col(v.n));
      svg.append('text').attr('x', x + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').style('font-family', 'var(--f-mono)').style('font-size', '10.5px').style('fill', inkOn(col(v.n)))
        .text(sgn(v.n, 1) + (v.q < 0.05 ? '*' : ''));
      svg.append('rect').attr('class', 'hit').attr('x', x).attr('y', y).attr('width', cw).attr('height', rh)
        .on('pointermove', e => showTip(e, `<b>${esc(term)}</b><br>${esc(c.t)} pre-B · ${AGE[c.a]}<br><span class="mono">NES ${sgn(v.n)} · FDR ${fmtP(v.q)}</span>`))
        .on('pointerleave', hideTip).on('click', () => openPath(term, c.id)); });
  });
};


/* ================= INSIGHTS ================= */
function insCard(host, o) {
  const p = document.createElement('div'); p.className = 'panel'; host.appendChild(p);
  p.innerHTML = `<div class="ins"><div><div class="tags"><span class="tag num">${o.no}</span>${o.tags.map(t => `<span class="tag ${t[0]}">${t[1]}</span>`).join('')}</div>
    <h3>${o.title}</h3>${o.body.map(x => `<p>${x}</p>`).join('')}<div class="next"><span>${o.nextLabel || 'Next step'}</span>${o.next}</div>
    ${o.links ? `<div class="chips" style="margin-top:10px">${o.links.map((l, i) => `<button type="button" class="chip" data-i="${i}">${l[0]} →</button>`).join('')}</div>` : ''}</div>
    <div class="ins-chart"></div></div>`;
  if (o.links) p.querySelectorAll('.chips .chip').forEach(b => b.onclick = () => o.links[+b.dataset.i][1]());
  const ch = p.querySelector('.ins-chart'); o.chart(ch);
}
const ageLab = a => `<span style="color:${a === 'YNG' ? 'var(--young)' : 'var(--older)'}">${AGE[a]}</span>`;
R.insights = async () => {
  const I = await load('insights.json'); if (S.view !== 'insights') return;
  const host = $('#ins-list'); host.innerHTML = '';
  insCard(host, {no:'01', tags:[['','Transcriptional evidence'],['','Paired marrow sites']],
    title:'Platelet-associated programs are enriched in marrow megakaryocytes',
    body:['Platelet activation is positively enriched in both bones and both ages: NES +1.80 to +3.17, with FDR < 0.05 in all four comparisons.',
      'Whole-tissue results include Gp1ba and Clec1b in young femur and Vwf and Tubb1 in young humerus at FDR < 0.05. Whole-tissue signals may combine cellular representation and expression changes.',
      'This does not demonstrate platelet activation, increased platelet counts or thrombosis. Maturation state is an alternative explanation.'],
    next:'Validate cell states and platelet function; preserve mouse-level replication.',
    links:[['Platelet activation',()=>openPath('platelet activation')],['Gp1ba',()=>openGene('Gp1ba')]],chart:el=>mkHeat(el,I)});
  insCard(host, {no:'02',tags:[['','Transcriptional evidence'],['','Niche hypothesis']],
    title:'Older femoral stroma shows bone and matrix-associated programs',
    body:['In the mixed stromal/adipocyte population of older femur, bone development, ossification, collagen organization and extracellular-matrix assembly are positively enriched. All six selected terms remain significant in the all-gene sensitivity analysis.',
      'This comparison has 3 ground and 4 flight animals. The young comparison has far fewer tested genes (583 vs 3,716); different detection does not establish an age interaction.',
      'These overlapping terms suggest remodeling of stromal states. They do not demonstrate increased bone formation, recovery of bone mass or osteoporosis.'],
    next:'Resolve stromal subtypes, assess individual animals and integrate skeletal measurements.',
    links:[['Ossification',()=>openPath('ossification')],['Older femoral stroma',()=>openComp('Femur','Stromal/Adipocytes','OLD')]],
    chart:el=>{el.innerHTML='<div class="tw"><table class="t"><thead><tr><th>GO program</th><th>NES</th><th>FDR</th></tr></thead><tbody>'+[
      ['Bone development','+2.30','0.000160'],['Ossification','+2.06','0.000160'],['Collagen fibril organization','+2.27','0.00356'],['Extracellular matrix assembly','+2.20','0.0108'],['Osteoblast differentiation','+1.83','0.0341'],['Canonical Wnt signaling','+1.71','0.0421']].map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="note">Positive NES is enrichment of transcriptional programs, not a direct measurement of pathway activity.</p>';}});
  insCard(host,{no:'03',tags:[['','Exploratory hypothesis']],title:'Erythroid expression patterns differ between age groups in marrow',
    body:['The ten selected erythroid genes have mean whole-tissue log2FC +1.35 in young femur and +1.48 in young humerus, versus −0.41 and −0.71 in the older cohort.',
      'None of these erythroid genes reaches FDR < 0.05 in these four comparisons. The post hoc means do not separate cellular representation, maturation, ambient RNA and expression within cells.',
      'The pattern is not universal: these genes rise in older PBMCs. It does not demonstrate anemia recovery in young animals or failed recovery in older animals.'],
    next:'Test within the erythroid lineage and evaluate a condition-by-age interaction; seek hematocrit or reticulocyte measurements.',
    links:[['Alas2',()=>openGene('Alas2')]],chart:el=>setDumbbells(el,I)});
  insCard(host,{no:'04',tags:[['','Study design']],title:'Femur and humerus are paired anatomical comparisons',
    body:['The two bones come from the same animals. Concordance supports consistency across marrow sites but does not increase the number of independent biological replicates.',
      'Different responses can reflect regional biology, cell-state mixtures or sampling. Discordance alone does not establish that a result is noise.'],
    next:'Use paired or animal-aware analyses for joint inference across sites.',chart:el=>bonesDot(el,I)});
  insCard(host,{no:'05',tags:[['','Mechanistic hypothesis']],title:'CXCL12–CXCR4 is a candidate niche connection',
    body:['Cxcr4 log2FC is negative in all eight pre-B comparisons, but none reaches gene-level FDR < 0.05.',
      'Young femur has 34 ground-only and 6 flight-only Cxcl12 interactions in LIANA. Detection status depends on sampling and is not a test of differential signaling.',
      'These patterns motivate a niche hypothesis; they do not establish signaling loss or locate the cause of the pre-B response in stromal cells.'],
    next:'Examine stromal states and ligand/receptor proteins alongside proliferation assays.',links:[['Cxcr4',()=>openGene('Cxcr4')]],chart:el=>cxcr4Strip(el,I)});
  insCard(host,{no:'06',tags:[['','Descriptive pattern']],title:'Several genes share directions across cellular contexts',
    body:['MHC-associated genes and Klf2 often have negative fold changes, while some mitochondrial transcripts have positive fold changes. Nuclear oxidative-phosphorylation terms are negative in 16 of 21 significant comparisons.',
      'Comparisons share animals and genes are correlated. Direction counts are descriptive; independent sign tests or combined z-scores are not valid evidence here. Mitochondrial patterns also require assessment of quality-control and normalization effects.'],
    next:'Use an animal-aware analysis and assess technical sensitivity before mechanistic interpretation.',links:[['B2m',()=>openGene('B2m')]],chart:el=>recurBars(el,I)});
  insCard(host,{no:'07',tags:[['chk','Technical hypothesis']],title:'Granulocyte-associated RNA warrants a contamination check',
    body:[`Granule-associated transcripts are lower after flight in ${I.ambTest.down} of ${I.ambTest.n} selected non-granulocyte comparisons.`,
      'Ambient RNA is one explanation, alongside doublets, annotation uncertainty and shared cellular programs. These tables alone do not diagnose contamination or establish that immune-response enrichment is artifactual.'],
    next:'Assess contamination per sample using appropriate input data, and check whether pathway results persist.',chart:el=>ambStrip(el,I)});
  insCard(host,{no:'08',tags:[['chk','Sampling sensitivity']],title:'The mitotic-cluster fraction is sensitive to individual mice',
    body:['Young femoral pre-B mitotic-cluster means are 22.25% in ground controls and 7.73% after flight (p = 0.218). One control has 49.23%; two flight animals have only 16 and 32 pre-B cells.',
      'Cell-cycle GSEA is negative in young femur and humerus and older femur. Older humerus is not significant (mitotic nuclear division FDR 0.96). Transcriptomic enrichment does not directly measure cell division.'],
    next:'Inspect all mouse-level values and cell counts; validate proliferation experimentally.',chart:el=>mitDots(el,I)});
};

function setDumbbells(el, I) {
  el.innerHTML = '<div class="split2"><div><p class="minihead">Erythroid genes</p><div class="chart" data-k="Erythroid genes"></div></div><div><p class="minihead">Megakaryocyte / platelet genes</p><div class="chart" data-k="Megakaryocyte / platelet genes"></div></div></div><div class="legend"><span><i style="background:var(--young)"></i>Young</span><span><i style="background:var(--older)"></i>Older</span><span>mean whole-tissue log2FC of 10 genes, flight vs ground; right: genes up, young · older</span></div>';
  el.querySelectorAll('.chart').forEach(c => {
    const k = c.dataset.k, W = Math.max(220, widthOf(c)), rh = 34, lw = 64, H = 4 * rh + 26;
    const svg = svgIn(c, W, H), x = d3.scaleLinear().domain([-1, 2.5]).range([lw, W - 64]);
    svg.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(4)).join('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', 4 * rh);
    svg.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', 4 * rh);
    xAxis(svg.append('g'), x, 4 * rh, 4);
    M.tissues.forEach((t, i) => {
      const y = i * rh + rh / 2, a = I.sets.find(s => s.set === k && s.tissue === t && s.age === 'YNG'), o = I.sets.find(s => s.set === k && s.tissue === t && s.age === 'OLD');
      svg.append('text').attr('x', 0).attr('y', y + 4).style('fill', C.ink).text(t);
      svg.append('line').attr('x1', x(a.mean)).attr('x2', x(o.mean)).attr('y1', y).attr('y2', y).attr('stroke', C.rule).attr('stroke-width', 3);
      [[o, C.older], [a, C.young]].forEach(([d, col]) => {
        svg.append('circle').attr('cx', x(d.mean)).attr('cy', y).attr('r', 6).attr('fill', col).attr('stroke', C.panel).attr('stroke-width', 1.5);
        svg.append('circle').attr('class', 'hit').attr('cx', x(d.mean)).attr('cy', y).attr('r', 12)
          .on('pointermove', e => showTip(e, `<b>${t} · ${AGE[d.age]}</b><br>${d.up} of ${d.n} genes up<br><span class="mono">${d.genes.map(g => `${g[0]} ${sgn(g[1], 1)}`).join(', ')}</span>`)).on('pointerleave', hideTip);
      });
      svg.append('text').attr('x', W).attr('y', y + 4).attr('text-anchor', 'end').style('font-family', 'var(--f-mono)').style('font-size', '10px').style('fill', C['ink-3']).text(`${a.up}/${a.n} · ${o.up}/${o.n}`);
    });
  });
}
function mkHeat(el, I) {
  const cols = [['Femur', 'YNG'], ['Femur', 'OLD'], ['Humerus', 'YNG'], ['Humerus', 'OLD']];
  const terms = [...new Set(I.mkTerms.map(t => t.term))];
  const genes = [...new Set(I.mkGenes.map(g => g.gene))];
  const W = Math.max(300, widthOf(el)), lw = Math.min(210, W * .42), cw = (W - lw) / 4, rh = 24, top = 36, short = cw < 72;
  const H = top + (terms.length + genes.length) * rh + 30;
  const svg = svgIn(el, W, H), cN = divScale(3), cG = divScale(3);
  cols.forEach(([t, a], j) => { svg.append('text').attr('x', lw + j * cw + cw / 2).attr('y', 12).attr('text-anchor', 'middle').style('font-weight', 700).style('fill', C.ink).text(short ? t.slice(0, 3) : t);
    svg.append('text').attr('x', lw + j * cw + cw / 2).attr('y', 27).attr('text-anchor', 'middle').style('fill', a === 'YNG' ? C.young : C.older).style('font-weight', 600).text(AGE[a]); });
  const row = (label, y, italic) => svg.append('text').attr('x', lw - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('font-style', italic ? 'italic' : null).text(trunc(label, Math.floor(lw / 7)));
  terms.forEach((term, i) => { const y = top + i * rh; row(term, y);
    cols.forEach(([t, a], j) => { const v = I.mkTerms.find(z => z.term === term && z.tissue === t && z.age === a); if (!v) return; const x = lw + j * cw;
      svg.append('rect').attr('x', x + 2).attr('y', y + 2).attr('width', cw - 4).attr('height', rh - 4).attr('rx', 2).attr('fill', cN(v.nes));
      svg.append('text').attr('x', x + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').style('font-family', 'var(--f-mono)').style('font-size', '10.5px').style('fill', inkOn(cN(v.nes))).text(sgn(v.nes, 1) + (v.q < 0.05 ? '*' : ''));
      svg.append('rect').attr('class', 'hit').attr('x', x).attr('y', y).attr('width', cw).attr('height', rh).on('pointermove', e => showTip(e, `<b>${esc(term)}</b><br>${t} megakaryocytes · ${AGE[a]}<br><span class="mono">NES ${sgn(v.nes)} · FDR ${fmtP(v.q)}</span>`)).on('pointerleave', hideTip); }); });
  const g0 = top + terms.length * rh + 8;
  svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', g0 - 4).attr('y2', g0 - 4).attr('stroke', C.rule);
  genes.forEach((gn, i) => { const y = g0 + i * rh; row(gn, y, true);
    cols.forEach(([t, a], j) => { const v = I.mkGenes.find(z => z.gene === gn && z.tissue === t && z.age === a); const x = lw + j * cw; if (!v) return;
      svg.append('rect').attr('x', x + 2).attr('y', y + 2).attr('width', cw - 4).attr('height', rh - 4).attr('rx', 2).attr('fill', cG(v.lfc));
      svg.append('text').attr('x', x + cw / 2).attr('y', y + rh / 2 + 4).attr('text-anchor', 'middle').style('font-family', 'var(--f-mono)').style('font-size', '10.5px').style('fill', inkOn(cG(v.lfc))).text(sgn(v.lfc, 1) + (v.p < 0.05 ? '•' : ''));
      svg.append('rect').attr('class', 'hit').attr('x', x).attr('y', y).attr('width', cw).attr('height', rh).style('cursor', 'pointer').on('pointermove', e => showTip(e, `<b class="gene">${gn}</b> · ${t} megakaryocytes · ${AGE[a]}<br><span class="mono">log2FC ${sgn(v.lfc)} · p ${fmtP(v.p)}</span>`)).on('pointerleave', hideTip).on('click', () => openGene(gn)); }); });
  svg.append('text').attr('x', 0).attr('y', H - 6).style('fill', C['ink-3']).text('Top: GO NES (* FDR < 0.05). Bottom: gene log2FC (• p < 0.05).');
}
function bonesDot(el, I) {
  const rows = I.bones.slice().sort((a, b) => b.rg - a.rg);
  const W = Math.max(300, widthOf(el)), rh = 20, lw = Math.min(200, W * .45), H = rows.length * rh + 52;
  const svg = svgIn(el, W, H), x = d3.scaleLinear().domain([-0.3, 0.7]).range([lw + 6, W - 10]);
  svg.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(5)).join('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', rows.length * rh);
  svg.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', rows.length * rh);
  xAxis(svg.append('g'), x, rows.length * rh, 5);
  svg.append('text').attr('x', W - 10).attr('y', rows.length * rh + 32).attr('text-anchor', 'end').text('Spearman ρ, femur vs humerus');
  rows.forEach((r, i) => { const y = i * rh + rh / 2, hi = /Pre-B|Megak/.test(r.ct);
    const t = svg.append('text').attr('x', lw - 6).attr('y', y + 4).attr('text-anchor', 'end').style('fill', hi ? C.ink : C['ink-2']).style('font-weight', hi ? 700 : 400).text(trunc(r.ct, Math.max(10, Math.floor(lw / 6.4) - 8)) + ' · ');
    t.append('tspan').style('fill', r.age === 'YNG' ? C.young : C.older).text(AGE[r.age]);
    if (r.rp != null) svg.append('rect').attr('x', x(r.rp) - 4).attr('y', y - 4).attr('width', 8).attr('height', 8).attr('transform', `rotate(45 ${x(r.rp)} ${y})`).attr('fill', C.panel).attr('stroke', C['ink-2']).attr('stroke-width', 1.5);
    svg.append('circle').attr('cx', x(r.rg)).attr('cy', y).attr('r', 4.5).attr('fill', C.ink);
    svg.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y - rh / 2).attr('width', W).attr('height', rh).on('pointermove', e => showTip(e, `<b>${esc(r.ct)} · ${AGE[r.age]}</b><br><span class="mono">genes ρ ${sgn(r.rg)} (n ${fmtN(r.n)})<br>GO NES ρ ${r.rp == null ? 'NA' : sgn(r.rp)}<br>terms FDR in both: ${r.both}, same sign ${r.same}</span>`)).on('pointerleave', hideTip);
  });
  const lg = document.createElement('div'); lg.className = 'legend';
  lg.innerHTML = `<span><i style="background:${C.ink}"></i>genes (Wald statistic)</span><span><svg width="12" height="12" style="vertical-align:-2px;margin-right:5px"><rect x="3" y="3" width="6" height="6" transform="rotate(45 6 6)" fill="none" stroke="${C['ink-2']}" stroke-width="1.5"/></svg>GO terms (NES)</span>`;
  el.appendChild(lg);
}
function cxcr4Strip(el, I) {
  const groups = ['Pro-B cells', 'Pre-B cells', 'Mature B cells'];
  const W = Math.max(300, widthOf(el)), rh = 56, lw = 104, H = groups.length * rh + 40;
  const svg = svgIn(el, W, H), x = d3.scaleLinear().domain([-1.8, 0.8]).range([lw, W - 10]);
  svg.append('text').attr('x', 0).attr('y', 12).style('font-weight', 700).style('fill', C.ink).text('Cxcr4 log2FC in B-lineage cells').style('font-style', 'normal');
  const top = 22;
  svg.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(5)).join('line').attr('x1', x).attr('x2', x).attr('y1', top).attr('y2', top + groups.length * rh);
  svg.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top).attr('y2', top + groups.length * rh);
  xAxis(svg.append('g'), x, top + groups.length * rh, 5);
  groups.forEach((gname, i) => { const y0 = top + i * rh;
    svg.append('text').attr('x', 0).attr('y', y0 + rh / 2 + 4).style('fill', C.ink).text(gname);
    const pts = I.cxcr4.filter(c => c.ct === gname);
    pts.forEach((c, k) => { const y = y0 + 10 + (k % 4) * ((rh - 20) / 3), cxp = x(Math.max(-1.8, Math.min(0.8, c.lfc)));
      svg.append('circle').attr('cx', cxp).attr('cy', y).attr('r', 5).attr('fill', c.age === 'YNG' ? C.young : C.older).attr('fill-opacity', c.p < 0.05 ? 1 : .55).attr('stroke', C.panel).attr('stroke-width', 1.2);
      svg.append('circle').attr('class', 'hit').attr('cx', cxp).attr('cy', y).attr('r', 10).on('pointermove', e => showTip(e, `<b>${c.tissue} · ${esc(c.ct)} · ${AGE[c.age]}</b><br><span class="mono">log2FC ${sgn(c.lfc)} · p ${fmtP(c.p)}</span>`)).on('pointerleave', hideTip); });
    svg.append('text').attr('x', W - 10).attr('y', y0 + 12).attr('text-anchor', 'end').style('font-family', 'var(--f-mono)').style('font-size', '10.5px').style('fill', C['ink-3']).text(`${pts.filter(c => c.lfc < 0).length}/${pts.length} lower`);
  });
  const pc = I.pbCyc.slice().sort((a, b) => M.tissues.indexOf(a.tissue) - M.tissues.indexOf(b.tissue) || (a.age === 'YNG' ? -1 : 1));
  const d = document.createElement('div'); d.style.marginTop = '14px';
  d.innerHTML = `<p class="minihead">Mitotic nuclear division in pre-B cells (NES)</p><div class="chips">${pc.map(p => `<span class="tag" style="font-family:var(--f-mono)">${p.tissue} ${AGE[p.age]} ${sgn(p.nes, 1)}${p.q < 0.05 ? '*' : ''}</span>`).join('')}</div>`;
  el.appendChild(d);
  const lg = document.createElement('div'); lg.className = 'legend'; lg.innerHTML = '<span><i style="background:var(--young)"></i>Young</span><span><i style="background:var(--older)"></i>Older</span><span>solid: p &lt; 0.05</span>'; el.insertBefore(lg, d);
}
function recurBars(el, I) {
  const rows = I.mhc;
  const W = Math.max(300, widthOf(el)), rh = 26, lw = 74, rw = 70, H = rows.length * rh + 40;
  const svg = svgIn(el, W, H), x = d3.scaleLinear().domain([0, 1]).range([lw, W - rw]);
  svg.append('text').attr('x', lw).attr('y', 12).style('fill', C.ground).style('font-weight', 600).text('← share lower in flight');
  svg.append('text').attr('x', W - rw).attr('y', 12).attr('text-anchor', 'end').style('fill', C.flight).style('font-weight', 600).text('higher →');
  const top = 20;
  rows.forEach((r, i) => { const y = top + i * rh, f = r.down / r.n;
    svg.append('text').attr('x', lw - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('font-style', 'italic').style('fill', C.ink).text(r.gene);
    svg.append('rect').attr('x', x(0)).attr('y', y + 5).attr('width', x(f) - x(0)).attr('height', rh - 10).attr('fill', C.ground).attr('rx', 2);
    svg.append('rect').attr('x', x(f) + 2).attr('y', y + 5).attr('width', Math.max(0, x(1) - x(f) - 2)).attr('height', rh - 10).attr('fill', C.flight).attr('rx', 2);
    svg.append('text').attr('x', W).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').style('font-family', 'var(--f-mono)').style('font-size', '10.5px').text(f >= .5 ? `${Math.round(f * 100)}% lower` : `${Math.round((1 - f) * 100)}% higher`);
    svg.append('rect').attr('class', 'hit').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh).style('cursor', 'pointer')
      .on('pointermove', e => showTip(e, `<b class="gene">${r.gene}</b><br>lower after flight in ${r.down} of ${r.n} comparisons<br><span class="mono">direction counts only; contexts share animals</span>`)).on('pointerleave', hideTip).on('click', () => openGene(r.gene));
  });
  svg.append('line').attr('x1', x(.5)).attr('x2', x(.5)).attr('y1', top).attr('y2', top + rows.length * rh).attr('stroke', C.ink).attr('stroke-dasharray', '3 3');
  svg.append('text').attr('x', x(.5)).attr('y', top + rows.length * rh + 14).attr('text-anchor', 'middle').style('fill', C['ink-3']).text('50% reference');
}
function ambStrip(el, I) {
  const W = Math.max(300, widthOf(el)), rh = 46, lw = 70, top = 22, H = top + 4 * rh + 34;
  const svg = svgIn(el, W, H), x = d3.scaleLinear().domain([-2, 1]).range([lw, W - 10]);
  svg.append('text').attr('x', 0).attr('y', 12).style('font-weight', 700).style('fill', C.ink).text(W < 520 ? `Granule genes in other cells: ${I.ambTest.down}/${I.ambTest.n} lower` : `Granule transcripts in non-granulocyte cells: ${I.ambTest.down} of ${I.ambTest.n} lower after flight`);
  svg.append('g').attr('class', 'grid').selectAll('line').data(x.ticks(6)).join('line').attr('x1', x).attr('x2', x).attr('y1', top).attr('y2', top + 4 * rh);
  svg.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', top).attr('y2', top + 4 * rh);
  xAxis(svg.append('g'), x, top + 4 * rh, 6); svg.append('text').attr('x', W - 10).attr('y', H - 2).attr('text-anchor', 'end').text('mean log2 CPM, flight − ground');
  M.tissues.forEach((t, i) => { const y0 = top + i * rh;
    svg.append('text').attr('x', 0).attr('y', y0 + rh / 2 + 4).style('fill', C.ink).text(t);
    const pts = I.amb.filter(a => a.tissue === t);
    pts.forEach((a, k) => { const y = y0 + 8 + ((k * 7) % (rh - 16)), cxp = x(Math.max(-2, Math.min(1, a.diff)));
      svg.append('circle').attr('cx', cxp).attr('cy', y).attr('r', 4.5).attr('fill', a.age === 'YNG' ? C.young : C.older).attr('fill-opacity', .85).attr('stroke', C.panel);
      svg.append('circle').attr('class', 'hit').attr('cx', cxp).attr('cy', y).attr('r', 9).on('pointermove', e => showTip(e, `<b>${t} · ${esc(a.ct)} · ${AGE[a.age]}</b><br><span class="mono">${sgn(a.diff)} (mean of ${a.ng} granule genes)</span>`)).on('pointerleave', hideTip); });
  });
  const lg = document.createElement('div'); lg.className = 'legend';
  lg.innerHTML = `<span><i style="background:var(--young)"></i>Young</span><span><i style="background:var(--older)"></i>Older</span>`;
  const le = document.createElement('p'); le.className = 'note'; le.innerHTML = `Leading edge of “antimicrobial humoral response” in those comparisons: <i>${I.ahLE.filter(x => !/^(Fau|Gapdh)$/.test(x[0])).slice(0, 6).map(x => x[0]).join(', ')}</i>`; el.appendChild(lg); el.appendChild(le);
}
function mitDots(el, I) {
  const pts = I.mit.map(r => ({m: r.mouse, v: r.pct, n: r.n, grp: r.age + '_' + r.cond}));
  dotGroups(el, pts, {ylab: '% in mitotic cluster (femur)', fmt: v => v.toFixed(1), unit: '%', zero: true, yfmt: d => d + '%', tipExtra: p => `${fmtN(p.n)} pre-B cells`,
    stats: a => { const r = (a === 'YNG'); return r ? `ground ${I.mitStats.meanGC.toFixed(0)}% · ${I.mitStats.meanGCnoGY1.toFixed(0)}% w/o GY1` : ''; }});
  const y = document.createElement('div'); y.style.marginTop = '12px';
  y.innerHTML = `<p class="minihead">Mean cells per mouse, ground → flight</p><div class="chips">${I.yield.map(r => `<span class="tag" style="font-family:var(--f-mono)">${r.tissue} ${AGE[r.age]} ${fmtN(r.gc)} → ${fmtN(r.flt)}</span>`).join('')}</div>`;
  el.appendChild(y);
}

/* ---------- boot ---------- */
async function boot() {
  palette();
  try { M = await load('meta.json'); }
  catch (e) { $('main').insertAdjacentHTML('afterbegin', `<p class="callout">The data files did not load (${esc(e.message)}). Open this page from a web server rather than from disk.</p>`); return; }
  M.comps.forEach((c, i) => ckey.set(c.tissue + '|' + c.ct + '|' + c.age, i));
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => go(b.dataset.v));
  makeSearch($('#g-search'), getGenes, g => openGene(g), s => `<span class="gene">${s}</span>`);
  makeSearch($('#p-search'), async () => (await gsea()).paths, p => openPath(p));
  const h = location.hash.slice(1);
  go(VIEWS.includes(h) ? h : 'overview', {top: false});
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 180); });
  const mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', render);
  new MutationObserver(render).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme', 'class']});
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== S.view) go(v); });
}
boot();
})();
