# 🚨 Alerts Bot - Cheatsheet
> Система моніторингу повітряних тривог. Бережи себе! 🇺🇦

## 🚬 Суть
Бот, що не дає проспати тривогу. Поєднує Telegram сповіщення та API для віджетів.
- **Стек:** Node.js + Express + node-telegram-bot-api
- **БД:** MariaDB (збереження підписників та історії)
- **Джерела:** ukrainealarm API + RF alerts tracking

## 🛠 Архітектура
1. `server.js` — Головний файл. Запускає Express API та ініціалізує бота.
2. `bot.js` — Окрема логіка бота (запуск через `npm run bot`).
3. `src/alerts.js` — Робота з даними про тривоги.
4. `src/db.js` — Взаємодія з MariaDB.
5. `src/message_updater.js` — Магія авто-оновлення повідомлень в чаті.

## 🚀 API (Порт 3000/3001)
- `GET /api/status?location=Черкаси` — Поточний статус тривоги.
- `GET /api/history` — Історія тривог.
- `GET /api/locations` — Список доступних регіонів.

## 📱 Команди
- `/status` — Поточна ситуація + Погода + РФ-трекінг.
- `/subscribe` — Підписка на свій регіон.
- `/region` / `/city` — Вибір локації.

## 🚨 ПРАВИЛА (Для Hightlot🚬)
1. **Migrations:** Скрипти міграцій лежать в корені (`migrate_add_location_name.js`). Юзай їх!
2. **Media:** Картинки для сповіщень лежать в `media/images/`. (red_alert_*.png, green_alert_*.png).
3. **Winston:** (TODO) Зараз юзається кастомний `log` з `src/utils.js`.

## 🗂 Структура
```
alerts-bot/
  src/
    config.js       — Токени, порти, налаштування
    db.js           — MariaDB queries
    alerts.js       — Fetching & Parsing
  media/            — Звуки та картинки
  server.js         — Express + Bot Init
  init_db.js        — Створення таблиць
```

## 🌐 Поради
Якщо бот тупить — перевір `HISTORY_FILE` та підключення до MariaDB. 
Для локальних тестів юзай `POST /api/test/send`. 🌿🚬🚨
