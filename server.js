/**
 * Unified Alerts Bot Server
 * Main entry point - imports all modules
 * 
 * - Telegram Bot commands (/start, /subscribe, /region, etc.)
 * - HTTP API for PowerShell/external scripts
 * - Auto-alerts to subscribers
 */

import express from 'express';
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
import { getRfAlertsString, getGlobalThreats } from './src/rf_alerts.js';
import { initUpdater, trackAlertMessage, stopTracking } from './src/message_updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Express App ===
const app = express();
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
const statusTrackers = new Map(); // chatId -> { messageId, intervalId, lastRefresh, lastStatus }
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
        type: l.type
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
                await bot.sendPhoto(chatId, imagePath, { caption: text, parse_mode: 'HTML' });
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
async function buildStatusText(chatId, includeFooter = true) {
    const alerts = await fetchAlerts();
    const subs = await loadSubscribers();
    const sub = subs[chatId];
    const country = getCountrySummary(alerts);
    const now = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let text = `📊 <b>Статус тривог</b>\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;

    let currentStatus = 'safe'; // Track for status change detection

    if (country.oblastCount > 0) {
        text += `🔴 <b>Тривога в ${country.oblastCount} областях:</b>\n`;
        const shortNames = country.oblasts.map(o => o.replace(' область', ''));
        text += `📋 ${shortNames.join(', ')}`;
        if (country.hasMore) text += ` +ще`;
        text += `\n\n`;

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

    if (includeFooter) {
        text += `\n━━━━━━━━━━━━━━━\n`;
        text += `� Оновлено: ${now}\n`;
        text += `⏱️ Авто-оновлення: 45с`;
    }

    return { text, currentStatus };
}

const handleStatus = async (msg) => {
    const chatId = msg.chat.id;

    // Clear previous tracker if exists
    const existing = statusTrackers.get(chatId);
    if (existing?.intervalId) {
        clearInterval(existing.intervalId);
    }

    const { text, currentStatus } = await buildStatusText(chatId);

    const keyboard = {
        inline_keyboard: [[
            { text: '� Оновити', callback_data: 'refresh_status' }
        ]]
    };

    const sent = await bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard
    });

    // Start auto-update interval
    const intervalId = setInterval(async () => {
        try {
            const tracker = statusTrackers.get(chatId);
            if (!tracker) {
                clearInterval(intervalId);
                return;
            }

            const { text: newText, currentStatus: newStatus } = await buildStatusText(chatId);

            // Check if status changed - stop auto-update
            if (tracker.lastStatus && tracker.lastStatus !== newStatus) {
                clearInterval(intervalId);
                const finalText = newText + `\n\n🔔 <b>Статус змінився!</b> Авто-оновлення зупинено.`;
                await bot.editMessageText(finalText, {
                    chat_id: chatId,
                    message_id: tracker.messageId,
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                });
                statusTrackers.delete(chatId);
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
            clearInterval(intervalId);
            statusTrackers.delete(chatId);
        }
    }, AUTO_UPDATE_MS);

    statusTrackers.set(chatId, {
        messageId: sent.message_id,
        intervalId,
        lastRefresh: Date.now(),
        lastStatus: currentStatus
    });
};
bot.onText(/\/status/, handleStatus);

// Handle refresh button callback
bot.on('callback_query', async (query) => {
    if (query.data !== 'refresh_status') return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const tracker = statusTrackers.get(chatId);

    // Rate limiting
    if (tracker?.lastRefresh && Date.now() - tracker.lastRefresh < RATE_LIMIT_MS) {
        const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - tracker.lastRefresh)) / 1000);
        await bot.answerCallbackQuery(query.id, {
            text: `⏳ Зачекай ${waitSec} сек перед наступним оновленням`,
            show_alert: false
        });
        return;
    }

    try {
        const { text, currentStatus } = await buildStatusText(chatId);

        const keyboard = {
            inline_keyboard: [[
                { text: '🔄 Оновити', callback_data: 'refresh_status' }
            ]]
        };

        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });

        // Update tracker
        if (tracker) {
            tracker.lastRefresh = Date.now();
            tracker.lastStatus = currentStatus;
        }

        await bot.answerCallbackQuery(query.id, { text: '✅ Оновлено!' });
    } catch (e) {
        await bot.answerCallbackQuery(query.id, { text: '❌ Помилка оновлення' });
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

            const coords = getLocationCoords(sub.locationUid);
            const weather = await fetchWeather(coords.lat, coords.lon);
            const country = getCountrySummary(alerts);
            const summary = getAlertSummary(alerts, sub.locationUid);

            // Merge global threats
            const globalThreats = await getGlobalThreats();
            if (globalThreats.ballistics) summary.types['ballistics'] = true;
            if (globalThreats.strategic_aviation) summary.types['strategic_aviation'] = true;
            if (globalThreats.mig_takeoff) summary.types['mig_takeoff'] = true;
            if (globalThreats.mig_rockets) summary.types['mig_rockets'] = true;
            if (globalThreats.artillery) summary.types['artillery'] = true;
            if (globalThreats.boats) summary.types['boats'] = true;
            if (globalThreats.tactical_rockets) summary.types['tactical_rockets'] = true;

            let text = '';
            let baseText = '';

            if (isActive) {

                text = `🔴 <b>ТРИВОГА!</b>\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `📍 <b>${sub.locationName}</b>\n\n`;

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

                if (country.oblastCount > 0) {
                    text += `━━━━━━━━━━━━━━━\n`;
                    text += `<b>🇺🇦 В тривозі:</b> ${country.oblastCount} обл.\n`;
                    if (country.oblasts.length > 0) {
                        const shortNames = country.oblasts.map(o => o.replace(' область', ''));
                        text += `📋 ${shortNames.join(', ')}\n`;
                    }
                    text += `\n`;
                }

                if (weather) {
                    text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
                    text += `${weather.icon} ${weather.desc}\n`;
                    text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
                    text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n`;
                    text += `💧 Вологість: ${weather.humidity}%\n`;
                    text += `📊 Тиск: ${weather.pressure} гПа\n\n`;
                }

                text += `🚨 <b>Негайно в укриття!</b>`;
                baseText = text;
                const rfText = await getRfAlertsString();
                if (rfText) text += `\n\n${rfText}`;



            } else {
                text = `🟢 <b>Відбій тривоги</b>\n`;
                text += `━━━━━━━━━━━━━━━\n`;
                text += `📍 <b>${sub.locationName}</b>\n\n`;

                text += `✅ <b>Можна виходити</b> 😊\n\n`;

                if (weather) {
                    text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
                    text += `${weather.icon} ${weather.desc}\n`;
                    text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
                    text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n\n`;
                }

                if (country.oblastCount > 0) {
                    text += `━━━━━━━━━━━━━━━\n`;
                    text += `<b>🇺🇦 Ще в тривозі:</b> ${country.oblastCount} обл.\n`;
                    if (country.oblasts.length > 0) {
                        const shortNames = country.oblasts.map(o => o.replace(' область', ''));
                        text += `📋 ${shortNames.join(', ')}`;
                    }
                }
            }

            if (!isActive) {
                baseText = text;
                const rfText = await getRfAlertsString();
                if (rfText) text += `\n\n${rfText}`;
            }
            const imagePath = getRandomImage(isActive);

            try {
                const sentMsg = await bot.sendPhoto(chatId, imagePath, { caption: text, parse_mode: 'HTML' });
                log(`Alert sent to ${chatId}: ${isActive ? 'START' : 'END'}`);

                if (isActive) {
                    trackAlertMessage(chatId, sentMsg.message_id, baseText);
                    await addActiveAlert(chatId, sentMsg.message_id, sub.locationUid, baseText);
                } else {
                    stopTracking(chatId);
                    await removeActiveAlert(chatId);
                }

            } catch (e) {
                log(`Send failed: ${e.message}`);
                try {
                    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
                } catch (err) {
                    log(`Fallback failed: ${err.message}`);
                }
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

        const coords = getLocationCoords(targetUid);
        const weather = await fetchWeather(coords.lat, coords.lon);
        const country = getCountrySummary(alerts);
        const summary = getAlertSummary(alerts, targetUid);

        // Merge global threats
        const globalThreats = await getGlobalThreats();
        if (globalThreats.ballistics) summary.types['ballistics'] = true;
        if (globalThreats.strategic_aviation) summary.types['strategic_aviation'] = true;
        if (globalThreats.mig_takeoff) summary.types['mig_takeoff'] = true;
        if (globalThreats.mig_rockets) summary.types['mig_rockets'] = true;
        if (globalThreats.artillery) summary.types['artillery'] = true;
        if (globalThreats.boats) summary.types['boats'] = true;
        if (globalThreats.tactical_rockets) summary.types['tactical_rockets'] = true;

        let text = '';
        let baseText = '';

        if (isActive) {
            text = `🔴 <b>ТРИВОГА!</b>\n`;
            text += `━━━━━━━━━━━━━━━\n`;
            text += `📍 <b>${targetName}</b>\n\n`;

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

            if (country.oblastCount > 0) {
                text += `━━━━━━━━━━━━━━━\n`;
                text += `<b>🇺🇦 В тривозі:</b> ${country.oblastCount} обл.\n`;
                if (country.oblasts.length > 0) {
                    const shortNames = country.oblasts.map(o => o.replace(' область', ''));
                    text += `📋 ${shortNames.join(', ')}\n`;
                }
                text += `\n`;
            }

            if (weather) {
                text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
                text += `${weather.icon} ${weather.desc}\n`;
                text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
                text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n`;
                text += `💧 Вологість: ${weather.humidity}%\n`;
                text += `📊 Тиск: ${weather.pressure} гПа\n\n`;
            }

            text += `🚨 <b>Негайно в укриття!</b>`;
            baseText = text;
            const rfStartText = await getRfAlertsString();
            if (rfStartText) text += `\n\n${rfStartText}`;
        } else {
            text = `🟢 <b>Відбій тривоги</b>\n`;
            text += `━━━━━━━━━━━━━━━\n`;
            text += `📍 <b>${targetName}</b>\n\n`;

            text += `✅ <b>Можна виходити</b> 😊\n\n`;

            if (weather) {
                text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
                text += `${weather.icon} ${weather.desc}\n`;
                text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
                text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n\n`;
            }

            if (country.oblastCount > 0) {
                text += `━━━━━━━━━━━━━━━\n`;
                text += `<b>🇺🇦 Ще в тривозі:</b> ${country.oblastCount} обл.\n`;
                if (country.oblasts.length > 0) {
                    const shortNames = country.oblasts.map(o => o.replace(' область', ''));
                    text += `📋 ${shortNames.join(', ')}`;
                }
            }
        }

        if (!isActive) {
            baseText = text;
            const rfText = await getRfAlertsString();
            if (rfText) text += `\n\n${rfText}`;
        }
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

            try {
                const sentMsg = await bot.sendPhoto(chatId, imagePath, { caption: text, parse_mode: 'HTML' });
                log(`Broadcast to ${chatId}: ${isActive ? 'ALERT' : 'END'}`);

                if (isActive) {
                    trackAlertMessage(chatId, sentMsg.message_id, baseText);
                    await addActiveAlert(chatId, sentMsg.message_id, targetUid, baseText);
                } else {
                    stopTracking(chatId);
                    await removeActiveAlert(chatId);
                }
            } catch (e) {
                log(`Broadcast failed: ${e.message}`);
                // If blocked, stop tracking
                if (e.message.includes('blocked')) stopTracking(chatId);
            }
        }

        // Save to database with extended data (once per state change)
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
            rfInfo: rfText || null,
            countryInfo: country.oblastCount > 0 ? country.oblasts.map(o => o.replace(' область', '')).join(', ') : null
        });
    }
}

