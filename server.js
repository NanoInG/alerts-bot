/**
 * Unified Alerts Bot Server
 * Main entry point - imports all modules
 * 
 * - Telegram Bot commands (/start, /subscribe, /region, etc.)
 * - HTTP API for PowerShell/external scripts
 * - Auto-alerts to subscribers
 */

// Set Console Title
process.stdout.write('\x1b]2;Alerts Bot\x1b\x5c');

import express from 'express';
import http from 'http'; // 1. Import http
import { Server } from 'socket.io'; // 1. Import socket.io
import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// === Import Modules ===
import {
    token, PORT, config, broadcastChatIds, disablePolling,
    HISTORY_FILE
} from './src/config.js';
import { log } from './src/utils.js';
import { LOCATIONS } from './src/locations.js';
import { loadSubscribers, saveSubscribers, subscribe, unsubscribe, updateSubscriberAlertState } from './src/subscribers.js';
import {
    fetchAlerts, isAlertActive, getAlertDetails,
    getCountrySummary, getAlertSummary, translateAlertType
} from './src/alerts.js';
import { fetchWeather, getLocationCoords } from './src/weather.js';
import { getRfAlertsString, getGlobalThreats, getUaAlertsOblasts } from './src/rf_alerts.js';
import { initUpdater, trackAlertMessage, stopTracking } from './src/message_updater.js';
import { buildAlertMessage } from './src/alert_generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Express App & HTTP/Socket.io Server ===
const app = express();
const httpServer = http.createServer(app); // 2. Create standard HTTP server
const io = new Server(httpServer, { // 3. Attach socket.io
    cors: {
        origin: "*", // Allow all origins for simplicity
        methods: ["GET", "POST"]
    }
});
app.use(express.json());

// === Telegram Bot ===
const bot = new TelegramBot(token, { polling: !disablePolling });
initUpdater(bot);

if (disablePolling) {
    log('⚠️ Polling DISABLED (Running in API-only mode)');
}

// Register Commands
const commands = [
    { command: 'start', description: 'Запустити бота' },
    { command: 'subscribe', description: 'Підписатись на сповіщення' },
    { command: 'unsubscribe', description: 'Відписатись' },
    { command: 'region', description: 'Обрати область' },
    { command: 'city', description: 'Обрати місто' },
    { command: 'status', description: 'Статус тривог' }
];

bot.setMyCommands(commands).catch(e => log(`❌ Commands error: ${e.message}`));

// Error Handling
bot.on('polling_error', (error) => log(`[Polling Error] ${error.code}: ${error.message}`));
bot.on('error', (error) => log(`[Bot Error] ${error.message}`));

// === Status Auto-Update Tracking ===
const statusTrackers = new Map(); // chatId -> { messageId, intervalId, lastRefresh, lastStatus, autoEnabled }
const RATE_LIMIT_MS = 20000;      // 20 sec between manual refreshes
const AUTO_UPDATE_MS = 45000;     // 45 sec auto-update

// =====================
// HTTP API ROUTES
// =====================

// GET /api/status
app.get('/api/status', async (req, res) => {
    const { location, uid } = req.query;
    const alerts = await fetchAlerts();
    const locationUid = uid || LOCATIONS.find(l =>
        l.name.toLowerCase().includes((location || '').toLowerCase()) ||
        l.short.toLowerCase().includes((location || '').toLowerCase())
    )?.uid;

    if (!locationUid) {
        return res.status(400).json({ error: 'Location not found' });
    }

    const isActive = isAlertActive(alerts, locationUid);
    const details = getAlertDetails(alerts, locationUid);

    res.json({
        location: LOCATIONS.find(l => l.uid === locationUid)?.name,
        alert: isActive,
        locationUid,
        alertCount: details.length,
        alertTypes: [...new Set(details.map(d => d.alert_type))],
        timestamp: new Date().toISOString()
    });
});

