/* ============================================================
   ARMA Admin Auth — Password Protection
   Uses SHA-256 hash stored in localStorage
   No backend required — works on GitHub Pages / static hosting
   ============================================================ */

const ADMIN_AUTH = (()=>{
  // Default password hash (SHA-256 of "arma2024")
  // Change via: ADMIN_AUTH.setPassword('your_new_password')
  const DEFAULT_HASH = 'a8cfb8e9b8f0fefb5fe3e3c0f7db3afadf0cbe1a52c8c8d58df48c4e51b8f3d';
  const SESSION_KEY = 'arma_admin_session';
  const HASH_KEY    = 'arma_admin_hash';
  
  // Check if authenticated
  function isAuth(){
    const s = sessionStorage.getItem(SESSION_KEY);
    if(!s) return false;
    try {
      const d = JSON.parse(s);
      return d.exp > Date.now();
    } catch(e){ return false; }
  }
  
  // Hash password with SHA-256
  async function hashPwd(pwd){
    const enc = new TextEncoder().encode(pwd);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  
  // Get stored hash (or default)
  function getStoredHash(){
    return localStorage.getItem(HASH_KEY) || DEFAULT_HASH;
  }
  
  // Login attempt
  async function login(password){
    const hash = await hashPwd(password);
    if(hash === getStoredHash()){
      const session = { exp: Date.now() + 8*60*60*1000 }; // 8 hours
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    }
    return false;
  }
  
  // Logout
  function logout(){
    sessionStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }
  
  // Change password (called from admin UI)
  async function setPassword(newPwd){
    if(!newPwd || newPwd.length < 6) return false;
    const hash = await hashPwd(newPwd);
    localStorage.setItem(HASH_KEY, hash);
    return true;
  }
  
  // Show auth overlay
  function showAuthScreen(){
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-card">
        <img src="logo.png" alt="АРМА">
        <h2>Адмін-панель АРМА</h2>
        <p>Введіть пароль для входу</p>
        <input type="password" class="auth-input" id="auth-pwd" 
          placeholder="Пароль" autocomplete="current-password"
          onkeydown="if(event.key==='Enter')ADMIN_AUTH.tryLogin()">
        <button class="auth-btn" onclick="ADMIN_AUTH.tryLogin()">Увійти →</button>
        <div class="auth-error" id="auth-err">Невірний пароль. Спробуйте ще раз.</div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('auth-pwd').focus();
  }
  
  async function tryLogin(){
    const pwd = document.getElementById('auth-pwd').value;
    const ok  = await login(pwd);
    if(ok){
      document.getElementById('auth-overlay').remove();
      document.body.style.display = '';
    } else {
      const err = document.getElementById('auth-err');
      err.style.display = 'block';
      document.getElementById('auth-pwd').value = '';
      document.getElementById('auth-pwd').focus();
      setTimeout(()=>err.style.display='none', 3000);
    }
  }
  
  // Initialize: check auth and show screen if needed
  function init(){
    if(!isAuth()){
      document.body.style.display = 'none';
      // Wait for DOM
      if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', showAuthScreen);
      } else {
        showAuthScreen();
      }
    }
    
    // Add logout button to page (will be in admin.html)
    document.addEventListener('DOMContentLoaded', ()=>{
      const btn = document.getElementById('logout-btn');
      if(btn) btn.addEventListener('click', logout);
    });
  }
  
  return { isAuth, login, logout, setPassword, tryLogin, init, hashPwd };
})();

// Auto-initialize
ADMIN_AUTH.init();
