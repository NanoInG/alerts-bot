/**
 * Alert Indicator - Renderer Process
 * Handles: strip color changes + audio playback
 */

// Sound paths (relative to this file, going up to media/)
const ALERT_SOUND_PATH = '../media/sounds/air-alert.mp3';
const CLEAR_SOUND_PATH = '../media/sounds/air-clear.mp3';

// Pre-create Audio objects
const alertSound = new Audio(ALERT_SOUND_PATH);
const clearSound = new Audio(CLEAR_SOUND_PATH);

alertSound.preload = 'auto';
clearSound.preload = 'auto';

// === Color Updates ===
window.indicator.onSetColor((color) => {
    const line = document.getElementById('line');
    if (line) line.style.backgroundColor = color;
});

// === Height Updates ===
window.indicator.onSetHeight((height) => {
    const line = document.getElementById('line');
    if (line) line.style.height = `${height}px`;
});

// === Sound Playback ===
window.indicator.onPlaySound((type) => {
    try {
        if (type === 'alert') {
            clearSound.pause();
            clearSound.currentTime = 0;
            alertSound.currentTime = 0;
            alertSound.play().catch(e => console.error('Sound error:', e));
        } else if (type === 'safe') {
            alertSound.pause();
            alertSound.currentTime = 0;
            clearSound.currentTime = 0;
            clearSound.play().catch(e => console.error('Sound error:', e));
        }
    } catch (e) {
        console.error('Audio error:', e);
    }
});

console.log('🌿 Alert Indicator Renderer loaded');
