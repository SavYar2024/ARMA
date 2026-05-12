/* ============================================================
   ARMA cases.js — Court Cases Module v2
   Separate file to keep app.js lean
   ============================================================ */
'use strict';

// ─── COURT CASES DATA ─────────────────────────────────────────
let CASES_COMPACT = null;  // loaded from cases_compact.json
let CASES_OPEN_ID = null;  // currently open case number

// Verdict colors/icons
const VERDICT_META = {
  'Спеціальна конфіскація':      {icon:'⚖',  color:'#8b5cf6', bg:'rgba(139,92,246,.1)',  badge:'verdict-confiscate'},
  'Стягнення в дохід держави':   {icon:'💰', color:'#10b981', bg:'rgba(16,185,129,.1)',   badge:'verdict-forfeiture'},
  'Конфіскація':                 {icon:'🏛',  color:'#059669', bg:'rgba(5,150,105,.1)',    badge:'verdict-confiscate'},
  'Передача в управління АРМА':  {icon:'🔑', color:'#1a56db', bg:'rgba(26,86,219,.1)',    badge:'verdict-transfer'},
  'Накладення арешту':           {icon:'⚔',  color:'#f97316', bg:'rgba(249,115,22,.1)',   badge:'verdict-arrest'},
  'Скасування арешту':           {icon:'🔓', color:'#6b7280', bg:'rgba(107,114,128,.1)',  badge:'verdict-cancel'},
  'Скасування передачі':        {icon:'↩',  color:'#ef4444', bg:'rgba(239,68,68,.1)',    badge:'verdict-cancel'},
  'Звернення стягнення':        {icon:'📜', color:'#d97706', bg:'rgba(217,119,6,.1)',    badge:'verdict-forfeiture'},
  'Судове рішення':              {icon:'⚖',  color:'#64748b', bg:'rgba(100,116,139,.1)', badge:'verdict-other'},
};

function verdictMeta(v){
  return VERDICT_META[v] || {icon:'⚖', color:'#64748b', bg:'rgba(100,116,139,.1)', badge:'verdict-other'};
}

const CAT_LABELS = {
  realestate:'Нерухомість', land:'Земля', transport:'Транспорт',
  corp:'Корп. права', money:'Кошти', movable:'Рухоме', other:'Інше'
};
const CAT_ICONS = {
  realestate:'🏢', land:'🌾', transport:'🚗',
  corp:'📊', money:'💰', movable:'📦', other:'🗂'
};

async function loadCasesCompact(){
  if(CASES_COMPACT) return CASES_COMPACT;
  const r = await fetch('cases_compact.json');
  if(!r.ok) throw new Error('Cannot load cases_compact.json');
  CASES_COMPACT = await r.json();
  return CASES_COMPACT;
}

// ─── RENDER CASES PAGE ────────────────────────────────────────
let _casesFiltered = null;

