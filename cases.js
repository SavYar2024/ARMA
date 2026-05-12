/* ============================================================
   ARMA cases.js v3 — Court Cases Module
   Fixes:
   1. Click on case number → shows assets for THAT case only
   2. Group case numbers as dropdown → select opens asset list
   3. Click on asset → opens that asset's card
   4. PDF report per case
   5. Search correctly finds case numbers
   ============================================================ */
'use strict';

let CASES_COMPACT = null;
let _casesQ = '';
let _casesVerdict = 'all';
let _casesPg = 0;
let _openCaseId = null;

const VERDICT_META = {
  'Спеціальна конфіскація':     {icon:'⚖', color:'#8b5cf6', bg:'rgba(139,92,246,.1)'},
  'Стягнення в дохід держави':  {icon:'💰',color:'#10b981', bg:'rgba(16,185,129,.1)'},
  'Конфіскація':                {icon:'🏛',color:'#059669', bg:'rgba(5,150,105,.1)'},
  'Передача в управління АРМА': {icon:'🔑',color:'#1a56db', bg:'rgba(26,86,219,.1)'},
  'Накладення арешту':          {icon:'⚔',color:'#f97316', bg:'rgba(249,115,22,.1)'},
  'Скасування арешту':          {icon:'🔓',color:'#6b7280', bg:'rgba(107,114,128,.1)'},
  'Скасування передачі':       {icon:'↩',color:'#ef4444', bg:'rgba(239,68,68,.1)'},
  'Звернення стягнення':       {icon:'📜',color:'#d97706', bg:'rgba(217,119,6,.1)'},
  'Націоналізація':             {icon:'🏛',color:'#7c3aed', bg:'rgba(124,58,237,.1)'},
  'Судове рішення':             {icon:'⚖',color:'#64748b', bg:'rgba(100,116,139,.1)'},
};
function verdictMeta(v){ return VERDICT_META[v]||{icon:'⚖',color:'#64748b',bg:'rgba(100,116,139,.1)'}; }

const CAT_LABELS = {realestate:'Нерухомість',land:'Земля',transport:'Транспорт',corp:'Корп. права',money:'Кошти',movable:'Рухоме',other:'Інше'};
const CAT_ICONS  = {realestate:'🏢',land:'🌾',transport:'🚗',corp:'📊',money:'💰',movable:'📦',other:'🗂'};

