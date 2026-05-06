/* ============================================================
   ARMA — app.js
   Головний JavaScript-файл сайту
   ============================================================ */

'use strict';

// ===== КОНФІГУРАЦІЯ ВКЛАДОК =====
const TABS_CONFIG = [
  { id:'home',       label:'🏠 Огляд',        icon:'🏠', file:null },
  { id:'realestate', label:'🏢 Нерухомість',   icon:'🏢', file:'realestate.json', cnt:'realestate' },
  { id:'land',       label:'🌾 Земля',         icon:'🌾', file:'land.json',        cnt:'land' },
  { id:'transport',  label:'🚗 Транспорт',     icon:'🚗', file:'transport.json',   cnt:'transport', cards:true },
  { id:'corp',       label:'📊 Корп. права',   icon:'📊', file:'corp.json',        cnt:'corp',      cards:true },
  { id:'money',      label:'💰 Кошти',         icon:'💰', file:'money.json',       cnt:'money',     cards:true },
  { id:'movable',    label:'📦 Рухоме',        icon:'📦', file:'movable.json',     cnt:'movable',   cards:true },
  { id:'other',      label:'🗂 Інше',          icon:'🗂', file:'other.json',       cnt:'other',     cards:true },
];

// ===== ГЛОБАЛЬНИЙ СТАН =====
const STATE = {
  page: 'home',
  search: '',
  re: { arr:'all', cmplx:'all', mgr:'all', page:0, pageSize:80 },
  land: { arr:'all', cmplx:'all', mgr:'all', page:0, pageSize:80 },
  cards: { arr:'all', cmplx:'all', mgr:'all', page:0, pageSize:100, key:null },
};

const CACHE = {};  // loaded JSON data
let STATS = {};

