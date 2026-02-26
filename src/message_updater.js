import { fetchAlerts } from './alerts.js';
import { buildAlertMessage } from './alert_generator.js';

let bot = null;
const tracked = new Map(); // chatId -> { messageId, locationUid, locationName, lastSentText }
const UPDATE_INTERVAL = 60 * 1000; // 1 minute
let intervalId = null;

export function initUpdater(botInstance) {
    bot = botInstance;
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(runUpdates, UPDATE_INTERVAL);
    console.log('✅ Message Updater initialized (2 min interval)');
}

export function trackAlertMessage(chatId, messageId, locationUid, locationName) {
    tracked.set(chatId, {
        messageId,
        locationUid,
        locationName,
        lastSentText: '' // Force update on first run if needed, or set to null
    });
}

export function stopTracking(chatId) {
    tracked.delete(chatId);
}

async function runUpdates() {
    if (tracked.size === 0) return;

    // 1. Fetch fresh alerts once
    const alerts = await fetchAlerts();

    // 2. Iterate and update
    const tasks = Array.from(tracked.entries());
    console.log(`🔄 Running live updates for ${tasks.length} chats...`);

    for (const [chatId, data] of tasks) {
        try {
            // Re-generate full message text
            const newText = await buildAlertMessage(data.locationUid, data.locationName, alerts);

            // Only update if text changed
            if (newText !== data.lastSentText) {
                await bot.editMessageCaption(newText, {
                    chat_id: chatId,
                    message_id: data.messageId,
                    parse_mode: 'HTML'
                });

                // Update local state
                data.lastSentText = newText;
                tracked.set(chatId, data);
            }

        } catch (e) {
            // Ignore "message is not modified" errors
            if (e.message.includes('message is not modified')) {
                // do nothing
            } else {
                console.error(`⚠️ Failed to update message for ${chatId}: ${e.message}`);

                // If message not found/user blocked, stop tracking
                if (e.message.includes('message to edit not found') || e.message.includes('bot was blocked') || e.message.includes('chat not found')) {
                    stopTracking(chatId);
                }
            }
        }

        // Small delay
        await new Promise(r => setTimeout(r, 50));
    }
}
