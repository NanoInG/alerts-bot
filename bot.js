/**
 * Telegram Bot Commands Handler
 * /start - Привітання
 * /subscribe - Підписатись на тривоги
 * /unsubscribe - Відписатись
 * /region - Обрати область
 * /status - Поточний статус
 */

import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import fetch from 'node-fetch';

const token = process.env.TELEGRAM_BOT_TOKEN;
const alertsApiToken = process.env.ALERTS_API_TOKEN;

// Create bot with polling
const bot = new TelegramBot(token, { polling: true });

// Subscribers storage
const SUBSCRIBERS_FILE = 'subscribers.json';

// Ukrainian oblasts with UIDs from alerts.in.ua
const OBLASTS = [
    { uid: '1', name: 'Вінницька', short: 'Вінниця' },
    { uid: '2', name: 'Волинська', short: 'Волинь' },
    { uid: '3', name: 'Дніпропетровська', short: 'Дніпро' },
    { uid: '4', name: 'Донецька', short: 'Донецьк' },
    { uid: '5', name: 'Житомирська', short: 'Житомир' },
    { uid: '6', name: 'Закарпатська', short: 'Закарпаття' },
    { uid: '7', name: 'Запорізька', short: 'Запоріжжя' },
    { uid: '8', name: 'Івано-Франківська', short: 'Ів-Франківськ' },
    { uid: '9', name: 'Київська', short: 'Київ обл.' },
    { uid: '10', name: 'Кіровоградська', short: 'Кропивницький' },
    { uid: '11', name: 'Луганська', short: 'Луганськ' },
    { uid: '12', name: 'Львівська', short: 'Львів' },
    { uid: '13', name: 'Миколаївська', short: 'Миколаїв' },
    { uid: '14', name: 'Одеська', short: 'Одеса' },
    { uid: '15', name: 'Полтавська', short: 'Полтава' },
    { uid: '16', name: 'Рівненська', short: 'Рівне' },
    { uid: '17', name: 'Сумська', short: 'Суми' },
    { uid: '18', name: 'Тернопільська', short: 'Тернопіль' },
    { uid: '19', name: 'Харківська', short: 'Харків' },
    { uid: '20', name: 'Херсонська', short: 'Херсон' },
    { uid: '21', name: 'Хмельницька', short: 'Хмельницький' },
    { uid: '22', name: 'Черкаська', short: 'Черкаси' },
    { uid: '23', name: 'Чернівецька', short: 'Чернівці' },
    { uid: '24', name: 'Чернігівська', short: 'Чернігів' },
    { uid: '25', name: 'м. Київ', short: 'Київ' }
];

// === Subscribers Management ===
function loadSubscribers() {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
        try {
            const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveSubscribers(subscribers) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
}

function getSubscriber(chatId) {
    const subscribers = loadSubscribers();
    return subscribers[chatId] || null;
}

function subscribe(chatId, username, regionUid, regionName) {
    const subscribers = loadSubscribers();
    subscribers[chatId] = {
        chatId,
        username: username || 'unknown',
        regionUid,
        regionName,
        subscribedAt: new Date().toISOString()
    };
    saveSubscribers(subscribers);
}

function unsubscribe(chatId) {
    const subscribers = loadSubscribers();
    if (subscribers[chatId]) {
        delete subscribers[chatId];
        saveSubscribers(subscribers);
        return true;
    }
    return false;
}

function getAllSubscribers() {
    return loadSubscribers();
}

// Get subscribers for a specific region
function getSubscribersForRegion(regionUid) {
    const subscribers = loadSubscribers();
    return Object.values(subscribers).filter(s => s.regionUid === regionUid);
}

// === Fetch current alerts ===
async function getCurrentAlerts() {
    try {
        const response = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
            headers: { 'Authorization': `Bearer ${alertsApiToken}` }
        });
        const data = await response.json();
        return data.alerts || [];
    } catch (e) {
        return [];
    }
}

// === Bot Commands ===

