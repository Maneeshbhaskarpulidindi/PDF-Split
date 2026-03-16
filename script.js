// ── PDF.js worker ───────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── State ───────────────────────────────────────────────────────────────────
let raw = null;        // Uint8Array — NEVER hand to pdf-lib directly
let pdfJs = null;
let total = 0;
let fsize = 0;
let fname = '';
let mode  = 'pick';

// pick
let sel = new Set();
let ord = [];          // display/output order for combine

// slice
let slices = [];
let sidx   = 0;

// drag
let drag = { from:-1, sid:null };

// modal
let pending = null;

// ── File load ───────────────────────────────────────────────────────────────
const ds = document.getElementById('drop-screen');
const fi = document.getElementById('fi');

ds.addEventListener('dragover', e => { e.preventDefault(); ds.classList.add('drag-over'); });
ds.addEventListener('dragleave', () => ds.classList.remove('drag-over'));
ds.addEventListener('drop', e => {
  e.preventDefault(); ds.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  f?.type === 'application/pdf' ? loadPDF(f) : toast('Drop a PDF file','err');
});
fi.addEventListener('change', e => e.target.files[0] && loadPDF(e.target.files[0]));

async function loadPDF(file) {
  try {
    fname = file.name; fsize = file.size;
    const buf = await file.arrayBuffer();
    raw = new Uint8Array(buf);
    pdfJs = await pdfjsLib.getDocument({ data: raw.slice() }).promise;
    total = pdfJs.numPages;
    document.getElementById('hdr-fn').textContent = fname;
    document.getElementById('hdr-pg').textContent = `· ${total} pages`;
    ds.style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'flex';
    sel.clear(); ord = []; slices = []; sidx = 0;
    buildFilmstrip();
    renderPick();
    renderSlices();
  } catch(e) { toast('Load failed: '+e.message,'err'); }
}

// ── Filmstrip ───────────────────────────────────────────────────────────────
function buildFilmstrip() {
  const fs = document.getElementById('fs-scroll');
  fs.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const c = document.createElement('div');
    c.className = 'thumb-card';
    c.id = 'tc'+i;
    c.dataset.p = i;
    c.innerHTML = `<div class="thumb-ph" id="tp${i}"><span>${i}</span></div><div class="thumb-lbl">p. ${i}</div><div class="sel-dot"><svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg></div>`;
    c.addEventListener('click', () => togglePage(i));
    fs.appendChild(c);
    loadThumb(i);
  }
}

async function loadThumb(n) {
  try {
    const pg = await pdfJs.getPage(n);
    const vp = pg.getViewport({ scale: 0.27 });
    const cv = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const ph = document.getElementById('tp'+n);
    if (ph) ph.replaceWith(cv);
  } catch(_) {}
}

// ── Preview ──────────────────────────────────────────────────────────────────
let prevBusy = false;
async function showPrev(n) {
  if (prevBusy) return;
  prevBusy = true;
  try {
    const pane = document.getElementById('prev-pane');
    const cv = document.getElementById('prev-cvs');
    const mw = pane.clientWidth - 40, mh = pane.clientHeight - 60;
    const pg = await pdfJs.getPage(n);
    const nat = pg.getViewport({ scale:1 });
    const sc = Math.min(mw/nat.width, mh/nat.height, 2.2);
    const vp = pg.getViewport({ scale:sc });
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    document.getElementById('prev-empty').style.display = 'none';
    cv.style.display = 'block';
    const lbl = document.getElementById('prev-lbl');
    lbl.style.display = 'block';
    lbl.textContent = `Page ${n} of ${total}`;
  } catch(_) {} finally { prevBusy = false; }
}

// ── Page toggle ──────────────────────────────────────────────────────────────
function togglePage(n) {
  if (sel.has(n)) { sel.delete(n); ord = ord.filter(p=>p!==n); }
  else { sel.add(n); ord.push(n); }
  updateThumb(n);
  showPrev(n);
  renderPick();
}

function updateThumb(n) {
  document.getElementById('tc'+n)?.classList.toggle('selected', sel.has(n));
}

function syncThumbs() { for (let i=1;i<=total;i++) updateThumb(i); }

function selectAll() {
  sel.clear(); ord = [];
  for (let i=1;i<=total;i++){sel.add(i);ord.push(i);}
  syncThumbs(); renderPick();
  if (mode!=='pick') setMode('pick');
}

function clearSel() {
  sel.clear(); ord = [];
  syncThumbs();
  document.getElementById('fs-in').value = '';
  renderPick();
}

// ── Range highlight ──────────────────────────────────────────────────────────
function rangeHighlight(v) {
  if (!v.trim()) { clearSel(); return; }
  const r = parseRange(v, total);
  if (r.error) return;
  sel.clear(); ord = r.pages.slice();
  r.pages.forEach(p=>sel.add(p));
  syncThumbs();
  // scroll to first
  const first = document.getElementById('tc'+r.pages[0]);
  if (first) first.scrollIntoView({ behavior:'smooth', block:'nearest' });
  renderPick();
}

