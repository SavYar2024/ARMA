/* ============================================================
   ARMA — app.js  v2.0
   Точне геокодування кожного об'єкту через Nominatim
   ============================================================ */
'use strict';

// ===== КОНФІГ =====
const TABS_CONFIG = [
  { id:'home',       label:'🏠 Огляд',        file:null },
  { id:'realestate', label:'🏢 Нерухомість',   file:'realestate.json', cnt:'realestate' },
  { id:'land',       label:'🌾 Земля',         file:'land.json',        cnt:'land' },
  { id:'transport',  label:'🚗 Транспорт',     file:'transport.json',   cnt:'transport', cards:true },
  { id:'corp',       label:'📊 Корп. права',   file:'corp.json',        cnt:'corp',      cards:true },
  { id:'money',      label:'💰 Кошти',         file:'money.json',       cnt:'money',     cards:true },
  { id:'movable',    label:'📦 Рухоме',        file:'movable.json',     cnt:'movable',   cards:true },
  { id:'other',      label:'🗂 Інше',          file:'other.json',       cnt:'other',     cards:true },
];

// ===== СТАН =====
const STATE = {
  page:'home', search:'',
  re:   { arr:'all', cmplx:'all', mgr:'all', page:0, pageSize:80 },
  land: { arr:'all', cmplx:'all', mgr:'all', page:0, pageSize:80 },
  cards:{ arr:'all', cmplx:'all', mgr:'all', page:0, pageSize:100, key:null },
};
const CACHE = {};
let STATS = {};

// ===== УТИЛІТИ =====
const fmt = n => Number(n).toLocaleString('uk-UA');
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function arrType(s){
  if(!s) return 'unknown';
  s=s.toLowerCase();
  if(s.includes('конфіскац')||s.includes('стягнення')) return 'confiscated';
  if(s.includes('нац')) return 'national';
  if(s.includes('арештовано')) return 'arrested';
  if(s.includes('скасування')) return 'cancelled';
  if(s.includes('не арешт')) return 'notarr';
  return 'unknown';
}
function arrLabel(s){
  if(!s) return '—';
  const t=arrType(s);
  return {arrested:'Арешт',confiscated:'Конфіск.',national:'Націонал.',cancelled:'Скасовано',notarr:'Не арешт.'}[t]||s.slice(0,14);
}
function arrColor(s){
  return {arrested:'#f97316',confiscated:'#10b981',national:'#8b5cf6',cancelled:'#ef4444',notarr:'#6b7280'}[arrType(s)]||'#9ca3af';
}
function arrBadge(s){
  return {arrested:'badge-arrested',confiscated:'badge-confiscated',national:'badge-national',cancelled:'badge-cancelled',notarr:'badge-notarr'}[arrType(s)]||'badge-notarr';
}

