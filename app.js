/* ============================================================
   ARMA app.js v4.0 — ALL BUGS FIXED
   Fix 1: Design / layout
   Fix 2: Pre-baked coords, correct marker→record mapping
   Fix 3: PDF works via record ID lookup
   Fix 4: Sidebar scrollable, sorted by oblast
   Fix 5: ID_Групи case grouping + search
   Fix 7: All card fields populated
   Fix 8: Land kadastr coords from KOATUU
   ============================================================ */
'use strict';

const TABS = [
  {id:'home',       label:'🏠 Огляд',       file:null},
  {id:'realestate', label:'🏢 Нерухомість',  file:'realestate.json', cnt:'realestate'},
  {id:'land',       label:'🌾 Земля',        file:'land.json',        cnt:'land'},
  {id:'transport',  label:'🚗 Транспорт',    file:'transport.json',   cnt:'transport', cards:true},
  {id:'corp',       label:'📊 Корп. права',  file:'corp.json',        cnt:'corp',      cards:true},
  {id:'money',      label:'💰 Кошти',        file:'money.json',       cnt:'money',     cards:true},
  {id:'movable',    label:'📦 Рухоме',       file:'movable.json',     cnt:'movable',   cards:true},
  {id:'other',      label:'🗂 Інше',         file:'other.json',       cnt:'other',     cards:true},
];

const CAT_LABELS = {
  transport:'Транспорт', corp:'Корпоративні права',
  money:'Грошові кошти та метали', movable:'Рухоме майно', other:'Інше майно'
};

// ─── STATE ───────────────────────────────────────────────────
const ST = {
  page:'home', search:'', groupFilter:'',
  re:    {arr:'all', cmplx:'all', mgr:'all', pg:0, ps:60},
  land:  {arr:'all', mgr:'all',              pg:0, ps:60},
  cards: {arr:'all', cmplx:'all', mgr:'all', pg:0, ps:80, key:null},
  expandedId: null,
};
const CACHE = {};
let STATS = {};

// ─── UTILS ───────────────────────────────────────────────────
const fmt = n => Number(n||0).toLocaleString('uk-UA');
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function arrType(s){
  if(!s) return 'u'; s=s.toLowerCase();
  if(s.includes('конфіскац')||s.includes('стягнення')) return 'c';
  if(s.includes('нац')) return 'n';
  if(s.includes('арештовано')) return 'a';
  if(s.includes('скасування')) return 'x';
  if(s.includes('не арешт')) return 'z';
  return 'u';
}
const ARR_LBL = {a:'Арешт',c:'Конфіск.',n:'Націонал.',x:'Скасовано',z:'Не арешт.',u:'—'};
const ARR_CLR = {a:'#f97316',c:'#10b981',n:'#8b5cf6',x:'#ef4444',z:'#6b7280',u:'#9ca3af'};
const ARR_BC  = {a:'badge-arrested',c:'badge-confiscated',n:'badge-national',x:'badge-cancelled',z:'badge-notarr',u:'badge-notarr'};

