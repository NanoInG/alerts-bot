/**
 * Alert Indicator - Electron Main Process
 * Full replacement of AlertFloat.ps1 PowerShell script
 * 
 * Features:
 *  - System tray icon (green/red/orange)
 *  - Floating alert strip on all monitors
 *  - Sound alerts (MP3 via renderer IPC)
 *  - Location picker (oblast + rayon submenu)
 *  - Config persistence (alert_config.json)
 *  - History viewer (opens browser)
 *  - Testing menu (simulate + bot API)
 *  - Duplicate prevention (single instance lock)
 */

const { app, BrowserWindow, Tray, Menu, Notification, screen, ipcMain, shell } = require('electron');
const path = require('path');
const { loadConfig, saveConfig } = require('./config-manager');
const { getIcons } = require('./tray-icons');
const { fetchStatus, fetchLocations, sendTestAlert, API_BASE } = require('./poller');

// === Single Instance Lock ===
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    console.log('Another instance is already running. Exiting.');
    app.quit();
}

// === State ===
let tray = null;
let stripWindows = [];
let settingsWindow = null;
let config = loadConfig();
let currentState = null;   // null | 'safe' | 'alert' | 'error'
let lastAlertValue = null;  // track previous alert boolean for change detection
let pollTimer = null;
let locations = [];         // fetched from API

const POLL_INTERVAL = 30000; // 30 seconds, same as PS script

// =====================
// APP READY
// =====================
app.whenReady().then(async () => {
    console.log('🌿 Alert Indicator - Electron Edition starting...');

    // Fetch locations from API for the menu
    try {
        locations = await fetchLocations();
        console.log(`📍 Loaded ${locations.length} locations from API`);
    } catch (err) {
        console.error('❌ Failed to fetch locations:', err.message);
    }

    // Create tray
    createTray();

    // Create floating strip windows
    createStripWindows();

    // Start polling
    doCheck();
    pollTimer = setInterval(doCheck, POLL_INTERVAL);

    // 🌿 Shadow Wakeup: Примусово виводимо нитку на передній план кожні 5 сек 🚬
    // Це шоб Пуск та інші системні вікна не закривали наше зілля.
    setInterval(() => {
        for (const strip of stripWindows) {
            if (strip && !strip.isDestroyed() && config.FloatingVisible) {
                // 'screen-saver' — це максимальний рівень, вище тільки небо... або синій екран 😎
                strip.setAlwaysOnTop(true, 'screen-saver');
                // Додатковий пінок, шоб вікно не втрачало фокус "поза фокусом"
                strip.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            }
        }
    }, 5000);

    // IPC handlers
    setupIPC();

    console.log('✅ Alert Indicator ready! Polling every 30s.');
});

// =====================
// TRAY
// =====================
function createTray() {
    const icons = getIcons(config.Colors);
    tray = new Tray(icons.safe);
    tray.setToolTip('Alert Indicator');
    rebuildTrayMenu();
}

