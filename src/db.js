/**
 * Database Module
 * MariaDB connection pool and helpers
 */

import mysql from 'mysql2/promise';
import 'dotenv/config';

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

// Create connection pool
const pool = mysql.createPool({
    host: DB_HOST,
    port: parseInt(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

/**
 * Save alert to history with extended data
 */
export async function saveAlertHistory(data) {
    const {
        locationUid,
        locationName,
        alertType,
        threatTypes = null,
        weatherTemp = null,
        weatherDesc = null,
        weatherIcon = null,
        raions = null,
        countryCount = null
    } = typeof data === 'object' ? data : { locationUid: arguments[0], locationName: arguments[1], alertType: arguments[2] };

    try {
        await pool.execute(
            `INSERT INTO alerts_history 
            (location_uid, location_name, alert_type, threat_types, weather_temp, weather_desc, weather_icon, raions, country_count) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [locationUid, locationName, alertType, threatTypes, weatherTemp, weatherDesc, weatherIcon, raions, countryCount]
        );
        return true;
    } catch (error) {
        console.error('DB Error (saveAlertHistory):', error.message);
        return false;
    }
}

/**
 * Get alert history with pagination and filters
 */
export async function getAlertHistory({ page = 1, limit = 20, type = null, locationUid = null, search = null, dateFrom = null, dateTo = null } = {}) {
    try {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM alerts_history WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM alerts_history WHERE 1=1';
        const params = [];
        const countParams = [];

        if (type) {
            query += ' AND alert_type = ?';
            countQuery += ' AND alert_type = ?';
            params.push(type);
            countParams.push(type);
        }

        if (locationUid) {
            query += ' AND location_uid = ?';
            countQuery += ' AND location_uid = ?';
            params.push(locationUid);
            countParams.push(locationUid);
        }

        if (search) {
            query += ' AND location_name LIKE ?';
            countQuery += ' AND location_name LIKE ?';
            params.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (dateFrom) {
            query += ' AND created_at >= ?';
            countQuery += ' AND created_at >= ?';
            params.push(dateFrom);
            countParams.push(dateFrom);
        }

        if (dateTo) {
            query += ' AND created_at <= ?';
            countQuery += ' AND created_at <= ?';
            params.push(dateTo);
            countParams.push(dateTo);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await pool.execute(query, params);
        const [[{ total }]] = await pool.execute(countQuery, countParams);

        return {
            data: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('DB Error (getAlertHistory):', error.message);
        return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
}

/**
 * Get history stats
 */
export async function getHistoryStats() {
    try {
        const [[stats]] = await pool.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(alert_type = 'ALERT') as alerts,
                SUM(alert_type = 'END') as ends,
                MIN(created_at) as first_record,
                MAX(created_at) as last_record
            FROM alerts_history
        `);
        return stats;
    } catch (error) {
        console.error('DB Error (getHistoryStats):', error.message);
        return { total: 0, alerts: 0, ends: 0 };
    }
}

/**
 * Migrate JSON history to database
 */
export async function migrateHistoryFromJson(jsonData) {
    let count = 0;
    for (const entry of jsonData) {
        if (entry.Time && entry.Type) {
            try {
                await pool.execute(
                    'INSERT INTO alerts_history (location_uid, location_name, alert_type, created_at) VALUES (?, ?, ?, ?)',
                    [entry.City || '24', entry.Location || 'Unknown', entry.Type, entry.Time]
                );
                count++;
            } catch (e) {
                // Skip duplicates
            }
        }
    }
    return count;
}

export { pool };
