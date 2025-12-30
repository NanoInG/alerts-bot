import { addActiveAlert, pool } from './src/db.js';

async function run() {
    console.log('🧪 Inserting test alert...');
    // Chat ID 123456789 (Fake), Message ID 999
    // Location: '24' (Cherkasy) - assuming check is SAFE
    await addActiveAlert(123456789, 999, '24', '🧪 Test Alert Message Base Text');
    console.log('✅ Inserted.');
    await pool.end();
}

run();
