# 🚨 Alerts Bot 

> **The bot that screams at you faster than any siren** 📢

<p align="center">
  <img src="https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif" width="200">
</p>

## What the heck is this? 🤔

A Telegram bot for monitoring air raid alerts in Ukraine. It:
- 📡 Checks alert status every 30 seconds
- 🔔 Sends notifications to TG (faster than you can put on your pants)
- 🖥️ Has a cool tray indicator for Windows (because who looks at their phone 24/7?)
- 📊 Keeps history of all alerts (for the statistics nerds out there)
- 🌤️ Shows weather (gotta know if you need an umbrella in the shelter)

## Features that make life better ✨

| Feature | Description |
|---------|-------------|
| 🔴 Instant notifications | Get alerts before your neighbor does |
| 📍 Region selection | Subscribe to your oblast or district |
| 🔄 Auto-refresh | /status updates itself every 45 sec |
| 🚫 Rate limiting | Protection from spammers (and from you when you panic) |
| 🖥️ Tray indicator | Green = chill, Red = run |

## Quick Start 🚀

```bash
# Clone the repo
git clone https://github.com/NanoInG/alerts-bot.git
cd alerts-bot

# Install dependencies
npm install

# Configure .env (copy from .env.example and fill it in)
cp .env.example .env

# Initialize database
node init_db.js

# Let's gooo!
npm start
```

## Configuration 🛠️

Create a `.env` file:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_IDS=your_chat_id,-100your_group

# API Keys
ALERTS_API_TOKEN=token_from_alerts.in.ua
OPENWEATHERMAP_API_KEY=your_weather_key

# Database (MariaDB/MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=alerts_bot
```

## Bot Commands 🤖

| Command | What it does |
|---------|--------------|
| `/start` | Greeting (bot says "Glory to Ukraine!") |
| `/subscribe` | Subscribe to notifications |
| `/unsubscribe` | Unsubscribe (but why would you?) |
| `/region` | Select oblast |
| `/city` | Select city/district |
| `/status` | Alert status + refresh button |

## Tray Indicator 🖥️

Starts automatically with the server. Shows:
- 🟢 **Green** - all clear, chill vibes
- 🔴 **Red** - ALERT! Grab the cat and get to shelter!
- 🟠 **Orange** - API not responding (maybe internet is down)

## HTTP API 🌐

```
GET /api/status/:uid     - Status for location
GET /api/country         - Country-wide status  
GET /api/history         - Alert history
GET /history.html        - Beautiful history page
```

## Tech Stack 💻

- **Node.js** - fast as an air raid
- **Express** - for the API
- **node-telegram-bot-api** - for Telegram magic
- **MariaDB** - for storing history
- **PowerShell** - for tray indicator (Windows gang 💪)

## License 📜

MIT - do whatever you want, just don't forget to turn off the siren when all clear 😉

---

<p align="center">
  <b>Made with ❤️ and wishes for peaceful skies</b>
  <br>
  <i>Glory to Ukraine! 🇺🇦</i>
</p>
