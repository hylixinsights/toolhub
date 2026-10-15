/* ============================================================ boot + routing */
const TABS = ['about', 'explorer', 'researchers', 'clustering', 'mesh'];
const VIEWS = { about: About, explorer: Explorer, researchers: Researchers, clustering: Clustering, mesh: MeshTab };
let currentTab = null;
function go(tab) { if (location.hash.slice(1) !== tab) location.hash = tab; route(); }
function route() {
  const h = location.hash.slice(1), tab = TABS.includes(h) ? h : 'about';
  const changed = tab !== currentTab; currentTab = tab;
  $$('.view').forEach(v => { v.hidden = v.dataset.view !== tab; });
  $$('.tab').forEach(a => { if (a.dataset.tab === tab) { a.setAttribute('aria-current', 'page'); const nav = a.parentElement; if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 12, behavior: 'smooth' }); } else a.removeAttribute('aria-current'); });
  if (changed) { window.scrollTo(0, 0); hideTip(); }
  if (D.meta) { try { VIEWS[tab].enter(); } catch (e) { console.error(e); } }
}
window.addEventListener('hashchange', route);

async function boot() {
  if (location.protocol === 'file:') {
    $('main').insertAdjacentHTML('afterbegin', '<div class="wrap"><div class="excluded-box" style="margin-top:24px">Interactive data require a web connection. <a href="https://toolhub.hylix.app/sclattes/">Open scLattes online</a>, or serve this folder with a local HTTP server.</div></div>');
    return;
  }
  readColors();
  route();
  try {
    const [meta, cellsBuf, meshTxt] = await Promise.all([
      fetch('data/meta.json').then(r => { if (!r.ok) throw new Error('Could not load data/meta.json'); return r.json(); }),
      getBuf('data/cells.txt'), getText('data/mesh.txt'),
    ]);
    D.meta = meta; D.mesh = JSON.parse(meshTxt);
    D.cells = parseCells(cellsBuf, meta.totals.analyzed);
    D.meshIndexByName = new Map(D.mesh.names.map((n, j) => [n, j]));
    $$('[data-n]').forEach(el => { const v = meta.totals[el.dataset.n]; if (v != null) el.textContent = fmt(v); });
    $('#builtOn').textContent = `Data built ${meta.built}`;
    D.ready.R = getText('data/researchers.txt').then(txt => { D.R = parseResearchers(txt); linkCells(); return D.R; });
    D.ready.R.catch(e => console.error(e));
    route();
    // warm the name index when the browser is idle
    D.ready.R.then(() => (window.requestIdleCallback || setTimeout)(() => normNames()));
  } catch (e) {
    console.error(e);
    $('main').insertAdjacentHTML('afterbegin', `<div class="wrap"><div class="excluded-box" style="margin-top:24px">The data files could not be loaded (${esc(e.message)}). Reload the page to try again.</div></div>`);
  }
}
boot();
