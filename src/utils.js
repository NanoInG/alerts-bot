/**
 * Utility Functions
 * Logging, helpers
 */

/**
 * Log with timestamp
 */
export function log(msg) {
    const now = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });
    console.log(`[${now}] ${msg}`);
}
