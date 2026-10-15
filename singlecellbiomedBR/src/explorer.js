/* Descriptive source-data exploration, independent of the MeSH/UMAP analysis. */
const Explorer = {
  built: false, selected: -1, min: 100, log: true, points: [],
  async enter() {
    if (!this.built) { this.build(); this.built = true; }
    try { await D.ready.R; this.paint(); }
    catch (e) { $('#exStatus').textContent = 'Researcher data could not be loaded. Reload to try again.'; }
  },
  build() {
    combobox({root: $('#exSearch'), pending: () => D.R ? null : 'Loading researcher names…',
      search: q => searchResearchers(q, {limit: 12}),
      render: r => ({html: `<span class="opt-main">${esc(D.R.name[r])}</span><span class="opt-val">${fmt(D.R.pm[r])} records</span>`}),
      onPick: (r, input) => { input.value = D.R.name[r]; this.choose(r); },
      emptyText: 'No researcher with a PubMed-linked record matches that name'});
    $('#exMin').addEventListener('change', e => { this.min = +e.target.value; this.paint(); });
    $('#exScale').addEventListener('change', e => { this.log = e.target.value === 'log'; this.paint(); });
    $('#exClear').addEventListener('click', () => { this.selected = -1; $('#exSearchInput').value = ''; this.paint(); });
    $('#exProfile').addEventListener('click', () => { if (this.selected >= 0) { go('researchers'); $('#rSearchInput').value = D.R.name[this.selected]; Researchers.show(this.selected); } });
    const canvas = $('#exCanvas');
    const nearest = e => {
      const b = canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      let hit = null, dist = 100;
      for (const p of this.points) { const d = (p.x-x)**2+(p.y-y)**2; if (d < dist) { dist=d; hit=p; } }
      return hit;
    };
    canvas.addEventListener('pointermove', e => { const p=nearest(e); canvas.style.cursor=p?'pointer':'default'; if(p) showTip(`<b>${esc(D.R.name[p.r])}</b><br>First English publication: ${D.R.fe[p.r]}<br>${fmt(D.R.pm[p.r])} PubMed-linked records`,e.clientX,e.clientY); else hideTip(); });
    canvas.addEventListener('pointerleave', hideTip);
    canvas.addEventListener('click', e => { const p=nearest(e); if(p) { $('#exSearchInput').value=D.R.name[p.r]; this.choose(p.r); } });
    this.ro = new ResizeObserver(() => { if(D.R && canvas.clientWidth) this.paint(); }); this.ro.observe(canvas.parentElement);
    onTheme(() => { if(D.R && canvas.clientWidth) this.paint(); });
  },
  choose(r) {
    this.selected=r;
    if(D.R.pm[r]<this.min) { this.min=1; $('#exMin').value='1'; }
    this.paint();
  },
  paint() {
    const canvas=$('#exCanvas'), w=canvas.clientWidth; if(!w || !D.R) return;
    const R=D.R, T=D.meta.totals, h=w<600?360:430, dpr=Math.min(devicePixelRatio||1,2);
    canvas.style.height=h+'px'; canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const css=getComputedStyle(document.body), color=n=>css.getPropertyValue(n).trim();
    const rows=[];let missing=0;
    for(let r=0;r<R.n;r++) if(R.pm[r]>=this.min) { if(R.fe[r]>0) rows.push(r); else missing++; }
    const years=rows.map(r=>R.fe[r]), values=rows.map(r=>R.pm[r]);
    let x0=years.length?Math.floor(years.reduce((a,b)=>Math.min(a,b),Infinity)/10)*10:1960, x1=years.length?Math.ceil(years.reduce((a,b)=>Math.max(a,b),-Infinity)/10)*10:2030;
    if(x0===x1) x1=x0+10;
    const ymax=values.reduce((a,b)=>Math.max(a,b),this.min+1)*1.1, ymin=this.log?this.min:0;
    const left=62,right=w-18,top=20,bottom=h-55;
    const x=v=>left+(v-x0)/(x1-x0)*(right-left);
    const y=v=>bottom-(this.log?Math.log(v/ymin)/Math.log(ymax/ymin):(v-ymin)/(ymax-ymin))*(bottom-top);
    ctx.font='11px sans-serif';ctx.strokeStyle=color('--rule');ctx.fillStyle=color('--ink-2');
    const xtick=w<600?20:10;
    for(let v=x0;v<=x1;v+=xtick) { const px=x(v);ctx.beginPath();ctx.moveTo(px,top);ctx.lineTo(px,bottom);ctx.stroke();ctx.textAlign='center';ctx.fillText(String(v),px,bottom+20); }
    const ticks=this.log?[1,2,5,10,20,50,100,200,500,1000,2000,5000].filter(v=>v>=ymin&&v<=ymax):Array.from({length:5},(_,i)=>i*ymax/4);
    for(const v of ticks) { const py=y(v);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();ctx.textAlign='right';ctx.fillText(fmt(v),left-9,py+4); }
    ctx.textAlign='center';ctx.fillText('Year of first publication in English',(left+right)/2,h-10);
    ctx.save();ctx.translate(13,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText('PubMed-linked records',0,0);ctx.restore();
    this.points=rows.map(r=>({r,x:x(R.fe[r]),y:y(R.pm[r])}));
    ctx.fillStyle=color('--accent');ctx.globalAlpha=rows.length>10000?.25:.55;
    for(const p of this.points) ctx.fillRect(p.x-2,p.y-2,4,4);
    ctx.globalAlpha=1;
    const selected=this.points.find(p=>p.r===this.selected);
    if(selected) {ctx.fillStyle=color('--eosin');ctx.strokeStyle=color('--surface');ctx.lineWidth=2;ctx.beginPath();ctx.arc(selected.x,selected.y,7,0,TAU);ctx.fill();ctx.stroke();}
    $('#exStatus').textContent=`${fmt(rows.length)} researchers shown · ${fmt(missing)} excluded because the first English-publication year is unavailable. ${this.log?'Logarithmic':'Linear'} vertical axis. Points at identical coordinates may overlap.`;
    const r=this.selected; $('#exProfile').hidden=r<0;
    $('#exSelection').textContent=r<0?'Search for a researcher or click a point to inspect their record.':`${R.name[r]} · ${fmt(R.pm[r])} PubMed-linked records · first English publication: ${R.fe[r]>0?R.fe[r]:'unavailable'}${!selected?' · No point can be displayed with the current filter.':''}`;
    this.bins(); flowChart($('#exFlow'),D.meta.crosstab);
    $('#exFlowRows').innerHTML=D.meta.crosstab.map(v=>`<tr><td>${v.english?'English':'Other / undetermined'}</td><td>${v.pubmed?'Linked':'Not linked'}</td><td class="r num">${fmt(v.records)}</td><td class="r num">${pct(v.records/T.records)}</td></tr>`).join('');
  },
  bins() {
    const R=D.R,T=D.meta.totals,counts=[T.researchers-R.n,0,0,0,0], labels=['0 records','1 record','2–10 records','11–99 records','100+ records'];
    for(const n of R.pm) counts[n===1?1:n<=10?2:n<=99?3:4]++;
    const max=Math.max(...counts);
    $('#exBins').innerHTML=counts.map((n,i)=>`<button class="ex-bin" type="button" aria-label="${labels[i]}: ${fmt(n)} researchers, ${pct(n/T.researchers)}"><span>${labels[i]}</span><span class="ex-track"><i style="width:${100*n/max}%;background:var(${i?'--accent':'--muted'})"></i></span><b>${fmt(n)}</b><span>${pct(n/T.researchers)}</span></button>`).join('');
    $$('#exBins button').forEach((b,i)=>b.addEventListener('click',()=>{$('#exBinDetail').textContent=`${fmt(counts[i])} of ${fmt(T.researchers)} researchers have ${labels[i].toLowerCase()} linked to PubMed (${pct(counts[i]/T.researchers)}). These counts include all source researchers, regardless of MeSH availability.`;}));
  }
};
