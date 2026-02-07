const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Veritabanı tablolarını kontrol ediliyor...\n');
    
    // Tüm tabloları listele
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📊 Mevcut Tablolar:');
    if (tablesResult.rows.length === 0) {
      console.log('   ⚠️  Hiç tablo bulunamadı!\n');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
      console.log('');
    }
    
    // Orders tablosunu kontrol et
    const ordersTableExists = tablesResult.rows.some(row => row.table_name === 'orders');
    const paymentTableExists = tablesResult.rows.some(row => row.table_name === 'payment_info');
    const deliveryTableExists = tablesResult.rows.some(row => row.table_name === 'delivery_addresses');
    const orderItemsTableExists = tablesResult.rows.some(row => row.table_name === 'order_items');
    
    console.log('📋 Orders ve Payment Tabloları Durumu:');
    console.log(`   orders: ${ordersTableExists ? '✅ Var' : '❌ Yok'}`);
    console.log(`   payment_info: ${paymentTableExists ? '✅ Var' : '❌ Yok'}`);
    console.log(`   delivery_addresses: ${deliveryTableExists ? '✅ Var' : '❌ Yok'}`);
    console.log(`   order_items: ${orderItemsTableExists ? '✅ Var' : '❌ Yok'}\n`);
    
    // Eğer orders tablosu varsa kolonlarını göster
    if (ordersTableExists) {
      const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'orders'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Orders Tablosu Kolonları:');
      columnsResult.rows.forEach(col => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`   - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
      });
      console.log('');
    }
    
    // Eğer payment_info tablosu varsa kolonlarını göster
    if (paymentTableExists) {
      const columnsResult = await client.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'payment_info'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 payment_info Tablosu Kolonları:');
      columnsResult.rows.forEach(col => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`   - ${col.column_name}: ${col.data_type}${length} ${nullable}`);
      });
      console.log('');
    }
    
    // Veritabanı bilgilerini göster
    const dbInfoResult = await client.query('SELECT current_database(), current_user');
    console.log('🔗 Veritabanı Bilgileri:');
    console.log(`   Database: ${dbInfoResult.rows[0].current_database}`);
    console.log(`   User: ${dbInfoResult.rows[0].current_user}`);
    console.log(`   Connection String: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}\n`);
    
    // Eğer tablolar yoksa uyarı ver
    if (!ordersTableExists || !paymentTableExists || !deliveryTableExists || !orderItemsTableExists) {
      console.log('⚠️  UYARI: Orders ve Payment tabloları bulunamadı!');
      console.log('💡 Çözüm:');
      console.log('   1. Sunucuyu başlatın: npm start');
      console.log('   2. Veya migration çalıştırın: npm run migrate-orders');
      console.log('   3. Veya Docker Compose\'u yeniden başlatın: docker-compose restart postgres\n');
    } else {
      console.log('✅ Tüm tablolar mevcut!\n');
    }
    
  } catch (err) {
    console.error('❌ Hata:', err.message);
    console.error('💡 Veritabanı bağlantısını kontrol edin.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables();
