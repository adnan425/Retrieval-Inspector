/** White-themed, library-driven browser UI for RetrievalInspector.
 *
 * Uses Chart.js (score/relevance bars, strategy comparison) and Mermaid
 * (pipeline flow diagram). Both served locally from /lib — no CDN.
 */

export function uiHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RetrievalInspector</title>
<script src="/lib/chart.umd.js"></script>
<style>
  :root {
    --bg:#f7f8fb; --card:#ffffff; --border:#e4e7ee; --ink:#1a2333; --muted:#6b7480;
    --primary:#3b82f6; --primary-d:#2563eb; --accent:#22d3ee; --purple:#8b5cf6; --green:#10b981;
    --amber:#f59e0b; --red:#ef4444; --shadow:0 1px 3px rgba(20,30,60,.06),0 4px 16px rgba(20,30,60,.05);
  }
  * { box-sizing:border-box; }
  body { font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; margin:0; background:var(--bg); color:var(--ink); line-height:1.5; }
  header { background:var(--card); border-bottom:1px solid var(--border); padding:14px 24px; display:flex; align-items:center; gap:14px; position:sticky; top:0; z-index:10; }
  header h1 { font-size:1.15rem; margin:0; }
  header .sub { color:var(--muted); font-size:.8rem; margin-left:auto; }
  .logo { width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,var(--primary),var(--purple)); display:grid; place-items:center; color:#fff; font-size:17px; }
  main { max-width:1180px; margin:0 auto; padding:22px 20px 70px; }

  .querybar { display:flex; gap:10px; background:var(--card); border:1px solid var(--border); border-radius:14px; padding:12px 14px; box-shadow:var(--shadow); margin-bottom:18px; }
  .querybar input { flex:1; border:0; outline:0; font-size:1.02rem; background:transparent; color:var(--ink); }
  .querybar input::placeholder { color:#9aa3b0; }
  .querybar button { background:var(--primary); color:#fff; border:0; border-radius:10px; padding:12px 22px; font-weight:600; cursor:pointer; }
  .querybar button:hover { background:var(--primary-d); }
  .querybar button:disabled { opacity:.5; cursor:wait; }
  .status { color:var(--muted); font-size:.82rem; margin:-8px 0 16px 4px; min-height:1.2em; }

  .grid { display:grid; gap:18px; }
  .row2 { display:grid; grid-template-columns:1.1fr 1fr; gap:18px; }
  @media (max-width:900px){ .row2{ grid-template-columns:1fr; } }

  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; box-shadow:var(--shadow); padding:18px 20px; }
  .card h2 { font-size:.95rem; margin:0 0 12px; display:flex; align-items:center; gap:8px; }
  .card h2 small { color:var(--muted); font-weight:400; margin-left:auto; }
  .muted { color:var(--muted); }

  /* mermaid flow */
  .flow { min-height:130px; display:grid; place-items:center; }
  .flow svg { max-width:100%; height:auto; }

  /* charts */
  .chartbox { position:relative; height:220px; }
  .chartbox.small { height:150px; }
  .strat-charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }

  .answer { font-size:1.04rem; line-height:1.6; white-space:pre-wrap; }

  /* chips & evidence */
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
  .chip { font-size:.72rem; background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe; border-radius:999px; padding:2px 10px; }
  .ctxtext { background:#f5f7fb; border:1px solid var(--border); border-radius:10px; padding:12px 14px; font-size:.87rem; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; max-height:300px; overflow:auto; white-space:pre-wrap; color:#0f172a; }
  mark { background:#fde68a; color:#78350f; border-radius:3px; padding:0 2px; }

  /* chunk result cards */
  .hits { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:12px; }
  .hit { border:1px solid var(--border); border-left:4px solid var(--primary); border-radius:10px; padding:12px 14px; background:#fcfdff; }
  .hit.top { border-left-color:var(--accent); }
  .hit .rank { font-weight:700; color:var(--primary-d); }
  .hit .score { font-variant-numeric:tabular-nums; font-weight:600; }
  .hit .doc { font-size:.74rem; color:var(--muted); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .hit .snip { font-size:.83rem; margin-top:6px; color:#334155; }
  .hit .bar { height:5px; background:#eef0f5; border-radius:3px; margin-top:8px; overflow:hidden; }
  .hit .bar>i { display:block; height:100%; background:linear-gradient(90deg,var(--primary),var(--accent)); border-radius:3px; }

  details summary { cursor:pointer; color:var(--primary-d); font-size:.84rem; }
  .pruned { font-size:.8rem; color:var(--muted); }
  ul { margin:8px 0 0; padding-left:20px; }
  li { margin-bottom:3px; }

  .upload-box { margin-top:26px; }
  .upload-box form { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
  .upload-box input[type=file] { font-size:.85rem; }
  #doctree { font-size:.84rem; color:var(--muted); }
  .pill { font-size:.72rem; background:#e0f2fe; color:#075985; border:1px solid #bae6fd; border-radius:999px; padding:2px 10px; }
  .err { color:var(--red); }
  .btn-ghost { background:none; border:1px solid var(--border); color:var(--primary-d); padding:6px 12px; border-radius:8px; cursor:pointer; font-size:.8rem; }
  .toggle-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .tab { display:inline-block; font-size:.78rem; padding:5px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--muted); cursor:pointer; }
  .tab.active { background:var(--primary); color:#fff; border-color:var(--primary); }
</style>
</head>
<body>
<header>
  <div class="logo">&#128270;</div>
  <h1>RetrievalInspector</h1>
  <div class="sub">Inspect, debug &amp; improve your RAG retrieval</div>
</header>
<main>
  <div class="querybar">
    <input type="text" id="q" placeholder="Ask a question about your indexed documents…" autocomplete="off" autofocus>
    <button id="btn">Run pipeline</button>
  </div>
  <div class="status" id="status">Store loading…</div>

  <div class="grid">
    <div class="card"><h2>Pipeline flow</h2><div class="flow" id="flow"></div></div>

    <div class="row2">
      <div class="card"><h2>Relevance by strategy</h2>
        <div class="toggle-row" id="stratTabs"></div>
        <div class="chartbox" id="stratChartBox"></div>
      </div>
      <div class="card"><h2>Top retrieved chunks <small id="chkCount">—</small></h2>
        <div class="hits" id="hits"></div>
      </div>
    </div>

    <div class="card"><h2>Context sent to the LLM <small id="ctxChars">—</small></h2>
      <div class="chips" id="srcChips"></div>
      <div class="ctxtext" id="ctx"></div>
      <details style="margin-top:10px"><summary id="prunedSum">Pruned duplicates</summary><ul class="pruned" id="pruned"></ul></details>
    </div>

    <div class="card"><h2>Answer</h2><div class="answer" id="answer">Ask a question to see the pipeline run.</div></div>
  </div>

  <div class="card upload-box">
    <h2>Upload documents</h2>
    <form id="upform">
      <input type="file" id="file" accept=".md,.markdown,.txt,.html,.htm,.pdf" multiple>
      <button type="submit" id="upbtn" class="btn-ghost">Index</button>
    </form>
    <div class="status" id="upstatus"></div>
    <div id="doctree"></div>
  </div>
</main>

<script>
  const $ = id => document.getElementById(id);
  const q=$('q'), btn=$('btn'), status=$('status'), flow=$('flow');
  const answer=$('answer'), ctx=$('ctx'), ctxChars=$('ctxChars'), srcChips=$('srcChips');
  const hitsBox=$('hits'), chkCount=$('chkCount'), pruned=$('pruned'), prunedSum=$('prunedSum');
  const stratTabs=$('stratTabs'), stratChartBox=$('stratChartBox');
  const upform=$('upform'), file=$('file'), upbtn=$('upbtn'), upstatus=$('upstatus'), doctree=$('doctree');

  function esc(s){ return (s??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  MermaidInit();
  fetch('/health').then(r=>r.json()).then(h=>{ status.textContent = h.ok ? 'Store ready — '+h.indexedChunks+' chunk(s) indexed.' : 'Store unavailable.'; }).catch(()=>status.textContent='Store unavailable.');
  refreshDocs();

  function drawFlow(){
    // Deterministic inline SVG pipeline diagram (no external deps, always renders).
    const nodes = [
      { label:'Query',      sub:'your question',   fill:'#dbeafe', stroke:'#3b82f6', txt:'#1e40af' },
      { label:'Retrieval',  sub:'4 strategies',    fill:'#e0f2fe', stroke:'#22d3ee', txt:'#075985' },
      { label:'Context',    sub:'evidence sent',   fill:'#ede9fe', stroke:'#8b5cf6', txt:'#5b21b6' },
      { label:'Answer',     sub:'generated',       fill:'#d1fae5', stroke:'#10b981', txt:'#065f46' },
    ];
    const W=150, H=92, GAP=34, X0=8, Y0=8;
    const totalW = X0*2 + nodes.length*W + (nodes.length-1)*GAP;
    let svg = '<svg viewBox="0 0 '+totalW+' '+(Y0*2+H)+'" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">';
    // arrows first (behind boxes)
    for(let i=0;i<nodes.length-1;i++){
      const x1 = X0 + (i+1)*W + i*GAP - GAP/2;
      const y  = Y0 + H/2;
      svg += '<path d="M'+x1+' '+y+' h'+(GAP-6)+'" stroke="#94a3b8" stroke-width="2" fill="none" marker-end="url(#arr)"/>';
    }
    svg += '<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8"/></marker></defs>';
    // nodes
    nodes.forEach((n,i)=>{
      const x = X0 + i*(W+GAP);
      const y = Y0;
      svg += '<g>'+
        '<rect x="'+x+'" y="'+y+'" width="'+W+'" height="'+H+'" rx="12" fill="'+n.fill+'" stroke="'+n.stroke+'" stroke-width="1.5"/>'+
        '<text x="'+(x+W/2)+'" y="'+(y+34)+'" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="15" font-weight="700" fill="'+n.txt+'">'+n.label+'</text>'+
        '<text x="'+(x+W/2)+'" y="'+(y+56)+'" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="10.5" fill="'+n.txt+'" opacity="0.75">'+n.sub+'</text>'+
        '</g>';
    });
    svg += '</svg>';
    flow.innerHTML = svg;
  }
  drawFlow();

  // ---- term highlight ----
  let query='';
  const termSet = () => new Set((query||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2));
  function hilite(text){
    let t = esc(text);
    try{ termSet().forEach(tok=>{ t = t.replace(new RegExp('\\\\b'+tok+'\\\\b','gi'), m=>'<mark>'+m+'</mark>'); }); }catch(e){}
    return t;
  }
  function snip(text,max=150){ text=text.replace(/\\s+/g,' ').trim(); return text.length>max?text.slice(0,max)+'…':text; }

  // ---- charts ----
  let stratChart=null, stratChartsData={}, activeStrat=null;
  function renderStratTabs(data){
    const strats=Object.keys(data||{});
    stratTabs.innerHTML='';
    activeStrat = activeStrat && strats.includes(activeStrat) ? activeStrat : (strats[0]||null);
    strats.forEach(s=>{
      const t=document.createElement('span');
      t.className='tab'+(s===activeStrat?' active':''); t.textContent=s;
      t.onclick=()=>{ activeStrat=s; renderStratTabs(data); drawStratChart(); };
      stratTabs.appendChild(t);
    });
  }
  function drawStratChart(){
    const hits = activeStrat ? (stratChartsData[activeStrat]||[]) : [];
    const labels = hits.map((h,i)=>'#'+h.rank);
    const vals = hits.map(h=>+(h.score||0).toFixed(3));
    if(stratChart) stratChart.destroy();
    const box = stratChartBox;
    try {
      box.innerHTML='<canvas></canvas>';
      const ctx2 = box.querySelector('canvas');
      stratChart = new Chart(ctx2, {
      type:'bar',
      data:{ labels, datasets:[{
        label: activeStrat, data: vals, backgroundColor:'#3b82f6', borderRadius:6, maxBarThickness:46
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>activeStrat+' '+c.parsed.y}} },
        scales:{ y:{ beginAtZero:true, max:1, grid:{color:'#eef0f5'} }, x:{ grid:{display:false} } }
      }
    });
    } catch(e){
      // Chart.js unavailable/failed -> graceful fallback list of scores
      box.innerHTML='';
      hits.forEach(r=>{ const el=document.createElement('div'); el.style.cssText='display:flex;justify-content:space-between;align-items:center;font-size:.82rem;padding:6px 10px;border-bottom:1px solid #eef0f5;';
        el.innerHTML='<span>#'+r.rank+'</span><span>'+r.score.toFixed(3)+'</span><div style="background:#3b82f6;height:8px;border-radius:4px;width:'+Math.max(3,r.score*100)+'%"></div>'; box.appendChild(el); });
    }
  }

  // ---- query submit ----
  async function run(){
    const txt=q.value.trim(); if(!txt) return;
    query=txt; btn.disabled=true; status.textContent='Retrieving…';
    answer.textContent='Running pipeline…';
    try{
      const res=await fetch('/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:txt,topK:6})});
      const d=await res.json(); if(!res.ok) throw new Error(d.error||'failed');
      render(d);
      status.textContent='Done.';
    }catch(e){ status.textContent=''; answer.innerHTML='<span class="err">Error: '+esc(e.message)+'</span>'; }
    finally{ btn.disabled=false; }
  }
  btn.addEventListener('click',run);
  q.addEventListener('keydown',e=>{ if(e.key==='Enter') run(); });

  function render(d){
    drawFlow();
    // answer
    answer.textContent = d.answer || '';
    // context
    const t=d.trace;
    if(t){
      const ctxt=t.context||'';
      ctx.innerHTML = ctxt ? hilite(ctxt) : '<span class="muted">(empty context)</span>';
      ctxChars.textContent = ctxt.length+' chars';
      srcChips.innerHTML = (t.sources||[]).map(s=>{
        const n=(s.documentTitle||s.documentId||'').split(/[\\\\/]/).pop();
        return '<span class="chip">'+esc(n)+' · '+(s.score? s.score.toFixed(3):'?')+'</span>';
      }).join('') || '<span class="muted">no sources</span>';
      // pruned
      const p=t.prunedDuplicates||[];
      prunedSum.textContent = 'Pruned duplicates ('+p.length+')';
      pruned.innerHTML = p.map(r=>'<li>'+esc(r.chunk.id)+' <span class="muted">score '+r.score.toFixed(3)+'</span></li>').join('')||'<li>none</li>';
    }
    // strategy charts
    stratChartsData = t ? (t.resultsByStrategy||{}) : {};
    renderStratTabs(stratChartsData); drawStratChart();

    // top hits
    const finalR = t ? (t.finalResults||[]) : [];
    chkCount.textContent = '—';
    hitsBox.innerHTML = '';
    if(finalR.length){
      chkCount.textContent = finalR.length+' chunks';
      const max = Math.max(...finalR.map(h=>h.score),0.0001);
      finalR.forEach(r=>{
        const doc=(r.chunk.documentId||'').split(/[\\\\/]/).pop();
        const pct=Math.max(3,(r.score/max)*100);
        const el=document.createElement('div');
        el.className='hit'+(r.rank===1?' top':'');
        el.innerHTML =
          '<span class="rank">#'+r.rank+'</span> <span class="score">'+r.score.toFixed(3)+'</span> '+
          '<span class="pill">'+esc(r.strategy)+'</span>'+
          '<div class="doc">'+esc(doc)+'</div>'+
          '<div class="snip">'+hilite(snip(r.chunk.text))+'</div>'+
          '<div class="bar"><i style="width:'+pct.toFixed(1)+'%"></i></div>';
        hitsBox.appendChild(el);
      });
    } else {
      hitsBox.innerHTML='<span class="muted">no results</span>';
    }
  }

  async function refreshDocs(){
    try{ const r=await fetch('/docs'); const d=await r.json(); const docs=d.docs||[];
      doctree.innerHTML = docs.length ? 'Indexed: '+docs.map(x=>esc(x.split(/[\\\\/]/).pop())).join(', ') : 'No documents indexed yet.';
    }catch(e){ doctree.textContent=''; }
  }
  upform.addEventListener('submit', async e=>{
    e.preventDefault();
    const files=file.files; if(!files||!files.length) return;
    upbtn.disabled=true; let done=[],errs=[];
    for(const f of Array.from(files)){
      upstatus.textContent='Uploading '+f.name+'…';
      try{ const r=await fetch('/upload?name='+encodeURIComponent(f.name),{method:'POST',body:f}); const d=await r.json();
        if(!r.ok) throw new Error(d.error||'failed'); done.push(f.name+' ('+d.chunks+')');
      }catch(err){ errs.push(f.name+': '+err.message); }
    }
    upstatus.textContent=(done.length?'Indexed '+done.join(', '):'')+(errs.length?' Errors: '+errs.join('; '):'');
    fetch('/health').then(r=>r.json()).then(h=>{ status.textContent='Store ready — '+h.indexedChunks+' chunk(s) indexed.'; });
    refreshDocs(); upbtn.disabled=false; file.value='';
  });
</script>
</body>
</html>`;
}