async function renderCasesPage(params={}){
  const wrap = document.getElementById('cases-content');
  if(!wrap) return;

  // Ensure data loaded
  try { await loadCasesCompact(); }
  catch(e){ wrap.innerHTML=`<div class="search-wrap-page"><div class="no-results">Помилка завантаження справ</div></div>`; return; }

  const q         = (params.q !== undefined ? params.q : window._casesQ)||'';
  const verdictF  = (params.verdict !== undefined ? params.verdict : window._casesVerdict)||'all';
  const pg        = (params.pg !== undefined ? params.pg : window._casesPg)||0;
  const ps        = 30;
  window._casesQ  = q;
  window._casesVerdict = verdictF;
  window._casesPg = pg;

  // Filter
  let entries = Object.entries(CASES_COMPACT);
  if(q){
    const ql = q.toLowerCase();
    entries = entries.filter(([cn,ci])=>
      cn.toLowerCase().includes(ql) ||
      ci.v.toLowerCase().includes(ql) ||
      (ci.dt||[]).some(d=>d.includes(ql))
    );
  }
  if(verdictF !== 'all'){
    entries = entries.filter(([cn,ci])=>ci.v===verdictF);
  }

  entries.sort((a,b)=>b[1].n - a[1].n);

  const total = entries.length;
  const pages = Math.ceil(total/ps)||1;
  const items = entries.slice(pg*ps, pg*ps+ps);

  // Verdict distribution for filter pills
  const verdictCounts = {};
  Object.values(CASES_COMPACT).forEach(ci=>{
    verdictCounts[ci.v] = (verdictCounts[ci.v]||0)+1;
  });
  const sortedVerdicts = Object.entries(verdictCounts).sort((a,b)=>b[1]-a[1]);

  wrap.innerHTML = `
<div class="search-wrap-page cases-wrap-full">
  <div class="cases-page-header">
    <div>
      <h2>⚖ Судові справи</h2>
      <p>Пошук активів за номером справи · <b>${Object.keys(CASES_COMPACT).length}</b> унікальних справ у реєстрі</p>
    </div>
    <button class="dp-btn primary" onclick="exportAllCasesReport()" style="flex-shrink:0">📥 Звіт по всіх справах</button>
  </div>

  <div class="cases-search-bar">
    <div class="search-input-wrap" style="flex:1;max-width:500px">
      <span class="search-inp-icon">🔍</span>
      <input type="text" class="search-page-input" id="cases-q-input"
        placeholder="Номер справи (напр. 757/13597/24-к) або дата..."
        value="${esc(q)}" oninput="CASESP2.onInput(this.value)">
      ${q?`<button class="search-clear-btn" onclick="CASESP2.clear()">✕</button>`:''}
    </div>
  </div>

  <div class="cases-verdict-filters">
    <span class="f-lbl" style="width:auto;margin:0;align-self:center">Вердикт:</span>
    <button class="fbtn ${verdictF==='all'?'active':''}" onclick="CASESP2.setVerdict('all')">Всі (${Object.keys(CASES_COMPACT).length})</button>
    ${sortedVerdicts.map(([v,c])=>{
      const vm=verdictMeta(v);
      return `<button class="fbtn cases-verdict-btn ${verdictF===v?'active':''}"
        style="${verdictF===v?`background:${vm.color};border-color:${vm.color};color:#fff`:''}"
        onclick="CASESP2.setVerdict('${v.replace(/'/g,"\\'")}')">
        ${vm.icon} ${v.replace('АРМА','').trim()} (${c})
      </button>`;
    }).join('')}
  </div>

  <div class="cases-results-info">
    Знайдено: <b>${total}</b> справ
    ${total>0?`· ${entries.slice(0,total).reduce((s,[,ci])=>s+ci.n,0)} активів`:''}
  </div>

  <div class="cases-list" id="cases-list-inner">
    ${items.length ? items.map(([cn,ci])=>renderCaseCard(cn,ci)).join('') : '<div class="no-results">Справ не знайдено</div>'}
  </div>

  ${total>ps?`<div class="search-pgn">
    <button class="pgn-btn" ${pg===0?'disabled':''} onclick="CASESP2.pgChange(-1)">← Попер.</button>
    <span>${pg+1}/${pages} · ${total} справ</span>
    <button class="pgn-btn" ${pg>=pages-1?'disabled':''} onclick="CASESP2.pgChange(1)">Наст. →</button>
  </div>`:''}
</div>`;

  // If a case was requested to open, expand it
  if(CASES_OPEN_ID){
    setTimeout(()=>{ CASESP2.open(CASES_OPEN_ID); CASES_OPEN_ID=null; },100);
  }
}

