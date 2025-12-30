import { pool } from '../src/db.js';

async function migrate() {
    console.log('🔄 Adding rf_info column to alerts_history...');
    try {
        await pool.query('ALTER TABLE alerts_history ADD COLUMN rf_info TEXT DEFAULT NULL');
        console.log('✅ Column added successfully');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ Column already exists');
        } else {
            console.error('❌ Error:', e.message);
        }
    }
    process.exit(0);
}

migrate();
