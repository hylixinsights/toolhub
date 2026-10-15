/* ============================================================ RESEARCHERS tab */
const Researchers = {
  built: false, current: -1, filter: -1, shown: 25, mini: null,
  enter() { if (!this.built) { this.build(); this.built = true; } },
  build() {
    this.cb = combobox({
      root: $('#rSearch'),
      pending: () => D.R ? null : 'Loading researcher names…',
      search: q => searchResearchers(q, { limit: 12 }),
      render: (r, q) => {
        const c = D.R.cellOf[r];
        const sub = c >= 0 ? `<span class="dot" style="background:var(--c${D.cells.cl[c]});width:7px;height:7px;margin-right:5px"></span>${esc(clusterName(D.cells.cl[c]))}` : 'Not in the map (fewer than 10 linked records)';
        return { html: `<span class="opt-main">${hl(D.R.name[r], q)}</span><span class="opt-sub">${sub}</span><span class="opt-val">${fmt(D.R.pm[r])}<br><span style="color:var(--muted)">PubMed</span></span>` };
      },
      onPick: (r, input) => { input.value = D.R.name[r]; this.show(r); },
      emptyText: 'No researcher with a PubMed-linked article matches that name',
    });
    D.ready.R.then(() => { this.hints(); this.board(); });
    $('#board').innerHTML = '<div class="loading"><span class="spin"></span>Loading the ranking…</div>';
  },
  hints() {
    const R = D.R, pool = [];
    for (let c = 0; c < D.cells.N; c++) if (R.pm[D.cells.r[c]] >= 40) pool.push(D.cells.r[c]);
    const rnd = () => pool[Math.floor(Math.random() * pool.length)];
    const example = R.id.indexOf('5515247461567730');
    $('#rHint').innerHTML = `<span>Try</span><button type="button" data-r="${example >= 0 ? example : 0}">${esc(R.name[example >= 0 ? example : 0])}</button><button type="button" data-rand="1">a random researcher</button>`;
    $('#rHint').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const r = b.dataset.rand ? rnd() : +b.dataset.r;
      $('#rSearchInput').value = R.name[r]; this.show(r);
    });
  },
  board() {
    const opts = D.meta.clusters.map(c => `<option value="${c.id}">${c.id} · ${esc(c.label)}</option>`).join('');
    $('#board').innerHTML = `<div class="board-head"><div><div class="label">Ranking</div><h2>Most PubMed-linked records</h2></div>
      <div class="controls"><label class="ctl" for="boardSel"><span class="note">Show</span><select id="boardSel" class="sel"><option value="-1">All researchers</option>${opts}</select></label></div></div>
      <div class="rows" id="boardRows"></div><div style="margin-top:14px"><button class="btn" id="boardMore" type="button">Show 25 more</button></div>`;
    $('#boardSel').addEventListener('change', e => { this.filter = +e.target.value; this.shown = 25; this.paintBoard(); });
    $('#boardMore').addEventListener('click', () => { this.shown += 25; this.paintBoard(true); });
    $('#boardRows').addEventListener('click', e => { const row = e.target.closest('.row'); if (!row) return; const r = +row.dataset.r; $('#rSearchInput').value = D.R.name[r]; this.show(r); });
    this.paintBoard();
  },
  paintBoard(append = false) {
    const R = D.R, C = D.cells, list = [];
    if (this.filter < 0) { for (let i = 0; i < Math.min(this.shown, R.n); i++) list.push({ r: i, rank: R.rank[i] }); }
    else { const m = D.members[this.filter]; for (let i = 0; i < Math.min(this.shown, m.length); i++) list.push({ r: C.r[m[i]], rank: D.clRank[m[i]] }); }
    const mx = list.length ? R.pm[list[0].r] : 1;
    $('#boardRows').innerHTML = list.map(({ r, rank }) => {
      const c = R.cellOf[r], k = c >= 0 ? C.cl[c] : -1;
      return `<button type="button" class="row" data-r="${r}"><span class="rk">${rank}</span><span class="nm">${esc(R.name[r])}</span><span class="cl">${k >= 0 ? clusterDot(k) + esc(clusterName(k)) : '<span style="color:var(--muted)">not in map</span>'}</span><span class="bar"><i style="width:${(100 * R.pm[r] / mx).toFixed(1)}%"></i><b>${fmt(R.pm[r])}</b></span></button>`;
    }).join('');
    const total = this.filter < 0 ? R.n : D.members[this.filter].length;
    $('#boardMore').hidden = this.shown >= total;
  },
  async show(r) {
    if (!D.R) await D.ready.R;
    this.current = r;
    const R = D.R, C = D.cells, c = R.cellOf[r], k = c >= 0 ? C.cl[c] : -1, id = R.id[r];
    const zero = D.zeroSet.has(id), N = R.n;
    const topPct = R.rank[r] / N;
    const clN = k >= 0 ? D.members[k].length : 0;
    const why = zero ? 'Excluded from the map: none of their MeSH terms passed the prevalence filter.' : 'Not in the map: the clustering uses researchers with at least 10 PubMed-linked records.';
    const yr = v => v > 0 ? v : '—';
    const el = $('#profile');
    el.innerHTML = `<article class="profile fade-in">
      <div class="p-top"><div style="min-width:0"><div class="label">Researcher profile</div><h2 class="p-name">${esc(R.name[r])}</h2>
        <div class="p-meta">${k >= 0 ? clusterChip(k) : `<span class="chip">Not in the map</span>`}<span>Lattes ID <span class="mono">${id}</span></span><a href="http://lattes.cnpq.br/${id}" target="_blank" rel="noopener">Lattes CV ↗</a></div></div>
        <div class="p-actions">${k >= 0 ? '<button type="button" class="btn primary" data-act="map">Show on the map</button>' : ''}<button type="button" class="btn" data-act="board">Ranking</button></div></div>
      <div class="p-stats">
        <div class="p-stat"><div class="label">PubMed-linked records</div><div class="big" data-count="${R.pm[r]}">0</div><div class="cap">${pct(R.pm[r] / R.tot[r], 0)} of the ${fmt(R.tot[r])} journal-article records in the CV</div></div>
        <div class="p-stat"><div class="label">Rank in Brazil</div><div class="mid">#<span data-count="${R.rank[r]}">0</span></div><div class="cap">of ${fmt(N)} researchers with a linked article${topPct <= 0.5 ? ` · top ${topPct < 0.001 ? pct(topPct, 2) : topPct < 0.1 ? pct(topPct, 1) : pct(topPct, 0)}` : ''}${R.ties[r] > 1 ? ` · tied with ${fmt(R.ties[r] - 1)} other${R.ties[r] > 2 ? 's' : ''}` : ''}</div><div class="meter"><i data-w="${(100 * (1 - (R.rank[r] - 1) / N)).toFixed(2)}"></i></div></div>
        <div class="p-stat">${k >= 0 ? `<div class="label">Rank in cluster</div><div class="mid">#<span data-count="${D.clRank[c]}">0</span> <small>of ${fmt(clN)}</small></div><div class="cap">in ${esc(clusterName(k))}</div><div class="meter"><i data-w="${(100 * (1 - (D.clRank[c] - 1) / clN)).toFixed(2)}" style="background:var(--c${k})"></i></div>`
        : `<div class="label">Rank in cluster</div><div class="mid" style="color:var(--muted)">—</div><div class="cap">${why}</div>`}</div>
      </div>
      <div class="p-grid">
        <div style="min-width:0"><h3 class="h3">Articles per year</h3><p class="sub">Journal-article records in the Lattes CV, by year of publication</p><div class="chart" id="pTimeline"><div class="loading"><span class="spin"></span>Loading…</div></div>
          <h3 class="h3" style="margin-top:26px">Where this record sits</h3><p class="sub">All ${fmt(N)} researchers with a PubMed-linked article, by number of linked records (log scale)</p><div class="chart" id="pDist"></div></div>
        <div style="min-width:0"><h3 class="h3">The record</h3><dl class="facts">
          <dt>First journal article</dt><dd>${yr(R.fy[r])}</dd>
          <dt>First with an English title</dt><dd>${yr(R.fe[r])}</dd>
          <dt>First PubMed-linked article</dt><dd>${yr(R.fpm[r])}</dd>
          <dt>Latest PubMed-linked article</dt><dd>${yr(R.lpm[r])}</dd>
          <dt>Latest journal article</dt><dd>${yr(R.ly[r])}</dd>
          <dt>Journal-article records</dt><dd>${fmt(R.tot[r])}</dd>
          <dt>With an English title</dt><dd>${fmt(R.en[r])} <span style="color:var(--muted);font-weight:400">${pct(R.en[r] / R.tot[r], 0)}</span></dd>
          <dt>Linked to PubMed</dt><dd>${fmt(R.pm[r])} <span style="color:var(--muted);font-weight:400">${pct(R.pm[r] / R.tot[r], 0)}</span></dd>
          ${k >= 0 ? `<dt>Distinct MeSH terms in profile</dt><dd id="pNTerms">…</dd>` : ''}
        </dl><p class="note" style="margin-top:10px">Counts are CV records linked by exact title; an article listed twice in a CV counts twice.</p></div>
      </div>
      ${k >= 0 ? `<div class="p-cluster">
        <div style="min-width:0"><h3 class="h3">Position in the research map</h3><p class="sub">${esc(clusterName(k))} highlighted among ${fmt(C.N)} researchers</p><div class="minimap" id="pMini"><canvas></canvas></div></div>
        <div style="min-width:0"><h3 class="h3">Most characteristic MeSH terms</h3><p class="sub">Highest z-score against all ${fmt(C.N)} researchers, among terms on at least 2 of their articles</p><div class="term-chips" id="pTermsZ"></div>
          <h3 class="h3" style="margin-top:22px">Most frequent MeSH terms</h3><p class="sub">By number of linked articles carrying the term</p><div class="term-chips" id="pTermsN"></div></div>
      </div>` : ''}
    </article>`;
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    $$('[data-count]', el).forEach(n => countUp(n, +n.dataset.count, 1000));
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.meter i', el).forEach(i => { i.style.width = i.dataset.w + '%'; })));
    el.querySelector('[data-act="board"]').addEventListener('click', () => $('#board').scrollIntoView({ behavior: 'smooth' }));
    const mapBtn = el.querySelector('[data-act="map"]');
    if (mapBtn) mapBtn.addEventListener('click', () => { go('clustering'); Clustering.selectCell(c); });
    distChart($('#pDist'), r);
    researcherYears(r).then(rows => { if (this.current === r) timelineChart($('#pTimeline'), rows, R.ly[r]); });
    if (k >= 0) {
      if (this.mini) this.mini._ro.disconnect();
      this.mini = new MapView($('#pMini'), { interactive: false, labels: false, mini: true });
      this.mini.focus = k; this.mini.highlightCell = c; this.mini.render(true);
      cellTerms(c).then(ct => {
        if (this.current !== r) return;
        $('#pNTerms').textContent = fmt(ct.terms.length);
        const chips = list => list.map(t => `<button type="button" class="chip" data-j="${t.j}" title="${esc(D.mesh.names[t.j])}: ${t.n} articles · z = ${t.z.toFixed(1)}">${esc(D.mesh.names[t.j])} <b>${t.n}</b></button>`).join('');
        $('#pTermsZ').innerHTML = chips(scoreTerms(c, ct, 'z', 2).slice(0, 12)) || '<span class="note">No term appears on two or more of their articles.</span>';
        $('#pTermsN').innerHTML = chips(scoreTerms(c, ct, 'count', 1).slice(0, 10));
        $$('.term-chips', el).forEach(box => box.addEventListener('click', e => { const b = e.target.closest('[data-j]'); if (b) { go('mesh'); MeshTab.select(+b.dataset.j); } }));
      });
    }
  },
};

function timelineChart(fig, rows, lastYear) {
  fig.innerHTML = '';
  const valid = rows.filter(r => r.y > 0), nNA = rows.filter(r => r.y === 0).reduce((a, r) => a + r.t, 0);
  if (!valid.length) { fig.innerHTML = '<div class="empty">No dated records.</div>'; return; }
  const y1 = Math.min(2026, Math.max(...valid.map(r => r.y), Math.min(2025, lastYear > 0 ? lastYear : 2025))), y0 = Math.min(Math.max(1950, Math.min(...valid.map(r => r.y))), y1 - 11);
  const by = new Map(valid.map(r => [r.y, r]));
  const leg = document.createElement('div'); leg.className = 'legend';
  leg.innerHTML = `<span><i style="background:var(--rule-2)"></i>All records</span><span><i style="background:color-mix(in srgb, var(--accent) 38%, var(--rule-2))"></i>English title</span><span><i style="background:var(--accent)"></i>Linked to PubMed</span>`;
  fig.appendChild(leg);
  const W = Math.max(280, fig.clientWidth), H = 230, m = { l: 34, r: 6, t: 8, b: 22 };
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Articles per year' }, fig);
  const n = y1 - y0 + 1, bw = (W - m.l - m.r) / n, ymax = Math.max(...valid.map(r => r.t));
  const ticks = niceTicks(ymax, 4).map(Math.round).filter((v, i, a) => a.indexOf(v) === i), top = ticks[ticks.length - 1];
  const Y = v => H - m.b - v / top * (H - m.t - m.b);
  for (const t of ticks) {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), style: 'stroke:var(--rule)' }, svg);
    const tx = svgEl('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px' }, svg); tx.textContent = t;
  }
  const every = n > 40 ? 10 : n > 16 ? 5 : n > 8 ? 2 : 1;
  const gap = Math.min(2, bw * 0.2), rw = Math.max(1, bw - gap);
  for (let y = y0; y <= y1; y++) {
    const x = m.l + (y - y0) * bw + gap / 2, r = by.get(y);
    if (y % every === 0) { const tx = svgEl('text', { x: x + rw / 2, y: H - 6, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:10.5px' }, svg); tx.textContent = y; }
    if (!r) continue;
    const g = svgEl('g', { class: 'yr', style: `transform-origin:0 ${H - m.b}px;transform:scaleY(0);transition:transform .7s cubic-bezier(.2,.7,.2,1) ${Math.min(500, (y - y0) * 12)}ms` }, svg);
    const bar = (v, fill) => svgEl('rect', { x, y: Y(v), width: rw, height: Math.max(0, H - m.b - Y(v)), rx: Math.min(1.5, rw / 3), style: `fill:${fill}` }, g);
    bar(r.t, 'var(--rule-2)'); bar(r.e, 'color-mix(in srgb, var(--accent) 38%, var(--rule-2))'); bar(r.p, 'var(--accent)');
    const hit = svgEl('rect', { x: m.l + (y - y0) * bw, y: m.t, width: bw, height: H - m.t - m.b, style: 'fill:transparent' }, svg);
    hit.addEventListener('pointermove', e => showTip(`<b>${y}${y === 2026 ? ' (in progress)' : ''}</b><br>${r.t} records · ${r.e} English title<br>${r.p} linked to PubMed`, e.clientX, e.clientY));
    hit.addEventListener('pointerleave', hideTip);
  }
  svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), style: 'stroke:var(--ink-2)' }, svg);
  requestAnimationFrame(() => requestAnimationFrame(() => $$('g.yr', svg).forEach(g => { g.style.transform = 'scaleY(1)'; })));
  if (nNA) { const p = document.createElement('p'); p.className = 'note'; p.textContent = `${nNA} record${nNA > 1 ? 's' : ''} without a valid year are not shown.`; fig.appendChild(p); }
}

let _distBins = null;
function distChart(fig, r) {
  const R = D.R, edges = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, Infinity];
  if (!_distBins) { _distBins = new Array(edges.length - 1).fill(0); for (let i = 0; i < R.n; i++) { const v = R.pm[i]; for (let b = 0; b < edges.length - 1; b++) if (v < edges[b + 1]) { _distBins[b]++; break; } } }
  const lab = b => edges[b + 1] === Infinity ? `${edges[b]}+` : edges[b + 1] - edges[b] === 1 ? String(edges[b]) : `${edges[b]}–${edges[b + 1] - 1}`;
  const mine = edges.findIndex((e, b) => R.pm[r] >= e && R.pm[r] < edges[b + 1]);
  fig.innerHTML = '';
  const W = Math.max(260, fig.clientWidth), H = 170, m = { l: 40, r: 4, t: 22, b: 22 };
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Distribution of PubMed-linked records' }, fig);
  const n = _distBins.length, bw = (W - m.l - m.r) / n, lmax = Math.log10(Math.max(..._distBins));
  const Y = v => H - m.b - (v > 0 ? Math.log10(v) / lmax : 0) * (H - m.t - m.b);
  for (const t of [1, 10, 100, 1000, 10000, 100000].filter(t => Math.log10(t) <= lmax + 0.01)) {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), style: 'stroke:var(--rule)' }, svg);
    const tx = svgEl('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:10.5px' }, svg); tx.textContent = shortNum(t);
  }
  _distBins.forEach((v, b) => {
    const x = m.l + b * bw + 2, y = Y(v), on = b === mine;
    const rect = svgEl('rect', { x, y, width: bw - 4, height: H - m.b - y, rx: 2, style: `fill:${on ? 'var(--accent)' : 'var(--rule-2)'}` }, svg);
    if (on || bw >= 44 || (b % 2 === 0 && Math.abs(b - mine) !== 1)) { const tx = svgEl('text', { x: x + (bw - 4) / 2, y: H - 6, 'text-anchor': 'middle', style: `fill:${on ? 'var(--ink)' : 'var(--muted)'};font-size:10px;font-weight:${on ? 650 : 400}` }, svg); tx.textContent = lab(b); }
    if (on) { const t2 = svgEl('text', { x: x + (bw - 4) / 2, y: y - 6, 'text-anchor': 'middle', style: 'fill:var(--accent);font-size:10.5px;font-weight:650' }, svg); t2.textContent = '▼'; }
    rect.addEventListener('pointermove', e => showTip(`<b>${lab(b)} linked records</b><br>${fmt(v)} researchers${on ? '<br>this researcher is here' : ''}`, e.clientX, e.clientY));
    rect.addEventListener('pointerleave', hideTip);
  });
  svgEl('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, style: 'stroke:var(--ink-2)' }, svg);
}
