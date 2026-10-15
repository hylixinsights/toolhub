/* ============================================================ CLUSTERING tab */
const FAMILY_NAMES = { 1: 'Human & clinical studies', 3: 'Experimental biomedicine', 4: 'Animal health & reproduction', 2: 'Materials & environmental biotechnology', 5: 'Ecology, plants & environment', 6: 'Mixed topics' };
const FAMILY_ORDER = [1, 3, 4, 2, 5, 6];

const Clustering = {
  built: false, map: null, term: -1, td: null, feat: null, scale: 'norm', res: -1, focus: -1, panel: 'clusters',
  sort: 'pct', resMode: 'count', resMin: 2, resTop: 25, featCount: null, pendingCell: -1,
  enter() {
    if (!this.built) { this.build(); this.built = true; }
    else { this.map.resize(); }
    if (this.pendingCell >= 0) { const c = this.pendingCell; this.pendingCell = -1; this.selectCell(c); }
  },
  build() {
    this.map = new MapView($('#map'), {
      interactive: true,
      onSelect: c => { if (c >= 0) this.selectCell(c, false); },
      onHover: c => this.hoverHtml(c),
    });
    combobox({
      root: $('#cMesh'), search: q => searchMesh(q, 12), emptyText: 'No MeSH term matches',
      render: (it, q) => it.kind === 'mesh'
        ? { html: `<span class="opt-main">${hl(D.mesh.names[it.j], q)}</span><span class="opt-sub">${D.mesh.marker[it.j] >= 0 ? `marker of ${esc(clusterName(D.mesh.marker[it.j]))}` : 'MeSH descriptor'}</span><span class="opt-val">${fmt(D.mesh.df[it.j])}<br><span style="color:var(--muted)">researchers</span></span>` }
        : { off: true, html: `<span class="opt-main">${hl(D.mesh.excluded.names[it.i], q)}</span><span class="opt-sub">Not analysed: ${D.mesh.excluded.why[it.i] ? 'present in ≥90% of researchers' : `only ${fmt(D.mesh.excluded.n[it.i])} researchers (minimum 100)`}</span><span class="opt-val">—</span>` },
      onPick: (it, input) => { input.value = D.mesh.names[it.j]; this.setTerm(it.j); },
    });
    combobox({
      root: $('#cRes'), pending: () => D.R ? null : 'Loading researcher names…',
      search: q => searchResearchers(q, { limit: 10, onlyMapped: true }), emptyText: 'No researcher on the map matches that name',
      render: (r, q) => { const k = D.cells.cl[D.R.cellOf[r]]; return { html: `<span class="opt-main">${hl(D.R.name[r], q)}</span><span class="opt-sub"><span class="dot" style="background:var(--c${k});width:7px;height:7px;margin-right:5px"></span>${esc(clusterName(k))}</span><span class="opt-val">${fmt(D.R.pm[r])}<br><span style="color:var(--muted)">PubMed</span></span>` }; },
      onPick: (r, input) => { input.value = D.R.name[r]; this.selectCell(D.R.cellOf[r]); },
    });
    $('#zIn').addEventListener('click', () => this.map.zoomBy(1.6));
    $('#zOut').addEventListener('click', () => this.map.zoomBy(1 / 1.6));
    $('#zFit').addEventListener('click', () => this.map.fit(true));
    $('#zLab').addEventListener('click', e => { this.map.showLabels = !this.map.showLabels; e.currentTarget.setAttribute('aria-pressed', String(this.map.showLabels)); this.map.drawTop(); });
    $('#cReset').addEventListener('click', () => this.reset());
    $('#sideSeg').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) this.showPanel(b.dataset.p); });
    $('#mapStatus').addEventListener('click', e => {
      const b = e.target.closest('button[data-x]'); if (!b) return;
      if (b.dataset.x === 'term') this.clearTerm(); else if (b.dataset.x === 'res') this.clearRes(); else this.setFocus(-1);
    });
    onTheme(() => { this.map.render(true); this.paintRamp(); if (this.panel === 'mesh') this.renderPanel(); });
    this.renderPanel(); this.paintStatus();
  },
  hoverHtml(c) {
    const C = D.cells, r = C.r[c], k = C.cl[c];
    const name = D.R ? esc(D.R.name[r]) : 'Researcher';
    const pm = D.R ? `${fmt(D.R.pm[r])} PubMed-linked records` : '';
    let extra = '';
    if (this.term >= 0 && this.featCount) { const n = this.featCount[c]; extra = `<br>${esc(D.mesh.names[this.term])}: <b>${n}</b> article${n === 1 ? '' : 's'}`; }
    return `<b>${name}</b><br><span class="t-sub">${k} · ${esc(clusterName(k))}</span>${pm ? '<br>' + pm : ''}${extra}`;
  },
  /* ---------- state changes */
  async setTerm(j) {
    this.term = j;
    $('#cMeshInput').value = D.mesh.names[j];
    this.td = await termData(j);
    if (this.term !== j) return;
    this.featCount = new Uint16Array(D.cells.N);
    for (let t = 0; t < this.td.cells.length; t++) this.featCount[this.td.cells[t]] = this.td.counts[t];
    this.feat = buildFeature(this.td, this.scale);
    if (this.focus >= 0) { this.focus = -1; this.map.focus = -1; }
    this.map.setFeature(this.feat);
    this.paintRamp(); this.paintStatus(); this.showPanel('mesh');
  },
  clearTerm() {
    this.term = -1; this.td = null; this.feat = null; this.featCount = null; $('#cMeshInput').value = '';
    this.map.setClusters(); this.paintRamp(); this.paintStatus();
    this.showPanel(this.res >= 0 ? 'res' : 'clusters');
  },
  setScale(s) { if (s === this.scale) return; this.scale = s; if (this.td) { this.feat = buildFeature(this.td, s); this.map.setFeature(this.feat, true); this.paintRamp(); } this.renderPanel(); },
  selectCell(c, fly = true) {
    if (!this.built) { this.pendingCell = c; return; }
    this.res = c;
    const r = D.cells.r[c];
    this.map.selLabel = D.R ? D.R.name[r] : '';
    this.map.select(c, fly);
    if (D.R) $('#cResInput').value = D.R.name[r];
    this.paintStatus(); this.showPanel('res');
  },
  clearRes() { this.res = -1; this.map.selLabel = ''; this.map.select(-1); $('#cResInput').value = ''; this.paintStatus(); this.showPanel(this.term >= 0 ? 'mesh' : 'clusters'); },
  setFocus(k) {
    if (this.term >= 0 && k >= 0) { this.term = -1; this.td = null; this.feat = null; this.featCount = null; $('#cMeshInput').value = ''; this.map.mode = 'cluster'; this.paintRamp(); }
    this.focus = k; this.map.hoverCl = -1; this.map.setFocus(k); this.paintStatus();
    if (this.panel === 'clusters') this.renderPanel();
  },
  reset() {
    this.term = -1; this.td = null; this.feat = null; this.featCount = null; this.res = -1; this.focus = -1;
    $('#cMeshInput').value = ''; $('#cResInput').value = '';
    this.map.focus = -1; this.map.selLabel = ''; this.map.select(-1); this.map.setClusters(); this.map.fit(true);
    this.paintRamp(); this.paintStatus(); this.showPanel('clusters');
  },
  showPanel(p) {
    this.panel = p;
    $$('#sideSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === p)));
    this.renderPanel();
  },
  paintStatus() {
    const s = [];
    if (this.focus >= 0) s.push(`<span class="chip">${clusterDot(this.focus)}Cluster ${this.focus}<button type="button" data-x="focus" aria-label="Clear cluster focus">${xIcon}</button></span>`);
    if (this.term >= 0) s.push(`<span class="chip"><span class="dot" style="background:var(--ramp-1)"></span>${esc(D.mesh.names[this.term])}<button type="button" data-x="term" aria-label="Clear MeSH term">${xIcon}</button></span>`);
    if (this.res >= 0 && D.R) s.push(`<span class="chip"><span class="dot" style="background:var(--ink)"></span>${esc(D.R.name[D.cells.r[this.res]])}<button type="button" data-x="res" aria-label="Clear researcher">${xIcon}</button></span>`);
    $('#mapStatus').innerHTML = s.join('');
  },
  paintRamp() {
    const el = $('#mapRamp');
    if (!this.feat) { el.hidden = true; return; }
    const f = this.feat, cap = f.scale === 'count' ? fmt(f.capLabel) : f.capLabel.toFixed(1);
    el.hidden = false;
    el.innerHTML = `<div>${f.scale === 'count' ? 'Articles with the term' : 'Normalized level'}</div><div class="rb" style="background:${COL.rampCss}"></div><div class="rl"><span>${f.scale === 'count' ? '1' : '>0'}</span><span>${cap}+</span></div><div style="display:flex;align-items:center;gap:5px;margin-top:3px"><span class="dot" style="background:var(--zero)"></span>none</div>`;
  },
  /* ---------- side panel */
  renderPanel() {
    const body = $('#sideBody');
    if (this.panel === 'clusters') body.innerHTML = this.clustersHtml();
    else if (this.panel === 'mesh') { if (this.term < 0) body.innerHTML = this.emptyMesh(); else this.meshPanel(body); }
    else { if (this.res < 0) body.innerHTML = this.emptyRes(); else this.resPanel(body); }
    this.bindPanel(body);
  },
  emptyMesh() {
    const ex = ['Dengue', 'Hippocampus', 'Dental Enamel', 'Biodiversity', 'Obesity', 'Zika Virus Infection'].filter(t => D.meshIndexByName.has(t));
    return `<div class="side-title">Colour by a MeSH term</div><p class="note" style="font-size:13px">Search above, or try one of these. The map turns into a feature plot and the panel shows the term's level in each cluster.</p><div class="term-chips">${ex.map(t => `<button type="button" class="chip" data-term="${D.meshIndexByName.get(t)}">${esc(t)}</button>`).join('')}</div>`;
  },
  emptyRes() {
    return `<div class="side-title">Find a researcher</div><p class="note" style="font-size:13px">Search by name above or click any point on the map. You will see where they sit and which MeSH terms define their profile.</p>`;
  },
  clustersHtml() {
    const cl = D.meta.clusters, dg = D.meta.dendrogram, groups = {};
    for (const k of dg.leaves) (groups[dg.family[k]] = groups[dg.family[k]] || []).push(k);
    let h = `<p class="note" style="margin:0 0 12px">${fmt(D.cells.N)} researchers in ${cl.length} clusters. Colour families follow the branches of a tree built from the clusters' average MeSH profiles. Click a cluster to isolate it and see its marker terms.</p>`;
    for (const f of FAMILY_ORDER) {
      const ks = groups[f]; if (!ks) continue;
      const n = ks.reduce((a, k) => a + cl[k].n, 0);
      h += `<div class="fam"><div class="fam-h"><span>${FAMILY_NAMES[f]}</span><span class="num">${fmt(n)}</span></div>`;
      for (const k of ks) {
        const c = cl[k], on = this.focus === k;
        h += `<button type="button" class="leg-row${on ? ' on' : ''}" data-k="${k}" aria-pressed="${on}"><span class="dot" style="background:var(--c${k});width:11px;height:11px"></span><span class="id">${k}</span><span class="lb">${esc(c.label)}${c.confidence === 'Low' ? '<sup>*</sup>' : ''}</span><span class="n">${fmt(c.n)}</span></button>`;
        if (on) h += `<div class="markers"><div style="margin-bottom:4px;color:var(--muted)">Top markers (${c.nMarkers} on the shortlist) · ${c.confidence} confidence</div>${c.markers.slice(0, 14).map(mk => `<span class="mk" data-term="${D.meshIndexByName.has(mk.t) ? D.meshIndexByName.get(mk.t) : ''}" title="in ${pct(mk.in, 0)} of the cluster vs ${pct(mk.out, 0)} elsewhere · log2FC ${mk.lfc}">${esc(mk.t)}</span>`).join('')}<div style="margin-top:6px;color:var(--muted)">${esc(c.rationale)}</div></div>`;
      }
      h += '</div>';
    }
    return h + `<p class="note">* Low-confidence label: heterogeneous markers.</p>`;
  },
  bindPanel(body) {
    $$('.leg-row', body).forEach(b => {
      const k = +b.dataset.k;
      b.addEventListener('mouseenter', () => { if (this.focus < 0 && this.term < 0) this.map.setHoverCluster(k); });
      b.addEventListener('mouseleave', () => this.map.setHoverCluster(-1));
      b.addEventListener('click', () => this.setFocus(this.focus === k ? -1 : k));
    });
    $$('[data-term]', body).forEach(b => b.addEventListener('click', () => { if (b.dataset.term !== '') this.setTerm(+b.dataset.term); }));
  },
  meshPanel(body) {
    const j = this.term, td = this.td, M = D.mesh, C = D.cells, K = D.meta.clusters.length;
    const per = Array.from({ length: K }, () => []);
    for (let t = 0; t < td.cells.length; t++) per[C.cl[td.cells[t]]].push(this.scale === 'count' ? Math.log10(td.counts[t]) : td.y[t]);
    const stats = per.map((v, k) => { const s = Float64Array.from(v).sort(); return { k, n: v.length, of: D.members[k].length, p: v.length / D.members[k].length, med: s.length ? s[Math.floor(s.length / 2)] : 0, vals: s }; });
    const order = stats.slice().sort(this.sort === 'pct' ? (a, b) => b.p - a.p : this.sort === 'median' ? (a, b) => (b.n ? b.med : -1) - (a.n ? a.med : -1) : (a, b) => a.k - b.k);
    let xmax = 0; for (const s of stats) if (s.vals.length) xmax = Math.max(xmax, s.vals[s.vals.length - 1]);
    xmax = Math.max(xmax, this.scale === 'count' ? Math.log10(2) : 0.5);
    const axis = this.scale === 'count' ? [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(v => Math.log10(v) <= xmax).map(v => ({ v: Math.log10(v), l: v })) : niceTicks(xmax, 3).filter(v => v <= xmax).map(v => ({ v, l: v }));
    const mk = M.marker[j];
    body.innerHTML = `<div class="side-title">${esc(M.names[j])}</div>
      <div class="side-meta"><span>${fmt(M.df[j])} researchers · ${pct(M.df[j] / C.N)}</span><span>${fmt(M.tot[j])} articles in total</span>${mk >= 0 ? `<span>marker of ${clusterDot(mk)} ${esc(clusterName(mk))}</span>` : ''}</div>
      <div class="controls"><div class="seg" role="group" aria-label="Scale"><button type="button" data-scale="norm" aria-pressed="${this.scale === 'norm'}">Normalized</button><button type="button" data-scale="count" aria-pressed="${this.scale === 'count'}">Articles</button></div>
      <label class="ctl" for="vioSort"><span class="note">Sort</span><select class="sel" id="vioSort"><option value="pct">% with term</option><option value="median">Median level</option><option value="id">Cluster number</option></select></label></div>
      <div class="vio-axis" style="display:grid;grid-template-columns:minmax(0,0.95fr) minmax(0,1.25fr) 46px;gap:8px;font-size:10px;color:var(--muted);font-family:var(--font-data);margin:8px 0 2px"><span>cluster</span><span style="position:relative;height:12px">${axis.map(a => `<span style="position:absolute;left:${(100 * a.v / xmax).toFixed(1)}%;transform:translateX(-${a.v === 0 ? 0 : a.v / xmax > 0.92 ? 100 : 50}%)">${a.l}</span>`).join('')}</span><span style="text-align:right">with term</span></div>
      <div id="vioRows">${order.map(s => `<div class="vrow" data-k="${s.k}" style="display:grid;grid-template-columns:minmax(0,0.95fr) minmax(0,1.25fr) 46px;gap:8px;align-items:center;padding:2px 0;border-top:1px solid var(--rule)">
        <span style="display:flex;align-items:center;gap:6px;min-width:0;font-size:12px"><span class="dot" style="background:var(--c${s.k})"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(clusterName(s.k))}</span></span>
        <svg viewBox="0 0 200 22" preserveAspectRatio="none" style="width:100%;height:22px;display:block">${violinPath(s.vals, xmax, s.k)}</svg>
        <span class="num" style="text-align:right;font-size:12px;font-family:var(--font-data)">${pct(s.p, s.p < 0.1 ? 1 : 0)}</span></div>`).join('')}</div>
      <p class="note" style="margin-top:10px">Each violin shows the researchers in that cluster who have at least one article with the term. ${this.scale === 'count' ? 'Article counts on a log scale.' : 'Normalized level = log1p(articles with the term ÷ researcher\'s MeSH total × 10,000), the value used for clustering.'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" data-goto="mesh">Rank researchers on this term</button></div>`;
    $('#vioSort', body).value = this.sort;
    $('#vioSort', body).addEventListener('change', e => { this.sort = e.target.value; this.renderPanel(); });
    $$('[data-scale]', body).forEach(b => b.addEventListener('click', () => this.setScale(b.dataset.scale)));
    $('[data-goto="mesh"]', body).addEventListener('click', () => { go('mesh'); MeshTab.select(j); });
    $$('.vrow', body).forEach(row => {
      const s = stats[+row.dataset.k];
      row.addEventListener('pointermove', e => {
        const medTxt = s.n ? (this.scale === 'count' ? `${fmt(Math.pow(10, s.med))} article${Math.round(Math.pow(10, s.med)) === 1 ? '' : 's'}` : s.med.toFixed(2)) : '—';
        showTip(`<b>${s.k} · ${esc(clusterName(s.k))}</b><br>${fmt(s.n)} of ${fmt(s.of)} researchers (${pct(s.p)})<br>median among them: ${medTxt}`, e.clientX, e.clientY);
      });
      row.addEventListener('pointerleave', hideTip);
      row.style.cursor = 'pointer'; if (this.map.featFocus === s.k) row.style.background = 'var(--accent-soft)';
      row.addEventListener('click', () => { this.map._snap(); this.map.featFocus = this.map.featFocus === s.k ? -1 : s.k; this.map.render(true); $$('.vrow', body).forEach(x => { x.style.background = +x.dataset.k === this.map.featFocus ? 'var(--accent-soft)' : ''; }); });
    });
  },
  async resPanel(body) {
    const c = this.res, C = D.cells, r = C.r[c], k = C.cl[c];
    if (!D.R) await D.ready.R;
    const R = D.R;
    body.innerHTML = `<div class="side-title">${esc(R.name[r])}</div>
      <div class="side-meta">${clusterChip(k)}<span>${fmt(R.pm[r])} PubMed-linked records</span><span>#${fmt(D.clRank[c])} of ${fmt(D.members[k].length)} in cluster</span></div>
      <div class="controls">
        <label class="ctl" for="resMode"><span class="note">Sort by</span><select class="sel" id="resMode"><option value="count">Articles</option><option value="z">z-score vs all researchers</option><option value="tfidf">TF-IDF</option></select></label>
        <label class="ctl" for="resMin"><span class="note">Min.</span><select class="sel" id="resMin"><option value="1">1 article</option><option value="2">2 articles</option><option value="3">3 articles</option><option value="5">5 articles</option></select></label>
        <label class="ctl" for="resTop"><span class="note">Show</span><select class="sel" id="resTop"><option>15</option><option>25</option><option>50</option></select></label>
      </div>
      <div class="bars" id="resBars"><div class="loading"><span class="spin"></span>Loading MeSH profile…</div></div>
      <p class="note" id="resNote" style="margin-top:10px"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" data-goto="profile">Full profile</button></div>`;
    $('#resMode', body).value = this.resMode; $('#resMin', body).value = String(this.resMin); $('#resTop', body).value = String(this.resTop);
    const ct = await cellTerms(c);
    if (this.res !== c || this.panel !== 'res') return;
    const paint = () => {
      const list = scoreTerms(c, ct, this.resMode, this.resMin).slice(0, this.resTop);
      const val = t => this.resMode === 'z' ? t.z : this.resMode === 'tfidf' ? t.tf : t.n;
      const mx = Math.max(1e-9, ...list.map(val));
      const box = $('#resBars', body);
      box.innerHTML = list.length ? list.map(t => `<button type="button" class="brow" data-j="${t.j}"><span class="t">${esc(D.mesh.names[t.j])}</span><span class="track"><i data-w="${Math.max(0, 100 * val(t) / mx).toFixed(1)}"></i></span><span class="v">${this.resMode === 'count' ? t.n : val(t).toFixed(1)}</span></button>`).join('') : '<div class="empty">No terms reach that minimum.</div>';
      requestAnimationFrame(() => requestAnimationFrame(() => $$('.track i', box).forEach(i => { i.style.width = i.dataset.w + '%'; })));
      $$('.brow', box).forEach(b => {
        const t = list.find(x => x.j === +b.dataset.j);
        b.addEventListener('pointermove', e => showTip(`<b>${esc(D.mesh.names[t.j])}</b><br>${t.n} article${t.n === 1 ? '' : 's'} · z = ${t.z.toFixed(2)} · TF-IDF ${t.tf.toFixed(1)}<br>used by ${fmt(D.mesh.df[t.j])} researchers (${pct(D.mesh.df[t.j] / C.N)})<br><span class="t-sub">Click to colour the map by this term</span>`, e.clientX, e.clientY));
        b.addEventListener('pointerleave', hideTip);
        b.addEventListener('click', () => { hideTip(); this.setTerm(t.j); });
      });
      $('#resNote', body).textContent = {
        count: `${fmt(ct.terms.length)} distinct MeSH terms in this profile. Raw counts favour terms every biomedical paper carries (Male, Female, Animals); switch to z-score or TF-IDF to bring out the specific ones.`,
        z: `z-score: the researcher\'s normalized level for the term minus the mean over all ${fmt(C.N)} researchers, divided by the standard deviation. High values mark terms unusually prominent for this person. Rare terms inflate z, so keep a minimum of 2 or more articles.`,
        tfidf: `TF-IDF: articles with the term × ln(${fmt(C.N)} ÷ researchers using the term). It rewards terms that are both frequent for this person and uncommon overall.`,
      }[this.resMode];
    };
    paint();
    $('#resMode', body).addEventListener('change', e => { this.resMode = e.target.value; paint(); });
    $('#resMin', body).addEventListener('change', e => { this.resMin = +e.target.value; paint(); });
    $('#resTop', body).addEventListener('change', e => { this.resTop = +e.target.value; paint(); });
    $('[data-goto="profile"]', body).addEventListener('click', () => { go('researchers'); Researchers.show(r); $('#rSearchInput').value = R.name[r]; });
  },
};
const xIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6 6 18"/></svg>';

