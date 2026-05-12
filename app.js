/* ============================================================
   ARMA app.js v5.0
   FIXES:
   1. arrType() bug fixed (Не арештовано was 'a', now 'z')
   2. New "Всі арештовані" cross-category search page
   3. New "Справи" page - group all assets by ID_Групи
   4. Land plots enriched with lands_ok.txt addresses
   ============================================================ */
'use strict';

const TABS = [
  {id:'home',       label:'🏠 Огляд',        file:null},
  {id:'realestate', label:'🏢 Нерухомість',   file:'realestate.json',  cnt:'realestate'},
  {id:'land',       label:'🌾 Земля',          file:'land.json',        cnt:'land'},
  {id:'transport',  label:'🚗 Транспорт',      file:'transport.json',   cnt:'transport', cards:true},
  {id:'corp',       label:'📊 Корп. права',    file:'corp.json',        cnt:'corp',      cards:true},
  {id:'money',      label:'💰 Кошти',          file:'money.json',       cnt:'money',     cards:true},
  {id:'movable',    label:'📦 Рухоме',         file:'movable.json',     cnt:'movable',   cards:true},
  {id:'other',      label:'🗂 Інше',           file:'other.json',       cnt:'other',     cards:true},
  {id:'search',     label:'🔎 Пошук',          file:null},
  {id:'cases',      label:'📂 Справи',         file:null},
];


  // Зонування meanings — Жовта (перспективні) перша!
  const ZONE_MEANING = {
    'Жовта зона':  {label:'🟡 Жовта',  desc:'🎯 Перспективні для управління',  color:'#d97706', bg:'rgba(217,119,6,.1)',  code:'yellow'},
    'Синя зона':   {label:'🔵 Синя',   desc:'✅ Реалізовані / Вже передані',    color:'#1a56db', bg:'rgba(26,86,219,.1)',  code:'blue'},
    'Червона зона':{label:'🔴 Червона', desc:'❌ Не привабливі для управління', color:'#ef4444', bg:'rgba(239,68,68,.1)', code:'red'},
    'Сіра зона':   {label:'⚪ Сіра',   desc:'❓ Статус не визначено',           color:'#64748b', bg:'rgba(100,116,139,.1)',code:'grey'},
  };

const CAT_LABELS = {
  realestate:'Нерухомість', land:'Земельні ділянки',
  transport:'Транспорт', corp:'Корп. права',
  money:'Грошові кошти', movable:'Рухоме майно', other:'Інше майно'
};
const CAT_ICONS = {
  realestate:'🏢', land:'🌾', transport:'🚗', corp:'📊',
  money:'💰', movable:'📦', other:'🗂'
};
const DATA_CATS = ['realestate','land','transport','corp','money','movable','other'];

// ─── STATE ───────────────────────────────────────────────────
const ST = {
  page:'home', search:'', groupFilter:'',
  re:    {arr:'all', cmplx:'all', mgr:'all', zone:'all', oblast:'', pg:0, ps:60},
  land:  {arr:'all', mgr:'all', zone:'all', oblast:'', pg:0, ps:60},
  cards: {arr:'all', cmplx:'all', mgr:'all', zone:'all', pg:0, ps:80, key:null},
  search_q:'', search_arr:'all', search_pg:0, search_ps:50,
  cases_q:'', cases_pg:0, cases_ps:30,
  expandedId: null,
};
const CACHE = {};
let STATS = {};

// ─── UTILS ───────────────────────────────────────────────────
const fmt = n => Number(n||0).toLocaleString('uk-UA');
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// FIX 1: arrType — check негацію BEFORE арешт
function arrType(s){
  if(!s) return 'u';
  const sl = s.toLowerCase();
  if(sl.includes('конфіскац') || sl.includes('стягнення')) return 'c';
  if(sl.includes('спец') && sl.includes('конф')) return 'c';
  if(sl.includes('нац')) return 'n';
  if(sl.includes('не арешт')) return 'z';   // MUST be before 'арешт'!
  if(sl.includes('арешт')) return 'a';
  if(sl.includes('скасування')) return 'x';
  return 'u';
}
const ARR_LBL = {a:'Арешт',c:'Конфіск.',n:'Націонал.',x:'Скасовано',z:'Не арешт.',u:'—'};
const ARR_CLR = {a:'#f97316',c:'#10b981',n:'#8b5cf6',x:'#ef4444',z:'#6b7280',u:'#9ca3af'};
const ARR_BC  = {a:'badge-arrested',c:'badge-confiscated',n:'badge-national',x:'badge-cancelled',z:'badge-notarr',u:'badge-notarr'};

function flt(data, f, grpF){
  const q = ST.search.toLowerCase();
  return data.filter(r=>{
    if(f.arr   !== 'all' && arrType(r.arr) !== f.arr) return false;
    if(f.cmplx === 'simple'  && r.complex !== 'simple')  return false;
    if(f.cmplx === 'complex' && r.complex !== 'complex') return false;
    if(f.mgr   === 'yes' && !r.has_manager) return false;
    if(f.mgr   === 'no'  &&  r.has_manager) return false;
    if(f.zone && f.zone !== 'all' && f.zone !== '' && (r.zone||'') !== f.zone) return false;
    if(f.oblast && (r.oblast||'') !== f.oblast) return false;
    if(grpF && (r.group||'') !== grpF) return false;
    if(q){
      const hay=[r.id,r.addr,r.city,r.oblast,r.own,r.desc,r.kadastr,r.manager,r.type,r.group].filter(Boolean).join(' ').toLowerCase();
      const courtHay=(r.court_cases||[]).join(' ').toLowerCase();
      if(!hay.includes(q) && !courtHay.includes(q)) return false;
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
      const v=b.dataset.v;
      if(v==='arrested')   b.classList.add('orange');
      if(v==='confiscated'||v==='yes') b.classList.add('green');
      if(v==='national'||v==='complex') b.classList.add('purple');
      if(v==='cancelled')  b.classList.add('red');
    }
  });
}

// ─── LOAD ALL CATEGORIES ─────────────────────────────────────
async function loadAll(){
  const tasks = DATA_CATS.map(k => loadJSON(k+'.json').catch(()=>[]));
  await Promise.all(tasks);
}

function allRecords(){
  return DATA_CATS.flatMap(k => (CACHE[k+'.json']||[]).map(r=>({...r,_cat:k})));
}