// GET /api/status/:city
app.get('/api/status/:city', async (req, res) => {
    const city = decodeURIComponent(req.params.city);
    const alerts = await fetchAlerts();

    const found = LOCATIONS.find(l =>
        l.uid.toString() === city.toString() ||
        l.name.toLowerCase().includes(city.toLowerCase()) ||
        l.short.toLowerCase().includes(city.toLowerCase())
    );

    if (!found) {
        return res.status(404).json({ error: 'Location not found', query: city });
    }

    const isActive = isAlertActive(alerts, found.uid);
    const details = getAlertDetails(alerts, found.uid);
    const country = getCountrySummary(alerts);

    res.json({
        location: found.name,
        short: found.short,
        uid: found.uid,
        alert: isActive,
        alertTypes: [...new Set(details.map(d => d.alert_type))],
        countrywide: {
            totalAlerts: country.totalAlerts,
            oblastCount: country.oblastCount
        },
        timestamp: new Date().toISOString()
    });
});

// GET /api/locations
app.get('/api/locations', (req, res) => {
    res.json(LOCATIONS.map(l => ({
        uid: l.uid,
        name: l.name,
        short: l.short,
        type: l.type,
        oblastUid: l.oblastUid || null
    })));
});

// GET /api/history (Database with pagination and filters)
import { getAlertHistory, getHistoryStats, saveAlertHistory, addActiveAlert, removeActiveAlert, getAllActiveAlerts } from './src/db.js';

app.get('/api/history', async (req, res) => {
    const { page = 1, limit = 20, type, search, dateFrom, dateTo, locationUid } = req.query;

    try {
        const [historyResult, stats] = await Promise.all([
            getAlertHistory({
                page: parseInt(page),
                limit: parseInt(limit),
                type: type || null,
                search: search || null,
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                locationUid: locationUid || null
            }),
            getHistoryStats()
        ]);

        res.json({
            data: historyResult.data,
            pagination: historyResult.pagination,
            stats
        });
    } catch (e) {
        log(`History API error: ${e.message}`);
        res.status(500).json({ error: e.message, data: [], pagination: {}, stats: {} });
    }
});

// POST /api/test/send - Send test alert
app.post('/api/test/send', async (req, res) => {
    log(`Test send: ${JSON.stringify(req.body)}`);
    const { locationUid, type } = req.body;

    const subs = await loadSubscribers();
    let count = 0;

    // Mock weather
    const weatherOptions = [
        { desc: 'Хмарно', icon: '☁️' },
        { desc: 'Ясно', icon: '☀️' },
        { desc: 'Невеликий дощ', icon: '🌧️' }
    ];
    const weatherChoice = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
    const mockWeather = {
        temp: Math.round(Math.random() * 15 - 5),
        feels: Math.round(Math.random() * 15 - 8),
        desc: weatherChoice.desc,
        icon: weatherChoice.icon,
        wind: Math.round(Math.random() * 15 + 2),
        windDir: ['Пн', 'Сх', 'Пд', 'Зх'][Math.floor(Math.random() * 4)],
        pressure: Math.round(1010 + Math.random() * 20),
        humidity: Math.round(50 + Math.random() * 40)
    };

    const mockOblasts = ['Харківська', 'Донецька', 'Запорізька', 'Сумська']
        .slice(0, Math.floor(Math.random() * 3) + 2);

    for (const [chatId, sub] of Object.entries(subs)) {
        const subLocation = LOCATIONS.find(l => l.uid.toString() === sub.locationUid.toString());
        const subOblastUid = subLocation?.oblastUid || subLocation?.uid;

        const match = sub.locationUid.toString() === locationUid?.toString() ||
            subOblastUid?.toString() === locationUid?.toString();

        if (match) {
            const isAlert = (type === 'alert');
            const coords = getLocationCoords(sub.locationUid);

            let text = '';

            if (isAlert) {
                text = `🧪 <b>ТЕСТ ТРИВОГА!</b>\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `📍 <b>${sub.locationName}</b>\n\n`;
                text += `<b>⚠️ Загрози:</b>\n  🚀 Ракетна загроза\n\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `<b>🇺🇦 В тривозі:</b> ${mockOblasts.length} обл.\n`;
                text += `📋 ${mockOblasts.join(', ')}\n\n`;
                text += `${mockWeather.icon} ${mockWeather.temp}°C | 💨 ${mockWeather.wind} м/с\n\n`;
                text += `🚨 <b>Негайно в укриття!</b>\n`;
                text += `\n<i>🧪 Тестове повідомлення</i>`;
            } else {
                text = `🧪 <b>ТЕСТ ВІДБІЙ</b>\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `📍 <b>${sub.locationName}</b>\n\n`;
                text += `✅ <b>Можна виходити</b> 😊\n\n`;
                text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
                text += `${mockWeather.icon} ${mockWeather.desc}\n`;
                text += `🌡️ <b>${mockWeather.temp}°C</b> (відчув. ${mockWeather.feels}°C)\n`;
                text += `💨 Вітер: ${mockWeather.wind} м/с ${mockWeather.windDir}\n\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `<b>🇺🇦 Ще в тривозі:</b> ${mockOblasts.length} обл.\n`;
                text += `📋 ${mockOblasts.join(', ')}\n`;
                text += `\n<i>🧪 Тестове повідомлення</i>`;
            }

            const imagePath = getRandomImage(isAlert);

            try {
                await bot.sendPhoto(chatId, imagePath, { caption: text, parse_mode: 'HTML', show_caption_above_media: true, has_spoiler: true });
                count++;
                log(`Test sent to ${chatId}`);
            } catch (e) {
                log(`Test failed: ${e.message}`);
                try {
                    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
                    count++;
                } catch (err) {
                    log(`Test fallback failed: ${err.message}`);
                }
            }
        }
    }

    log(`Test completed: ${count} sent`);
    res.json({ sent: count, type });
});