// ── Pick panel ───────────────────────────────────────────────────────────────
function renderPick() {
  const n = ord.length;
  document.getElementById('sel-n').textContent = n;
  const empty = document.getElementById('pick-empty');
  const rol   = document.getElementById('ro-list');
  const acts  = document.getElementById('pick-actions');
  const summ  = document.getElementById('pick-summ');

  if (n === 0) {
    empty.style.display='block'; rol.style.display='none'; acts.style.display='none';
    document.getElementById('btn-combine').disabled=true;
    document.getElementById('btn-split').disabled=true;
    return;
  }
  empty.style.display='none'; rol.style.display='flex'; acts.style.display='block';
  document.getElementById('btn-combine').disabled=false;
  document.getElementById('btn-split').disabled=false;

  const est = Math.round((n/total)*fsize);
  summ.innerHTML = `<b>${n}</b> page${n>1?'s':''} selected · est. <b>${fmt(est)}</b> · drag to reorder below`;
  document.getElementById('comb-bdg').textContent = n+' pages';
  document.getElementById('split-bdg').textContent = n+' files';

  // Reorder list
  rol.innerHTML = '';
  ord.forEach((p,i) => {
    const el = document.createElement('div');
    el.className='ro-item'; el.draggable=true; el.dataset.i=i;
    el.innerHTML=`<span class="ro-handle">${grip()}</span><span class="ro-pg">p. ${p}</span><button class="ro-rm" onclick="removePg(${p})">${x()}</button>`;
    el.addEventListener('dragstart',e=>{drag.from=i;e.dataTransfer.effectAllowed='move';setTimeout(()=>el.classList.add('dragging'),0);});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');const to=+el.dataset.i;if(drag.from!==to){const m=ord.splice(drag.from,1)[0];ord.splice(to,0,m);renderPick();}});
    rol.appendChild(el);
  });
}

function removePg(p) {
  sel.delete(p); ord=ord.filter(x=>x!==p);
  updateThumb(p); renderPick();
}

// ── Mode ─────────────────────────────────────────────────────────────────────
function setMode(m) {
  mode=m;
  document.getElementById('mb-pick').className='msb'+(m==='pick'?' active':'');
  document.getElementById('mb-slice').className='msb'+(m==='slice'?' active':'');
  document.getElementById('pick-pane').style.display=m==='pick'?'block':'none';
  document.getElementById('slice-pane').style.display=m==='slice'?'flex':'none';
}

// ── Slice mode ────────────────────────────────────────────────────────────────
function addSlice() {
  sidx++;
  slices.push({id:sidx,name:`Slice ${sidx}`,range:'',pages:[],order:[],valid:false,err:''});
  renderSlices();
  setTimeout(()=>{const el=document.getElementById('sn'+sidx);if(el){el.focus();el.select();}},30);
}

function delSlice(id) { slices=slices.filter(s=>s.id!==id); renderSlices(); }

function dupMap() {
  const m={};
  slices.forEach(s=>s.pages.forEach(p=>{(m[p]=m[p]||[]).push(s.id);}));
  return m;
}

function renderSlices() {
  const list = document.getElementById('slice-list');
  list.innerHTML = '';
  const dm = dupMap();

  slices.forEach((s,si) => {
    const dups = s.pages.filter(p=>dm[p]&&dm[p].length>1);
    let cls = 'slice-card';
    if (s.valid && !dups.length) cls+=' sc-ok';
    else if (!s.valid && s.range) cls+=' sc-err';
    else if (dups.length) cls+=' sc-dup';

    let msgHtml='';
    if (!s.range) msgHtml='';
    else if (!s.valid) msgHtml=`<div class="sc-msg msg-err">${esc(s.err)}</div>`;
    else if (dups.length) msgHtml=`<div class="sc-msg msg-dup">⚠ p.${dups.slice(0,4).join(', ')} overlaps another slice</div>`;
    else msgHtml=`<div class="sc-msg msg-ok">${s.order.length} page${s.order.length>1?'s':''} · drag to reorder</div>`;

    const card = document.createElement('div');
    card.className=cls; card.id='sc'+s.id;
    card.innerHTML=`
      <div class="sc-top">
        <div class="sc-num">${si+1}</div>
        <input class="sc-name" id="sn${s.id}" value="${esc(s.name)}" placeholder="PDF name…" oninput="sname(${s.id},this.value)">
        <button class="sc-del" onclick="delSlice(${s.id})">${x()}</button>
      </div>
      <div class="rng-row">
        <label>Pages</label>
        <input class="rng-in${s.valid?' ri-ok':s.range&&!s.valid?' ri-err':''}" id="sri${s.id}" value="${esc(s.range)}" placeholder="10-30, 45, 52-60…" oninput="srange(${s.id},this.value)">
      </div>
      ${msgHtml}
      ${s.valid&&s.order.length?`<div class="sc-order" id="so${s.id}"></div>`:''}
      <button class="sc-dl" id="sdl${s.id}" onclick="previewSliceDl(${s.id})" ${s.valid?'':'disabled'}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download this slice
      </button>`;
    list.appendChild(card);
    if (s.valid && s.order.length) buildSliceOrder(s);
  });

  const valid = slices.filter(s=>s.valid);
  const tot = valid.reduce((a,s)=>a+s.order.length,0);
  const ss = document.getElementById('slice-summ');
  const da = document.getElementById('dl-all');
  if (!slices.length){ss.style.display='none';da.disabled=true;return;}
  ss.style.display='block';
  ss.innerHTML=`<b>${valid.length}</b>/${slices.length} slice${slices.length>1?'s':''} ready · <b>${tot}</b> total pages`;
  da.disabled=valid.length===0;
}

