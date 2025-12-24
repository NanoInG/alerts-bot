/**
 * Subscribers Module
 * Manage bot subscribers (Database version)
 */

import { pool } from './db.js';
import { log } from './utils.js';

// Cache for subscribers to reduce DB calls
let subscribersCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Load subscribers from database
 * Returns object with chatId as key for backwards compatibility
 */
export async function loadSubscribers() {
    // Use cache if fresh
    if (subscribersCache && Date.now() - cacheTimestamp < CACHE_TTL) {
        return subscribersCache;
    }

    try {
        const [rows] = await pool.query(`
            SELECT 
                chat_id as chatId,
                username,
                location_uid as locationUid,
                location_name as locationName,
                location_type as locationType,
                last_alert_state as lastAlertState,
                subscribed_at as subscribedAt
            FROM subscribers
        `);

        // Convert to object with chatId as key (backwards compatible)
        const subs = {};
        for (const row of rows) {
            subs[row.chatId] = {
                chatId: row.chatId.toString(),
                username: row.username,
                locationUid: row.locationUid,
                locationName: row.locationName,
                locationType: row.locationType,
                lastAlertState: Boolean(row.lastAlertState),
                subscribedAt: row.subscribedAt
            };
        }

        subscribersCache = subs;
        cacheTimestamp = Date.now();
        return subs;
    } catch (e) {
        log(`Error loading subscribers from DB: ${e.message}`);
        return subscribersCache || {};
    }
}

/**
 * Save subscribers - updates cache and specific fields in DB
 * For individual updates, use updateSubscriber instead
 */
export async function saveSubscribers(subs) {
    subscribersCache = subs;
    cacheTimestamp = Date.now();
    // Note: Individual updates are handled by subscribe/unsubscribe/updateSubscriber
}

/**
 * Update subscriber's lastAlertState
 */
export async function updateSubscriberAlertState(chatId, lastAlertState) {
    try {
        await pool.query(
            'UPDATE subscribers SET last_alert_state = ? WHERE chat_id = ?',
            [lastAlertState, chatId]
        );

        // Update cache
        if (subscribersCache && subscribersCache[chatId]) {
            subscribersCache[chatId].lastAlertState = lastAlertState;
        }
    } catch (e) {
        log(`Error updating subscriber alert state: ${e.message}`);
    }
}

/**
 * Subscribe a user to alerts
 */
export async function subscribe(chatId, username, location) {
    try {
        await pool.query(`
            INSERT INTO subscribers (chat_id, username, location_uid, location_name, location_type, last_alert_state)
            VALUES (?, ?, ?, ?, ?, FALSE)
            ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                location_uid = VALUES(location_uid),
                location_name = VALUES(location_name),
                location_type = VALUES(location_type)
        `, [chatId, username, location.uid, location.name, location.type]);

        log(`✅ Subscribed: ${chatId} (${username}) -> ${location.name}`);

        // Invalidate cache
        subscribersCache = null;

        return {
            chatId: chatId.toString(),
            username,
            locationUid: location.uid,
            locationName: location.name,
            locationType: location.type,
            lastAlertState: false
        };
    } catch (e) {
        log(`Error subscribing: ${e.message}`);
        return null;
    }
}

/**
 * Unsubscribe a user
 */
export async function unsubscribe(chatId) {
    try {
        const [result] = await pool.query(
            'DELETE FROM subscribers WHERE chat_id = ?',
            [chatId]
        );

        if (result.affectedRows > 0) {
            log(`❌ Unsubscribed: ${chatId}`);
            // Invalidate cache
            subscribersCache = null;
            return true;
        }
        return false;
    } catch (e) {
        log(`Error unsubscribing: ${e.message}`);
        return false;
    }
}

/**
 * Migrate existing JSON subscribers to database
 */
export async function migrateFromJson(jsonPath = 'subscribers.json') {
    const fs = await import('fs');

    if (!fs.existsSync(jsonPath)) {
        log('No subscribers.json file found, skipping migration');
        return 0;
    }

    try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        let migrated = 0;

        for (const [chatId, sub] of Object.entries(data)) {
            try {
                await pool.query(`
                    INSERT INTO subscribers (chat_id, username, location_uid, location_name, location_type, last_alert_state, subscribed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        username = VALUES(username),
                        location_uid = VALUES(location_uid),
                        location_name = VALUES(location_name)
                `, [
                    chatId,
                    sub.username || null,
                    sub.locationUid,
                    sub.locationName,
                    sub.locationType || 'oblast',
                    sub.lastAlertState || false,
                    sub.subscribedAt ? new Date(sub.subscribedAt) : new Date()
                ]);
                migrated++;
            } catch (e) {
                log(`Migration error for ${chatId}: ${e.message} `);
            }
        }

        log(`📦 Migrated ${migrated} subscribers from JSON to database`);
        return migrated;
    } catch (e) {
        log(`Migration failed: ${e.message} `);
        return 0;
    }
}