// Serve static files
app.use(express.static(__dirname));

// Helper: Random local image
function getRandomImage(isAlert) {
    const num = Math.floor(Math.random() * 3) + 1;
    const type = isAlert ? 'red_alert' : 'green_alert';
    return path.join(__dirname, 'media', 'images', `${type}_${num}.png`);
}

// =====================
// TELEGRAM BOT COMMANDS
// =====================

// /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'друже';
    const subs = await loadSubscribers();
    const sub = subs[chatId];

    let text = `👋 Привіт, <b>${name}</b>!\n\n`;
    text += `Я бот сповіщень про тривоги.\n\n`;
    if (sub) {
        text += `📌 Твій регіон: <b>${sub.locationName}</b>\n\n`;
    }
    text += `Користуйся кнопками нижче:`;

    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            keyboard: [
                ['📊 Статус', '🔔 Підписатись'],
                ['❌ Відписатись']
            ],
            resize_keyboard: true
        }
    };

    await bot.sendMessage(chatId, text, options);
});

// Button handlers
bot.on('message', async (msg) => {
    if (msg.text === '📊 Статус') await handleStatus(msg);
    if (msg.text === '🔔 Підписатись') await showLocationMenu(msg.chat.id, 'oblast');
    if (msg.text === '❌ Відписатись') await handleUnsubscribe(msg);
});

// /subscribe, /region, /city
bot.onText(/\/subscribe/, (msg) => showLocationMenu(msg.chat.id, 'oblast'));
bot.onText(/\/region/, (msg) => showLocationMenu(msg.chat.id, 'oblast'));
bot.onText(/\/city/, (msg) => showLocationMenu(msg.chat.id, 'city'));

// /unsubscribe handler
const handleUnsubscribe = async (msg) => {
    const chatId = msg.chat.id;
    if (unsubscribe(chatId)) {
        await bot.sendMessage(chatId, '❌ Ти відписався від сповіщень.');
    } else {
        await bot.sendMessage(chatId, '⚠️ Ти ще не підписаний.');
    }
};
bot.onText(/\/unsubscribe/, handleUnsubscribe);