function buildSliceOrder(s) {
  const c = document.getElementById('so'+s.id);
  if (!c) return;
  c.innerHTML='';
  s.order.forEach((p,i) => {
    const el=document.createElement('div');
    el.className='so-item';el.draggable=true;el.dataset.i=i;
    el.innerHTML=`<span class="so-h">${grip10()}</span><span class="so-p">p.${p}</span><button class="so-rm" onclick="rmFromSlice(${s.id},${p})">${x10()}</button>`;
    el.addEventListener('dragstart',e=>{drag.from=i;drag.sid=s.id;e.dataTransfer.effectAllowed='move';setTimeout(()=>el.classList.add('dragging'),0);});
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
    el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');});
    el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
    el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');if(drag.sid!==s.id)return;const to=+el.dataset.i;if(drag.from!==to){const m=s.order.splice(drag.from,1)[0];s.order.splice(to,0,m);buildSliceOrder(s);}});
    c.appendChild(el);
  });
}

function sname(id,v){const s=slices.find(s=>s.id===id);if(s)s.name=v;updSliceFoot();}

function srange(id,v) {
  const s=slices.find(s=>s.id===id);
  if(!s)return;
  s.range=v;
  if(!v.trim()){s.valid=false;s.pages=[];s.order=[];s.err='';}
  else {
    const r=parseRange(v,total);
    s.valid=!r.error; s.pages=r.error?[]:r.pages;
    s.order=r.error?[]:r.pages.slice(); s.err=r.error||'';
  }
  renderSlices();
}

function rmFromSlice(id,p) {
  const s=slices.find(s=>s.id===id);
  if(!s)return;
  s.pages=s.pages.filter(x=>x!==p);
  s.order=s.order.filter(x=>x!==p);
  s.valid=s.pages.length>0;
  renderSlices();
}

function updSliceFoot() {
  const valid=slices.filter(s=>s.valid);
  document.getElementById('dl-all').disabled=valid.length===0;
}

// ── Download triggers ────────────────────────────────────────────────────────
function triggerCombine() {
  if(!ord.length)return;
  const base=fname.replace(/\.pdf$/i,'');
  const est=Math.round((ord.length/total)*fsize);
  openModal({title:'Combine into one PDF',name:base,pages:ord.slice(),type:'combine',est});
}

function triggerSplit() {
  if(!ord.length)return;
  const base=fname.replace(/\.pdf$/i,'');
  const est=Math.round((ord.length/total)*fsize);
  openModal({title:`Split into ${ord.length} separate PDFs`,name:base,pages:ord.slice(),type:'split',est});
}

