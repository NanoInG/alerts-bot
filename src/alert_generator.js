import { getRfAlertsString, getGlobalThreats } from './rf_alerts.js';
import { translateAlertType, getAlertSummary, getCountrySummary } from './alerts.js';
import { fetchWeather, getLocationCoords } from './weather.js';

export async function buildAlertMessage(locationUid, locationName, alerts) {
    const isActive = alerts ? alerts.some(a => a.location_uid === locationUid) : false;
    // Wait, isAlertActive logic is:
    // const isActive = isAlertActive(alerts, targetUid);
    // which implementation is in src/alerts.js

    // We need to import isAlertActive too
    return await generateMessageText(locationUid, locationName, alerts);
}

// Inner logic mirroring server.js
import { isAlertActive } from './alerts.js';

export async function generateMessageText(targetUid, targetName, alerts) {
    const isActive = isAlertActive(alerts, targetUid);
    const coords = getLocationCoords(targetUid);
    const weather = await fetchWeather(coords.lat, coords.lon);
    const country = getCountrySummary(alerts);
    const summary = getAlertSummary(alerts, targetUid);

    // Merge global threats
    const globalThreats = await getGlobalThreats();
    if (globalThreats.ballistics) summary.types['ballistics'] = true;
    if (globalThreats.strategic_aviation) summary.types['strategic_aviation'] = true;
    if (globalThreats.mig_takeoff) summary.types['mig_takeoff'] = true;
    if (globalThreats.mig_rockets) summary.types['mig_rockets'] = true;
    if (globalThreats.artillery) summary.types['artillery'] = true;
    if (globalThreats.boats) summary.types['boats'] = true;
    if (globalThreats.tactical_rockets) summary.types['tactical_rockets'] = true;

    let text = '';

    if (isActive) {
        text = `🔴 <b>ТРИВОГА!</b>\n`;
        text += `━━━━━━━━━━━━━━━\n`;
        text += `📍 <b>${targetName}</b>\n\n`;

        if (Object.keys(summary.types).length > 0) {
            text += `<b>⚠️ Загрози:</b>\n`;
            for (const [type] of Object.entries(summary.types)) {
                text += `  ${translateAlertType(type)}\n`;
            }
            text += `\n`;
        }

        if (summary.raions.length > 0) {
            text += `<b>📌 Райони:</b> ${summary.raions.join(', ')}`;
            if (summary.hasMore) text += ` +ще`;
            text += `\n\n`;
        }

        if (country.oblastCount > 0) {
            text += `━━━━━━━━━━━━━━━\n`;
            text += `<b>🇺🇦 В тривозі:</b> ${country.oblastCount} обл.\n`;
            if (country.oblasts.length > 0) {
                const shortNames = country.oblasts.map(o => o.replace(' область', ''));
                text += `📋 ${shortNames.join(', ')}\n`;
            }
            text += `\n`;
        }

        if (weather) {
            text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
            text += `${weather.icon} ${weather.desc}\n`;
            text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
            text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n`;
            text += `💧 Вологість: ${weather.humidity}%\n`;
            text += `📊 Тиск: ${weather.pressure} гПа\n\n`;
        }

        text += `🚨 <b>Негайно в укриття!</b>`;

        let rfInfoText = await getRfAlertsString();
        if (rfInfoText) text += `\n\n${rfInfoText}`;
    } else {
        text = `🟢 <b>Відбій тривоги</b>\n`;
        text += `━━━━━━━━━━━━━━━\n`;
        text += `📍 <b>${targetName}</b>\n\n`;

        text += `✅ <b>Можна виходити</b> 😊\n\n`;

        if (weather) {
            text += `<b>🌤️ Погода в ${coords.city}:</b>\n`;
            text += `${weather.icon} ${weather.desc}\n`;
            text += `🌡️ <b>${weather.temp}°C</b> (відчув. ${weather.feels}°C)\n`;
            text += `💨 Вітер: ${weather.wind} м/с ${weather.windDir}\n\n`;
        }

        if (country.oblastCount > 0) {
            text += `━━━━━━━━━━━━━━━\n`;
            text += `<b>🇺🇦 Ще в тривозі:</b> ${country.oblastCount} обл.\n`;
            if (country.oblasts.length > 0) {
                const shortNames = country.oblasts.map(o => o.replace(' область', ''));
                text += `📋 ${shortNames.join(', ')}`;
            }
        }

        // Add RF info footer even for all clear?
        // server.js logic says: if (!isActive) { ... if (rfText) ... }
        let rfInfoText = await getRfAlertsString();
        if (rfInfoText) text += `\n\n${rfInfoText}`;
    }

    return text;
}