// ===== УТИЛІТИ =====
function fmt(n) { return Number(n).toLocaleString('uk-UA'); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function arrType(s) {
  if (!s) return 'unknown';
  s = s.toLowerCase();
  if (s.includes('конфіскац') || s.includes('стягнення')) return 'confiscated';
  if (s.includes('нац')) return 'national';
  if (s.includes('арештовано')) return 'arrested';
  if (s.includes('скасування')) return 'cancelled';
  if (s.includes('не арешт')) return 'notarr';
  return 'unknown';
}
function arrLabel(s) {
  if (!s) return '—';
  const t = arrType(s);
  return {arrested:'Арешт',confiscated:'Конфіск.',national:'Націонал.',cancelled:'Скасовано',notarr:'Не арешт.'}[t] || s.slice(0,14);
}
function arrColor(s) {
  return {arrested:'#f97316',confiscated:'#10b981',national:'#8b5cf6',cancelled:'#ef4444',notarr:'#6b7280'}[arrType(s)] || '#9ca3af';
}
function arrBadgeClass(s) {
  return {arrested:'badge-arrested',confiscated:'badge-confiscated',national:'badge-national',cancelled:'badge-cancelled',notarr:'badge-notarr'}[arrType(s)] || 'badge-notarr';
}

function filterData(data, f) {
  const q = STATE.search.toLowerCase();
  return data.filter(r => {
    if (f.arr !== 'all' && arrType(r.arr) !== f.arr) return false;
    if (f.cmplx === 'simple'  && r.complex !== 'simple')  return false;
    if (f.cmplx === 'complex' && r.complex !== 'complex') return false;
    if (f.mgr === 'yes' && !r.has_manager) return false;
    if (f.mgr === 'no'  &&  r.has_manager) return false;
    if (q) {
      const hay = [r.id, r.addr, r.city, r.oblast, r.own, r.desc, r.kadastr]
                    .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderFilterBtns(container, data, f) {
  const btns = container.querySelectorAll('.fbtn');
  btns.forEach(b => {
    b.classList.remove('active','red','green','purple','orange','teal');
    if (b.dataset.v === f[b.dataset.f]) {
      b.classList.add('active');
      const v = b.dataset.v;
      if (v==='arrested')    b.classList.add('orange');
      if (v==='confiscated' || v==='yes') b.classList.add('green');
      if (v==='national')    b.classList.add('purple');
      if (v==='cancelled')   b.classList.add('red');
      if (v==='complex')     b.classList.add('purple');
    }
  });
}

function buildDetailPanel(r, type='re') {
  const arrC = arrColor(r.arr);
  const geoLabel = r.geo_quality==='city' ? '📍 Місто точно' : r.geo_quality==='city_fuzzy' ? '📍 ~місто' : '📍 Область';
  const geoClass = r.geo_quality==='city' ? 'badge-geo-exact' : 'badge-geo-approx';

  const val = r.value ? `${fmt(parseFloat(r.value))} ${r.currency||'грн'}` : '—';

  // OSM link - use address for search
  const osmQ = encodeURIComponent((r.addr || `${r.city}, ${r.oblast}`) + ', Україна');
  const osmUrl = `https://www.openstreetmap.org/search?query=${osmQ}`;
  const gmUrl = `https://www.google.com/maps/search/?api=1&query=${osmQ}`;
  const kadUrl = r.kadastr ? `https://kadastr.live/?cadnum=${r.kadastr}` : null;
  const kadGovUrl = r.kadastr ? `https://map.land.gov.ua/kadastrova-karta?cadnum=${r.kadastr}` : null;

  return `
    <div class="dp-head">
      <button class="dp-close" onclick="closeDetail('${type}')">✕</button>
      <div class="dp-id">${r.id}${r.group && r.group!=='Груповано' ? ` · Гр: ${r.group}` : ''}</div>
      <div class="dp-title">${esc(r.desc.slice(0,200))}${r.desc.length>200?'…':''}</div>
      <div class="dp-badges">
        <span class="badge ${arrBadgeClass(r.arr)}">${arrLabel(r.arr)}</span>
        ${r.complex==='simple'  ? '<span class="badge badge-simple">Простий</span>' : ''}
        ${r.complex==='complex' ? '<span class="badge badge-complex">Складний</span>' : ''}
        ${r.has_manager ? '<span class="badge badge-managed">🛡 Управитель</span>' : ''}
        <span class="badge ${geoClass}">${geoLabel}</span>
      </div>
    </div>
    <div class="dp-actions">
      <button class="dp-btn primary" onclick="focusOnMap('${r.id}','${type}')">🎯 На карті</button>
      <a class="dp-btn" href="${osmUrl}" target="_blank">🌐 OSM</a>
      <a class="dp-btn" href="${gmUrl}" target="_blank">🗺 Google</a>
      ${kadUrl ? `<a class="dp-btn" href="${kadUrl}" target="_blank" style="background:rgba(6,182,212,.1);color:#0e7490">📋 Кадастр</a>` : ''}
    </div>
    <div class="dp-section">
      <h4>📍 Адреса / Місцезнаходження</h4>
      ${r.addr ? `<div class="dp-row"><span class="dp-lbl">Адреса</span><span class="dp-val" style="font-weight:600">${esc(r.addr)}</span></div>` : ''}
      ${r.street ? `<div class="dp-row"><span class="dp-lbl">Вулиця</span><span class="dp-val">${esc((r.street_type||'') + ' ' + r.street + (r.house ? ', буд. '+r.house : ''))}</span></div>` : ''}
      ${r.city   ? `<div class="dp-row"><span class="dp-lbl">Місто/село</span><span class="dp-val">${esc(r.city)}</span></div>` : ''}
      ${r.district ? `<div class="dp-row"><span class="dp-lbl">Район</span><span class="dp-val">${esc(r.district)}</span></div>` : ''}
      ${r.oblast ? `<div class="dp-row"><span class="dp-lbl">Область</span><span class="dp-val">${esc(r.oblast)}</span></div>` : ''}
      ${r.kadastr ? `<div class="dp-row"><span class="dp-lbl">Кадастр. №</span><span class="dp-val mono">${r.kadastr}</span></div>` : ''}
      ${!r.addr && !r.city ? `<div class="dp-row"><span class="dp-val dim">⚠ Точну адресу не визначено з опису</span></div>` : ''}
      <div class="dp-row"><span class="dp-lbl">Координати</span><span class="dp-val mono" style="font-size:10px">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</span></div>
    </div>
    <div class="dp-section">
      <h4>🏷 Класифікація</h4>
      ${r.type ? `<div class="dp-row"><span class="dp-lbl">Вид активу</span><span class="dp-val">${esc(r.type)}</span></div>` : ''}
      <div class="dp-row"><span class="dp-lbl">Складність</span><span class="dp-val">${r.complex==='simple'?'Простий':r.complex==='complex'?'Складний (Композитний)':'—'}</span></div>
      ${r.zone ? `<div class="dp-row"><span class="dp-lbl">Зонування</span><span class="dp-val">${esc(r.zone)}</span></div>` : ''}
      ${r.dept ? `<div class="dp-row"><span class="dp-lbl">Відділ</span><span class="dp-val">${esc(r.dept)}</span></div>` : ''}
      ${r.mtu  ? `<div class="dp-row"><span class="dp-lbl">МТУ</span><span class="dp-val">${esc(r.mtu)}</span></div>` : ''}
      ${r.inv_status ? `<div class="dp-row"><span class="dp-lbl">Статус інв.</span><span class="dp-val" style="font-size:11px">${esc(r.inv_status)}</span></div>` : ''}
    </div>
    ${r.own ? `<div class="dp-section"><h4>👤 Власник</h4><div class="dp-row"><span class="dp-val">${esc(r.own)}</span></div></div>` : ''}
    ${r.manager ? `<div class="dp-section"><h4>🛡 Управитель</h4><div class="dp-row"><span class="dp-val">${esc(r.manager)}</span></div></div>` : ''}
    <div class="dp-section">
      <h4>💵 Фінанси / Стан</h4>
      <div class="dp-row"><span class="dp-lbl">Вартість</span><span class="dp-val">${val}</span></div>
      ${r.usage    ? `<div class="dp-row"><span class="dp-lbl">Використання</span><span class="dp-val" style="font-size:11px">${esc(r.usage)}</span></div>` : ''}
      ${r.condition ? `<div class="dp-row"><span class="dp-lbl">Фіз. стан</span><span class="dp-val">${esc(r.condition)}</span></div>` : ''}
    </div>
    ${r.court ? `<div class="dp-section"><h4>⚖ Судові рішення</h4><div class="dp-row"><span class="dp-val" style="font-size:11px">${esc(r.court)}</span></div></div>` : ''}
    <div class="dp-section" style="border:none">
      <h4>📝 Повний опис</h4>
      <div class="dp-desc-text">${esc(r.desc)}</div>
    </div>
  `;
}

function closeDetail(type) {
  document.getElementById(type==='land' ? 'land-detail' : type==='re' ? 're-detail' : 're-detail').classList.remove('visible');
}

// ===== ЗАВАНТАЖЕННЯ ДАНИХ =====
async function loadJSON(file) {
  if (CACHE[file]) return CACHE[file];
  const resp = await fetch(file);
  if (!resp.ok) throw new Error(`Failed to load ${file}`);
  CACHE[file] = await resp.json();
  return CACHE[file];
}

// ===== REAL ESTATE MAP MODULE =====
const REMAP = (() => {
  let map = null, clusterLayer = null, allMarkers = {}, selectedId = null, selectedHighlight = null;

  function init() {
    if (map) { map.invalidateSize(); return; }
    map = L.map('map', { center:[49.0, 31.5], zoom:6, zoomControl:true, preferCanvas:true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution:'© OpenStreetMap © CARTO', maxZoom:19, subdomains:'abcd' }).addTo(map);
    clusterLayer = L.markerClusterGroup({ chunkedLoading:true, maxClusterRadius:50, spiderfyOnMaxZoom:true, showCoverageOnHover:false });
    map.addLayer(clusterLayer);
  }

  function getFiltered() {
    const data = CACHE['realestate.json'] || [];
    return filterData(data, STATE.re);
  }

  function renderList(filtered) {
    const f = STATE.re;
    const ps = f.pageSize, page = f.page;
    const total = filtered.length;
    const totalPages = Math.ceil(total / ps);
    const items = filtered.slice(page*ps, page*ps+ps);

    document.getElementById('re-cnt').textContent = fmt(total);

    document.getElementById('re-list').innerHTML = items.length
      ? items.map(r => `
        <div class="asset-item ${r.id===selectedId?'selected':''}" data-id="${r.id}" onclick="REMAP.select('${r.id}')">
          <div class="ai-id"><span>${r.id}</span>${r.group&&r.group!=='Груповано'?`<span>Гр.${r.group}</span>`:''}</div>
          <div class="ai-title">${esc(r.desc.slice(0,130))}${r.desc.length>130?'…':''}</div>
          <div class="ai-addr">📍 ${esc(r.addr || r.city || r.oblast || '—')}</div>
          <div class="ai-badges">
            <span class="badge ${arrBadgeClass(r.arr)}">${arrLabel(r.arr)}</span>
            ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
            ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
            ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
          </div>
        </div>`).join('')
      : '<div class="no-results">Нічого не знайдено</div>';

    // Pagination
    const pgn = document.getElementById('re-pgn');
    if (total > ps) {
      pgn.style.display = 'flex';
      pgn.innerHTML = `
        <button class="pgn-btn" ${page===0?'disabled':''} onclick="REMAP.changePage(-1)">← Попер.</button>
        <span>${page+1} / ${totalPages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${page>=totalPages-1?'disabled':''} onclick="REMAP.changePage(1)">Наст. →</button>`;
    } else { pgn.style.display='none'; }
  }

  function renderMarkers(filtered) {
    clusterLayer.clearLayers();
    allMarkers = {};
    const markers = filtered.map(r => {
      const color = arrColor(r.arr);
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative">
          <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
        </div>`,
        iconSize:[14,14], iconAnchor:[7,7]
      });
      const m = L.marker([r.lat, r.lng], {icon})
        .bindPopup(`<div class="lp-id">${r.id}</div>
          <div class="lp-title">${esc(r.desc.slice(0,80))}${r.desc.length>80?'…':''}</div>
          <div class="lp-addr">📍 ${esc(r.addr || r.city || '—')}</div>
          <span class="badge ${arrBadgeClass(r.arr)}">${arrLabel(r.arr)}</span>
          <br><br><span class="lp-link" onclick="REMAP.select('${r.id}')">→ Відкрити картку</span>
        `, {maxWidth:300});
      m.on('click', () => REMAP.select(r.id));
      m._assetId = r.id;
      allMarkers[r.id] = m;
      return m;
    });
    if (markers.length) clusterLayer.addLayers(markers);
  }

  function render() {
    const filtered = getFiltered();
    renderList(filtered);
    renderMarkers(filtered);
    renderFilterBtns(document.getElementById('re-sidebar'), CACHE['realestate.json']||[], STATE.re);
  }

  function select(id) {
    const data = CACHE['realestate.json'] || [];
    const r = data.find(x => x.id === id);
    if (!r) return;
    selectedId = id;

    // Highlight list item
    document.querySelectorAll('#re-list .asset-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === id);
      if (el.dataset.id === id) el.scrollIntoView({block:'nearest', behavior:'smooth'});
    });

    // Remove old highlight marker
    if (selectedHighlight) { map.removeLayer(selectedHighlight); selectedHighlight = null; }

    // Fly to location
    map.flyTo([r.lat, r.lng], 15, {duration:0.7});

    // Add pulsing highlight marker
    const color = arrColor(r.arr);
    const hlIcon = L.divIcon({
      className:'',
      html:`<div style="position:relative;width:30px;height:30px">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.25;animation:markerPulse 1.5s ease-out infinite"></div>
        <div style="position:absolute;inset:7px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 0 0 3px ${color}44,0 4px 16px rgba(0,0,0,.4)"></div>
      </div>`,
      iconSize:[30,30], iconAnchor:[15,15]
    });
    selectedHighlight = L.marker([r.lat,r.lng],{icon:hlIcon,zIndexOffset:1000}).addTo(map);

    // Show detail panel
    const dp = document.getElementById('re-detail');
    dp.innerHTML = buildDetailPanel(r,'re');
    dp.classList.add('visible');

    // Start geocoding if not yet geocoded
    scheduleGeocode(r, 're');
  }

  function changePage(delta) {
    STATE.re.page = Math.max(0, STATE.re.page + delta);
    const f = getFiltered();
    renderList(f);
  }

  function filter(btn) {
    STATE.re[btn.dataset.f] = btn.dataset.v;
    STATE.re.page = 0;
    render();
  }

  return { init, render, select, changePage, filter,
    getMap: () => map, getAllMarkers: () => allMarkers,
    clearHighlight: () => { if(selectedHighlight){map.removeLayer(selectedHighlight);selectedHighlight=null;} }
  };
})();

// ===== LAND MAP MODULE =====
const LANDMAP = (() => {
  let map = null, clusterLayer = null, kadastrLayer = null, allMarkers = {}, selectedId = null, selectedHighlight = null, kadastrMode = false;

  function init() {
    if (map) { map.invalidateSize(); return; }
    map = L.map('map-land', { center:[49.0,31.5], zoom:6, zoomControl:true, preferCanvas:true });

    const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution:'© OpenStreetMap © CARTO', maxZoom:19, subdomains:'abcd' });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution:'© OpenStreetMap', maxZoom:19 });
    cartoLight.addTo(map);
    L.control.layers({'CARTO Light':cartoLight, 'OpenStreetMap':osm}).addTo(map);

    clusterLayer = L.markerClusterGroup({ chunkedLoading:true, maxClusterRadius:50, spiderfyOnMaxZoom:true, showCoverageOnHover:false });
    map.addLayer(clusterLayer);
    kadastrLayer = L.layerGroup().addTo(map);

    // Load kadastr tiles when zoomed in
    map.on('moveend', () => {
      if (kadastrMode && map.getZoom() >= 14) loadKadastrTiles();
    });
  }

  function getFiltered() {
    return filterData(CACHE['land.json']||[], STATE.land);
  }

  function renderList(filtered) {
    const ps = STATE.land.pageSize, page = STATE.land.page;
    const total = filtered.length, totalPages = Math.ceil(total/ps);
    const items = filtered.slice(page*ps, page*ps+ps);

    document.getElementById('land-cnt').textContent = fmt(total);

    document.getElementById('land-list').innerHTML = items.length
      ? items.map(r => `
        <div class="asset-item ${r.id===selectedId?'selected':''}" data-id="${r.id}" onclick="LANDMAP.select('${r.id}')">
          <div class="ai-id"><span>${r.id}</span>${r.kadastr?`<span style="font-family:monospace;color:#0e7490">${r.kadastr}</span>`:''}</div>
          <div class="ai-title">${esc((r.type||'Земельна ділянка').slice(0,80))}</div>
          <div class="ai-addr">📍 ${esc(r.addr || r.city || r.oblast || '—')}</div>
          <div class="ai-badges">
            <span class="badge ${arrBadgeClass(r.arr)}">${arrLabel(r.arr)}</span>
            ${r.kadastr?'<span class="land-kad-badge">📋 кадастр</span>':''}
            ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
          </div>
        </div>`).join('')
      : '<div class="no-results">Нічого не знайдено</div>';

    const pgn = document.getElementById('land-pgn');
    if (total > ps) {
      pgn.style.display = 'flex';
      pgn.innerHTML = `
        <button class="pgn-btn" ${page===0?'disabled':''} onclick="LANDMAP.changePage(-1)">← Попер.</button>
        <span>${page+1} / ${totalPages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${page>=totalPages-1?'disabled':''} onclick="LANDMAP.changePage(1)">Наст. →</button>`;
    } else { pgn.style.display='none'; }
  }

  function renderMarkers(filtered) {
    clusterLayer.clearLayers();
    allMarkers = {};
    const markers = filtered.map(r => {
      const color = arrColor(r.arr);
      const hasKad = !!r.kadastr;
      const icon = L.divIcon({
        className:'',
        html:`<div style="position:relative">
          <div style="width:${hasKad?16:12}px;height:${hasKad?16:12}px;border-radius:${hasKad?'3px':'50%'};background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>
          ${hasKad ? '<div style="position:absolute;bottom:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:#06b6d4;border:1px solid white"></div>' : ''}
        </div>`,
        iconSize:[hasKad?16:12,hasKad?16:12], iconAnchor:[hasKad?8:6, hasKad?8:6]
      });
      const m = L.marker([r.lat,r.lng],{icon})
        .bindPopup(`<div class="lp-id">${r.id}</div>
          <div class="lp-title">${esc((r.type||'').slice(0,80))}</div>
          <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
          ${r.kadastr ? `<div class="land-kad-badge" style="margin:4px 0;display:inline-block">📋 ${r.kadastr}</div>` : ''}
          <br><span class="badge ${arrBadgeClass(r.arr)}">${arrLabel(r.arr)}</span>
          <br><br><span class="lp-link" onclick="LANDMAP.select('${r.id}')">→ Відкрити картку</span>
        `, {maxWidth:300});
      m.on('click', () => LANDMAP.select(r.id));
      m._assetId = r.id;
      allMarkers[r.id] = m;
      return m;
    });
    if (markers.length) clusterLayer.addLayers(markers);
  }

  function render() {
    const filtered = getFiltered();
    renderList(filtered);
    renderMarkers(filtered);
    renderFilterBtns(document.getElementById('land-sidebar'), CACHE['land.json']||[], STATE.land);
  }

  function select(id) {
    const data = CACHE['land.json'] || [];
    const r = data.find(x => x.id === id);
    if (!r) return;
    selectedId = id;

    document.querySelectorAll('#land-list .asset-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === id);
      if (el.dataset.id === id) el.scrollIntoView({block:'nearest', behavior:'smooth'});
    });

    if (selectedHighlight) { map.removeLayer(selectedHighlight); selectedHighlight = null; }
    map.flyTo([r.lat, r.lng], r.kadastr ? 16 : 14, {duration:0.7});

    const color = arrColor(r.arr);
    const hlIcon = L.divIcon({
      className:'',
      html:`<div style="position:relative;width:30px;height:30px">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.25;animation:markerPulse 1.5s ease-out infinite"></div>
        <div style="position:absolute;inset:7px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.4)"></div>
      </div>`,
      iconSize:[30,30], iconAnchor:[15,15]
    });
    selectedHighlight = L.marker([r.lat,r.lng],{icon:hlIcon,zIndexOffset:1000}).addTo(map);

    // If has kadastr - load the parcel boundary
    if (r.kadastr) {
      loadKadastrParcel(r.kadastr, r.lat, r.lng);
    }

    const dp = document.getElementById('land-detail');
    dp.innerHTML = buildDetailPanel(r,'land') + (r.kadastr ? `
      <div class="dp-section" style="background:rgba(6,182,212,.06);border-color:rgba(6,182,212,.15)">
        <h4>🗺 Кадастрова ділянка</h4>
        <div class="dp-row">
          <span class="dp-lbl">Кадастр. №</span>
          <span class="dp-val mono">${r.kadastr}</span>
        </div>
        <div class="dp-actions" style="padding:8px 0 0">
          <a class="dp-btn" href="https://kadastr.live/?cadnum=${r.kadastr}" target="_blank" style="background:rgba(6,182,212,.12);color:#0e7490;border-color:rgba(6,182,212,.3)">📋 kadastr.live</a>
          <a class="dp-btn" href="https://map.land.gov.ua/kadastrova-karta?cadnum=${r.kadastr}" target="_blank">🏛 Публічна кадастрова карта</a>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--text3)">Межі ділянки завантажуються автоматично при наближенні на карті</div>
      </div>` : '');
    dp.classList.add('visible');
  }

  function changePage(delta) {
    STATE.land.page = Math.max(0, STATE.land.page + delta);
    renderList(getFiltered());
  }

  function filter(btn) {
    STATE.land[btn.dataset.f] = btn.dataset.v;
    STATE.land.page = 0;
    render();
  }

  // ===== KADASTR BOUNDARY LOADING =====
  let kadastrPolygons = {}; // cadnum -> layer

  async function loadKadastrParcel(cadnum, lat, lng) {
    if (kadastrPolygons[cadnum]) {
      // Already loaded - just highlight it
      highlightKadastrPolygon(cadnum);
      return;
    }
    try {
      // Use kadastr.live API to get parcel GeoJSON
      const url = `https://kadastr.live/api/parcel?cadnum=${encodeURIComponent(cadnum)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('API error');
      const geojson = await resp.json();
      if (!geojson || !geojson.geometry) return;

      const layer = L.geoJSON(geojson, {
        style: {
          color: '#0891b2',
          weight: 2.5,
          fillColor: '#06b6d4',
          fillOpacity: 0.18,
          dashArray: null,
        }
      }).addTo(kadastrLayer);
      kadastrPolygons[cadnum] = layer;
      highlightKadastrPolygon(cadnum);
      // Fit to parcel
      try { map.fitBounds(layer.getBounds(), {padding:[40,40]}); } catch(e){}
    } catch(e) {
      console.warn('Kadastr API unavailable for', cadnum, '- trying alternative');
      // Fallback: try official API
      tryOfficialKadastrAPI(cadnum);
    }
  }

  async function tryOfficialKadastrAPI(cadnum) {
    // Ukrainian State Land Cadastre WFS
    try {
      const wfsUrl = `https://map.land.gov.ua/gis/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastr:cadnum&outputFormat=application/json&CQL_FILTER=cadnum='${cadnum}'`;
      const resp = await fetch(wfsUrl);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.features || !data.features.length) return;
      const layer = L.geoJSON(data, {
        style: { color:'#0891b2', weight:2.5, fillColor:'#06b6d4', fillOpacity:0.18 }
      }).addTo(kadastrLayer);
      kadastrPolygons[cadnum] = layer;
      try { map.fitBounds(layer.getBounds(), {padding:[40,40]}); } catch(e){}
    } catch(e) { console.warn('Official kadastr API also unavailable'); }
  }

  function highlightKadastrPolygon(cadnum) {
    Object.entries(kadastrPolygons).forEach(([cad, layer]) => {
      layer.setStyle(cad === cadnum
        ? { color:'#0e7490', weight:3.5, fillColor:'#06b6d4', fillOpacity:0.30 }
        : { color:'#0891b2', weight:2,   fillColor:'#06b6d4', fillOpacity:0.15 });
    });
  }

  async function loadKadastrTiles() {
    // Load all parcels currently visible on map for items with kadastr
    const data = CACHE['land.json'] || [];
    const bounds = map.getBounds();
    const visible = data.filter(r => r.kadastr && bounds.contains([r.lat, r.lng]));
    for (const r of visible.slice(0,30)) {
      if (!kadastrPolygons[r.kadastr]) {
        await loadKadastrParcel(r.kadastr, r.lat, r.lng);
        await new Promise(res => setTimeout(res, 300)); // rate limit
      }
    }
  }

  function toggleKadastrMode() {
    kadastrMode = !kadastrMode;
    const btn = document.getElementById('btn-show-kadastr');
    if (kadastrMode) {
      btn.style.background = 'rgba(6,182,212,.25)';
      btn.style.color = '#0e7490';
      btn.textContent = '📋 Межі ділянок: УВІМК (наблизьтесь)';
      if (map.getZoom() >= 14) loadKadastrTiles();
      else {
        // Show hint
        alert('Наблизьтесь на карті (зум 14+) для завантаження меж кадастрових ділянок');
      }
    } else {
      btn.style.background = 'rgba(6,182,212,.12)';
      btn.textContent = '📋 Показати межі ділянок (є кадастр. №)';
      kadastrLayer.clearLayers();
      kadastrPolygons = {};
    }
  }

  return { init, render, select, changePage, filter, toggleKadastrMode, getMap:()=>map };
})();

// ===== CARDS MODULE =====
const CARDS = (() => {
  const CAT_LABELS = {
    transport: '🚗 Транспорт',
    corp:      '📊 Корпоративні права',
    money:     '💰 Грошові кошти та метали',
    movable:   '📦 Інше рухоме майно',
    other:     '🗂 Інше майно та права',
  };

  function getFiltered() {
    const key = STATE.cards.key;
    if (!key) return [];
    return filterData(CACHE[key+'.json']||[], STATE.cards);
  }

  function render() {
    const key = STATE.cards.key;
    if (!key) return;
    const data = CACHE[key+'.json'] || [];
    const filtered = getFiltered();

    document.getElementById('cards-title').innerHTML = `${CAT_LABELS[key]||key} <span class="result-cnt" id="cards-cnt">${fmt(filtered.length)}</span>`;
    document.getElementById('cards-cnt').textContent = fmt(filtered.length);

    // Stats
    const arrCounts = {};
    data.forEach(r => { const t=arrType(r.arr); arrCounts[t]=(arrCounts[t]||0)+1; });
    document.getElementById('cards-stats').innerHTML =
      `<b>${fmt(filtered.length)}</b> активів за фільтром<br>
       Всього: ${fmt(data.length)} | З упр.: ${fmt(data.filter(r=>r.has_manager).length)}`;

    renderFilterBtns(document.getElementById('cards-filters-wrap'), data, STATE.cards);

    const ps = STATE.cards.pageSize, page = STATE.cards.page;
    const total = filtered.length, totalPages = Math.ceil(total/ps);
    const items = filtered.slice(page*ps, page*ps+ps);

    // Pagination in sidebar
    const pgnWrap = document.getElementById('cards-pgn-wrap');
    if (total > ps) {
      pgnWrap.innerHTML = `
        <div class="sidebar-pgn" style="padding:6px 0">
          <button class="pgn-btn" ${page===0?'disabled':''} onclick="CARDS.changePage(-1)">← Попер.</button>
          <span style="font-size:11px">${page+1}/${totalPages}</span>
          <button class="pgn-btn" ${page>=totalPages-1?'disabled':''} onclick="CARDS.changePage(1)">Наст. →</button>
        </div>`;
    } else { pgnWrap.innerHTML=''; }

    document.getElementById('cards-grid').innerHTML = items.length
      ? items.map(r => {
          const val = r.value ? `${fmt(parseFloat(r.value))} ${r.currency||'грн'}` : '—';
          const loc = [r.city, r.oblast].filter(Boolean).join(', ') || '—';
          return `<div class="card-item">
            <div class="ci-id"><span>${r.id}</span>${r.group&&r.group!=='Груповано'?`<span>Гр.${r.group}</span>`:''}</div>
            <div class="ci-type">${esc((r.type||r.asset_type||'').slice(0,45))}</div>
            <div class="ci-title">${esc((r.desc||'—').slice(0,150))}${r.desc&&r.desc.length>150?'…':''}</div>
            <div class="ci-meta">
              <div class="ci-row"><span class="lbl">📍 Місце</span><span class="val">${esc(loc)}</span></div>
              ${r.own?`<div class="ci-row"><span class="lbl">👤 Власник</span><span class="val">${esc(r.own.slice(0,60))}${r.own.length>60?'…':''}</span></div>`:''}
              ${r.manager?`<div class="ci-row"><span class="lbl">🛡 Упр-ль</span><span class="val">${esc(r.manager.slice(0,50))}</span></div>`:''}
              <div class="ci-row"><span class="lbl">💵 Вартість</span><span class="val">${val}</span></div>
              ${r.dept?`<div class="ci-row"><span class="lbl">🗂 Відділ</span><span class="val">${esc(r.dept)}</span></div>`:''}
              ${r.date?`<div class="ci-row"><span class="lbl">📅 Дата</span><span class="val">${r.date}</span></div>`:''}
            </div>
            <div class="ci-badges">
              <span class="badge ${arrBadgeClass(r.arr)}">${arrLabel(r.arr)}</span>
              ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
              ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
              ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
            </div>
          </div>`;
        }).join('')
      : '<div class="no-results">Нічого не знайдено за фільтрами</div>';
  }

  function filter(btn) {
    STATE.cards[btn.dataset.f] = btn.dataset.v;
    STATE.cards.page = 0;
    render();
  }

  function changePage(delta) {
    STATE.cards.page = Math.max(0, STATE.cards.page + delta);
    render();
  }

  return { render, filter, changePage };
})();

// ===== GEOCODING =====
const GEO_CACHE_KEY = 'arma_geocache_v2';
let geoCache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
let geocodeQueue = [];
let geocoding = false;

function scheduleGeocode(r, type) {
  // If this record has precise street+city, try to geocode it for better accuracy
  if (!r.street || !r.city) return;
  const key = [r.oblast, r.city, r.street, r.house].filter(Boolean).join('|');
  if (geoCache[key]) {
    r._geo_lat = geoCache[key].lat;
    r._geo_lng = geoCache[key].lng;
    return;
  }
  geocodeQueue.push({r, key, type});
  if (!geocoding) runGeocodeQueue();
}

async function runGeocodeQueue() {
  if (geocoding || !geocodeQueue.length) return;
  geocoding = true;
  const bar = document.getElementById('geo-bar');
  bar.classList.add('visible');

  while (geocodeQueue.length) {
    const {r, key, type} = geocodeQueue.shift();
    const query = [r.street && r.house ? `${r.street} ${r.house}` : r.street, r.city, 'Україна'].filter(Boolean).join(', ');
    document.getElementById('geo-msg').textContent = `Геокодування: ${query.slice(0,50)}...`;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}&accept-language=uk`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data.length) {
          const coords = {lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon)};
          geoCache[key] = coords;
          r._geo_lat = coords.lat;
          r._geo_lng = coords.lng;
          localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCache));
          // Update marker position
          // (Marker position update would require re-render - skip for now, pan is enough)
        }
      }
    } catch(e) {}
    await new Promise(res => setTimeout(res, 1200));
  }
  geocoding = false;
  bar.classList.remove('visible');
}

function focusOnMap(id, type) {
  if (type === 're') REMAP.select(id);
  else if (type === 'land') LANDMAP.select(id);
}

// ===== HOME PAGE =====
function renderHome() {
  const s = STATS;
  const maxArr = Math.max(...Object.values(s.by_arrest || {0:1}));
  const arrColors = {'Арештовано':'#f97316','Не арештовано':'#6b7280','Націоналзовано':'#8b5cf6','Скасування передачі ':'#ef4444','Стягнення в дохід держави':'#10b981',' скасування арешту в частині користування':'#db61a2','Арештовано (повторний арешт)':'#fa9856','спеціальна конфіскація':'#06b6d4'};

  document.getElementById('home-content').innerHTML = `
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
          <div class="kpi-label">Всього активів</div>
          <div class="kpi-val">${fmt(s.total)}</div>
          <div class="kpi-sub">у реєстрі АРМА</div>
          <div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#f97316" onclick="APP.go('realestate',{arr:'arrested'})">
          <div class="kpi-label">Арештовано</div>
          <div class="kpi-val">${fmt(s.arrested)}</div>
          <div class="kpi-sub">активних арештів</div>
          <div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#10b981" onclick="APP.go('realestate',{arr:'confiscated'})">
          <div class="kpi-label">Конфісковано</div>
          <div class="kpi-val">${fmt(s.confiscated)}</div>
          <div class="kpi-sub">у дохід держави</div>
          <div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#8b5cf6" onclick="APP.go('realestate',{arr:'national'})">
          <div class="kpi-label">Націоналізовано</div>
          <div class="kpi-val">${fmt(s.national)}</div>
          <div class="kpi-sub">у власності держави</div>
          <div class="kpi-arrow">→</div>
        </div>
        <div class="kpi-card" style="--kpi-color:#10b981" onclick="APP.go('realestate',{mgr:'yes'})">
          <div class="kpi-label">З управителем</div>
          <div class="kpi-val">${fmt(s.with_manager)}</div>
          <div class="kpi-sub">активів під управлінням</div>
          <div class="kpi-arrow">→</div>
        </div>
      </div>

      <div class="section-h">Категорії активів</div>
      <div class="cat-row">
        <div class="cat-card" style="--cat-color:#f97316;--cat-bg:rgba(249,115,22,.1)" onclick="APP.go('realestate')">
          <div class="cat-icon">🏢</div>
          <div class="cat-name">Нерухомість</div>
          <div class="cat-count">${fmt(s.realestate)}</div>
          <div class="cat-sub">будівлі, квартири, офіси</div>
        </div>
        <div class="cat-card" style="--cat-color:#06b6d4;--cat-bg:rgba(6,182,212,.1)" onclick="APP.go('land')">
          <div class="cat-icon">🌾</div>
          <div class="cat-name">Земельні ділянки</div>
          <div class="cat-count">${fmt(s.land)}</div>
          <div class="cat-sub">з прив'язкою до кадастру</div>
        </div>
        <div class="cat-card" style="--cat-color:#3b82f6;--cat-bg:rgba(59,130,246,.1)" onclick="APP.go('transport')">
          <div class="cat-icon">🚗</div>
          <div class="cat-name">Транспорт</div>
          <div class="cat-count">${fmt(s.transport)}</div>
          <div class="cat-sub">авто, причепи, техніка</div>
        </div>
        <div class="cat-card" style="--cat-color:#8b5cf6;--cat-bg:rgba(139,92,246,.1)" onclick="APP.go('corp')">
          <div class="cat-icon">📊</div>
          <div class="cat-name">Корп. права</div>
          <div class="cat-count">${fmt(s.corp)}</div>
          <div class="cat-sub">частки, акції, паї</div>
        </div>
        <div class="cat-card" style="--cat-color:#f59e0b;--cat-bg:rgba(245,158,11,.1)" onclick="APP.go('money')">
          <div class="cat-icon">💰</div>
          <div class="cat-name">Грошові кошти</div>
          <div class="cat-count">${fmt(s.money)}</div>
          <div class="cat-sub">банківські рахунки</div>
        </div>
        <div class="cat-card" style="--cat-color:#06b6d4;--cat-bg:rgba(6,182,212,.1)" onclick="APP.go('movable')">
          <div class="cat-icon">📦</div>
          <div class="cat-name">Інше рухоме</div>
          <div class="cat-count">${fmt(s.movable)}</div>
          <div class="cat-sub">товари, обладнання</div>
        </div>
        <div class="cat-card" style="--cat-color:#ec4899;--cat-bg:rgba(236,72,153,.1)" onclick="APP.go('other')">
          <div class="cat-icon">🗂</div>
          <div class="cat-name">Інше майно</div>
          <div class="cat-count">${fmt(s.other)}</div>
          <div class="cat-sub">майнові права, ІВ</div>
        </div>
        <div class="cat-card" style="--cat-color:#1a56db;--cat-bg:rgba(26,86,219,.1)" onclick="APP.go('realestate',{cmplx:'simple'})">
          <div class="cat-icon">📋</div>
          <div class="cat-name">Прості активи</div>
          <div class="cat-count">${fmt(s.simple)}</div>
          <div class="cat-sub">з ${fmt(s.complex)} складних</div>
        </div>
      </div>

      <div class="section-h">Аналітика</div>
      <div class="charts-row">
        <div class="chart-card">
          <h3>Стан арешту (всі активи)</h3>
          ${Object.entries(s.by_arrest||{}).map(([k,v]) => `
            <div class="bar-item">
              <div class="bar-lbl"><span class="bar-name">${k.trim().slice(0,38)}</span><span class="bar-val">${fmt(v)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${(v/Math.max(...Object.values(s.by_arrest))*100).toFixed(1)}%;background:${arrColors[k]||'#1a56db'}"></div></div>
            </div>`).join('')}
        </div>
        <div class="chart-card">
          <h3>Типи активів</h3>
          ${[
            ['🏢 Нерухомість', s.realestate, '#f97316'],
            ['🚗 Транспорт', s.transport, '#3b82f6'],
            ['🌾 Земельні ділянки', s.land, '#10b981'],
            ['📊 Корп. права', s.corp, '#8b5cf6'],
            ['📦 Інше рухоме', s.movable, '#f59e0b'],
            ['💰 Грошові кошти', s.money, '#06b6d4'],
            ['🗂 Інше майно', s.other, '#ec4899'],
          ].map(([n,v,c]) => {
            const max = s.total;
            return `<div class="bar-item">
              <div class="bar-lbl"><span class="bar-name">${n}</span><span class="bar-val">${fmt(v)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="width:${(v/max*100).toFixed(1)}%;background:${c}"></div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ===== NAVIGATION =====
const APP = {
  go(pageId, filterOverride) {
    STATE.page = pageId;
    if (filterOverride) {
      if (pageId === 'realestate') Object.assign(STATE.re, filterOverride);
      else if (pageId === 'land') Object.assign(STATE.land, filterOverride);
    }

    // Pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    if (pageId === 'home') {
      document.getElementById('page-home').classList.add('active');
    } else if (pageId === 'realestate') {
      document.getElementById('page-realestate').classList.add('active');
      loadJSON('realestate.json').then(() => {
        setTimeout(() => { REMAP.init(); REMAP.render(); }, 50);
      });
    } else if (pageId === 'land') {
      document.getElementById('page-land').classList.add('active');
      loadJSON('land.json').then(() => {
        setTimeout(() => { LANDMAP.init(); LANDMAP.render(); }, 50);
      });
    } else {
      STATE.cards.key = pageId;
      document.getElementById('page-cards').classList.add('active');
      loadJSON(pageId+'.json').then(() => {
        CARDS.render();
      });
    }

    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.page === pageId);
    });
  },

  onSearch(val) {
    STATE.search = val.toLowerCase();
    // Debounce
    clearTimeout(APP._st);
    APP._st = setTimeout(() => {
      if (STATE.page==='realestate') { STATE.re.page=0; REMAP.render(); }
      else if (STATE.page==='land') { STATE.land.page=0; LANDMAP.render(); }
      else if (['transport','corp','money','movable','other'].includes(STATE.page)) { STATE.cards.page=0; CARDS.render(); }
    }, 250);
  },

  async init() {
    // Load stats
    const prog = document.getElementById('ldr-fill');
    const msg = document.getElementById('ldr-msg');

    try {
      prog.style.width = '20%';
      msg.textContent = 'Завантаження статистики...';
      STATS = await loadJSON('stats.json');

      prog.style.width = '50%';
      msg.textContent = 'Завантаження нерухомості...';
      await loadJSON('realestate.json');

      prog.style.width = '75%';
      msg.textContent = 'Завантаження земельних ділянок...';
      await loadJSON('land.json');

      prog.style.width = '95%';
      msg.textContent = 'Готово!';

      // Apply cached geocodes
      const reData = CACHE['realestate.json'] || [];
      reData.forEach(r => {
        const key = [r.oblast, r.city, r.street, r.house].filter(Boolean).join('|');
        if (geoCache[key]) { r._geo_lat=geoCache[key].lat; r._geo_lng=geoCache[key].lng; }
      });

      // Add stats
      if (!STATS.by_arrest) {
        STATS.by_arrest = {
          'Арештовано': STATS.arrested,
          'Конфісковано / Стягнення': STATS.confiscated,
          'Націоналізовано': STATS.national,
          'Скасовано': STATS.cancelled,
          'Не арештовано': STATS.not_arrested,
        };
      }

    } catch(e) {
      msg.textContent = 'Помилка завантаження даних!';
      console.error(e);
      return;
    }

    // Build nav
    const tabsEl = document.getElementById('nav-tabs');
    tabsEl.innerHTML = TABS_CONFIG.map(t => `
      <button class="nav-tab ${t.id==='home'?'active':''}" data-page="${t.id}" onclick="APP.go('${t.id}')">
        ${t.label}
        ${t.cnt ? `<span class="nav-cnt">${fmt(STATS[t.cnt]||0)}</span>` : `<span class="nav-cnt">${fmt(STATS.total||0)}</span>`}
      </button>`).join('');

    // Show UI
    prog.style.width = '100%';
    setTimeout(() => {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('topnav').style.display = 'flex';
      document.getElementById('page-home').classList.add('active');
      renderHome();
    }, 300);
  }
};

// Pulse animation in CSS (via style tag injection)
const styleEl = document.createElement('style');
styleEl.textContent = `
@keyframes markerPulse {
  0% { transform:scale(1); opacity:.6; }
  100% { transform:scale(3.5); opacity:0; }
}`;
document.head.appendChild(styleEl);

// START
document.addEventListener('DOMContentLoaded', () => APP.init());