// ─── PDF EXPORT ──────────────────────────────────────────────
function downloadPDF(recordId, catKey){
  let r = null;
  if(catKey){ r = (CACHE[catKey+'.json']||[]).find(x=>x.id===recordId); }
  if(!r){ for(const k of DATA_CATS){ r=(CACHE[k+'.json']||[]).find(x=>x.id===recordId); if(r){catKey=k;break;} } }
  if(!r){ _toast('Запис не знайдено','err'); return; }

  const val = r.value ? `${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}` : '—';
  const dt  = new Date().toLocaleDateString('uk-UA');
  const html=`<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>АРМА · ${esc(r.id)}</title>
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
.desc{padding:8px 10px;font-size:11.5px;color:#374151;line-height:1.6;white-space:pre-wrap}
.foot{margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body>
<h1>📋 Картка активу АРМА</h1>
<div class="meta">ID: <b>${esc(r.id)}</b>${r.group&&r.group!=='Груповано'?` · Справа №<b>${esc(r.group)}</b>`:''} · ${esc(CAT_LABELS[catKey]||catKey)} · ${dt}</div>
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
${r.area?`<div class="row"><span class="lbl">Площа</span><span class="val">${esc(r.area)}</span></div>`:''}
${r.purpose?`<div class="row"><span class="lbl">Цільове призначення</span><span class="val">${esc(r.purpose)}</span></div>`:''}
<div class="row"><span class="lbl">Координати</span><span class="val" style="font-family:monospace">${r.lat}, ${r.lng} (${r.geo_quality==='city'?'місто':r.geo_quality==='oblast'?'область':'приблизно'})</span></div>
</div>
<div class="sec"><h2>🏷 Класифікація</h2>
${r.type?`<div class="row"><span class="lbl">Вид активу</span><span class="val">${esc(r.type)}</span></div>`:''}
${r.land_cat?`<div class="row"><span class="lbl">Категорія земель</span><span class="val">${esc(r.land_cat)}</span></div>`:''}
${r.dept?`<div class="row"><span class="lbl">Відділ МА</span><span class="val">${esc(r.dept)}</span></div>`:''}
${r.mtu?`<div class="row"><span class="lbl">МТУ</span><span class="val">${esc(r.mtu)}</span></div>`:''}
${r.date?`<div class="row"><span class="lbl">Дата реєстрації</span><span class="val">${esc(r.date)}</span></div>`:''}
${r.right_type?`<div class="row"><span class="lbl">Вид права</span><span class="val">${esc(r.right_type)}</span></div>`:''}
${r.right_subj?`<div class="row"><span class="lbl">Суб'єкт права</span><span class="val">${esc(r.right_subj)}</span></div>`:''}
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
${r.desc?`<div class="sec"><h2>📝 Повний опис</h2><div class="desc" style="white-space:pre-wrap;word-wrap:break-word">${esc(r.desc)}</div></div>`:''}
${r.court?`<div class="sec"><h2>⚖ Судові рішення</h2><div class="desc">${esc(r.court)}</div></div>`:''}
<div class="foot">Документ сформовано автоматично · АРМА України · ${dt}</div>
</body></html>`;

  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`ARMA_${r.id.replace(/\//g,'_')}.html`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
}

// ─── DETAIL PANEL BUILDER ────────────────────────────────────
function buildDP(r, type){
  const osmUrl=`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}&zoom=17`;
  const gmUrl=`https://www.google.com/maps/place/${r.lat},${r.lng}/@${r.lat},${r.lng},17z`;
  const val=r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'—';
  const lv=r.geo_quality||'fallback';
  const geoCls=lv==='city'?'badge-geo-city':lv==='oblast'||lv==='fallback'?'badge-geo-oblast':'badge-geo-exact';
  const geoLbl=lv==='city'?'📍 Місто':lv==='city_fuzzy'?'📍 ~Місто':lv==='oblast'?'📍 Область':'📍 Приблизно';
  const grpBtn=r.group&&r.group!=='Груповано'?`<button class="dp-btn" onclick="APP.go('cases');CASESP2?.openCase('${esc(r.group)}')">📂 Справа №${esc(r.group)}</button>`:'';

  return `
<div class="dp-top">
  <button class="dp-close" onclick="closeDP('${type}')">✕</button>
  <div class="dp-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · <span style="font-size:9px;color:var(--muted);font-weight:500">Пакет АРМА №${esc(r.group)}</span>`:''}</div>
  <div class="dp-title">${esc((r.desc||r.type||'').slice(0,180))}${(r.desc||'').length>180?'…':''}</div>
  <div class="dp-badges">
    <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]||'—'}</span>
    ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
    ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
    ${r.has_manager?'<span class="badge badge-managed">🛡 Упр-ль</span>':''}
    <span class="badge ${geoCls}">${geoLbl}</span>
  </div>
</div>
<div class="dp-actions">
  <button class="dp-btn primary" onclick="focusMarker('${esc(r.id)}','${type}')">🎯 На карті</button>
  <a class="dp-btn" href="${osmUrl}" target="_blank">🌐 OSM</a>
  <a class="dp-btn" href="${gmUrl}" target="_blank">🗺 Google</a>
  ${r.kadastr?`<a class="dp-btn kad" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(r.kadastr)}" target="_blank">📋 Кадастр</a>`:''}
  ${grpBtn}
  <button class="dp-btn pdf-btn" onclick="downloadPDF('${esc(r.id)}','${type==='re'?'realestate':type==='land'?'land':type}')">📄 PDF</button>
</div>
<div class="dp-sec">
  <h4>📍 Адреса</h4>
  ${r.addr?`<div class="dp-row"><span class="dp-l">Адреса</span><span class="dp-v bold">${esc(r.addr)}</span></div>`:''}
  ${r.city?`<div class="dp-row"><span class="dp-l">Місто/НП</span><span class="dp-v">${esc(r.city)}</span></div>`:''}
  ${r.district?`<div class="dp-row"><span class="dp-l">Район</span><span class="dp-v">${esc(r.district)}</span></div>`:''}
  ${r.oblast?`<div class="dp-row"><span class="dp-l">Область</span><span class="dp-v">${esc(r.oblast)}</span></div>`:''}
  ${r.kadastr?`<div class="dp-row"><span class="dp-l">Кадастр. №</span><span class="dp-v mono">${esc(r.kadastr)}</span></div>`:''}
  ${r.area?`<div class="dp-row"><span class="dp-l">Площа</span><span class="dp-v">${esc(r.area)}</span></div>`:''}
  ${r.purpose?`<div class="dp-row"><span class="dp-l">Призначення</span><span class="dp-v" style="font-size:10.5px">${esc(r.purpose)}</span></div>`:''}
  <div class="dp-row"><span class="dp-l">Координати</span>
    <span class="dp-v mono" style="font-size:10px">${r.lat}, ${r.lng}
      <span style="color:${lv==='city'||lv==='city_fuzzy'?'#f59e0b':'#ef4444'}"> ●${lv==='city'||lv==='city_fuzzy'?'місто':'область'}</span>
    </span>
  </div>
</div>
<div class="dp-sec">
  <h4>🏷 Класифікація</h4>
  ${r.type?`<div class="dp-row"><span class="dp-l">Вид</span><span class="dp-v">${esc(r.type)}</span></div>`:''}
  ${r.land_cat?`<div class="dp-row"><span class="dp-l">Категорія</span><span class="dp-v" style="font-size:11px">${esc(r.land_cat)}</span></div>`:''}
  <div class="dp-row"><span class="dp-l">Складність</span><span class="dp-v">${r.complex==='complex'?'Складний':r.complex==='simple'?'Простий':'—'}</span></div>
  ${r.zone?`<div class="dp-row"><span class="dp-l">Зонування</span><span class="dp-v"><span class="zone-pill zone-${ZONE_MEANING[r.zone]?.code||'grey'}">${ZONE_MEANING[r.zone]?.label||r.zone}</span><span style="font-size:10px;color:var(--mid);margin-left:6px">${ZONE_MEANING[r.zone]?.desc||''}</span></span></div>`:''}
  ${r.dept?`<div class="dp-row"><span class="dp-l">Відділ</span><span class="dp-v">${esc(r.dept)}</span></div>`:''}
  ${r.mtu?`<div class="dp-row"><span class="dp-l">МТУ</span><span class="dp-v">${esc(r.mtu)}</span></div>`:''}
  ${r.inv_status?`<div class="dp-row"><span class="dp-l">Статус інв.</span><span class="dp-v" style="font-size:11px">${esc(r.inv_status)}</span></div>`:''}
  ${r.date?`<div class="dp-row"><span class="dp-l">Дата</span><span class="dp-v">${esc(r.date)}</span></div>`:''}
  ${r.right_type?`<div class="dp-row"><span class="dp-l">Вид права</span><span class="dp-v">${esc(r.right_type)}</span></div>`:''}
  ${r.right_subj?`<div class="dp-row"><span class="dp-l">Суб'єкт права</span><span class="dp-v" style="font-size:11px">${esc(r.right_subj)}</span></div>`:''}
</div>
${r.own||r.manager?`<div class="dp-sec"><h4>👤 Власник / Управитель</h4>
  ${r.own?`<div class="dp-row"><span class="dp-l">Власник</span><span class="dp-v">${esc(r.own)}</span></div>`:''}
  ${r.manager?`<div class="dp-row"><span class="dp-l">Управитель</span><span class="dp-v">${esc(r.manager)}</span></div>`:''}
  ${r.contract?`<div class="dp-row"><span class="dp-l">Договір</span><span class="dp-v">${esc(r.contract)}</span></div>`:''}
</div>`:''}
<div class="dp-sec">
  <h4>💵 Фінанси / Стан</h4>
  <div class="dp-row"><span class="dp-l">Вартість</span><span class="dp-v bold">${val}</span></div>
  ${r.usage?`<div class="dp-row"><span class="dp-l">Використання</span><span class="dp-v">${esc(r.usage)}</span></div>`:''}
  ${r.condition?`<div class="dp-row"><span class="dp-l">Фіз. стан</span><span class="dp-v">${esc(r.condition)}</span></div>`:''}
  ${r.notes?`<div class="dp-row"><span class="dp-l">Примітки</span><span class="dp-v">${esc(r.notes)}</span></div>`:''}
