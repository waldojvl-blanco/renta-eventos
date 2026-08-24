/* ============== Renta de muebles · Dashboard de eventos ==============
   OCR gratis con Tesseract (navegador) + guardado en el servidor (JSON).
   ==================================================================== */

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESES_NUM = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12,
  ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12};

let EVENTS = [];
let FILTER = 'prox';
let QUERY = '';
let editingId = null;

/* ---------------- API ---------------- */
async function apiGet(){ const r = await fetch('/api/eventos'); return r.ok ? r.json() : []; }
async function apiPost(ev){ const r = await fetch('/api/eventos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)}); if(!r.ok) throw new Error('post'); return r.json(); }
async function apiPut(id,ev){ const r = await fetch('/api/eventos/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(ev)}); if(!r.ok) throw new Error('put'); return r.json(); }
async function apiDel(id){ const r = await fetch('/api/eventos/'+id,{method:'DELETE'}); return r.ok; }

async function loadEvents(){ try{ EVENTS = await apiGet(); }catch(e){ EVENTS = []; toast('No conecté con el servidor'); } }

/* ---------------- fechas ---------------- */
function parseDate(s){
  if(!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3]);
  return isNaN(d) ? null : d;
}
function startOfDay(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
function daysBetween(d){ return Math.round((startOfDay(d)-startOfDay(new Date()))/86400000); }
function countdownLabel(d){
  const n = daysBetween(d);
  if(n===0) return {t:'¡Es hoy!',c:'soon'};
  if(n===1) return {t:'Mañana',c:'soon'};
  if(n>1&&n<=7) return {t:'Faltan '+n+' días',c:'soon'};
  if(n>7) return {t:'Faltan '+n+' días',c:''};
  if(n===-1) return {t:'Fue ayer',c:'past'};
  return {t:'Hace '+Math.abs(n)+' días',c:'past'};
}
function fmtDate(s){ const d=parseDate(s); return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : (s||''); }
function money(s){
  if(s==null||s==='') return '';
  const n = String(s).replace(/[^\d.]/g,'');
  if(!n) return '';
  const num = Number(n);
  if(isNaN(num)) return '$'+n;
  return '$'+num.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}

/* ---------------- render ---------------- */
function render(){ renderStats(); renderBoard(); }

function renderStats(){
  const today = startOfDay(new Date());
  const mNow = today.getMonth(), yNow = today.getFullYear();
  let prox=0, mes=0, pend=0;
  EVENTS.forEach(e=>{
    const d = parseDate(e.fecha);
    if(d && startOfDay(d)>=today) prox++;
    if(d && d.getMonth()===mNow && d.getFullYear()===yNow) mes++;
    if(e.estado!=='entregado' && (!d || startOfDay(d)>=today)) pend++;
  });
  document.getElementById('stats').innerHTML = `
    <div class="stat rosa"><div class="n">${prox}</div><div class="l">Eventos próximos</div></div>
    <div class="stat"><div class="n">${mes}</div><div class="l">Este mes</div></div>
    <div class="stat"><div class="n">${pend}</div><div class="l">Pendientes de entregar</div></div>`;
}

function matches(e){
  if(!QUERY) return true;
  const q = QUERY.toLowerCase();
  const hay = [e.cliente,e.telefono,e.lugar,e.observaciones,e.montaje,
    ...(e.productos||[]).map(p=>p.descripcion)].join(' ').toLowerCase();
  return hay.includes(q);
}

function renderBoard(){
  const today = startOfDay(new Date());
  let list = EVENTS.filter(matches);
  if(FILTER==='prox')   list = list.filter(e=>{const d=parseDate(e.fecha);return !d||startOfDay(d)>=today;});
  if(FILTER==='pasados')list = list.filter(e=>{const d=parseDate(e.fecha);return d&&startOfDay(d)<today;});
  list.sort((a,b)=>{
    const da=parseDate(a.fecha),db=parseDate(b.fecha);
    if(da&&db) return da-db;
    if(da) return -1; if(db) return 1;
    return (b.createdAt||0)-(a.createdAt||0);
  });

  const board = document.getElementById('board');
  if(!list.length){
    board.innerHTML = `<div class="empty">
      <div class="big">${EVENTS.length?'Nada por aquí':'Aún no hay eventos'}</div>
      <p>${EVENTS.length?'Prueba con otro filtro o búsqueda.':'Sube la foto o el PDF de una nota impresa. La leo con OCR y armo la ficha del evento.'}</p>
      ${EVENTS.length?'':'<button class="btn-primary" onclick="openNew()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Subir primera nota</button>'}
    </div>`;
    return;
  }
  let nextId=null;
  for(const e of list){ const d=parseDate(e.fecha); if(d&&startOfDay(d)>=today){nextId=e.id;break;} }
  board.innerHTML = '<div class="grid">'+list.map(e=>cardHTML(e,nextId)).join('')+'</div>';
}

function esc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function cardHTML(e,nextId){
  const d = parseDate(e.fecha);
  const done = e.estado==='entregado';
  const ticket = d
    ? `<div class="ticket"><div class="day">${d.getDate()}</div><div class="mon">${MESES[d.getMonth()]}</div><div class="yr">${d.getFullYear()}</div></div>`
    : `<div class="ticket nodate">Sin<br>fecha</div>`;
  const cd = d ? countdownLabel(d) : null;
  const prods = (e.productos||[]).filter(p=>p.descripcion);
  const money=[];
  if(e.total)    money.push(`<span class="chip">Subtotal <b>${esc(e.total)}</b></span>`);
  if(e.anticipo) money.push(`<span class="chip">Anticipo <b>${esc(e.anticipo)}</b></span>`);
  if(e.saldo)    money.push(`<span class="chip saldo">Restante <b>${esc(e.saldo)}</b></span>`);
  if(e.deposito) money.push(`<span class="chip">Garantía <b>${esc(e.deposito)}</b></span>`);

  return `<div class="card ${e.id===nextId?'next':''} ${done?'done':''}">
    ${e.id===nextId?'<div class="ribbon">Próximo</div>':''}
    <div class="card-top">
      ${ticket}
      <div class="who">
        <div class="name">${esc(e.cliente)||'Cliente sin nombre'}</div>
        <div class="meta">
          ${e.hora?`<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(e.hora)}</span>`:''}
          ${e.lugar?`<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z"/><circle cx="12" cy="11" r="2"/></svg>${esc(e.lugar)}</span>`:''}
          ${e.telefono?`<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5c0 8.3 6.7 15 15 15a2 2 0 0 0 2-2v-2.3a1 1 0 0 0-.8-1l-3.4-.6a1 1 0 0 0-1 .4l-.9 1.2a12 12 0 0 1-5.2-5.2l1.2-.9a1 1 0 0 0 .4-1L10.3 4.8A1 1 0 0 0 9.3 4H7a2 2 0 0 0-2 2Z"/></svg>${esc(e.telefono)}</span>`:''}
          ${e.recoleccion?`<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>Recolección: ${esc(fmtDate(e.recoleccion))}</span>`:''}
        </div>
        ${cd?`<span class="countdown ${cd.c}">${cd.t}</span>`:''}
      </div>
    </div>
    ${prods.length?`<div class="section"><h4>Productos a entregar</h4><div class="prod-list">
      ${prods.map(p=>`<div class="prod"><span class="q">${esc(p.cantidad||'')}</span><span class="d">${esc(p.descripcion)}</span></div>`).join('')}
    </div></div>`:''}
    ${e.observaciones?`<div class="section"><h4>Observaciones</h4><div class="obs">${esc(e.observaciones)}</div></div>`:''}
    ${e.montaje?`<div class="section"><h4>Montaje</h4><div class="obs montaje">${esc(e.montaje)}</div></div>`:''}
    ${money.length?`<div class="money">${money.join('')}</div>`:''}
    <div class="card-actions">
      ${e.imagen?`<button onclick="showImg('${e.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4-4-9 9"/></svg>Ver nota</button>`:''}
      <button onclick="editEvent('${e.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Editar</button>
      <button class="done-btn ${done?'is-done':''}" onclick="toggleDone('${e.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>${done?'Entregado':'Marcar entregado'}</button>
      <button onclick="deleteEvent('${e.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>Borrar</button>
    </div>
  </div>`;
}

/* ---------------- acciones ---------------- */
let pendingDelete = null;

async function deleteEvent(id){
  const idx = EVENTS.findIndex(e=>e.id===id);
  if(idx < 0) return;
  const ev = EVENTS[idx];
  EVENTS.splice(idx,1);
  render();
  try{ await apiDel(id); }catch(e){}
  if(pendingDelete){ clearTimeout(pendingDelete.timer); clearInterval(pendingDelete.tick); }
  showUndoToast(ev);
}

function showUndoToast(ev){
  const t = document.getElementById('toast');
  let secs = 6;
  t.style.pointerEvents = 'auto';
  const paint = ()=>{
    t.innerHTML = `Evento borrado <button id="undoBtn" style="margin-left:12px;color:var(--rosa-2);font-weight:700;text-decoration:underline;background:none;border:none;cursor:pointer;font-size:14px">Deshacer (${secs})</button>`;
    const b = document.getElementById('undoBtn'); if(b) b.onclick = undoDelete;
  };
  paint();
  t.classList.add('show');
  const tick = setInterval(()=>{ secs--; if(secs > 0) paint(); }, 1000);
  const timer = setTimeout(()=>{ clearInterval(tick); hideToast(); pendingDelete = null; }, 6000);
  pendingDelete = { ev, timer, tick };
}

function hideToast(){
  const t = document.getElementById('toast');
  t.classList.remove('show');
  t.style.pointerEvents = 'none';
  setTimeout(()=>{ if(!t.classList.contains('show')) t.innerHTML=''; }, 300);
}

async function undoDelete(){
  if(!pendingDelete) return;
  clearTimeout(pendingDelete.timer);
  clearInterval(pendingDelete.tick);
  const ev = pendingDelete.ev;
  pendingDelete = null;
  try{
    const saved = await apiPost(ev);              // se re-crea con su mismo id
    if(!EVENTS.find(x=>x.id===saved.id)) EVENTS.push(saved);
  }catch(e){
    if(!EVENTS.find(x=>x.id===ev.id)) EVENTS.push(ev);
  }
  render();
  hideToast();
}

async function toggleDone(id){
  const e = EVENTS.find(x=>x.id===id); if(!e) return;
  e.estado = e.estado==='entregado' ? 'pendiente' : 'entregado';
  try{ await apiPut(id,{estado:e.estado}); render(); }catch(err){ toast('No se pudo guardar'); }
}
function showImg(id){
  const e = EVENTS.find(x=>x.id===id); if(!e||!e.imagen) return;
  document.getElementById('lbImg').src = e.imagen;
  document.getElementById('lightbox').classList.add('show');
}

/* ---------------- modal / subir nota ---------------- */
const overlay = document.getElementById('overlay');
const modalBody = document.getElementById('modalBody');
const modalFoot = document.getElementById('modalFoot');
const modalTitle = document.getElementById('modalTitle');

function openModal(){ overlay.classList.add('show'); }
function closeModal(){ overlay.classList.remove('show'); modalFoot.style.display='none'; editingId=null; }
document.getElementById('closeModal').onclick = closeModal;
overlay.onclick = e=>{ if(e.target===overlay) closeModal(); };

function openNew(){
  editingId = null;
  modalTitle.textContent = 'Nueva nota';
  modalFoot.style.display = 'none';
  modalBody.innerHTML = `
    <div class="dropzone" id="drop">
      <div class="ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4m0 0 4 4m-4-4L8 8"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>
      <div class="t">Toca para tomar foto o subir la nota</div>
      <div class="h">Foto (JPG/PNG) o PDF de una nota impresa. La leo con OCR y saco los datos.</div>
    </div>
    <input type="file" id="fileInput" accept="image/*,application/pdf" style="display:none">`;
  openModal();
  const drop = document.getElementById('drop');
  const fi = document.getElementById('fileInput');
  drop.onclick = ()=>fi.click();
  fi.onchange = ()=>{ if(fi.files[0]) handleFile(fi.files[0]); };
  drop.ondragover = e=>{ e.preventDefault(); drop.classList.add('drag'); };
  drop.ondragleave = ()=>drop.classList.remove('drag');
  drop.ondrop = e=>{ e.preventDefault(); drop.classList.remove('drag'); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
}
document.getElementById('newBtn').onclick = openNew;

/* imagen -> dataURL comprimida (para guardar liviano y para OCR) */
function fileToImage(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=>{ const img = new Image(); img.onload=()=>res(img); img.onerror=rej; img.src=r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
function imageToCanvas(img, max){
  let {width:w,height:h} = img;
  if(w>max||h>max){ const s=max/Math.max(w,h); w=Math.round(w*s); h=Math.round(h*s); }
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h);
  return c;
}

/* reconstruye los renglones del PDF a partir de la capa de texto (por posición Y) */
async function pdfPageToText(page){
  const tc = await page.getTextContent();
  const items = tc.items.filter(i => i.str && i.str.trim());
  const rows = [];
  items.forEach(it=>{
    const x = it.transform[4], y = it.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) < 4);
    if(!row){ row = {y, cells:[]}; rows.push(row); }
    row.cells.push({x, s:it.str});
  });
  rows.sort((a,b)=>b.y-a.y); // de arriba hacia abajo
  return rows.map(r => r.cells.sort((a,b)=>a.x-b.x).map(c=>c.s).join(' ').replace(/\s+/g,' ').trim()).join('\n');
}

/* Lee y parsea una nota (foto o PDF). No toca el modal: solo procesa y regresa {parsed, thumb}.
   La usan tanto "subir nota nueva" como el botón "Volver a leer la nota" al editar. */
async function readNotaFile(file){
  const isPdf = file.type==='application/pdf';
  const setProg = (p,msg)=>{ const b=document.getElementById('ocrBar'); if(b)b.style.width=Math.round(p*100)+'%'; if(msg){const h=document.getElementById('ocrHint'); if(h)h.textContent=msg;} };

  if(isPdf){
    setProg(0.15,'Abriendo el PDF');
    const ready = await (window.__pdfjsReady || Promise.resolve(false));
    if(!ready || !window.pdfjsLib) throw new Error('pdfjs');
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({data:buf}).promise;
    const page = await pdf.getPage(1);               // SOLO hoja 1
    setProg(0.45,'Leyendo el texto del PDF');

    // miniatura para "ver nota"
    let thumb=null;
    try{
      const vp=page.getViewport({scale:1.2});
      const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
      await page.render({canvasContext:c.getContext('2d'), viewport:vp}).promise;
      thumb=c.toDataURL('image/jpeg',0.6);
    }catch(e){}

    const text = await pdfPageToText(page);
    if(text && text.replace(/\s/g,'').length > 20){   // PDF con texto real
      const parsed = parseNota(text); parsed.__raw = text;
      return {parsed, thumb};
    }
    // PDF escaneado (sin capa de texto) -> OCR de la imagen
    setProg(0.5,'PDF sin texto, usando OCR');
    const vp2=page.getViewport({scale:2});
    const c2=document.createElement('canvas'); c2.width=vp2.width; c2.height=vp2.height;
    await page.render({canvasContext:c2.getContext('2d'), viewport:vp2}).promise;
    const r = await Tesseract.recognize(c2,'spa',{logger:m=>{if(m.status==='recognizing text')setProg(0.5+m.progress*0.5,'Reconociendo el texto');}});
    const parsed = parseNota(r.data.text||''); parsed.__raw = r.data.text||'';
    return {parsed, thumb};
  }

  // ----- imagen (foto) -> OCR -----
  const img = await fileToImage(file);
  const ocrCanvas = imageToCanvas(img, 1800);
  const thumb = imageToCanvas(img, 1000).toDataURL('image/jpeg',0.6);
  setProg(0.2,'Reconociendo el texto');
  const { data } = await Tesseract.recognize(ocrCanvas, 'spa', {
    logger: m => { if(m.status==='recognizing text') setProg(0.2+m.progress*0.8,'Reconociendo el texto'); }
  });
  const parsed = parseNota(data.text || ''); parsed.__raw = data.text || '';
  return {parsed, thumb};
}

async function handleFile(file){
  modalBody.innerHTML = `<div class="loading"><div class="spinner"></div><div class="t">Leyendo la nota…</div><div class="h" id="ocrHint">Preparando</div><div class="bar"><i id="ocrBar"></i></div></div>`;
  try{
    const {parsed, thumb} = await readNotaFile(file);
    showReview(parsed, thumb);
  }catch(err){
    console.error(err);
    modalBody.innerHTML = `<div class="errbox">No pude leer la nota. Si es un PDF muy pesado o una foto borrosa, prueba con una foto más nítida y derecha. También puedes capturar a mano.</div>
      <button class="btn-primary" style="width:100%;justify-content:center" onclick="openNew()">Intentar otra vez</button>
      <button class="btn-ghost" style="width:100%;justify-content:center;margin-top:10px" onclick="showReview({productos:[]},null)">Capturar a mano</button>`;
  }
}

/* Releer la nota de un evento que ya existe (botón "Volver a leer la nota" al editar).
   Sustituye los campos del formulario por lo que se detecte en el archivo nuevo. */
async function rereadNota(file){
  const keepId = editingId;   // showReview no toca editingId, pero por claridad lo fijamos explícito después
  modalBody.innerHTML = `<div class="loading"><div class="spinner"></div><div class="t">Releyendo la nota…</div><div class="h" id="ocrHint">Preparando</div><div class="bar"><i id="ocrBar"></i></div></div>`;
  try{
    const {parsed, thumb} = await readNotaFile(file);
    editingId = keepId;
    showReview(parsed, thumb || modalBody.dataset.imagen || null);
    toast('Nota releída, revisa los datos antes de guardar');
  }catch(err){
    console.error(err);
    toast('No pude releer la nota');
    const e = EVENTS.find(x=>x.id===keepId);
    editingId = keepId;
    if(e) showReview({...e}, e.imagen||null);
  }
}

/* ---------------- parser calibrado a la nota de renta ---------------- */
function normalizeDate(raw){
  if(!raw) return '';
  raw = String(raw).toLowerCase();
  let m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m){ let[_,d,mo,y]=m; if(y.length===2) y='20'+y; return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  m = raw.match(/(\d{1,2})\s*de\s*([a-záéíóú]+)(?:\s*(?:de|del)?\s*(\d{4}))?/);
  if(m){ const mo=MESES_NUM[m[2]]; if(mo){ const y=m[3]||'2026'; return `${y}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; } }
  return '';
}

function parseNota(text){
  text = text || '';
  const lines = text.split(/\r?\n/).map(l=>l.replace(/\s+$/,'')).filter(l=>l.trim());
  const joined = lines.join(' ');
  const field = re => { const m = text.match(re); return m ? (m[1]||'').trim() : ''; };
  const grab  = re => { const m = joined.match(re); return m ? money(m[1]) : ''; };

  let clienteRaw = field(/CLIENTE:?\s*(.+)/i);
  // formato nuevo: "Cliente: Scarlet Robles · 3317244982" (tel pegado al nombre, sin línea "TELÉFONO:")
  const telInline = clienteRaw.match(/(\d[\d\s]{6,}\d)\s*$/);
  const telefono = (field(/TEL[EÉ]FONO:?\s*(\d[\d\s]{6,})/i) || field(/(?:cel|celular|whats?app?):?\s*(\d[\d\s]{6,})/i) || (telInline ? telInline[1] : '') || '').replace(/\D/g,'').slice(0,10);
  const cliente = clienteRaw.replace(/[·•,\-]?\s*\d[\d\s]{6,}\d\s*$/,'').trim();
  const lugar = field(/(?:DIRECCI[OÓ]N|DOMICILIO|LUGAR|SAL[OÓ]N):?\s*(.+)/i);
  const fecha = normalizeDate(
      field(/FECHA\s+DE?L?\s+ENTREGA:?\s*(.+)/i) ||
      field(/\bENTREGA:?\s*(.+)/i) ||                 // formato nuevo: "Entrega: 28/08/2026 ..."
      field(/FECHA(?:\s*DEL?\s*EVENTO)?:?\s*(.+)/i) || joined);
  const hora = (field(/HORA\s+DE\s+ENTREGA:?\s*([\d:]{3,8})/i) ||
      field(/HORA:?\s*([\d:\.apm ]{3,8})/i) ||
      field(/ENTREGA:?[^\n]*?a\s*las\s*([\d:]{3,8})/i) ||  // formato nuevo: "Entrega: ... a las 15:00:00"
      '').replace(/:00\s*$/,'').trim();
  const recoleccion = normalizeDate(
      field(/FECHA\s+DE\s+RECOLECCI[OÓ]N:?\s*(.+)/i) ||
      field(/\bRECOLECCI[OÓ]N:?\s*(.+)/i));            // formato nuevo: "Recolección: 29/08/2026"

  const total    = grab(/SUBTOTAL:?\s*\$?\s*([\d.,]+)/i) || grab(/TOTAL:?\s*\$?\s*([\d.,]+)/i);
  const anticipo = grab(/ANTICIPO\s*\d*\s*%?\s*:?\s*\$?\s*([\d.,]+)/i) || grab(/(?:ABONO)\s*:?\s*\$?\s*([\d.,]+)/i);
  const saldo    = grab(/(?:RESTANTE|SALDO|RESTA)\s*:?\s*\$?\s*([\d.,]+)/i);
  const deposito = grab(/GARANT[IÍ]A\s*\d*\s*%?\s*:?\s*\$?\s*([\d.,]+)/i);

  // productos
  const skipLabel = /^\s*(cliente|nombre|tel|correo|fecha|hora|lugar|direcci|domicilio|folio|producto|importe|de renta|cantidad|total|subtotal|anticipo|abono|restante|saldo|dep[oó]sito|garant|observaciones|incluye|renta de|a pagar)/i;
  const prodTabla  = /^(.+?)\s+\$\s*[\d,]+\.\d{2}\s+(\d+)\s+\$\s*[\d,]+\.\d{2}\s*$/;      // nombre  $precio  CANT  $total
  const prodMult   = /^(.+?)\s+(\d+)\s*[×xX]\s*\$?\s*[\d,]+\.\d{2}\s*$/;                  // formato nuevo: nombre  CANT × $precio  (el importe va en el renglón siguiente)
  const prodInicio = /^(\d{1,3})\s*(?:pz|pzs|piezas?|x)?\s*[\-\.\)]?\s+(.{2,})/i;          // respaldo: CANT descripción
  const soloImporte = /^\$\s*[\d,]+\.\d{2}\s*$/;                                          // renglón suelto con solo el importe (formato nuevo)
  const productos = [];
  for(const l0 of lines){
    const l = l0.trim();
    if(soloImporte.test(l)) continue;
    let m = l.match(prodTabla);
    if(m){ const d=m[1].trim(); if(d && !skipLabel.test(d)) productos.push({cantidad:m[2], descripcion:d}); continue; }
    if(skipLabel.test(l)) continue;
    m = l.match(prodMult);
    if(m){ const d=m[1].trim(); if(d.length>=2) productos.push({cantidad:m[2], descripcion:d}); continue; }
    m = l.match(prodInicio);
    if(m){ let d=m[2].replace(/\$?\s*[\d.,]+\s*$/,'').trim(); if(d.length>=2) productos.push({cantidad:m[1], descripcion:d}); }
  }

  // observaciones: bloque tras "OBSERVACIONES", quitando la columna financiera de la derecha
  const finTail = /(SUBTOTAL|ANTICIPO|RESTANTE|SALDO|DEP[OÓ]SITO|GARANT[IÍ]A|\d+\s*%|\$[\d.,]+).*/i;
  const obsStop = /^(SUBTOTAL|TOTAL\s|ANTICIPO|RESTANTE|SALDO|DEP[OÓ]SITO|GARANT[IÍ]A|A\s*PAGAR|INCLUYE\s)/i;
  const obs = [];
  const oi = lines.findIndex(l => /OBSERVACIONES/i.test(l));
  if(oi >= 0){
    for(let i=oi+1; i<lines.length; i++){
      if(obsStop.test(lines[i].trim())) break;         // llegamos al resumen de totales / texto legal: paramos aquí
      const left = lines[i].replace(finTail,'').trim();
      if(/[a-záéíóúñ]/i.test(left)) obs.push(left);
    }
  }
  const observaciones = obs.join('\n');

  return { cliente, telefono, fecha, hora, recoleccion, lugar, productos,
           observaciones, montaje:'', total, anticipo, saldo, deposito };
}