function renderCaseCard(cn, ci, expanded=false){
  const vm = verdictMeta(ci.v);
  const catBreakdown = Object.entries(ci.cc||{})
    .map(([k,n])=>`<span class="case-cat-pill">${CAT_ICONS[k]||'📋'} ${CAT_LABELS[k]||k}: <b>${n}</b></span>`).join('');
  const isOpen = expanded || (window._openCaseId===cn);

  let expandedHtml = '';
  if(isOpen){
    // Load assets from in-memory category data
    const caseAssets = getCaseAssets(cn);
    expandedHtml = renderCaseExpanded(cn, ci, caseAssets);
  }

  return `
<div class="case-card ${isOpen?'case-card-open':''}" id="case-${cssId(cn)}">
  <div class="case-card-head" onclick="CASESP2.toggle('${cn.replace(/'/g,"\\'")}')">
    <div class="case-verdict-badge" style="background:${vm.bg};color:${vm.color};border-color:${vm.color}33">
      ${vm.icon} ${ci.v}
    </div>
    <div class="case-num-row">
      <span class="case-num">№ ${esc(cn)}</span>
      <span class="case-asset-count">${ci.n} активів</span>
      ${(ci.dt||[]).length?`<span class="case-dates">📅 ${ci.dt.slice(0,2).join(', ')}</span>`:''}
    </div>
    <div class="case-cats-row">${catBreakdown}</div>
    <div class="case-chevron">${isOpen?'▲':'▼'}</div>
  </div>
  ${expandedHtml}
</div>`;
}