function flt(data, f, groupF){
  const q = ST.search.toLowerCase();
  return data.filter(r=>{
    if(f.arr  !== 'all' && arrType(r.arr) !== f.arr) return false;
    if(f.cmplx === 'simple'  && r.complex !== 'simple')  return false;
    if(f.cmplx === 'complex' && r.complex !== 'complex') return false;
    if(f.mgr === 'yes' && !r.has_manager) return false;
    if(f.mgr === 'no'  &&  r.has_manager) return false;
    // Group filter (Task 5)
    if(groupF) {
      const g = r.group||''; 
      if(g !== groupF) return false;
    }
    if(q){
      const hay = [r.id,r.addr,r.city,r.oblast,r.own,r.desc,r.kadastr,r.manager,r.type,r.group]
        .filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

function updFbtns(container, f){
  if(!container) return;
  container.querySelectorAll('.fbtn').forEach(b=>{
    b.classList.remove('active','red','green','purple','orange','teal');
    if(b.dataset.v === f[b.dataset.f]){
      b.classList.add('active');
      const v = b.dataset.v;
      if(v==='arrested')   b.classList.add('orange');
      if(v==='confiscated'||v==='yes') b.classList.add('green');
      if(v==='national'||v==='complex') b.classList.add('purple');
      if(v==='cancelled')  b.classList.add('red');
    }
  });
}

// ─── PDF EXPORT ──────────────────────────────────────────────
function downloadPDF(recordId, catKey){
  // Lookup record from cache — no JSON.stringify needed in onclick
  let data = null;
  if(catKey) {
    data = (CACHE[catKey+'.json']||[]).find(r=>r.id===recordId);
  } else {
    // Search all caches
    for(const [k,v] of Object.entries(CACHE)){
      const found = v.find(r=>r.id===recordId);
      if(found){ data=found; break; }
    }
  }
  if(!data){ alert('Запис не знайдено'); return; }
  const r = data;
  const val = r.value ? `${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}` : '—';
  const dt = new Date().toLocaleDateString('uk-UA');
  const html = `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>АРМА · ${esc(r.id)}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:750px;margin:auto}
h1{font-size:17px;font-weight:800;color:#1a3ea8;border-bottom:3px solid #1a3ea8;padding-bottom:7px;margin-bottom:14px}
.meta{color:#64748b;font-size:11px;margin-bottom:18px}
.sec{margin-bottom:14px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden}
.sec h2{font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;background:#f8fafc;padding:6px 10px;margin:0;border-bottom:1px solid #e5e7eb}
.row{display:flex;gap:10px;padding:5px 10px;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:none}
.lbl{color:#6b7280;min-width:140px;flex-shrink:0;font-size:11px}
.val{color:#111;flex:1;font-size:12px;word-break:break-word}
.bold{font-weight:700}
.desc{padding:8px 10px;font-size:11.5px;color:#374151;line-height:1.6;background:#f9fafb;white-space:pre-wrap}
.foot{margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body>
<h1>📋 Картка активу АРМА</h1>
<div class="meta">ID: <b>${esc(r.id)}</b>${r.group&&r.group!=='Груповано'?` · Група: <b>${esc(r.group)}</b>`:''} · Дата виводу: ${dt}</div>
<div class="sec"><h2>⚖ Статус</h2>
<div class="row"><span class="lbl">Стан арешту</span><span class="val bold">${esc(r.arr||'—')}</span></div>
<div class="row"><span class="lbl">Складність</span><span class="val">${r.complex==='complex'?'Складний (Композитний)':r.complex==='simple'?'Простий':'—'}</span></div>
${r.inv_status?`<div class="row"><span class="lbl">Статус інв.</span><span class="val">${esc(r.inv_status)}</span></div>`:''}
${r.zone?`<div class="row"><span class="lbl">Зонування</span><span class="val">${esc(r.zone)}</span></div>`:''}
</div>
<div class="sec"><h2>📍 Адреса / Місцезнаходження</h2>
${r.addr?`<div class="row"><span class="lbl">Повна адреса</span><span class="val bold">${esc(r.addr)}</span></div>`:''}
${r.city?`<div class="row"><span class="lbl">Місто/НП</span><span class="val">${esc(r.city)}</span></div>`:''}
${r.district?`<div class="row"><span class="lbl">Район</span><span class="val">${esc(r.district)}</span></div>`:''}
${r.oblast?`<div class="row"><span class="lbl">Область</span><span class="val">${esc(r.oblast)}</span></div>`:''}
${r.kadastr?`<div class="row"><span class="lbl">Кадастр. №</span><span class="val" style="font-family:monospace">${esc(r.kadastr)}</span></div>`:''}
<div class="row"><span class="lbl">Координати</span><span class="val" style="font-family:monospace">${r.lat}, ${r.lng} <span style="color:#6b7280">(${r.geo_quality==='city'?'місто':r.geo_quality==='oblast'?'область':'приблизно'})</span></span></div>
</div>
<div class="sec"><h2>🏷 Класифікація</h2>
${r.type?`<div class="row"><span class="lbl">Вид активу</span><span class="val">${esc(r.type)}</span></div>`:''}
${r.dept?`<div class="row"><span class="lbl">Відділ МА</span><span class="val">${esc(r.dept)}</span></div>`:''}
${r.mtu?`<div class="row"><span class="lbl">МТУ</span><span class="val">${esc(r.mtu)}</span></div>`:''}
${r.date?`<div class="row"><span class="lbl">Дата рішення</span><span class="val">${esc(r.date)}</span></div>`:''}
</div>
${r.own||r.manager?`<div class="sec"><h2>👤 Власник / Управитель</h2>
${r.own?`<div class="row"><span class="lbl">Власник</span><span class="val">${esc(r.own)}</span></div>`:''}
${r.manager?`<div class="row"><span class="lbl">Управитель</span><span class="val">${esc(r.manager)}</span></div>`:''}
${r.contract?`<div class="row"><span class="lbl">Договір</span><span class="val">${esc(r.contract)}</span></div>`:''}
</div>`:''}
<div class="sec"><h2>💵 Фінанси / Стан</h2>
<div class="row"><span class="lbl">Вартість</span><span class="val bold">${val}</span></div>
${r.usage?`<div class="row"><span class="lbl">Використання</span><span class="val">${esc(r.usage)}</span></div>`:''}
${r.condition?`<div class="row"><span class="lbl">Фіз. стан</span><span class="val">${esc(r.condition)}</span></div>`:''}
${r.notes?`<div class="row"><span class="lbl">Примітки</span><span class="val">${esc(r.notes)}</span></div>`:''}
</div>
${r.desc?`<div class="sec"><h2>📝 Повний опис</h2><div class="desc">${esc(r.desc)}</div></div>`:''}
${r.court?`<div class="sec"><h2>⚖ Судові рішення</h2><div class="desc">${esc(r.court)}</div></div>`:''}
<div class="foot">Документ сформовано автоматично · АРМА України · ${dt}</div>
</body></html>`;
  const blob = new Blob([html],{type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ARMA_${r.id.replace(/\//g,'_')}.html`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

// ─── DETAIL PANEL ────────────────────────────────────────────
function buildDP(r, type){
  const lv = r.geo_quality||'fallback';
  const osmUrl = `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}&zoom=17`;
  const gmUrl  = `https://www.google.com/maps/place/${r.lat},${r.lng}/@${r.lat},${r.lng},17z`;
  const val    = r.value ? `${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}` : '—';
  const geoLbl = lv==='city'?'📍 Місто':lv==='oblast'?'📍 Область':lv==='fallback'?'📍 Приблизно':'📍 Точно';
  const geoCls = lv==='city'?'badge-geo-city':lv==='oblast'||lv==='fallback'?'badge-geo-oblast':'badge-geo-exact';
  
  // Group search link
  const grpBtn = r.group && r.group!=='Груповано'
    ? `<button class="dp-btn" onclick="APP.searchGroup('${esc(r.group)}')" title="Всі активи цієї справи">📂 Справа №${esc(r.group)}</button>`
    : '';

  return `
<div class="dp-top">
  <button class="dp-close" onclick="closeDP('${type}')">✕</button>
  <div class="dp-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · <span style="color:var(--blue);cursor:pointer" onclick="APP.searchGroup('${esc(r.group)}')" title="Показати всі активи цієї справи">Справа №${esc(r.group)}</span>`:''}</div>
  <div class="dp-title">${esc((r.desc||r.type||'').slice(0,180))}${(r.desc||'').length>180?'…':''}</div>
  <div class="dp-badges">
    <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]||'—'}</span>
    ${r.complex==='simple' ?'<span class="badge badge-simple">Простий</span>':''}
    ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
    ${r.has_manager?'<span class="badge badge-managed">🛡 Упр-ль</span>':''}
    <span class="badge ${geoCls}">${geoLbl}</span>
  </div>
</div>
<div class="dp-actions">
  <button class="dp-btn primary" onclick="focusMarker('${esc(r.id)}','${type}')">🎯 На карті</button>
  <a class="dp-btn" href="${osmUrl}" target="_blank">🌐 OSM</a>
  <a class="dp-btn" href="${gmUrl}"  target="_blank">🗺 Google</a>
  ${r.kadastr?`<a class="dp-btn kad" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(r.kadastr)}" target="_blank">📋 Кадастр</a>`:''}
  ${grpBtn}
  <button class="dp-btn pdf-btn" onclick="downloadPDF('${esc(r.id)}','${type==='re'?'realestate':type}')">📄 PDF</button>
</div>
<div class="dp-sec">
  <h4>📍 Адреса</h4>
  ${r.addr?`<div class="dp-row"><span class="dp-l">Адреса</span><span class="dp-v bold">${esc(r.addr)}</span></div>`:''}
  ${r.city?`<div class="dp-row"><span class="dp-l">Місто/НП</span><span class="dp-v">${esc((r.settlement_type||'м.')+'. '+r.city)}</span></div>`:''}
  ${r.district?`<div class="dp-row"><span class="dp-l">Район</span><span class="dp-v">${esc(r.district)}</span></div>`:''}
  ${r.oblast?`<div class="dp-row"><span class="dp-l">Область</span><span class="dp-v">${esc(r.oblast)}</span></div>`:''}
  ${r.kadastr?`<div class="dp-row"><span class="dp-l">Кадастр. №</span><span class="dp-v mono">${esc(r.kadastr)}</span></div>`:''}
  <div class="dp-row"><span class="dp-l">Координати</span>
    <span class="dp-v mono" style="font-size:10.5px">${r.lat}, ${r.lng}
      <span style="color:${lv==='city'||lv==='oblast'?'#f59e0b':'#10b981'}"> ● ${lv==='city'?'місто':lv==='oblast'?'область':'приблизно'}</span>
    </span>
  </div>
</div>
<div class="dp-sec">
  <h4>🏷 Класифікація</h4>
  ${r.type?`<div class="dp-row"><span class="dp-l">Вид</span><span class="dp-v">${esc(r.type)}</span></div>`:''}
  <div class="dp-row"><span class="dp-l">Складність</span><span class="dp-v">${r.complex==='complex'?'Складний':r.complex==='simple'?'Простий':'—'}</span></div>
  ${r.zone?`<div class="dp-row"><span class="dp-l">Зонування</span><span class="dp-v">${esc(r.zone)}</span></div>`:''}
  ${r.dept?`<div class="dp-row"><span class="dp-l">Відділ</span><span class="dp-v">${esc(r.dept)}</span></div>`:''}
  ${r.mtu ?`<div class="dp-row"><span class="dp-l">МТУ</span><span class="dp-v">${esc(r.mtu)}</span></div>`:''}
  ${r.inv_status?`<div class="dp-row"><span class="dp-l">Статус інв.</span><span class="dp-v" style="font-size:11px">${esc(r.inv_status)}</span></div>`:''}
  ${r.date?`<div class="dp-row"><span class="dp-l">Дата рішення</span><span class="dp-v">${esc(r.date)}</span></div>`:''}
</div>
${r.own||r.manager?`<div class="dp-sec"><h4>👤 Власник / Управитель</h4>
  ${r.own    ?`<div class="dp-row"><span class="dp-l">Власник</span><span class="dp-v">${esc(r.own)}</span></div>`:''}
  ${r.manager?`<div class="dp-row"><span class="dp-l">Управитель</span><span class="dp-v">${esc(r.manager)}</span></div>`:''}
  ${r.contract?`<div class="dp-row"><span class="dp-l">Договір</span><span class="dp-v">${esc(r.contract)}</span></div>`:''}
</div>`:''}
<div class="dp-sec">
  <h4>💵 Фінанси / Стан</h4>
  <div class="dp-row"><span class="dp-l">Вартість</span><span class="dp-v bold">${val}</span></div>
  ${r.usage    ?`<div class="dp-row"><span class="dp-l">Використання</span><span class="dp-v">${esc(r.usage)}</span></div>`:''}
  ${r.condition?`<div class="dp-row"><span class="dp-l">Фіз. стан</span><span class="dp-v">${esc(r.condition)}</span></div>`:''}
  ${r.notes    ?`<div class="dp-row"><span class="dp-l">Примітки</span><span class="dp-v">${esc(r.notes)}</span></div>`:''}
</div>
${r.court?`<div class="dp-sec"><h4>⚖ Судові рішення</h4><p class="dp-desc">${esc(r.court)}</p></div>`:''}
<div class="dp-sec" style="border:none"><h4>📝 Опис</h4><p class="dp-desc">${esc(r.desc||'—')}</p></div>`;
}

function closeDP(type){
  const id = type==='land'?'land-detail':'re-detail';
  document.getElementById(id).classList.remove('show');
}

// ─── REAL ESTATE MAP ─────────────────────────────────────────
const REMAP = (()=>{
  let map=null, cluster=null, markerMap={}, hlM=null, selId=null;

  function initMap(){
    if(map){ map.invalidateSize(); return; }
    map = L.map('map',{center:[49,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OpenStreetMap © CARTO',maxZoom:19,subdomains:'abcd'}).addTo(map);
    cluster = L.markerClusterGroup({
      chunkedLoading:true, maxClusterRadius:50, spiderfyOnMaxZoom:true,
      showCoverageOnHover:false, animate:true
    });
    map.addLayer(cluster);
  }

  function mkIcon(color, selected=false, size=14){
    const sz = selected ? 28 : size;
    return L.divIcon({
      className:'',
      html: selected
        ? `<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.22;animation:mPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 3px ${color}55,0 4px 18px rgba(0,0,0,.4)"></div>
           </div>`
        : `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 5px rgba(0,0,0,.28)"></div>`,
      iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]
    });
  }

  function renderMarkers(filtered){
    cluster.clearLayers(); markerMap={};
    const mkrs = filtered.map(r=>{
      const color = ARR_CLR[arrType(r.arr)]||'#9ca3af';
      const m = L.marker([r.lat, r.lng], {icon:mkIcon(color)});
      // CRITICAL FIX: use record ID, not array index
      m._assetId = r.id;
      m.on('click', ()=> REMAP.select(r.id, false));
      m.bindPopup(`
        <div class="lp-id">${esc(r.id)}</div>
        <div class="lp-title">${esc((r.desc||'').slice(0,90))}${(r.desc||'').length>90?'…':''}</div>
        <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
        <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
        <br><br><span class="lp-link" onclick="REMAP.select('${r.id}',false)">→ Відкрити картку</span>
      `, {maxWidth:300});
      markerMap[r.id] = m;
      return m;
    });
    if(mkrs.length) cluster.addLayers(mkrs);
  }

  function renderList(filtered){
    const {pg, ps} = ST.re;
    const total = filtered.length, pages = Math.ceil(total/ps)||1;
    const items = filtered.slice(pg*ps, pg*ps+ps);
    document.getElementById('re-cnt').textContent = fmt(total);

    // Group by oblast for display headers
    let lastOblast = null;
    let html = '';
    items.forEach(r => {
      const obl = r.oblast || 'Інше';
      if(obl !== lastOblast){
        html += `<div class="sb-oblast-header">${esc(obl)}</div>`;
        lastOblast = obl;
      }
      html += `
        <div class="asset-item ${r.id===selId?'selected':''}" data-id="${esc(r.id)}" onclick="REMAP.select('${esc(r.id)}',true)">
          <div class="ai-id"><span>${esc(r.id)}</span>${r.group&&r.group!=='Груповано'?`<span class="ai-group" onclick="event.stopPropagation();APP.searchGroup('${esc(r.group)}')">Справа №${esc(r.group)}</span>`:''}</div>
          <div class="ai-title">${esc((r.desc||r.type||'').slice(0,110))}${(r.desc||'').length>110?'…':''}</div>
          <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
          <div class="ai-badges">
            <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
            ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
            ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
            ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
          </div>
        </div>`;
    });
    if(!items.length) html = '<div class="no-results">Нічого не знайдено</div>';
    document.getElementById('re-list').innerHTML = html;

    // Pagination
    const pgn = document.getElementById('re-pgn');
    if(total > ps){
      pgn.style.display='flex';
      pgn.innerHTML=`
        <button class="pgn-btn" ${pg===0?'disabled':''} onclick="REMAP.pgChange(-1)">‹</button>
        <span style="font-size:11px;padding:0 8px">${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="REMAP.pgChange(1)">›</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const data = CACHE['realestate.json']||[];
    const filtered = flt(data, ST.re, ST.groupFilter);
    renderList(filtered);
    renderMarkers(filtered);
    updFbtns(document.getElementById('re-sidebar'), ST.re);
  }

  function select(id, fromList){
    const data = CACHE['realestate.json']||[];
    const r = data.find(x=>x.id===id);
    if(!r) return;
    selId = id;

    // Highlight list
    document.querySelectorAll('#re-list .asset-item').forEach(el=>{
      el.classList.toggle('selected', el.dataset.id===id);
      if(el.dataset.id===id && !fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });

    // Remove old highlight
    if(hlM){ try{map.removeLayer(hlM);}catch(e){} hlM=null; }

    // Fly to THIS record's exact coords
    map.flyTo([r.lat, r.lng], r.geo_quality==='city'?15:13, {duration:0.6});

    // Create pulsing marker at EXACT record coords
    const color = ARR_CLR[arrType(r.arr)]||'#9ca3af';
    hlM = L.marker([r.lat, r.lng], {icon:mkIcon(color, true), zIndexOffset:2000})
      .addTo(map)
      .bindPopup(`
        <div class="lp-id">${esc(r.id)}</div>
        <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
        <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
      `, {maxWidth:280}).openPopup();

    // Show detail panel
    const dp = document.getElementById('re-detail');
    dp.innerHTML = buildDP(r, 're');
    dp.classList.add('show');
    dp.scrollTop = 0;
  }

  function focusMk(id){
    const r = (CACHE['realestate.json']||[]).find(x=>x.id===id);
    if(!r) return;
    map.flyTo([r.lat, r.lng], 15, {duration:0.6});
    if(markerMap[id]) cluster.zoomToShowLayer(markerMap[id]);
  }

  return {
    init:initMap, render, select, focusMk,
    filter:(btn)=>{ ST.re[btn.dataset.f]=btn.dataset.v; ST.re.pg=0; render(); },
    pgChange:(d)=>{ ST.re.pg=Math.max(0,ST.re.pg+d); renderList(flt(CACHE['realestate.json']||[],ST.re,ST.groupFilter)); },
  };
})();

// ─── LAND MAP ────────────────────────────────────────────────
const LANDMAP = (()=>{
  let map=null, cluster=null, markerMap={}, hlM=null, kadLyr=null, loaded={}, selId=null;

  function initMap(){
    if(map){ map.invalidateSize(); return; }
    map = L.map('map-land',{center:[49,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OSM © CARTO',maxZoom:19,subdomains:'abcd'});
    carto.addTo(map);
    cluster = L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false});
    map.addLayer(cluster);
    kadLyr = L.layerGroup().addTo(map);
  }

  function mkIcon(r, selected=false){
    const color = ARR_CLR[arrType(r.arr)]||'#9ca3af';
    const hk = !!r.kadastr, sz = selected?28:(hk?14:11);
    return L.divIcon({
      className:'',
      html: selected
        ? `<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.22;animation:mPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:${hk?'3px':'50%'};background:${color};border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.4)"></div>
           </div>`
        : `<div style="position:relative;display:inline-block">
            <div style="width:${sz}px;height:${sz}px;border-radius:${hk?'3px':'50%'};background:${color};border:1.5px solid rgba(255,255,255,.9);box-shadow:0 1px 5px rgba(0,0,0,.22)"></div>
            ${hk?`<div style="position:absolute;bottom:-2px;right:-2px;width:5px;height:5px;border-radius:50%;background:#06b6d4;border:1px solid #fff"></div>`:''}
           </div>`,
      iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]
    });
  }

  function renderMarkers(filtered){
    cluster.clearLayers(); markerMap={};
    const mkrs = filtered.map(r=>{
      const m = L.marker([r.lat, r.lng], {icon:mkIcon(r)});
      m._assetId = r.id;
      m.on('click', ()=> LANDMAP.select(r.id, false));
      m.bindPopup(`
        <div class="lp-id">${esc(r.id)}</div>
        <div class="lp-title">${esc((r.type||'Земельна ділянка').slice(0,80))}</div>
        <div class="lp-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
        ${r.kadastr?`<div style="margin:4px 0;font-family:monospace;font-size:10px;color:#0e7490">📋 ${r.kadastr}</div>`:''}
        <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
        <br><br><span class="lp-link" onclick="LANDMAP.select('${r.id}',false)">→ Картку</span>
      `, {maxWidth:300});
      markerMap[r.id] = m;
      return m;
    });
    if(mkrs.length) cluster.addLayers(mkrs);
  }

  function renderList(filtered){
    const {pg, ps} = ST.land;
    const total = filtered.length, pages = Math.ceil(total/ps)||1;
    const items = filtered.slice(pg*ps, pg*ps+ps);
    document.getElementById('land-cnt').textContent = fmt(total);

    let lastOblast=null, html='';
    items.forEach(r=>{
      const obl = r.oblast||'Інше';
      if(obl!==lastOblast){ html+=`<div class="sb-oblast-header">${esc(obl)}</div>`; lastOblast=obl; }
      html+=`
        <div class="asset-item ${r.id===selId?'selected':''}" data-id="${esc(r.id)}" onclick="LANDMAP.select('${esc(r.id)}',true)">
          <div class="ai-id"><span>${esc(r.id)}</span>${r.kadastr?`<span class="ai-kad">${r.kadastr.slice(-8)}</span>`:''}</div>
          <div class="ai-title">${esc((r.type||'Земельна ділянка').slice(0,80))}</div>
          <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
          <div class="ai-badges">
            <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
            ${r.kadastr?'<span class="badge-kad">📋 Кадастр</span>':''}
            ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
          </div>
        </div>`;
    });
    if(!items.length) html='<div class="no-results">Нічого не знайдено</div>';
    document.getElementById('land-list').innerHTML=html;

    const pgn=document.getElementById('land-pgn');
    if(total>ps){
      pgn.style.display='flex';
      pgn.innerHTML=`<button class="pgn-btn" ${pg===0?'disabled':''} onclick="LANDMAP.pgChange(-1)">‹</button>
        <span style="font-size:11px;padding:0 8px">${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="LANDMAP.pgChange(1)">›</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const data = CACHE['land.json']||[];
    const filtered = flt(data, ST.land, ST.groupFilter);
    renderList(filtered); renderMarkers(filtered);
    updFbtns(document.getElementById('land-sidebar'), ST.land);
  }

  async function loadKad(kad, lat, lng){
    if(loaded[kad]) return;
    kadLyr.clearLayers(); // Clear old boundaries
    const apis=[
      `https://kadastr.live/api/parcel?cadnum=${encodeURIComponent(kad)}`,
      `https://map.land.gov.ua/gis/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastr:cadnum&outputFormat=application/json&CQL_FILTER=cadnum='${kad}'`,
    ];
    for(const url of apis){
      try{
        const res=await fetch(url,{signal:AbortSignal.timeout(6000)});
        if(!res.ok) continue;
        const d=await res.json();
        let gj = d.type==='Feature'||d.type==='FeatureCollection'?d : d.geometry?{type:'Feature',geometry:d.geometry}:null;
        if(!gj&&d.features&&d.features.length) gj=d;
        if(!gj) continue;
        const lyr=L.geoJSON(gj,{style:{color:'#0891b2',weight:2.5,fillColor:'#06b6d4',fillOpacity:.18}});
        lyr.addTo(kadLyr); loaded[kad]=true;
        try{ map.fitBounds(lyr.getBounds(),{padding:[40,40],maxZoom:17}); }catch(e){}
        L.marker(lyr.getBounds().getCenter(),{
          icon:L.divIcon({className:'',html:`<div style="background:rgba(8,145,178,.9);color:#fff;padding:2px 7px;border-radius:5px;font-size:9.5px;font-weight:700;white-space:nowrap;font-family:monospace;box-shadow:0 2px 8px rgba(0,0,0,.25)">${kad}</div>`,iconAnchor:[60,10]}),
          interactive:false}).addTo(kadLyr);
        return;
      }catch(e){ continue; }
    }
    // API failed — just zoom to coords
    map.flyTo([lat,lng],14,{duration:.6});
  }

  function select(id, fromList){
    const data = CACHE['land.json']||[];
    const r = data.find(x=>x.id===id);
    if(!r) return;
    selId=id;
    document.querySelectorAll('#land-list .asset-item').forEach(el=>{
      el.classList.toggle('selected', el.dataset.id===id);
      if(el.dataset.id===id && !fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });

    if(hlM){ try{map.removeLayer(hlM);}catch(e){} hlM=null; }
    map.flyTo([r.lat, r.lng], 13, {duration:0.6});
    hlM = L.marker([r.lat, r.lng], {icon:mkIcon(r,true), zIndexOffset:2000}).addTo(map);

    if(r.kadastr) loadKad(r.kadastr, r.lat, r.lng);

    let kadSec='';
    if(r.kadastr){
      kadSec=`<div class="dp-sec" style="background:rgba(6,182,212,.06);border-color:rgba(6,182,212,.2)">
        <h4>🗺 Кадастрова ділянка</h4>
        <div class="dp-row"><span class="dp-l">Кадастр. №</span><span class="dp-v mono">${esc(r.kadastr)}</span></div>
        <div class="dp-row"><span class="dp-l">Область (КОАТУУ)</span><span class="dp-v">${esc(r.oblast||'—')}</span></div>
        <div class="dp-actions" style="padding:8px 0 0">
          <a class="dp-btn kad" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(r.kadastr)}" target="_blank">🌐 kadastrova-karta.com</a>
          <a class="dp-btn" href="https://map.land.gov.ua/kadastrova-karta?cadnum=${r.kadastr}" target="_blank">🏛 ПКК</a>
        </div>
        <div style="margin-top:8px;font-size:10.5px;color:var(--mid)">Межі завантажуються автоматично при відкритті картки</div>
      </div>`;
    }

    const dp = document.getElementById('land-detail');
    dp.innerHTML = buildDP(r,'land') + kadSec;
    dp.classList.add('show'); dp.scrollTop=0;
  }

  return {
    init:initMap, render, select,
    filter:(btn)=>{ ST.land[btn.dataset.f]=btn.dataset.v; ST.land.pg=0; render(); },
    pgChange:(d)=>{ ST.land.pg=Math.max(0,ST.land.pg+d); renderList(flt(CACHE['land.json']||[],ST.land,ST.groupFilter)); },
    focusMk:(id)=>{ const r=(CACHE['land.json']||[]).find(x=>x.id===id); if(r) map.flyTo([r.lat,r.lng],14,{duration:.6}); },
  };
})();

// ─── CARDS ───────────────────────────────────────────────────
const CARDS = (()=>{
  function renderExpand(r){
    const val = r.value ? `${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}` : '—';
    const loc  = [r.city, r.oblast].filter(Boolean).join(', ') || '—';
    const grpBtn = r.group&&r.group!=='Груповано'
      ? `<button class="dp-btn" onclick="APP.searchGroup('${esc(r.group)}')">📂 Справа №${esc(r.group)}</button>` : '';
    return `
      <div class="card-expand" id="ce-${esc(r.id)}">
        <div class="ce-head">
          <div>
            <div class="dp-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · <span style="color:var(--blue);cursor:pointer" onclick="APP.searchGroup('${esc(r.group)}')">Справа №${esc(r.group)}</span>`:''}</div>
            <div class="dp-title">${esc((r.desc||r.type||'').slice(0,200))}${(r.desc||'').length>200?'…':''}</div>
            <div class="dp-badges">
              <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]||'—'}</span>
              ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
              ${r.has_manager?'<span class="badge badge-managed">🛡 Упр-ль</span>':''}
            </div>
          </div>
          <button class="ce-close" onclick="CARDS.closeExpand()">✕</button>
        </div>
        <div class="ce-body">
          <div class="ce-sec">
            <h4>📍 Місцезнаходження</h4>
            ${r.city||r.oblast?`<div class="dp-row"><span class="dp-l">Місце</span><span class="dp-v">${esc(loc)}</span></div>`:''}
            ${r.own   ?`<div class="dp-row"><span class="dp-l">Власник</span><span class="dp-v">${esc(r.own.slice(0,120))}</span></div>`:''}
            ${r.manager?`<div class="dp-row"><span class="dp-l">Управитель</span><span class="dp-v">${esc(r.manager.slice(0,100))}</span></div>`:''}
            ${r.contract?`<div class="dp-row"><span class="dp-l">Договір</span><span class="dp-v">${esc(r.contract)}</span></div>`:''}
          </div>
          <div class="ce-sec">
            <h4>💵 Фінанси / Реквізити</h4>
            <div class="dp-row"><span class="dp-l">Вартість</span><span class="dp-v bold">${val}</span></div>
            ${r.zone?`<div class="dp-row"><span class="dp-l">Зонування</span><span class="dp-v">${esc(r.zone)}</span></div>`:''}
            ${r.dept?`<div class="dp-row"><span class="dp-l">Відділ</span><span class="dp-v">${esc(r.dept)}</span></div>`:''}
            ${r.mtu ?`<div class="dp-row"><span class="dp-l">МТУ</span><span class="dp-v">${esc(r.mtu)}</span></div>`:''}
            ${r.date?`<div class="dp-row"><span class="dp-l">Дата рішення</span><span class="dp-v">${esc(r.date)}</span></div>`:''}
            ${r.inv_status?`<div class="dp-row"><span class="dp-l">Статус інв.</span><span class="dp-v">${esc(r.inv_status)}</span></div>`:''}
            ${r.usage?`<div class="dp-row"><span class="dp-l">Використання</span><span class="dp-v">${esc(r.usage)}</span></div>`:''}
            ${r.condition?`<div class="dp-row"><span class="dp-l">Фіз. стан</span><span class="dp-v">${esc(r.condition)}</span></div>`:''}
            ${r.notes?`<div class="dp-row"><span class="dp-l">Примітки</span><span class="dp-v">${esc(r.notes)}</span></div>`:''}
          </div>
          ${r.court?`<div class="ce-sec" style="grid-column:1/-1"><h4>⚖ Судові рішення</h4><p class="dp-desc">${esc(r.court)}</p></div>`:''}
          <div class="ce-sec" style="grid-column:1/-1"><h4>📝 Повний опис</h4><p class="dp-desc">${esc(r.desc||'—')}</p></div>
        </div>
        <div class="ce-actions">
          <button class="dp-btn pdf-btn" onclick="downloadPDF('${esc(r.id)}','${ST.cards.key}')">📄 PDF-картка</button>
          ${grpBtn}
          <span style="font-size:10.5px;color:var(--mid);margin-left:auto">ID: ${esc(r.id)}</span>
        </div>
      </div>`;
  }

  function render(){
    const k = ST.cards.key; if(!k) return;
    const data = CACHE[k+'.json']||[];
    const filtered = flt(data, ST.cards, ST.groupFilter);
    const {pg, ps} = ST.cards;
    const total=filtered.length, pages=Math.ceil(total/ps)||1;
    const items = filtered.slice(pg*ps, pg*ps+ps);

    document.getElementById('cards-title').innerHTML = `${CAT_LABELS[k]||k} <span class="sb-cnt">${fmt(total)}</span>`;
    document.getElementById('cards-stats').innerHTML =
      `<b>${fmt(total)}</b> за фільтром · Всього: ${fmt(data.length)} · Упр-ль: ${fmt(data.filter(r=>r.has_manager).length)}`;
    updFbtns(document.getElementById('cards-filters-wrap'), ST.cards);

    const pw = document.getElementById('cards-pgn-wrap');
    pw.innerHTML = total>ps ? `<div style="display:flex;gap:6px;padding:6px 0;align-items:center">
      <button class="pgn-btn" ${pg===0?'disabled':''} onclick="CARDS.pgChange(-1)">‹ Попер.</button>
      <span style="font-size:11px">${pg+1}/${pages}</span>
      <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="CARDS.pgChange(1)">Наст. ›</button>
    </div>` : '';

    document.getElementById('cards-grid').innerHTML = items.length ? items.map(r=>{
      const val = r.value ? `${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}` : '—';
      const loc  = [r.city, r.oblast].filter(Boolean).join(', ') || '—';
      const isExp = ST.expandedId === r.id;
      return `
        <div class="card-item ${isExp?'selected':''}" onclick="CARDS.expand('${esc(r.id)}')">
          <button class="ci-pdf-btn" onclick="event.stopPropagation();downloadPDF('${esc(r.id)}','${k}')" title="Завантажити PDF">📄</button>
          <div class="ci-id"><span>${esc(r.id)}</span>${r.group&&r.group!=='Груповано'?`<span class="ai-group" onclick="event.stopPropagation();APP.searchGroup('${esc(r.group)}')">Справа №${esc(r.group)}</span>`:''}</div>
          <div class="ci-type">${esc((r.type||r.asset_type||'').slice(0,50))}</div>
          <div class="ci-title">${esc((r.desc||'—').slice(0,150))}${(r.desc||'').length>150?'…':''}</div>
          <div class="ci-meta">
            <div class="ci-row"><span class="lbl">📍</span><span class="val">${esc(loc)}</span></div>
            ${r.own   ?`<div class="ci-row"><span class="lbl">👤</span><span class="val">${esc(r.own.slice(0,60))}</span></div>`:''}
            ${r.manager?`<div class="ci-row"><span class="lbl">🛡</span><span class="val">${esc(r.manager.slice(0,55))}</span></div>`:''}
            <div class="ci-row"><span class="lbl">💵</span><span class="val">${val}</span></div>
            ${r.date?`<div class="ci-row"><span class="lbl">📅</span><span class="val">${esc(r.date)}</span></div>`:''}
            ${r.dept?`<div class="ci-row"><span class="lbl">🗂</span><span class="val">${esc(r.dept)}</span></div>`:''}
          </div>
          <div class="ci-badges">
            <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
            ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
            ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
            <span style="font-size:10px;color:var(--mid);margin-left:auto">${isExp?'▲ Закрити':'▼ Деталі'}</span>
          </div>
        </div>
        ${isExp ? renderExpand(r) : ''}`;
    }).join('') : '<div class="no-results">Нічого не знайдено</div>';
  }

  function expand(id){ ST.expandedId = ST.expandedId===id?null:id; render(); if(ST.expandedId){ setTimeout(()=>{ const el=document.getElementById('ce-'+id); if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'}); },50); } }
  function closeExpand(){ ST.expandedId=null; render(); }

  return {
    render, expand, closeExpand,
    filter:(btn)=>{ ST.cards[btn.dataset.f]=btn.dataset.v; ST.cards.pg=0; render(); },
    pgChange:(d)=>{ ST.cards.pg=Math.max(0,ST.cards.pg+d); render(); },
  };
})();

// ─── HOME ────────────────────────────────────────────────────
function renderHome(){
  const s = STATS;
  const byArr = s.by_arrest||{};
  const maxArr = Math.max(...Object.values(byArr),1);
  const CLR = {'Арештовано':'#f97316','Стягнення в дохід держави':'#10b981','спеціальна конфіскація':'#06b6d4','Скасування передачі ':'#ef4444','Не арештовано':'#6b7280','Націоналізація':'#8b5cf6','Арештовано (повторний арешт)':'#f97316'};

  document.getElementById('home-content').innerHTML=`
<div class="home-wrap">
  <div class="home-hero"><img src="logo.png" class="home-hero-logo" alt="АРМА">
    <div><h1>Реєстр арештованих активів</h1>
      <p>Агентство з розшуку та менеджменту активів України &nbsp;·&nbsp; ${fmt(s.total)} об'єктів</p></div>
  </div>
  <div class="kpi-row">
    ${[['Всього активів',s.total,'#1a56db','','home'],
       ['Арештовано',s.arrested,'#f97316','Активних арештів','realestate','a'],
       ['Конфісковано',s.confiscated,'#10b981','У дохід держави','realestate','c'],
       ['Націоналізовано',s.national,'#8b5cf6','У власності держави','realestate','n'],
       ['З управителем',s.with_manager,'#10b981','Під управлінням','realestate','y'],
      ].map(([lbl,val,color,sub,pg,fv])=>`
      <div class="kpi" style="--kc:${color}" onclick="APP.go('${pg}'${fv?`,'${fv}'`:''})">
        <div class="kpi-lbl">${lbl}</div><div class="kpi-val">${fmt(val)}</div>
        <div class="kpi-sub">${sub||''}</div><div class="kpi-arr">→</div>
      </div>`).join('')}
  </div>
  <div class="sec-h">Категорії активів</div>
  <div class="cat-row">
    ${[['realestate','#f97316','🏢','Нерухомість',s.realestate,'будівлі, квартири'],
       ['land','#06b6d4','🌾','Земельні ділянки',s.land,'кадастровий контур'],
       ['transport','#1a56db','🚗','Транспорт',s.transport,'авто, техніка'],
       ['corp','#8b5cf6','📊','Корп. права',s.corp,'частки, акції'],
       ['money','#d97706','💰','Грошові кошти',s.money,'банківські рахунки'],
       ['movable','#06b6d4','📦','Рухоме майно',s.movable,'товари, обладнання'],
       ['other','#8b5cf6','🗂','Інше майно',s.other,'майнові права, ІВ'],
       ['realestate','#1a56db','📋','Прості активи',s.simple,`з ${fmt(s.complex)} складних`],
      ].map(([pg,cc,ic,name,cnt,sub])=>`
      <div class="cat" style="--cc:${cc}" onclick="APP.go('${pg}')">
        <div class="cat-icon">${ic}</div><div class="cat-name">${name}</div>
        <div class="cat-count">${fmt(cnt)}</div><div class="cat-sub">${sub}</div>
      </div>`).join('')}
  </div>
  <div class="sec-h">Аналітика</div>
  <div class="charts-row">
    <div class="chart-card"><h3>Стан арешту</h3>
      ${Object.entries(byArr).filter(([k])=>k&&k.trim()).map(([k,v])=>`
        <div class="bar-item">
          <div class="bar-lbl"><span>${esc(k.trim().slice(0,38))}</span><span>${fmt(v)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(v/maxArr*100).toFixed(1)}%;background:${CLR[k.trim()]||'#1a56db'}"></div></div>
        </div>`).join('')}
    </div>
    <div class="chart-card"><h3>Типи активів</h3>
      ${[['🏢 Нерухомість',s.realestate,'#f97316'],['🚗 Транспорт',s.transport,'#1a56db'],
         ['🌾 Земля',s.land,'#10b981'],['📊 Корп. права',s.corp,'#8b5cf6'],
         ['📦 Рухоме',s.movable,'#d97706'],['💰 Кошти',s.money,'#06b6d4'],['🗂 Інше',s.other,'#ec4899'],
        ].map(([n,v,c])=>`
        <div class="bar-item">
          <div class="bar-lbl"><span>${n}</span><span>${fmt(v)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(v/s.total*100).toFixed(1)}%;background:${c}"></div></div>
        </div>`).join('')}
    </div>
  </div>
</div>`;
}

// ─── FOCUS MARKER ────────────────────────────────────────────
function focusMarker(id, type){
  if(type==='re') REMAP.focusMk(id);
  else if(type==='land') LANDMAP.focusMk(id);
}

// ─── NAVIGATION ──────────────────────────────────────────────
let searchTmr;
const APP = {
  async go(pageId, arrFilter){
    ST.page=pageId; ST.groupFilter=''; // clear group filter on nav
    if(arrFilter){ if(pageId==='realestate') ST.re.arr=arrFilter; else if(pageId==='land') ST.land.arr=arrFilter; }
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.toggle('active',t.dataset.page===pageId));
    if(pageId==='home'){
      document.getElementById('page-home').classList.add('active');
    } else if(pageId==='realestate'){
      document.getElementById('page-realestate').classList.add('active');
      await loadJSON('realestate.json');
      setTimeout(()=>{ REMAP.init(); REMAP.render(); },30);
    } else if(pageId==='land'){
      document.getElementById('page-land').classList.add('active');
      await loadJSON('land.json');
      setTimeout(()=>{ LANDMAP.init(); LANDMAP.render(); },30);
    } else {
      ST.cards.key=pageId; ST.expandedId=null;
      document.getElementById('page-cards').classList.add('active');
      await loadJSON(pageId+'.json');
      CARDS.render();
    }
  },

  // Task 5: Search all assets by group number
  searchGroup(groupNum){
    ST.groupFilter = groupNum;
    ST.search = '';
    document.getElementById('search-input').value = '';
    // Search across all categories
    const allData = ['realestate','land','transport','corp','money','movable','other']
      .flatMap(k => (CACHE[k+'.json']||[]).filter(r=>(r.group||'')==groupNum).map(r=>({...r,_cat:k})));
    
    if(!allData.length){ alert(`Активів у справі №${groupNum} не знайдено`); return; }
    
    // Show results grouped
    const byType = {};
    allData.forEach(r=>{ const c=r._cat||'other'; byType[c]=(byType[c]||[]); byType[c].push(r); });
    
    const counts = Object.entries(byType).map(([k,v])=>`${CAT_LABELS[k]||k}: ${v.length}`).join(', ');
    
    // Navigate to first category with results
    const firstCat = Object.keys(byType)[0];
    ST.groupFilter = groupNum;
    this.go(firstCat);
    
    // Show toast
    this._toast(`Справа №${groupNum}: ${allData.length} активів · ${counts}`, 5000);
  },

  _toast(msg, ms=3000){
    const el = document.createElement('div');
    el.className='app-toast'; el.textContent=msg;
    document.body.appendChild(el);
    setTimeout(()=>el.classList.add('show'),10);
    setTimeout(()=>{ el.classList.remove('show'); setTimeout(()=>el.remove(),400); },ms);
  },

  onSearch(val){
    ST.search=val.toLowerCase(); ST.groupFilter='';
    clearTimeout(searchTmr);
    searchTmr=setTimeout(()=>{
      if(ST.page==='realestate'){ ST.re.pg=0; REMAP.render(); }
      else if(ST.page==='land'){ ST.land.pg=0; LANDMAP.render(); }
      else if(['transport','corp','money','movable','other'].includes(ST.page)){ ST.cards.pg=0; CARDS.render(); }
    },250);
  },

  async init(){
    const setFill = v=>{ const el=document.getElementById('ldr-fill'); if(el) el.style.width=v+'%'; };
    const setMsg  = v=>{ const el=document.getElementById('ldr-msg');  if(el) el.textContent=v; };
    try{
      setFill(15); setMsg('Завантаження статистики...');
      STATS = await loadJSON('stats.json');
      setFill(40); setMsg('Нерухомість...');
      await loadJSON('realestate.json');
      setFill(70); setMsg('Земельні ділянки...');
      await loadJSON('land.json');
      if(!STATS.by_arrest) STATS.by_arrest={'Арештовано':STATS.arrested,'Не арештовано':STATS.not_arrested,'Стягнення в дохід держави':STATS.confiscated,'Націоналізація':STATS.national};
      setFill(90); setMsg('Готово!');
    }catch(e){
      setMsg('Помилка! Перевірте JSON файли на сервері.'); console.error(e); return;
    }

    document.getElementById('nav-tabs').innerHTML = TABS.map(t=>`
      <button class="nav-tab ${t.id==='home'?'active':''}" data-page="${t.id}" onclick="APP.go('${t.id}')">
        ${t.label}<span class="nav-cnt">${fmt(t.cnt?STATS[t.cnt]||0:STATS.total||0)}</span>
      </button>`).join('');

    setFill(100);
    setTimeout(()=>{
      document.getElementById('loader').style.display='none';
      document.getElementById('topnav').style.display='flex';
      document.getElementById('page-home').style.display='';
      document.getElementById('page-home').classList.add('active');
      renderHome();
    },250);
  }
};

async function loadJSON(file){
  if(CACHE[file]) return CACHE[file];
  const r = await fetch(file);
  if(!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  CACHE[file] = await r.json();
  return CACHE[file];
}

// Pulse animation + toast
document.head.insertAdjacentHTML('beforeend',`<style>
@keyframes mPulse{0%{transform:scale(1);opacity:.65}100%{transform:scale(3.8);opacity:0}}
.app-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
  background:rgba(11,18,32,.92);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;
  font-family:'DM Sans',sans-serif;z-index:9999;opacity:0;transition:all .3s;white-space:nowrap;
  box-shadow:0 4px 20px rgba(0,0,0,.3);pointer-events:none}
.app-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>`);

document.addEventListener('DOMContentLoaded', ()=>APP.init());
