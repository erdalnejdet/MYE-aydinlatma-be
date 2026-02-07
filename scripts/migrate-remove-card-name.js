const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL is not set in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function runMigration() {
  let client;
  
  try {
    console.log('🔄 Starting migration: Remove card_name column...');
    console.log('📡 Testing database connection...');
    
    client = await pool.connect();
    const testResult = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log(`   Server time: ${testResult.rows[0].now}\n`);
    
    await client.query('BEGIN');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrate_remove_card_name.sql'),
      'utf8'
    );
    
    console.log('📝 Executing migration SQL...');
    console.log('   Removing card_name column...\n');
    
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!\n');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'payment_info'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 payment_info Tablosu Kolonları (Güncel):');
    columnsResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ card_name kolonu başarıyla kaldırıldı!');
    console.log('   Artık sadece payment_status tutuluyor.\n');
    
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('⚠️ Rollback error:', rollbackErr.message);
      }
    }
    
    console.error('\n❌ Migration failed!');
    console.error('Error:', err.message);
    
    if (err.code === '42703') {
      console.error('\n💡 Column does not exist - this is OK if column was already removed');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration();
