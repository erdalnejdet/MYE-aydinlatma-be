const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Mock data from user's request
const mockProducts = [
  {
    id: 1,
    name: 'Schneider Electric Acti9 iC60N 3P 25A C Curve MCB',
    sku: 'SCH-IC60N-3P25A',
    brand: 'SCHNEIDER ELECTRIC',
    category: 'Devre Kesiciler',
    price: 89.90,
    originalPrice: 119.90,
    discount: 25,
    rating: 4.8,
    reviewCount: 127,
    stockStatus: 'in_stock',
    stockQuantity: 45,
    images: [
      '/placeholder-product.jpg',
      '/placeholder-product.jpg',
      '/placeholder-product.jpg',
    ],
    description: 'Schneider Electric Acti9 iC60N serisi, endüstriyel ve ticari tesislerde kullanılan yüksek performanslı devre kesicidir. C karakteristik eğrisi ile motor ve transformatör koruması için idealdir.',
    features: [
      '3 Kutuplu (3P) yapı',
      '25A nominal akım değeri',
      'C Curve karakteristik eğrisi',
      '6kA kısa devre kesme kapasitesi',
      'IP20 koruma sınıfı',
      'DIN ray montaj',
      '-25°C ile +70°C çalışma sıcaklığı',
      'IEC 60898-1 standardına uygun',
    ],
    technicalSpecs: [
      { label: 'Kutup Sayısı', value: '3P' },
      { label: 'Nominal Akım', value: '25A' },
      { label: 'Karakteristik Eğri', value: 'C Curve' },
      { label: 'Kesme Kapasitesi', value: '6kA' },
      { label: 'Nominal Gerilim', value: '400V AC' },
      { label: 'Koruma Sınıfı', value: 'IP20' },
      { label: 'Montaj Tipi', value: 'DIN Rail' },
      { label: 'Standart', value: 'IEC 60898-1' },
    ],
    reviews: [
      {
        id: 1,
        author: 'Ahmet Yılmaz',
        role: 'Elektrik Mühendisi',
        rating: 5,
        date: '2 hafta önce',
        comment: 'Kaliteli ürün, hızlı teslimat. Schneider kalitesi her zaman güvenilir. Projelerimizde tercih ediyoruz.',
        helpful: 24,
      },
      {
        id: 2,
        author: 'Mehmet Demir',
        role: 'Tesis Yöneticisi',
        rating: 5,
        date: '1 ay önce',
        comment: 'Fabrikamızda kullanıyoruz, hiç sorun yaşamadık. Fiyat/performans açısından mükemmel.',
        helpful: 18,
      },
      {
        id: 3,
        author: 'Ayşe Kaya',
        role: 'Elektrikçi',
        rating: 4,
        date: '1 ay önce',
        comment: 'Montajı kolay, kaliteli malzeme. Sadece teslimat biraz geç geldi ama ürün harika.',
        helpful: 12,
      },
    ],
  },
  {
    id: 2,
    name: 'ABB S201M-C16 Miniature Circuit Breaker - 1P - 16A',
    sku: 'SKU-002',
    brand: 'ABB',
    category: 'Devre Kesiciler',
    price: 32.50,
    originalPrice: 38.00,
    discount: 14,
    rating: 4.6,
    reviewCount: 89,
    stockStatus: 'in_stock',
    stockQuantity: 67,
    images: ['/placeholder-product.jpg', '/placeholder-product.jpg', '/placeholder-product.jpg'],
    description: 'ABB S201M serisi, kompakt boyutlu ve yüksek performanslı miniature devre kesicidir. Ev ve küçük işletmeler için idealdir.',
    features: ['1 Kutuplu yapı', '16A nominal akım', 'C Curve', 'IP20 koruma', 'DIN ray montaj'],
    technicalSpecs: [
      { label: 'Kutup Sayısı', value: '1P' },
      { label: 'Nominal Akım', value: '16A' },
      { label: 'Karakteristik Eğri', value: 'C Curve' },
      { label: 'Kesme Kapasitesi', value: '6kA' },
    ],
    reviews: [
      { id: 1, author: 'Can Yıldız', role: 'Elektrikçi', rating: 5, date: '1 hafta önce', comment: 'Kaliteli ve güvenilir ürün.', helpful: 15 },
    ],
  },
  {
    id: 3,
    name: 'SIEMENS 5SY4206-7 Circuit Breaker - 2P - 20A - C Curve',
    sku: 'SKU-003',
    brand: 'SIEMENS',
    category: 'Devre Kesiciler',
    price: 39.90,
    originalPrice: 45.00,
    discount: 11,
    rating: 4.7,
    reviewCount: 102,
    stockStatus: 'low_stock',
    stockQuantity: 12,
    images: ['/placeholder-product.jpg', '/placeholder-product.jpg', '/placeholder-product.jpg'],
    description: 'Siemens 5SY serisi, endüstriyel kalitede devre kesicidir. Yüksek güvenilirlik ve uzun ömür sunar.',
    features: ['2 Kutuplu yapı', '20A nominal akım', 'C Curve', 'IP20 koruma'],
    technicalSpecs: [
      { label: 'Kutup Sayısı', value: '2P' },
      { label: 'Nominal Akım', value: '20A' },
      { label: 'Karakteristik Eğri', value: 'C Curve' },
    ],
    reviews: [
      { id: 1, author: 'Deniz Kara', role: 'Mühendis', rating: 5, date: '2 hafta önce', comment: 'Siemens kalitesi.', helpful: 20 },
    ],
  },
  {
    id: 4,
    name: 'LEGRAND DX3 MCB - 3P - 32A - C Curve',
    sku: 'SKU-004',
    brand: 'LEGRAND',
    category: 'Devre Kesiciler',
    price: 72.50,
    originalPrice: 85.00,
    discount: 15,
    rating: 4.5,
    reviewCount: 76,
    stockStatus: 'in_stock',
    stockQuantity: 34,
    images: ['/placeholder-product.jpg', '/placeholder-product.jpg', '/placeholder-product.jpg'],
    description: 'Legrand DX3 serisi, modern tasarım ve yüksek performans sunan devre kesicidir.',
    features: ['3 Kutuplu yapı', '32A nominal akım', 'C Curve', 'IP20 koruma'],
    technicalSpecs: [
      { label: 'Kutup Sayısı', value: '3P' },
      { label: 'Nominal Akım', value: '32A' },
      { label: 'Karakteristik Eğri', value: 'C Curve' },
    ],
    reviews: [
      { id: 1, author: 'Emre Şahin', role: 'Elektrikçi', rating: 4, date: '3 hafta önce', comment: 'İyi ürün, tavsiye ederim.', helpful: 12 },
    ],
  },
  {
    id: 5,
    name: 'EATON PL6-C20/2 MCB - 2P - 20A',
    sku: 'SKU-005',
    brand: 'EATON',
    category: 'Devre Kesiciler',
    price: 48.90,
    originalPrice: 58.00,
    discount: 16,
    rating: 4.4,
    reviewCount: 54,
    stockStatus: 'out_of_stock',
    stockQuantity: 0,
    images: ['/placeholder-product.jpg', '/placeholder-product.jpg', '/placeholder-product.jpg'],
    description: 'Eaton PL6 serisi, kompakt ve güvenilir devre kesicidir.',
    features: ['2 Kutuplu yapı', '20A nominal akım', 'C Curve'],
    technicalSpecs: [
      { label: 'Kutup Sayısı', value: '2P' },
      { label: 'Nominal Akım', value: '20A' },
    ],
    reviews: [],
  },
  {
    id: 6,
    name: 'Schneider Electric iC60N MCB - 3P - 16A',
    sku: 'SKU-006',
    brand: 'SCHNEIDER ELECTRIC',
    category: 'Devre Kesiciler',
    price: 55.90,
    originalPrice: 65.00,
    discount: 14,
    rating: 4.8,
    reviewCount: 143,
    stockStatus: 'in_stock',
    stockQuantity: 89,
    images: ['/placeholder-product.jpg', '/placeholder-product.jpg', '/placeholder-product.jpg'],
    description: 'Schneider Electric iC60N serisi, güvenilir ve uzun ömürlü devre kesicidir.',
    features: ['3 Kutuplu yapı', '16A nominal akım', 'C Curve', 'IP20 koruma'],
    technicalSpecs: [
      { label: 'Kutup Sayısı', value: '3P' },
      { label: 'Nominal Akım', value: '16A' },
      { label: 'Karakteristik Eğri', value: 'C Curve' },
    ],
    reviews: [
      { id: 1, author: 'Fatma Demir', role: 'Mühendis', rating: 5, date: '1 hafta önce', comment: 'Mükemmel kalite!', helpful: 25 },
    ],
  },
];

