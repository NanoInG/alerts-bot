import 'dotenv/config';
import fetch from 'node-fetch';
import cron from 'node-cron';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('./config.json');

// Console title
process.stdout.write('\x1b]2;Alerts\x1b\x5c');

// Load from environment
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatIds = process.env.TELEGRAM_CHAT_IDS?.split(',') || [];
const alertsApiToken = process.env.ALERTS_API_TOKEN;

const telegramApiSendDocument = `https://api.telegram.org/bot${telegramBotToken}/sendDocument`;
const telegramApiEditCaption = `https://api.telegram.org/bot${telegramBotToken}/editMessageCaption`;
const alertsApiEndpoint = 'https://api.alerts.in.ua/v1/alerts/active.json';

// Config values
const { targetRegion, targetRegionUid, pollIntervalMs, gifs, retryConfig, weather } = config;

// State
let alertHistory = {};
let activeAlerts = {};
let today = new Date().toLocaleDateString('uk-UA', { timeZone: 'Europe/Kiev' });
let resetCounterAfterAlert = false;
let sentMessages = {};
let lastAlertData = null; // Store last API response for comparison

// Alert type translations
const alertTypeNames = {
    'air_raid': '🚨 Повітряна тривога',
    'artillery_shelling': '💥 Загроза артобстрілу',
    'urban_fights': '⚔️ Вуличні бої',
    'chemical': '☣️ Хімічна загроза',
    'nuclear': '☢️ Радіаційна загроза',
    'unknown': '⚠️ Загроза'
};

// Alert type emojis for compact display
const alertTypeEmojis = {
    'air_raid': '🚨',
    'artillery_shelling': '💥',
    'urban_fights': '⚔️',
    'chemical': '☣️',
    'nuclear': '☢️',
    'unknown': '⚠️'
};

// === Logging with timestamp ===
function log(message) {
    const timestamp = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });
    console.log(`[${timestamp}] ${message}`);
}

function logError(message, error) {
    const timestamp = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });
    console.error(`[${timestamp}] ${message}`, error || '');
}

// === Helper functions ===
function getRandomGifNumber() {
    return Math.floor(Math.random() * 3) + 1;
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}год ${minutes % 60}хв`;
    } else if (minutes > 0) {
        return `${minutes}хв ${seconds % 60}с`;
    }
    return `${seconds}с`;
}

function getWeatherEmoji(code) {
    const weatherEmojis = {
        0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
        45: '🌫️', 48: '🌫️',
        51: '🌧️', 53: '🌧️', 55: '🌧️',
        61: '🌧️', 63: '🌧️', 65: '🌧️',
        71: '🌨️', 73: '🌨️', 75: '🌨️',
        80: '🌦️', 81: '🌦️', 82: '🌦️',
        95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return weatherEmojis[code] || '🌡️';
}

// === Weather API (Open-Meteo) ===
async function getWeather() {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${weather.lat}&longitude=${weather.lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Europe/Kiev`;
        const response = await fetch(url);
        const data = await response.json();

        const temp = Math.round(data.current.temperature_2m);
        const windSpeed = Math.round(data.current.wind_speed_10m);
        const weatherCode = data.current.weather_code;
        const emoji = getWeatherEmoji(weatherCode);

        return `${emoji} ${temp}°C, вітер ${windSpeed} км/год`;
    } catch (error) {
        logError('Weather API error:', error);
        return null;
    }
}

