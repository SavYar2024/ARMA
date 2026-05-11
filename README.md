# АРМА — Реєстр арештованих активів

> Інтерактивна карта активів АРМА з фільтрацією, кадастровими ділянками та детальними картками об'єктів

## 🌐 Тестовий запуск на GitHub Pages

### Крок 1 — Завантажити на GitHub

```bash
# Якщо є Git встановлено локально:
git init
git add .
git commit -m "ARMA assets registry v1"
git remote add origin https://github.com/ВАШ_ЛОГІН/arma-assets.git
git push -u origin main
```

**Або через браузер (без Git):**
1. Зайдіть на [github.com](https://github.com) → **Sign in**
2. Натисніть **«+»** → **«New repository»**
3. Назва: `arma-assets` → **Create repository**
4. Натисніть **«uploading an existing file»**
5. Перетягніть **всі файли** з архіву → **Commit changes**

> ⚠️ Файли великі (transport.json = 15 MB) — завантаження може зайняти 2-5 хвилин

### Крок 2 — Увімкнути GitHub Pages

1. У репозиторії → **Settings** (вкладка вгорі)
2. Ліве меню → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / **(root)**
5. Натисніть **Save**
6. Через ~2 хвилини сайт буде доступний за адресою:
   `https://ВАШ_ЛОГІН.github.io/arma-assets/`

---

## 📁 Склад файлів

| Файл | Опис |
|------|------|
| `index.html` | Головна сторінка |
| `style.css` | Glass-дизайн |
| `app.js` | JavaScript логіка |
| `logo.png` | Логотип АРМА |
| `stats.json` | Загальна статистика |
| `realestate.json` | Нерухомість (4 388 об.) |
| `land.json` | Земельні ділянки (4 718 з кадастром) |
| `transport.json` | Транспорт (27 928 об.) |
| `corp.json` | Корпоративні права |
| `money.json` | Грошові кошти |
| `movable.json` | Інше рухоме майно |
| `other.json` | Інше майно та права |
| `.nojekyll` | Обов'язковий для GitHub Pages |
| `.htaccess` | Для розміщення на Apache-хостингу |

---

## 🚀 Локальний запуск (для розробників)

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .

# Відкрийте: http://localhost:8080
```

> ❌ **Не відкривайте index.html напряму** (`file://`) — браузер блокує fetch-запити. Потрібен локальний сервер.

---

## Розгортання на Мірохост (продакшн)

Завантажте всі файли у папку `public_html` через cPanel → Файловий менеджер.
Детальна інструкція в архіві (`README_deployment.md`).
