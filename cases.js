/* ============================================================
   ARMA cases.js v4 — Court Cases + Per-Case Intelligence Page
   
   Features:
   - Full per-case page with asset list, map, PDF
   - Polygon rendering via WFS/GeoJSON
   - Asset click → opens card in correct category
   - Search by case number
   - PDF/CSV export
   ============================================================ */
'use strict';

// ─── STATE ───────────────────────────────────────────────────
let CASES_COMPACT = null;
let _casesQ       = '';
let _casesVerdict = 'all';
let _casesPg      = 0;
let _openCaseId   = null;
let _caseMap      = null;   // Leaflet map inside case page
let _caseCluster  = null;

// ─── CONSTANTS ───────────────────────────────────────────────
const VERDICT_META = {
  'Спеціальна конфіскація':     {icon:'⚖',  color:'#7c3aed', bg:'rgba(124,58,237,.1)'},
  'Стягнення в дохід держави':  {icon:'💰', color:'#059669', bg:'rgba(5,150,105,.1)'},
  'Конфіскація':                {icon:'🏛', color:'#047857', bg:'rgba(4,120,87,.1)'},
  'Передача в управління АРМА': {icon:'🔑', color:'#1a56db', bg:'rgba(26,86,219,.1)'},
  'Накладення арешту':          {icon:'⚔',  color:'#f97316', bg:'rgba(249,115,22,.1)'},
  'Скасування арешту':          {icon:'🔓', color:'#6b7280', bg:'rgba(107,114,128,.1)'},
  'Скасування передачі':        {icon:'↩',  color:'#ef4444', bg:'rgba(239,68,68,.1)'},
  'Звернення стягнення':        {icon:'📜', color:'#d97706', bg:'rgba(217,119,6,.1)'},
  'Націоналізація':             {icon:'🏛', color:'#6d28d9', bg:'rgba(109,40,217,.1)'},
  'Судове рішення':             {icon:'⚖',  color:'#64748b', bg:'rgba(100,116,139,.1)'},
};
const VM = v => VERDICT_META[v] || {icon:'⚖',color:'#64748b',bg:'rgba(100,116,139,.1)'};

const CAT_LABELS = {
  realestate:'Нерухомість', land:'Земля', transport:'Транспорт',
  corp:'Корп. права', money:'Кошти', movable:'Рухоме', other:'Інше'
};
const CAT_ICONS = {
  realestate:'🏢', land:'🌾', transport:'🚗',
  corp:'📊', money:'💰', movable:'📦', other:'🗂'
};
const ARR_BC = {
  a:'badge-arrested', c:'badge-confiscated', n:'badge-national',
  x:'badge-cancelled', z:'badge-notarr', u:'badge-notarr'
};
const ARR_LBL = {a:'Арешт',c:'Конфіск.',n:'Націонал.',x:'Скасовано',z:'Не арешт.',u:'—'};
const ARR_CLR = {a:'#f97316',c:'#10b981',n:'#8b5cf6',x:'#ef4444',z:'#6b7280',u:'#9ca3af'};

function arrType(s){
  if(!s) return 'u'; const sl=s.toLowerCase();
  if(sl.includes('конфіскац')||sl.includes('стягнення')) return 'c';
  if(sl.includes('нац')) return 'n';
  if(sl.includes('не арешт')) return 'z';
  if(sl.includes('арешт')) return 'a';
  if(sl.includes('скасування')) return 'x';
  return 'u';
}

function cssId(s){ return 'c'+String(s).replace(/[^a-zA-Z0-9]/g,'_'); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ return Number(n||0).toLocaleString('uk-UA'); }

// ─── DATA LOADING ─────────────────────────────────────────────
async function loadCasesCompact(){
  if(CASES_COMPACT) return CASES_COMPACT;
  const r = await fetch('cases_compact.json');
  if(!r.ok) throw new Error('Cannot load cases_compact.json');
  CASES_COMPACT = await r.json();
  return CASES_COMPACT;
}

