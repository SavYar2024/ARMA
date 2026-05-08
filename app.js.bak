/* ============================================================
   ARMA — app.js  v3.0
   - Точне геокодування через Nominatim (фонове + при виборі)
   - Розкривні картки активів
   - PDF-завантаження для кожного активу
   - Мобільна підтримка
   ============================================================ */
'use strict';

const TABS = [
  {id:'home',       label:'🏠 Огляд',      file:null},
  {id:'realestate', label:'🏢 Нерухомість', file:'realestate.json', cnt:'realestate'},
  {id:'land',       label:'🌾 Земля',        file:'land.json',       cnt:'land'},
  {id:'transport',  label:'🚗 Транспорт',    file:'transport.json',  cnt:'transport', cards:true},
  {id:'corp',       label:'📊 Корп. права',  file:'corp.json',       cnt:'corp',      cards:true},
  {id:'money',      label:'💰 Кошти',        file:'money.json',      cnt:'money',     cards:true},
  {id:'movable',    label:'📦 Рухоме',       file:'movable.json',    cnt:'movable',   cards:true},
  {id:'other',      label:'🗂 Інше',         file:'other.json',      cnt:'other',     cards:true},
];

const CAT_LABELS={transport:'Транспорт',corp:'Корп. права',money:'Грошові кошти',movable:'Рухоме майно',other:'Інше майно'};

// ─── STATE ───────────────────────────────────────────────────
const ST={
  page:'home', search:'',
  re:   {arr:'all',cmplx:'all',mgr:'all',pg:0,ps:80},
  land: {arr:'all',cmplx:'all',mgr:'all',pg:0,ps:80},
  cards:{arr:'all',cmplx:'all',mgr:'all',pg:0,ps:100,key:null},
  expandedCardId: null,
};
const CACHE={};
let STATS={};

// ─── UTILS ───────────────────────────────────────────────────
const fmt = n=>Number(n||0).toLocaleString('uk-UA');
const esc = s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function arrType(s){
  if(!s) return 'u';
  s=s.toLowerCase();
  if(s.includes('конфіскац')||s.includes('стягнення')) return 'c';
  if(s.includes('нац')) return 'n';
  if(s.includes('арештовано')) return 'a';
  if(s.includes('скасування')) return 'x';
  if(s.includes('не арешт')) return 'z';
  return 'u';
}
const ARR_LBL={a:'Арешт',c:'Конфіск.',n:'Націонал.',x:'Скасовано',z:'Не арешт.',u:'—'};
const ARR_CLR={a:'#e86c19',c:'#0e9f6e',n:'#7c3aed',x:'#dc2626',z:'#64748b',u:'#94a3b8'};
const ARR_B  ={a:'b-arrested',c:'b-confiscated',n:'b-national',x:'b-cancelled',z:'b-notarr',u:'b-notarr'};

function flt(data,f){
  const q=ST.search.toLowerCase();
  return data.filter(r=>{
    if(f.arr!=='all'&&arrType(r.arr)!==f.arr) return false;
    if(f.cmplx==='simple' &&r.complex!=='simple') return false;
    if(f.cmplx==='complex'&&r.complex!=='complex') return false;
    if(f.mgr==='yes'&&!r.has_manager) return false;
    if(f.mgr==='no' && r.has_manager) return false;
    if(q){
      const h=[r.id,r.addr,r.city,r.oblast,r.own,r.desc,r.kadastr].filter(Boolean).join(' ').toLowerCase();
      if(!h.includes(q)) return false;
    }
    return true;
  });
}

function updFbtns(container,f){
  container.querySelectorAll('.fbtn').forEach(b=>{
    b.classList.remove('active','red','green','purple','orange','teal');
    if(b.dataset.v===f[b.dataset.f]){
      b.classList.add('active');
      const v=b.dataset.v;
      if(v==='arrested'||v==='a') b.classList.add('orange');
      if(v==='confiscated'||v==='yes') b.classList.add('green');
      if(v==='national'||v==='complex') b.classList.add('purple');
      if(v==='cancelled') b.classList.add('red');
    }
  });
}

// ─── GEOCODING ───────────────────────────────────────────────
const GEO_KEY='arma_geo_v4';
let GEO=JSON.parse(localStorage.getItem(GEO_KEY)||'{}');
let geoRunning=false;

function applyCache(data){
  data.forEach(r=>{ if(r.gq&&GEO[r.gq]){r._lat=GEO[r.gq].lat;r._lng=GEO[r.gq].lng;} });
}
function bestLL(r){ return r._lat?[r._lat,r._lng]:[r.lat,r.lng]; }
function geoLevel(r){
  if(r._lat) return 'street';
  const q=r.geo_quality||'';
  return q==='city'||q==='city_fuzzy'?'city':'oblast';
}
function geoBadge(r){
  const l=geoLevel(r);
  if(l==='street') return '<span class="badge b-geo-street">📍 Точно</span>';
  if(l==='city')   return '<span class="badge b-geo-city">📍 Місто</span>';
  return '<span class="badge b-geo-oblast">📍 Область</span>';
}
function geoZoom(r){ return geoLevel(r)==='street'?17:14; }

