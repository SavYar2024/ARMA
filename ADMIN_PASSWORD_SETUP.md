# ARMA Admin Panel — Password Setup Guide
# Інструкція встановлення паролю адміністратора

## Як це працює

Система використовує SHA-256 хешування паролю.
Пароль зберігається в localStorage браузера у вигляді хешу (не відкритого тексту).
Сесія діє 8 годин після входу.

## Дефолтний пароль

Стандартний пароль при першому запуску:
```
arma2024
```

## Як змінити пароль (Спосіб 1 — через браузер)

1. Відкрийте admin.html у браузері
2. Введіть поточний пароль (arma2024)
3. У консолі браузера (F12 → Console) виконайте:

```javascript
ADMIN_AUTH.setPassword('ВАШ_НОВИЙ_ПАРОЛЬ')
  .then(ok => console.log(ok ? 'Пароль змінено' : 'Помилка'));
```

4. Пароль збережено в localStorage цього браузера.

## Як змінити пароль (Спосіб 2 — постійно для всіх)

1. Відкрийте консоль браузера на сторінці admin.html
2. Виконайте:
```javascript
// Отримати хеш нового паролю
const pwd = 'ВАШ_ПАРОЛЬ';
const enc = new TextEncoder().encode(pwd);
crypto.subtle.digest('SHA-256', enc).then(buf => {
  const hash = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2,'0')).join('');
  console.log('Ваш хеш:', hash);
});
```
3. Скопіюйте хеш
4. Відкрийте файл `admin_auth.js`
5. Знайдіть рядок `const DEFAULT_HASH = '...'`
6. Замініть на ваш хеш
7. Збережіть файл та оновіть на GitHub

## Кілька адміністраторів

Зараз система підтримує один спільний пароль.
Якщо потрібно декілька — рекомендуємо Netlify Identity (безкоштовно).

## Виробничий деплой з паролем

### Netlify (найпростіше):
1. Перейдіть на netlify.com → Sign up
2. Add new site → Import from GitHub
3. Site settings → Site access → Password protection
4. Введіть пароль → Save

Весь сайт буде захищений. Для захисту ТІЛЬКИ admin.html:

Створіть файл `netlify.toml` в корені проекту:
```toml
[[redirects]]
  from = "/admin.html"
  to = "https://your-site.netlify.app/admin.html"
  status = 200
  headers = {X-Auth-Required = "true"}
```

### Apache (.htaccess):
```apache
<Files "admin.html">
  AuthType Basic
  AuthName "ARMA Admin"
  AuthUserFile /path/to/.htpasswd
  Require valid-user
</Files>
```

Створити .htpasswd:
```bash
htpasswd -c /path/to/.htpasswd admin
# Введіть пароль
```

### Nginx:
```nginx
location = /admin.html {
  auth_basic "ARMA Admin";
  auth_basic_user_file /etc/nginx/.htpasswd;
}
```

## Примітки безпеки

- Ця система захисту CLIENT-SIDE, підходить для внутрішнього використання
- Для максимальної безпеки використовуйте серверну авторизацію (Netlify/Apache/Nginx)
- Ніколи не публікуйте хеш паролю у публічному GitHub репозиторії
- Регулярно змінюйте пароль

## Відновлення доступу

Якщо забули пароль:
1. Відкрийте консоль браузера (F12)
2. Виконайте: `localStorage.removeItem('arma_admin_hash')`
3. Перезавантажте сторінку — буде використано дефолтний пароль `arma2024`