// /status handler with inline refresh button
async function buildStatusText(chatId, { includeFooter = true, autoEnabled = false } = {}) {
    const alerts = await fetchAlerts();
    const subs = await loadSubscribers();
    const sub = subs[chatId];
    const country = getCountrySummary(alerts);
    const now = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Get accurate oblast count from ukrainealarm API
    const uaOblasts = await getUaAlertsOblasts();
    const oblastCount = uaOblasts?.count || country.oblastCount;
    const oblastNames = uaOblasts?.names || country.oblasts;

    let text = `📊 <b>Статус тривог</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;

    let currentStatus = 'safe'; // Track for status change detection
    let userRegionAlert = false; // Track if user's specific region has alert

    if (oblastCount > 0) {
        text += `🔴 <b>Тривога в ${oblastCount} областях:</b>\n`;
        // Show ALL oblasts, 3 per line
        const shortNames = oblastNames.map(o => o.replace(' область', ''));
        for (let i = 0; i < shortNames.length; i += 3) {
            const row = shortNames.slice(i, i + 3);
            text += `📋 ${row.join(', ')}\n`;
        }
        text += `\n`;

        if (Object.keys(country.threats).length > 0) {
            text += `<b>⚠️ Типи загроз:</b>\n`;
            for (const [type, count] of Object.entries(country.threats)) {
                text += `  ${translateAlertType(type)} (${count})\n`;
            }
            text += `\n`;
        }
    } else {
        text += `🟢 <b>Тривог по Україні немає</b> 🇺🇦\n\n`;
    }

    if (sub) {
        text += `━━━━━━━━━━━━━━━\n`;
        text += `📍 <b>Твій регіон:</b> ${sub.locationName}\n\n`;

        const subLocation = LOCATIONS.find(l => l.uid.toString() === sub.locationUid.toString());
        const subOblastUid = subLocation?.oblastUid || subLocation?.uid;
        const isActive = isAlertActive(alerts, sub.locationUid) || isAlertActive(alerts, subOblastUid);
        userRegionAlert = isActive;

        if (isActive) {
            currentStatus = 'alert';
            text += `🔴 <b>ТРИВОГА!</b>\n\n`;

            const summary = getAlertSummary(alerts, sub.locationUid);
            if (Object.keys(summary.types).length > 0) {
                text += `<b>⚠️ Загрози:</b>\n`;
                for (const [type] of Object.entries(summary.types)) {
                    text += `  ${translateAlertType(type)}\n`;
                }
                text += `\n`;
            }

            if (summary.raions.length > 0) {
                text += `<b>📌 Райони:</b> ${summary.raions.join(', ')}`;
                if (summary.hasMore) text += ` +ще`;
                text += `\n\n`;
            }
        } else {
            text += `🟢 <b>Спокійно</b> ✅\n\n`;
        }

        const coords = getLocationCoords(sub.locationUid);
        const weather = await fetchWeather(coords.lat, coords.lon);

        if (weather) {
            text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
            text += `${weather.icon} ${weather.desc}\n`;
            text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
            text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n`;
        }
    }

    // Add RF alerts info - тривога у орків! 🔥
    const rfInfoText = await getRfAlertsString();
    if (rfInfoText) {
        text += `\n━━━━━━━━━━━━━━━\n`;
        text += `${rfInfoText}\n`;
    }

    if (includeFooter) {
        text += `\n━━━━━━━━━━━━━━━\n`;
        text += `🔄 Оновлено: ${now}\n`;
        if (autoEnabled) {
            text += `⏱️ Авто-оновлення: ✅ кожні 45с`;
        } else {
            text += `⏱️ Авто-оновлення: ⏸️ вимкнено`;
        }
    }

    return { text, currentStatus, userRegionAlert };
}

const handleStatus = async (msg) => {
    const chatId = msg.chat.id;

    // Clear previous tracker if exists
    const existing = statusTrackers.get(chatId);
    if (existing?.intervalId) {
        clearInterval(existing.intervalId);
    }

    // Auto-update OFF by default
    const autoEnabled = false;
    const { text, currentStatus, userRegionAlert } = await buildStatusText(chatId, { autoEnabled });

    const keyboard = {
        inline_keyboard: [[
            { text: '🔄 Оновити', callback_data: 'refresh_status' },
            { text: '▶️ Авто', callback_data: 'toggle_auto_status' }
        ]]
    };

    const sent = await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard
    });

    statusTrackers.set(chatId, {
        messageId: sent.message_id,
        intervalId: null,
        lastRefresh: Date.now(),
        lastStatus: currentStatus,
        autoEnabled: false
    });
};
bot.onText(/\/status/, handleStatus);