function rebuildTrayMenu() {
    const statusLabel = currentState === 'alert' ? '🔴 ALERT!'
        : currentState === 'error' ? '🟠 API Error'
        : '🟢 Safe';

    // Build location submenu
    const locationSubmenu = buildLocationMenu();

    const contextMenu = Menu.buildFromTemplate([
        { label: `Status: ${statusLabel}`, enabled: false },
        { type: 'separator' },
        {
            label: 'Location',
            submenu: locationSubmenu
        },
        { type: 'separator' },
        {
            label: config.FloatingVisible ? 'Hide Strip' : 'Show Strip',
            click: () => {
                config.FloatingVisible = !config.FloatingVisible;
                saveConfig(config);
                updateStripVisibility();
                refreshStripPositions();
                rebuildTrayMenu();
            }
        },
        {
            label: config.SoundEnabled ? 'Sound: ON 🔊' : 'Sound: OFF 🔇',
            click: () => {
                config.SoundEnabled = !config.SoundEnabled;
                saveConfig(config);
                rebuildTrayMenu();
            }
        },
        {
            label: 'History',
            click: () => {
                shell.openExternal(`${API_BASE}/history.html`);
            }
        },
        {
            label: 'Settings',
            click: () => openSettings()
        },
        { type: 'separator' },
        {
            label: 'Testing & Bot',
            submenu: [
                {
                    label: '🔴 Simulate: ALERT (Local)',
                    click: () => simulateState('alert')
                },
                {
                    label: '🟢 Simulate: SAFE (Local)',
                    click: () => simulateState('safe')
                },
                {
                    label: '🟠 Simulate: API Error',
                    click: () => simulateState('error')
                },
                { type: 'separator' },
                {
                    label: '🔴 BOT: Send Test Alert',
                    click: () => botTest('alert')
                },
                {
                    label: '🟢 BOT: Send Test End',
                    click: () => botTest('end')
                },
            ]
        },
        { type: 'separator' },
        {
            label: 'Exit',
            click: () => {
                tray.destroy();
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    
    // Update icon to match state
    const icons = getIcons(config.Colors);
    tray.setImage(icons[currentState] || icons.safe);
}

function buildLocationMenu() {
    if (!locations.length) {
        return [{ label: 'Loading...', enabled: false }];
    }

    const oblasts = locations.filter(l => l.type === 'oblast' || l.type === 'city');
    const raions = locations.filter(l => l.type === 'raion');

    const items = [];

    for (const obl of oblasts) {
        // Find rayons for this oblast
        const oblRaions = raions.filter(r => r.oblastUid === obl.uid);

        if (oblRaions.length > 0) {
            // Oblast with rayons submenu
            const submenu = [
                {
                    label: `Вся ${obl.short}`,
                    type: 'checkbox',
                    checked: config.City === obl.uid,
                    click: () => selectLocation(obl.uid)
                },
                { type: 'separator' },
                ...oblRaions.map(r => ({
                    label: r.short,
                    type: 'checkbox',
                    checked: config.City === r.uid,
                    click: () => selectLocation(r.uid)
                }))
            ];

            items.push({
                label: obl.short,
                submenu
            });
        } else {
            // Oblast/city without rayons (e.g. Kyiv city, Luhansk)
            items.push({
                label: obl.short,
                type: 'checkbox',
                checked: config.City === obl.uid,
                click: () => selectLocation(obl.uid)
            });
        }
    }

    return items;
}

function selectLocation(uid) {
    config.City = uid;
    saveConfig(config);
    lastAlertValue = null; // Reset for fresh check
    currentState = null;
    rebuildTrayMenu();
    doCheck(); // Immediate check with new location
}

function openSettings() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 400,
        height: 480,
        title: 'Indicator Settings',
        resizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// =====================
// FLOATING STRIP WINDOWS
// =====================
function createStripWindows() {
    const displays = screen.getAllDisplays();

    for (const display of displays) {
        try {
            const strip = new BrowserWindow({
                width: display.bounds.width,
                height: 20,
                x: display.bounds.x,
                y: display.bounds.y + display.bounds.height - 20,
                frame: false,
                transparent: true,
                hasShadow: false,
                roundedCorners: false,
                thickFrame: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                focusable: false,
                resizable: false,
                show: config.FloatingVisible,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.js'),
                    contextIsolation: true,
                    nodeIntegration: false,
                }
            });

            // Prevent the strip from stealing focus and allow clicks through it
            strip.setAlwaysOnTop(true, 'screen-saver');
            strip.setIgnoreMouseEvents(true);

            strip.loadFile(path.join(__dirname, 'index.html')).then(() => {
                // Ensure correct color and height on load
                const color = config.Colors[currentState] || config.Colors.safe;
                strip.webContents.send('set-color', color);
                strip.webContents.send('set-height', config.StripHeight || 1);

                // Force layout refresh for Windows transparency bugs
                setTimeout(() => {
                    if (strip && !strip.isDestroyed()) {
                        strip.setIgnoreMouseEvents(true);
                        strip.setAlwaysOnTop(true, 'screen-saver');
                    }
                }, 1000);
            });

            // Prevent close from removing it
            strip.on('close', (e) => {
                if (!app.isQuitting) {
                    e.preventDefault();
                    strip.hide();
                }
            });

            stripWindows.push(strip);
        } catch (err) {
            console.error('Failed to create strip window:', err.message);
        }
    }
}

function updateStripVisibility() {
    for (const strip of stripWindows) {
        if (strip && !strip.isDestroyed()) {
            if (config.FloatingVisible) {
                strip.show();
                strip.setAlwaysOnTop(true, 'screen-saver');
            } else {
                strip.hide();
            }
        }
    }
}

function updateStripColor(colorHex) {
    for (const strip of stripWindows) {
        if (strip && !strip.isDestroyed()) {
            strip.webContents.send('set-color', colorHex);
        }
    }
}

// =====================
// API POLLING
// =====================
async function doCheck() {
    try {
        const data = await fetchStatus(config.City);
        const isAlert = data.alert === true;

        // Detect state change
        if (lastAlertValue !== null && lastAlertValue !== isAlert) {
            if (isAlert) {
                // ALERT started!
                showNotification('🚨 ТРИВОГА!', `${data.location} — повітряна тривога!`);
                playSound('alert');
            } else {
                // Alert ended
                showNotification('✅ Відбій', `${data.location} — тривогу скасовано`);
                playSound('safe');
            }
        }

        lastAlertValue = isAlert;
        setState(isAlert ? 'alert' : 'safe');

    } catch (err) {
        console.error('[Poll] Error:', err.message);
        // Important: check if it's a real error or just first poll delay
        if (lastAlertValue !== null) {
            setState('error');
        } else {
            // First poll fail? Stay green.
            setState('safe');
        }
    }
}

// =====================
// STATE MANAGEMENT
// =====================
function setState(newState) {
    if (currentState === newState) return;
    currentState = newState;

    updateUIState();
    rebuildTrayMenu(); // Ensure menu and icon are updated
}

function updateUIState() {
    if (!currentState) return;

    // Update tray icon
    const icons = getIcons(config.Colors);
    if (tray && !tray.isDestroyed()) {
        tray.setImage(icons[currentState] || icons.safe);
        rebuildTrayMenu();
    }

    // Update strip color
    const color = config.Colors[currentState] || config.Colors.safe;
    updateStripColor(color);
    updateStripHeight(config.StripHeight || 1);

    // Refresh strip positions (monitors may have changed)
    refreshStripPositions();
}

function updateStripColor(color) {
    for (const strip of stripWindows) {
        if (strip && !strip.isDestroyed()) {
            strip.webContents.send('set-color', color);
        }
    }
}

function updateStripHeight(height) {
    for (const strip of stripWindows) {
        if (strip && !strip.isDestroyed()) {
            strip.webContents.send('set-height', height);
        }
    }
}

function refreshStripPositions() {
    const displays = screen.getAllDisplays();
    for (let i = 0; i < stripWindows.length && i < displays.length; i++) {
        const strip = stripWindows[i];
        const display = displays[i];
        if (strip && !strip.isDestroyed()) {
            const newX = display.bounds.x;
            const newY = display.bounds.y + display.bounds.height - 20;
            const newW = display.bounds.width;
            
            const currentBounds = strip.getBounds();
            // 🌿 Чек: якщо ми вже там, то не смикаємо Explorer даремно! 🚬
            if (currentBounds.x !== newX || currentBounds.y !== newY || currentBounds.width !== newW) {
                console.log(`[Strip] Позиція змінилась на моніторі ${i}, рухаємо... 🚢`);
                strip.setBounds({
                    x: newX,
                    y: newY,
                    width: newW,
                    height: 20,
                });
                // Після руху — знову "on top"
                strip.setAlwaysOnTop(true, 'screen-saver');
            }
        }
    }
}

// =====================
// SIMULATE & BOT TEST
// =====================
function simulateState(state) {
    setState(state);
    if (state === 'alert') {
        playSound('alert');
        showNotification('🧪 Simulation', 'Local Alert Active');
    } else if (state === 'safe') {
        playSound('safe');
        showNotification('🧪 Simulation', 'Local Alert Ended');
    } else {
        showNotification('🧪 Simulation', 'API Connection Error');
    }
}

async function botTest(type) {
    if (!config.City) return;
    try {
        const result = await sendTestAlert(config.City, type);
        showNotification('🤖 Bot Test', `Sent to ${result.sent} subscribers`);
    } catch (err) {
        showNotification('❌ Bot Error', err.message);
    }
}

// =====================
// NOTIFICATIONS
// =====================
function showNotification(title, body) {
    try {
        new Notification({ title, body }).show();
    } catch (err) {
        console.error('[Notification]', err.message);
    }
}

// =====================
// SOUND (via renderer IPC)
// =====================
function playSound(type) {
    if (!config.SoundEnabled) return;

    // Send to all strip windows to play sound
    for (const strip of stripWindows) {
        if (strip && !strip.isDestroyed()) {
            strip.webContents.send('play-sound', type);
            break; // Only need one window to play sound
        }
    }
}

// =====================
// IPC HANDLERS
// =====================
function setupIPC() {
    ipcMain.handle('get-config', () => config);
    ipcMain.handle('get-sound-enabled', () => config.SoundEnabled);

    ipcMain.handle('save-colors', async (event, colors) => {
        config.Colors = colors;
        saveConfig(config);
        updateUIState();
        return { success: true };
    });

    ipcMain.handle('save-settings', async (event, newSettings) => {
        config.Colors = newSettings.colors;
        config.StripHeight = newSettings.height;
        saveConfig(config);
        updateUIState();
        return { success: true };
    });

    ipcMain.handle('preview-settings', async (event, preview) => {
        // Preview colors
        const previewColor = preview.colors[currentState] || preview.colors.safe;
        updateStripColor(previewColor);
        // Preview height
        updateStripHeight(preview.height);
        return { success: true };
    });
}

// =====================
// APP LIFECYCLE
// =====================
app.on('before-quit', () => {
    app.isQuitting = true;
});

app.on('window-all-closed', (e) => {
    // Don't quit when windows close — we live in the tray
    e.preventDefault?.();
});

// Handle second instance (show notification)
app.on('second-instance', () => {
    showNotification('Alert Indicator', 'Already running in the system tray!');
});
