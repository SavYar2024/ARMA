# Захист адмін-панелі — інструкція для чайника

## Проблема
GitHub Pages — це СТАТИЧНИЙ хостинг. Він не підтримує серверний пароль (.htaccess не працює). Тому `admin.html` доступний всім, хто знає URL.

## Рішення А: Прихована URL (найпростіше)

**Просто перейменуйте `admin.html`** у щось складне, наприклад:
```
admin-arma-2024-secure-7x9k.html
```
Ніхто не знатиме цю адресу. Це "security by obscurity" — не ідеально, але для початку достатньо.

**Як зробити:**
1. Перейменуйте файл у папці
2. Зробіть push на GitHub
3. Повідомте адміністраторам нову адресу

---

## Рішення Б: Netlify (безкоштовно, з паролем) — РЕКОМЕНДОВАНО

### Крок 1: Перенесіть сайт на Netlify
1. Зайдіть на [netlify.com](https://netlify.com) → Sign up (безкоштовно)
2. "Add new site" → "Import from GitHub"
3. Виберіть ваш репозиторій
4. Deploy → сайт публікується автоматично

### Крок 2: Додайте пароль на `admin.html`
Створіть файл `netlify.toml` у кореневій папці сайту:
```toml
[[redirects]]
  from = "/admin.html"
  to = "/.netlify/identity/login"
  status = 401
  conditions = {Role = ["admin"]}
```

**Або простіший спосіб — Password Protection:**
1. Netlify Dashboard → Site → Site settings
2. "Access control" → "Enable password protection"  
3. Введіть пароль
4. Збережіть

Тепер ВЕСЬ сайт буде під паролем. Якщо потрібно тільки `/admin.html` — використайте Netlify Identity (крок нижче).

### Крок 3: Netlify Identity для конкретних сторінок
1. Netlify Dashboard → "Identity" → "Enable Identity"
2. Settings → "Registration" → "Invite only"
3. Identity → "Invite users" → введіть email адміністраторів
4. Вони отримають запрошення і встановлять свій пароль

Додайте у `admin.html` перед `</body>`:
```html
<script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
<script>
  netlifyIdentity.on('init', user => {
    if (!user) { netlifyIdentity.open(); }
  });
  netlifyIdentity.on('logout', () => { window.location.href = '/'; });
</script>
```

---

## Рішення В: Cloudflare Pages + Access (безкоштовно)

1. Зайдіть на [cloudflare.com](https://cloudflare.com) → Pages
2. "Create a project" → підключіть GitHub
3. Deploy сайту
4. Cloudflare Dashboard → "Access" → "Applications"
5. "Add an application" → Self-hosted
   - Application domain: `ваш-домен.pages.dev/admin*`
   - Policy: Allow emails із вашого домену або конкретні адреси
6. Тепер при відкритті `/admin.html` буде запит email + одноразовий код

---

## Рішення Г: Apache хостинг (з .htpasswd)

Якщо ви хостите на Apache (cPanel, Timeweb, тощо):

### Крок 1: Створіть файл `.htpasswd`
На сервері (через SSH або cPanel File Manager):
```bash
htpasswd -c /var/www/.htpasswd admin
# Введіть пароль для користувача "admin"

htpasswd /var/www/.htpasswd olena
# Додати другого користувача без -c
```

### Крок 2: Створіть `.htaccess` у папці сайту
```apache
# Захист тільки admin.html
<Files "admin.html">
  AuthType Basic
  AuthName "ARMA Адміністрування"
  AuthUserFile /var/www/.htpasswd
  Require valid-user
</Files>
```

### Крок 3: Перевірте
Відкрийте `ваш-сайт.ua/admin.html` — браузер попросить логін та пароль.

---

## Важливо: Редагування в адмін-панелі НЕ змінює сайт автоматично

### Чому так відбувається?
Адмін-панель зберігає зміни тільки у localStorage вашого браузера. Публічний сайт читає JSON-файли з GitHub. Це два різних місця.

### Як публікувати зміни:

**Спосіб 1: Через Excel-файл**
1. В адмін-панелі: `⬇ Excel` — завантажте повну базу
2. Надайте файл технічному спеціалісту
3. Він запускає Python-скрипт → перегенеруються JSON-файли → push на GitHub → сайт оновлюється

**Спосіб 2: Пряме редагування JSON** (для технічних користувачів)
1. Відкрийте файл `realestate.json` на GitHub
2. Знайдіть потрібний запис (Ctrl+F по ID)
3. Відредагуйте
4. Commit changes → сайт оновлюється через 1-2 хвилини

**Спосіб 3: GitHub Actions (автоматизація)** — потребує налаштування розробника.

---

## Кілька адміністраторів — як організувати

При використанні Netlify Identity:
- Кожен адміністратор отримує запрошення на свій email
- Встановлює свій пароль
- Входить через Identity widget
- Зміни кожного зберігаються тільки в ЙОГО браузері

**Для спільної бази:** всі адміністратори використовують один і той самий браузер, або синхронізуються через Excel-файли.