</div>
${r.court?`<div class="dp-sec"><h4>⚖ Судові рішення</h4><p class="dp-desc">${esc(r.court)}</p></div>`:''}
<div class="dp-sec" style="border:none"><h4>📝 Опис</h4><p class="dp-desc">${esc(r.desc||'—')}</p></div>
${r.notes?`<div class="dp-sec" style="background:rgba(217,119,6,.05);border-color:rgba(217,119,6,.2)">
  <h4>📌 Пропозиції / Стан активу</h4>
  <p class="dp-desc">${esc(r.notes)}</p>
</div>`:''}
${(r.court_cases&&r.court_cases.length)||(r.primary_verdict)?`<div class="dp-sec" style="background:rgba(26,86,219,.04);border-color:rgba(26,86,219,.15)">
  <h4>⚖ Юридичний контекст</h4>
  ${r.primary_verdict?`<div class="dp-row"><span class="dp-l">Вердикт</span>
    <span class="dp-v bold" style="color:#1a56db">${esc(r.primary_verdict)}</span></div>`:''}
  ${r.court_cases&&r.court_cases.length?`<div class="dp-row"><span class="dp-l">Справи (${r.court_cases.length})</span>
    <span class="dp-v">
      ${r.court_cases.length===1
        ? `<span class="court-case-pill" onclick="APP.go('cases').then(()=>{if(typeof CASESP2!=='undefined')CASESP2.openCase('${r.court_cases[0].replace(/'/g,"\'")}')})">${esc(r.court_cases[0])}</span>`
        : `<select class="oblast-select" style="margin-top:4px;font-family:'DM Mono',monospace;font-size:11px"
            onchange="if(this.value)APP.go('cases').then(()=>{if(typeof CASESP2!=='undefined')CASESP2.openCase(this.value);this.value=''})">
            <option value="">— Оберіть справу (${r.court_cases.length}) —</option>
            ${(r.court_cases||[]).map(c=>`<option value="${c.replace(/"/g,'&quot;')}">${c}</option>`).join('')}
          </select>`
      }
    </span></div>`:''}
  ${r.verdicts&&r.verdicts.length>1?`<div class="dp-row"><span class="dp-l">Дії в справі</span>
    <span class="dp-v" style="font-size:10.5px">${r.verdicts.join(' · ')}</span></div>`:''}
</div>`:''}`;
}
function closeDP(t){ document.getElementById(t==='land'?'land-detail':'re-detail').classList.remove('show'); }