/* half-violin (mirrored) path for sorted values within [0, xmax] in a 200×22 box */
function violinPath(vals, xmax, k) {
  if (!vals.length) return `<line x1="0" x2="200" y1="11" y2="11" style="stroke:var(--rule);stroke-width:1" vector-effect="non-scaling-stroke"/>`;
  const W = 200, H = 22, NB = 120, G = 60, hist = new Float64Array(NB);
  for (const v of vals) hist[Math.min(NB - 1, Math.floor(v / xmax * NB))]++;
  const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, n - 1));
  const iqr = vals[Math.floor(0.75 * (n - 1))] - vals[Math.floor(0.25 * (n - 1))];
  const spread = Math.min(sd || xmax / 10, iqr > 0 ? iqr / 1.34 : sd || xmax / 10);
  const bw = Math.max(xmax / 50, 0.9 * spread * Math.pow(n, -0.2));
  const lo = vals[0], hi = vals[n - 1], dens = new Float64Array(G);
  for (let g = 0; g < G; g++) {
    const x = lo + (hi - lo) * g / (G - 1); let s = 0;
    for (let b = 0; b < NB; b++) if (hist[b]) { const c = (b + 0.5) / NB * xmax, z = (x - c) / bw; if (z > -4 && z < 4) s += hist[b] * Math.exp(-0.5 * z * z); }
    dens[g] = s;
  }
  const dmax = Math.max(...dens) || 1, X = v => v / xmax * W;
  let top = '', bot = '';
  for (let g = 0; g < G; g++) { const x = X(lo + (hi - lo) * g / (G - 1)), h = Math.max(0.6, dens[g] / dmax * (H / 2 - 1.5)); top += `${g ? 'L' : 'M'}${x.toFixed(2)},${(H / 2 - h).toFixed(2)}`; bot = `L${x.toFixed(2)},${(H / 2 + h).toFixed(2)}` + bot; }
  const med = vals[Math.floor(n / 2)];
  const path = n < 3 ? vals.map(v => `<circle cx="${X(v).toFixed(1)}" cy="11" r="1.6" style="fill:var(--c${k})"/>`).join('') : `<path d="${top}${bot.replace(/^L/, 'L')}Z" style="fill:var(--c${k});fill-opacity:0.78;stroke:var(--c${k});stroke-width:0.8" vector-effect="non-scaling-stroke"/>`;
  return path + `<line x1="${X(med).toFixed(2)}" x2="${X(med).toFixed(2)}" y1="3" y2="19" style="stroke:var(--ink);stroke-width:1.5" vector-effect="non-scaling-stroke"/>`;
}