// Helper: Build keyboard based on auto state
function getStatusKeyboard(autoEnabled) {
    return {
        inline_keyboard: [[
            { text: '🔄 Оновити', callback_data: 'refresh_status' },
            { text: autoEnabled ? '⏸️ Стоп' : '▶️ Авто', callback_data: 'toggle_auto_status' }
        ]]
    };
}

// Helper: Start auto-update interval
function startAutoUpdate(chatId, messageId) {
    const intervalId = setInterval(async () => {
        try {
            const tracker = statusTrackers.get(chatId);
            if (!tracker || !tracker.autoEnabled) {
                clearInterval(intervalId);
                return;
            }

            const { text: newText, currentStatus: newStatus, userRegionAlert } = await buildStatusText(chatId, { autoEnabled: true });
            const keyboard = getStatusKeyboard(true);

            // Auto-stop when user's region alert ends (was alert -> now safe)
            if (tracker.lastStatus === 'alert' && newStatus === 'safe') {
                clearInterval(intervalId);
                tracker.autoEnabled = false;
                tracker.intervalId = null;

                const finalText = newText.replace('⏱️ Авто-оновлення: ✅ кожні 45с', '⏱️ Авто-оновлення: ⏸️ вимкнено');
                const finalKeyboard = getStatusKeyboard(false);

                await bot.editMessageText(finalText + `\n\n🔔 <b>Відбій!</b> Авто-оновлення зупинено.`, {
                    chat_id: chatId,
                    message_id: tracker.messageId,
                    parse_mode: 'HTML',
                    reply_markup: finalKeyboard
                });
                return;
            }

            tracker.lastStatus = newStatus;
            await bot.editMessageText(newText, {
                chat_id: chatId,
                message_id: tracker.messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (e) {
            // Message might be deleted or too old
            const tracker = statusTrackers.get(chatId);
            if (tracker?.intervalId) clearInterval(tracker.intervalId);
            statusTrackers.delete(chatId);
        }
    }, AUTO_UPDATE_MS);

    return intervalId;
}

// Handle refresh button callback
bot.on('callback_query', async (query) => {
    if (query.data !== 'refresh_status' && query.data !== 'toggle_auto_status') return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    let tracker = statusTrackers.get(chatId);

    // Create tracker if not exists (e.g., old message)
    if (!tracker) {
        tracker = {
            messageId,
            intervalId: null,
            lastRefresh: 0,
            lastStatus: 'safe',
            autoEnabled: false
        };
        statusTrackers.set(chatId, tracker);
    }

    // Handle toggle auto-update
    if (query.data === 'toggle_auto_status') {
        tracker.autoEnabled = !tracker.autoEnabled;

        if (tracker.autoEnabled) {
            // Start auto-update
            tracker.intervalId = startAutoUpdate(chatId, messageId);
            await bot.answerCallbackQuery(query.id, { text: '▶️ Авто-оновлення увімкнено!' });
        } else {
            // Stop auto-update
            if (tracker.intervalId) {
                clearInterval(tracker.intervalId);
                tracker.intervalId = null;
            }
            await bot.answerCallbackQuery(query.id, { text: '⏸️ Авто-оновлення вимкнено!' });
        }

        // Refresh with new state
        try {
            const { text, currentStatus } = await buildStatusText(chatId, { autoEnabled: tracker.autoEnabled });
            const keyboard = getStatusKeyboard(tracker.autoEnabled);

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            tracker.lastStatus = currentStatus;
            tracker.lastRefresh = Date.now();
        } catch (e) {
            // Ignore edit errors
        }
        return;
    }

    // Handle manual refresh
    if (query.data === 'refresh_status') {
        // Rate limiting
        if (tracker.lastRefresh && Date.now() - tracker.lastRefresh < RATE_LIMIT_MS) {
            const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - tracker.lastRefresh)) / 1000);
            await bot.answerCallbackQuery(query.id, {
                text: `⏳ Зачекай ${waitSec} сек перед наступним оновленням`,
                show_alert: false
            });
            return;
        }

        try {
            const { text, currentStatus } = await buildStatusText(chatId, { autoEnabled: tracker.autoEnabled });
            const keyboard = getStatusKeyboard(tracker.autoEnabled);

            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });

            tracker.lastRefresh = Date.now();
            tracker.lastStatus = currentStatus;

            await bot.answerCallbackQuery(query.id, { text: '✅ Оновлено!' });
        } catch (e) {
            await bot.answerCallbackQuery(query.id, { text: '❌ Помилка оновлення' });
        }
    }
});