// ─── MAP MODULES (RE + LAND) ──────────────────────────────────
function makeMapModule(mapId, cacheKey, listId, cntId, pgnId, sidebarId, detailId, type){
  let map=null, cluster=null, mById={}, hlM=null, kadLyr=null, selId=null;

  function initMap(){
    if(map){map.invalidateSize();return;}
    map=L.map(mapId,{center:[49,31.5],zoom:6,zoomControl:true,preferCanvas:true});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {attribution:'© OSM © CARTO',maxZoom:19,subdomains:'abcd'}).addTo(map);
    cluster=L.markerClusterGroup({chunkedLoading:true,maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false});
    map.addLayer(cluster);
    if(type==='land'){ kadLyr=L.layerGroup().addTo(map); }
  }

  function mkIcon(r, sel=false){
    const c=ARR_CLR[arrType(r.arr)]||'#9ca3af';
    const hk=type==='land'&&!!r.kadastr;
    const sz=sel?28:(hk?14:13);
    return L.divIcon({
      className:'',
      html:sel
        ?`<div style="position:relative;width:${sz}px;height:${sz}px">
            <div style="position:absolute;inset:0;border-radius:50%;background:${c};opacity:.2;animation:mPulse 1.4s ease-out infinite"></div>
            <div style="position:absolute;inset:5px;border-radius:${hk?'3px':'50%'};background:${c};border:3px solid #fff;box-shadow:0 0 0 3px ${c}44,0 4px 18px rgba(0,0,0,.4)"></div>
           </div>`
        :`<div style="position:relative;display:inline-block">
            <div style="width:${sz}px;height:${sz}px;border-radius:${hk?'3px':'50%'};background:${c};border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 5px rgba(0,0,0,.25)"></div>
            ${hk?`<div style="position:absolute;bottom:-2px;right:-2px;width:5px;height:5px;border-radius:50%;background:#06b6d4;border:1px solid #fff"></div>`:''}
           </div>`,
      iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]
    });
  }

  function f(){
    const isRe = type==='re';
    return isRe ? ST.re : ST.land;
  }

  function renderMarkers(filtered){
    cluster.clearLayers(); mById={};
    const mapVisible = filtered.filter(r=>r.lat && r.geo_quality!=='approximate');
    const mkrs=mapVisible.map(r=>{
      const m=L.marker([r.lat,r.lng],{icon:mkIcon(r)});
      m._assetId=r.id;
      m.on('click',()=>select(r.id,false));
      // Build smart popup: for land show kadastr+area prominently
      const isLand = type==='land';
      const popupAddr = r.addr||r.city||r.oblast||'—';
      const popupTitle = isLand 
        ? (r.kadastr ? `📋 ${r.kadastr}` : r.type||'Земельна ділянка')
        : (r.desc||r.type||'').slice(0,80);
      const geoLabel = r.geo_quality==='exact'?'📍 Точно':r.geo_quality==='geocoded'?'📍 Вулиця':
                       r.geo_quality==='city'?'📍 Місто':'📍 Приблизно';
      const legalBadge = r.primary_verdict?`<div style="font-size:9.5px;color:#1a56db;margin-top:4px">⚖ ${esc(r.primary_verdict)}</div>`:'';
      m.bindPopup(`
        <div class="lp-id">${esc(r.id)}</div>
        <div class="lp-title">${esc(popupTitle)}${!isLand&&(r.desc||'').length>80?'…':''}</div>
        ${isLand&&r.area?`<div style="font-size:10.5px;color:#0e7490;font-weight:600;margin:3px 0">📐 ${esc(r.area)}</div>`:''}
        <div class="lp-addr">📍 ${esc(popupAddr)}</div>
        ${!isLand&&r.kadastr?`<div style="font-family:monospace;font-size:9.5px;color:#0e7490;margin:3px 0">📋 ${esc(r.kadastr)}</div>`:''}
        ${isLand&&r.purpose?`<div style="font-size:9.5px;color:var(--mid);margin:2px 0">${esc(r.purpose.slice(0,60))}</div>`:''}
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">
          <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          ${r.zone?`<span class="zone-pill zone-${r.zone.includes('Жовт')?'yellow':r.zone.includes('Черв')?'red':r.zone.includes('Синя')?'blue':'grey'}" style="font-size:9px">${r.zone.replace(' зона','')}</span>`:''}
        </div>
        ${legalBadge}
        <div style="margin-top:7px;font-size:9px;color:var(--muted)">${geoLabel}</div>
        <br><span class="lp-link" onclick="${type==='re'?'REMAP':'LANDMAP'}.select('${r.id}',false)">→ Відкрити картку</span>
      `,{maxWidth:340,className:'arma-popup'});
      mById[r.id]=m;
      return m;
    });
    if(mkrs.length) cluster.addLayers(mkrs);
  }

  function renderList(filtered){
    const ff=f(); const {pg,ps}=ff;
    const total=filtered.length, pages=Math.ceil(total/ps)||1;
    const items=filtered.slice(pg*ps,pg*ps+ps);
    document.getElementById(cntId).textContent=fmt(total);

    let lastObl=null, html='';
    items.forEach(r=>{
      const obl=r.oblast||'Інше';
      if(obl!==lastObl){html+=`<div class="sb-oblast-header">${esc(obl)}</div>`;lastObl=obl;}
      html+=`<div class="asset-item ${r.id===selId?'selected':''}" data-id="${esc(r.id)}" onclick="${type==='re'?'REMAP':'LANDMAP'}.select('${esc(r.id)}',true)">
        <div class="ai-id">
          <span>${esc(r.id)}</span>
          ${r.group&&r.group!=='Груповано'?`<span class="ai-group" title="Внутрішній пакет АРМА №${esc(r.group)}">Пак.${esc(r.group)}</span>`:''}
          ${type==='land'&&r.kadastr?`<span class="ai-kad">${r.kadastr.slice(-8)}</span>`:''}
        </div>
        <div class="ai-title">${esc((r.desc||r.type||'').slice(0,100))}${(r.desc||'').length>100?'…':''}</div>
        <div class="ai-addr">📍 ${esc(r.addr||r.city||r.oblast||'—')}</div>
        ${type==='land'&&r.area?`<div style="font-size:9.5px;color:var(--teal);margin-bottom:2px">📐 ${esc(r.area)}</div>`:''}
        <div class="ai-badges">
          <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
          ${r.complex==='simple'?'<span class="badge badge-simple">Простий</span>':''}
          ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
          ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
          ${type==='land'&&r.kadastr?'<span class="badge-kad">📋</span>':''}
        </div>
      </div>`;
    });
    if(!items.length) html='<div class="no-results">Нічого не знайдено</div>';
    document.getElementById(listId).innerHTML=html;

    const pgn=document.getElementById(pgnId);
    if(total>ps){
      pgn.style.display='flex';
      pgn.innerHTML=`<button class="pgn-btn" ${pg===0?'disabled':''} onclick="${type==='re'?'REMAP':'LANDMAP'}.pgChange(-1)">‹</button>
        <span style="font-size:11px;padding:0 8px">${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="${type==='re'?'REMAP':'LANDMAP'}.pgChange(1)">›</button>`;
    } else pgn.style.display='none';
  }

  function render(){
    const ff=f();
    const data=CACHE[cacheKey]||[];
    const filtered=flt(data,ff,ST.groupFilter);
    _populateOblastDropdown(data, ff.oblast||'');
    renderList(filtered); renderMarkers(filtered);
    updFbtns(document.getElementById(sidebarId),ff);
  }
  
  function _populateOblastDropdown(data, selectedOblast){
    const selId = type==='re' ? 're-oblast-filter' : 'land-oblast-filter';
    const sel = document.getElementById(selId);
    if(!sel) return;
    const oblasts = [...new Set(data.map(r=>r.oblast).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">— Всі області —</option>' +
      oblasts.map(o=>`<option value="${o.replace(/"/g,'&quot;')}"${o===selectedOblast?' selected':''}>${o}</option>`).join('');
  }

  async function loadKad(kad,lat,lng){
    if(!kadLyr) return;
    kadLyr.clearLayers();
    const apis=[
      `https://kadastr.live/api/parcel?cadnum=${encodeURIComponent(kad)}`,
      `https://map.land.gov.ua/gis/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=kadastr:cadnum&outputFormat=application/json&CQL_FILTER=cadnum='${kad}'`,
    ];
    for(const url of apis){
      try{
        const res=await fetch(url,{signal:AbortSignal.timeout(6000)});
        if(!res.ok) continue;
        const d=await res.json();
        let gj=d.type==='Feature'||d.type==='FeatureCollection'?d:d.geometry?{type:'Feature',geometry:d.geometry}:null;
        if(!gj&&d.features&&d.features.length) gj=d;
        if(!gj) continue;
        const lyr=L.geoJSON(gj,{style:{color:'#0891b2',weight:2.5,fillColor:'#06b6d4',fillOpacity:.18}});
        lyr.addTo(kadLyr);
        try{map.fitBounds(lyr.getBounds(),{padding:[40,40],maxZoom:17});}catch(e){}
        L.marker(lyr.getBounds().getCenter(),{
          icon:L.divIcon({className:'',html:`<div style="background:rgba(8,145,178,.9);color:#fff;padding:2px 7px;border-radius:5px;font-size:9.5px;font-weight:700;white-space:nowrap;font-family:monospace;box-shadow:0 2px 8px rgba(0,0,0,.25)">${esc(kad)}</div>`,iconAnchor:[60,10]}),
          interactive:false}).addTo(kadLyr);
        return;
      }catch(e){continue;}
    }
    map.flyTo([lat,lng],13,{duration:.6});
  }

  function select(id, fromList){
    const data=CACHE[cacheKey]||[];
    const r=data.find(x=>x.id===id); if(!r) return;
    selId=id;
    document.querySelectorAll(`#${listId} .asset-item`).forEach(el=>{
      el.classList.toggle('selected',el.dataset.id===id);
      if(el.dataset.id===id&&!fromList) el.scrollIntoView({block:'nearest',behavior:'smooth'});
    });
    if(hlM){try{map.removeLayer(hlM);}catch(e){} hlM=null;}
    const _lat = r._lat||r.lat;
    const _lng = r._lng||r.lng;
    // If we have coords - fly to them; otherwise just show the detail panel
    if(_lat && _lng) {
      const _zoom = r.geo_quality==='exact'?17:r.geo_quality==='geocoded'?16:
                    r.geo_quality==='city'?14:r.geo_quality==='district'?13:11;
      map.flyTo([_lat,_lng], _zoom, {duration:.8, easeLinearity:.5});
    }
    hlM=L.marker([r.lat,r.lng],{icon:mkIcon(r,true),zIndexOffset:2000}).addTo(map).bindPopup(`
      <div class="lp-id">${esc(r.id)}</div>
      <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
      <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
    `,{maxWidth:280}).openPopup();

    if(type==='land'&&r.kadastr) loadKad(r.kadastr,r.lat,r.lng);

    // Build detail with extra land section
    let extra='';
    if(type==='land'&&r.kadastr){
      extra=`<div class="dp-sec" style="background:rgba(6,182,212,.05);border-color:rgba(6,182,212,.2)">
        <h4>🗺 Кадастрова ділянка</h4>
        <div class="dp-row"><span class="dp-l">Кадастр. №</span><span class="dp-v mono">${esc(r.kadastr)}</span></div>
        ${r.area?`<div class="dp-row"><span class="dp-l">Площа</span><span class="dp-v">${esc(r.area)}</span></div>`:''}
        ${r.purpose?`<div class="dp-row"><span class="dp-l">Призначення</span><span class="dp-v" style="font-size:10.5px">${esc(r.purpose)}</span></div>`:''}
        ${r.land_cat?`<div class="dp-row"><span class="dp-l">Категорія</span><span class="dp-v" style="font-size:10.5px">${esc(r.land_cat)}</span></div>`:''}
        ${r.right_type?`<div class="dp-row"><span class="dp-l">Вид права</span><span class="dp-v">${esc(r.right_type)}</span></div>`:''}
        ${r.right_subj?`<div class="dp-row"><span class="dp-l">Суб'єкт</span><span class="dp-v" style="font-size:10.5px">${esc(r.right_subj)}</span></div>`:''}
        <div class="dp-actions" style="padding:8px 0 0">
          <a class="dp-btn kad" href="https://kadastrova-karta.com/dilyanka/${encodeURIComponent(r.kadastr)}" target="_blank">🌐 kadastrova-karta.com</a>
          <a class="dp-btn" href="https://map.land.gov.ua/kadastrova-karta?cadnum=${r.kadastr}" target="_blank">🏛 ПКК</a>
        </div>
        <div style="margin-top:8px;font-size:10px;color:var(--mid)">Контур ділянки завантажується автоматично</div>
      </div>`;
    }

    const dp=document.getElementById(detailId);
    dp.innerHTML=buildDP(r,type)+extra;
    dp.classList.add('show'); dp.scrollTop=0;
  }

  function focusMk(id){
    const r=(CACHE[cacheKey]||[]).find(x=>x.id===id);
    if(!r) return;
    const lat = r._lat||r.lat, lng = r._lng||r.lng;
    if(!lat) { alert('Точні координати відсутні для цього об\'єкта'); return; }
    const zoom = r.geo_quality==='exact'?17:r.geo_quality==='geocoded'?16:
                 r.geo_quality==='city'?15:r.geo_quality==='district'?13:11;
    map.flyTo([lat,lng],zoom,{duration:.9,easeLinearity:.4});
    setTimeout(()=>{ if(hlM) hlM.openPopup(); },1000);
  }
  function pgChange(d){
    const ff=f(); ff.pg=Math.max(0,ff.pg+d);
    renderList(flt(CACHE[cacheKey]||[],ff,ST.groupFilter));
  }
  function filter(btn){ const ff=f(); ff[btn.dataset.f]=btn.dataset.v; ff.pg=0; render(); }

  return {init:initMap,render,select,focusMk,pgChange,filter,getMap:()=>map,
    filterOblast:(val)=>{ const ff=f(); ff.oblast=val; ff.pg=0; render(); }};
}

const REMAP   = makeMapModule('map',      'realestate.json','re-list',  're-cnt',  're-pgn',  're-sidebar',  're-detail',  're');
const LANDMAP = makeMapModule('map-land', 'land.json',      'land-list','land-cnt','land-pgn','land-sidebar','land-detail','land');

function focusMarker(id,type){
  if(type==='re') REMAP.focusMk(id);
  else if(type==='land') LANDMAP.focusMk(id);
}

// ─── CARDS ───────────────────────────────────────────────────
const CARDS=(()=>{
  function renderExpand(r){
    const val=r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'—';
    const loc=[r.city,r.oblast].filter(Boolean).join(', ')||'—';
    return `
      <div class="card-expand" id="ce-${esc(r.id)}">
        <div class="ce-head">
          <div>
            <div class="dp-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · <span style="font-size:9px;color:var(--muted);font-weight:500">Пакет АРМА №${esc(r.group)}</span>`:''}</div>
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
            ${loc!=='—'?`<div class="dp-row"><span class="dp-l">Місце</span><span class="dp-v">${esc(loc)}</span></div>`:''}
            ${r.own?`<div class="dp-row"><span class="dp-l">Власник</span><span class="dp-v">${esc(r.own.slice(0,120))}</span></div>`:''}
            ${r.manager?`<div class="dp-row"><span class="dp-l">Управитель</span><span class="dp-v">${esc(r.manager.slice(0,100))}</span></div>`:''}
            ${r.contract?`<div class="dp-row"><span class="dp-l">Договір</span><span class="dp-v">${esc(r.contract)}</span></div>`:''}
          </div>
          <div class="ce-sec">
            <h4>💵 Фінанси / Реквізити</h4>
            <div class="dp-row"><span class="dp-l">Вартість</span><span class="dp-v bold">${val}</span></div>
            ${r.zone?`<div class="dp-row"><span class="dp-l">Зонування</span><span class="dp-v"><span class="zone-pill zone-${ZONE_MEANING[r.zone]?.code||'grey'}">${ZONE_MEANING[r.zone]?.label||r.zone}</span><span style="font-size:10px;color:var(--mid);margin-left:6px">${ZONE_MEANING[r.zone]?.desc||''}</span></span></div>`:''}
            ${r.dept?`<div class="dp-row"><span class="dp-l">Відділ</span><span class="dp-v">${esc(r.dept)}</span></div>`:''}
            ${r.mtu?`<div class="dp-row"><span class="dp-l">МТУ</span><span class="dp-v">${esc(r.mtu)}</span></div>`:''}
            ${r.date?`<div class="dp-row"><span class="dp-l">Дата</span><span class="dp-v">${esc(r.date)}</span></div>`:''}
            ${r.inv_status?`<div class="dp-row"><span class="dp-l">Статус інв.</span><span class="dp-v">${esc(r.inv_status)}</span></div>`:''}
            ${r.usage?`<div class="dp-row"><span class="dp-l">Використання</span><span class="dp-v">${esc(r.usage)}</span></div>`:''}
            ${r.condition?`<div class="dp-row"><span class="dp-l">Фіз. стан</span><span class="dp-v">${esc(r.condition)}</span></div>`:''}
            ${r.notes?`<div class="dp-row"><span class="dp-l">Примітки</span><span class="dp-v">${esc(r.notes)}</span></div>`:''}
          </div>
          ${r.court?`<div class="ce-sec" style="grid-column:1/-1"><h4>⚖ Судові рішення</h4><p class="dp-desc">${esc(r.court)}</p></div>`:''}
          <div class="ce-sec" style="grid-column:1/-1"><h4>📝 Повний опис</h4><p class="dp-desc">${esc(r.desc||'—')}</p></div>
          ${r.notes?`<div class="ce-sec" style="grid-column:1/-1;background:rgba(217,119,6,.05)"><h4>📌 Пропозиції / Стан активу</h4><p class="dp-desc">${esc(r.notes)}</p></div>`:''}
          ${r.court_cases&&r.court_cases.length?`<div class="ce-sec" style="grid-column:1/-1"><h4>⚖ Номери судових справ</h4><div style="display:flex;gap:5px;flex-wrap:wrap">${(r.court_cases||[]).map(c=>`<span class="court-case-pill" onclick="APP.go('cases').then(()=>{if(typeof CASESP2!=='undefined')CASESP2.openCase('${c.replace(/'/g,\"\\'\")}')})" title="Відкрити справу ${c}">${esc(c)}</span>`).join('')}</div></div>`:''}
        </div>
        <div class="ce-actions">
          <button class="dp-btn pdf-btn" onclick="downloadPDF('${esc(r.id)}','${ST.cards.key}')">📄 PDF</button>
          ${r.group&&r.group!=='Груповано'?`<button class="dp-btn" onclick="APP.go('cases');CASESP2?.openCase('${esc(r.group)}')">📂 Справа №${esc(r.group)}</button>`:''}
          <span style="font-size:10.5px;color:var(--mid);margin-left:auto">ID: ${esc(r.id)}</span>
        </div>
      </div>`;
  }

  function render(){
    const k=ST.cards.key; if(!k) return;
    const data=CACHE[k+'.json']||[];
    const filtered=flt(data,ST.cards,ST.groupFilter);
    const {pg,ps}=ST.cards;
    const total=filtered.length,pages=Math.ceil(total/ps)||1;
    const items=filtered.slice(pg*ps,pg*ps+ps);

    document.getElementById('cards-title').innerHTML=`${CAT_LABELS[k]||k} <span class="sb-cnt">${fmt(total)}</span>`;
    document.getElementById('cards-stats').innerHTML=`<b>${fmt(total)}</b> за фільтром · Всього: ${fmt(data.length)} · Упр-ль: ${fmt(data.filter(r=>r.has_manager).length)}`;
    updFbtns(document.getElementById('cards-filters-wrap'),ST.cards);

    document.getElementById('cards-pgn-wrap').innerHTML=total>ps?`<div style="display:flex;gap:6px;padding:6px 0;align-items:center">
      <button class="pgn-btn" ${pg===0?'disabled':''} onclick="CARDS.pgChange(-1)">‹ Попер.</button>
      <span style="font-size:11px">${pg+1}/${pages}</span>
      <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="CARDS.pgChange(1)">Наст. ›</button>
    </div>`:'';

    document.getElementById('cards-grid').innerHTML=items.length?items.map(r=>{
      const val=r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'—';
      const loc=[r.city,r.oblast].filter(Boolean).join(', ')||'—';
      const isExp=ST.expandedId===r.id;
      return `
        <div class="card-item ${isExp?'selected':''}" onclick="CARDS.expand('${esc(r.id)}')">
          <button class="ci-pdf-btn" onclick="event.stopPropagation();downloadPDF('${esc(r.id)}','${k}')" title="PDF">📄</button>
          <div class="ci-id"><span>${esc(r.id)}</span>${r.group&&r.group!=='Груповано'?`<span class="ai-group" title="Внутрішній пакет АРМА №${esc(r.group)}">Пак.${esc(r.group)}</span>`:''}</div>
          <div class="ci-type">${esc((r.type||r.asset_type||'').slice(0,50))}</div>
          <div class="ci-title">${esc((r.desc||'—').slice(0,150))}${(r.desc||'').length>150?'…':''}</div>
          <div class="ci-meta">
            <div class="ci-row"><span class="lbl">📍</span><span class="val">${esc(loc)}</span></div>
            ${r.own?`<div class="ci-row"><span class="lbl">👤</span><span class="val">${esc(r.own.slice(0,60))}</span></div>`:''}
            ${r.manager?`<div class="ci-row"><span class="lbl">🛡</span><span class="val">${esc(r.manager.slice(0,55))}</span></div>`:''}
            <div class="ci-row"><span class="lbl">💵</span><span class="val">${val}</span></div>
            ${r.date?`<div class="ci-row"><span class="lbl">📅</span><span class="val">${esc(r.date)}</span></div>`:''}
            ${r.dept?`<div class="ci-row"><span class="lbl">🗂</span><span class="val">${esc(r.dept)}</span></div>`:''}
          </div>
          <div class="ci-badges">
            <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
            ${r.zone?`<span class="zone-pill zone-${ZONE_MEANING[r.zone]?.code||'grey'}" style="font-size:9px">${ZONE_MEANING[r.zone]?.label||r.zone}</span>`:''}
            ${r.complex==='complex'?'<span class="badge badge-complex">Складний</span>':''}
            ${r.has_manager?'<span class="badge badge-managed">Упр-ль</span>':''}
            <span style="font-size:10px;color:var(--mid);margin-left:auto">${isExp?'▲ Закрити':'▼ Деталі'}</span>
          </div>
        </div>
        ${isExp?renderExpand(r):''}`;
    }).join(''):'<div class="no-results">Нічого не знайдено</div>';
  }

  function expand(id){ST.expandedId=ST.expandedId===id?null:id;render();if(ST.expandedId){setTimeout(()=>{const el=document.getElementById('ce-'+id);if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});},50);}}
  function closeExpand(){ST.expandedId=null;render();}
  return {render,expand,closeExpand,
    filter:(btn)=>{ST.cards[btn.dataset.f]=btn.dataset.v;ST.cards.pg=0;render();},
    pgChange:(d)=>{ST.cards.pg=Math.max(0,ST.cards.pg+d);render();}};
})();

// ─── FIX 2: CROSS-CATEGORY SEARCH PAGE ───────────────────────
function renderSearchPage(){
  const q     = ST.search_q.toLowerCase().trim();
  const arrF  = ST.search_arr;
  const pg    = ST.search_pg;
  const ps    = ST.search_ps;

  const allData = allRecords();
  const filtered = allData.filter(r=>{
    if(!q && arrF==='all') return true;
    if(arrF!=='all' && arrType(r.arr)!==arrF) return false;
    if(q){
      const hay=[r.id,r.addr,r.city,r.oblast,r.own,r.desc,r.kadastr,r.manager,r.type,r.group].filter(Boolean).join(' ').toLowerCase();
      const courtHay=(r.court_cases||[]).join(' ').toLowerCase();
      if(!hay.includes(q) && !courtHay.includes(q)) return false;
    }
    return true;
  });

  const total=filtered.length,pages=Math.ceil(total/ps)||1;
  const items=filtered.slice(pg*ps,pg*ps+ps);

  // Count by category
  const catCounts={};
  filtered.forEach(r=>{catCounts[r._cat]=(catCounts[r._cat]||0)+1;});
  const catSummary=DATA_CATS.filter(k=>catCounts[k]).map(k=>`<span class="search-cat-pill" onclick="APP.go('${k}')">${CAT_ICONS[k]} ${CAT_LABELS[k]}: <b>${fmt(catCounts[k])}</b></span>`).join('');

  document.getElementById('search-content').innerHTML=`
    <div class="search-wrap-page">
      <div class="search-page-header">
        <h2>🔎 Пошук по всіх категоріях</h2>
        <p>Пошук у нерухомості, земельних ділянках, транспорті, корп. правах, коштах та рухомому майні</p>
      </div>
      <div class="search-controls">
        <div class="search-input-wrap">
          <span class="search-inp-icon">🔍</span>
          <input type="text" class="search-page-input" id="sp-input"
            placeholder="Пошук за адресою, ID, власником, кадастровим номером, описом..."
            value="${esc(ST.search_q)}" oninput="SEARCHP.onInput(this.value)">
          ${ST.search_q?`<button class="search-clear-btn" onclick="SEARCHP.clear()" title="Очистити">✕</button>`:''}
        </div>
        <div class="search-filters">
          ${[['all','Всі стани'],['a','Арешт'],['c','Конфіскація'],['n','Націоналізовано'],['x','Скасовано'],['z','Не арешт.']].map(([v,l])=>
            `<button class="fbtn ${ST.search_arr===v?'active':''}" onclick="SEARCHP.setArr('${v}')">${l}</button>`).join('')}
        </div>
      </div>
      ${filtered.length?`<div class="search-summary">Знайдено: <b>${fmt(total)}</b> активів · ${catSummary}</div>`:''}
      <div class="search-results">
        ${items.length?items.map(r=>{
          const loc=[r.addr||r.city,r.oblast].filter(Boolean).join(', ');
          const val=r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'';
          return `
            <div class="sr-item" onclick="APP.goToRecord('${esc(r.id)}','${r._cat}')">
              <div class="sr-cat-badge">${CAT_ICONS[r._cat]||'📋'} ${CAT_LABELS[r._cat]||r._cat}</div>
              <div class="sr-id">${esc(r.id)}${r.group&&r.group!=='Груповано'?` · <span class="sr-case" onclick="event.stopPropagation();APP.go('cases');CASESP2?.openCase('${esc(r.group)}')">Справа №${esc(r.group)}</span>`:''}</div>
              <div class="sr-title">${esc((r.desc||r.type||'—').slice(0,180))}</div>
              ${loc?`<div class="sr-addr">📍 ${esc(loc)}</div>`:''}
              ${r.kadastr?`<div class="sr-kadastr">📋 ${esc(r.kadastr)}</div>`:''}
              <div class="sr-bottom">
                <span class="badge ${ARR_BC[arrType(r.arr)]}">${ARR_LBL[arrType(r.arr)]}</span>
                ${r.has_manager?'<span class="badge badge-managed">🛡 Упр-ль</span>':''}
                ${val?`<span class="sr-val">${val}</span>`:''}
                <span class="sr-goto">→ Перейти</span>
              </div>
            </div>`;
        }).join(''):'<div class="no-results" style="padding:40px">'+(!q&&arrF==='all'?'Введіть запит для пошуку або оберіть фільтр стану арешту':'Нічого не знайдено')+'</div>'}
      </div>
      ${total>ps?`<div class="search-pgn">
        <button class="pgn-btn" ${pg===0?'disabled':''} onclick="SEARCHP.pgChange(-1)">← Попер.</button>
        <span>${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="SEARCHP.pgChange(1)">Наст. →</button>
      </div>`:''}
    </div>`;
}

const SEARCHP = {
  _tmr:null,
  onInput(v){ clearTimeout(this._tmr); this._tmr=setTimeout(()=>{ST.search_q=v;ST.search_pg=0;renderSearchPage();},250); },
  setArr(v){ ST.search_arr=v; ST.search_pg=0; renderSearchPage(); },
  pgChange(d){ ST.search_pg=Math.max(0,ST.search_pg+d); renderSearchPage(); },
  clear(){ ST.search_q=''; ST.search_pg=0; renderSearchPage(); setTimeout(()=>{const el=document.getElementById('sp-input');if(el){el.value='';el.focus();}},50); },
  searchByCourt(caseNum){
    ST.search_q=caseNum; ST.search_pg=0;
    // Search in court_cases field specifically
    renderSearchPage();
    setTimeout(()=>{const el=document.getElementById('sp-input');if(el)el.value=caseNum;},50);
  },
};

// ─── FIX 3: CASES PAGE ───────────────────────────────────────
let CASES_DATA = null; // cache grouped data

function buildCasesData(){
  if(CASES_DATA) return CASES_DATA;
  // Use ID_Групи - ARMA's internal case grouping (82 real groups)
  // Note: court case numbers from Судові_рішення are shown separately in asset details
  // One asset can have 2-3 court numbers → don't use them for grouping (causes duplication)
  const groups={};
  DATA_CATS.forEach(k=>{
    (CACHE[k+'.json']||[]).forEach(r=>{
      const g = r.group||'';
      if(!g || g==='Груповано') return;  // skip ungrouped
      if(!groups[g]) groups[g]={id:g, assets:[], cats:new Set(), count:0};
      groups[g].assets.push({...r,_cat:k});
      groups[g].cats.add(k);
      groups[g].count++;
    });
  });
  CASES_DATA=Object.values(groups).sort((a,b)=>b.count-a.count);
  return CASES_DATA;
}

let openCaseId=null;

function renderCasesPage(){
  const cases=buildCasesData();
  const q=ST.cases_q.toLowerCase();
  const pg=ST.cases_pg, ps=ST.cases_ps;
  
  const filtered=q?cases.filter(c=>
    c.id.toLowerCase().includes(q)||
    c.assets.some(r=>[r.own,r.manager,r.city,r.oblast,r.desc].some(v=>v&&v.toLowerCase().includes(q)))
  ):cases;

  const total=filtered.length,pages=Math.ceil(total/ps)||1;
  const items=filtered.slice(pg*ps,pg*ps+ps);

  document.getElementById('cases-content').innerHTML=`
    <div class="cases-wrap">
      <div class="cases-header">
        <h2>📂 Справи (Групи АРМА)</h2>
        <p style="margin-bottom:8px">Внутрішнє групування АРМА: активи пов'язані одним процесом управління</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mid)">
          <span>📋 Всього груп: <b style="color:var(--ink)">${fmt(cases.length)}</b></span>
          <span>📦 Активів у групах: <b style="color:var(--ink)">${fmt(cases.reduce((s,c)=>s+c.count,0))}</b></span>
        </div>
        <div style="margin-top:8px;padding:8px 12px;background:rgba(217,119,6,.07);border-radius:8px;border-left:3px solid var(--amber);font-size:11.5px;color:var(--ink3)">
          💡 <b>Пояснення:</b> Номери судових справ (напр. 757/13597/24-к) знаходяться у картках активів. Одна група АРМА може охоплювати активи з декількох судових рішень.
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <div class="search-input-wrap" style="flex:1">
          <span class="search-inp-icon">🔍</span>
          <input type="text" class="search-page-input" placeholder="Пошук за номером справи (напр. 757/13597/24-к), власником..."
            value="${esc(ST.cases_q)}" oninput="CASESP.onInput(this.value)">
          ${ST.cases_q?`<button class="search-clear-btn" onclick="CASESP.clear()" title="Очистити">✕</button>`:''}
        </div>
      </div>
      <div class="cases-list">
        ${items.map(c=>{
          const isOpen=openCaseId===c.id;
          const catBreakdown=DATA_CATS.filter(k=>c.cats.has(k)).map(k=>`<span class="case-cat-pill">${CAT_ICONS[k]} ${CAT_LABELS[k]}: ${c.assets.filter(r=>r._cat===k).length}</span>`).join('');
          const arrBreakdown=['a','c','n','x','z'].map(t=>{
            const cnt=c.assets.filter(r=>arrType(r.arr)===t).length;
            return cnt?`<span class="badge ${ARR_BC[t]}" style="font-size:9px">${ARR_LBL[t]}: ${cnt}</span>`:'';
          }).join('');
          const sample=c.assets.slice(0,3);
          return `
            <div class="case-item ${isOpen?'open':''}">
              <div class="case-head" onclick="CASESP.toggle('${esc(c.id)}')">
                <div class="case-num">Справа № ${esc(c.id)}</div>
                <div class="case-meta">
                  <span class="case-count">${fmt(c.count)} активів</span>
                  ${catBreakdown}
                </div>
                <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${arrBreakdown}</div>
                <div class="case-chevron">${isOpen?'▲':'▼'}</div>
              </div>
              ${isOpen?`<div class="case-body">
                <div class="case-actions">
                  <button class="dp-btn" onclick="CASESP.exportCase('${esc(c.id)}')">📄 PDF звіт</button>
                  <button class="dp-btn primary" onclick="APP.goToCase('${esc(c.id)}')">🔍 На карті</button>
                </div>
                ${(()=>{
                  // Collect unique court case numbers across all assets in this group
                  const allCourtCases = [...new Set(c.assets.flatMap(a=>a.court_cases||[]))].filter(Boolean);
                  if(!allCourtCases.length) return '';
                  return `<div class="case-court-numbers">
                    <div class="case-court-title">⚖ Номери судових справ (${allCourtCases.length}):</div>
                    <div class="case-court-pills">
                      ${allCourtCases.map(cn=>`<span class="court-case-pill" onclick="APP.go('cases').then(()=>{if(typeof CASESP2!=='undefined')CASESP2.openCase('${cn.replace(/'/g,\"\\'\")}')})" title="Відкрити справу">${esc(cn)}</span>`).join('')}
                    </div>
                  </div>`;
                })()}
                <div class="case-assets-grid">
                  ${c.assets.map(r=>{
                    const loc=r.addr||r.city||r.oblast||'—';
                    const val=r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'';
                    return `<div class="case-asset" onclick="APP.goToRecord('${esc(r.id)}','${r._cat}')">
                      <div class="case-asset-type">${CAT_ICONS[r._cat]} ${esc((r.type||CAT_LABELS[r._cat]||'').slice(0,40))}</div>
                      <div class="case-asset-desc">${esc((r.desc||'—').slice(0,100))}</div>
                      <div class="case-asset-loc">📍 ${esc(loc.slice(0,60))}</div>
                      ${r.kadastr?`<div style="font-size:9px;font-family:monospace;color:var(--teal)">📋 ${r.kadastr}</div>`:''}
                      <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
                        <span class="badge ${ARR_BC[arrType(r.arr)]}" style="font-size:9px">${ARR_LBL[arrType(r.arr)]}</span>
                        ${val?`<span style="font-size:9px;color:var(--mid)">${val}</span>`:''}
                      </div>
                    </div>`;
                  }).join('')}
                </div>
              </div>`:''}
            </div>`;
        }).join('')||'<div class="no-results">Справ не знайдено</div>'}
      </div>
      ${total>ps?`<div class="search-pgn" style="margin-top:12px">
        <button class="pgn-btn" ${pg===0?'disabled':''} onclick="CASESP.pgChange(-1)">← Попер.</button>
        <span>${pg+1}/${pages} · ${fmt(total)}</span>
        <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="CASESP.pgChange(1)">Наст. →</button>
      </div>`:''}
    </div>`;
}

const CASESP = {
  _tmr:null,
  onInput(v){ clearTimeout(this._tmr); this._tmr=setTimeout(()=>{ST.cases_q=v;ST.cases_pg=0;renderCasesPage();},250); },
  pgChange(d){ ST.cases_pg=Math.max(0,ST.cases_pg+d); renderCasesPage(); },
  clear(){ ST.cases_q=''; ST.cases_pg=0; CASES_DATA=null; renderCasesPage(); },
  toggle(id){ openCaseId=openCaseId===id?null:id; renderCasesPage(); },
  exportCase(id){
    const cases=buildCasesData();
    const c=cases.find(x=>x.id===id); if(!c) return;
    const dt=new Date().toLocaleDateString('uk-UA');
    let rows=c.assets.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(CAT_LABELS[r._cat]||r._cat)}</td><td>${esc(r.type||'')}</td><td>${esc(r.desc||'').slice(0,100)}</td><td>${esc(r.addr||r.city||'')}</td><td>${esc(r.arr||'')}</td><td>${r.value?`${r.value} ${r.currency||'грн'}`:''}</td><td>${esc(r.own||'')}</td></tr>`).join('');
    const html=`<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><title>Справа №${esc(id)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px}h1{font-size:16px;font-weight:800;color:#1a3ea8;margin-bottom:8px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:5px 8px;text-align:left;font-size:11px}
th{background:#f8fafc;font-weight:700}tr:nth-child(even){background:#f9fafb}
.foot{margin-top:16px;font-size:10px;color:#9ca3af}</style></head><body>
<h1>📂 Справа № ${esc(id)} — ${fmt(c.count)} активів</h1>
<p style="font-size:11px;color:#64748b;margin-bottom:12px">Дата: ${dt}</p>
<table><tr><th>ID Активу</th><th>Категорія</th><th>Вид</th><th>Опис</th><th>Адреса</th><th>Стан арешту</th><th>Вартість</th><th>Власник</th></tr>${rows}</table>
<div class="foot">Сформовано автоматично · АРМА України · ${dt}</div></body></html>`;
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`ARMA_Case_${id.replace(/\//g,'_')}.html`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
  }
};

// ─── HOME ────────────────────────────────────────────────────
function renderHome(){
  const s=STATS;
  const byArr=s.by_arrest||{};
  const maxArr=Math.max(...Object.values(byArr),1);
  const CLR={'Арештовано':'#f97316','Стягнення в дохід держави':'#10b981','спеціальна конфіскація':'#06b6d4','Скасування передачі':'#ef4444','Не арештовано':'#6b7280','Націоналзовано':'#8b5cf6','Арештовано (повторний арешт)':'#f97316','скасування арешту в частині користування':'#ef4444'};
  document.getElementById('home-content').innerHTML=`
<div class="home-wrap">
  <div class="home-hero"><img src="logo.png" class="home-hero-logo" alt="АРМА">
    <div><h1>Реєстр арештованих активів</h1>
      <p>Агентство з розшуку та менеджменту активів України &nbsp;·&nbsp; ${fmt(s.total)} об'єктів</p></div>
  </div>
  <div class="kpi-row">
    ${[
      ['Всього активів',s.total,'#1a56db','','search','all'],
      ['Арештовано',s.arrested,'#f97316','Активних арештів','search','a'],
      ['Конфісковано',s.confiscated,'#10b981','У дохід держави','search','c'],
      ['Націоналізовано',s.national,'#8b5cf6','У власності держави','search','n'],
      ['З управителем',s.with_manager,'#10b981','Під управлінням','search','mgr'],
    ].map(([lbl,val,color,sub,pg,fv])=>`
      <div class="kpi" style="--kc:${color}" onclick="APP.goSearch('${fv}')">
        <div class="kpi-lbl">${lbl}</div><div class="kpi-val">${fmt(val)}</div>
        <div class="kpi-sub">${sub||''}</div><div class="kpi-arr">→</div>
      </div>`).join('')}
  </div>
  <div class="sec-h">Категорії активів</div>
  <div class="cat-row">
    ${[
      ['realestate','#f97316','🏢','Нерухомість',s.realestate,'будівлі, квартири'],
      ['land','#06b6d4','🌾','Земельні ділянки',s.land,'кадастровий контур'],
      ['transport','#1a56db','🚗','Транспорт',s.transport,'авто, техніка'],
      ['corp','#8b5cf6','📊','Корп. права',s.corp,'частки, акції'],
      ['money','#d97706','💰','Грошові кошти',s.money,'банківські рахунки'],
      ['movable','#06b6d4','📦','Рухоме майно',s.movable,'товари, обладнання'],
      ['other','#8b5cf6','🗂','Інше майно',s.other,'майнові права, ІВ'],
      ['cases','#1a56db','⚖','Судові справи',s.total_court_cases||4007,'пошук за номером справи'],
      ].map(([pg,cc,ic,name,cnt,sub])=>`
      <div class="cat" style="--cc:${cc}" onclick="APP.go('${pg}')">
        <div class="cat-icon">${ic}</div><div class="cat-name">${name}</div>
        <div class="cat-count">${fmt(cnt)}</div><div class="cat-sub">${sub}</div>
      </div>`).join('')}
  </div>
  <div class="sec-h">Зонування активів (привабливість для управління)</div>
  <div class="zone-row">
    ${Object.entries(ZONE_MEANING).map(([zone,z])=>{
      const cnt = (CACHE['realestate.json']||[]).filter(r=>r.zone===zone).length +
                  (CACHE['land.json']||[]).filter(r=>r.zone===zone).length;
      return `<div class="zone-stat-card" style="border-left:3px solid ${z.color}" onclick="APP.go('realestate');ST.re.zone='${zone}';REMAP.render()">
        <div class="zone-stat-label">${z.label}</div>
        <div class="zone-stat-count" style="color:${z.color}">${fmt(cnt)}</div>
        <div class="zone-stat-desc">${z.desc}</div>
      </div>`;
    }).join('')}
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

// ─── NAVIGATION ──────────────────────────────────────────────
let searchTmr;
// Load geocode cache non-blocking after page is visible
async function _loadGeocacheBackground(){
  try {
    const r = await fetch('geocode_cache.json');
    if(!r.ok) return;
    const data = await r.json();
    // Apply to loaded RE and Land data if available
    const re = CACHE['realestate.json'];
    const land = CACHE['land.json'];
    let applied = 0;
    for(const [q, coords] of Object.entries(data)){
      if(!coords.lat) continue;
      if(re) re.forEach(r=>{ if(r.gq===q && r.geo_quality!=='exact'){ r.lat=coords.lat; r.lng=coords.lng; r.geo_quality='geocoded'; applied++; }});
      if(land) land.forEach(r=>{ if(r.gq===q && r.geo_quality!=='exact'){ r.lat=coords.lat; r.lng=coords.lng; r.geo_quality='geocoded'; applied++; }});
    }
    if(applied > 0) console.log(`Geocache: improved ${applied} coordinates`);
  } catch(e){ /* silent fail */ }
}

const APP={
  async go(pageId){
    // ── Reset state on page change ──────────────────
    const prevPage = ST.page;
    ST.page=pageId; ST.groupFilter=''; ST.expandedId=null; ST.search='';
    // Clear nav search input
    const _si = document.getElementById('search-input');
    if(_si) _si.value='';
    const _clr = document.getElementById('nav-clear-btn');
    if(_clr) _clr.style.display='none';
    // ── Activate page ──────────────────────────────
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t=>t.classList.toggle('active',t.dataset.page===pageId));

    if(pageId==='home'){
      document.getElementById('page-home').classList.add('active');
    } else if(pageId==='realestate'){
      document.getElementById('page-realestate').classList.add('active');
      await loadJSON('realestate.json');
      setTimeout(()=>{
        REMAP.init(); REMAP.render();
        // Start background geocoding
        if(typeof geocodeBatch==='function'){
          const geoBar=document.getElementById('geo-bar');
          const geoMsg=document.getElementById('geo-msg');
          geocodeBatch(CACHE['realestate.json']||[], (done,total,msg,finished)=>{
            if(total>0 && !finished && geoBar){ geoBar.classList.add('show'); if(geoMsg) geoMsg.textContent=msg; }
            if(finished && geoBar){ setTimeout(()=>geoBar.classList.remove('show'),4000); REMAP.render(); }
          });
        }
      },50);
    } else if(pageId==='land'){
      document.getElementById('page-land').classList.add('active');
      await loadJSON('land.json');
      setTimeout(()=>{LANDMAP.init();LANDMAP.render();},30);
    } else if(pageId==='search'){
      document.getElementById('page-search').classList.add('active');
      await loadAll();
      renderSearchPage();
    } else if(pageId==='cases'){
      document.getElementById('page-cases').classList.add('active');
      await loadAll();
      if(typeof renderCasesPage==='function'){
        await renderCasesPage();
      }
    } else {
      ST.cards.key=pageId; ST.expandedId=null;
      document.getElementById('page-cards').classList.add('active');
      await loadJSON(pageId+'.json');
      CARDS.render();
    }
  },

  goSearch(arrFilter){
    ST.search_arr = arrFilter==='mgr'?'all':arrFilter;
    ST.search_q=''; ST.search_pg=0;
    this.go('search');
  },

  openCase(id){
    // Route to cases.js CASESP2 module (real court case numbers)
    APP.go('cases').then(()=>{
      if(typeof CASESP2!=='undefined') CASESP2.openCase(id);
    });
    return; // prevent old logic below
    void(0);
    setTimeout(()=>{
      const el=document.querySelector(`.case-item.open`);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    },100);
  },

  goToCase(id){
    ST.groupFilter=id;
    this.go('realestate');
  },

  goToRecord(id,cat){
    if(cat==='realestate'||cat==='land'){
      this.go(cat).then(()=>{
        setTimeout(()=>{
          if(cat==='realestate') REMAP.select(id,true);
          else LANDMAP.select(id,true);
        },300);
      });
    } else {
      ST.cards.key=cat; ST.expandedId=id;
      this.go(cat).then(()=>setTimeout(()=>{
        const el=document.getElementById('ce-'+id);
        if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
        else CARDS.expand(id);
      },300));
    }
  },

  onSearch(val){
    ST.search=val.toLowerCase();
    // Show/hide clear button
    const clr=document.getElementById('nav-clear-btn');
    if(clr) clr.style.display=val?'flex':'none';
    clearTimeout(searchTmr);
    searchTmr=setTimeout(()=>{
      if(ST.page==='realestate'){ST.re.pg=0;REMAP.render();}
      else if(ST.page==='land'){ST.land.pg=0;LANDMAP.render();}
      else if(DATA_CATS.filter(k=>k!=='realestate'&&k!=='land').includes(ST.page)){ST.cards.pg=0;CARDS.render();}
    },250);
  },
  clearSearch(){
    ST.search='';
    const inp=document.getElementById('search-input');
    if(inp){inp.value='';inp.focus();}
    const clr=document.getElementById('nav-clear-btn');
    if(clr) clr.style.display='none';
    if(ST.page==='realestate'){ST.re.pg=0;REMAP.render();}
    else if(ST.page==='land'){ST.land.pg=0;LANDMAP.render();}
    else if(DATA_CATS.filter(k=>k!=='realestate'&&k!=='land').includes(ST.page)){ST.cards.pg=0;CARDS.render();}
  },

  async init(){
    // geocode_worker.js already loaded via <script> tag in HTML
    // Just init the geocache (non-blocking, after main load)

    const setFill=v=>{const el=document.getElementById('ldr-fill');if(el)el.style.width=v+'%';};
    const setMsg=v=>{const el=document.getElementById('ldr-msg');if(el)el.textContent=v;};
    try{
      setFill(20);setMsg('Завантаження...');
      STATS=await loadJSON('stats.json');
      if(!STATS.by_arrest) STATS.by_arrest={'Арештовано':STATS.arrested,'Не арештовано':STATS.not_arrested,'Стягнення в дохід держави':STATS.confiscated,'Націоналзовано':STATS.national};
      setFill(90);setMsg('Готово!');
    }catch(e){setMsg('Помилка завантаження!');console.error(e);return;}

    // Build tabs - hide search/cases from main nav, add them as icons
    document.getElementById('nav-tabs').innerHTML=TABS.filter(t=>!['search','cases'].includes(t.id)).map(t=>`
      <button class="nav-tab ${t.id==='home'?'active':''}" data-page="${t.id}" onclick="APP.go('${t.id}')">
        ${t.label}<span class="nav-cnt">${fmt(t.cnt?STATS[t.cnt]||0:t.id==='home'?STATS.total||0:0)}</span>
      </button>`).join('')+`
      <button class="nav-tab" data-page="search" onclick="APP.go('search')" title="Пошук по всіх категоріях">🔎 Пошук</button>
      <button class="nav-tab" data-page="cases" onclick="APP.go('cases')" title="Всі справи">📂 Справи <span class="nav-cnt">${STATS.groups||83}</span></button>`;

    setFill(100);
    setTimeout(()=>{
      document.getElementById('loader').style.display='none';
      document.getElementById('topnav').style.display='flex';
      document.getElementById('page-home').style.display='';
      document.getElementById('page-home').classList.add('active');
      renderHome();
      // Load geocode cache in background AFTER page shows (non-blocking)
      _loadGeocacheBackground();
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

function _toast(msg,type='ok'){
  const el=document.createElement('div');
  el.className='app-toast'; el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>el.classList.add('show'),10);
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),400);},3500);
}

document.head.insertAdjacentHTML('beforeend',`<style>
@keyframes mPulse{0%{transform:scale(1);opacity:.65}100%{transform:scale(3.8);opacity:0}}
.app-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:rgba(11,18,32,.92);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-family:'DM Sans',sans-serif;z-index:9999;opacity:0;transition:all .3s;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.3);pointer-events:none}
.app-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>`);

document.addEventListener('DOMContentLoaded',()=>APP.init());
