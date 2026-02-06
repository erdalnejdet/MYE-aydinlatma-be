// Script to initialize brands table
// Run with: node scripts/init-brands.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initBrands() {
  try {
    console.log('Creating brands table...');
    
    // Create brands table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Inserting default brands...');
    
    // Insert default brands
    await pool.query(`
      INSERT INTO brands (name) VALUES 
        ('SCHNEIDER ELECTRIC'),
        ('ABB'),
        ('SIEMENS'),
        ('LEGRAND'),
        ('EATON')
      ON CONFLICT (name) DO NOTHING
    `);
    
    // Verify brands
    const result = await pool.query('SELECT * FROM brands ORDER BY name');
    console.log(`\n✅ Brands table initialized successfully!`);
    console.log(`Found ${result.rows.length} brands:`);
    result.rows.forEach(brand => {
      console.log(`  - ${brand.name} (ID: ${brand.id})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing brands:', error);
    process.exit(1);
  }
}

initBrands();
