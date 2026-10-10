/* ============================================================ ABOUT tab */
const About = {
  built: false,
  enter() { if (!this.built) { this.build(); this.built = true; } else if (this.hero) this.hero.render(true); },
  build() {
    const m = D.meta, T = m.totals;
    // funnel
    $('#funnel').innerHTML = [
      [T.researchers, 'PhD holders with journal articles in Lattes'],
      [T.withPubmed, 'with at least one PubMed-linked article'],
      [T.atLeast10, 'with 10 or more'],
      [T.analyzed, 'cells in the final map'],
      [m.clusters.length, 'clusters, or research areas'],
    ].map(([v, k]) => `<div><div class="v">${fmt(v)}</div><div class="k">${k}</div></div>`).join('');
    // hero map
    const hm = $('#heroMap');
    this.hero = new MapView(hm, { interactive: false, labels: false, mini: true, pointScale: 1.05 });
    hm.addEventListener('click', () => go('clustering'));
    onTheme(() => this.hero.render(true));

    const xt = {}; for (const r of m.crosstab) xt[`${r.english}${r.pubmed}`] = r.records;
    const nonEnglishPubmed = xt['01'] || 0;
    const nRecords = T.records, cum30 = m.pca.slice(0, 30).reduce((a, b) => a + b, 0), cum75 = m.pca.reduce((a, b) => a + b, 0);
    const sel = m.params.selected;
    const lowClusters = m.clusters.filter(c => c.confidence === 'Low');
    const moderateClusters = m.clusters.filter(c => c.confidence === 'Moderate');
    const commonTerms = T.meshCommon || [];
    const commonNote = commonTerms.length
      ? ` Terms at or above the 90% prevalence ceiling were also removed, including ${commonTerms.map(esc).join(', ')}.`
      : ' No term reached the 90% prevalence ceiling in this run.';
    const steps = [
      { id: 'lattes', t: 'The Lattes CVs', body: `
        <div class="prose"><p>The starting point is BaseD, a collection of Lattes CVs assembled by Prof. Jesus Mena-Chalco's group. Its journal-article table holds <strong>${fmt1(nRecords / 1e6, 2)} million article records</strong> from <strong>${fmt(T.researchers)}</strong> PhD holders. A record is one article as listed in one CV, so a paper with three Brazilian co-authors appears three times.</p>
        <p>The chart shows how many of those records were published each year, how many have an English title, and how many could be linked to PubMed. The PubMed-linked share rises from about 7% of records in the 1990s to roughly 23% from 2015 onward.</p></div>
        <figure class="fig chart" id="chYears"><div class="fig-title">Lattes article records per year</div><div class="fig-sub">Layers overlap: every PubMed-linked record is also counted in the grey total</div></figure>` },
      { id: 'english', t: 'Finding the English titles', body: `
        <div class="step-grid"><div class="prose"><p>PubMed titles are in English, so the first job was to find which Lattes titles are. Each title was cleaned (HTML entities, broken encodings, stray control characters) and reduced to a normalized key. Keys collapse spelling variants of the same article: about 6.26 million distinct title strings became 5.32 million keys.</p>
        <p>Language was decided by counting English function words against Portuguese, Spanish, French, Italian and German ones. Where neither side won by a factor of two, the <span class="code">lingua</span> detector broke the tie. <strong>2,262,353</strong> titles were classified as English; a hand-checked sample of 140 titles had no errors.</p></div>
        <div><div class="fig-title">How a title becomes a linkage key</div><div class="fig-sub">Accents, Greek letters, punctuation and case are normalized away</div>
        <div class="keys">
          <span class="from">Case-control study<br>CASE–CONTROL STUDY</span><span class="arrow">→</span><span class="to">CASECONTROLSTUDY</span>
          <span class="from">TNF-α · TNF-alpha · TNF-&amp;#945;</span><span class="arrow">→</span><span class="to">TNFALPHA</span>
          <span class="from">São Paulo · SÃ£o Paulo</span><span class="arrow">→</span><span class="to">SAOPAULO</span>
          <span class="from">Alzheimer’s · Alzheimer?s</span><span class="arrow">→</span><span class="to">ALZHEIMERS</span>
          <span class="from">Effect of <i>Bacillus cereus</i> on CO₂ ﬁlms</span><span class="arrow">→</span><span class="to">EFFECTOFBACILLUSCEREUSONCO2FILMS</span>
        </div></div></div>` },
      { id: 'pubmed', t: 'Linking titles to PubMed', body: `
        <div class="prose"><p>The English keys were matched exactly against PubMed titles normalized with the same rules. <strong>770,407 titles</strong>, 34% of the English set, found a PubMed record, which brought along its PMID, publication year and MeSH terms. MeSH (Medical Subject Headings) is the controlled vocabulary that NLM indexers attach to every MEDLINE article.</p>
        <p>Back at the level of CV records, ${fmt1(T.pubmedRecords / 1e6, 2)} million of the ${fmt1(nRecords / 1e6, 2)} million entries (${pct(T.pubmedRecords / nRecords)}) point to a PubMed article. ${nonEnglishPubmed ? `${fmt(nonEnglishPubmed)} records reached PubMed even though their Lattes title was not classified as English.` : 'Every Lattes record linked to PubMed was classified as having an English title.'}</p></div>
        <figure class="fig chart" id="chFlow"><div class="fig-title">Where the ${fmt1(nRecords / 1e6, 2)} million records go</div><div class="fig-sub">Record counts by title language and PubMed linkage</div></figure>` },
      { id: 'summary', t: 'One row per researcher', body: `
        <div class="prose"><p>Records were then summarized by Lattes ID: first and last publication year, first year with an English title, total records, English records and PubMed-linked records. <strong>${pct(m.pmBins[0].n / T.researchers, 0)} of researchers have no PubMed-linked article.</strong> Output is concentrated: the top 1% of researchers (${T.top1Cut} or more linked records each) account for ${pct(T.top1Share, 0)} of all PubMed-linked records, and the top 10% for ${pct(T.top10Share, 0)}.</p></div>
        <div class="step-grid">
          <figure class="fig chart" id="chBins"><div class="fig-title">Researchers by number of PubMed-linked records</div><div class="fig-sub">All ${fmt(T.researchers)} Lattes PhD holders with journal articles</div></figure>
          <figure class="fig chart" id="chFirst"><div class="fig-title">Year of the first PubMed-linked article</div><div class="fig-sub">${fmt(T.withPubmed)} researchers with at least one</div></figure>
        </div>` },
      { id: 'cells', t: 'Researchers as cells', body: `
        <div class="step-grid"><div class="prose"><p>For every researcher with at least 10 PubMed-linked records (${fmt(T.atLeast10)} people), we counted how many of their linked articles carry each MeSH term. A term repeated within one article counts once. The result has the shape of a single-cell count matrix: MeSH terms in rows, researchers in columns, and the Lattes ID as the cell barcode.</p>
        <p>That shape lets the standard scRNA-seq workflow run unchanged. The analogy is computational: MeSH terms describe articles, not people, and "expression" here means how often a researcher's articles were indexed with a term.</p></div>
        <div class="tbl-wrap"><table class="tbl analogy"><thead><tr><th>Single-cell RNA-seq</th><th>This analysis</th></tr></thead><tbody>
          <tr><td>Cell</td><td>Researcher</td></tr><tr><td>Cell barcode</td><td>16-digit Lattes ID</td></tr>
          <tr><td>Gene</td><td>MeSH descriptor</td></tr><tr><td>UMI count</td><td>Linked articles carrying the term</td></tr>
          <tr><td>Library size</td><td>Sum of a researcher's MeSH counts</td></tr><tr><td>Cell type</td><td>Research area (cluster)</td></tr>
          <tr><td>Marker gene</td><td>Marker MeSH term</td></tr></tbody></table></div></div>

        <figure class="concept-figure" aria-labelledby="conceptTitle">
          <div class="label">The idea</div><h3 class="h3" id="conceptTitle">A single-cell view of scientific activity</h3>
          <div class="concept-flow">
            <div class="concept-step">
              <svg viewBox="0 0 240 140" role="img" aria-label="Three researchers paired with cells of matching colours">
                <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="40" cy="28" r="11" fill="var(--accent-soft)"/><path d="M20 68v-8c0-20 40-20 40 0v8Z" fill="var(--accent-soft)"/>
                  <circle cx="120" cy="28" r="11" fill="var(--eosin-soft)"/><path d="M100 68v-8c0-20 40-20 40 0v8Z" fill="var(--eosin-soft)"/>
                  <circle cx="200" cy="28" r="11" fill="var(--sunken)"/><path d="M180 68v-8c0-20 40-20 40 0v8Z" fill="var(--sunken)"/>
                  <path d="M40 77v13m-4-4 4 4 4-4M120 77v13m-4-4 4 4 4-4M200 77v13m-4-4 4 4 4-4" opacity=".45"/>
                  <ellipse cx="40" cy="116" rx="23" ry="18" fill="var(--accent-soft)"/><ellipse cx="120" cy="116" rx="23" ry="18" fill="var(--eosin-soft)"/><ellipse cx="200" cy="116" rx="23" ry="18" fill="var(--sunken)"/>
                </g><g fill="var(--accent)"><circle cx="37" cy="113" r="6"/><circle cx="49" cy="120" r="2"/></g><g fill="var(--eosin)"><circle cx="118" cy="117" r="6"/><circle cx="131" cy="109" r="2"/></g><g fill="var(--ink-2)"><circle cx="200" cy="113" r="6"/><circle cx="189" cy="121" r="2"/></g>
              </svg>
              <h4>Researchers → cells</h4><p>Each researcher becomes one observation, identified by their Lattes ID.</p>
            </div>
            <div class="concept-step">
              <svg viewBox="0 0 240 140" role="img" aria-label="Article topic tags become features in a researcher-by-MeSH count matrix">
                <g fill="var(--surface)" stroke="currentColor" stroke-width="1.5"><rect x="7" y="10" width="64" height="33" rx="5"/><rect x="7" y="54" width="64" height="33" rx="5"/><rect x="7" y="98" width="64" height="33" rx="5"/></g>
                <g fill="currentColor" font-family="sans-serif" font-size="10" text-anchor="middle"><text x="39" y="31">MeSH A</text><text x="39" y="75">MeSH B</text><text x="39" y="119">MeSH C</text></g>
                <path d="M79 70h22m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2"/>
                <g fill="var(--accent-soft)"><rect x="111" y="10" width="34" height="33" rx="3"/><rect x="193" y="54" width="34" height="33" rx="3"/></g>
                <g fill="var(--eosin-soft)"><rect x="152" y="10" width="34" height="33" rx="3"/><rect x="152" y="98" width="34" height="33" rx="3"/></g>
                <g fill="var(--sunken)"><rect x="193" y="10" width="34" height="33" rx="3"/><rect x="111" y="54" width="34" height="33" rx="3"/><rect x="152" y="54" width="34" height="33" rx="3"/><rect x="111" y="98" width="34" height="33" rx="3"/><rect x="193" y="98" width="34" height="33" rx="3"/></g>
                <g fill="currentColor" font-family="monospace" font-size="14" text-anchor="middle"><text x="128" y="32">8</text><text x="169" y="32">3</text><text x="210" y="32">0</text><text x="128" y="76">0</text><text x="169" y="76">0</text><text x="210" y="76">6</text><text x="128" y="120">0</text><text x="169" y="120">5</text><text x="210" y="120">0</text></g>
              </svg>
              <h4>MeSH terms → genes</h4><p>Article counts become feature values: one topic profile for each researcher.</p>
            </div>
            <div class="concept-step">
              <svg viewBox="0 0 240 140" role="img" aria-label="Researchers with related topic profiles form groups on a schematic map">
                <path d="M16 10v118h212" fill="none" stroke="var(--rule-2)"/>
                <g fill="var(--accent)"><circle cx="55" cy="44" r="5"/><circle cx="68" cy="39" r="4"/><circle cx="77" cy="51" r="5"/><circle cx="60" cy="59" r="5"/><circle cx="44" cy="58" r="4"/><circle cx="83" cy="36" r="3"/><circle cx="73" cy="68" r="4"/><circle cx="93" cy="53" r="3"/></g>
                <g fill="var(--eosin)"><circle cx="153" cy="39" r="5"/><circle cx="168" cy="32" r="4"/><circle cx="179" cy="46" r="5"/><circle cx="158" cy="54" r="5"/><circle cx="193" cy="39" r="4"/><circle cx="181" cy="62" r="3"/><circle cx="147" cy="68" r="3"/></g>
                <g fill="var(--c5)"><circle cx="112" cy="90" r="5"/><circle cx="127" cy="84" r="4"/><circle cx="138" cy="99" r="5"/><circle cx="118" cy="107" r="5"/><circle cx="96" cy="103" r="4"/><circle cx="149" cy="85" r="3"/></g>
                <g fill="var(--muted)"><circle cx="106" cy="59" r="2"/><circle cx="124" cy="66" r="2"/><circle cx="98" cy="77" r="2"/></g>
              </svg>
              <h4>Profiles → research areas</h4><p>Cluster similar profiles and explore them on a UMAP, as in single-cell analysis.</p>
            </div>
          </div>
          <figcaption>Concept by <strong>Helder Nakaya</strong>, Computational Systems Biology Laboratory. Illustrative schematic; counts and positions above are not study data.</figcaption>
        </figure>
        <figure class="fig"><div class="fig-title">A real slice of the matrix</div><div class="fig-sub">12 MeSH terms × 12 researchers drawn from different clusters; blank cells are zeros</div><div class="mx" id="mx"></div>
        <figcaption>Columns are labelled by the last eight digits of the Lattes ID. Even this hand-picked slice is mostly empty; the full matrix is ${pct(T.nnz / (T.analyzed * T.meshRetained), 1)} non-zero.</figcaption></figure>` },
      { id: 'filter', t: 'Filtering the matrix', body: `
        <div class="step-grid"><div class="prose"><p>The raw matrix had ${fmt(T.atLeast10)} researchers and ${fmt(T.meshAll)} MeSH terms. A term was kept if it appeared in <strong>at least 100 researchers</strong> and in <strong>fewer than 90%</strong> of them. That removed ${fmt(T.meshRare)} rare terms.${commonNote}</p>
        <p>${fmt(T.zeroProfiles)} researchers had no counts left and were dropped. The analysed matrix has <strong>${fmt(T.analyzed)} researchers × ${fmt(T.meshRetained)} terms</strong> with ${fmt1(T.nnz / 1e6, 2)} million non-zero entries. The median researcher carries ${fmt(T.medianTermsPerResearcher)} distinct terms and ${fmt(T.medianPmAnalyzed)} PubMed-linked records.</p></div>
        <figure class="fig chart" id="chPrev"><div class="fig-title">How many researchers use each MeSH term</div><div class="fig-sub">All ${fmt(T.meshAll)} candidate terms, binned by number of researchers (bin lower bounds shown)</div></figure></div>` },
      { id: 'pca', t: 'Normalization and PCA', body: `
        <div class="step-grid"><div class="prose"><p>Each researcher's counts were scaled to a total of 10,000 and log-transformed with log1p, the same library-size normalization used for scRNA-seq. All ${fmt(T.meshRetained)} terms were used, with no highly-variable-term selection and no per-term scaling.</p>
        <p>Centered PCA (ARPACK, sparse input) computed 75 components. The first 30 explain ${pct(cum30)} of the variance and all 75 explain ${pct(cum75)}. Low values are typical for sparse count data, where most variance is noise in individual cells.</p></div>
        <figure class="fig chart" id="chPca"><div class="fig-title">Variance explained by each principal component</div><div class="fig-sub">The 30 components used for the final graph are highlighted</div></figure></div>` },
      { id: 'graph', t: 'Neighbours, Leiden and the parameter choice', body: `
        <div class="prose"><p>A k-nearest-neighbour graph with cosine distance was built in PCA space and clustered with the Leiden algorithm. Six combinations were compared: (30 PCs, 15 neighbours), (50, 20) and (75, 30), each at resolution 0.4 and 0.7. The rule picked the highest cosine silhouette, measured on one fixed sample of 4,000 researchers in the same 75-PC space, among runs where no more than 5% of researchers sat in clusters smaller than 50.</p>
        <p>The winner was <strong>${sel.pcs} PCs, ${sel.neighbors} neighbours, resolution ${sel.resolution}</strong>, giving ${sel.clusters} clusters with silhouette ${sel.silhouette_common_pca.toFixed(3)}. Silhouette values this low are common for continuous data; they rank settings and do not certify the clusters.</p></div>
        <div class="tbl-wrap" id="paramTbl"></div>` },
      { id: 'umap', t: 'The map', body: `
        <div class="prose"><p>UMAP placed the selected graph in two dimensions (min_dist 0.05, spread 1, 500 epochs, seed 42). The small min_dist packs similar researchers tightly, which makes groups easy to see. It also exaggerates gaps: distances between islands are not a calibrated measure of how different two fields are, and the clusters were found on the PCA graph, not on these coordinates.</p>
        <p><a href="#clustering">Open the interactive map</a> to colour it by any MeSH term or find a researcher.</p></div>` },
      { id: 'markers', t: 'Markers and labels', body: `
        <div class="prose"><p>Marker terms were found with one-versus-rest Wilcoxon tests on normalized values for all ${fmt(T.meshRetained)} terms, with Benjamini–Hochberg correction within each cluster. The shortlist keeps terms with a positive log2 fold change, adjusted p &lt; 0.05, presence in at least 10% of the cluster and at least 5 percentage points more than in other researchers, up to 100 per cluster: ${fmt(T.markerShortlist)} terms in all.</p>
        <p>Each cluster was named by reading its top markers. ${lowClusters.length ? `${lowClusters.map(c => `Cluster ${c.id} (${esc(c.label)})`).join(' and ')} ${lowClusters.length === 1 ? 'has a heterogeneous profile and is labeled low confidence.' : 'have heterogeneous profiles and are labeled low confidence.'}` : 'No cluster received a low-confidence label.'} ${moderateClusters.length ? `Moderate-confidence labels are used for clusters ${moderateClusters.map(c => `${c.id} (${esc(c.label)})`).join(' and ')}; their marker profiles span related but distinct themes.` : ''}</p></div>
        <div>
          <figure class="fig chart" id="chDendro" style="max-width:760px"><div class="fig-title">How the ${m.clusters.length} clusters relate</div><div class="fig-sub">Average-linkage tree of cluster mean MeSH profiles (cosine distance); colour families on the map follow its six main branches</div></figure>
          <div class="tbl-wrap" id="clTbl"></div>
        </div>` },
      { id: 'care', t: 'Reading the results', body: `
        <ul class="caveats">
          <li>Counts are CV records, not unique papers. An article listed twice in one CV counts twice, and articles shared by co-authors appear in each of their CVs.</li>
          <li>Linkage is by exact normalized title. Articles whose Lattes title differs from the PubMed title, or that are listed with a Portuguese title, are missed, so PubMed counts are lower bounds.</li>
          <li>Only researchers with at least 10 PubMed-linked records are in the map. Researchers outside biomedicine are under-represented because their journals are rarely indexed in MEDLINE.</li>
          <li>MeSH terms are assigned to articles. A researcher's profile reflects the indexing of their co-authored papers, including topics they contributed little to.</li>
          <li>Clusters and labels describe groups. Individual researchers can sit between areas, and cluster labels are curated summaries of marker terms, not classifications of people.</li>
          <li>Wilcoxon p-values are exploratory: the clusters were defined from the same data, and co-authored papers make researchers non-independent.</li>
        </ul>` },
    ];
    $('#steps').innerHTML = steps.map((s, i) => `<section class="step" id="step-${s.id}"><div class="step-head"><span class="step-no">${String(i + 1).padStart(2, '0')}</span><h2>${s.t}</h2></div>${s.body}</section>`).join('');
    $('#toc').innerHTML = steps.map(s => `<li><a href="#about" data-step="${s.id}">${s.t}</a></li>`).join('');
    $('#toc').addEventListener('click', e => { const a = e.target.closest('a[data-step]'); if (!a) return; e.preventDefault(); $('#step-' + a.dataset.step).scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); });
    $$('#steps a[href="#clustering"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go('clustering'); }));
    const io = new IntersectionObserver(ents => {
      for (const en of ents) if (en.isIntersecting) { const id = en.target.id.replace('step-', ''); $$('#toc a').forEach(a => a.classList.toggle('on', a.dataset.step === id)); }
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.step').forEach(s => io.observe(s));

    this.drawAll();
    $('#mx').innerHTML = this.matrixHtml();
    $('#paramTbl').innerHTML = this.paramHtml();
    $('#clTbl').innerHTML = this.clusterTableHtml();
    onResize($('#steps'), () => this.drawAll());
    onTheme(() => { $('#mx').innerHTML = this.matrixHtml(); });
  },
  drawAll() {
    const m = D.meta;
    yearsChart($('#chYears'), m.years.filter(r => r.y >= 1960 && r.y <= 2025), { keys: [['t', 'All records', 'var(--rule-2)'], ['e', 'English title', 'color-mix(in srgb, var(--accent) 38%, var(--rule-2))'], ['p', 'Linked to PubMed', 'var(--accent)']], height: 250 });
    flowChart($('#chFlow'), m.crosstab);
    const bins = m.pmBins.map(b => ({ label: b.hi === null ? `${b.lo}+` : b.lo === b.hi ? String(b.lo) : `${b.lo}–${b.hi}`, v: b.n }));
    hbarChart($('#chBins'), bins, { total: m.totals.researchers, colorFn: (d, i) => i === 0 ? 'var(--muted)' : 'var(--accent)' });
    const fy = Object.entries(m.firstPmYear).map(([y, n]) => ({ x: +y, v: n })).filter(d => d.x >= 1970 && d.x <= 2026);
    vbarChart($('#chFirst'), fy, { height: 200, xTickEvery: 10, color: () => 'var(--accent)', tip: d => `<b>${d.x}</b><br>${fmt(d.v)} researchers${d.x === 2026 ? ' (year in progress)' : ''}`, yLabel: 'researchers' });
    const ph = m.prevalenceHist.map(b => ({ x: b.lo, label: shortNum(b.lo), range: b.lo === b.hi ? fmt(b.lo) : `${fmt(b.lo)}–${fmt(b.hi)}`, v: b.n, kept: b.lo >= 100 }));
    vbarChart($('#chPrev'), ph, { height: 220, labels: true, flat: true, color: d => d.kept ? 'var(--accent)' : 'var(--rule-2)', tip: d => `<b>${d.range} researchers</b><br>${fmt(d.v)} terms · ${d.kept ? 'kept' : 'removed by the prevalence filter'}`, cut: { at: 6, label: '≥ 100 researchers kept' }, legend: [['Kept', 'var(--accent)'], ['Removed', 'var(--rule-2)']], yLabel: 'MeSH terms' });
    const pc = m.pca.map((v, i) => ({ x: i + 1, v: v * 100 }));
    vbarChart($('#chPca'), pc, { height: 200, xTickEvery: 10, xTicksAt: [1, 10, 20, 30, 40, 50, 60, 70, 75], color: d => d.x <= 30 ? 'var(--accent)' : 'var(--rule-2)', tip: d => `<b>PC${d.x}</b><br>${d.v.toFixed(2)}% of variance`, yFmt: v => v + '%', yLabel: '% variance' });
    dendroChart($('#chDendro'), m.dendrogram, m.clusters);
  },
  matrixHtml() {
    const s = D.meta.matrixSnippet, max = Math.max(...s.counts.flat());
    const head = `<tr><th></th>${s.barcodes.map((b, i) => `<th><div class="bc" title="Lattes ID ${b} · cluster ${s.clusters[i]}">${b.slice(-8)}</div><span class="dot" style="background:var(--c${s.clusters[i]});margin-top:4px"></span></th>`).join('')}</tr>`;
    const rows = s.terms.map((t, ti) => `<tr><th class="term">${esc(t)}</th>${s.counts[ti].map(v => v ? `<td style="background:color-mix(in srgb, var(--eosin) ${Math.round(18 + 70 * Math.log1p(v) / Math.log1p(max))}%, var(--surface));color:${Math.log1p(v) / Math.log1p(max) > 0.55 ? 'var(--paper)' : 'var(--ink)'}">${v}</td>` : '<td class="z">0</td>').join('')}</tr>`).join('');
    return `<table>${head}${rows}</table>`;
  },
  paramHtml() {
    const rows = D.meta.paramComparison, mx = Math.max(...rows.map(r => r.silhouette_common_pca));
    return `<table class="tbl"><thead><tr><th>PCs</th><th>Neighbours</th><th>Resolution</th><th class="r">Clusters</th><th class="r">Smallest</th><th class="r">In clusters &lt;50</th><th>Silhouette</th></tr></thead><tbody>${rows.map(r => {
      const s = r.selected === true || r.selected === 'True';
      return `<tr class="${s ? 'sel' : ''}"><td class="num">${r.pcs}</td><td class="num">${r.neighbors}</td><td class="num">${r.resolution}</td><td class="r num">${r.clusters}</td><td class="r num">${r.minimum_cluster_size}</td><td class="r num">${pct(r.small_cluster_author_fraction, 2)}</td><td><span style="display:inline-flex;align-items:center;gap:8px"><i style="display:inline-block;height:8px;width:${Math.round(90 * r.silhouette_common_pca / mx)}px;background:${s ? 'var(--accent)' : 'var(--rule-2)'};border-radius:0 2px 2px 0"></i><span class="mono">${r.silhouette_common_pca.toFixed(3)}</span>${s ? ' <b style="font-size:12px">selected</b>' : ''}</span></td></tr>`;
    }).join('')}</tbody></table>`;
  },
  clusterTableHtml() {
    const cl = D.meta.clusters, mx = Math.max(...cl.map(c => c.n));
    return `<table class="tbl" style="min-width:640px"><thead><tr><th>Cluster</th><th class="r">Researchers</th><th class="r">Median PubMed</th><th>Top markers</th></tr></thead><tbody>${cl.map(c => `<tr><td><span style="display:inline-flex;gap:7px;align-items:baseline"><span class="dot" style="background:var(--c${c.id})"></span><span><span class="mono" style="color:var(--muted)">${c.id}</span> ${esc(c.label)}${c.confidence !== 'High' ? ` <span style="color:var(--muted);font-size:11px">(${c.confidence.toLowerCase()} confidence)</span>` : ''}</span></span></td><td class="r num">${fmt(c.n)}</td><td class="r num">${c.medianPm}</td><td style="color:var(--ink-2);font-size:12px">${c.markers.slice(0, 5).map(x => esc(x.t)).join(' · ')}</td></tr>`).join('')}</tbody></table>`;
  },
};

/* ------------------------------------------------------------ chart primitives */
function chartBox(fig) {
  let box = fig.querySelector('.cbox');
  if (!box) { box = document.createElement('div'); box.className = 'cbox'; fig.appendChild(box); }
  box.innerHTML = ''; return box;
}
function yearsChart(fig, rows, { keys, height = 240 }) {
  const box = chartBox(fig);
  const leg = document.createElement('div'); leg.className = 'legend';
  leg.innerHTML = keys.map(([, l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('');
  box.appendChild(leg);
  const W = Math.max(280, box.clientWidth || fig.clientWidth), H = height, m = { l: 46, r: 10, t: 8, b: 24 };
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Article records per year' }, box);
  const x0 = rows[0].y, x1 = rows[rows.length - 1].y, ymax = Math.max(...rows.map(r => r.t));
  const ticks = niceTicks(ymax, 4), yTop = ticks[ticks.length - 1];
  const X = y => m.l + (y - x0) / (x1 - x0) * (W - m.l - m.r), Y = v => H - m.b - v / yTop * (H - m.t - m.b);
  for (const t of ticks) {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), style: `stroke:var(--rule);stroke-width:1` }, svg);
    const tx = svgEl('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px' }, svg); tx.textContent = shortNum(t);
  }
  for (let y = Math.ceil(x0 / 10) * 10; y <= x1; y += 10) { const tx = svgEl('text', { x: X(y), y: H - 6, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11px' }, svg); tx.textContent = y; }
  for (const [k, , c] of keys) {
    let d = `M${X(x0)},${Y(0)}`; for (const r of rows) d += `L${X(r.y).toFixed(1)},${Y(r[k]).toFixed(1)}`; d += `L${X(x1)},${Y(0)}Z`;
    svgEl('path', { d, style: `fill:${c};stroke:none` }, svg);
  }
  svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), style: 'stroke:var(--ink-2);stroke-width:1' }, svg);
  const cross = svgEl('line', { y1: m.t, y2: H - m.b, style: 'stroke:var(--ink);stroke-width:1;opacity:0' }, svg);
  const hit = svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, style: 'fill:transparent' }, svg);
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
    const y = clamp(Math.round(x0 + (px - m.l) / (W - m.l - m.r) * (x1 - x0)), x0, x1), row = rows.find(q => q.y === y);
    if (!row) return;
    cross.setAttribute('x1', X(y)); cross.setAttribute('x2', X(y)); cross.style.opacity = 0.5;
    showTip(`<b>${y}</b><br>${fmt(row.t)} records<br>${fmt(row.e)} with English title<br>${fmt(row.p)} linked to PubMed (${pct(row.p / row.t)})`, e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', () => { cross.style.opacity = 0; hideTip(); });
}
function hbarChart(fig, data, { total, colorFn }) {
  const box = chartBox(fig), mx = Math.max(...data.map(d => d.v));
  box.innerHTML = `<div style="display:grid;gap:4px;margin-top:4px">${data.map((d, i) => `<div style="display:grid;grid-template-columns:62px minmax(0,1fr) 92px;gap:10px;align-items:center;font-size:12px" data-i="${i}" class="hb"><span class="num" style="color:var(--ink-2)">${d.label}</span><span style="height:14px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(0.4, 100 * d.v / mx)}%;background:${colorFn(d, i)};border-radius:0 3px 3px 0"></i></span><span class="num" style="text-align:right"><b style="font-weight:600">${fmt(d.v)}</b> <span style="color:var(--muted)">${pct(d.v / total)}</span></span></div>`).join('')}</div><div class="note" style="margin-top:8px">PubMed-linked records per researcher</div>`;
}
function vbarChart(fig, data, { height = 200, color, tip: tipFn, xTickEvery, xTicksAt, labels = false, flat = false, cut, legend, yFmt = shortNum, yLabel }) {
  const box = chartBox(fig);
  if (legend) { const l = document.createElement('div'); l.className = 'legend'; l.innerHTML = legend.map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join(''); box.appendChild(l); }
  const W = Math.max(260, box.clientWidth || fig.clientWidth), H = height, m = { l: 42, r: 6, t: 10, b: labels && !flat ? 40 : 22 };
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': fig.querySelector('.fig-title')?.textContent || 'chart' }, box);
  const ymax = Math.max(...data.map(d => d.v)), ticks = niceTicks(ymax, 4), yTop = ticks[ticks.length - 1];
  const n = data.length, bw = (W - m.l - m.r) / n, gap = Math.min(2, bw * 0.18);
  const Y = v => H - m.b - v / yTop * (H - m.t - m.b);
  for (const t of ticks) {
    svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), style: 'stroke:var(--rule);stroke-width:1' }, svg);
    const tx = svgEl('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px' }, svg); tx.textContent = yFmt(t);
  }
  data.forEach((d, i) => {
    const x = m.l + i * bw + gap / 2, y = Y(d.v), h = H - m.b - y;
    const r = svgEl('rect', { x, y, width: Math.max(0.6, bw - gap), height: Math.max(0, h), rx: Math.min(2, bw / 4), style: `fill:${color(d, i)}` }, svg);
    const hit = svgEl('rect', { x: m.l + i * bw, y: m.t, width: bw, height: H - m.t - m.b, style: 'fill:transparent' }, svg);
    if (tipFn) { hit.addEventListener('pointermove', e => { showTip(tipFn(d), e.clientX, e.clientY); r.style.opacity = 0.75; }); hit.addEventListener('pointerleave', () => { hideTip(); r.style.opacity = 1; }); }
    const showX = labels || (xTicksAt ? xTicksAt.includes(d.x) : xTickEvery && d.x % xTickEvery === 0);
    if (showX) {
      const rot = labels && !flat, tx = svgEl('text', { x: flat ? m.l + i * bw : m.l + i * bw + bw / 2, y: H - m.b + 14, 'text-anchor': rot ? 'end' : flat ? 'start' : 'middle', style: 'fill:var(--muted);font-size:10.5px', transform: rot ? `rotate(-35 ${m.l + i * bw + bw / 2} ${H - m.b + 14})` : '' }, svg);
      tx.textContent = labels ? d.label : d.x;
    }
  });
  svgEl('line', { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), style: 'stroke:var(--ink-2);stroke-width:1' }, svg);
  if (cut) {
    const x = m.l + cut.at * bw;
    svgEl('line', { x1: x, x2: x, y1: m.t - 4, y2: H - m.b, style: 'stroke:var(--eosin);stroke-width:1.5;stroke-dasharray:3 3' }, svg);
    const tx = svgEl('text', { x: x + 5, y: m.t + 8, style: 'fill:var(--eosin);font-size:11px;font-weight:600' }, svg); tx.textContent = cut.label;
  }
  if (yLabel) { const tx = svgEl('text', { x: 2, y: m.t - 0, style: 'fill:var(--muted);font-size:10.5px' }, svg); tx.textContent = ''; }
}
function flowChart(fig, crosstab) {
  const box = chartBox(fig);
  const g = {}; for (const r of crosstab) g[`${r.english}${r.pubmed}`] = r.records;
  const E = g['10'] + g['11'], O = g['00'] + g['01'], P = g['11'] + g['01'], NP = g['10'] + g['00'], T = E + O;
  const W = Math.max(300, box.clientWidth || fig.clientWidth), narrow = W < 560, H = narrow ? 300 : 280;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Flow of records by language and PubMed linkage' }, box);
  const nodeW = 12, padT = 18, padB = 22, gapN = 26, colX = [0, W * 0.42, W - nodeW - (narrow ? 0 : 150)];
  const avail = H - padT - padB - gapN, s = avail / T;
  const col0 = [{ k: 'all', v: T, y: padT + gapN / 2 }];
  const col1 = [{ k: 'E', v: E, y: padT }, { k: 'O', v: O, y: padT + E * s + gapN }];
  const col2 = [{ k: 'P', v: P, y: padT }, { k: 'NP', v: NP, y: padT + P * s + gapN }];
  const colors = { all: 'var(--ink-2)', E: 'var(--accent)', O: 'var(--muted)', P: 'var(--eosin)', NP: 'var(--rule-2)' };
  const link = (x0, y0, x1, y1, v, c, label) => {
    const h = v * s, mx = (x0 + x1) / 2;
    const p = svgEl('path', { d: `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}L${x1},${y1 + h}C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h}Z`, style: `fill:${c};opacity:0.28` }, svg);
    p.addEventListener('pointermove', e => { p.style.opacity = 0.45; showTip(label, e.clientX, e.clientY); });
    p.addEventListener('pointerleave', () => { p.style.opacity = 0.28; hideTip(); });
  };
  // links col0 -> col1
  link(colX[0] + nodeW, col0[0].y, colX[1], col1[0].y, E, colors.E, `<b>English title</b><br>${fmt(E)} records (${pct(E / T)})`);
  link(colX[0] + nodeW, col0[0].y + E * s, colX[1], col1[1].y, O, colors.O, `<b>Other language or undetermined</b><br>${fmt(O)} records (${pct(O / T)})`);
  // col1 -> col2 (order inside nodes: E->P, E->NP ; O->P, O->NP)
  link(colX[1] + nodeW, col1[0].y, colX[2], col2[0].y, g['11'], colors.P, `<b>English → PubMed</b><br>${fmt(g['11'])} records`);
  link(colX[1] + nodeW, col1[0].y + g['11'] * s, colX[2], col2[1].y, g['10'], colors.NP, `<b>English → not linked</b><br>${fmt(g['10'])} records`);
  link(colX[1] + nodeW, col1[1].y, colX[2], col2[0].y + g['11'] * s, g['01'], colors.P, `<b>Other → PubMed</b><br>${fmt(g['01'])} records`);
  link(colX[1] + nodeW, col1[1].y + g['01'] * s, colX[2], col2[1].y + g['01'] * s, g['00'], colors.NP, `<b>Other → not linked</b><br>${fmt(g['00'])} records`);
  const node = (x, n, label, anchor = 'start') => {
    svgEl('rect', { x, y: n.y, width: nodeW, height: Math.max(2, n.v * s), rx: 2, style: `fill:${colors[n.k]}` }, svg);
    const tx = svgEl('text', { x: anchor === 'end' ? x - 6 : x + nodeW + 6, y: n.y + 13, 'text-anchor': anchor, style: 'fill:var(--ink);font-size:12px;font-weight:600' }, svg);
    tx.textContent = label;
    const t2 = svgEl('text', { x: anchor === 'end' ? x - 6 : x + nodeW + 6, y: n.y + 28, 'text-anchor': anchor, style: 'fill:var(--ink-2);font-size:11.5px' }, svg);
    t2.textContent = `${fmt1(n.v / 1e6, 2)} M · ${pct(n.v / T, 0)}`;
  };
  node(colX[0], col0[0], 'All records');
  node(colX[1], col1[0], 'English title');
  node(colX[1], col1[1], 'Other / undetermined');
  node(colX[2], col2[0], 'In PubMed', narrow ? 'end' : 'start');
  node(colX[2], col2[1], 'Not linked', narrow ? 'end' : 'start');
}
function dendroChart(fig, dg, clusters) {
  const box = chartBox(fig);
  const W = Math.max(300, box.clientWidth || fig.clientWidth), rowH = 19, n = dg.leaves.length, H = n * rowH + 26;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Dendrogram of clusters' }, box);
  const labW = Math.min(230, W * 0.58), x0 = labW + 8, x1 = W - 8;
  const maxH = Math.max(...dg.Z.map(z => z[2]));
  const X = d => x0 + d / maxH * (x1 - x0);
  const pos = {}; dg.leaves.forEach((k, i) => { pos[k] = { y: 8 + i * rowH + rowH / 2, x: x0, fam: dg.family[k] }; });
  dg.Z.forEach((z, i) => {
    const a = pos[z[0]], b = pos[z[1]], id = n + i, x = X(z[2]);
    const same = a.fam && a.fam === b.fam;
    const col = same ? 'var(--ink-2)' : 'var(--rule-2)';
    svgEl('path', { d: `M${a.x},${a.y}H${x}V${b.y}H${b.x}`, style: `fill:none;stroke:${col};stroke-width:1.2` }, svg);
    pos[id] = { x, y: (a.y + b.y) / 2, fam: same ? a.fam : 0 };
  });
  dg.leaves.forEach((k, i) => {
    const y = pos[k].y;
    svgEl('circle', { cx: labW - 4, cy: y, r: 4, style: `fill:var(--c${k})` }, svg);
    const tx = svgEl('text', { x: labW - 14, y: y + 4, 'text-anchor': 'end', style: 'fill:var(--ink);font-size:11.5px' }, svg);
    const lab = `${clusters[k].label}`; tx.textContent = lab.length > 34 && W < 520 ? lab.slice(0, 32) + '…' : lab;
    const id = svgEl('text', { x: 0, y: y + 4, style: 'fill:var(--muted);font-size:10px;font-family:var(--font-data)' }, svg); id.textContent = k;
  });
  const ax = svgEl('text', { x: x1, y: H - 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:10.5px' }, svg); ax.textContent = 'cosine distance →';
}