async function geocodeOne(r){
  if(!r.gq||!r.needs_geocode) return false;
  if(GEO[r.gq]){r._lat=GEO[r.gq].lat;r._lng=GEO[r.gq].lng;return true;}
  try{
    const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(r.gq)}&accept-language=uk&countrycodes=ua`,
      {headers:{'User-Agent':'ARMA-Registry/3.0'}});
    if(!res.ok) return false;
    const d=await res.json();
    if(d&&d.length){
      const c={lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};
      GEO[r.gq]=c; r._lat=c.lat; r._lng=c.lng;
      localStorage.setItem(GEO_KEY,JSON.stringify(GEO));
      return true;
    }
  }catch(e){}
  return false;
}

async function bgGeocode(data,onProg){
  if(geoRunning) return;
  const seen=new Set();
  const q=[];
  data.forEach(r=>{
    if(!r.gq||!r.needs_geocode||GEO[r.gq]||seen.has(r.gq)) return;
    seen.add(r.gq); q.push(r);
  });
  if(!q.length){onProg&&onProg(0,0,'✓ Всі адреси закешовано');return;}
  geoRunning=true;
  let done=0;
  for(const r of q){
    onProg&&onProg(done,q.length,`Геокод: ${(r.gq||'').slice(0,44)}…`);
    await geocodeOne(r);
    // Apply to all records with same gq
    data.forEach(x=>{if(x.gq===r.gq&&GEO[r.gq]){x._lat=GEO[r.gq].lat;x._lng=GEO[r.gq].lng;}});
    done++;
    if(done%10===0) localStorage.setItem(GEO_KEY,JSON.stringify(GEO));
    await new Promise(res=>setTimeout(res,1150));
  }
  localStorage.setItem(GEO_KEY,JSON.stringify(GEO));
  geoRunning=false;
  onProg&&onProg(done,done,'✓ Геокодування завершено');
}

// ─── PDF EXPORT ──────────────────────────────────────────────
function downloadPDF(r,type='re'){
  const val=r.value?`${fmt(parseFloat(r.value))} ${r.currency||'грн'}`:'—';
  const [lat,lng]=bestLL(r);
  const dt=new Date().toLocaleDateString('uk-UA');
  const geoAccuracy=geoLevel(r)==='street'?'Точно (геокодовано)':geoLevel(r)==='city'?'Місто (приблизно)':'Область (приблизно)';

  const html=`<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:30px;max-width:750px;margin:0 auto;}
  h1{font-size:18px;font-weight:800;color:#1e40af;border-bottom:3px solid #1e40af;padding-bottom:8px;margin-bottom:16px;}
  .logo-row{display:flex;align-items:center;gap:12px;margin-bottom:20px;}
  .meta{color:#64748b;font-size:11px;margin-bottom:20px;}
  .section{margin-bottom:16px;}
  .section h2{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px;}
  .row{display:flex;gap:12px;margin-bottom:5px;}
  .lbl{color:#6b7280;min-width:130px;flex-shrink:0;font-size:11px;}
  .val{color:#111;flex:1;font-size:12px;}
  .badge{display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-right:4px;}
  .ba{background:#fef3c7;color:#92400e;} .bc{background:#d1fae5;color:#065f46;} .bn{background:#ede9fe;color:#5b21b6;}
  .bx{background:#fee2e2;color:#991b1b;} .bs{background:#dbeafe;color:#1e40af;}
  .desc{font-size:11px;color:#374151;line-height:1.6;background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid #1e40af;}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;}
  .coords{font-family:monospace;font-size:11px;color:#374151;}
</style></head><body>
<div class="logo-row">
  <div>
    <h1>📋 Картка активу АРМА</h1>
    <div class="meta">ID: ${esc(r.id)} &nbsp;|&nbsp; Дата виводу: ${dt} &nbsp;|&nbsp; Реєстр: АРМА України</div>
  </div>
</div>

<div class="section">
<h2>⚖ Статус</h2>
<div class="row"><span class="lbl">Стан арешту</span><span class="val"><span class="badge ${arrType(r.arr)==='a'?'ba':arrType(r.arr)==='c'?'bc':arrType(r.arr)==='n'?'bn':arrType(r.arr)==='x'?'bx':'bs'}">${ARR_LBL[arrType(r.arr)]||'—'}</span></span></div>
<div class="row"><span class="lbl">Складність</span><span class="val">${r.complex==='simple'?'Простий':r.complex==='complex'?'Складний (Композитний)':'—'}</span></div>
${r.inv_status?`<div class="row"><span class="lbl">Статус інв.</span><span class="val">${esc(r.inv_status)}</span></div>`:''}
${r.zone?`<div class="row"><span class="lbl">Зонування</span><span class="val">${esc(r.zone)}</span></div>`:''}
</div>

<div class="section">
<h2>📍 Адреса / Місцезнаходження</h2>
${r.addr?`<div class="row"><span class="lbl">Повна адреса</span><span class="val" style="font-weight:700">${esc(r.addr)}</span></div>`:''}
${r.street?`<div class="row"><span class="lbl">Вулиця</span><span class="val">${esc((r.street_type||'')+(r.street_type?' ':'')+r.street+(r.house?', буд. '+r.house:'')+(r.apt?', кв. '+r.apt:''))}</span></div>`:''}
${r.city?`<div class="row"><span class="lbl">Місто/НП</span><span class="val">${esc((r.settlement_type||'м.')+' '+r.city)}</span></div>`:''}
${r.district?`<div class="row"><span class="lbl">Район</span><span class="val">${esc(r.district)}</span></div>`:''}
${r.oblast?`<div class="row"><span class="lbl">Область</span><span class="val">${esc(r.oblast)}</span></div>`:''}
${r.kadastr?`<div class="row"><span class="lbl">Кадастр. №</span><span class="val" style="font-family:monospace">${esc(r.kadastr)}</span></div>`:''}
<div class="row"><span class="lbl">Координати</span><span class="val coords">${lat.toFixed(6)}, ${lng.toFixed(6)} <span style="color:#6b7280">(${geoAccuracy})</span></span></div>
</div>

<div class="section">
<h2>🏷 Класифікація</h2>
${r.type?`<div class="row"><span class="lbl">Вид активу</span><span class="val">${esc(r.type)}</span></div>`:''}
${r.dept?`<div class="row"><span class="lbl">Відділ</span><span class="val">${esc(r.dept)}</span></div>`:''}
${r.mtu ?`<div class="row"><span class="lbl">МТУ</span><span class="val">${esc(r.mtu)}</span></div>`:''}
${r.date?`<div class="row"><span class="lbl">Дата рішення</span><span class="val">${esc(r.date)}</span></div>`:''}
${r.group?`<div class="row"><span class="lbl">Група</span><span class="val">${esc(r.group)}</span></div>`:''}
</div>

${r.own||r.manager?`<div class="section"><h2>👤 Власник / Управитель</h2>
${r.own?`<div class="row"><span class="lbl">Власник</span><span class="val">${esc(r.own)}</span></div>`:''}
${r.manager?`<div class="row"><span class="lbl">Управитель</span><span class="val">${esc(r.manager)}</span></div>`:''}
${r.contract?`<div class="row"><span class="lbl">Договір</span><span class="val">${esc(r.contract)}</span></div>`:''}
</div>`:''}

<div class="section"><h2>💵 Фінанси / Стан</h2>
<div class="row"><span class="lbl">Вартість</span><span class="val">${val}</span></div>
${r.usage    ?`<div class="row"><span class="lbl">Використання</span><span class="val">${esc(r.usage)}</span></div>`:''}
${r.condition?`<div class="row"><span class="lbl">Фіз. стан</span><span class="val">${esc(r.condition)}</span></div>`:''}
</div>

${r.desc?`<div class="section"><h2>📝 Опис активу</h2><div class="desc">${esc(r.desc)}</div></div>`:''}
${r.court?`<div class="section"><h2>⚖ Судові рішення</h2><div class="desc">${esc(r.court)}</div></div>`:''}

<div class="footer">Документ сформовано автоматично на основі реєстру АРМА України · ${dt}</div>
</body></html>`;

  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`ARMA_${r.id.replace(/\//g,'_')}.html`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── DETAIL PANEL BUILDER ────────────────────────────────────
function buildDP(r,type='re'){
  const [lat,lng]=bestLL(r);
  const lv=geoLevel(r);
  const osmQ=encodeURIComponent((r.addr||r.gq||r.city||'Україна')+', Україна');
  const osmUrl=lv==='street'?`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`:
                              `https://www.openstreetmap.org/search?query=${osmQ}`;
  const gmUrl=lv==='street'?`https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z`:
                             `https://www.google.com/maps/search/?api=1&query=${osmQ}`;
  const val=r.value?`${fmt(parseFloat(r.value))} ${r.currency||'грн'}`:'—';
  const kad=r.kadastr||'';

  return `
<div class="dp-top">
  <button class="dp-close" onclick="closeDP('${type}')">✕</button>
  <div class="dp-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · Гр: ${esc(r.group)}`:''}</div>
  <div class="dp-title">${esc((r.desc||r.type||'').slice(0,180))}${(r.desc||'').length>180?'…':''}</div>
  <div class="dp-badges">
    <span class="badge ${ARR_B[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]||'—'}</span>
    ${r.complex==='simple' ?'<span class="badge b-simple">Простий</span>':''}
    ${r.complex==='complex'?'<span class="badge b-complex">Складний</span>':''}
    ${r.has_manager?'<span class="badge b-managed">🛡 Упр-ль</span>':''}
    ${geoBadge(r)}
  </div>
</div>
<div class="dp-actions">
  <button class="dp-btn prim" onclick="focusMarker('${r.id}','${type}')">🎯 На карті</button>
  <a class="dp-btn" href="${osmUrl}" target="_blank">🌐 OSM</a>
  <a class="dp-btn" href="${gmUrl}" target="_blank">🗺 Google</a>
  ${kad?`<a class="dp-btn kad" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(kad)}" target="_blank">📋 Кадастр</a>`:''}
  <button class="dp-btn pdf" onclick="downloadPDF(${JSON.stringify(r).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')})">⬇ PDF</button>
</div>
<div class="dp-sec">
  <h4>📍 Адреса</h4>
  ${r.addr?`<div class="dp-row"><span class="dp-l">Адреса</span><span class="dp-v" style="font-weight:600">${esc(r.addr)}</span></div>`:''}
  ${r.street?`<div class="dp-row"><span class="dp-l">Вулиця</span><span class="dp-v">${esc((r.street_type||'')+' '+r.street+(r.house?', буд. '+r.house:'')+(r.apt?', кв. '+r.apt:''))}</span></div>`:''}
  ${r.city  ?`<div class="dp-row"><span class="dp-l">Місто/НП</span><span class="dp-v">${esc((r.settlement_type||'м.')+' '+r.city)}</span></div>`:''}
  ${r.district?`<div class="dp-row"><span class="dp-l">Район</span><span class="dp-v">${esc(r.district)}</span></div>`:''}
  ${r.oblast?`<div class="dp-row"><span class="dp-l">Область</span><span class="dp-v">${esc(r.oblast)}</span></div>`:''}
  ${kad     ?`<div class="dp-row"><span class="dp-l">Кадастр. №</span><span class="dp-v mono">${esc(kad)}</span></div>`:''}
  <div class="dp-row"><span class="dp-l">Координати</span>
    <span class="dp-v mono" id="dp-coords-${r.id}" style="font-size:10.5px">
      ${lat.toFixed(5)}, ${lng.toFixed(5)}
      <span style="color:${lv==='street'?'var(--green)':lv==='city'?'var(--amber)':'var(--red)'}"> ● ${lv==='street'?'точно':lv==='city'?'місто':'обл.'}</span>
    </span>
  </div>
</div>
<div class="dp-sec">
  <h4>🏷 Класифікація</h4>
  ${r.type?`<div class="dp-row"><span class="dp-l">Вид</span><span class="dp-v">${esc(r.type)}</span></div>`:''}
  <div class="dp-row"><span class="dp-l">Складність</span><span class="dp-v">${r.complex==='simple'?'Простий':r.complex==='complex'?'Складний':'—'}</span></div>
  ${r.zone?`<div class="dp-row"><span class="dp-l">Зонування</span><span class="dp-v">${esc(r.zone)}</span></div>`:''}
  ${r.dept?`<div class="dp-row"><span class="dp-l">Відділ</span><span class="dp-v">${esc(r.dept)}</span></div>`:''}
  ${r.mtu ?`<div class="dp-row"><span class="dp-l">МТУ</span><span class="dp-v">${esc(r.mtu)}</span></div>`:''}
  ${r.inv_status?`<div class="dp-row"><span class="dp-l">Статус інв.</span><span class="dp-v" style="font-size:11px">${esc(r.inv_status)}</span></div>`:''}
</div>
${r.own||r.manager?`<div class="dp-sec">
  <h4>👤 Власник / Управитель</h4>
  ${r.own    ?`<div class="dp-row"><span class="dp-l">Власник</span><span class="dp-v">${esc(r.own)}</span></div>`:''}
  ${r.manager?`<div class="dp-row"><span class="dp-l">Управитель</span><span class="dp-v">${esc(r.manager)}</span></div>`:''}
</div>`:''}
<div class="dp-sec">
  <h4>💵 Фінанси / Стан</h4>
  <div class="dp-row"><span class="dp-l">Вартість</span><span class="dp-v">${val}</span></div>
  ${r.usage    ?`<div class="dp-row"><span class="dp-l">Використання</span><span class="dp-v" style="font-size:11px">${esc(r.usage)}</span></div>`:''}
  ${r.condition?`<div class="dp-row"><span class="dp-l">Фіз. стан</span><span class="dp-v">${esc(r.condition)}</span></div>`:''}
</div>
${r.court?`<div class="dp-sec"><h4>⚖ Судові рішення</h4><p class="dp-desc" style="font-size:11px">${esc(r.court)}</p></div>`:''}
<div class="dp-sec" style="border:none"><h4>📝 Повний опис</h4><p class="dp-desc">${esc(r.desc||'')}</p></div>`;
}

function closeDP(type){
  document.getElementById(type==='land'?'land-detail':'re-detail').classList.remove('show');
}

// ─── REAL ESTATE MAP ─────────────────────────────────────────
const REMAP=(()=>{
  let map=null,clu=null,mById={},hlM=null,selId=null;

  function initMap(){
    if(map){map.invalidateSize();return;}
    map=L.map('map',{center:[49,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OSM © CARTO',maxZoom:19,subdomains:'abcd'}).addTo(map);
    clu=L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false});
    map.addLayer(clu);
  }

  function mkIcon(r,sel=false){
    const c=ARR_CLR[arrType(r.arr)]||'#94a3b8';
    const sz=sel?28:14;
    return L.divIcon({
      className:'',
      html:sel
        ?`<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${c};opacity:.22;animation:markerPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 0 0 3px ${c}44,0 4px 18px rgba(0,0,0,.45)"></div>
           </div>`
        :`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.28)"></div>`,
      iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]
    });
  }

  function mkMarkers(data){
    clu.clearLayers(); mById={};
    const ms=data.map(r=>{
      const [lt,lg]=bestLL(r);
      const m=L.marker([lt,lg],{icon:mkIcon(r)})
        .bindPopup(`<div class="lp-id">${r.id}</div>
          <div class="lp-title">${esc((r.desc||'').slice(0,90))}${(r.desc||'').length>90?'…':''}</div>
          <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
          <span class="badge ${ARR_B[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          <br><br><span class="lp-link" onclick="REMAP.select('${r.id}',false)">→ Відкрити картку</span>`,
          {maxWidth:300});
      m.on('click',()=>REMAP.select(r.id,false));
      m._id=r.id; mById[r.id]=m; return m;
    });
    if(ms.length) clu.addLayers(ms);
  }

  function mkList(filtered){
    const {pg,ps}=ST.re;
    const total=filtered.length,pages=Math.ceil(total/ps),items=filtered.slice(pg*ps,pg*ps+ps);
    document.getElementById('re-cnt').textContent=fmt(total);
    document.getElementById('re-list').innerHTML=items.length?items.map(r=>`
      <div class="asset-item ${r.id===selId?'selected':''}" data-id="${r.id}" onclick="REMAP.select('${r.id}',true)">
        <div class="ai-id"><span>${r.id}</span>${r.group&&r.group!=='Груповано'?`<span style="opacity:.6">Гр.${r.group}</span>`:''}</div>
        <div class="ai-title">${esc((r.desc||r.type||'').slice(0,120))}${(r.desc||'').length>120?'…':''}</div>
        <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
        <div class="ai-badges">
          <span class="badge ${ARR_B[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          ${r.complex==='simple'?'<span class="badge b-simple">Простий</span>':''}
          ${r.complex==='complex'?'<span class="badge b-complex">Складний</span>':''}
          ${r.has_manager?'<span class="badge b-managed">Упр-ль</span>':''}
        </div>
      </div>`).join(''):'<div class="no-results">Нічого не знайдено</div>';

    const pgn=document.getElementById('re-pgn');
    if(total>ps){
      pgn.style.display='flex';
      pgn.innerHTML=`<button class="pgn-btn" ${pg===0?'disabled':''} onclick="REMAP.pgChange(-1)">← Попер.</button>
        <span>${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="REMAP.pgChange(1)">Наст. →</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const data=CACHE['realestate.json']||[];
    const filtered=flt(data,ST.re);
    mkList(filtered); mkMarkers(filtered);
    updFbtns(document.getElementById('re-sidebar'),ST.re);
  }

  async function select(id,fromList){
    const data=CACHE['realestate.json']||[];
    const r=data.find(x=>x.id===id); if(!r) return;
    selId=id;

    // Highlight list
    document.querySelectorAll('#re-list .asset-item').forEach(el=>{
      el.classList.toggle('selected',el.dataset.id===id);
      if(el.dataset.id===id&&!fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });

    // Geocode immediately if needed
    const hadCoords=!!r._lat;
    if(!hadCoords&&r.needs_geocode){
      const dp=document.getElementById('re-detail');
      dp.innerHTML=`<div class="empty-state"><div class="empty-icon">🔍</div><p>Визначення точних координат…<br><small style="opacity:.6">${esc(r.gq||'')}</small></p></div>`;
      dp.classList.add('show');
      await geocodeOne(r);
    }

    const [lt,lg]=bestLL(r);
    map.flyTo([lt,lg],geoZoom(r),{duration:0.65});

    // Remove old highlight
    if(hlM){map.removeLayer(hlM);hlM=null;}
    hlM=L.marker([lt,lg],{icon:mkIcon(r,true),zIndexOffset:2000}).addTo(map)
      .bindPopup(`<div class="lp-id">${r.id}</div>
        <div class="lp-title">${esc((r.desc||'').slice(0,80))}</div>
        <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
        <span style="font-size:10px;color:${geoLevel(r)==='street'?'#0e9f6e':'#d97706'}">
          ● ${geoLevel(r)==='street'?'Точно геокодовано':'Приблизне розташування'}
        </span>`,{maxWidth:300}).openPopup();

    const dp=document.getElementById('re-detail');
    dp.innerHTML=buildDP(r,'re');
    dp.classList.add('show');
    dp.scrollTop=0;
  }

  function focusMk(id){
    const data=CACHE['realestate.json']||[];
    const r=data.find(x=>x.id===id); if(!r) return;
    const [lt,lg]=bestLL(r);
    map.flyTo([lt,lg],geoZoom(r),{duration:0.6});
    if(hlM) hlM.openPopup();
  }

  async function startBg(){
    const data=CACHE['realestate.json']||[];
    const bar=document.getElementById('geo-bar');
    const msg=document.getElementById('geo-msg');
    await bgGeocode(data,(done,total,text)=>{
      if(!total){bar.classList.remove('show');return;}
      bar.classList.add('show'); msg.textContent=text;
      if(done===total){setTimeout(()=>bar.classList.remove('show'),4000);}
      if(done%25===0&&done>0) mkMarkers(flt(data,ST.re));
    });
    mkMarkers(flt(data,ST.re));
  }

  return {
    init:initMap, render, select,
    filter:(btn)=>{ST.re[btn.dataset.f]=btn.dataset.v;ST.re.pg=0;render();},
    pgChange:(d)=>{ST.re.pg=Math.max(0,ST.re.pg+d);mkList(flt(CACHE['realestate.json']||[],ST.re));},
    focusMk, startBg,
  };
})();

// ─── LAND MAP ────────────────────────────────────────────────
const LANDMAP=(()=>{
  let map=null,clu=null,mById={},hlM=null,kadLyr=null,loaded={},selId=null;

  function initMap(){
    if(map){map.invalidateSize();return;}
    map=L.map('map-land',{center:[49,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    const cartoL=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OSM © CARTO',maxZoom:19,subdomains:'abcd'});
    const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:19});
    cartoL.addTo(map);
    L.control.layers({'CARTO':cartoL,'OSM':osm}).addTo(map);
    clu=L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false});
    map.addLayer(clu);
    kadLyr=L.layerGroup().addTo(map);
  }

  function mkIcon(r,sel=false){
    const c=ARR_CLR[arrType(r.arr)]||'#94a3b8', hk=!!r.kadastr, sz=sel?28:(hk?15:12);
    return L.divIcon({
      className:'',
      html:sel
        ?`<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${c};opacity:.22;animation:markerPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:${hk?'3px':'50%'};background:${c};border:3px solid #fff;box-shadow:0 4px 18px rgba(0,0,0,.45)"></div>
           </div>`
        :`<div style="position:relative;display:inline-block">
            <div style="width:${sz}px;height:${sz}px;border-radius:${hk?'3px':'50%'};background:${c};border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.25)"></div>
            ${hk?'<div style="position:absolute;bottom:-2px;right:-2px;width:6px;height:6px;border-radius:50%;background:#06a5c0;border:1.5px solid #fff"></div>':''}
           </div>`,
      iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]
    });
  }

  function mkMarkers(data){
    clu.clearLayers(); mById={};
    const ms=data.map(r=>{
      const [lt,lg]=bestLL(r);
      const m=L.marker([lt,lg],{icon:mkIcon(r)})
        .bindPopup(`<div class="lp-id">${r.id}</div>
          <div class="lp-title">${esc((r.type||'Земельна ділянка').slice(0,80))}</div>
          <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
          ${r.kadastr?`<div class="land-kad" style="margin:4px 0">📋 ${r.kadastr}</div>`:''}
          <span class="badge ${ARR_B[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          <br><br><span class="lp-link" onclick="LANDMAP.select('${r.id}',false)">→ Картку</span>`,
          {maxWidth:300});
      m.on('click',()=>LANDMAP.select(r.id,false));
      m._id=r.id; mById[r.id]=m; return m;
    });
    if(ms.length) clu.addLayers(ms);
  }

  function mkList(filtered){
    const {pg,ps}=ST.land;
    const total=filtered.length,pages=Math.ceil(total/ps),items=filtered.slice(pg*ps,pg*ps+ps);
    document.getElementById('land-cnt').textContent=fmt(total);
    document.getElementById('land-list').innerHTML=items.length?items.map(r=>`
      <div class="asset-item ${r.id===selId?'selected':''}" data-id="${r.id}" onclick="LANDMAP.select('${r.id}',true)">
        <div class="ai-id">
          <span>${r.id}</span>
          ${r.kadastr?`<span class="land-kad">${r.kadastr.slice(-8)}</span>`:''}
        </div>
        <div class="ai-title">${esc((r.type||'Земельна ділянка').slice(0,90))}</div>
        <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
        <div class="ai-badges">
          <span class="badge ${ARR_B[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          ${r.kadastr?'<span class="land-kad">📋 Кадастр</span>':''}
          ${r.has_manager?'<span class="badge b-managed">Упр-ль</span>':''}
        </div>
      </div>`).join(''):'<div class="no-results">Нічого не знайдено</div>';
    const pgn=document.getElementById('land-pgn');
    if(total>ps){
      pgn.style.display='flex';
      pgn.innerHTML=`<button class="pgn-btn" ${pg===0?'disabled':''} onclick="LANDMAP.pgChange(-1)">← Попер.</button>
        <span>${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="LANDMAP.pgChange(1)">Наст. →</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const data=CACHE['land.json']||[],filtered=flt(data,ST.land);
    mkList(filtered); mkMarkers(filtered);
    updFbtns(document.getElementById('land-sidebar'),ST.land);
  }

  async function loadKad(kad,lat,lng){
    if(loaded[kad]) return;
    const apis=[
      `https://kadastr.live/api/parcel?cadnum=${encodeURIComponent(kad)}`,
      `https://map.land.gov.ua/gis/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastr:cadnum&outputFormat=application/json&CQL_FILTER=cadnum='${kad}'`,
    ];
    for(const url of apis){
      try{
        const res=await fetch(url,{signal:AbortSignal.timeout(7000)});
        if(!res.ok) continue;
        const data=await res.json();
        let gj=data.type==='Feature'||data.type==='FeatureCollection'?data:data.geometry?{type:'Feature',geometry:data.geometry}:null;
        if(!gj&&data.features&&data.features.length) gj=data;
        if(!gj) continue;
        const lyr=L.geoJSON(gj,{style:{color:'#06a5c0',weight:2.5,fillColor:'#06b6d4',fillOpacity:.2}});
        lyr.addTo(kadLyr); loaded[kad]=lyr;
        try{map.fitBounds(lyr.getBounds(),{padding:[50,50],maxZoom:18});}catch(e){}
        L.marker(lyr.getBounds().getCenter(),{icon:L.divIcon({className:'',html:`<div style="background:rgba(6,165,192,.9);color:#fff;padding:2px 6px;border-radius:5px;font-size:9.5px;font-weight:700;white-space:nowrap;font-family:'DM Mono',monospace;box-shadow:0 2px 8px rgba(0,0,0,.25)">${kad}</div>`,iconAnchor:[55,10]}),interactive:false}).addTo(kadLyr);
        return;
      }catch(e){continue;}
    }
    map.flyTo([lat,lng],15,{duration:.6});
  }

  async function select(id,fromList){
    const data=CACHE['land.json']||[],r=data.find(x=>x.id===id); if(!r) return;
    selId=id;
    document.querySelectorAll('#land-list .asset-item').forEach(el=>{
      el.classList.toggle('selected',el.dataset.id===id);
      if(el.dataset.id===id&&!fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
    if(hlM){map.removeLayer(hlM);hlM=null;}
    const [lt,lg]=bestLL(r);
    hlM=L.marker([lt,lg],{icon:mkIcon(r,true),zIndexOffset:2000}).addTo(map);
    if(r.kadastr) await loadKad(r.kadastr,lt,lg);
    else map.flyTo([lt,lg],geoZoom(r),{duration:.7});

    let kadSec='';
    if(r.kadastr){
      kadSec=`<div class="dp-sec" style="background:var(--teal-ghost);border-color:rgba(6,165,192,.2)">
        <h4>🗺 Кадастрова ділянка</h4>
        <div class="dp-row"><span class="dp-l">Кадастр. №</span><span class="dp-v mono">${r.kadastr}</span></div>
        <div class="dp-actions" style="padding:8px 0 0">
          <a class="dp-btn kad" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(r.kadastr)}" target="_blank">🌐 kadastrova-karta.com</a>
          <a class="dp-btn" href="https://map.land.gov.ua/kadastrova-karta?cadnum=${r.kadastr}" target="_blank">🏛 Публічна кадастрова</a>
        </div>
        <div style="margin-top:8px;font-size:10.5px;color:var(--mid)">Межі ділянки завантажуються автоматично на карті</div>
      </div>`;
    }

    const dp=document.getElementById('land-detail');
    dp.innerHTML=buildDP(r,'land')+kadSec;
    dp.classList.add('show'); dp.scrollTop=0;
  }

  return {
    init:initMap, render, select,
    filter:(btn)=>{ST.land[btn.dataset.f]=btn.dataset.v;ST.land.pg=0;render();},
    pgChange:(d)=>{ST.land.pg=Math.max(0,ST.land.pg+d);mkList(flt(CACHE['land.json']||[],ST.land));},
    focusMk:(id)=>{const d=CACHE['land.json']||[],r=d.find(x=>x.id===id);if(r){const[lt,lg]=bestLL(r);map.flyTo([lt,lg],geoZoom(r),{duration:.6});}},
  };
})();

// ─── CARDS (transport, corp, money, movable, other) ──────────
const CARDS=(()=>{
  function getFiltered(){
    const k=ST.cards.key; if(!k) return [];
    return flt(CACHE[k+'.json']||[],ST.cards);
  }

  function renderCardExpand(r){
    const val=r.value?`${fmt(parseFloat(r.value))} ${r.currency||'грн'}`:'—';
    const loc=[r.city,r.oblast].filter(Boolean).join(', ')||'—';
    return `
      <div class="card-expand" id="ce-${r.id}">
        <div class="ce-head">
          <div>
            <div class="dp-id" style="color:var(--mid)">${r.id} ${r.group&&r.group!=='Груповано'?'· Гр.'+r.group:''}</div>
            <div class="dp-title">${esc((r.desc||r.type||'').slice(0,200))}${(r.desc||'').length>200?'…':''}</div>
          </div>
          <button class="ce-close" onclick="CARDS.closeExpand()">✕</button>
        </div>
        <div class="ce-body">
          <div class="ce-section">
            <h4>📍 Місцезнаходження</h4>
            <div class="dp-row"><span class="dp-l">Місто/НП</span><span class="dp-v">${esc(loc)}</span></div>
            ${r.own?`<div class="dp-row"><span class="dp-l">Власник</span><span class="dp-v">${esc(r.own.slice(0,100))}</span></div>`:''}
            ${r.manager?`<div class="dp-row"><span class="dp-l">Управитель</span><span class="dp-v">${esc(r.manager.slice(0,80))}</span></div>`:''}
          </div>
          <div class="ce-section">
            <h4>🏷 Реквізити</h4>
            <div class="dp-row"><span class="dp-l">Вартість</span><span class="dp-v">${val}</span></div>
            ${r.dept?`<div class="dp-row"><span class="dp-l">Відділ</span><span class="dp-v">${esc(r.dept)}</span></div>`:''}
            ${r.mtu ?`<div class="dp-row"><span class="dp-l">МТУ</span><span class="dp-v">${esc(r.mtu)}</span></div>`:''}
            ${r.date?`<div class="dp-row"><span class="dp-l">Дата</span><span class="dp-v">${r.date}</span></div>`:''}
            ${r.inv_status?`<div class="dp-row"><span class="dp-l">Статус інв.</span><span class="dp-v" style="font-size:11px">${esc(r.inv_status)}</span></div>`:''}
          </div>
          <div class="ce-section" style="grid-column:1/-1">
            <h4>📝 Повний опис</h4>
            <p class="dp-desc">${esc(r.desc||'—')}</p>
          </div>
        </div>
        <div class="ce-actions">
          <button class="dp-btn pdf" onclick="downloadPDF(${JSON.stringify(r).replace(/</g,'\\u003c')})">⬇ PDF-картка</button>
          <span style="font-size:11px;color:var(--muted);align-self:center">ID: ${r.id}</span>
        </div>
      </div>`;
  }

  function render(){
    const k=ST.cards.key; if(!k) return;
    const data=CACHE[k+'.json']||[];
    const filtered=getFiltered();
    const {pg,ps}=ST.cards,total=filtered.length,pages=Math.ceil(total/ps);
    const items=filtered.slice(pg*ps,pg*ps+ps);

    document.getElementById('cards-title').innerHTML=`${CAT_LABELS[k]||k} <span class="sb-cnt">${fmt(filtered.length)}</span>`;
    document.getElementById('cards-stats').innerHTML=`<b>${fmt(filtered.length)}</b> за фільтром · Всього: ${fmt(data.length)} · З упр.: ${fmt(data.filter(r=>r.has_manager).length)}`;
    updFbtns(document.getElementById('cards-filters-wrap'),ST.cards);

    const pw=document.getElementById('cards-pgn-wrap');
    pw.innerHTML=total>ps?`<div class="sidebar-pgn" style="padding:6px 0">
      <button class="pgn-btn" ${pg===0?'disabled':''} onclick="CARDS.pgChange(-1)">← Попер.</button>
      <span style="font-size:11px">${pg+1}/${pages}</span>
      <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="CARDS.pgChange(1)">Наст. →</button>
    </div>`:'';

    document.getElementById('cards-grid').innerHTML=items.length?items.map(r=>{
      const val=r.value?`${fmt(parseFloat(r.value))} ${r.currency||'грн'}`:'—';
      const loc=[r.city,r.oblast].filter(Boolean).join(', ')||'—';
      const isExp=ST.expandedCardId===r.id;
      return `<div class="card-item ${isExp?'selected':''}" onclick="CARDS.expand('${r.id}')">
        <button class="ci-pdf-btn" onclick="event.stopPropagation();downloadPDF(${JSON.stringify(r).replace(/</g,'\\u003c')})">📄</button>
        <div class="ci-id"><span>${r.id}</span>${r.group&&r.group!=='Груповано'?`<span style="opacity:.6">Гр.${r.group}</span>`:''}</div>
        <div class="ci-type">${esc((r.type||r.asset_type||'').slice(0,40))}</div>
        <div class="ci-title">${esc((r.desc||'—').slice(0,140))}${(r.desc||'').length>140?'…':''}</div>
        <div class="ci-meta">
          <div class="ci-row"><span class="lbl">📍</span><span class="val">${esc(loc)}</span></div>
          ${r.own?`<div class="ci-row"><span class="lbl">👤</span><span class="val">${esc(r.own.slice(0,55))}</span></div>`:''}
          ${r.manager?`<div class="ci-row"><span class="lbl">🛡</span><span class="val">${esc(r.manager.slice(0,50))}</span></div>`:''}
          <div class="ci-row"><span class="lbl">💵</span><span class="val">${val}</span></div>
        </div>
        <div class="ci-badges">
          <span class="badge ${ARR_B[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          ${r.complex==='simple'?'<span class="badge b-simple">Простий</span>':''}
          ${r.complex==='complex'?'<span class="badge b-complex">Складний</span>':''}
          ${r.has_manager?'<span class="badge b-managed">Упр-ль</span>':''}
          <span style="font-size:10px;color:var(--muted);margin-left:auto">${isExp?'▲ Закрити':'▼ Деталі'}</span>
        </div>
      </div>
      ${isExp?renderCardExpand(r):''}`;
    }).join(''):'<div class="no-results">Нічого не знайдено</div>';
  }

  function expand(id){
    ST.expandedCardId=ST.expandedCardId===id?null:id;
    render();
    if(ST.expandedCardId){
      setTimeout(()=>{
        const el=document.getElementById(`ce-${id}`);
        if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
      },50);
    }
  }

  function closeExpand(){ ST.expandedCardId=null; render(); }

  return {
    render,expand,closeExpand,
    filter:(btn)=>{ST.cards[btn.dataset.f]=btn.dataset.v;ST.cards.pg=0;render();},
    pgChange:(d)=>{ST.cards.pg=Math.max(0,ST.cards.pg+d);render();},
  };
})();

// ─── HOME ────────────────────────────────────────────────────
function renderHome(){
  const s=STATS;
  const byArr=s.by_arrest||{};
  const maxArr=Math.max(...Object.values(byArr),1);
  const arrClrs={'Арештовано':'#e86c19','Не арештовано':'#64748b','Стягнення в дохід держави':'#0e9f6e','спеціальна конфіскація':'#06a5c0','Скасування':'#dc2626','Націоналізовано':'#7c3aed','Арештовано (повторний арешт)':'#f97316'};

  document.getElementById('home-content').innerHTML=`
<div class="home-wrap">
  <div class="home-hero">
    <img src="logo.png" class="home-hero-logo" alt="АРМА">
    <div>
      <h1>Реєстр арештованих активів</h1>
      <p>Агентство з розшуку та менеджменту активів України &nbsp;·&nbsp; ${fmt(s.total)} об'єктів</p>
    </div>
  </div>

  <div class="kpi-row">
    ${[
      ['Всього активів',s.total,'#1e50dc','','home'],
      ['Арештовано',s.arrested,'#e86c19','Активних арештів','realestate','a'],
      ['Конфісковано',s.confiscated,'#0e9f6e','У дохід держави','realestate','c'],
      ['Націоналізовано',s.national,'#7c3aed','У власності держави','realestate','n'],
      ['З управителем',s.with_manager,'#0e9f6e','Під управлінням','realestate','y'],
    ].map(([lbl,val,color,sub,pg,fv])=>`
      <div class="kpi" style="--kc:${color}" onclick="APP.go('${pg}'${fv?`,'${fv}'`:''})">
        <div class="kpi-lbl">${lbl}</div>
        <div class="kpi-val">${fmt(val)}</div>
        <div class="kpi-sub">${sub||''}</div>
        <div class="kpi-arr">→</div>
      </div>`).join('')}
  </div>

  <div class="sec-h">Категорії активів</div>
  <div class="cat-row">
    ${[
      ['realestate','#e86c19','rgba(232,108,25,.1)','🏢','Нерухомість',s.realestate,'будівлі, квартири'],
      ['land','#06a5c0','rgba(6,165,192,.1)','🌾','Земельні ділянки',s.land,'кадастровий контур'],
      ['transport','#1e50dc','rgba(30,80,220,.1)','🚗','Транспорт',s.transport,'авто, техніка'],
      ['corp','#7c3aed','rgba(124,58,237,.1)','📊','Корп. права',s.corp,'частки, акції'],
      ['money','#d97706','rgba(217,119,6,.1)','💰','Грошові кошти',s.money,'банківські рахунки'],
      ['movable','#06a5c0','rgba(6,165,192,.09)','📦','Рухоме майно',s.movable,'товари, обладнання'],
      ['other','#7c3aed','rgba(124,58,237,.08)','🗂','Інше майно',s.other,'майнові права, ІВ'],
      ['realestate','#1e50dc','rgba(30,80,220,.09)','📋','Прості активи',s.simple,`з ${fmt(s.complex)} складних`],
    ].map(([pg,cc,cb,ic,name,cnt,sub])=>`
      <div class="cat" style="--cc:${cc}" onclick="APP.go('${pg}')">
        <div class="cat-icon" style="background:${cb}">${ic}</div>
        <div class="cat-name">${name}</div>
        <div class="cat-count">${fmt(cnt)}</div>
        <div class="cat-sub">${sub}</div>
      </div>`).join('')}
  </div>

  <div class="sec-h">Аналітика</div>
  <div class="charts-row">
    <div class="chart-card">
      <h3>Стан арешту (всі активи)</h3>
      ${Object.entries(byArr).map(([k,v])=>`
        <div class="bar-item">
          <div class="bar-lbl"><span class="bar-name">${k.trim().slice(0,36)}</span><span class="bar-val">${fmt(v)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(v/maxArr*100).toFixed(1)}%;background:${arrClrs[k.trim()]||'#1e50dc'}"></div></div>
        </div>`).join('')}
    </div>
    <div class="chart-card">
      <h3>Типи активів</h3>
      ${[
        ['🏢 Нерухомість',s.realestate,'#e86c19'],['🚗 Транспорт',s.transport,'#1e50dc'],
        ['🌾 Земля',s.land,'#0e9f6e'],['📊 Корп. права',s.corp,'#7c3aed'],
        ['📦 Рухоме',s.movable,'#d97706'],['💰 Кошти',s.money,'#06a5c0'],['🗂 Інше',s.other,'#ec4899']
      ].map(([n,v,c])=>`
        <div class="bar-item">
          <div class="bar-lbl"><span class="bar-name">${n}</span><span class="bar-val">${fmt(v)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${(v/s.total*100).toFixed(1)}%;background:${c}"></div></div>
        </div>`).join('')}
    </div>
  </div>
</div>`;
}

// ─── NAVIGATION ──────────────────────────────────────────────
function focusMarker(id,type){
  if(type==='re') REMAP.focusMk(id);
  else if(type==='land') LANDMAP.focusMk(id);
}

let searchTmr;

const APP={
  async go(pageId,arrFilter){
    ST.page=pageId;
    if(arrFilter){ if(pageId==='realestate') ST.re.arr=arrFilter; else if(pageId==='land') ST.land.arr=arrFilter; }
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.toggle('active',t.dataset.page===pageId));

    if(pageId==='home'){
      document.getElementById('page-home').classList.add('active');
    } else if(pageId==='realestate'){
      document.getElementById('page-realestate').classList.add('active');
      await loadJSON('realestate.json');
      applyCache(CACHE['realestate.json']);
      setTimeout(()=>{REMAP.init();REMAP.render();REMAP.startBg();},50);
    } else if(pageId==='land'){
      document.getElementById('page-land').classList.add('active');
      await loadJSON('land.json');
      applyCache(CACHE['land.json']);
      setTimeout(()=>{LANDMAP.init();LANDMAP.render();},50);
    } else {
      ST.cards.key=pageId; ST.expandedCardId=null;
      document.getElementById('page-cards').classList.add('active');
      await loadJSON(pageId+'.json');
      CARDS.render();
    }
  },

  onSearch(val){
    ST.search=val.toLowerCase();
    clearTimeout(searchTmr);
    searchTmr=setTimeout(()=>{
      if(ST.page==='realestate'){ST.re.pg=0;REMAP.render();}
      else if(ST.page==='land'){ST.land.pg=0;LANDMAP.render();}
      else if(['transport','corp','money','movable','other'].includes(ST.page)){ST.cards.pg=0;CARDS.render();}
    },260);
  },

  async init(){
    const fill=id=>v=>{ const el=document.getElementById(id); if(el) el.style.width=v+'%'; };
    const msg =v=>{ const el=document.getElementById('ldr-msg'); if(el) el.textContent=v; };
    const prog=fill('ldr-fill');
    try{
      prog(15); msg('Статистика…');
      STATS=await loadJSON('stats.json');
      prog(40); msg('Нерухомість…');
      await loadJSON('realestate.json');
      applyCache(CACHE['realestate.json']);
      prog(70); msg('Земельні ділянки…');
      await loadJSON('land.json');
      applyCache(CACHE['land.json']);
      if(!STATS.by_arrest){
        STATS.by_arrest={'Арештовано':STATS.arrested,'Не арештовано':STATS.not_arrested,'Стягнення в дохід держави':STATS.confiscated,'Націоналізовано':STATS.national,'Скасування':STATS.cancelled};
      }
      prog(90); msg('Готово!');
    }catch(e){
      msg('Помилка завантаження даних! Перевірте наявність JSON-файлів на сервері.');
      console.error(e); return;
    }

    document.getElementById('nav-tabs').innerHTML=TABS.map(t=>`
      <button class="nav-tab ${t.id==='home'?'active':''}" data-page="${t.id}" onclick="APP.go('${t.id}')">
        ${t.label}<span class="nav-cnt">${fmt(t.cnt?STATS[t.cnt]||0:STATS.total||0)}</span>
      </button>`).join('');

    prog(100);
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
  const r=await fetch(file);
  if(!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
  CACHE[file]=await r.json();
  return CACHE[file];
}

// Inject pulse keyframe
document.head.insertAdjacentHTML('beforeend',`<style>
@keyframes markerPulse{0%{transform:scale(1);opacity:.65}100%{transform:scale(3.8);opacity:0}}
</style>`);

document.addEventListener('DOMContentLoaded',()=>APP.init());
