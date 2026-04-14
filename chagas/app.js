/* =====================================================
   CHAGAS DISEASE WORLD DAY – MAIN APPLICATION JS
   ===================================================== */

(function () {
  'use strict';

  // ─── State ───
  let researchersData = [];
  let networkData = null;
  let currentPage = 0;
  const PAGE_SIZE = 20;
  let filteredData = [];
  let graphInstance = null;
  let searchMatchNode = null;
  let searchMatchNeighbors = new Set();
  let hoveredType = null;       // 'node' | 'link' | null
  let hideTooltipTimer = null;

  // ─── DOM refs ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Init ───
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    setupTabs();
    await loadResearcherData();
    hideLoading();
  }

  // ─── Loading ───
  function hideLoading() {
    const el = $('#loading');
    el.classList.add('hidden');
    setTimeout(() => el.remove(), 600);
  }

  // ─── Tabs ───
  function setupTabs() {
    $$('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        $$('.tab-content').forEach(c => c.classList.remove('active'));
        $(`#content-${target}`).classList.add('active');

        if (target === 'network' && !graphInstance) {
          loadNetworkData();
        }
      });
    });
  }

  // ─── Load Researcher Data ───
  async function loadResearcherData() {
    try {
      if (!window.RESEARCHERS_DATA) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'data/researchers_data.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }
      researchersData = window.RESEARCHERS_DATA;

      // Sort descending by total_publicacoes
      researchersData.sort((a, b) => b.total_publicacoes - a.total_publicacoes);
      filteredData = [...researchersData];

      updateStats();
      renderBarChart();
      setupSearch();
    } catch (err) {
      console.error('Failed to load researcher data:', err);
    }
  }

  // ─── Stats ───
  function updateStats() {
    animateCounter('stat-researchers', researchersData.length);
    animateCounter('stat-articles', 21782);
    animateCounter('stat-links', 64952);
  }

  function animateCounter(id, target) {
    const el = $(`#${id}`);
    const duration = 1800;
    const start = performance.now();
    const startVal = 0;

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(startVal + (target - startVal) * eased);
      el.textContent = current.toLocaleString('en-US');
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── Search ───
  function setupSearch() {
    const input = $('#search-researcher');
    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const query = input.value.trim().toLowerCase();
        if (query === '') {
          filteredData = [...researchersData];
        } else {
          filteredData = researchersData.filter(r =>
            r.Nome.toLowerCase().includes(query)
          );
        }
        currentPage = 0;
        renderBarChart();
      }, 250);
    });
  }

  // ─── Bar Chart ───
  function renderBarChart() {
    const container = $('#chart-wrapper');
    const svg = d3.select('#bar-chart');
    svg.selectAll('*').remove();

    const pageData = filteredData.slice(
      currentPage * PAGE_SIZE,
      (currentPage + 1) * PAGE_SIZE
    );

    if (pageData.length === 0) {
      svg.attr('width', 600).attr('height', 200);
      svg.append('text')
        .attr('x', 300)
        .attr('y', 100)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '14px')
        .attr('font-family', 'Inter, sans-serif')
        .text('No researchers found.');
      renderPagination();
      return;
    }

    const containerWidth = container.clientWidth || 800;
    const margin = { top: 20, right: 60, bottom: 40, left: 240 };
    const barHeight = 26;
    const gap = 12;
    const chartHeight = pageData.length * (barHeight + gap) + margin.top + margin.bottom;
    const chartWidth = containerWidth;
    const innerW = chartWidth - margin.left - margin.right;
    const innerH = chartHeight - margin.top - margin.bottom;

    svg.attr('width', chartWidth).attr('height', chartHeight);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const y = d3.scaleBand()
      .domain(pageData.map(d => d.Nome))
      .range([0, innerH])
      .padding(0.2);

    const maxVal = d3.max(pageData, d => d.total_publicacoes);
    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .range([0, innerW]);

    // Grid lines
    g.selectAll('.grid-line')
      .data(x.ticks(6))
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', d => x(d))
      .attr('x2', d => x(d))
      .attr('y1', 0)
      .attr('y2', innerH);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll('text')
      .attr('class', 'axis-label');
    
    // Y axis
    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('class', 'bar-label')
      .text(d => d.length > 32 ? d.substring(0, 32) + '…' : d);

    g.selectAll('.domain, .tick line').attr('stroke', 'rgba(255,255,255,0.08)');

    // Gradient def
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient')
      .attr('id', 'barGradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#009c3b');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#ffdf00');

    const gradHover = defs.append('linearGradient')
      .attr('id', 'barGradientHover')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    gradHover.append('stop').attr('offset', '0%').attr('stop-color', '#22c55e');
    gradHover.append('stop').attr('offset', '100%').attr('stop-color', '#fef08a');

    // Bars
    const bars = g.selectAll('.bar-rect')
      .data(pageData)
      .enter()
      .append('rect')
      .attr('class', 'bar-rect')
      .attr('x', 0)
      .attr('y', d => y(d.Nome))
      .attr('width', 0)
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', 'url(#barGradient)');

    // Animate bars
    bars.transition()
      .duration(800)
      .delay((d, i) => i * 30)
      .ease(d3.easeCubicOut)
      .attr('width', d => x(d.total_publicacoes));

    // Bar value labels
    g.selectAll('.bar-value')
      .data(pageData)
      .enter()
      .append('text')
      .attr('class', 'bar-value')
      .attr('x', d => x(d.total_publicacoes) + 8)
      .attr('y', d => y(d.Nome) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .text(d => d.total_publicacoes)
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((d, i) => i * 30 + 400)
      .attr('opacity', 1);

    // Tooltip interaction
    const tooltip = $('#bar-tooltip');

    bars.on('mouseenter', function (event, d) {
      d3.select(this).attr('fill', 'url(#barGradientHover)');
      const rank = researchersData.findIndex(r => r['ID-Lattes'] === d['ID-Lattes']) + 1;
      const lattesId = d['ID-Lattes'].replace(/^'/, '');
      tooltip.innerHTML = `
        <div class="tooltip-name">${d.Nome}</div>
        <div class="tooltip-row"><span class="tooltip-label">CV Lattes:</span><span class="tooltip-value" style="color:var(--accent-2);">http://lattes.cnpq.br/${lattesId}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Publications:</span><span class="tooltip-value">${d.total_publicacoes}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Most Recent:</span><span class="tooltip-value">${d.ano_recente}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Earliest:</span><span class="tooltip-value">${d.ano_antigo}</span></div>
        <div class="tooltip-row"><span class="tooltip-label">Rank:</span><span class="tooltip-value">#${rank} of ${researchersData.length.toLocaleString()}</span></div>
        <div style="text-align:center; margin-top:8px; font-size:0.75rem; color:var(--text-muted);">(Click the bar to open)</div>
      `;
      tooltip.classList.add('visible');
    })
    .on('mousemove', function (event) {
      const cardRect = document.querySelector('.chart-card').getBoundingClientRect();
      let left = event.clientX - cardRect.left + 16;
      let top = event.clientY - cardRect.top - 10;
      // Keep tooltip inside
      if (left + 250 > cardRect.width) left = left - 270;
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    })
    .on('mouseleave', function () {
      d3.select(this).attr('fill', 'url(#barGradient)');
      tooltip.classList.remove('visible');
    })
    .on('click', function (event, d) {
      const lattesId = d['ID-Lattes'].replace(/^'/, '');
      window.open(`http://lattes.cnpq.br/${lattesId}`, '_blank');
    });

    renderPagination();
  }

  // ─── Pagination ───
  function renderPagination() {
    const container = $('#pagination');
    container.innerHTML = '';
    const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
    if (totalPages <= 1) return;

    // Prev
    const prevBtn = createBtn('← Prev', currentPage === 0, () => {
      currentPage--;
      renderBarChart();
    });
    container.appendChild(prevBtn);

    // Page numbers
    const maxVisible = 7;
    let startPage = Math.max(0, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(0, endPage - maxVisible + 1);
    }

    if (startPage > 0) {
      container.appendChild(createPageBtn(0));
      if (startPage > 1) {
        const dots = document.createElement('span');
        dots.className = 'pagination-info';
        dots.textContent = '…';
        container.appendChild(dots);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      container.appendChild(createPageBtn(i));
    }

    if (endPage < totalPages - 1) {
      if (endPage < totalPages - 2) {
        const dots = document.createElement('span');
        dots.className = 'pagination-info';
        dots.textContent = '…';
        container.appendChild(dots);
      }
      container.appendChild(createPageBtn(totalPages - 1));
    }

    // Info
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `${filteredData.length.toLocaleString()} researchers`;
    container.appendChild(info);

    // Next
    const nextBtn = createBtn('Next →', currentPage >= totalPages - 1, () => {
      currentPage++;
      renderBarChart();
    });
    container.appendChild(nextBtn);
  }

  function createBtn(text, disabled, onClick) {
    const btn = document.createElement('button');
    btn.className = 'pagination-btn';
    btn.textContent = text;
    btn.disabled = disabled;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function createPageBtn(pageIndex) {
    const btn = document.createElement('button');
    btn.className = 'pagination-btn' + (pageIndex === currentPage ? ' active' : '');
    btn.textContent = pageIndex + 1;
    btn.addEventListener('click', () => {
      currentPage = pageIndex;
      renderBarChart();
    });
    return btn;
  }

  // ─── Network ───
  async function loadNetworkData() {
    try {
      const loadingDiv = document.createElement('div');
      loadingDiv.id = 'network-loading';
      loadingDiv.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(10,14,26,0.9);z-index:20;';
      loadingDiv.innerHTML = '<div class="loading-spinner"></div><div class="loading-text" style="margin-top:12px;">Loading co-authorship network…</div>';
      $('#network-container').appendChild(loadingDiv);

      if (!window.NETWORK_DATA) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'data/network_chagas.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }
      networkData = window.NETWORK_DATA;
      initNetwork(5); // default min pubs = 5

      // Filter slider
      $('#network-min-pubs').addEventListener('input', function () {
        const val = parseInt(this.value);
        $('#network-filter-value').textContent = `≥ ${val} publications`;
        initNetwork(val);
      });

      // Search
      let fullGraphData = null; // store full graph for restore

      $('#network-search-input').addEventListener('input', function () {
        const q = this.value.trim().toLowerCase();
        if (!graphInstance) return;

        // Save full graph on first search
        if (!fullGraphData) {
          fullGraphData = graphInstance.graphData();
        }
        
        if (!q) {
          // Restore full graph
          searchMatchNode = null;
          searchMatchNeighbors.clear();
          graphInstance.graphData(fullGraphData);
          graphInstance.nodeColor(node => getNodeColor(node.val));
          graphInstance.linkColor(() => 'rgba(0,156,59,0.12)');
          graphInstance.nodeVal(n => Math.sqrt(n.val) * 2);
          graphInstance.linkWidth(l => Math.min(l.weight * 0.5, 4));
          graphInstance.zoom(1, 500);
          return;
        }

        const allNodes = fullGraphData.nodes;
        const allLinks = fullGraphData.links;

        searchMatchNode = allNodes.find(n => n.name && typeof n.name === 'string' && n.name.toLowerCase() === q) || null;

        if (!searchMatchNode) {
          // Partial match: just highlight in full graph
          graphInstance.graphData(fullGraphData);
          graphInstance.nodeColor(node => {
            if (node.name && typeof node.name === 'string' && node.name.toLowerCase().includes(q)) return '#f59e0b';
            return 'rgba(255,255,255,0.06)';
          });
          graphInstance.linkColor(() => 'rgba(255,255,255,0.02)');
          return;
        }

        // Exact match: build subnetwork
        searchMatchNeighbors.clear();
        searchMatchNeighbors.add(searchMatchNode.id);

        const subLinks = allLinks.filter(l => {
          let sourceId = typeof l.source === 'object' ? l.source.id : l.source;
          let targetId = typeof l.target === 'object' ? l.target.id : l.target;
          if (sourceId === searchMatchNode.id) { searchMatchNeighbors.add(targetId); return true; }
          if (targetId === searchMatchNode.id) { searchMatchNeighbors.add(sourceId); return true; }
          return false;
        });

        const subNodes = allNodes.filter(n => searchMatchNeighbors.has(n.id));

        // Swap graph data to subnetwork only
        graphInstance.graphData({
          nodes: subNodes.map(n => ({...n})),
          links: subLinks.map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target,
            papers: l.papers,
            weight: l.weight
          }))
        });

        graphInstance.nodeColor(node => node.id === searchMatchNode.id ? '#f59e0b' : getNodeColor(node.val));
        graphInstance.linkColor(() => 'rgba(245,158,11,0.5)');
        graphInstance.nodeVal(n => Math.sqrt(n.val) * 2.5);
        graphInstance.linkWidth(l => Math.min(l.weight * 1.5, 6) + 1);

        // Zoom to fit after layout settles
        setTimeout(() => {
          if (searchMatchNode && searchMatchNode.x !== undefined) {
            graphInstance.centerAt(searchMatchNode.x, searchMatchNode.y, 800);
            graphInstance.zoom(3, 800);
          }
        }, 300);
      });

      // Remove loading
      const ld = $('#network-loading');
      if (ld) ld.remove();

    } catch (err) {
      console.error('Failed to load network data:', err);
    }
  }

  function getNodeColor(val) {
    if (val >= 50) return '#009c3b';
    if (val >= 20) return '#22c55e';
    if (val >= 10) return '#4ade80';
    if (val >= 5) return '#fef08a';
    return '#ffdf00';
  }

  function initNetwork(minPubs) {
    searchMatchNode = null;
    searchMatchNeighbors.clear();
    const searchInput = $('#network-search-input');
    if (searchInput) searchInput.value = '';

    const container = $('#network-graph');
    container.innerHTML = '';

    // Filter nodes by min publications
    const nodeMap = new Map();
    networkData.nodes.forEach(n => {
      if (n.val >= minPubs) nodeMap.set(n.id, true);
    });

    const filteredNodes = networkData.nodes.filter(n => nodeMap.has(n.id));
    const filteredLinks = networkData.links.filter(l =>
      nodeMap.has(l.source) && nodeMap.has(l.target)
    );

    // Aggregate links: group by source-target pair
    const linkMap = new Map();
    filteredLinks.forEach(l => {
      const key = [l.source, l.target].sort().join('|');
      if (!linkMap.has(key)) {
        linkMap.set(key, {
          source: l.source,
          target: l.target,
          papers: [],
          weight: 0
        });
      }
      const entry = linkMap.get(key);
      entry.papers.push({ title: l.paper, year: l.year });
      entry.weight++;
    });
    const aggregatedLinks = Array.from(linkMap.values());

    // Build name lookup
    const nameLookup = new Map();
    filteredNodes.forEach(n => nameLookup.set(n.id, n));

    // Update auto-complete datalist
    const dl = $('#network-datalist');
    if (dl) {
      dl.innerHTML = '';
      filteredNodes.forEach(n => {
        if (n.name) {
          const opt = document.createElement('option');
          opt.value = n.name;
          dl.appendChild(opt);
        }
      });
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    const tooltip = $('#network-tooltip');

    graphInstance = ForceGraph()(container)
      .graphData({ nodes: filteredNodes.map(n => ({...n})), links: aggregatedLinks.map(l => ({...l})) })
      .width(width)
      .height(height)
      .backgroundColor('transparent')
      .nodeRelSize(3)
      .nodeVal(n => Math.sqrt(n.val) * 2)
      .nodeColor(n => getNodeColor(n.val))
      .nodeLabel('')
      .linkColor(() => 'rgba(0,156,59,0.12)')
      .linkWidth(l => Math.min(l.weight * 0.5, 4))
      .linkHoverPrecision(8)
      .linkDirectionalParticles(0)
      .cooldownTicks(200)
      .d3AlphaDecay(0.03)
      .d3VelocityDecay(0.4)
      .onNodeHover(node => {
        container.style.cursor = node ? 'pointer' : 'default';
        if (node) {
          hoveredType = 'node';
          clearTimeout(hideTooltipTimer);
          const researcher = researchersData.find(r => r['ID-Lattes'] === node.id);
          const lattesId = node.id.replace(/^'/, '');
          tooltip.innerHTML = `
            <div class="tooltip-name">${node.name || 'Unknown'}</div>
            <div class="tooltip-row"><span class="tooltip-label">ID-Lattes:</span><span class="tooltip-value">${lattesId}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Publications:</span><span class="tooltip-value">${node.val}</span></div>
            ${researcher ? `<div class="tooltip-row"><span class="tooltip-label">Most Recent:</span><span class="tooltip-value">${researcher.ano_recente}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Earliest:</span><span class="tooltip-value">${researcher.ano_antigo}</span></div>` : ''}
          `;
          tooltip.classList.add('visible');
          positionTooltipFromGraph(tooltip);
        } else {
          // Delay hiding so onLinkHover can take over
          clearTimeout(hideTooltipTimer);
          hideTooltipTimer = setTimeout(() => {
            if (hoveredType === 'node') {
              hoveredType = null;
              tooltip.classList.remove('visible');
            }
          }, 100);
        }
      })
      .onLinkHover(link => {
        if (link) {
          hoveredType = 'link';
          clearTimeout(hideTooltipTimer);
          const sourceName = typeof link.source === 'object' ? link.source.name : nameLookup.get(link.source)?.name || link.source;
          const targetName = typeof link.target === 'object' ? link.target.name : nameLookup.get(link.target)?.name || link.target;
          const papersList = link.papers
            .sort((a, b) => b.year - a.year)
            .map(p => `<li><span class="edge-papers-year">${p.year}</span>${escapeHtml(p.title)}</li>`)
            .join('');
          tooltip.innerHTML = `
            <div class="tooltip-name" style="font-size:0.82rem;">${sourceName} ↔ ${targetName}</div>
            <div class="tooltip-row"><span class="tooltip-label">Shared papers:</span><span class="tooltip-value">${link.papers.length}</span></div>
            <ul class="edge-papers-list">${papersList}</ul>
          `;
          tooltip.classList.add('visible');
          positionTooltipFromGraph(tooltip);
        } else {
          // Delay hiding so onNodeHover can take over
          clearTimeout(hideTooltipTimer);
          hideTooltipTimer = setTimeout(() => {
            if (hoveredType === 'link') {
              hoveredType = null;
              tooltip.classList.remove('visible');
            }
          }, 100);
        }
      })
      .onBackgroundClick(() => {
        hoveredType = null;
        clearTimeout(hideTooltipTimer);
        tooltip.classList.remove('visible');
      });

    // Reposition tooltip on mouse move
    container.addEventListener('mousemove', (e) => {
      if (tooltip.classList.contains('visible')) {
        const rect = container.getBoundingClientRect();
        let left = e.clientX - rect.left + 16;
        let top = e.clientY - rect.top + 16;
        if (left + 350 > rect.width) left = e.clientX - rect.left - 350;
        if (top + 250 > rect.height) top = e.clientY - rect.top - 250;
        tooltip.style.left = Math.max(0, left) + 'px';
        tooltip.style.top = Math.max(0, top) + 'px';
      }
    });
  }

  function positionTooltipFromGraph(tooltip) {
    // Will be positioned by mousemove
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

})();