/* ---------------- formulario de revisión ---------------- */
function showReview(d, imagen){
  d = d || {}; d.productos = d.productos || [];
  const prods = d.productos.length ? d.productos : [{cantidad:'',descripcion:''}];
  modalTitle.textContent = editingId ? 'Editar evento' : 'Revisa los datos';
  modalBody.innerHTML = `
    ${imagen?`<img class="preview-thumb" src="${imagen}" alt="nota">`:''}
    ${editingId?`<button class="btn-ghost" id="rereadBtn" type="button" style="width:100%;justify-content:center;margin-bottom:12px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
      Volver a leer la nota</button><input type="file" id="rereadInput" accept="image/*,application/pdf" style="display:none">`:''}
    ${d.__raw?`<div class="raw-toggle" id="rawToggle">Ver texto que leí (OCR)</div><div class="raw-box" id="rawBox" style="display:none">${esc(d.__raw)}</div>`:''}
    <div class="field"><label>Cliente</label><input id="f-cliente" value="${esc(d.cliente)}"></div>
    <div class="row2">
      <div class="field"><label>Teléfono</label><input id="f-tel" value="${esc(d.telefono)}"></div>
      <div class="field"><label>Lugar del evento</label><input id="f-lugar" value="${esc(d.lugar)}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Fecha de entrega (AAAA-MM-DD)</label><input id="f-fecha" placeholder="2026-08-15" value="${esc(d.fecha)}"></div>
      <div class="field"><label>Hora de entrega</label><input id="f-hora" value="${esc(d.hora)}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Fecha de recolección</label><input id="f-recol" placeholder="2026-08-16" value="${esc(d.recoleccion)}"></div>
      <div class="field"><label>Depósito en garantía</label><input id="f-dep" value="${esc(d.deposito)}"></div>
    </div>
    <div class="field"><label>Productos a entregar</label><div id="prodWrap">
      ${prods.map(p=>prodRow(p)).join('')}
    </div><button class="add-prod" id="addProd">+ Agregar producto</button></div>
    <div class="field"><label>Observaciones</label><textarea id="f-obs">${esc(d.observaciones)}</textarea></div>
    <div class="field"><label>Montaje</label><textarea id="f-montaje">${esc(d.montaje)}</textarea></div>
    <div class="row3">
      <div class="field"><label>Subtotal</label><input id="f-total" value="${esc(d.total)}"></div>
      <div class="field"><label>Anticipo</label><input id="f-ant" value="${esc(d.anticipo)}"></div>
      <div class="field"><label>Restante</label><input id="f-saldo" value="${esc(d.saldo)}"></div>
    </div>`;
  modalBody.dataset.imagen = imagen || '';
  modalFoot.style.display = 'flex';
  modalFoot.innerHTML = `
    <button class="btn-ghost" id="cancelSave">Cancelar</button>
    <button class="btn-primary" id="saveBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>${editingId?'Guardar cambios':'Guardar evento'}</button>`;

  document.getElementById('cancelSave').onclick = closeModal;
  document.getElementById('saveBtn').onclick = saveFromForm;
  document.getElementById('addProd').onclick = ()=>{
    document.getElementById('prodWrap').insertAdjacentHTML('beforeend', prodRow({cantidad:'',descripcion:''}));
    bindDel();
  };
  const rt = document.getElementById('rawToggle');
  if(rt) rt.onclick = ()=>{ const b=document.getElementById('rawBox'); b.style.display = b.style.display==='none'?'block':'none'; };
  const rrBtn = document.getElementById('rereadBtn');
  if(rrBtn){
    const rrInput = document.getElementById('rereadInput');
    rrBtn.onclick = ()=> rrInput.click();
    rrInput.onchange = ()=>{ if(rrInput.files[0]) rereadNota(rrInput.files[0]); };
  }
  bindDel();
}
function prodRow(p){
  return `<div class="prod-edit">
    <input class="q pq" placeholder="cant." value="${esc(p.cantidad)}">
    <input class="pd" placeholder="descripción del producto" value="${esc(p.descripcion)}">
    <button class="del" title="Quitar">&times;</button></div>`;
}
function bindDel(){
  document.querySelectorAll('.prod-edit .del').forEach(b=>{
    b.onclick = ()=>{
      const rows = document.querySelectorAll('.prod-edit');
      if(rows.length>1) b.closest('.prod-edit').remove();
      else b.closest('.prod-edit').querySelectorAll('input').forEach(i=>i.value='');
    };
  });
}