function filterData(data, f){
  const q=STATE.search.toLowerCase();
  return data.filter(r=>{
    if(f.arr!=='all' && arrType(r.arr)!==f.arr) return false;
    if(f.cmplx==='simple'  && r.complex!=='simple')  return false;
    if(f.cmplx==='complex' && r.complex!=='complex') return false;
    if(f.mgr==='yes' && !r.has_manager) return false;
    if(f.mgr==='no'  &&  r.has_manager) return false;
    if(q){
      const hay=[r.id,r.addr,r.city,r.oblast,r.own,r.desc,r.kadastr].filter(Boolean).join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderFbtns(container, f){
  container.querySelectorAll('.fbtn').forEach(b=>{
    b.classList.remove('active','red','green','purple','orange','teal');
    if(b.dataset.v===f[b.dataset.f]){
      b.classList.add('active');
      const v=b.dataset.v;
      if(v==='arrested')  b.classList.add('orange');
      if(v==='confiscated'||v==='yes') b.classList.add('green');
      if(v==='national'||v==='complex') b.classList.add('purple');
      if(v==='cancelled') b.classList.add('red');
    }
  });
}

// ===== ГЕОКОДУВАННЯ =====
const GEO_KEY = 'arma_geo_v3';
const GEO = JSON.parse(localStorage.getItem(GEO_KEY)||'{}');
let geoRunning = false;
let geoQueue = [];

// Отримати координати: з кешу або заявка в чергу
function getCoords(r){
  const cacheKey = r.gq||'';
  if(!cacheKey) return null;
  return GEO[cacheKey]||null;
}

function applyAllCachedCoords(data){
  data.forEach(r=>{
    const c = getCoords(r);
    if(c){ r._lat=c.lat; r._lng=c.lng; }
  });
}

// Побудувати маркер з найкращими координатами
function bestLatLng(r){
  if(r._lat && r._lng) return [r._lat, r._lng];
  return [r.lat, r.lng];
}

// Рівень точності для відображення
function geoLevel(r){
  if(r._lat) return 'street';  // geocoded to exact address
  const q=r.geo_quality||'';
  if(q==='city')       return 'city';
  if(q.includes('fuz')) return 'city';
  return 'oblast';
}

function geoBadge(r){
  const l=geoLevel(r);
  if(l==='street') return '<span class="badge badge-geo-exact">📍 Точно (геокод)</span>';
  if(l==='city')   return '<span class="badge badge-geo-approx">📍 Місто (очікує)</span>';
  return '<span class="badge badge-geo-oblast">📍 Область</span>';
}

// Запустити геокодування у фоні
async function startGeocoding(data, onProgress){
  if(geoRunning) return;
  
  // Зібрати унікальні запити без кешу
  const seen = new Set();
  geoQueue = [];
  data.forEach(r=>{
    if(!r.gq||!r.needs_geocode) return;
    if(GEO[r.gq]) return;   // вже є в кеші
    if(seen.has(r.gq)) return;
    seen.add(r.gq);
    geoQueue.push({gq:r.gq, ids:[]});
  });
  // Populate ids
  data.forEach(r=>{
    if(!r.gq||!r.needs_geocode) return;
    const entry = geoQueue.find(e=>e.gq===r.gq);
    if(entry) entry.ids.push(r.id);
  });
  
  if(!geoQueue.length){ onProgress&&onProgress(0,0,'Всі адреси вже геокодовано ✓'); return; }
  
  geoRunning=true;
  const total=geoQueue.length;
  let done=0;
  
  for(const {gq,ids} of geoQueue){
    onProgress&&onProgress(done,total,`Геокодування: ${gq.slice(0,45)}...`);
    try{
      const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(gq)}&accept-language=uk&countrycodes=ua,ru`;
      const resp=await fetch(url,{headers:{'User-Agent':'ARMA-Registry/2.0'}});
      if(resp.ok){
        const d=await resp.json();
        if(d&&d.length){
          const coords={lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};
          GEO[gq]=coords;
          // Apply to records in memory
          data.forEach(r=>{ if(r.gq===gq){ r._lat=coords.lat; r._lng=coords.lng; } });
        }
      }
    }catch(e){}
    done++;
    // Save every 10
    if(done%10===0) localStorage.setItem(GEO_KEY,JSON.stringify(GEO));
    await new Promise(res=>setTimeout(res,1100)); // 1 req/sec Nominatim limit
  }
  
  localStorage.setItem(GEO_KEY,JSON.stringify(GEO));
  geoRunning=false;
  onProgress&&onProgress(total,total,'Геокодування завершено ✓');
}

// Геокодувати один конкретний запис негайно (при відкритті картки)
async function geocodeNow(r){
  if(!r.gq||!r.needs_geocode) return false;
  if(GEO[r.gq]){ r._lat=GEO[r.gq].lat; r._lng=GEO[r.gq].lng; return true; }
  try{
    const url=`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(r.gq)}&accept-language=uk&countrycodes=ua,ru`;
    const resp=await fetch(url,{headers:{'User-Agent':'ARMA-Registry/2.0'}});
    if(resp.ok){
      const d=await resp.json();
      if(d&&d.length){
        const coords={lat:parseFloat(d[0].lat),lng:parseFloat(d[0].lon)};
        GEO[r.gq]=coords;
        r._lat=coords.lat; r._lng=coords.lng;
        localStorage.setItem(GEO_KEY,JSON.stringify(GEO));
        return true;
      }
    }
  }catch(e){}
  return false;
}

// ===== DETAIL PANEL =====
function buildDetail(r, type='re'){
  const [lat,lng] = bestLatLng(r);
  const level = geoLevel(r);
  
  // OSM search query — use full address, not just coordinates
  const osmQ = encodeURIComponent((r.addr||r.gq||r.city||'Україна')+', Україна');
  const osmSearch = `https://www.openstreetmap.org/search?query=${osmQ}`;
  const osmCoords = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17&layers=M`;
  // Use coords link if geocoded precisely, search otherwise
  const osmUrl = level==='street' ? osmCoords : osmSearch;
  const gmUrl  = level==='street'
    ? `https://www.google.com/maps/place/${lat},${lng}/@${lat},${lng},17z`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((r.addr||r.city||'Україна')+', Україна')}`;

  const val = r.value ? `${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}` : '—';
  const kad = r.kadastr||'';

  return `
    <div class="dp-head">
      <button class="dp-close" onclick="closeDetail('${type}')">✕</button>
      <div class="dp-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · Гр: ${esc(r.group)}`:''}</div>
      <div class="dp-title">${esc((r.desc||'').slice(0,200))}${(r.desc||'').length>200?'…':''}</div>
      <div class="dp-badges">
        <span class="badge ${arrBadge(r.arr)}">${arrLabel(r.arr)}</span>
        ${r.complex==='simple' ?'<span class="badge badge-simple">Простий</span>':''}
        ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
        ${r.has_manager?'<span class="badge badge-managed">🛡 Управитель</span>':''}
        ${geoBadge(r)}
      </div>
    </div>
    <div class="dp-actions">
      <button class="dp-btn primary" id="btn-focus-${r.id}" onclick="focusMarker('${r.id}','${type}')">🎯 На карті</button>
      <a class="dp-btn" href="${osmUrl}" target="_blank" title="Відкрити в OpenStreetMap">🌐 OSM</a>
      <a class="dp-btn" href="${gmUrl}" target="_blank" title="Відкрити в Google Maps">🗺 Google</a>
      ${kad?`<a class="dp-btn" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(kad)}" target="_blank" style="background:rgba(6,182,212,.1);color:#0e7490;border-color:rgba(6,182,212,.3)" title="Публічна кадастрова карта">📋 Кадастр</a>`:''}
    </div>
    <div class="dp-section">
      <h4>📍 Адреса / Місцезнаходження</h4>
      ${r.addr?`<div class="dp-row"><span class="dp-lbl">Адреса</span><span class="dp-val" style="font-weight:600">${esc(r.addr)}</span></div>`:''}
      ${r.street?`<div class="dp-row"><span class="dp-lbl">Вулиця</span><span class="dp-val">${esc((r.street_type||'')+' '+r.street+(r.house?', буд. '+r.house:''))}</span></div>`:''}
      ${r.city  ?`<div class="dp-row"><span class="dp-lbl">Місто/село</span><span class="dp-val">${esc(r.city)}</span></div>`:''}
      ${r.district?`<div class="dp-row"><span class="dp-lbl">Район</span><span class="dp-val">${esc(r.district)}</span></div>`:''}
      ${r.oblast?`<div class="dp-row"><span class="dp-lbl">Область</span><span class="dp-val">${esc(r.oblast)}</span></div>`:''}
      ${kad     ?`<div class="dp-row"><span class="dp-lbl">Кадастр. №</span><span class="dp-val mono">${esc(kad)}</span></div>`:''}
      ${r.reg   ?`<div class="dp-row"><span class="dp-lbl">Реєстр. №</span><span class="dp-val mono">${esc(r.reg)}</span></div>`:''}
      <div class="dp-row">
        <span class="dp-lbl">Координати</span>
        <span class="dp-val mono" style="font-size:10px" id="coords-${r.id}">
          ${lat.toFixed(5)}, ${lng.toFixed(5)}
          <span style="color:${level==='street'?'#10b981':level==='city'?'#f59e0b':'#ef4444'}">
            ${level==='street'?'● точно':level==='city'?'● місто':'● область'}
          </span>
        </span>
      </div>
      ${!r.addr&&!r.city?'<div class="dp-row"><span class="dp-val dim">⚠ Точну адресу не визначено</span></div>':''}
    </div>
    <div class="dp-section">
      <h4>🏷 Класифікація</h4>
      ${r.type?`<div class="dp-row"><span class="dp-lbl">Вид активу</span><span class="dp-val">${esc(r.type)}</span></div>`:''}
      <div class="dp-row"><span class="dp-lbl">Складність</span><span class="dp-val">${r.complex==='simple'?'Простий':r.complex==='complex'?'Складний':'—'}</span></div>
      ${r.zone?`<div class="dp-row"><span class="dp-lbl">Зонування</span><span class="dp-val">${esc(r.zone)}</span></div>`:''}
      ${r.dept?`<div class="dp-row"><span class="dp-lbl">Відділ</span><span class="dp-val">${esc(r.dept)}</span></div>`:''}
      ${r.mtu ?`<div class="dp-row"><span class="dp-lbl">МТУ</span><span class="dp-val">${esc(r.mtu)}</span></div>`:''}
      ${r.inv_status?`<div class="dp-row"><span class="dp-lbl">Статус інв.</span><span class="dp-val" style="font-size:11px">${esc(r.inv_status)}</span></div>`:''}
    </div>
    ${r.own?`<div class="dp-section"><h4>👤 Власник</h4><div class="dp-row"><span class="dp-val">${esc(r.own)}</span></div></div>`:''}
    ${r.manager?`<div class="dp-section"><h4>🛡 Управитель</h4><div class="dp-row"><span class="dp-val">${esc(r.manager)}</span></div></div>`:''}
    <div class="dp-section">
      <h4>💵 Фінанси / Стан</h4>
      <div class="dp-row"><span class="dp-lbl">Вартість</span><span class="dp-val">${val}</span></div>
      ${r.usage    ?`<div class="dp-row"><span class="dp-lbl">Використання</span><span class="dp-val" style="font-size:11px">${esc(r.usage)}</span></div>`:''}
      ${r.condition?`<div class="dp-row"><span class="dp-lbl">Фіз. стан</span><span class="dp-val">${esc(r.condition)}</span></div>`:''}
    </div>
    ${r.court?`<div class="dp-section"><h4>⚖ Судові рішення</h4><p class="dp-desc-text" style="font-size:11px">${esc(r.court)}</p></div>`:''}
    <div class="dp-section" style="border:none">
      <h4>📝 Повний опис</h4>
      <p class="dp-desc-text">${esc(r.desc||'')}</p>
    </div>
  `;
}

function closeDetail(type){
  const id = type==='land'?'land-detail':'re-detail';
  document.getElementById(id).classList.remove('visible');
}

// ===== КАРТА НЕРУХОМОСТІ =====
const REMAP = (()=>{
  let map=null, cluster=null, markersById={}, hlMarker=null, currentSelected=null;

  function init(){
    if(map){ map.invalidateSize(); return; }
    map = L.map('map',{center:[49.0,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OpenStreetMap © CARTO',maxZoom:19,subdomains:'abcd'}).addTo(map);
    cluster = L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false});
    map.addLayer(cluster);
  }

  function makeIcon(r, selected=false){
    const color = arrColor(r.arr);
    const [lat,lng] = bestLatLng(r);
    const precise = geoLevel(r)==='street';
    const sz = selected ? 28 : (precise?14:12);
    return L.divIcon({
      className:'',
      html: selected
        ? `<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;animation:markerPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 3px ${color}66,0 4px 16px rgba(0,0,0,.5)"></div>
           </div>`
        : `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${color};border:${precise?'2.5px':'1.5px'} solid ${precise?'white':'rgba(255,255,255,.7)'};box-shadow:0 1px 5px rgba(0,0,0,.35)"></div>`,
      iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]
    });
  }

  function renderMarkers(filtered){
    cluster.clearLayers();
    markersById={};
    const mkrs = filtered.map(r=>{
      const [lat,lng]=bestLatLng(r);
      const m = L.marker([lat,lng],{icon:makeIcon(r)})
        .bindPopup(`
          <div class="lp-id">${r.id}</div>
          <div class="lp-title">${esc((r.desc||'').slice(0,90))}${(r.desc||'').length>90?'…':''}</div>
          <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
          <span class="badge ${arrBadge(r.arr)}">${arrLabel(r.arr)}</span>
          <br><br><a class="lp-link" onclick="REMAP.select('${r.id}',false)">→ Відкрити картку</a>
        `,{maxWidth:300,autoPanPadding:L.point(10,10)});
      m.on('click',()=>REMAP.select(r.id,false));
      m._assetId=r.id;
      markersById[r.id]=m;
      return m;
    });
    if(mkrs.length) cluster.addLayers(mkrs);
  }

  function renderList(filtered){
    const f=STATE.re, ps=f.pageSize, pg=f.page;
    const total=filtered.length, pages=Math.ceil(total/ps);
    const items=filtered.slice(pg*ps,pg*ps+ps);

    document.getElementById('re-cnt').textContent=fmt(total);
    document.getElementById('re-list').innerHTML=items.length
      ? items.map(r=>`
          <div class="asset-item ${r.id===currentSelected?'selected':''}" data-id="${r.id}" onclick="REMAP.select('${r.id}',true)">
            <div class="ai-id"><span>${r.id}</span>${r.group&&r.group!=='Груповано'?`<span>Гр.${r.group}</span>`:''}</div>
            <div class="ai-title">${esc((r.desc||'').slice(0,130))}${(r.desc||'').length>130?'…':''}</div>
            <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
            <div class="ai-badges">
              <span class="badge ${arrBadge(r.arr)}">${arrLabel(r.arr)}</span>
              ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
              ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
              ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
            </div>
          </div>`).join('')
      : '<div class="no-results">Нічого не знайдено</div>';

    const pgn=document.getElementById('re-pgn');
    if(total>ps){
      pgn.style.display='flex';
      pgn.innerHTML=`
        <button class="pgn-btn" ${pg===0?'disabled':''} onclick="REMAP.changePage(-1)">← Попер.</button>
        <span>${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="REMAP.changePage(1)">Наст. →</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const filtered=filterData(CACHE['realestate.json']||[],STATE.re);
    renderList(filtered);
    renderMarkers(filtered);
    renderFbtns(document.getElementById('re-sidebar'),STATE.re);
  }

  async function select(id, fromList=false){
    const data=CACHE['realestate.json']||[];
    const r=data.find(x=>x.id===id);
    if(!r) return;
    currentSelected=id;

    // 1. Highlight list item
    document.querySelectorAll('#re-list .asset-item').forEach(el=>{
      el.classList.toggle('selected',el.dataset.id===id);
      if(el.dataset.id===id && !fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });

    // 2. If no precise coords yet → geocode NOW before flying
    const hadCoords = !!r._lat;
    if(!hadCoords && r.needs_geocode){
      // Show "geocoding..." in detail panel
      const dp=document.getElementById('re-detail');
      dp.innerHTML=`<div class="detail-empty"><div class="empty-icon">🔍</div><p class="empty-text">Визначення точних координат адреси...<br><small>${esc(r.gq||'')}</small></p></div>`;
      dp.classList.add('visible');
      await geocodeNow(r);
    }

    // 3. Fly to PRECISE location
    const [lat,lng]=bestLatLng(r);
    if(!fromList || !hadCoords){
      map.flyTo([lat,lng], geoLevel(r)==='street'?17:14, {duration:0.7});
    }

    // 4. Remove old highlight, add new pulsing marker
    if(hlMarker){ map.removeLayer(hlMarker); hlMarker=null; }
    hlMarker = L.marker([lat,lng],{icon:makeIcon(r,true),zIndexOffset:2000})
      .addTo(map)
      .bindPopup(`
        <div class="lp-id">${r.id}</div>
        <div class="lp-title">${esc((r.desc||'').slice(0,80))}</div>
        <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
        <span style="font-size:10px;color:${geoLevel(r)==='street'?'#10b981':'#f59e0b'}">
          ${geoLevel(r)==='street'?'● Точно геокодовано':'● Приблизне місцезнаходження'}
        </span>
      `,{maxWidth:280})
      .openPopup();

    // 5. Render detail panel with updated coords
    const dp=document.getElementById('re-detail');
    dp.innerHTML=buildDetail(r,'re');
    dp.classList.add('visible');
  }

  function changePage(d){
    STATE.re.page=Math.max(0,STATE.re.page+d);
    renderList(filterData(CACHE['realestate.json']||[],STATE.re));
  }
  function filter(btn){
    STATE.re[btn.dataset.f]=btn.dataset.v;
    STATE.re.page=0;
    render();
  }
  function focusMarker(id){
    if(hlMarker) map.closePopup();
    const data=CACHE['realestate.json']||[];
    const r=data.find(x=>x.id===id);
    if(!r) return;
    const [lat,lng]=bestLatLng(r);
    map.flyTo([lat,lng],geoLevel(r)==='street'?17:14,{duration:0.6});
    if(hlMarker) hlMarker.openPopup();
  }

  // Start background geocoding after render
  async function startBgGeocode(){
    const data=CACHE['realestate.json']||[];
    const bar=document.getElementById('geo-bar');
    const msg=document.getElementById('geo-msg');
    await startGeocoding(data,(done,total,text)=>{
      if(total===0){ bar.classList.remove('visible'); return; }
      bar.classList.add('visible');
      msg.textContent=text;
      if(done===total){ setTimeout(()=>bar.classList.remove('visible'),3000); }
      // Refresh markers periodically
      if(done%20===0 && done>0) renderMarkers(filterData(data,STATE.re));
    });
    // Final refresh
    renderMarkers(filterData(data,STATE.re));
  }

  return {init,render,select,changePage,filter,focusMarker,startBgGeocode,getMap:()=>map};
})();

// ===== КАРТА ЗЕМЕЛЬНИХ ДІЛЯНОК =====
const LANDMAP = (()=>{
  let map=null, cluster=null, markersById={}, hlMarker=null, kadastrLayer=null, currentSelected=null;
  let loadedKadastr={};

  function init(){
    if(map){ map.invalidateSize(); return; }
    map=L.map('map-land',{center:[49.0,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    const carto=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OpenStreetMap © CARTO',maxZoom:19,subdomains:'abcd'});
    const osm=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {attribution:'© OpenStreetMap',maxZoom:19});
    carto.addTo(map);
    L.control.layers({'CARTO Light':carto,'OpenStreetMap':osm}).addTo(map);
    cluster=L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false});
    map.addLayer(cluster);
    kadastrLayer=L.layerGroup().addTo(map);
  }

  function makeIcon(r, selected=false){
    const color=arrColor(r.arr);
    const hasKad=!!r.kadastr;
    const sz=selected?28:(hasKad?15:12);
    return L.divIcon({
      className:'',
      html:selected
        ?`<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.2;animation:markerPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:${hasKad?'3px':'50%'};background:${color};border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.5)"></div>
           </div>`
        :`<div style="position:relative">
            <div style="width:${sz}px;height:${sz}px;border-radius:${hasKad?'3px':'50%'};background:${color};border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.3)"></div>
            ${hasKad?'<div style="position:absolute;bottom:-2px;right:-2px;width:6px;height:6px;border-radius:50%;background:#06b6d4;border:1px solid white"></div>':''}
           </div>`,
      iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]
    });
  }

  function renderMarkers(filtered){
    cluster.clearLayers();
    markersById={};
    const mkrs=filtered.map(r=>{
      const [lat,lng]=bestLatLng(r);
      const m=L.marker([lat,lng],{icon:makeIcon(r)})
        .bindPopup(`
          <div class="lp-id">${r.id}</div>
          <div class="lp-title">${esc((r.type||'Земельна ділянка').slice(0,80))}</div>
          <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
          ${r.kadastr?`<div class="land-kad-badge" style="margin:4px 0;display:inline-block">📋 ${r.kadastr}</div>`:''}
          <br><span class="badge ${arrBadge(r.arr)}">${arrLabel(r.arr)}</span>
          <br><br><a class="lp-link" onclick="LANDMAP.select('${r.id}',false)">→ Відкрити картку</a>
        `,{maxWidth:300});
      m.on('click',()=>LANDMAP.select(r.id,false));
      m._assetId=r.id;
      markersById[r.id]=m;
      return m;
    });
    if(mkrs.length) cluster.addLayers(mkrs);
  }

  function renderList(filtered){
    const f=STATE.land, ps=f.pageSize, pg=f.page;
    const total=filtered.length, pages=Math.ceil(total/ps);
    const items=filtered.slice(pg*ps,pg*ps+ps);

    document.getElementById('land-cnt').textContent=fmt(total);
    document.getElementById('land-list').innerHTML=items.length
      ? items.map(r=>`
          <div class="asset-item ${r.id===currentSelected?'selected':''}" data-id="${r.id}" onclick="LANDMAP.select('${r.id}',true)">
            <div class="ai-id">
              <span>${r.id}</span>
              ${r.kadastr?`<span style="font-family:monospace;font-size:9px;color:#0e7490">${r.kadastr}</span>`:''}
            </div>
            <div class="ai-title">${esc((r.type||'Земельна ділянка').slice(0,80))}</div>
            <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
            <div class="ai-badges">
              <span class="badge ${arrBadge(r.arr)}">${arrLabel(r.arr)}</span>
              ${r.kadastr?'<span class="land-kad-badge">📋 Кадастр</span>':''}
              ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
            </div>
          </div>`).join('')
      : '<div class="no-results">Нічого не знайдено</div>';

    const pgn=document.getElementById('land-pgn');
    if(total>ps){
      pgn.style.display='flex';
      pgn.innerHTML=`
        <button class="pgn-btn" ${pg===0?'disabled':''} onclick="LANDMAP.changePage(-1)">← Попер.</button>
        <span>${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="LANDMAP.changePage(1)">Наст. →</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const filtered=filterData(CACHE['land.json']||[],STATE.land);
    renderList(filtered);
    renderMarkers(filtered);
    renderFbtns(document.getElementById('land-sidebar'),STATE.land);
  }

  // Load kadastr parcel boundary from kadastrova-karta.com
  async function loadKadastrParcel(kad, lat, lng){
    if(loadedKadastr[kad]) return;
    
    // Try kadastrova-karta.com API (as shown in example URL)
    // Format: https://kadastrova-karta.com/dilyanka/CADNUM
    // This site uses an API to fetch GeoJSON — we try several sources
    
    const apis = [
      // 1. kadastr.live GeoJSON API
      `https://kadastr.live/api/parcel?cadnum=${encodeURIComponent(kad)}`,
      // 2. Ukrainian State Geocadastre WFS
      `https://map.land.gov.ua/gis/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastr:cadnum&outputFormat=application/json&CQL_FILTER=cadnum='${kad}'`,
    ];

    for(const url of apis){
      try{
        const resp=await fetch(url,{signal:AbortSignal.timeout(8000)});
        if(!resp.ok) continue;
        const data=await resp.json();
        
        // Handle different GeoJSON formats
        let geojson = null;
        if(data.type==='Feature'||data.type==='FeatureCollection') geojson=data;
        else if(data.geometry) geojson={type:'Feature',geometry:data.geometry,properties:data};
        else if(data.features&&data.features.length) geojson=data;
        
        if(!geojson) continue;
        
        const layer=L.geoJSON(geojson,{
          style:{color:'#0891b2',weight:2.5,fillColor:'#06b6d4',fillOpacity:0.2,dashArray:null}
        });
        layer.addTo(kadastrLayer);
        loadedKadastr[kad]=layer;
        
        // Fly to parcel bounds
        try{ map.fitBounds(layer.getBounds(),{padding:[50,50],maxZoom:18}); }catch(e){}
        
        // Add label
        const center=layer.getBounds().getCenter();
        L.marker(center,{icon:L.divIcon({
          className:'',
          html:`<div style="background:rgba(8,145,178,.9);color:white;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">${kad}</div>`,
          iconAnchor:[50,10]
        }),interactive:false}).addTo(kadastrLayer);
        
        return;
      }catch(e){ continue; }
    }
    // All APIs failed — just zoom to coords
    map.flyTo([lat,lng],15,{duration:0.6});
  }

  async function select(id, fromList=false){
    const data=CACHE['land.json']||[];
    const r=data.find(x=>x.id===id);
    if(!r) return;
    currentSelected=id;

    document.querySelectorAll('#land-list .asset-item').forEach(el=>{
      el.classList.toggle('selected',el.dataset.id===id);
      if(el.dataset.id===id && !fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });

    // Geocode if needed
    if(!r._lat && r.needs_geocode){
      const dp=document.getElementById('land-detail');
      dp.innerHTML=`<div class="detail-empty"><div class="empty-icon">🔍</div><p class="empty-text">Геокодування...</p></div>`;
      dp.classList.add('visible');
      await geocodeNow(r);
    }

    const [lat,lng]=bestLatLng(r);
    if(hlMarker){ map.removeLayer(hlMarker); hlMarker=null; }
    
    // If has kadastr - load boundary (this will flyTo parcel bounds)
    if(r.kadastr){
      // Show highlight marker first
      hlMarker=L.marker([lat,lng],{icon:makeIcon(r,true),zIndexOffset:2000}).addTo(map);
      map.flyTo([lat,lng],15,{duration:0.5});
      // Load parcel boundary
      await loadKadastrParcel(r.kadastr,lat,lng);
    } else {
      map.flyTo([lat,lng],geoLevel(r)==='street'?17:14,{duration:0.7});
      hlMarker=L.marker([lat,lng],{icon:makeIcon(r,true),zIndexOffset:2000}).addTo(map);
    }

    // Build detail with kadastr section
    let kadSection='';
    if(r.kadastr){
      const kadUrl=`https://kadastrova-karta.com/dilyanka/${encodeURIComponent(r.kadastr)}`;
      const pkk=`https://map.land.gov.ua/kadastrova-karta?cadnum=${r.kadastr}`;
      kadSection=`
        <div class="dp-section" style="background:rgba(6,182,212,.06);border-color:rgba(6,182,212,.2)">
          <h4>🗺 Кадастрова ділянка</h4>
          <div class="dp-row"><span class="dp-lbl">Кадастр. №</span><span class="dp-val mono">${r.kadastr}</span></div>
          <div class="dp-actions" style="padding:8px 0 0;flex-wrap:wrap">
            <a class="dp-btn" href="${kadUrl}" target="_blank" style="background:rgba(6,182,212,.12);color:#0e7490;border-color:rgba(6,182,212,.3);min-width:120px">🌐 kadastrova-karta.com</a>
            <a class="dp-btn" href="${pkk}" target="_blank" style="min-width:100px">🏛 Публічна кадастрова карта</a>
          </div>
          <div style="margin-top:8px;font-size:11px;color:var(--text3);line-height:1.5">
            Межі ділянки завантажуються автоматично при відкритті картки
          </div>
        </div>`;
    }

    const dp=document.getElementById('land-detail');
    dp.innerHTML=buildDetail(r,'land')+kadSection;
    dp.classList.add('visible');
  }

  function changePage(d){
    STATE.land.page=Math.max(0,STATE.land.page+d);
    renderList(filterData(CACHE['land.json']||[],STATE.land));
  }
  function filter(btn){
    STATE.land[btn.dataset.f]=btn.dataset.v;
    STATE.land.page=0;
    render();
  }
  function focusMarker(id){
    const data=CACHE['land.json']||[];
    const r=data.find(x=>x.id===id);
    if(!r) return;
    const [lat,lng]=bestLatLng(r);
    map.flyTo([lat,lng],r.kadastr?16:14,{duration:0.6});
  }

  return {init,render,select,changePage,filter,focusMarker,getMap:()=>map};
})();