// === Retry logic with exponential backoff ===
async function fetchWithRetry(url, options = {}, retries = retryConfig.maxRetries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && attempt < retries) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            const delay = retryConfig.baseDelayMs * Math.pow(2, attempt);
            log(`Retry ${attempt + 1}/${retries} after ${delay}ms: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// === Alerts.in.ua API ===
async function fetchAlertsInUa() {
    try {
        const response = await fetchWithRetry(alertsApiEndpoint, {
            headers: {
                'Authorization': `Bearer ${alertsApiToken}`
            }
        });
        const data = await response.json();
        return data.alerts || [];
    } catch (error) {
        logError('Alerts.in.ua API error:', error);
        return null;
    }
}

// Get alerts for target region (oblast level)
function getTargetRegionAlerts(alerts) {
    return alerts.filter(a =>
        a.location_oblast_uid === targetRegionUid ||
        a.location_uid === targetRegionUid
    );
}

// Get all unique alert types in target region
function getAlertTypes(alerts) {
    const types = [...new Set(alerts.map(a => a.alert_type))];
    return types.map(t => alertTypeEmojis[t] || '⚠️').join(' ');
}

// Get affected districts/communities
function getAffectedAreas(alerts) {
    const raions = [...new Set(alerts
        .filter(a => a.location_raion && a.location_type !== 'oblast')
        .map(a => a.location_raion)
    )];
    return raions.slice(0, 3); // Max 3 for compact display
}

// Get notes (threat info)
function getNotes(alerts) {
    const notes = alerts
        .filter(a => a.notes && a.notes.trim())
        .map(a => a.notes.trim());
    return [...new Set(notes)].slice(0, 2); // Max 2 notes
}

// === State management ===
function loadAlertHistory() {
    if (fs.existsSync('state.json')) {
        try {
            const data = fs.readFileSync('state.json', 'utf-8');
            log(`Завантажено state.json (${data.length} bytes)`);

            if (data.trim()) {
                const parsedData = JSON.parse(data);
                alertHistory = parsedData.alertHistory || {};
                activeAlerts = parsedData.activeAlerts || {};
                sentMessages = parsedData.sentMessages || {};
            } else {
                alertHistory = {};
                activeAlerts = {};
                sentMessages = {};
            }
        } catch (error) {
            logError('Помилка парсингу state.json:', error);
            alertHistory = {};
            activeAlerts = {};
            sentMessages = {};
        }
    } else {
        log('Файл state.json не існує, створюю новий');
        alertHistory = {};
        activeAlerts = {};
        sentMessages = {};
    }
}

function saveAlertHistory() {
    fs.writeFile('state.json', JSON.stringify({ alertHistory, activeAlerts, sentMessages }, null, 2), (err) => {
        if (err) {
            logError('Помилка збереження state.json:', err);
        }
    });
}

function resetDailyCount() {
    if (!activeAlerts[targetRegion]) {
        today = new Date().toLocaleDateString('uk-UA', { timeZone: 'Europe/Kiev' });
        for (const region in alertHistory) {
            alertHistory[region].count = 1;
        }
        saveAlertHistory();
        log('Daily count reset');
        resetCounterAfterAlert = false;
    } else {
        log(`Тривога активна в ${targetRegion}, скидання відкладено.`);
        resetCounterAfterAlert = true;
    }
}

// === Build enhanced alert message ===
async function buildAlertMessage(alertCount, startedAt, isActive, regionAlerts = []) {
    const weatherInfo = await getWeather();
    const now = new Date();

    // Count active oblasts
    const activeOblasts = lastAlertData ?
        [...new Set(lastAlertData.filter(a => a.location_type === 'oblast').map(a => a.location_uid))].length : 0;

    if (isActive) {
        const startTime = sentMessages.alertStartTime || now.getTime();
        const duration = formatDuration(now.getTime() - startTime);

        // Get threat types
        const threatTypes = getAlertTypes(regionAlerts);
        const affectedAreas = getAffectedAreas(regionAlerts);
        const notes = getNotes(regionAlerts);

        let msg = `🔴 <b>ТРИВОГА</b> #${alertCount}\n`;
        msg += `📍 ${targetRegion}\n`;

        if (threatTypes) {
            msg += `⚠️ Загрози: ${threatTypes}\n`;
        }

        msg += `⏱️ Триває: <b>${duration}</b>\n`;

        if (activeOblasts > 1) {
            msg += `🗺️ Тривога в ${activeOblasts} областях\n`;
        }

        if (affectedAreas.length > 0) {
            msg += `📌 Райони: ${affectedAreas.join(', ')}\n`;
        }

        if (notes.length > 0) {
            msg += `\n💬 <i>${notes.join('; ')}</i>\n`;
        }

        if (weatherInfo) {
            msg += `\n${weatherInfo}`;
        }

        return msg;
    } else {
        // Alert ended
        const endTime = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });

        let msg = `🟢 <b>ВІДБІЙ</b> #${alertCount}\n`;
        msg += `📍 ${targetRegion}\n`;
        msg += `🕐 ${endTime}\n`;

        if (weatherInfo) {
            msg += `\n${weatherInfo}`;
        }
        msg += `\nВипаковуємось! 😘`;

        return msg;
    }
}

// === Core alert logic ===
async function fetchAlertData() {
    try {
        const alerts = await fetchAlertsInUa();
        if (alerts === null) return; // API error, skip this cycle

        lastAlertData = alerts;
        await checkAndSendAlerts(alerts);
    } catch (error) {
        logError('Error fetching alert data:', error);
    }
}