function cssId(s){ return 'c'+String(s).replace(/[^a-zA-Z0-9]/g,'_'); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(n){ return Number(n||0).toLocaleString('uk-UA'); }

// ── Load cases_compact.json ───────────────────────────────────
async function loadCasesCompact(){
  if(CASES_COMPACT) return CASES_COMPACT;
  const r = await fetch('cases_compact.json');
  if(!r.ok) throw new Error('Cannot load cases_compact.json');
  CASES_COMPACT = await r.json();
  return CASES_COMPACT;
}

// ── Get assets for a case from in-memory CACHE ────────────────
function getCaseAssets(caseNum){
  const DATA_CATS = ['realestate','land','transport','corp','money','movable','other'];
  const results = [];
  DATA_CATS.forEach(k=>{
    const data = (typeof CACHE !== 'undefined' ? CACHE[k+'.json'] : null)||[];
    data.forEach(r=>{
      if((r.court_cases||[]).includes(caseNum)){
        results.push({...r, _cat:k});
      }
    });
  });
  return results;
}

// ── MAIN RENDER ───────────────────────────────────────────────
async function renderCasesPage(params={}){
  const wrap = document.getElementById('cases-content');
  if(!wrap) return;

  try { await loadCasesCompact(); }
  catch(e){
    wrap.innerHTML=`<div class="search-wrap-page"><div class="no-results" style="padding:40px">
      ⚠ Помилка завантаження справ: ${esc(e.message)}</div></div>`;
    return;
  }

  if(params.q       !== undefined) _casesQ       = params.q;
  if(params.verdict !== undefined) _casesVerdict  = params.verdict;
  if(params.pg      !== undefined) _casesPg       = params.pg;

  const ps = 30;
  const allEntries = Object.entries(CASES_COMPACT);

  // ── Filter ────────────────────────────────────────────────
  // FIX 5: search must match the case NUMBER itself (key), not just metadata
  let entries = allEntries;
  if(_casesQ){
    const ql = _casesQ.toLowerCase().trim();
    entries = entries.filter(([cn,ci])=>
      (cn||'').toLowerCase().includes(ql) ||
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

  // Verdict distribution for filter pills
  const verdictCounts = {};
  allEntries.forEach(([,ci])=>{ verdictCounts[ci.v]=(verdictCounts[ci.v]||0)+1; });
  const sortedVerdicts = Object.entries(verdictCounts).sort((a,b)=>b[1]-a[1]);

  wrap.innerHTML = `
<div class="search-wrap-page cases-wrap-full">
  <div class="cases-page-header">
    <div style="flex:1">
      <h2>⚖ Судові справи</h2>
      <p>Пошук за реальним номером справи · <b>${fmt(allEntries.length)}</b> унікальних справ</p>
      <div style="margin-top:8px;padding:8px 12px;background:rgba(26,86,219,.06);border-radius:8px;
        border-left:3px solid var(--blue);font-size:11.5px;color:var(--ink3)">
        💡 Номер справи — реальний номер судового провадження, наприклад
        <span style="font-family:monospace;font-weight:600">757/3035/19-к</span>.
        Введіть номер у пошук — система знайде всі пов'язані активи.
      </div>
    </div>
    <button class="dp-btn primary" onclick="exportAllCasesReport()"
      style="flex-shrink:0;align-self:flex-start;margin-top:4px">
      📊 CSV всіх справ
    </button>
  </div>

  <div class="cases-search-bar">
    <div class="search-input-wrap" style="flex:1;max-width:560px">
      <span class="search-inp-icon">🔍</span>
      <input type="text" class="search-page-input" id="cases-q-input"
        placeholder="Номер справи (напр. 757/3035/19-к) або тип вердикту..."
        value="${esc(_casesQ)}" oninput="CASESP2.onInput(this.value)">
      ${_casesQ?`<button class="search-clear-btn" onclick="CASESP2.clear()">✕</button>`:''}
    </div>
  </div>

  <div class="cases-verdict-filters">
    <span class="f-lbl" style="width:auto;margin:0;align-self:center">Вердикт:</span>
    <button class="fbtn ${_casesVerdict==='all'?'active':''}"
      onclick="CASESP2.setVerdict('all')">Всі (${fmt(allEntries.length)})</button>
    ${sortedVerdicts.map(([v,c])=>{
      const vm=verdictMeta(v);
      return `<button class="fbtn ${_casesVerdict===v?'active':''}"
        style="${_casesVerdict===v?`background:${vm.color};border-color:${vm.color};color:#fff`:''}"
        onclick="CASESP2.setVerdict('${v.replace(/'/g,"\\'")}')">
        ${vm.icon} ${v.replace(' АРМА','').trim()} (${fmt(c)})
      </button>`;
    }).join('')}
  </div>

  ${total===0&&_casesQ?`<div class="no-results" style="padding:24px">
    Справу <b>${esc(_casesQ)}</b> не знайдено.
    Перевірте формат: напр. <span style="font-family:monospace">757/3035/19-к</span>
  </div>`:
  `<div class="cases-results-info">
    Знайдено: <b>${fmt(total)}</b> справ
    ${total>0?`· ${fmt(entries.slice(0,total).reduce((s,[,ci])=>s+ci.n,0))} активів`:''}
  </div>`}

  <div class="cases-list" id="cases-list-inner">
    ${items.length ? items.map(([cn,ci])=>renderCaseCard(cn,ci)).join('') :
      (total>0?'<div class="no-results">Справ не знайдено</div>':'')}
  </div>

  ${total>ps?`<div class="search-pgn">
    <button class="pgn-btn" ${_casesPg===0?'disabled':''} onclick="CASESP2.pgChange(-1)">← Попер.</button>
    <span>${_casesPg+1}/${pages} · ${fmt(total)} справ</span>
    <button class="pgn-btn" ${_casesPg>=pages-1?'disabled':''} onclick="CASESP2.pgChange(1)">Наст. →</button>
  </div>`:''}
</div>`;

  // Auto-open if requested
  if(_openCaseId){
    setTimeout(()=>{ CASESP2.toggle(_openCaseId); _openCaseId=null; }, 100);
  }
}

// ── RENDER ONE CASE CARD ──────────────────────────────────────
function renderCaseCard(cn, ci, forceExpanded=false){
  const vm = verdictMeta(ci.v);
  const catBreakdown = Object.entries(ci.cc||{})
    .map(([k,n])=>`<span class="case-cat-pill">${CAT_ICONS[k]||'📋'} ${CAT_LABELS[k]||k}: <b>${n}</b></span>`).join('');
  const isOpen = forceExpanded || (_openCaseId===cn);

  let expandedHtml = '';
  if(isOpen){
    const assets = getCaseAssets(cn);
    expandedHtml = renderCaseExpanded(cn, ci, assets);
  }

  return `
<div class="case-card ${isOpen?'case-card-open':''}" id="${cssId(cn)}">
  <div class="case-card-head" onclick="CASESP2.toggle('${cn.replace(/'/g,"\\'")}')">
    <div class="case-verdict-badge" style="background:${vm.bg};color:${vm.color};border:1px solid ${vm.color}33">
      ${vm.icon} ${esc(ci.v)}
    </div>
    <div class="case-num-row">
      <span class="case-num">№ <span style="font-family:monospace">${esc(cn)}</span></span>
      <span class="case-asset-count">${fmt(ci.n)} активів</span>
      ${(ci.dt||[]).length?`<span class="case-dates">📅 ${ci.dt.slice(0,2).join(', ')}</span>`:''}
    </div>
    <div class="case-cats-row">${catBreakdown}</div>
    <div class="case-chevron">${isOpen?'▲':'▼'}</div>
  </div>
  ${expandedHtml}
</div>`;
}

// ── RENDER EXPANDED CASE ──────────────────────────────────────
function renderCaseExpanded(cn, ci, assets){
  const vm = verdictMeta(ci.v);
  const bycat = {};
  assets.forEach(r=>{ const c=r._cat||'other'; (bycat[c]=bycat[c]||[]).push(r); });

  return `
<div class="case-expanded">
  <div class="case-expanded-header">
    <div class="case-summary">
      <div class="case-summary-item">
        <span class="cs-lbl">Справа №</span>
        <span class="cs-val" style="font-family:monospace;font-size:14px;font-weight:700">${esc(cn)}</span>
      </div>
      <div class="case-summary-item">
        <span class="cs-lbl">Вердикт</span>
        <span class="cs-val" style="color:${vm.color};font-weight:700">${vm.icon} ${esc(ci.v)}</span>
      </div>
      ${(ci.dt||[]).length?`<div class="case-summary-item">
        <span class="cs-lbl">Дата(и)</span><span class="cs-val">${ci.dt.join(', ')}</span>
      </div>`:''}
      ${(ci.vt||[]).length>1?`<div class="case-summary-item">
        <span class="cs-lbl">Дії в справі</span>
        <span class="cs-val" style="font-size:11px">${ci.vt.join(' · ')}</span>
      </div>`:''}
      <div class="case-summary-item">
        <span class="cs-lbl">Активів</span>
        <span class="cs-val" style="font-weight:700">${fmt(assets.length)}</span>
      </div>
    </div>
    <div class="case-actions-row">
      <button class="dp-btn primary" onclick="exportCaseReport('${cn.replace(/'/g,"\\'")}')">📄 PDF-звіт</button>
      <button class="dp-btn" onclick="exportCaseCSV('${cn.replace(/'/g,"\\'")}')">📊 CSV</button>
    </div>
  </div>

  ${Object.entries(bycat).map(([cat,recs])=>`
    <div class="case-cat-section">
      <div class="case-cat-header">${CAT_ICONS[cat]} ${CAT_LABELS[cat]}
        <span class="case-cat-cnt">${recs.length}</span>
      </div>
      <div class="case-assets-list">
        ${recs.map(r=>{
          const loc = r.addr||r.city||r.oblast||'—';
          const val = r.value?`${fmt(parseFloat(r.value)||0)} ${r.currency||'грн'}`:'';
          const zone = r.zone?`<span class="zone-pill zone-${r.zone.includes('Жовт')?'yellow':r.zone.includes('Черв')?'red':r.zone.includes('Синя')?'blue':'grey'}" style="font-size:9px">${r.zone.replace(' зона','')}</span>`:'';
          return `
          <div class="case-asset-item" onclick="event.stopPropagation();APP.goToRecord('${esc(r.id)}','${cat}')"
            title="Відкрити картку активу">
            <div class="cai-top">
              <span class="cai-id">${esc(r.id)}</span>
              <span class="badge ${arrBadgeClass(r.arr)}" style="font-size:9px">${esc(r.arr||'—')}</span>
              ${zone}
              ${val?`<span class="cai-val">${val}</span>`:''}
              <span class="cai-arrow">→</span>
            </div>
            <div class="cai-desc">${esc((r.desc||r.type||'—').slice(0,120))}</div>
            ${loc!=='—'?`<div class="cai-loc">📍 ${esc(loc.slice(0,80))}</div>`:''}
            ${cat==='land'&&r.kadastr?`<div class="cai-kad">📋 ${esc(r.kadastr)}</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`).join('')}
</div>`;
}

// ── EXPORT FUNCTIONS ──────────────────────────────────────────
function exportCaseReport(caseNum){
  const ci = CASES_COMPACT?.[caseNum];
  if(!ci){ alert('Дані справи не знайдено'); return; }
  const vm = verdictMeta(ci.v);
  const assets = getCaseAssets(caseNum);
  const dt = new Date().toLocaleDateString('uk-UA');
  const bycat = {};
  assets.forEach(r=>{ const c=r._cat||'other'; (bycat[c]=bycat[c]||[]).push(r); });

  const tablesHtml = Object.entries(bycat).map(([cat,recs])=>`
    <h3 style="margin:16px 0 8px;font-size:13px;color:#374151">${CAT_ICONS[cat]} ${CAT_LABELS[cat]} (${recs.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">ID активу</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Опис</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Адреса</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Стан арешту</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Зона</th>
        <th style="padding:5px 8px;border:1px solid #e5e7eb;text-align:left">Власник</th>
      </tr></thead>
      <tbody>
        ${recs.map(r=>`<tr>
          <td style="padding:4px 8px;border:1px solid #f1f5f9;font-family:monospace;font-size:9.5px">${r.id}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.desc||r.type||'—').slice(0,100)}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.addr||r.city||'—').slice(0,80)}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${r.arr||'—'}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${r.zone||'—'}</td>
          <td style="padding:4px 8px;border:1px solid #f1f5f9">${(r.own||'—').slice(0,60)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`).join('');

  const html = `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8">
<title>Справа № ${caseNum} — АРМА</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:1100px;margin:auto}
h1{font-size:18px;font-weight:800;color:#1a3ea8;border-bottom:3px solid #1a3ea8;padding-bottom:8px;margin-bottom:16px}
.verdict{display:inline-block;padding:5px 14px;border-radius:20px;font-weight:700;font-size:14px;margin-bottom:14px}
.meta{display:grid;grid-template-columns:160px 1fr;gap:5px 16px;margin-bottom:18px}
.meta .lbl{color:#6b7280;font-weight:600}
.meta .val{color:#111}
.foot{margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
</style></head><body>
<h1>⚖ Звіт по судовій справі</h1>
<div class="verdict" style="background:${vm.bg};color:${vm.color};border:2px solid ${vm.color}33">
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
${tablesHtml}
<div class="foot">Документ сформовано автоматично · АРМА України · ${dt}</div>
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
  const ci = CASES_COMPACT?.[caseNum];
  const rows = [
    ['Справа №','Вердикт','Дата рішення'],
    [caseNum, ci?.v||'', (ci?.dt||[]).join('; ')],
    [],
    ['ID Активу','Категорія','Тип','Опис','Адреса','Стан арешту','Зонування','Власник','Кадастр. №'],
    ...assets.map(r=>[
      r.id, CAT_LABELS[r._cat]||r._cat, r.type||'',
      (r.desc||'').slice(0,100).replace(/\n/g,' '),
      r.addr||r.city||'', r.arr||'', r.zone||'', r.own||'', r.kadastr||'',
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
  const dt   = new Date().toISOString().slice(0,10);
  const a    = document.createElement('a');
  a.href=url; a.download=`ARMA_Всі_справи_${dt}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},500);
}

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

// ── CONTROLLER ────────────────────────────────────────────────
const CASESP2 = {
  _tmr: null,
  onInput(v){
    clearTimeout(this._tmr);
    this._tmr = setTimeout(()=>renderCasesPage({q:v, pg:0}), 250);
  },
  clear(){
    _casesQ=''; renderCasesPage({q:'', pg:0});
    setTimeout(()=>{ const el=document.getElementById('cases-q-input'); if(el){el.value='';el.focus();} },50);
  },
  setVerdict(v){ renderCasesPage({verdict:v, pg:0}); },
  pgChange(d){ renderCasesPage({pg: Math.max(0, _casesPg+d)}); },
  toggle(cn){
    _openCaseId = _openCaseId===cn ? null : cn;
    // Re-render just this card efficiently
    const el = document.getElementById(cssId(cn));
    if(!el) return;
    const ci = CASES_COMPACT?.[cn];
    if(!ci) return;
    el.outerHTML = renderCaseCard(cn, ci, _openCaseId===cn);
    if(_openCaseId===cn){
      setTimeout(()=>{
        const nel = document.getElementById(cssId(cn));
        if(nel) nel.scrollIntoView({behavior:'smooth', block:'nearest'});
      },50);
    }
  },
  openCase(cn){
    // Called from asset detail panels when user clicks a case number pill
    _openCaseId = cn;
    _casesQ = cn;
    renderCasesPage({q:cn, pg:0});
    setTimeout(()=>{
      const el = document.getElementById(cssId(cn));
      if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    }, 300);
  },
};


function exportCaseReport(caseNum){
  const assets = getCaseAssets(caseNum);
  const html = `
  <html>
  <head>
  <title>${caseNum}</title>
  <style>
    body{font-family:Arial;padding:24px}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ccc;padding:8px;font-size:12px}
  </style>
  </head>
  <body>
    <h2>Судова справа № ${caseNum}</h2>
    <table>
      <tr>
        <th>ID</th>
        <th>Категорія</th>
        <th>Адреса / Опис</th>
      </tr>
      ${assets.map(a=>`
      <tr>
        <td>${a.id||''}</td>
        <td>${a._cat||''}</td>
        <td>${a.addr||a.desc||''}</td>
      </tr>`).join('')}
    </table>
  </body>
  </html>`;
  const w = window.open('');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=>window.print(),700);
}