function renderCaseExpanded(cn, ci, assets){
  const vm = verdictMeta(ci.v);
  const verdictTypes = (ci.vt||[ci.v]).join(' · ');

  // Group assets by category
  const bycat = {};
  assets.forEach(r=>{ const c=r._cat||'other'; bycat[c]=(bycat[c]||[]); bycat[c].push(r); });

  return `
<div class="case-expanded">
  <div class="case-expanded-header">
    <div class="case-summary">
      <div class="case-summary-item"><span class="cs-lbl">Справа №</span><span class="cs-val mono">${esc(cn)}</span></div>
      <div class="case-summary-item"><span class="cs-lbl">Вердикт</span>
        <span class="cs-val" style="color:${vm.color};font-weight:700">${vm.icon} ${ci.v}</span>
      </div>
      ${(ci.dt||[]).length?`<div class="case-summary-item"><span class="cs-lbl">Дата(и)</span><span class="cs-val">${ci.dt.join(', ')}</span></div>`:''}
      ${verdictTypes!==ci.v?`<div class="case-summary-item"><span class="cs-lbl">Дії в рамках справи</span><span class="cs-val" style="font-size:11px">${esc(verdictTypes)}</span></div>`:''}
      <div class="case-summary-item"><span class="cs-lbl">Активів загалом</span><span class="cs-val bold">${assets.length}</span></div>
    </div>
    <div class="case-actions-row">
      <button class="dp-btn primary" onclick="exportCaseReport('${cn.replace(/'/g,"\\'")}')">📄 PDF-звіт по справі</button>
      <button class="dp-btn" onclick="CASESP2.showOnMap('${cn.replace(/'/g,"\\'")}')">🗺 На карті</button>
      <button class="dp-btn" onclick="exportCaseCSV('${cn.replace(/'/g,"\\'")}')">📊 CSV</button>
    </div>
  </div>

  ${Object.entries(bycat).map(([cat,recs])=>`
    <div class="case-cat-section">
      <div class="case-cat-header">${CAT_ICONS[cat]} ${CAT_LABELS[cat]} <span class="case-cat-cnt">${recs.length}</span></div>
      <div class="case-assets-table">
        <table>
          <thead><tr>
            <th>ID активу</th><th>Опис</th><th>Адреса</th>
            <th>Стан арешту</th><th>Зонування</th><th>Власник</th>
          </tr></thead>
          <tbody>
            ${recs.map(r=>`<tr class="case-asset-row" onclick="APP.goToRecord('${esc(r.id)}','${cat}')">
              <td class="mono" style="font-size:10px;white-space:nowrap">${esc(r.id)}</td>
              <td style="max-width:220px">${esc((r.desc||r.type||'—').slice(0,100))}</td>
              <td style="font-size:11px;max-width:180px">${esc((r.addr||r.city||r.oblast||'—').slice(0,80))}</td>
              <td><span class="badge ${arrBadgeClass(r.arr)}" style="font-size:9px">${esc(r.arr||'—')}</span></td>
              <td>${r.zone?`<span class="zone-pill zone-${zoneCode(r.zone)}" style="font-size:9px">${zoneLabel(r.zone)}</span>`:'—'}</td>
              <td style="font-size:10px;max-width:140px">${esc((r.own||'—').slice(0,50))}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('')}
</div>`;
}

// ─── HELPER: Get assets for a case from in-memory data ────────
function getCaseAssets(caseNum){
  const DATA_CATS = ['realestate','land','transport','corp','money','movable','other'];
  const results = [];
  DATA_CATS.forEach(k=>{
    const data = (typeof CACHE !== 'undefined' ? CACHE[k+'.json'] : null) || [];
    data.forEach(r=>{
      if((r.court_cases||[]).includes(caseNum)){
        results.push({...r, _cat:k});
      }
    });
  });
  return results;
}

// ─── HELPERS ──────────────────────────────────────────────────
function cssId(s){ return s.replace(/[^a-zA-Z0-9]/g,'_'); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ return Number(n||0).toLocaleString('uk-UA'); }

function arrBadgeClass(s){
  if(!s) return 'badge-notarr';
  const sl=s.toLowerCase();
  if(sl.includes('конфіскац')||sl.includes('стягнення')) return 'badge-confiscated';
  if(sl.includes('нац')) return 'badge-national';
  if(sl.includes('не арешт')) return 'badge-notarr';
  if(sl.includes('арешт')) return 'badge-arrested';
  if(sl.includes('скасування')) return 'badge-cancelled';
  return 'badge-notarr';
}

function zoneCode(z){
  if(!z) return 'grey';
  if(z.includes('Жовта')) return 'yellow';
  if(z.includes('Червона')) return 'red';
  if(z.includes('Синя')) return 'blue';
  return 'grey';
}
function zoneLabel(z){
  if(!z) return '';
  if(z.includes('Жовта')) return '🟡';
  if(z.includes('Червона')) return '🔴';
  if(z.includes('Синя')) return '🔵';
  return '⚪';
}

// ─── EXPORT FUNCTIONS ─────────────────────────────────────────
function exportCaseReport(caseNum){
  const ci = CASES_COMPACT[caseNum];
  if(!ci){ alert('Дані справи не знайдено'); return; }
  const vm = verdictMeta(ci.v);
  const assets = getCaseAssets(caseNum);
  const dt = new Date().toLocaleDateString('uk-UA');
  const bycat = {};
  assets.forEach(r=>{ const c=r._cat||'other'; bycat[c]=(bycat[c]||[]); bycat[c].push(r); });

  let tablesHtml = Object.entries(bycat).map(([cat,recs])=>`
    <h3 style="margin:16px 0 8px;font-size:14px;color:#374151">${CAT_ICONS[cat]} ${CAT_LABELS[cat]} (${recs.length})</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">ID активу</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Опис</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Адреса</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Стан арешту</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Зона</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Власник</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Кадастр.</th>
      </tr></thead>
      <tbody>
        ${recs.map(r=>`<tr>
          <td style="padding:4px 8px;border:1px solid #f1f5f9;font-family:monospace;font-size:10px;white-space:nowrap">${r.id}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9;max-width:200px">${(r.desc||r.type||'—').slice(0,120)}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.addr||r.city||'—').slice(0,80)}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9;white-space:nowrap">${r.arr||'—'}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${r.zone||'—'}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.own||'—').slice(0,60)}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9;font-family:monospace;font-size:9px">${r.kadastr||'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`).join('');

  const html = `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8">
<title>Справа № ${caseNum} — АРМА</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:1100px;margin:auto}
h1{font-size:18px;font-weight:800;color:#1a3ea8;border-bottom:3px solid #1a3ea8;padding-bottom:8px;margin-bottom:16px}
.verdict{display:inline-block;padding:5px 14px;border-radius:20px;font-weight:700;font-size:14px;margin-bottom:14px}
.meta{display:grid;grid-template-columns:auto 1fr;gap:5px 16px;margin-bottom:18px;font-size:12px}
.meta .lbl{color:#6b7280;font-weight:600}
.meta .val{color:#111}
.foot{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body>
<h1>⚖ Звіт по судовій справі<br><span style="font-family:monospace;font-size:15px">${caseNum}</span></h1>
<div class="verdict" style="background:${vm.bg};color:${vm.color};border:2px solid ${vm.color}33">
  ${vm.icon} ${ci.v}
</div>
<div class="meta">
  <span class="lbl">Номер справи</span><span class="val" style="font-family:monospace;font-weight:700">${caseNum}</span>
  <span class="lbl">Вердикт</span><span class="val" style="color:${vm.color};font-weight:700">${ci.v}</span>
  ${(ci.dt||[]).length?`<span class="lbl">Дата(и) рішення</span><span class="val">${ci.dt.join(', ')}</span>`:''}
  ${(ci.vt||[]).length>1?`<span class="lbl">Дії в справі</span><span class="val">${ci.vt.join(' · ')}</span>`:''}
  <span class="lbl">Всього активів</span><span class="val" style="font-weight:700">${assets.length}</span>
  <span class="lbl">Дата звіту</span><span class="val">${dt}</span>
</div>
${tablesHtml}
<div class="foot">Документ сформовано автоматично системою АРМА · ${dt}</div>
</body></html>`;

  const blob = new Blob([html],{type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`ARMA_Справа_${caseNum.replace(/[\/\-]/g,'_')}.html`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
}

function exportCaseCSV(caseNum){
  const assets = getCaseAssets(caseNum);
  const ci = CASES_COMPACT[caseNum];
  const rows = [
    ['Справа №','Вердикт','Дата рішення'],
    [caseNum, ci?.v||'', (ci?.dt||[]).join('; ')],
    [],
    ['ID Активу','Категорія','Тип','Опис','Адреса','Стан арешту','Зонування','Власник','Кадастр. №'],
    ...assets.map(r=>[
      r.id, CAT_LABELS[r._cat]||r._cat, r.type||'',
      (r.desc||'').slice(0,100).replace(/\n/g,' '),
      r.addr||r.city||'',
      r.arr||'', r.zone||'', r.own||'', r.kadastr||'',
    ])
  ];
  const csv = rows.map(row=>row.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`ARMA_Справа_${caseNum.replace(/[\/\-]/g,'_')}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
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
  const csv = rows.map(row=>row.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const dt = new Date().toISOString().slice(0,10);
  a.href=url; a.download=`ARMA_Всі_справи_${dt}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
}

// ─── CONTROLLER ───────────────────────────────────────────────
const CASESP2 = {
  _tmr: null,
  onInput(v){ clearTimeout(this._tmr); this._tmr=setTimeout(()=>renderCasesPage({q:v,pg:0}),280); },
  clear(){ renderCasesPage({q:'',pg:0}); setTimeout(()=>{const el=document.getElementById('cases-q-input');if(el){el.value='';el.focus();}},50); },
  setVerdict(v){ renderCasesPage({verdict:v,pg:0}); },
  pgChange(d){ const pg=Math.max(0,(window._casesPg||0)+d); renderCasesPage({pg}); },
  toggle(cn){
    window._openCaseId = window._openCaseId===cn ? null : cn;
    // Re-render just the clicked card efficiently
    const el=document.getElementById(`case-${cssId(cn)}`);
    if(!el) return;
    const ci=CASES_COMPACT[cn];
    el.outerHTML = renderCaseCard(cn,ci, window._openCaseId===cn);
    if(window._openCaseId===cn){
      setTimeout(()=>{
        const nel=document.getElementById(`case-${cssId(cn)}`);
        if(nel) nel.scrollIntoView({behavior:'smooth',block:'nearest'});
      },50);
    }
  },
  showOnMap(cn){
    // Navigate to realestate map with case filter
    if(typeof APP !== 'undefined'){
      APP.go('realestate');
      setTimeout(()=>{
        if(typeof ST !== 'undefined') ST.groupFilter='';
        // Use court case search
        if(typeof REMAP !== 'undefined'){
          // Filter by court_cases containing this case num
          // This needs special handling in flt()
          window._mapCaseFilter = cn;
          REMAP.render();
        }
      },300);
    }
  },
  openCase(cn){
    window._openCaseId = cn;
    window._casesQ = cn;  // set search to this case
    renderCasesPage({q:cn, pg:0});
    setTimeout(()=>{
      const el=document.getElementById(`case-${cssId(cn)}`);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    },200);
  },
};
