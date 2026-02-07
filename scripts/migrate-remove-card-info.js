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
    console.log('🔄 Starting migration: Remove sensitive card information...');
    console.log('📡 Testing database connection...');
    
    // Test connection first
    client = await pool.connect();
    const testResult = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log(`   Server time: ${testResult.rows[0].now}\n`);
    
    await client.query('BEGIN');
    
    // Read migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrate_remove_card_info.sql'),
      'utf8'
    );
    
    console.log('📝 Executing migration SQL...');
    console.log('   Removing card_number, cvv, expiry_date columns...\n');
    
    // Execute migration
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify columns were removed
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
    
    console.log('\n✅ Hassas kart bilgileri başarıyla kaldırıldı!');
    console.log('   Artık sadece payment_status ve card_name tutuluyor.\n');
    
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
    
    if (err.code === 'ENOTFOUND') {
      console.error('\n💡 Connection Error: Cannot resolve hostname');
      console.error('   Please check your DATABASE_URL in .env file');
    } else if (err.code === '42703') {
      console.error('\n💡 Column does not exist - this is OK if columns were already removed');
    } else {
      console.error('\n💡 Error details:', err);
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