function previewSliceDl(id) {
  const s=slices.find(s=>s.id===id);
  if(!s||!s.valid)return;
  const est=Math.round((s.order.length/total)*fsize);
  openModal({title:`Download: ${s.name||'slice'}`,name:s.name,pages:s.order.slice(),type:'slice',est});
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(data) {
  pending=data;
  document.getElementById('modal-title').textContent=data.title;
  const outName = data.type==='split'
    ? `${safe(data.name)}_split.zip`
    : `${safe(data.name||'output')}.pdf`;
  document.getElementById('modal-rows').innerHTML=`
    <div class="modal-row"><label>Output file</label><span>${outName}</span></div>
    <div class="modal-row"><label>Pages</label><span>${data.pages.length}</span></div>
    <div class="modal-row"><label>Est. size</label><span>~${fmt(data.est)}</span></div>
  `;
  const chips=data.pages.slice(0,48).map(p=>`<span class="pg-chip">p.${p}</span>`).join('');
  const more=data.pages.length>48?`<span style="color:var(--t2)"> +${data.pages.length-48} more</span>`:'';
  document.getElementById('modal-pgs').innerHTML=chips+more;
  document.getElementById('modal-ov').style.display='flex';
}

function closeModal(e) {
  if(e&&e.target!==document.getElementById('modal-ov'))return;
  document.getElementById('modal-ov').style.display='none';
  pending=null;
}

async function confirmModal() {
  document.getElementById('modal-ov').style.display='none';
  if(!pending)return;
  const {type,pages,name}=pending;
  pending=null;
  if(type==='combine'||type==='slice') await dlSingle(pages,safe(name||'output')+'.pdf');
  else if(type==='split') await dlSplit(pages,safe(name||'output'));
}

// ── Slice zip ─────────────────────────────────────────────────────────────────
async function downloadAllSlices() {
  const valid=slices.filter(s=>s.valid);
  if(!valid.length)return;
  const btn=document.getElementById('dl-all');
  const pw=document.getElementById('prog-wrap');
  const pf=document.getElementById('prog-fill');
  btn.disabled=true; pw.style.display='block';
  try {
    const zip=new JSZip();
    for(let i=0;i<valid.length;i++){
      pf.style.width=Math.round(i/valid.length*90)+'%';
      const s=valid[i];
      zip.file(safe(s.name||`slice-${i+1}`)+'.pdf', await buildPDF(s.order));
    }
    pf.style.width='98%';
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
    pf.style.width='100%';
    dl(blob, safe(fname.replace(/\.pdf$/i,''))+'_slices.zip');
    toast(`Downloaded ${valid.length} PDFs as ZIP`,'ok');
  } catch(e){toast('Error: '+e.message,'err');}
  finally{setTimeout(()=>{btn.disabled=false;pw.style.display='none';pf.style.width='0';},700);}
}

// ── PDF builders ─────────────────────────────────────────────────────────────
async function dlSingle(pages,outName){
  try{const b=await buildPDF(pages);dl(new Blob([b]),outName);toast('Downloaded '+outName,'ok');}
  catch(e){toast('Error: '+e.message,'err');}
}

async function dlSplit(pages,base){
  try{
    const zip=new JSZip();
    for(const p of pages) zip.file(`${base}_p${p}.pdf`,await buildPDF([p]));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:3}});
    dl(blob,base+'_split.zip');
    toast(`Downloaded ${pages.length} PDFs as ZIP`,'ok');
  }catch(e){toast('Error: '+e.message,'err');}
}

// CRITICAL — fresh copy every call prevents detached ArrayBuffer error
async function buildPDF(pages){
  const {PDFDocument}=PDFLib;
  const src=await PDFDocument.load(raw.slice().buffer);
  const out=await PDFDocument.create();
  const copied=await out.copyPages(src,pages.map(p=>p-1));
  copied.forEach(p=>out.addPage(p));
  return out.save();
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(!raw)return;
  const tag=document.activeElement?.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(e.ctrlKey&&e.key==='a'){e.preventDefault();selectAll();}
  if(e.key==='Escape'){clearSel();document.getElementById('modal-ov').style.display='none';}
  if(e.ctrlKey&&e.key==='Enter'){
    if(mode==='pick'&&ord.length)triggerCombine();
    else if(mode==='slice')downloadAllSlices();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseRange(str,max){
  const pages=new Set();
  for(const part of str.split(',').map(s=>s.trim()).filter(Boolean)){
    if(/^\d+$/.test(part)){const n=+part;if(n<1||n>max)return{error:`Page ${n} out of range (1–${max})`};pages.add(n);}
    else if(/^\d+-\d+$/.test(part)){const[a,b]=part.split('-').map(Number);if(a<1||b>max)return{error:`Range ${part} out of bounds (1–${max})`};if(a>b)return{error:`${part}: start must be ≤ end`};for(let i=a;i<=b;i++)pages.add(i);}
    else return{error:`Can't parse "${part}"`};
  }
  if(!pages.size)return{error:'No pages found'};
  return{pages:[...pages].sort((a,b)=>a-b)};
}

function fmt(b){if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(0)+'KB';return(b/1048576).toFixed(1)+'MB';}
function safe(s){return String(s).replace(/[^\w\s\-(). ]/g,'').replace(/\s+/g,'_').slice(0,60)||'output';}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function dl(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
function toast(msg,type=''){const e=document.getElementById('toast');e.textContent=msg;e.className='toast show '+type;setTimeout(()=>e.className='toast',3000);}

// SVG icons as strings
const grip=()=>`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
const grip10=()=>`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
const x=()=>`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const x10=()=>`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

function resetAll(){
  raw=null;pdfJs=null;total=0;fsize=0;fname='';
  sel.clear();ord=[];slices=[];sidx=0;
  fi.value='';
  document.getElementById('app').style.display='none';
  ds.style.display='flex';
}
