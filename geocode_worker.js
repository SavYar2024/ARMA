/* ============================================================
   ARMA Geocode Worker
   Runs in background: fetches Nominatim for each unique address
   Saves results to localStorage → geocode_cache_v2
   ============================================================ */

const GEO_CACHE_KEY = 'arma_geocache_v2';
let geoCache = {};
let workerRunning = false;
let workerQueue = [];
let workerDone = 0;
let workerTotal = 0;
let onProgressCb = null;

function loadGeoCache(){
  try {
    geoCache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY)||'{}');
  } catch(e){ geoCache={}; }
  return geoCache;
}

function saveGeoCache(){
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCache)); } catch(e){}
}

function getFromCache(query){
  return geoCache[query] || null;
}

function applyGeoCache(records){
  let applied = 0;
  records.forEach(r=>{
    const q = r.gq || buildQuery(r);
    if(!q) return;
    const cached = geoCache[q];
    if(cached && cached.lat){
      r._lat = cached.lat;
      r._lng = cached.lng;
      r._geo_quality = 'geocoded';
      applied++;
    }
  });
  return applied;
}

function buildQuery(r){
  const parts = [];
  if(r.street && r.house) parts.push(`${r.street} ${r.house}`);
  else if(r.street) parts.push(r.street);
  if(r.city) parts.push(r.city);
  else if(r.oblast) parts.push(r.oblast.replace(/ область$/,'').replace(/^м\. /,''));
  if(parts.length) parts.push('Україна');
  return parts.join(', ');
}

function getBestCoords(r){
  if(r._lat) return [r._lat, r._lng, 'geocoded'];
  return [r.lat, r.lng, r.geo_quality||'fallback'];
}

async function geocodeBatch(records, onProgress){
  if(workerRunning) return;
  workerRunning = true;
  onProgressCb = onProgress;
  
  loadGeoCache();
  
  // Build queue of unique uncached queries
  const seen = new Set();
  workerQueue = [];
  
  records.forEach(r=>{
    const q = r.gq || buildQuery(r);
    if(!q || seen.has(q) || geoCache[q]) return;
    seen.add(q);
    workerQueue.push({query: q, ids: []});
  });
  
  // Add record IDs to each query
  records.forEach(r=>{
    const q = r.gq || buildQuery(r);
    const entry = workerQueue.find(e=>e.query===q);
    if(entry) entry.ids.push(r.id||r.kadastr||'');
  });
  
  workerTotal = workerQueue.length;
  workerDone = 0;
  
  if(workerTotal === 0){
    workerRunning = false;
    onProgress && onProgress(0, 0, 'Кеш актуальний ✓', true);
    return;
  }
  
  for(const item of workerQueue){
    if(onProgressCb) onProgressCb(workerDone, workerTotal, `Геокод: ${item.query.slice(0,50)}…`, false);
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(item.query)}&accept-language=uk&countrycodes=ua,es,de,fr,gb`;
      const resp = await fetch(url, {
        headers: {'User-Agent': 'ARMA-Registry/1.0 (Ukraine Asset Management)'}
      });
      if(resp.ok){
        const data = await resp.json();
        if(data && data.length){
          const result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            display: data[0].display_name,
            type: data[0].type,
          };
          geoCache[item.query] = result;
          // Apply to records immediately
          records.forEach(r=>{
            const q = r.gq || buildQuery(r);
            if(q === item.query){
              r._lat = result.lat;
              r._lng = result.lng;
              r._geo_quality = 'geocoded';
            }
          });
        } else {
          // Mark as failed to avoid retrying
          geoCache[item.query] = {lat: null, lng: null, failed: true};
        }
      }
    } catch(e){
      // Network error - stop worker
      console.warn('Geocoding stopped:', e.message);
      break;
    }
    
    workerDone++;
    if(workerDone % 10 === 0) saveGeoCache();
    
    // Rate limit: 1 req/sec for Nominatim compliance
    await new Promise(res => setTimeout(res, 1100));
  }
  
  saveGeoCache();
  workerRunning = false;
  if(onProgressCb) onProgressCb(workerDone, workerTotal, `Геокодування: ${workerDone}/${workerTotal} ✓`, true);
}

// Export geocache as downloadable JSON (for committing to repo)
function exportGeoCache(){
  const data = loadGeoCache();
  const valid = Object.fromEntries(Object.entries(data).filter(([k,v])=>v.lat));
  const json = JSON.stringify(valid, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'geocode_cache.json';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);}, 500);
  return Object.keys(valid).length;
}

// Import geocache from uploaded JSON file
function importGeoCache(jsonData){
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    loadGeoCache();
    let added = 0;
    Object.entries(data).forEach(([k,v])=>{
      if(!geoCache[k] && v.lat){ geoCache[k] = v; added++; }
    });
    saveGeoCache();
    return added;
  } catch(e){ return 0; }
}

// Load pre-built geocache from server (geocode_cache.json)
async function loadServerCache(){
  try {
    const resp = await fetch('geocode_cache.json');
    if(!resp.ok) return 0;
    const data = await resp.json();
    loadGeoCache();
    let added = 0;
    Object.entries(data).forEach(([k,v])=>{
      if(v.lat){ geoCache[k] = v; added++; }
    });
    saveGeoCache();
    return added;
  } catch(e){ return 0; }
}
