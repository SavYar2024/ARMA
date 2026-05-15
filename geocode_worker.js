/* ============================================================
   ARMA Geocode Worker — DISABLED
   Coordinates are pre-built from official databases:
   - GEO_CODING_BASE_WITH_ID.xlsx (geocoded addresses)
   - Все_кадастровые_номера_АРМА.xlsx (PKK exact coordinates)
   Runtime geocoding via Nominatim removed to avoid:
   - Wrong coordinates (city center instead of street level)
   - Rate limiting and slow load times
   - Inconsistent results
   ============================================================ */

// Stub functions to prevent errors if called
function geocodeBatch(data, cb){ if(cb) cb(0,0,'',true); }
function loadServerCache(){ return Promise.resolve(0); }
function loadGeoCache(){ return Promise.resolve(); }
function saveGeoCache(){ }
function applyGeoCache(data){ return data; }
