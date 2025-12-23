/**
 * Alerts Module
 * Alert API functions
 */

import fetch from 'node-fetch';
import { alertsApiToken } from './config.js';
import { LOCATIONS } from './locations.js';
import { log } from './utils.js';

// Cache for alerts
let alertCache = { alerts: [], timestamp: 0 };
let lastAlerts = [];

/**
 * Fetch active alerts from API
 */
export async function fetchAlerts() {
    // Cache for 30 seconds
    if (Date.now() - alertCache.timestamp < 30000) {
        return alertCache.alerts;
    }

    try {
        const response = await fetch('https://api.alerts.in.ua/v1/alerts/active.json', {
            headers: { 'Authorization': `Bearer ${alertsApiToken}` }
        });
        const data = await response.json();
        alertCache = { alerts: data.alerts || [], timestamp: Date.now() };
        lastAlerts = alertCache.alerts;
        return alertCache.alerts;
    } catch (e) {
        log(`API Error: ${e.message}`);
        return lastAlerts;
    }
}

/**
 * Check if alert is active for location
 */
export function isAlertActive(alerts, locationUid) {
    if (!locationUid) return false;
    const loc = LOCATIONS.find(l => l.uid.toString() === locationUid.toString());
    const oblastUid = loc?.oblastUid;

    const isActive = alerts.some(a => {
        const alertUid = a.location_uid.toString();

        // Direct match
        if (alertUid === locationUid.toString()) return true;

        // If subscribed to oblast, check if alert is for that oblast
        if (oblastUid && alertUid === oblastUid.toString()) return true;

        // If alert has oblast_uid field matching our location
        if (a.location_oblast_uid?.toString() === locationUid.toString()) return true;

        // If we're subscribed to an oblast, check if the alert is for a raion/city within that oblast
        if (loc?.type === 'oblast') {
            const alertLocation = LOCATIONS.find(l => l.uid.toString() === alertUid);
            if (alertLocation?.oblastUid?.toString() === locationUid.toString()) {
                return true;
            }
        }

        return false;
    });

    return isActive;
}

/**
 * Get alert details for location
 */
export function getAlertDetails(alerts, locationUid) {
    return alerts.filter(a =>
        a.location_uid.toString() === locationUid.toString() ||
        a.location_oblast_uid?.toString() === locationUid.toString()
    );
}

/**
 * Get countrywide alert summary
 */
export function getCountrySummary(alerts) {
    const alertedOblasts = new Set();
    const threatTypes = {};

    for (const a of alerts) {
        if (a.location_type === 'oblast') {
            alertedOblasts.add(a.location_title);
        }
        const type = a.alert_type || 'air_raid';
        threatTypes[type] = (threatTypes[type] || 0) + 1;
    }

    return {
        totalAlerts: alerts.length,
        oblastCount: alertedOblasts.size,
        oblasts: [...alertedOblasts].slice(0, 8),
        hasMore: alertedOblasts.size > 8,
        threats: threatTypes
    };
}

/**
 * Get detailed alert summary for location
 */
export function getAlertSummary(alerts, locationUid) {
    const loc = LOCATIONS.find(l => l.uid.toString() === locationUid.toString());
    const relevantAlerts = alerts.filter(a => {
        const alertUid = a.location_uid.toString();
        if (alertUid === locationUid.toString()) return true;
        if (a.location_oblast_uid?.toString() === locationUid.toString()) return true;
        if (loc?.type === 'oblast') {
            const alertLoc = LOCATIONS.find(l => l.uid.toString() === alertUid);
            if (alertLoc?.oblastUid?.toString() === locationUid.toString()) return true;
        }
        return false;
    });

    const alertTypes = {};
    const affectedRaions = [];

    for (const a of relevantAlerts) {
        const type = a.alert_type || 'air_raid';
        alertTypes[type] = (alertTypes[type] || 0) + 1;

        if (a.location_type === 'raion') {
            affectedRaions.push(a.location_title?.replace(' район', '') || a.location_uid);
        }
    }

    return {
        total: relevantAlerts.length,
        types: alertTypes,
        raions: affectedRaions.slice(0, 5),
        hasMore: affectedRaions.length > 5
    };
}

/**
 * Translate alert type to Ukrainian
 */
export function translateAlertType(type) {
    const types = {
        'air_raid': '🚀 Ракетна/авіаційна загроза',
        'artillery_shelling': '💥 Артобстріл',
        'urban_fights': '⚔️ Вуличні бої',
        'nuclear': '☢️ Хімічна/ядерна загроза',
        'chemical': '☣️ Хімічна загроза'
    };
    return types[type] || `⚠️ ${type}`;
}
