/* ============================================================
   ARMA Admin Auth — Password Protection v2
   Bulletproof version: works regardless of script loading order
   ============================================================ */

const ADMIN_AUTH = (()=>{
  // SHA-256 of "arma2024" — change via ADMIN_AUTH.setPassword('newpass')
  const DEFAULT_HASH = 'a8cfb8e9b8f0fefb5fe3e3c0f7db3afadf0cbe1a52c8c8d58df48c4e51b8f3d';
  const SESSION_KEY  = 'arma_admin_session';
  const HASH_KEY     = 'arma_admin_hash';
  
  function isAuth(){
    try {
      const s = sessionStorage.getItem(SESSION_KEY);
      if(!s) return false;
      const d = JSON.parse(s);
      return d && d.exp > Date.now();
    } catch(e){ return false; }
  }
  
  async function hashPwd(pwd){
    const enc = new TextEncoder().encode(pwd);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  
  function getStoredHash(){
    return localStorage.getItem(HASH_KEY) || DEFAULT_HASH;
  }
  
  async function login(password){
    const hash = await hashPwd(password);
    if(hash === getStoredHash()){
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ exp: Date.now() + 8*60*60*1000 }));
      return true;
    }
    return false;
  }
  
  function logout(){
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }
  
  async function setPassword(newPwd){
    if(!newPwd || newPwd.length < 6){ alert('Мінімум 6 символів'); return false; }
    const hash = await hashPwd(newPwd);
    localStorage.setItem(HASH_KEY, hash);
    alert('Пароль змінено успішно!');
    return true;
  }
  
  function showAuthScreen(){
    // Remove any existing overlay
    const existing = document.getElementById('auth-overlay');
    if(existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:linear-gradient(135deg,#eef2fb 0%,#f4f6fc 50%,#ede9f8 100%);
      display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;
    `;
    overlay.innerHTML = `
      <div style="width:380px;padding:36px;border-radius:20px;background:#fff;
        box-shadow:0 20px 60px rgba(11,18,32,.15);border:1.5px solid rgba(255,255,255,.9);text-align:center">
        <div style="font-size:48px;margin-bottom:12px">🛡</div>
        <h2 style="font-size:20px;font-weight:800;color:#1a3ea8;margin:0 0 6px">Адмін-панель АРМА</h2>
        <p style="font-size:13px;color:#64748b;margin:0 0 24px">Введіть пароль для доступу</p>
        <input type="password" id="auth-pwd-input" autocomplete="current-password"
          placeholder="Пароль"
          style="width:100%;padding:12px 16px;border-radius:10px;border:1.5px solid #e2e8f0;
            font-size:15px;outline:none;box-sizing:border-box;margin-bottom:12px;
            font-family:inherit;transition:border .15s"
          onfocus="this.style.borderColor='#1a56db'"
          onblur="this.style.borderColor='#e2e8f0'"
          onkeydown="if(event.key==='Enter') ADMIN_AUTH.tryLogin()">
        <button onclick="ADMIN_AUTH.tryLogin()"
          style="width:100%;padding:12px;border-radius:10px;border:none;
            background:#1a56db;color:#fff;font-size:15px;font-weight:700;
            cursor:pointer;font-family:inherit;transition:background .15s"
          onmouseover="this.style.background='#1640b8'"
          onmouseout="this.style.background='#1a56db'">
          Увійти →
        </button>
        <div id="auth-error" style="display:none;margin-top:12px;color:#dc2626;font-size:13px;
          padding:8px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca">
          ❌ Невірний пароль. Спробуйте ще раз.
        </div>
      </div>`;
    document.body.appendChild(overlay);
    
    // Focus input after render
    setTimeout(()=>{
      const inp = document.getElementById('auth-pwd-input');
      if(inp) inp.focus();
    }, 50);
  }
  
  async function tryLogin(){
    const inp = document.getElementById('auth-pwd-input');
    if(!inp) return;
    const pwd = inp.value.trim();
    if(!pwd) return;
    
    const ok = await login(pwd);
    if(ok){
      const overlay = document.getElementById('auth-overlay');
      if(overlay) overlay.remove();
    } else {
      inp.value = '';
      inp.focus();
      const err = document.getElementById('auth-error');
      if(err){
        err.style.display = 'block';
        setTimeout(()=>{ err.style.display='none'; }, 3000);
      }
    }
  }
  
  function init(){
    // Check auth status
    if(isAuth()) return; // Already authenticated, show page normally
    
    // Not authenticated - show auth overlay when DOM is ready
    function showWhenReady(){
      if(document.body){
        showAuthScreen();
      } else {
        // Body not ready yet, wait
        document.addEventListener('DOMContentLoaded', showAuthScreen, {once:true});
      }
    }
    
    showWhenReady();
  }
  
  return { isAuth, login, logout, setPassword, tryLogin, init, hashPwd, showAuthScreen };
})();

// Initialize immediately
ADMIN_AUTH.init();
