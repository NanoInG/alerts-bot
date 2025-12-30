import { pool } from '../src/db.js';

async function run() {
    console.log('Inserting test RF history record...');
    try {
        await pool.query(`INSERT INTO alerts_history 
        (location_uid, location_name, alert_type, rf_info, created_at) 
        VALUES ('TEST_RF', 'Тестова Область (РФ Demo)', 'ALERT', '🔥 Кошмарим підарів в: Курська НР, Бєлгород', NOW())`);
        console.log('✅ Inserted');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

run();