async function checkAndSendAlerts(alerts) {
    // Get alerts for target region
    const regionAlerts = getTargetRegionAlerts(alerts);
    const hasActiveAlert = regionAlerts.length > 0;

    // Initialize history if needed
    if (!alertHistory[targetRegion]) {
        alertHistory[targetRegion] = { count: 1, enabled: false };
    }

    // Check all oblasts for activeAlerts tracking
    const allOblasts = [...new Set(alerts.map(a => a.location_oblast || a.location_title))];
    for (const oblast of allOblasts) {
        activeAlerts[oblast] = true;
    }

    // Clear oblasts that are no longer active
    for (const oblast in activeAlerts) {
        if (!allOblasts.includes(oblast)) {
            activeAlerts[oblast] = false;
        }
    }

    // Alert started in target region
    if (hasActiveAlert && !alertHistory[targetRegion].enabled) {
        alertHistory[targetRegion].enabled = true;
        const startTime = regionAlerts[0]?.started_at ?
            new Date(regionAlerts[0].started_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' }) :
            new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });

        alertHistory[targetRegion][startTime] = { count: alertHistory[targetRegion].count, type: 'enabled' };

        const message = await buildAlertMessage(alertHistory[targetRegion].count, startTime, true, regionAlerts);
        const gifNumber = getRandomGifNumber();
        const documentUrl = `${gifs.alertStart}${gifNumber}.gif`;

        log(`🔴 ТРИВОГА: ${targetRegion} (${regionAlerts.length} alerts)`);
        sentMessages.alertStartTime = Date.now();
        await sendTelegramDocument(message, documentUrl, telegramChatIds);

        alertHistory[targetRegion].count++;
    }

    // Alert ended in target region
    else if (!hasActiveAlert && alertHistory[targetRegion].enabled) {
        alertHistory[targetRegion].enabled = false;
        const endTime = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });

        alertHistory[targetRegion][endTime] = { count: alertHistory[targetRegion].count - 1, type: 'disabled' };

        const message = await buildAlertMessage(alertHistory[targetRegion].count - 1, endTime, false, []);
        const gifNumber = getRandomGifNumber();
        const documentUrl = `${gifs.alertEnd}${gifNumber}.gif`;

        log(`🟢 ВІДБІЙ: ${targetRegion}`);
        await sendTelegramDocument(message, documentUrl, telegramChatIds);

        sentMessages = {};

        if (resetCounterAfterAlert) {
            resetDailyCount();
        }
    }

    // Live update during active alert
    else if (hasActiveAlert && Object.keys(sentMessages).length > 1) {
        await updateActiveAlertMessage(regionAlerts);
    }

    saveAlertHistory();
}

// === Live update the active alert message ===
async function updateActiveAlertMessage(regionAlerts) {
    const count = alertHistory[targetRegion]?.count - 1 || 1;
    const message = await buildAlertMessage(count, null, true, regionAlerts);

    for (const chatId of telegramChatIds) {
        const messageId = sentMessages[chatId];
        if (!messageId) continue;

        try {
            await fetch(telegramApiEditCaption, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    caption: message,
                    parse_mode: 'HTML'
                }),
            });
        } catch (error) {
            // Ignore edit errors
        }
    }
    log(`📝 Оновлено (${formatDuration(Date.now() - sentMessages.alertStartTime)})`);
}

async function sendTelegramDocument(caption, documentUrl, chatIds) {
    try {
        for (const chatId of chatIds) {
            const response = await fetchWithRetry(telegramApiSendDocument, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    caption: caption,
                    document: documentUrl,
                    parse_mode: 'HTML'
                }),
            });

            const result = await response.json();
            if (result.ok && result.result?.message_id) {
                sentMessages[chatId] = result.result.message_id;
            }

            log(`Надіслано в чат ${chatId}`);
        }
    } catch (error) {
        logError('Error sending to Telegram:', error);
    }
}

// === Graceful shutdown ===
function gracefulShutdown(signal) {
    log(`Отримано ${signal}, зберігаю стан...`);
    saveAlertHistory();
    setTimeout(() => {
        log('Бот завершив роботу.');
        process.exit(0);
    }, 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// === Startup ===
log('🚀 Alerts Bot v2.0 запущено');
log(`📍 Регіон: ${targetRegion} (UID: ${targetRegionUid})`);
log(`⏱️ Інтервал: ${pollIntervalMs}ms`);
log(`🔑 API: alerts.in.ua`);
log(`🌤️ Погода: ${weather.city}`);

loadAlertHistory();

// Daily reset at midnight
cron.schedule('0 0 * * *', () => {
    resetDailyCount();
});

// Main polling loop
setInterval(() => {
    fetchAlertData();
}, pollIntervalMs);

// Initial fetch
fetchAlertData();