// /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'друже';

    const subscriber = getSubscriber(chatId);
    let text = `👋 Привіт, ${name}!\n\n`;
    text += `Я бот сповіщень про повітряні тривоги.\n\n`;

    if (subscriber) {
        text += `✅ Ти вже підписаний на: <b>${subscriber.regionName}</b>\n\n`;
    }

    text += `<b>Команди:</b>\n`;
    text += `/subscribe - Підписатись на тривоги\n`;
    text += `/unsubscribe - Відписатись\n`;
    text += `/region - Змінити область\n`;
    text += `/status - Поточний статус тривог`;

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// /subscribe
bot.onText(/\/subscribe/, async (msg) => {
    const chatId = msg.chat.id;
    const subscriber = getSubscriber(chatId);

    if (subscriber) {
        await bot.sendMessage(chatId,
            `✅ Ти вже підписаний на: <b>${subscriber.regionName}</b>\n\nВикористай /region щоб змінити область.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    // Show region selection
    await showRegionSelection(chatId, 'subscribe');
});

// /unsubscribe
bot.onText(/\/unsubscribe/, async (msg) => {
    const chatId = msg.chat.id;

    if (unsubscribe(chatId)) {
        await bot.sendMessage(chatId, '❌ Ти відписався від сповіщень.\n\nВикористай /subscribe щоб підписатись знову.');
    } else {
        await bot.sendMessage(chatId, '⚠️ Ти ще не підписаний. Використай /subscribe');
    }
});

// /region
bot.onText(/\/region/, async (msg) => {
    const chatId = msg.chat.id;
    await showRegionSelection(chatId, 'region');
});

// /status
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const subscriber = getSubscriber(chatId);

    const alerts = await getCurrentAlerts();
    const activeOblasts = [...new Set(alerts.filter(a => a.location_type === 'oblast').map(a => a.location_title))];

    let text = `📊 <b>Статус тривог</b>\n\n`;

    if (activeOblasts.length === 0) {
        text += `🟢 Наразі тривог немає\n`;
    } else {
        text += `🔴 Тривога в ${activeOblasts.length} областях:\n`;
        text += activeOblasts.slice(0, 10).map(o => `• ${o}`).join('\n');
        if (activeOblasts.length > 10) {
            text += `\n...та ще ${activeOblasts.length - 10}`;
        }
    }

    if (subscriber) {
        const regionAlert = alerts.find(a => a.location_oblast_uid === subscriber.regionUid || a.location_uid === subscriber.regionUid);
        text += `\n\n📍 <b>Твоя область (${subscriber.regionName}):</b>\n`;
        text += regionAlert ? '🔴 ТРИВОГА!' : '🟢 Без тривоги';
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// Show region selection keyboard
async function showRegionSelection(chatId, action, page = 0) {
    const pageSize = 8;
    const totalPages = Math.ceil(OBLASTS.length / pageSize);
    const start = page * pageSize;
    const pageOblasts = OBLASTS.slice(start, start + pageSize);

    // Create buttons grid (2 columns)
    const keyboard = [];
    for (let i = 0; i < pageOblasts.length; i += 2) {
        const row = [];
        row.push({
            text: pageOblasts[i].short,
            callback_data: `${action}:${pageOblasts[i].uid}`
        });
        if (pageOblasts[i + 1]) {
            row.push({
                text: pageOblasts[i + 1].short,
                callback_data: `${action}:${pageOblasts[i + 1].uid}`
            });
        }
        keyboard.push(row);
    }

    // Pagination buttons
    const navRow = [];
    if (page > 0) {
        navRow.push({ text: '⬅️ Назад', callback_data: `page:${action}:${page - 1}` });
    }
    if (page < totalPages - 1) {
        navRow.push({ text: 'Далі ➡️', callback_data: `page:${action}:${page + 1}` });
    }
    if (navRow.length > 0) {
        keyboard.push(navRow);
    }

    await bot.sendMessage(chatId, '🗺️ <b>Обери свою область:</b>', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}

// Handle callback queries (button presses)
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    const username = callbackQuery.from.username;

    // Pagination
    if (data.startsWith('page:')) {
        const [, action, pageStr] = data.split(':');
        const page = parseInt(pageStr);

        // Delete old message and show new page
        try {
            await bot.deleteMessage(chatId, messageId);
        } catch (e) { }

        await showRegionSelection(chatId, action, page);
        await bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    // Region selection
    if (data.startsWith('subscribe:') || data.startsWith('region:')) {
        const [action, regionUid] = data.split(':');
        const oblast = OBLASTS.find(o => o.uid === regionUid);

        if (oblast) {
            const regionName = oblast.name + ' область';
            subscribe(chatId, username, regionUid, regionName);

            // Delete selection message
            try {
                await bot.deleteMessage(chatId, messageId);
            } catch (e) { }

            await bot.sendMessage(chatId,
                `✅ <b>Готово!</b>\n\n📍 Ти підписався на: <b>${regionName}</b>\n\nІ будеш отримувати сповіщення про тривоги.`,
                { parse_mode: 'HTML' }
            );
        }

        await bot.answerCallbackQuery(callbackQuery.id);
    }
});

// Log
console.log('🤖 Bot started! Listening for commands...');
console.log('Commands: /start, /subscribe, /unsubscribe, /region, /status');
