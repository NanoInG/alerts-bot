/**
 * Subscribers Module
 * Manage bot subscribers
 */

import fs from 'fs';
import { SUBSCRIBERS_FILE } from './config.js';
import { log } from './utils.js';

/**
 * Load subscribers from file
 */
export function loadSubscribers() {
    try {
        if (fs.existsSync(SUBSCRIBERS_FILE)) {
            return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
        }
    } catch (e) {
        log(`Error loading subscribers: ${e.message}`);
    }
    return {};
}

/**
 * Save subscribers to file
 */
export function saveSubscribers(subs) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2));
}

/**
 * Subscribe a user to alerts
 */
export function subscribe(chatId, username, location) {
    const subs = loadSubscribers();
    subs[chatId] = {
        chatId,
        username,
        locationUid: location.uid,
        locationName: location.name,
        locationType: location.type,
        subscribedAt: new Date().toISOString(),
        lastAlertState: false
    };
    saveSubscribers(subs);
    log(`✅ Subscribed: ${chatId} (${username}) -> ${location.name}`);
    return subs[chatId];
}

/**
 * Unsubscribe a user
 */
export function unsubscribe(chatId) {
    const subs = loadSubscribers();
    if (subs[chatId]) {
        const name = subs[chatId].locationName;
        delete subs[chatId];
        saveSubscribers(subs);
        log(`❌ Unsubscribed: ${chatId} from ${name}`);
        return true;
    }
    return false;
}
