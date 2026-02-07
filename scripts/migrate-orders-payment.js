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
  // Add connection timeout
  connectionTimeoutMillis: 10000,
});

async function runMigration() {
  let client;
  
  try {
    console.log('🔄 Starting migration: Orders and Payment Tables...');
    console.log('📡 Testing database connection...');
    
    // Test connection first
    client = await pool.connect();
    const testResult = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log(`   Server time: ${testResult.rows[0].now}`);
    
    await client.query('BEGIN');
    
    // Read migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrate_orders_payment.sql'),
      'utf8'
    );
    
    console.log('📝 Executing migration SQL...');
    
    // Execute migration
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('orders', 'delivery_addresses', 'payment_info', 'order_items')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Show columns for each table
    const tables = ['orders', 'delivery_addresses', 'payment_info', 'order_items'];
    
    for (const table of tables) {
      const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`\n📋 Table: ${table}`);
      console.log('   Columns:');
      columnsResult.rows.forEach(col => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`     - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
      });
    }
    
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
      console.error('   Current DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    } else if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection Error: Connection refused');
      console.error('   Please check if the database server is running');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection Error: Connection timeout');
      console.error('   Please check your network connection and database server');
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