// Show location menu
async function showLocationMenu(chatId, type, page = 0) {
    const items = LOCATIONS.filter(l => l.type === type || (type === 'oblast' && l.type === 'city'));
    const pageSize = 8;
    const start = page * pageSize;
    const pageItems = items.slice(start, start + pageSize);

    const keyboard = [];
    for (let i = 0; i < pageItems.length; i += 2) {
        const row = [];
        row.push({ text: pageItems[i].short, callback_data: `sub_${pageItems[i].uid}` });
        if (pageItems[i + 1]) {
            row.push({ text: pageItems[i + 1].short, callback_data: `sub_${pageItems[i + 1].uid}` });
        }
        keyboard.push(row);
    }

    const navRow = [];
    if (page > 0) navRow.push({ text: '⬅️ Назад', callback_data: `page_${type}_${page - 1}` });
    if (start + pageSize < items.length) navRow.push({ text: 'Далі ➡️', callback_data: `page_${type}_${page + 1}` });
    if (navRow.length) keyboard.push(navRow);

    await bot.sendMessage(chatId, `Обери ${type === 'oblast' ? 'область' : 'місто'}:`, {
        reply_markup: { inline_keyboard: keyboard }
    });
}

// Callback query handler
bot.on('callback_query', async (q) => {
    const chatId = q.message.chat.id;
    const data = q.data;

    try {
        if (data.startsWith('page_')) {
            const [, type, pageStr] = data.split('_');
            await bot.deleteMessage(chatId, q.message.message_id);
            await showLocationMenu(chatId, type, parseInt(pageStr));
        } else if (data.startsWith('sub_')) {
            const uid = data.replace('sub_', '');
            const location = LOCATIONS.find(l => l.uid === uid);

            if (location) {
                subscribe(chatId, q.from.username || q.from.first_name, location);
                await bot.deleteMessage(chatId, q.message.message_id);
                await bot.sendMessage(chatId, `✅ Підписано на: <b>${location.name}</b>`, { parse_mode: 'HTML' });
            }
        }
    } catch (e) {
        log(`Callback error: ${e.message}`);
    }

    try {
        await bot.answerCallbackQuery(q.id);
    } catch (e) {
        log(`Answer callback error: ${e.message}`);
    }
});

// =====================
// AUTO ALERTS TO SUBSCRIBERS
// =====================
async function checkAlertsForSubscribers() {
    const alerts = await fetchAlerts();
    const subs = await loadSubscribers();

    for (const [chatId, sub] of Object.entries(subs)) {
        const isActive = isAlertActive(alerts, sub.locationUid);

        if (isActive !== sub.lastAlertState) {
            // Update alert state in database
            await updateSubscriberAlertState(chatId, isActive);
            sub.lastAlertState = isActive;

            // IMPORTANT: If alert ended, stop tracking BEFORE sending new message
            // This prevents race condition where runUpdates() updates old message
            if (!isActive) {
                stopTracking(chatId);
                await removeActiveAlert(chatId);
            }

            // Generate message using shared builder
            const text = await buildAlertMessage(sub.locationUid, sub.locationName, alerts);
            const imagePath = getRandomImage(isActive);

            try {
                const sentMsg = await bot.sendPhoto(chatId, imagePath, { caption: text, parse_mode: 'HTML', show_caption_above_media: true, has_spoiler: true });
                log(`Subscriber alert to ${chatId}: ${isActive ? 'START' : 'END'}`);

                // Only track new alerts (not all-clear messages)
                if (isActive) {
                    trackAlertMessage(chatId, sentMsg.message_id, sub.locationUid, sub.locationName);

                    // Update active alerts persistence
                    await addActiveAlert(chatId, sentMsg.message_id, sub.locationUid, sub.locationName, text);
                }
            } catch (e) {
                log(`Subscriber alert failed for ${chatId}: ${e.message}`);
                // ignore block errors for now
            }
        }
    }
}

