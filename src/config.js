/**
 * Configuration Module
 * Environment variables and app settings
 */

import 'dotenv/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
export const config = require('../config.json');

// === Environment Variables ===
export const token = process.env.TELEGRAM_BOT_TOKEN;
export const alertsApiToken = process.env.ALERTS_API_TOKEN;
export const weatherApiKey = process.env.OPENWEATHERMAP_API_KEY;
export const PORT = process.env.PORT || 3002;

// Debug: check if weather key loaded
console.log(`[Config] Weather API key: ${weatherApiKey ? 'LOADED (' + weatherApiKey.slice(0, 5) + '...)' : 'NOT LOADED'}`);


// Broadcast chat IDs from env (groups that receive all alerts)
export const broadcastChatIds = process.env.TELEGRAM_CHAT_IDS
    ? process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim())
    : [];

// Polling control
export const disablePolling = process.env.DISABLE_POLLING === 'true';

// === File Paths ===
export const SUBSCRIBERS_FILE = 'subscribers.json';
export const HISTORY_FILE = 'history.json';
export const STATE_FILE = 'state.json';
