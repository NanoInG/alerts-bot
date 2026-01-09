/**
 * Database Migration: Add location_name to active_alerts
 * Run this once: node migrate_add_location_name.js
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

async function migrate() {
    console.log('🔧 Adding location_name column to active_alerts...\n');

    const connection = await mysql.createConnection({
        host: DB_HOST,
        port: parseInt(DB_PORT) || 3306,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    });

    try {
        // Check if column exists
        const [columns] = await connection.query('SHOW COLUMNS FROM active_alerts LIKE "location_name"');

        if (columns.length === 0) {
            await connection.query('ALTER TABLE active_alerts ADD COLUMN location_name VARCHAR(255) AFTER location_uid');
            console.log('✅ Column location_name added!');
        } else {
            console.log('ℹ️ Column location_name already exists, skipping.');
        }

        // Show updated table structure
        const [cols] = await connection.query('SHOW COLUMNS FROM active_alerts');
        console.log('\n📋 Current active_alerts structure:');
        cols.forEach(c => console.log(`   - ${c.Field}: ${c.Type}`));

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