// =====================
// BROADCAST TO GROUPS
// =====================
const broadcastState = { initialized: false };

async function broadcastToGroups() {
    if (broadcastChatIds.length === 0) return;

    const alerts = await fetchAlerts();
    const targetUid = config.targetRegionUid || '24';
    const targetName = config.targetRegion || 'Черкаська область';
    const isActive = isAlertActive(alerts, targetUid);

    // First run - just save state, don't broadcast
    if (!broadcastState.initialized) {
        broadcastState[targetUid] = isActive;
        broadcastState.initialized = true;
        log(`📊 Initial state: ${targetName} = ${isActive ? 'ALERT' : 'SAFE'}`);
        return;
    }

    if (broadcastState[targetUid] !== isActive) {
        broadcastState[targetUid] = isActive;
        
        // 4. Emit status update to all connected web clients
        io.emit('status_update', { alert: isActive });
        log(`📡 Emitted status via WebSocket: ${isActive ? 'ALERT' : 'SAFE'}`);

        // Generate message text using shared builder
        const text = await buildAlertMessage(targetUid, targetName, alerts);

        // Note: isActive is already calculated at line 635, no need to re-check

        const imagePath = getRandomImage(isActive);

        // Get subscriber chat IDs to avoid duplicates
        const subs = await loadSubscribers();
        const subscriberChatIds = Object.keys(subs);

        for (const chatId of broadcastChatIds) {
            // Skip if this chat is already a subscriber (they get personal notification)
            if (subscriberChatIds.includes(chatId.toString())) {
                log(`Broadcast skipped for ${chatId}: already a subscriber`);
                continue;
            }

            // IMPORTANT: If alert ended, stop tracking BEFORE sending new message
            // This prevents race condition where runUpdates() updates old message
            if (!isActive) {
                stopTracking(chatId);
                await removeActiveAlert(chatId);
            }

            try {
                const sentMsg = await bot.sendPhoto(chatId, imagePath, { caption: text, parse_mode: 'HTML', show_caption_above_media: true, has_spoiler: true });
                log(`Broadcast to ${chatId}: ${isActive ? 'ALERT' : 'END'}`);

                // Only track new alerts (not all-clear messages)
                if (isActive) {
                    trackAlertMessage(chatId, sentMsg.message_id, targetUid, targetName);
                    await addActiveAlert(chatId, sentMsg.message_id, targetUid, targetName, text);
                }
            } catch (e) {
                log(`Broadcast failed: ${e.message}`);
                // If blocked, stop tracking
                if (e.message.includes('blocked')) stopTracking(chatId);
            }
        }

        // Save to database with extended data (once per state change)
        // Fetch data for history logging
        const coords = getLocationCoords(targetUid);
        const weather = await fetchWeather(coords.lat, coords.lon);
        const country = getCountrySummary(alerts);
        const summary = getAlertSummary(alerts, targetUid);
        const rfInfoText = await getRfAlertsString();

        await saveAlertHistory({
            locationUid: targetUid,
            locationName: targetName,
            alertType: isActive ? 'ALERT' : 'END',
            threatTypes: Object.keys(summary.types).join(', ') || null,
            weatherTemp: weather?.temp || null,
            weatherDesc: weather?.desc || null,
            weatherIcon: weather?.icon || null,
            raions: summary.raions.join(', ') || null,
            countryCount: country.oblastCount || null,
            rfInfo: rfInfoText || null,
            countryInfo: country.oblastCount > 0 ? country.oblasts.map(o => o.replace(' область', '')).join(', ') : null
        });
    }
}