// ===== КАРТКИ (транспорт, корп, кошти, тощо) =====
const CARDS = (()=>{
  const LABELS={transport:'🚗 Транспорт',corp:'📊 Корпоративні права',money:'💰 Грошові кошти та метали',movable:'📦 Інше рухоме майно',other:'🗂 Інше майно та права'};

  function getFiltered(){
    const k=STATE.cards.key;
    return k ? filterData(CACHE[k+'.json']||[],STATE.cards) : [];
  }

  function render(){
    const k=STATE.cards.key; if(!k) return;
    const data=CACHE[k+'.json']||[];
    const filtered=getFiltered();
    const ps=STATE.cards.pageSize, pg=STATE.cards.page;
    const total=filtered.length, pages=Math.ceil(total/ps);
    const items=filtered.slice(pg*ps,pg*ps+ps);

    document.getElementById('cards-title').innerHTML=`${LABELS[k]||k} <span class="result-cnt" id="cards-cnt">${fmt(filtered.length)}</span>`;
    document.getElementById('cards-stats').innerHTML=`<b>${fmt(filtered.length)}</b> за фільтром · Всього: ${fmt(data.length)} · З управит.: ${fmt(data.filter(r=>r.has_manager).length)}`;
    renderFbtns(document.getElementById('cards-filters-wrap'),STATE.cards);

    const pgnWrap=document.getElementById('cards-pgn-wrap');
    pgnWrap.innerHTML=total>ps?`
      <div class="sidebar-pgn" style="padding:6px 0">
        <button class="pgn-btn" ${pg===0?'disabled':''} onclick="CARDS.changePage(-1)">← Попер.</button>
        <span style="font-size:11px">${pg+1}/${pages}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="CARDS.changePage(1)">Наст. →</button>
      </div>`:'';

    document.getElementById('cards-grid').innerHTML=items.length
      ? items.map(r=>{
          const val=r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'—';
          const loc=[r.city,r.oblast].filter(Boolean).join(', ')||'—';
          return `<div class="card-item">
            <div class="ci-id"><span>${r.id}</span>${r.group&&r.group!=='Груповано'?`<span>Гр.${r.group}</span>`:''}</div>
            <div class="ci-type">${esc((r.type||r.asset_type||'').slice(0,45))}</div>
            <div class="ci-title">${esc((r.desc||'—').slice(0,150))}${(r.desc||'').length>150?'…':''}</div>
            <div class="ci-meta">
              <div class="ci-row"><span class="lbl">📍</span><span class="val">${esc(loc)}</span></div>
              ${r.own?`<div class="ci-row"><span class="lbl">👤</span><span class="val">${esc(r.own.slice(0,60))}</span></div>`:''}
              ${r.manager?`<div class="ci-row"><span class="lbl">🛡</span><span class="val">${esc(r.manager.slice(0,50))}</span></div>`:''}
              <div class="ci-row"><span class="lbl">💵</span><span class="val">${val}</span></div>
              ${r.dept?`<div class="ci-row"><span class="lbl">🗂</span><span class="val">${esc(r.dept)}</span></div>`:''}
            </div>
            <div class="ci-badges">
              <span class="badge ${arrBadge(r.arr)}">${arrLabel(r.arr)}</span>
              ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
              ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
              ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
            </div>
          </div>`;
        }).join('')
      : '<div class="no-results">Нічого не знайдено</div>';
  }

  function filter(btn){STATE.cards[btn.dataset.f]=btn.dataset.v;STATE.cards.page=0;render();}
  function changePage(d){STATE.cards.page=Math.max(0,STATE.cards.page+d);render();}
  return {render,filter,changePage};
})();

