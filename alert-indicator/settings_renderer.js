/**
 * Settings Window Renderer
 */

const colorSafe = document.getElementById('color-safe');
const colorAlert = document.getElementById('color-alert');
const colorError = document.getElementById('color-error');
const stripHeight = document.getElementById('strip-height');
const heightVal = document.getElementById('height-val');
const saveBtn = document.getElementById('save-btn');

// Load current configuration
window.indicator.getConfig().then(config => {
    if (config.Colors) {
        colorSafe.value = config.Colors.safe;
        colorAlert.value = config.Colors.alert;
        colorError.value = config.Colors.error;
    }
    if (config.StripHeight) {
        stripHeight.value = config.StripHeight;
        heightVal.innerText = `${config.StripHeight}px`;
    }
});

// Helper to get current UI values
function getSettings() {
    return {
        height: parseInt(stripHeight.value),
        colors: {
            safe: colorSafe.value,
            alert: colorAlert.value,
            error: colorError.value
        }
    };
}

// Live Preview logic
const updatePreview = () => {
    heightVal.innerText = `${stripHeight.value}px`;
    window.indicator.previewSettings(getSettings());
};

// Listen for inputs
colorSafe.addEventListener('input', updatePreview);
colorAlert.addEventListener('input', updatePreview);
colorError.addEventListener('input', updatePreview);
stripHeight.addEventListener('input', updatePreview);

// Save settings
saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Збереження...';

    try {
        await window.indicator.saveSettings(getSettings());
        window.close();
    } catch (err) {
        alert('Помилка: ' + err.message);
        saveBtn.disabled = false;
        saveBtn.innerText = 'Зберегти';
    }
});
