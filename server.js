const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation Password Protection Middleware
const swaggerAuth = (req, res, next) => {
  // Check if password is provided in query string or Authorization header
  const providedPassword = req.query.password || req.headers.authorization?.replace('Bearer ', '');
  const correctPassword = process.env.SWAGGER_PASSWORD || 'mye2024admin';
  
  if (!providedPassword) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Swagger API Documentation - Authentication Required</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          form {
            margin-top: 30px;
          }
          input {
            width: 100%;
            padding: 12px;
            margin: 10px 0;
            border: 2px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
          }
          button {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 10px;
          }
          button:hover {
            background: #5568d3;
          }
          .error {
            color: #e74c3c;
            margin-top: 10px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔒 Swagger API Documentation</h1>
          <p>Please enter the password to access the API documentation:</p>
          <form method="GET" action="/api-docs">
            <input type="password" name="password" placeholder="Enter password" required autofocus>
            <button type="submit">Access Documentation</button>
          </form>
          ${req.query.error ? '<p class="error">Incorrect password. Please try again.</p>' : ''}
        </div>
      </body>
      </html>
    `);
  }
  
  if (providedPassword !== correctPassword) {
    return res.redirect('/api-docs?error=1');
  }
  
  next();
};

// Swagger Documentation with password protection
app.use('/api-docs', swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MYE Backend API Documentation',
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database tables
const initializeDatabase = async () => {
  try {
    // Enable UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    const schema = `
      CREATE TABLE IF NOT EXISTS brands (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100) UNIQUE NOT NULL,
        brand VARCHAR(100) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        original_price DECIMAL(10, 2) NOT NULL,
        current_price DECIMAL(10, 2) NOT NULL,
        stock_status VARCHAR(20) NOT NULL DEFAULT 'in_stock',
        stock_quantity INTEGER DEFAULT 0,
        images TEXT[],
        rating DECIMAL(3, 2) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        technical_specs JSONB,
        reviews JSONB,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS product_features (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        feature TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
      CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
      CREATE INDEX IF NOT EXISTS idx_product_features_product_id ON product_features(product_id);

      -- Orders and Payment Tables
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_number VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        kdv DECIMAL(10, 2) NOT NULL,
        grand_total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS delivery_addresses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        district VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS payment_info (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        card_number VARCHAR(20) NOT NULL,
        card_name VARCHAR(255) NOT NULL,
        expiry_date VARCHAR(10) NOT NULL,
        cvv VARCHAR(10) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        product_name VARCHAR(255) NOT NULL,
        product_price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER NOT NULL,
        product_image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_delivery_addresses_order_id ON delivery_addresses(order_id);
      CREATE INDEX IF NOT EXISTS idx_payment_info_order_id ON payment_info(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
    `;
    
    await pool.query(schema);
    console.log('✅ Database tables created');
    
    // Add is_deleted columns if they don't exist (migration for existing databases)
    try {
      await pool.query(`
        DO $$ 
        BEGIN
          -- Add is_deleted to brands table
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'brands' AND column_name = 'is_deleted'
          ) THEN
            ALTER TABLE brands ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
            UPDATE brands SET is_deleted = FALSE WHERE is_deleted IS NULL;
          END IF;
          
          -- Add updated_at to brands table if it doesn't exist
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'brands' AND column_name = 'updated_at'
          ) THEN
            ALTER TABLE brands ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
          
          -- Add is_deleted to products table
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'is_deleted'
          ) THEN
            ALTER TABLE products ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
            UPDATE products SET is_deleted = FALSE WHERE is_deleted IS NULL;
          END IF;
          
          -- Add new columns for extended product data
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'category'
          ) THEN
            ALTER TABLE products ADD COLUMN category VARCHAR(100);
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'rating'
          ) THEN
            ALTER TABLE products ADD COLUMN rating DECIMAL(3, 2) DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'review_count'
          ) THEN
            ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'technical_specs'
          ) THEN
            ALTER TABLE products ADD COLUMN technical_specs JSONB;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'reviews'
          ) THEN
            ALTER TABLE products ADD COLUMN reviews JSONB;
          END IF;
        END $$;
      `);
      console.log('✅ Migration: Extended product columns added if needed');
    } catch (migrationErr) {
      console.log('⚠️ Migration note:', migrationErr.message);
    }
    
    // Insert default brands if they don't exist
    try {
      const brandResult = await pool.query(`
        INSERT INTO brands (name) VALUES 
          ('SCHNEIDER ELECTRIC'),
          ('ABB'),
          ('SIEMENS'),
          ('LEGRAND'),
          ('EATON')
        ON CONFLICT (name) DO NOTHING
        RETURNING name
      `);
      
      if (brandResult.rows.length > 0) {
        console.log(`✅ Inserted ${brandResult.rows.length} default brands`);
      } else {
        console.log('✅ Default brands already exist');
      }
      
      // Verify brands count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM brands');
      console.log(`✅ Total brands in database: ${countResult.rows[0].count}`);
    } catch (brandErr) {
      console.error('⚠️ Error inserting brands:', brandErr.message);
      // Don't fail initialization if brands already exist
      if (brandErr.code !== '42P01') { // Table doesn't exist error
        throw brandErr;
      }
    }
    
    console.log('✅ Database initialization completed successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err);
    console.error('Error details:', err.message);
    console.error('Error code:', err.code);
  }
};

// Routes
app.get('/', (req, res) => {
  res.send('MYE-BACKEND is running!');
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/test-brands', async (req, res) => {
  try {
    // Check if brands table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'brands'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Brands table does not exist. Please run migration script.' 
      });
    }
    
    const result = await pool.query('SELECT * FROM brands ORDER BY name');
    res.json({ 
      success: true, 
      tableExists: true,
      count: result.rows.length,
      brands: result.rows 
    });
  } catch (err) {
    console.error('Error testing brands:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Products routes
const productsRouter = require('./routes/products');
app.use('/api/products', productsRouter);

// Upload routes
const uploadRouter = require('./routes/upload');
app.use('/api/upload', uploadRouter);

// Brands routes
const brandsRouter = require('./routes/brands');
app.use('/api/brands', brandsRouter);

// Payment routes
const paymentRouter = require('./routes/payment');
app.use('/api/payment', paymentRouter);

// Orders routes
const ordersRouter = require('./routes/orders');
app.use('/api/orders', ordersRouter);

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    client.release();
    await initializeDatabase();
  } catch (err) {
    console.error('Failed to connect to the database', err);
  }
});