function getCaseAssets(caseNum){
  const DATA_CATS = ['realestate','land','transport','corp','money','movable','other'];
  const results = [];
  DATA_CATS.forEach(k=>{
    const data = (typeof CACHE!=='undefined' ? CACHE[k+'.json'] : null)||[];
    data.forEach(r=>{
      if((r.court_cases||[]).includes(caseNum))
        results.push({...r, _cat:k});
    });
  });
  return results;
}

// ─── CASE LIST PAGE ───────────────────────────────────────────
async function renderCasesPage(params={}){
  const wrap = document.getElementById('cases-content');
  if(!wrap) return;

  try { await loadCasesCompact(); }
  catch(e){
    wrap.innerHTML=`<div class="search-wrap-page">
      <div class="no-results" style="padding:40px">⚠ ${esc(e.message)}</div></div>`;
    return;
  }

  if(params.q       !== undefined) _casesQ       = params.q;
  if(params.verdict !== undefined) _casesVerdict  = params.verdict;
  if(params.pg      !== undefined) _casesPg       = params.pg;

  // If specific case requested → render single case page
  if(_openCaseId){
    renderSingleCase(_openCaseId);
    return;
  }

  const ps = 30;
  const allEntries = Object.entries(CASES_COMPACT);

  let entries = allEntries;
  if(_casesQ){
    const ql = _casesQ.toLowerCase().trim();
    entries = entries.filter(([cn,ci])=>
      cn.toLowerCase().includes(ql) ||
      (ci.v||'').toLowerCase().includes(ql) ||
      (ci.dt||[]).some(d=>d.includes(ql))
    );
  }
  if(_casesVerdict !== 'all'){
    entries = entries.filter(([cn,ci])=>ci.v===_casesVerdict);
  }
  entries.sort((a,b)=>b[1].n - a[1].n);

  const total = entries.length;
  const pages = Math.ceil(total/ps)||1;
  _casesPg = Math.min(_casesPg, pages-1);
  const items = entries.slice(_casesPg*ps, _casesPg*ps+ps);

  // Verdict summary
  const verdictCounts = {};
  allEntries.forEach(([,ci])=>{ verdictCounts[ci.v]=(verdictCounts[ci.v]||0)+1; });
  const sortedVerdicts = Object.entries(verdictCounts).sort((a,b)=>b[1]-a[1]);

  wrap.innerHTML = `
<div class="search-wrap-page cases-wrap-full">
  <div class="cases-page-header">
    <div style="flex:1">
      <h2>⚖ Судові справи</h2>
      <p>Пошук за номером справи · <b>${fmt(allEntries.length)}</b> унікальних справ в реєстрі АРМА</p>
      <div class="cases-tip">
        💡 Введіть номер справи (напр. <code>761/10351/21</code>) і натисніть Enter — відкриється детальна сторінка зі списком усіх активів та картою
      </div>
    </div>
    <button class="dp-btn primary" onclick="exportAllCasesReport()" style="flex-shrink:0">
      📊 CSV всіх справ
    </button>
  </div>

  <div class="cases-search-bar">
    <div class="search-input-wrap" style="flex:1;max-width:560px">
      <span class="search-inp-icon">🔍</span>
      <input type="text" class="search-page-input" id="cases-q-input"
        placeholder="Номер справи (напр. 761/10351/21) або вердикт..."
        value="${esc(_casesQ)}"
        oninput="CASESP2._onInput(this.value)"
        onkeydown="if(event.key==='Enter'){CASESP2._doSearch();}">
      ${_casesQ?`<button class="search-clear-btn" onclick="CASESP2.clear()">✕</button>`:''}
    </div>
    <button class="dp-btn primary" onclick="CASESP2._doSearch()" style="padding:10px 16px">
      🔍 Пошук
    </button>
  </div>

  <div class="cases-verdict-filters">
    <button class="fbtn ${_casesVerdict==='all'?'active':''}"
      onclick="CASESP2.setVerdict('all')">Всі (${fmt(allEntries.length)})</button>
    ${sortedVerdicts.map(([v,c])=>{
      const vm=VM(v);
      return `<button class="fbtn ${_casesVerdict===v?'active':''}"
        style="${_casesVerdict===v?`background:${vm.color};border-color:${vm.color};color:#fff`:''}"
        onclick="CASESP2.setVerdict('${v.replace(/'/g,"\\'")}')">
        ${vm.icon} ${v.replace('в управління АРМА','').replace('в дохід держави','').trim()} (${fmt(c)})
      </button>`;
    }).join('')}
  </div>

  ${total===0?`<div class="no-results" style="padding:32px">
    Справу <b>${esc(_casesQ)}</b> не знайдено.<br>
    <span style="font-size:12px;color:var(--mid)">Перевірте формат: напр. <code>761/10351/21</code> або <code>757/3035/19-к</code></span>
  </div>`:
  `<div class="cases-results-info">
    Знайдено: <b>${fmt(total)}</b> справ · ${fmt(entries.reduce((s,[,ci])=>s+ci.n,0))} активів
  </div>`}

  <div class="cases-list" id="cases-list-inner">
    ${items.map(([cn,ci])=>renderCaseRow(cn,ci)).join('')}
  </div>

  ${total>ps?`<div class="search-pgn">
    <button class="pgn-btn" ${_casesPg===0?'disabled':''} onclick="CASESP2.pgChange(-1)">← Попер.</button>
    <span>${_casesPg+1}/${pages} · ${fmt(total)}</span>
    <button class="pgn-btn" ${_casesPg>=pages-1?'disabled':''} onclick="CASESP2.pgChange(1)">Наст. →</button>
  </div>`:''}
</div>`;
}

