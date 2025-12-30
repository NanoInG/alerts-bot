import https from 'https';

let cachedToken = null;
let tokenLastFetch = 0;
const TOKEN_TTL = 30 * 60 * 1000; // 30 minutes cache

// Helper to fetch text content
function fetchUrl(url, headers = {}) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ data, statusCode: res.statusCode }));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function getToken() {
    // Return cached token if fresh
    if (cachedToken && (Date.now() - tokenLastFetch < TOKEN_TTL)) {
        return cachedToken;
    }

    try {
        console.log('🔄 Refreshing API token...');
        const { data } = await fetchUrl('https://map.ukrainealarm.com/');

        // Regex to find input with id="api-token"
        const match = data.match(/<input\s+id="api-token"\s+type="hidden"\s+value="([^"]+)"/);

        if (match && match[1]) {
            cachedToken = match[1];
            tokenLastFetch = Date.now();
            console.log('✅ API token refreshed');
            return cachedToken;
        } else {
            console.error('❌ Could not find API token in HTML');
            return null;
        }
    } catch (e) {
        console.error('❌ Error fetching token:', e.message);
        return null;
    }
}

export async function getRfAlerts() {
    try {
        const token = await getToken();
        if (!token) return [];

        const { data } = await fetchUrl('https://map.ukrainealarm.com/api/v2/data/mapUpdate', {
            'Authorization': `Bearer ${token}`,
            'Referer': 'https://map.ukrainealarm.com/',
            'Accept': 'application/json'
        });

        const json = JSON.parse(data);

        // Extract RF alerts
        // Structure: rfAlerts: { alerts: [ { regionId: "..." }, ... ] }
        if (json?.rfAlerts?.alerts) {
            // Filter "fresh" alerts if needed, or return all "active" ones as per API
            // Note: API seems to return last events. We might want to filter by date if they are too old.
            // But user said "Here are all active regions", so we assume the list implies activity (or recent activity).
            // Let's filter out very old ones (> 24 hours)? 
            // Actually, for now, let's return all, assuming the map controls visibility.

            return json.rfAlerts.alerts.map(a => processRegion(a));
        }

        return [];
    } catch (e) {
        console.error('❌ Error fetching RF alerts:', e.message);
        return [];
    }
}

function processRegion(alert) {
    // Map known negative IDs to names if possible (need to discover mapping)
    // For now, return regionId (which can be a name like "Рязанская область" or an ID)
    let name = alert.regionId;

    const idMap = {
        "-1001": "Курська область", // Hypothetical mapping
        "-1002": "Бєлгородська область",
        "-1003": "Воронезька область",
        "-1004": "Ростовська область",
        "-1005": "Брянська область",
        "-1006": "Краснодарський край",
        "Crimea": "Тимчасово окупований Крим"
    };

    if (idMap[name]) {
        name = idMap[name];
    } else if (name === '9999' || name === 'Autonomous Republic of Crimea') {
        name = "ТОТ Крим";
    }

    // Clean up Russian names if they come in Cyrillic but we want valid texture
    // "Рязанская область" -> leave as is or translate?
    // User style: "Кошмарим підарів в: ..." -> leave as is for now.

    return {
        name: name,
        lastUpdate: alert.lastMessageTime
    };
}

export async function getRfAlertsString() {
    const alerts = await getRfAlerts();
    if (!alerts.length) return null;

    // Filter logic: maybe only those updated in last ~12 hours?
    // User comment about Chuvashia (Nov 26) suggests some are old.
    // Let's filter active by time window? Or maybe the API removes them when safe?
    // Let's filter: valid if lastMessageTime is within last 2 hours OR if it's a known active zone.
    // Actually, user said "Here are all regions where alert is active".
    // I will filter by < 2 hours to be safe against stale data like Chuvashia.

    const now = new Date();
    const active = alerts.filter(a => {
        const time = new Date(a.lastUpdate);
        const diffHours = (now - time) / (1000 * 60 * 60);
        return diffHours < 4; // 4 hours window provided casually
    });

    if (!active.length) return null;

    const names = active.map(a => a.name).join(', ');

    // Fun random phrases
    const phrases = [
        "🔥 Кошмарим підарів в:",
        "🤮 Болота тонуть в:",
        "💩 Русня потєрпає в:",
        "☠️ Бєлгород спиш?",
        "💥 Бавовна розквітає в:",
        "🛸 НЛО атакує:",
        "🦟 Бойові комарі працюють по:",
        "🚬 Куріння вбиває в:",
        "👹 Сатана пече млинці в:",
        "🎪 Цирк уїхав, клоуни лишились в:"
    ];
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

    // Global Threats Logic
    // Clean up cached threats if needed, or just re-fetch
    return `${randomPhrase} ${names}`;
}

export async function getGlobalThreats() {
    try {
        const token = await getToken();
        if (!token) return {};

        const { data } = await fetchUrl('https://map.ukrainealarm.com/api/v2/data/mapUpdate', {
            'Authorization': `Bearer ${token}`,
            'Referer': 'https://map.ukrainealarm.com/',
            'Accept': 'application/json'
        });

        const json = JSON.parse(data);
        const threats = {};

        // Parse mapNotifications
        if (json.mapNotifications) {
            const mn = json.mapNotifications;
            if (mn.hasBallistics) threats.ballistics = true;
            if (mn.hasStrategicAviation) threats.strategic_aviation = true;
            if (mn.hasBoats) threats.boats = true;
            if (mn.migRockets) threats.mig_rockets = true;
            if (mn.tacticalAviationRockets) threats.tactical_rockets = true;
        }

        // Parse MiG Alerts (often empty, but if present = Mig-31K take off)
        if (json.migAlerts && json.migAlerts.length > 0) {
            threats.mig_takeoff = true;
        }

        // Parse Artillery (if relevant globally, usually local but good to have)
        if (json.artillery && json.artillery.length > 0) {
            threats.artillery = true;
        }

        return threats;
    } catch (e) {
        console.error('❌ Error fetching global threats:', e.message);
        return {};
    }
}