// ===== ГОЛОВНА СТОРІНКА =====
function renderHome(){
  const s=STATS;
  const byArr=s.by_arrest||{};
  const maxArr=Math.max(...Object.values(byArr),1);
  const arrColors={'Арештовано':'#f97316','Не арештовано':'#6b7280','Націоналзовано':'#8b5cf6','Скасування передачі ':'#ef4444','Стягнення в дохід держави':'#10b981',' скасування арешту в частині користування':'#db61a2','Арештовано (повторний арешт)':'#fa9856','спеціальна конфіскація':'#06b6d4'};

  document.getElementById('home-content').innerHTML=`
    <div class="home-wrap">
      <div class="home-hero">
        <img src="logo.png" class="home-hero-logo" alt="АРМА">
        <div>
          <h1>Реєстр арештованих активів</h1>
          <p>Агентство з розшуку та менеджменту активів України · ${fmt(s.total)} об'єктів</p>
        </div>
      </div>
      <div class="kpi-row">
        <div class="kpi-card" style="--kpi-color:#1a56db" onclick="APP.go('realestate')">
          <div class="kpi-label">Всього активів</div><div class="kpi-val">${fmt(s.total)}</div>
          <div class="kpi-sub">у реєстрі АРМА</div><div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#f97316" onclick="APP.go('realestate',{arr:'arrested'})">
          <div class="kpi-label">Арештовано</div><div class="kpi-val">${fmt(s.arrested)}</div>
          <div class="kpi-sub">активних арештів</div><div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#10b981" onclick="APP.go('realestate',{arr:'confiscated'})">
          <div class="kpi-label">Конфісковано</div><div class="kpi-val">${fmt(s.confiscated)}</div>
          <div class="kpi-sub">у дохід держави</div><div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#8b5cf6" onclick="APP.go('realestate',{arr:'national'})">
          <div class="kpi-label">Націоналізовано</div><div class="kpi-val">${fmt(s.national)}</div>
          <div class="kpi-sub">у власності держави</div><div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#10b981" onclick="APP.go('realestate',{mgr:'yes'})">
          <div class="kpi-label">З управителем</div><div class="kpi-val">${fmt(s.with_manager)}</div>
          <div class="kpi-sub">під управлінням</div><div class="kpi-arrow">→</div>
        </div>
      </div>
      <div class="section-h">Категорії активів</div>
      <div class="cat-row">
        ${[
          ['realestate','#f97316','rgba(249,115,22,.1)','🏢','Нерухомість',s.realestate,'будівлі, квартири, офіси'],
          ['land','#06b6d4','rgba(6,182,212,.1)','🌾','Земельні ділянки',s.land,"з прив'язкою до кадастру"],
          ['transport','#3b82f6','rgba(59,130,246,.1)','🚗','Транспорт',s.transport,'авто, причепи, техніка'],
          ['corp','#8b5cf6','rgba(139,92,246,.1)','📊','Корп. права',s.corp,'частки, акції, паї'],
          ['money','#f59e0b','rgba(245,158,11,.1)','💰','Грошові кошти',s.money,'банківські рахунки'],
          ['movable','#06b6d4','rgba(6,182,212,.08)','📦','Рухоме майно',s.movable,'товари, обладнання'],
          ['other','#ec4899','rgba(236,72,153,.1)','🗂','Інше майно',s.other,'майнові права, ІВ'],
          ['realestate','#1a56db','rgba(26,86,219,.1)','📋','Прості активи',s.simple,`з ${fmt(s.complex)} складних`],
        ].map(([page,color,bg,icon,name,count,sub])=>`
          <div class="cat-card" style="--cat-color:${color};--cat-bg:${bg}" onclick="APP.go('${page}')">
            <div class="cat-icon">${icon}</div>
            <div class="cat-name">${name}</div>
            <div class="cat-count">${fmt(count)}</div>
            <div class="cat-sub">${sub}</div>
          </div>`).join('')}
      </div>
      <div class="section-h">Аналітика</div>
      <div class="charts-row">
        <div class="chart-card">
          <h3>Стан арешту (всі активи)</h3>
          ${Object.entries(byArr).map(([k,v])=>`
            <div class="bar-item">
              <div class="bar-lbl"><span class="bar-name">${k.trim().slice(0,38)}</span><span class="bar-val">${fmt(v)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${(v/maxArr*100).toFixed(1)}%;background:${arrColors[k]||'#1a56db'}"></div></div>
            </div>`).join('')}
        </div>
        <div class="chart-card">
          <h3>Типи активів</h3>
          ${[['🏢 Нерухомість',s.realestate,'#f97316'],['🚗 Транспорт',s.transport,'#3b82f6'],
             ['🌾 Земля',s.land,'#10b981'],['📊 Корп. права',s.corp,'#8b5cf6'],
             ['📦 Рухоме',s.movable,'#f59e0b'],['💰 Кошти',s.money,'#06b6d4'],['🗂 Інше',s.other,'#ec4899']
            ].map(([n,v,c])=>`
            <div class="bar-item">
              <div class="bar-lbl"><span class="bar-name">${n}</span><span class="bar-val">${fmt(v)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${(v/s.total*100).toFixed(1)}%;background:${c}"></div></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ===== НАВІГАЦІЯ =====
function focusMarker(id, type){
  if(type==='re') REMAP.focusMarker(id);
  else if(type==='land') LANDMAP.focusMarker(id);
}

const APP = {
  async go(pageId, filterOverride){
    STATE.page=pageId;
    if(filterOverride){
      if(pageId==='realestate') Object.assign(STATE.re,filterOverride);
      else if(pageId==='land')  Object.assign(STATE.land,filterOverride);
    }

    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.toggle('active',t.dataset.page===pageId));

    if(pageId==='home'){
      document.getElementById('page-home').classList.add('active');
    } else if(pageId==='realestate'){
      document.getElementById('page-realestate').classList.add('active');
      await loadJSON('realestate.json');
      applyAllCachedCoords(CACHE['realestate.json']);
      setTimeout(()=>{ REMAP.init(); REMAP.render(); REMAP.startBgGeocode(); },50);
    } else if(pageId==='land'){
      document.getElementById('page-land').classList.add('active');
      await loadJSON('land.json');
      applyAllCachedCoords(CACHE['land.json']);
      setTimeout(()=>{ LANDMAP.init(); LANDMAP.render(); },50);
    } else {
      STATE.cards.key=pageId;
      document.getElementById('page-cards').classList.add('active');
      await loadJSON(pageId+'.json');
      CARDS.render();
    }
  },

  onSearch(val){
    STATE.search=val.toLowerCase();
    clearTimeout(APP._st);
    APP._st=setTimeout(()=>{
      if(STATE.page==='realestate'){STATE.re.page=0;REMAP.render();}
      else if(STATE.page==='land'){STATE.land.page=0;LANDMAP.render();}
      else if(['transport','corp','money','movable','other'].includes(STATE.page)){STATE.cards.page=0;CARDS.render();}
    },250);
  },

  async init(){
    const prog=document.getElementById('ldr-fill');
    const msg=document.getElementById('ldr-msg');
    try{
      prog.style.width='20%'; msg.textContent='Завантаження статистики...';
      STATS=await loadJSON('stats.json');
      
      prog.style.width='50%'; msg.textContent='Завантаження нерухомості...';
      await loadJSON('realestate.json');
      applyAllCachedCoords(CACHE['realestate.json']);
      
      prog.style.width='78%'; msg.textContent='Завантаження земельних ділянок...';
      await loadJSON('land.json');
      applyAllCachedCoords(CACHE['land.json']);
      
      if(!STATS.by_arrest){
        STATS.by_arrest={
          'Арештовано':STATS.arrested,'Не арештовано':STATS.not_arrested,
          'Конфісковано':STATS.confiscated,'Націоналізовано':STATS.national,'Скасовано':STATS.cancelled
        };
      }
      prog.style.width='95%'; msg.textContent='Готово!';
    } catch(e){
      msg.textContent='Помилка! Перевірте що всі .json файли на сервері.';
      console.error(e); return;
    }

    // Tabs
    document.getElementById('nav-tabs').innerHTML=TABS_CONFIG.map(t=>`
      <button class="nav-tab ${t.id==='home'?'active':''}" data-page="${t.id}" onclick="APP.go('${t.id}')">
        ${t.label}
        <span class="nav-cnt">${fmt(t.cnt?STATS[t.cnt]||0:STATS.total||0)}</span>
      </button>`).join('');

    prog.style.width='100%';
    setTimeout(()=>{
      document.getElementById('loader').style.display='none';
      document.getElementById('topnav').style.display='flex';
      document.getElementById('page-home').style.display='';
      document.getElementById('page-home').classList.add('active');
      renderHome();
    },300);
  }
};

async function loadJSON(file){
  if(CACHE[file]) return CACHE[file];
  const resp=await fetch(file);
  if(!resp.ok) throw new Error(`Cannot load ${file}: ${resp.status}`);
  CACHE[file]=await resp.json();
  return CACHE[file];
}

// Pulse CSS
document.head.insertAdjacentHTML('beforeend',`<style>
@keyframes markerPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(3.5);opacity:0}}
.badge-geo-oblast{background:rgba(239,68,68,.1);color:#b91c1c}
.badge-geo-approx{background:rgba(245,158,11,.1);color:#92400e}
.badge-geo-exact {background:rgba(16,185,129,.1);color:#047857}
</style>`);

document.addEventListener('DOMContentLoaded',()=>APP.init());
