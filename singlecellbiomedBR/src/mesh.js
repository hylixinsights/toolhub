/* ============================================================ MESH tab */
const MeshTab = {
  built: false, j: -1, top: 25, measure: 'count', td: null,
  enter() {
    if (!this.built) { this.build(); this.built = true; }
    if (this.j < 0) this.select(D.meshIndexByName.get('Dengue') ?? 0);
  },
  build() {
    combobox({
      root: $('#mSearch'), search: q => searchMesh(q, 14), emptyText: 'No MeSH term matches',
      render: (it, q) => it.kind === 'mesh'
        ? { html: `<span class="opt-main">${hl(D.mesh.names[it.j], q)}</span><span class="opt-sub">${D.mesh.marker[it.j] >= 0 ? `marker of ${esc(clusterName(D.mesh.marker[it.j]))}` : 'MeSH descriptor'}</span><span class="opt-val">${fmt(D.mesh.df[it.j])}<br><span style="color:var(--muted)">researchers</span></span>` }
        : { off: true, html: `<span class="opt-main">${hl(D.mesh.excluded.names[it.i], q)}</span><span class="opt-sub">Not analysed: ${D.mesh.excluded.why[it.i] ? 'present in ≥90% of researchers' : `only ${fmt(D.mesh.excluded.n[it.i])} researchers (minimum 100)`}</span><span class="opt-val">—</span>` },
      onPick: (it, input) => { input.value = D.mesh.names[it.j]; this.select(it.j); },
    });
    const ex = ['Zika Virus Infection', 'Leishmaniasis, Visceral', 'Chagas Disease', 'Dental Caries', 'Sugarcane', 'Machine Learning', 'COVID-19'].filter(t => D.meshIndexByName.has(t));
    $('#mHint').innerHTML = `<span>Try</span>${ex.map(t => `<button type="button" data-j="${D.meshIndexByName.get(t)}">${esc(t)}</button>`).join('')}`;
    $('#mHint').addEventListener('click', e => { const b = e.target.closest('button[data-j]'); if (b) this.select(+b.dataset.j); });
    onTheme(() => { if (this.td) this.paintBars(); });
  },
  async select(j) {
    if (!this.built) { this.build(); this.built = true; }
    this.j = j; $('#mSearchInput').value = D.mesh.names[j];
    $('#meshView').innerHTML = '<div class="loading"><span class="spin"></span>Loading…</div>';
    const td = await termData(j);
    if (!D.R) await D.ready.R;
    if (this.j !== j) return;
    this.td = td; this.render();
  },
  render() {
    const j = this.j, td = this.td, M = D.mesh, C = D.cells, K = D.meta.clusters.length;
    const share = new Array(K).fill(0);
    for (const c of td.cells) share[C.cl[c]]++;
    const shares = share.map((n, k) => ({ k, n, p: n / D.members[k].length })).sort((a, b) => b.p - a.p);
    const sortedCounts = Array.from(td.counts).sort((a, b) => a - b);
    const med = sortedCounts.length ? sortedCounts[Math.floor(sortedCounts.length / 2)] : 0, mx = sortedCounts[sortedCounts.length - 1] || 0;
    const top = shares[0];
    $('#meshView').innerHTML = `<div class="fade-in">
      <div class="m-head"><div style="min-width:0"><div class="label">MeSH descriptor</div><h2>${esc(M.names[j])}</h2></div>
        <div class="p-actions"><button type="button" class="btn primary" data-act="map">Colour the map by this term</button><a class="btn" href="https://www.ncbi.nlm.nih.gov/mesh/?term=${encodeURIComponent(M.names[j])}" target="_blank" rel="noopener">MeSH record ↗</a></div></div>
      <div class="m-stats">
        <div><div class="v">${fmt(M.df[j])}</div><div class="k">researchers with at least one article · ${pct(M.df[j] / C.N)} of the map</div></div>
        <div><div class="v">${fmt(med)}</div><div class="k">median articles per researcher who uses it</div></div>
        <div><div class="v">${fmt(mx)}</div><div class="k">most articles by a single researcher</div></div>
        <div><div class="v txt">${clusterDot(top.k)}<span>${esc(clusterName(top.k))}</span></div><div class="k">cluster where it is most common · ${pct(top.p, 0)} of members</div></div>
      </div>
      <div class="m-grid">
        <div style="min-width:0">
          <div class="board-head" style="margin-bottom:0"><div><h3 class="h3">Researchers with the most articles on this term</h3><p class="sub" id="mSub"></p></div>
            <div class="controls">
              <div class="seg" role="group" aria-label="Measure"><button type="button" data-m="count" aria-pressed="${this.measure === 'count'}">Articles</button><button type="button" data-m="share" aria-pressed="${this.measure === 'share'}">Share of their work</button></div>
              <label class="ctl" for="mTop"><span class="note">Top</span><select class="sel" id="mTop"><option>10</option><option>25</option><option>50</option><option>100</option></select></label>
            </div></div>
          <div class="hbar" id="mBars"></div>
        </div>
        <div style="min-width:0"><h3 class="h3">Share of each cluster using the term</h3><p class="sub">Researchers with at least one article carrying it, as a share of the cluster</p>
          <div class="cl-share">${shares.map(s => `<div class="cs-row" title="${s.n} of ${D.members[s.k].length} researchers"><span class="t">${clusterDot(s.k)}<span>${esc(clusterName(s.k))}</span></span><span class="track"><i data-w="${(100 * s.p / Math.max(1e-9, top.p)).toFixed(1)}" style="background:var(--c${s.k})"></i></span><span class="v">${pct(s.p, s.p < 0.1 ? 1 : 0)}</span></div>`).join('')}</div>
        </div>
      </div></div>`;
    $('#mTop').value = String(this.top);
    $('#mTop').addEventListener('change', e => { this.top = +e.target.value; this.paintBars(); });
    $$('[data-m]', $('#meshView')).forEach(b => b.addEventListener('click', () => { this.measure = b.dataset.m; $$('[data-m]', $('#meshView')).forEach(x => x.setAttribute('aria-pressed', String(x === b))); this.paintBars(); }));
    $('[data-act="map"]', $('#meshView')).addEventListener('click', () => { go('clustering'); Clustering.setTerm(j); });
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.cs-row .track i').forEach(i => { i.style.width = i.dataset.w + '%'; })));
    this.paintBars();
  },
  paintBars() {
    const td = this.td, R = D.R, C = D.cells;
    let rows = Array.from(td.cells, (c, t) => ({ c, r: C.r[c], n: td.counts[t] }));
    rows.forEach(x => { x.s = x.n / R.pm[x.r]; });
    if (this.measure === 'share') rows = rows.filter(x => x.n >= 3).sort((a, b) => b.s - a.s || b.n - a.n);
    else rows.sort((a, b) => b.n - a.n || b.s - a.s);
    rows = rows.slice(0, this.top);
    const val = x => this.measure === 'share' ? x.s : x.n, mx = Math.max(1e-9, ...rows.map(val));
    $('#mSub').textContent = this.measure === 'share'
      ? 'Share of each researcher\'s PubMed-linked records that carry the term (researchers with at least 3 such articles)'
      : 'PubMed-linked articles carrying the term, per researcher';
    $('#mBars').innerHTML = rows.map((x, i) => { const k = C.cl[x.c]; return `<button type="button" class="hrow" data-r="${x.r}"><span class="rk">${i + 1}</span><span class="who"><b>${esc(R.name[x.r])}</b><span>${clusterDot(k)}${esc(clusterName(k))}</span></span><span class="track"><i data-w="${(100 * val(x) / mx).toFixed(1)}" style="background:var(--c${k})"></i></span><span class="v">${this.measure === 'share' ? pct(x.s, 0) : fmt(x.n)}</span></button>`; }).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#mBars .track i').forEach(i => { i.style.width = i.dataset.w + '%'; })));
    $$('#mBars .hrow').forEach(b => {
      const x = rows.find(q => q.r === +b.dataset.r);
      b.addEventListener('pointermove', e => showTip(`<b>${esc(R.name[x.r])}</b><br>${x.n} of ${fmt(R.pm[x.r])} PubMed-linked records carry this term (${pct(x.s, 0)})<br><span class="t-sub">Click for the full profile</span>`, e.clientX, e.clientY));
      b.addEventListener('pointerleave', hideTip);
      b.addEventListener('click', () => { hideTip(); go('researchers'); $('#rSearchInput').value = R.name[x.r]; Researchers.show(x.r); });
    });
  },
};
