# Alerts Bot - Handoff Document for Next Agent

## 🎯 Project Overview

**Location:** `d:\OSPanel\domains\kyivstar-nelegal-it-community.com.ua\Node_Home\GitHub\alerts-bot`

**Purpose:** Telegram bot that sends air raid alert notifications for Ukrainian regions with:
- Live message updates (edits existing messages with fresh data every 2 min)
- Weather integration
- RF attack information footer
- Global threat indicators
- Alert history database

## 🏗️ Architecture

```
server.js                   - Main entry point, Express + Telegram Bot
src/
├── alerts.js               - API for fetching alerts from alerts.in.ua
├── alert_generator.js      - Centralized message text builder (NEW!)
├── message_updater.js      - Live message update logic (edits sent messages)
├── rf_alerts.js            - Russian attack info + global threats
├── weather.js              - OpenWeatherMap integration
├── locations.js            - Ukrainian regions/cities data
├── subscribers.js          - Subscriber management
├── config.js               - Environment config
├── db.js                   - MariaDB connection pool + helpers
└── utils.js                - Logging utilities
```

## 🗃️ Database (MariaDB `alerts_bot`)

**Tables:**
- `alerts_history` - Historical log of all alerts
- `subscribers` - Chat subscriptions with location preferences
- `active_alerts` - Currently active alert messages (for live update restoration)
  - `chat_id`, `message_id`, `location_uid`, `location_name`, `base_text`, `updated_at`

## 🔄 Live Message Updates Flow

1. **Alert sent** → `trackAlertMessage(chatId, messageId, locationUid, locationName)` 
2. **Stored in DB** → `addActiveAlert(chatId, messageId, locationUid, locationName, text)`
3. **Every 2 min** → `message_updater.js` runs `runUpdates()`:
   - Fetches fresh alerts from API
   - For each tracked message: regenerates text via `buildAlertMessage()`
   - Edits Telegram message if text changed
4. **On restart** → `restoreActiveAlerts()` loads from DB and re-tracks

## ⚠️ Recent Changes (Dec 31, 2024 - Jan 1, 2025)

### Completed (Jan 1, 2025):
- [x] **FIXED Race Condition Bug** - При відбої тривоги старе повідомлення більше не редагується на текст відбою
  - Причина: `stopTracking()` викликався ПІСЛЯ `sendPhoto()`, і `runUpdates()` встигала оновити старе msg
  - Фікс: тепер `stopTracking()` + `removeActiveAlert()` викликаються ПЕРЕД `sendPhoto()` при відбої
  - Змінено в `checkAlertsForSubscribers()` і `broadcastToGroups()`

### Completed (Dec 31, 2024):
- [x] **Агресивні фрази для русні** в `src/rf_alerts.js`:
  - 45+ базових фраз (орки, кацапи, свині, підари, рашисти)
  - 10 нічних фраз (22:00-06:00)
  - 7 ранкових фраз (06:00-09:00)
  - 7 денних фраз (09:00-18:00)
  - 6 вечірніх фраз (18:00-22:00)
  - 12 новорічних фраз (20.12-15.01) - автоматично активуються в сезон!
- [x] **Точний підрахунок областей** використовуючи ukrainealarm API:
  - Нова функція `getUaAlertsOblasts()` в `src/rf_alerts.js`
  - Повертає точний список областей з активними тривогами (як на карті)
  - `/status` тепер показує ВСІ області по 3 на рядок
- [x] **RF alerts інфо в /status** - показує "🔥 Кошмарим підарів в: ..." якщо є тривога в РФ
- [x] **Toggle авто-оновлення в /status** - кнопки ▶️ Авто / ⏸️ Стоп працюють без зациклення

### Previous (Dec 31, 2024):
- [x] Created `src/alert_generator.js` with `buildAlertMessage()` function
- [x] Refactored `checkAlertsForSubscribers()` to use `buildAlertMessage()`
- [x] Refactored `broadcastToGroups()` to use `buildAlertMessage()`
- [x] Updated `trackAlertMessage()` to accept `locationUid` + `locationName`
- [x] Updated `message_updater.js` to regenerate full message text
- [x] Added `location_name` column to `active_alerts` table
- [x] Updated `restoreActiveAlerts()` to use DB's `location_name`

### Pending/To Verify:
- [ ] Test live updates during an ACTUAL alert (verify no duplicate edits)
- [ ] Monitor race condition fix works correctly

### Known Issues:
1. **DEP0190 Warning** about `spawn` with shell:true - cosmetic, not breaking
2. **node-telegram-bot-api deprecation** about content-type - cosmetic

## 🔑 Key Files to Review

1. **`server.js`** - Main logic:
   - `checkAlertsForSubscribers()` (line ~678) - subscriber alerts + stopTracking BEFORE send on all-clear
   - `broadcastToGroups()` (line ~717) - group broadcasts + stopTracking BEFORE send on all-clear
   - `restoreActiveAlerts()` (line ~800+) - loads from DB on restart
   - `buildStatusText()` (line ~329) - uses `getUaAlertsOblasts()` for accurate oblast count

2. **`src/alert_generator.js`** - Message text generation:
   - `buildAlertMessage(locationUid, locationName, alerts)` → returns HTML text

3. **`src/message_updater.js`** - Live update mechanism:
   - `runUpdates()` - 2 min interval loop
   - `trackAlertMessage()` - Register message for updates
   - `stopTracking()` - Unregister on alert end

4. **`src/rf_alerts.js`** - RF alerts + UA oblast data:
   - `getRfAlertsString()` - повертає агресивну фразу + список регіонів РФ в тривозі
   - `getUaAlertsOblasts()` - **NEW!** повертає точний count/names областей UA з тривогою
   - `getGlobalThreats()` - балістика, авіація тощо

5. **`src/db.js`** - Database functions:
   - `addActiveAlert(chatId, messageId, locationUid, locationName, baseText)`
   - `removeActiveAlert(chatId)`
   - `getAllActiveAlerts()` - Used by restoreActiveAlerts

## 🧪 Testing

**Start server:**
```bash
npm run dev  # Uses nodemon
```

**Trigger test alert (NO persistence, preview only):**
```powershell
Invoke-RestMethod -Uri "http://localhost:3002/api/test/send" -Method POST -ContentType "application/json" -Body '{"locationUid":"24","type":"alert"}'
```

**Check server logs for:**
- `✅ Restored X active alerts for live updates`
- `🔄 Running live updates for X chats...`

## 📌 Environment Variables (.env)

```
TELEGRAM_BOT_TOKEN=...
OPENWEATHERMAP_API_KEY=...
ALERTS_API_TOKEN=...
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=alerts_bot
TARGET_REGION=Черкаська область
TARGET_REGION_UID=24
BROADCAST_CHAT_IDS=-1001405099218,-1001069436961,394481011
```

## 🚀 Next Steps for Agent

1. **Monitor race condition fix** - verify old alert messages don't get edited on all-clear
2. Consider adding live update tracking to test endpoint (optional, for dev testing)
3. Consider rate limiting for live updates per chat
4. Update documentation/README with new features

## 📊 Current Status (updated: 01.01.2025 19:00)

| Item | Status |
|------|--------|
| Database | ✅ Clean, no stale data |
| Server | ✅ Running on port 3002 |
| Restore on restart | ✅ Works |
| Race condition fix | ✅ stopTracking before sendPhoto |
| Aggressive phrases | ✅ 90+ фраз, динамічно по часу |
| Oblast count | ✅ ukrainealarm API, точний count |
| Live updates | ⏳ Monitoring |
