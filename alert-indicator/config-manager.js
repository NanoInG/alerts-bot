/**
 * Config Manager
 * Reads/writes alert_config.json (shared with legacy PS script)
 */

const fs = require('fs');
const path = require('path');

// Config file is in the parent directory (same as PS script uses)
const CONFIG_PATH = path.join(__dirname, '..', 'alert_config.json');

const DEFAULT_CONFIG = {
    City: '24',           // Черкаська область (default)
    SoundEnabled: true,
    FloatingVisible: false,
    StripHeight: 1,
    Colors: {
        safe: '#2ECC71',
        alert: '#E74C3C',
        error: '#F39C12'
    }
};

/**
 * Load config from JSON file, fallback to defaults
 */
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            let raw = fs.readFileSync(CONFIG_PATH, 'utf8');
            // Strip BOM (PowerShell writes UTF-16/UTF-8 with BOM)
            raw = raw.replace(/^\uFEFF/, '').replace(/^\xEF\xBB\xBF/, '');
            // Strip any null bytes from UTF-16
            raw = raw.replace(/\0/g, '');
            const parsed = JSON.parse(raw);
            return { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch (err) {
        console.error('[Config] Failed to read config:', err.message);
    }
    return { ...DEFAULT_CONFIG };
}

/**
 * Save config to JSON file
 */
function saveConfig(config) {
    try {
        const data = JSON.stringify(config, null, 4);
        fs.writeFileSync(CONFIG_PATH, data, 'utf8');
    } catch (err) {
        console.error('[Config] Failed to save config:', err.message);
    }
}

module.exports = { loadConfig, saveConfig, DEFAULT_CONFIG };