// =====================
// RESTORE ACTIVE ALERTS
// =====================
async function restoreActiveAlerts() {
    log('🔄 Restoring active alerts...');
    const activeRecords = await getAllActiveAlerts();
    const alerts = await fetchAlerts();

    for (const record of activeRecords) {
        const isActive = isAlertActive(alerts, record.location_uid);

        if (isActive) {
            log(`Re-tracking alert for ${record.chat_id}`);
            trackAlertMessage(record.chat_id, record.message_id, record.base_text);
        } else {
            log(`Alert finished while offline for ${record.chat_id}. Performing final update.`);

            // Final update with latest RF info
            const rfText = await getRfAlertsString();
            let finalText = record.base_text;
            if (rfText) finalText += `\n\n${rfText}`;

            try {
                await bot.editMessageCaption(finalText, {
                    chat_id: record.chat_id,
                    message_id: record.message_id,
                    parse_mode: 'HTML'
                });
            } catch (e) {
                log(`Final update failed for ${record.chat_id}: ${e.message}`);
            }

            await removeActiveAlert(record.chat_id);
        }
    }
}

// Check every 30 seconds
setInterval(checkAlertsForSubscribers, 30000);
setInterval(broadcastToGroups, 30000);

// =====================
// START TRAY INDICATOR
// =====================
import { spawn } from 'child_process';

function startTrayIndicator() {
    const scriptPath = path.join(__dirname, 'AlertFloat.ps1');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
        log(`⚠️ Tray script not found: ${scriptPath}`);
        return;
    }

    try {
        // Use Start-Process to launch in proper GUI context
        const ps = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-Command',
            `Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File "${scriptPath}"' -WindowStyle Hidden`
        ], {
            shell: true,
            detached: true,
            stdio: 'ignore'
        });

        ps.unref();
        log(`🎯 Tray indicator launched`);
    } catch (e) {
        log(`❌ Failed to start tray: ${e.message}`);
    }
}

// =====================
// START SERVER
// =====================
app.listen(PORT, () => {
    log(`🚀 Server started on port ${PORT}`);
    log(`🤖 Bot ${disablePolling ? 'SEND-ONLY' : 'POLLING'}`);
    log(`📍 Target: ${config.targetRegion}`);
    log(`📡 Broadcast to ${broadcastChatIds.length} groups`);

    // Restore alerts
    restoreActiveAlerts();

    // Start tray indicator after server is ready
    setTimeout(startTrayIndicator, 1000);
});
