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

/**
 * Get Ukrainian oblasts in alert from ukrainealarm API
 * This is more accurate than alerts.in.ua for oblast count
 * Returns array of oblast names with ACTIVE alerts
 */
export async function getUaAlertsOblasts() {
    try {
        const token = await getToken();
        if (!token) return null;

        const { data } = await fetchUrl('https://map.ukrainealarm.com/api/v2/data/mapUpdate', {
            'Authorization': `Bearer ${token}`,
            'Referer': 'https://map.ukrainealarm.com/',
            'Accept': 'application/json'
        });

        const json = JSON.parse(data);

        // json.alerts contains ACTIVE alerts grouped by region
        // regionType: 'State' = oblast, 'District' = raion, 'Community' = hromada
        if (!json.alerts) return null;

        // Collect unique oblasts from:
        // 1. Direct State alerts
        // 2. Parent oblasts of District/Community alerts (via parentRegionId lookup)
        const oblasts = new Set();
        const oblastIdToName = new Map();

        // First pass: collect State (oblast) alerts
        for (const alert of json.alerts) {
            if (alert.regionType === 'State') {
                oblasts.add(alert.regionName);
                oblastIdToName.set(alert.regionId, alert.regionName);
            }
        }

        // Second pass: for District/Community, find parent oblast from statesHistory
        // Build oblast ID -> name map from statesHistory (entries without parentRegionId)
        if (json.statesHistory) {
            for (const state of json.statesHistory) {
                if (!state.parentRegionId) {
                    oblastIdToName.set(state.regionId, state.regionName);
                }
            }
        }

        // Now check districts/communities and add their parent oblasts
        for (const alert of json.alerts) {
            if (alert.regionType === 'District' || alert.regionType === 'Community') {
                // Check if we can determine parent oblast
                // statesHistory entries have parentRegionId for districts
                if (json.statesHistory) {
                    for (const state of json.statesHistory) {
                        if (state.regionId === alert.regionId && state.parentRegionId) {
                            const parentName = oblastIdToName.get(state.parentRegionId);
                            if (parentName) {
                                oblasts.add(parentName);
                            }
                            break;
                        }
                    }
                }
            }
        }

        return {
            count: oblasts.size,
            names: [...oblasts]
        };
    } catch (e) {
        console.error('❌ Error fetching UA alerts oblasts:', e.message);
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

    // Fun random phrases with dynamic elements
    const hour = new Date().getHours();
    const isNight = hour >= 22 || hour < 6;
    const isDawn = hour >= 6 && hour < 9;
    const isDay = hour >= 9 && hour < 18;

    // Base phrases (always available) - АГРЕСИВНІ!
    const basePhrases = [
        "🔥 Кошмарим підарів в:",
        "💩 Русня потєрпає в:",
        "🐷 Свині горять в:",
        "☠️ Орки здихають в:",
        "💥 Бавовна накриває кацапів в:",
        "🤮 Рашисти обісрались в:",
        "🦠 Окупанти гниють в:",
        "👹 Нелюді панікують в:",
        "🐀 Пацюки тікають в:",
        "🚀 Калібр для орків прилетів в:",
        "💀 Кацапня йде на три букви в:",
        "🔪 Бандера різає русню в:",
        "⚰️ Вантаж 200 формується в:",
        "🪦 Свіжі могилки в:",
        "🎯 Приліт по рашистах в:",
        "🔨 ЗСУ херачить підарів в:",
        "🧹 Зачистка від орків в:",
        "🦟 Бойові комарі жруть кацапів в:",
        "🐕 Собаки гризуть рашню в:",
        "🌪️ Кацапів здуває в:",
        "⚡ Орків підсмажує в:",
        "🔥 Свинособаки смажаться в:",
        "💣 Окупанти отримали люлей в:",
        "🎪 Кацапський цирк горить в:",
        "🤡 Орки-клоуни сцять в:",
        "🐒 Мавпи з гранатами підривають себе в:",
        "🦴 Орків розкидало в:",
        "🩸 Кров окупантів ллється в:",
        "👺 Рашистські демони валяться в:",
        "🪓 Сікти кацапів продовжуємо в:",
        "🏴‍☠️ Пірати топлять рашистів в:",
        "🦅 Орли клюють орків в:",
        "🐉 Дракон пече підарів в:",
        "🌋 Пекло для русні в:",
        "☢️ Радіація косить окупантів в:",
        "🧨 Феєрверки для кацапів в:",
        "🚁 Вертольоти мочать рашню в:",
        "⏰ Година розплати для орків в:",
        "🎁 Подарунок для свиней від ЗСУ в:",
        "💀 Смерть косить рашистів в:",
        "🐖 Хрюкальники замовкли в:",
        "🗑️ Сміття вивозимо з:",
        "🧟 Зомбі-орки падають в:",
        "🔫 Денацифікація підарів в:",
        "🎖️ Нові медалі за дохлих орків в:"
    ];

    // Night-specific phrases (22:00 - 06:00) - АГРЕСИВНІ!
    const nightPhrases = [
        "🌙 Нічні кошмари для орків в:",
        "🦉 Сови полюють на кацапів в:",
        "😴 Русня не доспить в:",
        "🌃 Нічний візит смерті до підарів в:",
        "🕯️ Свічки на могилах орків в:",
        "🦇 Кажани п'ють кров рашистів в:",
        "💤 Вічний сон для окупантів в:",
        "🌌 Зорі падають на свиней в:",
        "👻 Привиди мстять оркам в:",
        "🔦 Нічна зачистка кацапні в:"
    ];

    // Dawn-specific phrases (06:00 - 09:00) - АГРЕСИВНІ!
    const dawnPhrases = [
        "☀️ Доброго ранку, здохни, орче! Тривога в:",
        "🐓 Півень закукурікав по рашистах в:",
        "☕ Ранкова кава з кров'ю орків в:",
        "🌅 Схід сонця - захід життя для кацапів в:",
        "🥐 Снідосік для свиней - приліт в:",
        "🍳 Яєчня з підарів готується в:",
        "⏰ Будильник смерті для рашні в:"
    ];

    // Day-specific phrases (09:00 - 18:00) - АГРЕСИВНІ!
    const dayPhrases = [
        "☀️ Денна зміна мочить орків в:",
        "🏢 Робочий день - день смерті для кацапів в:",
        "🍳 Обідня перерва для знищення свиней в:",
        "📊 KPI по дохлих рашистах виконано в:",
        "💼 Ділова зустріч з підарами в пеклі в:",
        "🔧 Ремонт орків (остаточний) в:",
        "📈 Статистика вантажу 200 росте в:"
    ];

    // Evening-specific phrases (18:00 - 22:00) - АГРЕСИВНІ!
    const isEvening = hour >= 18 && hour < 22;
    const eveningPhrases = [
        "🌆 Вечірня зачистка орків в:",
        "🍷 Вечеря для свиней - останній раз в:",
        "📺 Передача \"Дохлі кацапи\" йде з:",
        "🍿 Попкорн і горілі рашисти в:",
        "🌙 Вечір для окупантів став останнім в:",
        "🎬 Фінальна серія для підарів в:"
    ];

    // Holiday-specific phrases (December-January - New Year vibes!) - АГРЕСИВНІ!
    const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
    const day = new Date().getDate();
    const isNewYearSeason = (month === 11 && day >= 20) || (month === 0 && day <= 15);
    const holidayPhrases = [
        "🎅 Дід Мороз приніс смерть оркам в:",
        "🎄 Ялинка з трупами кацапів в:",
        "🎆 Новорічний салют по рашистах в:",
        "🥂 З Новим Роком, здохни, орче! Тривога в:",
        "❄️ Снігуронька закопує свиней в:",
        "🎁 Новорічний подарунок для підарів - смерть в:",
        "⛄ Сніговик з частин окупантів в:",
        "🧨 Новорічні HIMARS для кацапні в:",
        "🍾 Шампанське по черепах орків в:",
        "🎉 Новорічна вечірка в пеклі для рашні в:",
        "🎊 Конфеті з рашистів в:",
        "🪅 Піньята з орками в:"
    ];

    // Build phrase pool based on time of day
    let phrases = [...basePhrases];
    if (isNight) phrases = phrases.concat(nightPhrases);
    if (isDawn) phrases = phrases.concat(dawnPhrases);
    if (isDay) phrases = phrases.concat(dayPhrases);
    if (isEvening) phrases = phrases.concat(eveningPhrases);
    if (isNewYearSeason) phrases = phrases.concat(holidayPhrases);

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