async function seedMockData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🌱 Starting to seed mock data...');
    
    // Ensure database schema is up to date
    console.log('🔧 Checking database schema...');
    await client.query(`
      DO $$ 
      BEGIN
        -- Add category column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'category'
        ) THEN
          ALTER TABLE products ADD COLUMN category VARCHAR(100);
          RAISE NOTICE 'Added category column';
        END IF;
        
        -- Add rating column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'rating'
        ) THEN
          ALTER TABLE products ADD COLUMN rating DECIMAL(3, 2) DEFAULT 0;
          RAISE NOTICE 'Added rating column';
        END IF;
        
        -- Add review_count column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'review_count'
        ) THEN
          ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0;
          RAISE NOTICE 'Added review_count column';
        END IF;
        
        -- Add technical_specs column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'technical_specs'
        ) THEN
          ALTER TABLE products ADD COLUMN technical_specs JSONB;
          RAISE NOTICE 'Added technical_specs column';
        END IF;
        
        -- Add reviews column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'reviews'
        ) THEN
          ALTER TABLE products ADD COLUMN reviews JSONB;
          RAISE NOTICE 'Added reviews column';
        END IF;
      END $$;
    `);
    console.log('✅ Database schema checked/updated');
    
    // Ensure brands exist
    const brands = ['SCHNEIDER ELECTRIC', 'ABB', 'SIEMENS', 'LEGRAND', 'EATON'];
    for (const brandName of brands) {
      await client.query(
        'INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [brandName]
      );
    }
    console.log('✅ Brands ensured');
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const product of mockProducts) {
      // Create a savepoint for each product so we can rollback just this one if it fails
      await client.query('SAVEPOINT product_insert');
      
      try {
        // Check if product with this SKU already exists
        const existingProduct = await client.query(
          'SELECT id FROM products WHERE sku = $1',
          [product.sku]
        );
        
        if (existingProduct.rows.length > 0) {
          console.log(`⏭️  Skipping ${product.sku} - already exists`);
          skippedCount++;
          await client.query('ROLLBACK TO SAVEPOINT product_insert');
          continue;
        }
        
        // Insert product
        const productResult = await client.query(`
          INSERT INTO products (
            name, sku, brand, category, description,
            original_price, current_price,
            stock_status, stock_quantity, images,
            rating, review_count, technical_specs, reviews
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `, [
          product.name,
          product.sku,
          product.brand,
          product.category,
          product.description,
          product.originalPrice,
          product.price, // currentPrice
          product.stockStatus,
          product.stockQuantity,
          product.images && product.images.length > 0 ? product.images : null,
          product.rating,
          product.reviewCount,
          product.technicalSpecs && product.technicalSpecs.length > 0 
            ? JSON.stringify(product.technicalSpecs) 
            : null,
          product.reviews && product.reviews.length > 0 
            ? JSON.stringify(product.reviews) 
            : null
        ]);
        
        const productId = productResult.rows[0].id;
        
        // Insert features
        if (product.features && product.features.length > 0) {
          const featureValues = product.features.map(feature => [productId, feature]);
          const placeholders = featureValues.map((_, index) => 
            `($${index * 2 + 1}, $${index * 2 + 2})`
          ).join(', ');
          
          const featureParams = featureValues.flat();
          await client.query(`
            INSERT INTO product_features (product_id, feature)
            VALUES ${placeholders}
          `, featureParams);
        }
        
        insertedCount++;
        console.log(`✅ Inserted: ${product.sku} - ${product.name}`);
        await client.query('RELEASE SAVEPOINT product_insert');
      } catch (err) {
        console.error(`❌ Error inserting ${product.sku}:`, err.message);
        // Rollback to savepoint to continue with next product
        await client.query('ROLLBACK TO SAVEPOINT product_insert');
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Inserted: ${insertedCount} products`);
    console.log(`   ⏭️  Skipped: ${skippedCount} products (already exist)`);
    console.log('🎉 Mock data seeding completed!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding mock data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedMockData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
