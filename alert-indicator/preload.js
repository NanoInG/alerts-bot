/**
 * Preload Script — Context Bridge for IPC
 * Exposes safe APIs from main process to renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('indicator', {
    // Listen for color changes from main
    onSetColor: (callback) => {
        ipcRenderer.on('set-color', (_, color) => callback(color));
    },

    // Listen for sound play requests
    onPlaySound: (callback) => {
        ipcRenderer.on('play-sound', (_, type) => callback(type));
    },

    // Listen for height updates
    onSetHeight: (callback) => {
        ipcRenderer.on('set-height', (_, height) => callback(height));
    },

    // Get config from main
    getConfig: () => ipcRenderer.invoke('get-config'),
    getSoundEnabled: () => ipcRenderer.invoke('get-sound-enabled'),

    // Settings
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    previewSettings: (settings) => ipcRenderer.invoke('preview-settings', settings),
});
