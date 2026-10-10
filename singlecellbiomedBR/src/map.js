/* ============================================================ UMAP canvas */
class MapView {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = Object.assign({ interactive: true, labels: true, pointScale: 1, onSelect: null, onHover: null, mini: false }, opts);
    this.base = root.querySelector('canvas.base') || root.querySelector('canvas') || root.appendChild(document.createElement('canvas'));
    this.top = root.querySelector('canvas.top');
    this.C = D.cells;
    this.mode = 'cluster';
    this.focus = -1; this.hoverCl = -1;
    this.sel = -1; this.hover = -1;
    this.feature = null; this.featFocus = -1;
    this.showLabels = this.opts.labels;
    this.highlightCell = -1;
    this.view = { cx: 0, cy: 0, k: 1 };
    this.fade = null;
    this._raf = 0; this._loop = 0;
    this.w = 0; this.h = 0; this.dpr = 1;
    this._prepare();
    this.resize();
    this.fit(false);
    this._ro = new ResizeObserver(() => { const ow = this.w, oh = this.h; this.resize(); if (ow && (Math.abs(ow - this.w) > 1 || Math.abs(oh - this.h) > 1)) { this._refit(ow, oh); } });
    this._ro.observe(root);
    if (this.opts.interactive) this._bind();
  }
  _prepare() {
    const C = this.C, N = C.N, K = D.meta.clusters.length;
    const byCl = Array.from({ length: K }, () => []);
    for (let i = 0; i < N; i++) byCl[C.cl[i]].push(i);
    this.byCl = byCl.map(a => Uint32Array.from(a));
    this.clOrder = Array.from({ length: K }, (_, k) => k).sort((a, b) => this.byCl[b].length - this.byCl[a].length);
    // core bounds (quantiles, excludes the far island) and full bounds
    const xs = Float32Array.from(C.x).sort(), ys = Float32Array.from(C.y).sort();
    const q = (a, p) => a[Math.floor(p * (a.length - 1))];
    this.core = [q(xs, 0.001), q(xs, 0.997), q(ys, 0.002), q(ys, 0.998)];
    this.full = [xs[0], xs[N - 1], ys[0], ys[N - 1]];
    // spatial grid
    const G = 160, [x0, x1, y0, y1] = this.full, gx = G / (x1 - x0 || 1), gy = G / (y1 - y0 || 1);
    const cellIdx = new Uint32Array(N), cnt = new Uint32Array(G * G + 1);
    for (let i = 0; i < N; i++) { const a = clamp(((C.x[i] - x0) * gx) | 0, 0, G - 1), b = clamp(((C.y[i] - y0) * gy) | 0, 0, G - 1); cellIdx[i] = b * G + a; cnt[cellIdx[i] + 1]++; }
    for (let i = 0; i < G * G; i++) cnt[i + 1] += cnt[i];
    const items = new Uint32Array(N), fill = cnt.slice(0, G * G);
    for (let i = 0; i < N; i++) items[fill[cellIdx[i]]++] = i;
    this.grid = { G, x0, y0, gx, gy, start: cnt, items };
  }
  resize() {
    const r = this.root.getBoundingClientRect();
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.base, this.top]) { if (!c) continue; c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr); }
    this.render(true);
  }
  _refit(ow, oh) { const f = Math.min(this.w / ow, this.h / oh); this.view.k *= f; this.kFit *= f; this.render(true); }
  fitK(b) { const pad = this.opts.mini ? 0.9 : 0.86; return Math.min(this.w / (b[1] - b[0]), this.h / (b[3] - b[2])) * pad; }
  fit(animate = true) {
    const b = this.core, k = this.fitK(b);
    this.kFit = k;
    const tgt = { cx: (b[0] + b[1]) / 2, cy: (b[2] + b[3]) / 2, k };
    if (animate) this.flyTo(tgt); else { this.view = tgt; this.render(true); }
  }
  sx(x) { return this.w / 2 + (x - this.view.cx) * this.view.k; }
  sy(y) { return this.h / 2 - (y - this.view.cy) * this.view.k; }
  radius() {
    const base = this.opts.mini ? 0.85 : 1.15;
    const z = Math.sqrt(this.view.k / (this.kFit || this.view.k));
    return clamp(base * this.opts.pointScale * Math.pow(z, 0.8), 0.7, 5);
  }
  /* ---------- colouring */
  setClusters() { this._snap(); this.mode = 'cluster'; this.feature = null; this.featFocus = -1; this.render(true); }
  setFeature(f, keepFocus = false) { this._snap(); this.mode = 'feature'; this.feature = f; if (!keepFocus) this.featFocus = -1; this.render(true); }
  setFocus(k) { this._snap(); this.focus = k; this.render(true); }
  setHoverCluster(k) { if (this.hoverCl === k) return; this.hoverCl = k; this.render(true); }
  select(c, fly = true) {
    this.sel = c;
    if (c >= 0 && fly) {
      const k = Math.max(this.view.k, this.kFit * 2.6);
      this.flyTo({ cx: this.C.x[c], cy: this.C.y[c], k });
    }
    this._ensureLoop(); this.drawTop();
  }
  _snap() {
    if (reducedMotion() || !this.base.width) return;
    const p = this._prev || (this._prev = document.createElement('canvas'));
    p.width = this.base.width; p.height = this.base.height;
    p.getContext('2d').drawImage(this.base, 0, 0);
    this.fade = { t0: performance.now(), dur: 420 };
    this._ensureLoop();
  }
  /* ---------- drawing */
  render(now = false) {
    if (now) { this._draw(); return; }
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._draw(); });
  }
  _pts(ctx, idx, color, R, alpha = 1) {
    if (!idx.length) return;
    const { x, y } = this.C, k = this.view.k * this.dpr, W = this.base.width, H = this.base.height;
    const ox = W / 2 - this.view.cx * k, oy = H / 2 + this.view.cy * k, r = R * this.dpr, d = 2 * r;
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
    if (r < 1.7) {
      for (let t = 0; t < idx.length; t++) { const i = idx[t]; const px = ox + x[i] * k, py = oy - y[i] * k; if (px < -d || py < -d || px > W + d || py > H + d) continue; ctx.rect(px - r, py - r, d, d); }
    } else {
      for (let t = 0; t < idx.length; t++) { const i = idx[t]; const px = ox + x[i] * k, py = oy - y[i] * k; if (px < -d || py < -d || px > W + d || py > H + d) continue; ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU); }
    }
    ctx.fill();
  }
  _draw() {
    const ctx = this.base.getContext('2d'); if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.base.width, this.base.height);
    const R = this.radius();
    if (this.mode === 'feature' && this.feature) {
      const f = this.feature, ff = this.featFocus, cl = this.C.cl, keep = [];
      this._pts(ctx, f.zeroIdx, COL.zero, R * 0.92, ff >= 0 ? 0.55 : 1);
      for (let b = 0; b < f.bins.length; b++) {
        const col = COL.lut[Math.round(b / (f.bins.length - 1) * (COL.lut.length - 1))];
        if (ff >= 0) { const a = [], o = []; for (const i of f.bins[b]) (cl[i] === ff ? a : o).push(i); this._pts(ctx, o, col, R * 1.05, 0.14); keep.push([a, col]); }
        else this._pts(ctx, f.bins[b], col, R * 1.05, 1);
      }
      for (const [a, col] of keep) this._pts(ctx, a, col, R * 1.15, 1);
    } else {
      const foc = this.focus >= 0 ? this.focus : this.hoverCl;
      for (const k of this.clOrder) {
        if (foc >= 0 && k === foc) continue;
        this._pts(ctx, this.byCl[k], foc >= 0 ? COL.zero : COL.cluster[k], R, foc >= 0 ? 0.9 : 1);
      }
      if (foc >= 0) this._pts(ctx, this.byCl[foc], COL.cluster[foc], R * 1.1, 1);
    }
    if (this.highlightCell >= 0) {
      // static marker (mini maps)
      const c = this.highlightCell, px = this.sx(this.C.x[c]) * this.dpr, py = this.sy(this.C.y[c]) * this.dpr;
      ctx.globalAlpha = 1; ctx.lineWidth = 2 * this.dpr; ctx.strokeStyle = COL.ink;
      ctx.beginPath(); ctx.arc(px, py, 7 * this.dpr, 0, TAU); ctx.stroke();
      ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(px, py, 2.2 * this.dpr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.drawTop();
  }
  _labelLayout(ctx) {
    const cl = D.meta.clusters, placed = [], out = [];
    const fs = this.w < 520 ? 10.5 : 11.5;
    ctx.font = `600 ${fs}px ${getComputedStyle(document.body).getPropertyValue('--font-display') || 'sans-serif'}`;
    const order = cl.map(c => c.id).sort((a, b) => cl[b].n - cl[a].n);
    for (const k of order) {
      const c = cl[k], ax = this.sx(c.anchor[0]), ay = this.sy(c.anchor[1]);
      // At intermediate widths there is not enough room for 23 full labels.
      // Cluster names remain visible in the adjacent legend; IDs keep the map legible.
      const text = this.w < 900 ? String(k) : `${k}  ${c.label}`;
      const tw = ctx.measureText(text).width, th = fs + 4;
      if (ax < -20 || ay < -20 || ax > this.w + 20 || ay > this.h + 20) { if (this.view.k <= this.kFit * 1.25) out.push({ k, off: true, ax, ay, text: String(k) }); continue; }
      const cands = [[0, -th * 0.9], [0, th * 0.9], [0, -th * 1.9], [0, th * 1.9], [tw * 0.4, -th * 0.9], [-tw * 0.4, -th * 0.9], [0, -th * 3]];
      let ok = null;
      for (const [dx, dy] of cands) {
        let x = clamp(ax + dx - tw / 2, 4, this.w - tw - 4), y = clamp(ay + dy - th / 2, 4, this.h - th - 4);
        const box = [x - 3, y - 1, x + tw + 3, y + th + 1];
        if (!placed.some(p => !(box[2] < p[0] || box[0] > p[2] || box[3] < p[1] || box[1] > p[3]))) { ok = { x, y, box }; break; }
      }
      if (ok) { placed.push(ok.box); out.push({ k, x: ok.x, y: ok.y, w: tw, h: th, ax, ay, text, fs }); }
    }
    return out;
  }
  drawTop() {
    const c = this.top; if (!c) return;
    const ctx = c.getContext('2d'), dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    if (this.fade) {
      const t = (performance.now() - this.fade.t0) / this.fade.dur;
      if (t >= 1) this.fade = null; else { ctx.globalAlpha = 1 - easeIO(t); ctx.drawImage(this._prev, 0, 0); ctx.globalAlpha = 1; }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // labels
    if (this.showLabels) {
      const L = this._labelLayout(ctx), foc = this.focus;
      ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
      for (const l of L) {
        const dim = (foc >= 0 && l.k !== foc) || (this.mode === 'feature');
        if (l.off) {
          const x = clamp(l.ax, 16, this.w - 16), y = clamp(l.ay, 16, this.h - 16);
          ctx.globalAlpha = 0.95; ctx.fillStyle = COL.surface; ctx.strokeStyle = COL['rule-2']; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = COL.cluster[l.k]; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
          const ang = Math.atan2(l.ay - y, l.ax - x);
          ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.beginPath();
          ctx.moveTo(x + Math.cos(ang) * 15, y + Math.sin(ang) * 15); ctx.lineTo(x + Math.cos(ang + 0.5) * 11, y + Math.sin(ang + 0.5) * 11);
          ctx.moveTo(x + Math.cos(ang) * 15, y + Math.sin(ang) * 15); ctx.lineTo(x + Math.cos(ang - 0.5) * 11, y + Math.sin(ang - 0.5) * 11); ctx.stroke();
          continue;
        }
        ctx.globalAlpha = dim ? 0.5 : 1;
        ctx.strokeStyle = COL.halo; ctx.lineWidth = 4; ctx.strokeText(l.text, l.x, l.y + 1);
        ctx.fillStyle = COL.ink; ctx.fillText(l.text, l.x, l.y + 1);
      }
      ctx.globalAlpha = 1;
    }
    // hover ring
    if (this.hover >= 0) {
      const px = this.sx(this.C.x[this.hover]), py = this.sy(this.C.y[this.hover]);
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.stroke();
    }
    // selection
    if (this.sel >= 0) {
      const px = this.sx(this.C.x[this.sel]), py = this.sy(this.C.y[this.sel]);
      const t = ((performance.now() / 1600) % 1);
      if (!reducedMotion()) { ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 9 + t * 22, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = COL.surface; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.stroke();
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 9, 0, TAU); ctx.stroke();
      ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, TAU); ctx.fill();
      if (this.selLabel) {
        ctx.font = `650 12px ${getComputedStyle(document.body).getPropertyValue('--font-display') || 'sans-serif'}`;
        const tw = ctx.measureText(this.selLabel).width;
        let lx = px + 16, ly = py - 11;
        if (lx + tw + 14 > this.w) lx = px - 16 - tw - 12;
        ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly, tw + 12, 22, 5) : ctx.rect(lx, ly, tw + 12, 22); ctx.fill();
        ctx.fillStyle = COL.paper; ctx.textBaseline = 'middle'; ctx.fillText(this.selLabel, lx + 6, ly + 11.5);
      }
    }
  }
  _ensureLoop() {
    if (this._loop) return;
    const tick = () => {
      this._loop = 0;
      const vis = this.root.offsetParent !== null;
      if (!vis) return;
      this.drawTop();
      if (this.fade || (this.sel >= 0 && !reducedMotion())) this._loop = requestAnimationFrame(tick);
    };
    this._loop = requestAnimationFrame(tick);
  }
  flyTo(tgt, dur = 750) {
    if (reducedMotion()) { this.view = tgt; this.render(); return; }
    const from = { ...this.view }, t0 = performance.now();
    cancelAnimationFrame(this._fly);
    const step = now => {
      const t = clamp((now - t0) / dur, 0, 1), e = easeIO(t);
      this.view = { cx: from.cx + (tgt.cx - from.cx) * e, cy: from.cy + (tgt.cy - from.cy) * e, k: Math.exp(Math.log(from.k) + (Math.log(tgt.k) - Math.log(from.k)) * e) };
      this._draw();
      if (t < 1) this._fly = requestAnimationFrame(step);
    };
    this._fly = requestAnimationFrame(step);
  }
  zoomBy(f, sx = this.w / 2, sy = this.h / 2) {
    const v = this.view, k2 = clamp(v.k * f, this.kFit * 0.5, this.kFit * 60);
    const dx = (sx - this.w / 2), dy = (sy - this.h / 2);
    const px = v.cx + dx / v.k, py = v.cy - dy / v.k;
    this.view = { k: k2, cx: px - dx / k2, cy: py + dy / k2 };
    this.render();
  }
  nearest(sx, sy, maxPx = 10) {
    const g = this.grid, v = this.view, C = this.C;
    const x = v.cx + (sx - this.w / 2) / v.k, y = v.cy - (sy - this.h / 2) / v.k, rad = maxPx / v.k;
    const a0 = clamp(((x - rad - g.x0) * g.gx) | 0, 0, g.G - 1), a1 = clamp(((x + rad - g.x0) * g.gx) | 0, 0, g.G - 1);
    const b0 = clamp(((y - rad - g.y0) * g.gy) | 0, 0, g.G - 1), b1 = clamp(((y + rad - g.y0) * g.gy) | 0, 0, g.G - 1);
    let best = -1, bd = rad * rad;
    const foc = this.mode === 'cluster' ? this.focus : -1;
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
      const cell = b * g.G + a;
      for (let t = g.start[cell]; t < g.start[cell + 1]; t++) {
        const i = g.items[t];
        if (foc >= 0 && C.cl[i] !== foc) continue;
        const dx = C.x[i] - x, dy = C.y[i] - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }
  _bind() {
    const el = this.top ? this.root : this.base;
    const pts = new Map(); let drag = null, pinch = null, moved = 0, downT = 0;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.map-ui, .map-status, .map-ramp')) return;
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; downT = performance.now();
      if (pts.size === 1) drag = { x: e.clientX, y: e.clientY };
      if (pts.size === 2) { const [p1, p2] = [...pts.values()]; pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), k: this.view.k }; drag = null; }
      cancelAnimationFrame(this._fly);
    });
    el.addEventListener('pointermove', e => {
      const rect = this.root.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) {
        const [p1, p2] = [...pts.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mx = (p1.x + p2.x) / 2 - rect.left, my = (p1.y + p2.y) / 2 - rect.top;
        this.zoomBy((pinch.k * d / pinch.d) / this.view.k, mx, my); moved += 10; return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
        drag = { x: e.clientX, y: e.clientY };
        if (moved > 3) { this.view.cx -= dx / this.view.k; this.view.cy += dy / this.view.k; this.render(); hideTip(); this.root.style.cursor = 'grabbing'; }
        return;
      }
      if (e.pointerType === 'touch') return;
      const i = this.nearest(sx, sy, 9);
      if (i !== this.hover) { this.hover = i; this.drawTop(); }
      this.root.style.cursor = i >= 0 ? 'pointer' : 'grab';
      if (i >= 0 && this.opts.onHover) showTip(this.opts.onHover(i), e.clientX, e.clientY); else hideTip();
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        const rect = this.root.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        if (drag && moved <= 4 && performance.now() - downT < 600) {
          const i = this.nearest(sx, sy, e.pointerType === 'touch' ? 16 : 9);
          if (this.opts.onSelect) this.opts.onSelect(i);
        }
        drag = null; this.root.style.cursor = '';
      }
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (this.hover >= 0) { this.hover = -1; this.drawTop(); } hideTip(); });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = this.root.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      this.zoomBy(Math.exp(-dy * 0.0016), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
    el.addEventListener('dblclick', e => { const rect = this.root.getBoundingClientRect(); this.zoomBy(2, e.clientX - rect.left, e.clientY - rect.top); });
  }
}

/* feature binning for the map: values -> 24 colour bins, zero cells separate */
function buildFeature(td, scale) {
  const N = D.cells.N, NB = 24;
  const inTerm = new Uint8Array(N);
  for (const c of td.cells) inTerm[c] = 1;
  const zero = []; for (let i = 0; i < N; i++) if (!inTerm[i]) zero.push(i);
  const vals = scale === 'count' ? Array.from(td.counts, v => Math.log1p(v)) : Array.from(td.y);
  const sorted = Float64Array.from(vals).sort();
  const cap = sorted.length ? Math.max(sorted[Math.floor(0.99 * (sorted.length - 1))], 1e-6) : 1;
  const bins = Array.from({ length: NB }, () => []);
  for (let t = 0; t < td.cells.length; t++) bins[Math.min(NB - 1, Math.floor(clamp(vals[t] / cap, 0, 1) * (NB - 1) + 0.0001))].push(td.cells[t]);
  return { zeroIdx: Uint32Array.from(zero), bins: bins.map(b => Uint32Array.from(b)), cap, capLabel: scale === 'count' ? Math.expm1(cap) : cap, scale };
}
