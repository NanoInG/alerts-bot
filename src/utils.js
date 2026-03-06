/**
 * Utility Functions
 * Logging, helpers
 */

// === Стандартизований логер [YYYY.MM.DD HH:MM:SS] [LEVEL] ===
function formatTs() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function log(msg, level = 'INFO') {
    console.log(`[${formatTs()}] [${level}] ${msg}`);
}

export function logWarn(msg) { log(msg, 'WARN'); }
export function logError(msg) { log(msg, 'ERROR'); }
export function logDebug(msg) { log(msg, 'DEBUG'); }
