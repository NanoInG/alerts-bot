/**
 * Weather Module
 * Weather API and helpers
 */

import fetch from 'node-fetch';
import { weatherApiKey } from './config.js';
import { log } from './utils.js';

/**
 * Fetch weather from OpenWeatherMap
 */
export async function fetchWeather(lat, lon) {
    if (!weatherApiKey) {
        log(`Weather API: No API key configured`);
        return null;
    }
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=metric&lang=uk`;
        const response = await fetch(url);
        if (!response.ok) {
            log(`Weather API: HTTP ${response.status} - ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        return {
            temp: Math.round(data.main.temp),
            feels: Math.round(data.main.feels_like),
            desc: (data.weather[0]?.description || '').charAt(0).toUpperCase() + (data.weather[0]?.description || '').slice(1),
            icon: getWeatherEmoji(data.weather[0]?.id),
            wind: Math.round(data.wind?.speed || 0),
            windDir: getWindDirection(data.wind?.deg),
            pressure: Math.round(data.main?.pressure || 0),
            humidity: data.main?.humidity || 0,
            clouds: data.clouds?.all || 0
        };
    } catch (e) {
        log(`Weather API error: ${e.message}`);
        return null;
    }
}

/**
 * Get wind direction in Ukrainian
 */
export function getWindDirection(deg) {
    if (deg === undefined || deg === null) return '';
    const dirs = ['Пн', 'ПнСх', 'Сх', 'ПдСх', 'Пд', 'ПдЗх', 'Зх', 'ПнЗх'];
    return dirs[Math.round(deg / 45) % 8];
}

/**
 * Get weather emoji by OpenWeatherMap code
 */
export function getWeatherEmoji(weatherId) {
    if (!weatherId) return '🌡️';
    if (weatherId >= 200 && weatherId < 300) return '⛈️'; // Thunderstorm
    if (weatherId >= 300 && weatherId < 400) return '🌧️'; // Drizzle
    if (weatherId >= 500 && weatherId < 600) return '🌧️'; // Rain
    if (weatherId >= 600 && weatherId < 700) return '❄️'; // Snow
    if (weatherId >= 700 && weatherId < 800) return '🌫️'; // Fog
    if (weatherId === 800) return '☀️'; // Clear
    if (weatherId > 800) return '☁️'; // Clouds
    return '🌡️';
}

/**
 * Get coordinates for a location by UID
 */
export function getLocationCoords(locationUid) {
    const coords = {
        '3': { lat: 49.4216, lon: 26.9965, city: 'Хмельницький' },
        '4': { lat: 49.2328, lon: 28.4816, city: 'Вінниця' },
        '5': { lat: 50.6199, lon: 26.2516, city: 'Рівне' },
        '8': { lat: 50.7472, lon: 25.3254, city: 'Луцьк' },
        '9': { lat: 48.4647, lon: 35.0462, city: 'Дніпро' },
        '10': { lat: 50.2547, lon: 28.6587, city: 'Житомир' },
        '11': { lat: 48.6208, lon: 22.2879, city: 'Ужгород' },
        '12': { lat: 47.8388, lon: 35.1396, city: 'Запоріжжя' },
        '13': { lat: 48.9226, lon: 24.7111, city: 'Івано-Франківськ' },
        '14': { lat: 50.4501, lon: 30.5234, city: 'Київ' },
        '15': { lat: 48.5079, lon: 32.2623, city: 'Кропивницький' },
        '16': { lat: 48.5740, lon: 39.3078, city: 'Луганськ' },
        '17': { lat: 46.9750, lon: 31.9946, city: 'Миколаїв' },
        '18': { lat: 46.4825, lon: 30.7233, city: 'Одеса' },
        '19': { lat: 49.5883, lon: 34.5514, city: 'Полтава' },
        '20': { lat: 50.9077, lon: 34.7981, city: 'Суми' },
        '21': { lat: 49.5535, lon: 25.5948, city: 'Тернопіль' },
        '22': { lat: 49.9935, lon: 36.2304, city: 'Харків' },
        '23': { lat: 46.6354, lon: 32.6169, city: 'Херсон' },
        '24': { lat: 49.4285, lon: 32.0621, city: 'Черкаси' },
        '25': { lat: 51.4982, lon: 31.2893, city: 'Чернігів' },
        '26': { lat: 48.2915, lon: 25.9358, city: 'Чернівці' },
        '27': { lat: 49.8397, lon: 24.0297, city: 'Львів' },
        '28': { lat: 48.0159, lon: 37.8028, city: 'Донецьк' },
        '31': { lat: 50.4501, lon: 30.5234, city: 'Київ' }
    };
    return coords[locationUid] || coords['24']; // Default to Cherkasy
}