async function saveFromForm(){
  const v = id => document.getElementById(id).value.trim();
  const productos = [...document.querySelectorAll('.prod-edit')].map(r=>({
    cantidad: r.querySelector('.pq').value.trim(),
    descripcion: r.querySelector('.pd').value.trim()
  })).filter(p=>p.descripcion);

  const base = {
    cliente:v('f-cliente'), telefono:v('f-tel'), lugar:v('f-lugar'),
    fecha:v('f-fecha'), hora:v('f-hora'), recoleccion:v('f-recol'),
    productos, observaciones:v('f-obs'), montaje:v('f-montaje'),
    total:v('f-total'), anticipo:v('f-ant'), saldo:v('f-saldo'), deposito:v('f-dep'),
    imagen: modalBody.dataset.imagen || null   // por si se releyó la nota con una foto/PDF nuevo
  };
  const btn = document.getElementById('saveBtn');
  btn.textContent = 'Guardando…';
  try{
    if(editingId){
      const updated = await apiPut(editingId, base);
      const i = EVENTS.findIndex(x=>x.id===editingId);
      if(i>=0) EVENTS[i] = updated;
      toast('Evento actualizado');
    }else{
      base.estado = 'pendiente';
      const saved = await apiPost(base);
      EVENTS.push(saved);
      toast('Evento guardado');
    }
    closeModal(); render();
  }catch(e){
    btn.textContent = editingId?'Guardar cambios':'Guardar evento';
    toast('No se pudo guardar');
  }
}

function editEvent(id){
  const e = EVENTS.find(x=>x.id===id); if(!e) return;
  editingId = id;
  openModal();
  showReview({...e}, e.imagen||null);
}

/* ---------------- lightbox / toast ---------------- */
document.getElementById('lbClose').onclick = ()=>document.getElementById('lightbox').classList.remove('show');
document.getElementById('lightbox').onclick = e=>{ if(e.target.id==='lightbox') e.currentTarget.classList.remove('show'); };
let toastT;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2400);
}

/* ---------------- filtros / búsqueda ---------------- */
document.getElementById('filters').addEventListener('click', e=>{
  const b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#filters button').forEach(x=>x.classList.remove('on'));
  b.classList.add('on'); FILTER = b.dataset.f; renderBoard();
});
document.getElementById('search').addEventListener('input', e=>{ QUERY = e.target.value; renderBoard(); });

/* ---------------- init ---------------- */
(async ()=>{ await loadEvents(); render(); })();