function renderCaseRow(cn, ci){
  const vm = VM(ci.v);
  const catStr = Object.entries(ci.cc||{})
    .map(([k,n])=>`${CAT_ICONS[k]} ${CAT_LABELS[k]}: <b>${n}</b>`).join(' · ');
  return `
<div class="case-row" onclick="CASESP2.openCase('${cn.replace(/'/g,"\\'")}')"
  title="Відкрити деталі справи">
  <div class="case-row-left">
    <div class="case-verdict-badge" style="background:${vm.bg};color:${vm.color}">
      ${vm.icon} ${esc(ci.v)}
    </div>
    <div class="case-row-num">
      <span class="case-num-text">№ <span style="font-family:monospace">${esc(cn)}</span></span>
      <span class="case-asset-count">${fmt(ci.n)} активів</span>
      ${(ci.dt||[]).length?`<span class="case-dates">📅 ${ci.dt[0]}</span>`:''}
    </div>
    <div class="case-cats-row">${catStr}</div>
  </div>
  <div class="case-row-arrow">→</div>
</div>`;
}

// ─── SINGLE CASE PAGE ─────────────────────────────────────────
async function renderSingleCase(caseNum){
  const wrap = document.getElementById('cases-content');
  if(!wrap) return;

  await loadCasesCompact();
  const ci = CASES_COMPACT[caseNum];
  if(!ci){
    wrap.innerHTML=`<div class="search-wrap-page">
      <button class="dp-btn" onclick="CASESP2.backToList()" style="margin-bottom:16px">← Назад до списку</button>
      <div class="no-results">Справу <b>${esc(caseNum)}</b> не знайдено</div></div>`;
    return;
  }

  const vm = VM(ci.v);

  // Load all categories for asset search
  if(typeof loadAll==='function') await loadAll();
  const assets = getCaseAssets(caseNum);

  // Group by category
  const bycat = {};
  assets.forEach(r=>{ const c=r._cat||'other'; (bycat[c]=bycat[c]||[]).push(r); });

  // Count arrest statuses
  const arrCounts = {};
  assets.forEach(r=>{ const t=arrType(r.arr); arrCounts[t]=(arrCounts[t]||0)+1; });

  wrap.innerHTML = `
<div class="case-detail-page">

  <!-- HEADER -->
  <div class="case-detail-header">
    <button class="dp-btn" onclick="CASESP2.backToList()" style="flex-shrink:0">
      ← Всі справи
    </button>
    <div style="flex:1">
      <div class="case-verdict-badge" style="background:${vm.bg};color:${vm.color};font-size:13px;padding:5px 14px;display:inline-flex">
        ${vm.icon} ${esc(ci.v)}
      </div>
      <h2 class="case-detail-num">Справа № <span style="font-family:monospace">${esc(caseNum)}</span></h2>
      <div class="case-detail-meta">
        ${(ci.dt||[]).length?`<span>📅 ${ci.dt.join(', ')}</span>`:''}
        <span>📦 ${fmt(assets.length)} активів</span>
        ${(ci.vt||[]).length>1?`<span>⚖ ${ci.vt.join(' · ')}</span>`:''}
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button class="dp-btn pdf-btn" onclick="exportCaseReport('${caseNum.replace(/'/g,"\\'")}')" title="PDF звіт">📄 PDF</button>
      <button class="dp-btn" onclick="exportCaseCSV('${caseNum.replace(/'/g,"\\'")}')" title="CSV">📊 CSV</button>
    </div>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="case-summary-cards">
    <div class="cs-card">
      <div class="cs-card-label">Всього активів</div>
      <div class="cs-card-value">${fmt(assets.length)}</div>
    </div>
    ${Object.entries(bycat).map(([cat,recs])=>`
    <div class="cs-card cs-card-cat" onclick="">
      <div class="cs-card-label">${CAT_ICONS[cat]} ${CAT_LABELS[cat]}</div>
      <div class="cs-card-value">${recs.length}</div>
    </div>`).join('')}
    ${arrCounts.a?`<div class="cs-card" style="border-left-color:#f97316">
      <div class="cs-card-label">Арештовано</div>
      <div class="cs-card-value" style="color:#f97316">${arrCounts.a}</div>
    </div>`:''}
    ${arrCounts.c?`<div class="cs-card" style="border-left-color:#10b981">
      <div class="cs-card-label">Конфісковано</div>
      <div class="cs-card-value" style="color:#10b981">${arrCounts.c}</div>
    </div>`:''}
  </div>

  <!-- MAP OF CASE ASSETS -->
  ${assets.some(r=>r.lat&&r.geo_quality!=='approximate')?`
  <div class="case-map-section">
    <div class="case-section-title">🗺 Географія активів</div>
    <div id="case-map" style="height:380px;border-radius:var(--r-lg);overflow:hidden;border:1.5px solid var(--line)"></div>
  </div>`:''}

  <!-- ASSETS BY CATEGORY -->
  <div class="case-section-title" style="margin-top:20px">
    📋 Перелік активів
    <span style="font-size:12px;font-weight:400;color:var(--mid)">— натисніть на актив щоб відкрити картку</span>
  </div>

  ${Object.entries(bycat).map(([cat,recs])=>`
  <div class="case-cat-section">
    <div class="case-cat-header">
      ${CAT_ICONS[cat]} ${CAT_LABELS[cat]}
      <span class="case-cat-cnt">${recs.length}</span>
    </div>
    <div class="case-assets-table-wrap">
      <table class="case-assets-table">
        <thead><tr>
          <th>ID активу</th>
          <th>Опис / Тип</th>
          <th>Адреса</th>
          <th>Стан арешту</th>
          <th>Зона</th>
          <th>Власник</th>
        </tr></thead>
        <tbody>
          ${recs.map(r=>`<tr class="case-asset-tr" onclick="CASESP2.openAsset('${esc(r.id)}','${cat}')">
            <td class="mono" style="font-size:10px;white-space:nowrap">${esc(r.id)}</td>
            <td style="max-width:200px">${esc((r.desc||r.type||'—').slice(0,100))}</td>
            <td style="font-size:11px">${esc((r.addr||r.city||r.oblast||'—').slice(0,70))}</td>
            <td><span class="badge ${ARR_BC[arrType(r.arr)]}" style="font-size:9px">${esc(r.arr||'—')}</span></td>
            <td>${r.zone?`<span class="zone-pill zone-${r.zone.includes('Жовт')?'yellow':r.zone.includes('Черв')?'red':r.zone.includes('Синя')?'blue':'grey'}" style="font-size:9px">${r.zone.replace(' зона','')}</span>`:'—'}</td>
            <td style="font-size:10px;max-width:130px">${esc((r.own||'—').slice(0,50))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`).join('')}

</div>`;

  // Initialize case map
  if(assets.some(r=>r.lat&&r.geo_quality!=='approximate')){
    setTimeout(()=>_initCaseMap(assets), 100);
  }
}

function _initCaseMap(assets){
  const mapEl = document.getElementById('case-map');
  if(!mapEl || !window.L) return;

  if(_caseMap){ _caseMap.remove(); _caseMap=null; }

  _caseMap = L.map('case-map',{zoomControl:true, preferCanvas:true});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    {attribution:'© OSM © CARTO', maxZoom:19, subdomains:'abcd'}).addTo(_caseMap);

  _caseCluster = L.markerClusterGroup({
    maxClusterRadius:40, chunkedLoading:true, showCoverageOnHover:false
  });

  const validAssets = assets.filter(r=>r.lat && r.geo_quality!=='approximate');
  const bounds = [];

  validAssets.forEach(r=>{
    const color = ARR_CLR[arrType(r.arr)]||'#9ca3af';
    const icon = L.divIcon({
      className:'',
      html:`<div style="width:12px;height:12px;border-radius:${r._cat==='land'?'3px':'50%'};background:${color};border:2px solid rgba(255,255,255,.9);box-shadow:0 1px 5px rgba(0,0,0,.3)"></div>`,
      iconSize:[12,12], iconAnchor:[6,6]
    });
    const m = L.marker([r.lat,r.lng],{icon});
    m.bindPopup(`
      <div class="lp-id">${esc(r.id)}</div>
      <div class="lp-title">${esc((r.desc||r.type||'').slice(0,80))}</div>
      <div class="lp-addr">📍 ${esc(r.addr||r.city||'—')}</div>
      <span class="badge ${ARR_BC[arrType(r.arr)]}" style="font-size:9px">${esc(r.arr||'—')}</span>
      <br><br><span class="lp-link" onclick="CASESP2.openAsset('${r.id}','${r._cat||'other'}')">→ Відкрити картку</span>
    `,{maxWidth:280});
    _caseCluster.addLayer(m);
    bounds.push([r.lat, r.lng]);
  });

  _caseMap.addLayer(_caseCluster);

  if(bounds.length){
    if(bounds.length===1){
      _caseMap.setView(bounds[0], 14);
    } else {
      _caseMap.fitBounds(L.latLngBounds(bounds), {padding:[30,30], maxZoom:15});
    }
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────
function exportCaseReport(caseNum){
  const ci = CASES_COMPACT?.[caseNum];
  if(!ci){ alert('Дані справи не знайдено'); return; }
  const vm = VM(ci.v);
  const assets = getCaseAssets(caseNum);
  const dt = new Date().toLocaleDateString('uk-UA');
  const bycat = {};
  assets.forEach(r=>{ const c=r._cat||'other'; (bycat[c]=bycat[c]||[]).push(r); });

  const tablesHtml = Object.entries(bycat).map(([cat,recs])=>`
    <h3 style="margin:18px 0 8px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px">
      ${CAT_ICONS[cat]} ${CAT_LABELS[cat]} (${recs.length})
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">ID активу</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Опис</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Адреса</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Стан арешту</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Зона</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Власник</th>
        ${cat==='land'?'<th style="padding:5px 8px;border:1px solid #e5e7eb">Кадастр. №</th>':''}
      </tr></thead>
      <tbody>${recs.map(r=>`<tr>
        <td style="padding:4px 8px;border:1px solid #f1f5f9;font-family:monospace;font-size:9.5px">${r.id}</td>
        <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.desc||r.type||'—').slice(0,120)}</td>
        <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.addr||r.city||'—').slice(0,80)}</td>
        <td style="padding:4px 8px;border:1px solid #f1f5f9">${r.arr||'—'}</td>
        <td style="padding:4px 8px;border:1px solid #f1f5f9">${r.zone||'—'}</td>
        <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.own||'—').slice(0,60)}</td>
        ${cat==='land'?`<td style="padding:4px 8px;border:1px solid #f1f5f9;font-family:monospace;font-size:9px">${r.kadastr||'—'}</td>`:''}
      </tr>`).join('')}</tbody>
    </table>`).join('');

  const html=`<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8">
<title>Справа № ${caseNum} — АРМА</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:1200px;margin:auto}
h1{font-size:20px;font-weight:800;color:#1a3ea8;border-bottom:3px solid #1a3ea8;padding-bottom:10px;margin-bottom:16px}
.verdict{display:inline-block;padding:6px 16px;border-radius:20px;font-weight:700;font-size:14px;margin-bottom:16px}
.meta{display:grid;grid-template-columns:160px 1fr;gap:5px 16px;margin-bottom:20px;background:#f8fafc;padding:12px;border-radius:8px}
.meta .lbl{color:#6b7280;font-weight:600;font-size:11px}
.meta .val{color:#111;font-size:12px}
.stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.stat{padding:10px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #1a3ea8;min-width:120px}
.stat-label{font-size:10px;color:#64748b;text-transform:uppercase}
.stat-val{font-size:18px;font-weight:800;color:#1a3ea8}
.foot{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body>
<h1>⚖ Звіт по судовій справі</h1>
<div class="verdict" style="background:${vm.bg};color:${vm.color};border:2px solid ${vm.color}44">
  ${vm.icon} ${ci.v}
</div>
<div class="meta">
  <span class="lbl">Номер справи</span><span class="val" style="font-family:monospace;font-weight:700;font-size:14px">${caseNum}</span>
  <span class="lbl">Вердикт</span><span class="val" style="color:${vm.color};font-weight:700">${ci.v}</span>
  ${(ci.dt||[]).length?`<span class="lbl">Дата(и) рішення</span><span class="val">${ci.dt.join(', ')}</span>`:''}
  ${(ci.vt||[]).length>1?`<span class="lbl">Дії в справі</span><span class="val">${ci.vt.join(' · ')}</span>`:''}
  <span class="lbl">Всього активів</span><span class="val" style="font-weight:700">${fmt(assets.length)}</span>
  <span class="lbl">Дата звіту</span><span class="val">${dt}</span>
</div>
<div class="stats">
  ${Object.entries(bycat).map(([cat,recs])=>`<div class="stat">
    <div class="stat-label">${CAT_LABELS[cat]}</div>
    <div class="stat-val">${recs.length}</div>
  </div>`).join('')}
</div>
${tablesHtml}
<div class="foot">Документ сформовано автоматично · Реєстр активів АРМА України · ${dt}</div>
</body></html>`;

  _download(html, `ARMA_Справа_${caseNum.replace(/[\/\-]/g,'_')}.html`, 'text/html;charset=utf-8');
}

function exportCaseCSV(caseNum){
  const assets = getCaseAssets(caseNum);
  const ci = CASES_COMPACT?.[caseNum];
  const rows = [
    ['Справа №','Вердикт','Дата рішення'],
    [caseNum, ci?.v||'', (ci?.dt||[]).join('; ')],
    [],
    ['ID Активу','Категорія','Тип','Опис','Адреса','Стан арешту','Зонування','Власник','Кадастр. №','Lat','Lng'],
    ...assets.map(r=>[
      r.id, CAT_LABELS[r._cat]||r._cat, r.type||'',
      (r.desc||'').slice(0,100).replace(/\n/g,' '),
      r.addr||r.city||'', r.arr||'', r.zone||'', r.own||'',
      r.kadastr||'', r.lat||'', r.lng||'',
    ])
  ];
  const csv = rows.map(row=>row.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  _download('\ufeff'+csv, `ARMA_Справа_${caseNum.replace(/[\/\-]/g,'_')}.csv`, 'text/csv;charset=utf-8');
}

function exportAllCasesReport(){
  if(!CASES_COMPACT){ alert('Дані ще не завантажені'); return; }
  const rows = [
    ['Номер справи','Вердикт','Дата(и)','Кількість активів','Нерухомість','Земля','Транспорт','Корп. права','Кошти','Рухоме','Інше'],
    ...Object.entries(CASES_COMPACT).sort((a,b)=>b[1].n-a[1].n).map(([cn,ci])=>[
      cn, ci.v, (ci.dt||[]).join('; '), ci.n,
      ci.cc?.realestate||0, ci.cc?.land||0, ci.cc?.transport||0,
      ci.cc?.corp||0, ci.cc?.money||0, ci.cc?.movable||0, ci.cc?.other||0,
    ])
  ];
  const csv = rows.map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  _download('\ufeff'+csv, `ARMA_Всі_справи_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8');
}

function _download(content, filename, mime){
  const blob = new Blob([content],{type:mime});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
}

// ─── CONTROLLER ───────────────────────────────────────────────
const CASESP2 = {
  _inputTmr: null,

  _onInput(v){
    // Just update clear button - don't search yet
    const btn = document.querySelector('#cases-q-input + .search-clear-btn');
  },

  _doSearch(){
    const inp = document.getElementById('cases-q-input');
    if(!inp) return;
    const v = inp.value.trim();
    _casesQ = v;
    _casesPg = 0;
    _openCaseId = null;
    renderCasesPage({q:v, pg:0});
  },

  clear(){
    _casesQ=''; _openCaseId=null;
    renderCasesPage({q:'', pg:0});
    setTimeout(()=>{
      const el=document.getElementById('cases-q-input');
      if(el){el.value='';el.focus();}
    },50);
  },

  setVerdict(v){ _casesVerdict=v; _casesPg=0; renderCasesPage(); },
  pgChange(d){ renderCasesPage({pg:Math.max(0,_casesPg+d)}); },

  openCase(cn){
    _openCaseId = cn;
    renderSingleCase(cn);
    // Scroll to top
    const wrap = document.getElementById('cases-content');
    if(wrap) wrap.scrollTop=0;
  },

  backToList(){
    _openCaseId = null;
    renderCasesPage();
  },

  openAsset(id, cat){
    // Navigate to the asset's category page and open its card
    if(typeof APP !== 'undefined'){
      if(cat==='realestate'){
        APP.go('realestate').then(()=>{
          setTimeout(()=>{ if(typeof REMAP!=='undefined') REMAP.select(id, true); },300);
        });
      } else if(cat==='land'){
        APP.go('land').then(()=>{
          setTimeout(()=>{ if(typeof LANDMAP!=='undefined') LANDMAP.select(id, true); },300);
        });
      } else {
        APP.go(cat).then(()=>{
          setTimeout(()=>{ if(typeof CARDS!=='undefined') CARDS.expand(id); },300);
        });
      }
    }
  },
};
