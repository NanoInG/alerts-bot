/**
 * Tray Icons Generator
 * Creates colored circle icons for the system tray using nativeImage
 */

const { nativeImage } = require('electron');

/**
 * Converts hex color (#RRGGBB) to RGB object
 */
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

/**
 * Generate a 16x16 circle icon as nativeImage
 * Uses raw RGBA pixel buffer for a filled circle
 */
function createCircleIcon(hex) {
    const size = 16;
    const color = hexToRgb(hex);
    const buffer = Buffer.alloc(size * size * 4); // RGBA

    const cx = size / 2;
    const cy = size / 2;
    const radius = 6.8; // Slightly larger for better visibility

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const offset = (y * size + x) * 4;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

            if (dist <= radius) {
                // Inside circle — anti-aliased edge
                const edgeWidth = 1.0;
                const alpha = dist > radius - edgeWidth ? Math.max(0, (radius - dist) / edgeWidth) * 255 : 255;
                buffer[offset] = color.r;     // R
                buffer[offset + 1] = color.g; // G
                buffer[offset + 2] = color.b; // B
                buffer[offset + 3] = Math.round(alpha); // A
            } else {
                // Transparent
                buffer[offset + 3] = 0;
            }
        }
    }

    return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

// Pre-generate all icons
let icons = null;
let lastColorsJson = null;

function getIcons(customColors = null) {
    const currentColorsJson = JSON.stringify(customColors);
    if (!icons || currentColorsJson !== lastColorsJson) {
        lastColorsJson = currentColorsJson;
        const colors = customColors || {
            safe: '#2ECC71',
            alert: '#E74C3C',
            error: '#F39C12'
        };

        icons = {
            safe: createCircleIcon(colors.safe),
            alert: createCircleIcon(colors.alert),
            error: createCircleIcon(colors.error),
        };
    }
    return icons;
}

module.exports = { getIcons };