// Check every 30 seconds
setInterval(checkAlertsForSubscribers, 30000);
setInterval(broadcastToGroups, 30000);

// 5. Handle WebSocket connections
io.on('connection', (socket) => {
    log(`🌿 New client connected to WebSocket: ${socket.id}`);
    
    socket.on('request_initial_status', async () => {
        try {
            const alerts = await fetchAlerts();
            const targetUid = config.targetRegionUid || '24';
            const isActive = isAlertActive(alerts, targetUid);
            socket.emit('status_update', { alert: isActive });
            log(`Sent initial status to ${socket.id}: ${isActive ? 'ALERT' : 'SAFE'}`);
        } catch (e) {
            log(`Error sending initial status: ${e.message}`);
        }
    });

    socket.on('disconnect', () => {
        log(`Client disconnected: ${socket.id}`);
    });
});

// =====================
// RESTORE ACTIVE ALERTS ON RESTART
// =====================
async function restoreActiveAlerts() {
    log('🔄 Restoring active alerts...');
    try {
        const activeAlerts = await getAllActiveAlerts();
        for (const alert of activeAlerts) {
            // Use DB stored location_name, fallback to LOCATIONS lookup
            const locName = alert.location_name || LOCATIONS.find(l => l.uid.toString() === alert.location_uid.toString())?.name || 'Невідома область';
            trackAlertMessage(alert.chat_id, alert.message_id, alert.location_uid, locName);
        }
        log(`✅ Restored ${activeAlerts.length} active alerts for live updates`);
    } catch (e) {
        log(`❌ Failed to restore alerts: ${e.message}`);
    }
}

// =====================
// START TRAY INDICATOR (ELECTRON)
// =====================
import { spawn } from 'child_process';

function startElectronIndicator() {
    const indicatorDir = path.join(__dirname, 'alert-indicator');
    const electronExe = path.join(indicatorDir, 'node_modules', 'electron', 'dist', 'electron.exe');

    if (!fs.existsSync(electronExe)) {
        log(`⚠️ Electron binary not found: ${electronExe}`);
        return;
    }

    try {
        // Use taskkill instead of PowerShell for speed (filtering by window title)
        // Note: Title filter usually works well in Windows for GUI apps
        const killerCmd = `taskkill /F /FI "IMAGENAME eq electron.exe" /FI "WINDOWTITLE eq Alert Indicator*" /T`;
        spawn('cmd.exe', ['/c', killerCmd], { shell: true, detached: true, stdio: 'ignore' }).unref();
        log(`🧨 Fast-killing old indicator...`);

        // Snappier delay
        setTimeout(() => {
            try {
                const env = { ...process.env };
                delete env.ELECTRON_RUN_AS_NODE;

                const child = spawn(electronExe, ['.'], {
                    cwd: indicatorDir,
                    detached: true,
                    stdio: 'ignore',
                    env,
                });
                child.unref();
                log(`🎯 Electron Alert Indicator (Re)launched`);
            } catch (e) {
                log(`❌ Failed to spawn Electron: ${e.message}`);
            }
        }, 800);

    } catch (e) {
        log(`❌ Error in startElectronIndicator: ${e.message}`);
    }
}

// =====================
// START SERVER
// =====================
httpServer.listen(PORT, '0.0.0.0', () => { // 7. Use httpServer to listen
    log(`🚀 Server started on port ${PORT}`);
    log(`🤖 Bot ${disablePolling ? 'SEND-ONLY' : 'POLLING'}`);
    log(`📍 Target: ${config.targetRegion}`);
    log(`📡 Broadcast to ${broadcastChatIds.length} groups`);
    log('🌿 WebSocket server is listening for indicator connections');

    // Restore alerts
    restoreActiveAlerts();

    // Launch Electron alert indicator (DISABLED FOR DOCKER)
    // startElectronIndicator();
    });
