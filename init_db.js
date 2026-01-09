/**
 * Database Initialization Script
 * Creates alerts_bot database and required tables
 * 
 * Run once: node init_db.js
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function initDatabase() {
    console.log('🔧 Initializing Alert Bot Database...\n');

    // Connect without database first to create it
    const connection = await mysql.createConnection({
        host: DB_HOST,
        port: parseInt(DB_PORT) || 3306,
        user: DB_USER,
        password: DB_PASSWORD
    });

    try {
        // Create database
        console.log(`📦 Creating database: ${DB_NAME}`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log('   ✅ Database created\n');

        // Use database
        await connection.query(`USE \`${DB_NAME}\``);

        // Create alerts_history table with extended columns
        console.log('📋 Creating table: alerts_history');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS alerts_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                location_uid VARCHAR(10) NOT NULL,
                location_name VARCHAR(255) NOT NULL,
                alert_type ENUM('ALERT', 'END') NOT NULL,
                threat_types VARCHAR(255) DEFAULT NULL,
                weather_temp FLOAT DEFAULT NULL,
                weather_desc VARCHAR(100) DEFAULT NULL,
                weather_icon VARCHAR(10) DEFAULT NULL,
                raions TEXT DEFAULT NULL,
                country_count INT DEFAULT NULL,
                rf_info TEXT DEFAULT NULL,
                country_info TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_location (location_uid),
                INDEX idx_type (alert_type),
                INDEX idx_date (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('   ✅ alerts_history created\n');

        // Create subscribers table
        console.log('👥 Creating table: subscribers');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chat_id BIGINT NOT NULL UNIQUE,
                username VARCHAR(255),
                location_uid VARCHAR(10) NOT NULL,
                location_name VARCHAR(255) NOT NULL,
                location_type VARCHAR(50) DEFAULT 'oblast',
                last_alert_state BOOLEAN DEFAULT FALSE,
                subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_chat (chat_id),
                INDEX idx_location (location_uid)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('   ✅ subscribers created\n');

        // Create active_alerts table (for live message update tracking)
        console.log('🔔 Creating table: active_alerts');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS active_alerts (
                chat_id BIGINT PRIMARY KEY,
                message_id INT NOT NULL,
                location_uid VARCHAR(50) NOT NULL,
                location_name VARCHAR(255) DEFAULT NULL,
                base_text TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('   ✅ active_alerts created\n');

        // Show summary
        const [tables] = await connection.query('SHOW TABLES');
        console.log('═══════════════════════════════════');
        console.log('   Database initialized successfully!');
        console.log('═══════════════════════════════════');
        console.log(`   Host: ${DB_HOST}:${DB_PORT}`);
        console.log(`   Database: ${DB_NAME}`);
        console.log(`   Tables: ${tables.map(t => Object.values(t)[0]).join(', ')}`);
        console.log('═══════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

initDatabase();
