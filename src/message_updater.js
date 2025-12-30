import { getRfAlertsString } from './rf_alerts.js';

let bot = null;
const tracked = new Map(); // chatId -> { messageId, baseText, lastSentText }
const UPDATE_INTERVAL = 2 * 60 * 1000; // 2 minutes
let intervalId = null;

export function initUpdater(botInstance) {
    bot = botInstance;
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(runUpdates, UPDATE_INTERVAL);
    console.log('✅ Message Updater initialized (2 min interval)');
}

export function trackAlertMessage(chatId, messageId, baseText) {
    tracked.set(chatId, {
        messageId,
        baseText,
        lastSentText: baseText
    });
}

export function stopTracking(chatId) {
    tracked.delete(chatId);
}

async function runUpdates() {
    if (tracked.size === 0) return;

    // 1. Fetch RF Alerts data once for all messages
    const rfText = await getRfAlertsString();

    // 2. Iterate and update
    // We iterate sequentially with a small delay to avoid rate limits
    // Convert map to array to iterate
    const tasks = Array.from(tracked.entries());

    console.log(`🔄 Running live updates for ${tasks.length} chats...`);

    for (const [chatId, data] of tasks) {
        try {
            // Construct new text
            let newText = data.baseText;

            // Add RF info if available
            if (rfText) {
                newText += `\n\n${rfText}`;
            }

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
                // If message not found/user blocked, maybe stop tracking?
                if (e.message.includes('message to edit not found') || e.message.includes('bot was blocked')) {
                    stopTracking(chatId);
                }
            }
        }

        // Small delay between requests (e.g., 50ms = 20 msg/sec max)
        await new Promise(r => setTimeout(r, 50));
    }
}
