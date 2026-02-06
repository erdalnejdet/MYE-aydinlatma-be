const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with search, filter, and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name, SKU, or description
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filter by brand
 *       - in: query
 *         name: stockStatus
 *         schema:
 *           type: string
 *           enum: [in_stock, low_stock, out_of_stock]
 *         description: Filter by stock status
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, name, sku, brand, current_price, stock_quantity]
 *           default: created_at
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductListResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res) => {
  try {
    const {
      search,           // Search in name, sku, description
      brand,            // Filter by brand
      stockStatus,      // Filter by stock status
      minPrice,         // Minimum price filter
      maxPrice,         // Maximum price filter
      page = 1,         // Page number (default: 1)
      limit = 10,       // Items per page (default: 10)
      sortBy = 'created_at', // Sort field (default: created_at)
      sortOrder = 'DESC'    // Sort order (ASC or DESC)
    } = req.query;

    // Build WHERE clause
    const conditions = ['p.is_deleted = FALSE']; // Only get non-deleted products
    const params = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      conditions.push(`(
        p.name ILIKE $${paramIndex} OR 
        p.sku ILIKE $${paramIndex} OR 
        p.description ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Brand filter
    if (brand) {
      conditions.push(`p.brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    // Stock status filter
    if (stockStatus) {
      conditions.push(`p.stock_status = $${paramIndex}`);
      params.push(stockStatus);
      paramIndex++;
    }

    // Price filters
    if (minPrice) {
      conditions.push(`p.current_price >= $${paramIndex}`);
      params.push(parseFloat(minPrice));
      paramIndex++;
    }

    if (maxPrice) {
      conditions.push(`p.current_price <= $${paramIndex}`);
      params.push(parseFloat(maxPrice));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : 'WHERE p.is_deleted = FALSE';

    // Validate sortBy to prevent SQL injection
    const allowedSortFields = ['created_at', 'updated_at', 'name', 'sku', 'brand', 'current_price', 'stock_quantity'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination (only non-deleted products)
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get products with features
    const productsQuery = `
      SELECT 
        p.*,
        COALESCE(
          json_agg(
            json_build_object('id', pf.id, 'feature', pf.feature)
          ) FILTER (WHERE pf.id IS NOT NULL),
          '[]'
        ) as features
      FROM products p
      LEFT JOIN product_features pf ON p.id = pf.product_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(parseInt(limit), offset);
    const result = await pool.query(productsQuery, params);
    
    // Transform features from array of objects to array of strings
    // Parse JSONB fields (technical_specs, reviews)
    const products = result.rows.map(product => {
      // Parse technical_specs if it's a string
      if (product.technical_specs && typeof product.technical_specs === 'string') {
        try {
          product.technical_specs = JSON.parse(product.technical_specs);
        } catch (e) {
          product.technical_specs = [];
        }
      }
      
      // Parse reviews if it's a string
      if (product.reviews && typeof product.reviews === 'string') {
        try {
          product.reviews = JSON.parse(product.reviews);
        } catch (e) {
          product.reviews = [];
        }
      }
      
      return {
        ...product,
        features: Array.isArray(product.features) && product.features.length > 0 && product.features[0] !== null
          ? product.features.map(f => f.feature || f)
          : []
      };
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const productResult = await pool.query(`
      SELECT 
        p.*,
        COALESCE(
          json_agg(DISTINCT pf.feature) FILTER (WHERE pf.feature IS NOT NULL),
          '[]'::json
        ) as features
      FROM products p
      LEFT JOIN product_features pf ON p.id = pf.product_id
      WHERE p.id = $1 AND p.is_deleted = FALSE
      GROUP BY p.id
    `, [id]);
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    const product = productResult.rows[0];
    
    // Parse JSON fields if they exist
    if (product.technical_specs && typeof product.technical_specs === 'string') {
      try {
        product.technical_specs = JSON.parse(product.technical_specs);
      } catch (e) {
        product.technical_specs = [];
      }
    }
    
    if (product.reviews && typeof product.reviews === 'string') {
      try {
        product.reviews = JSON.parse(product.reviews);
      } catch (e) {
        product.reviews = [];
      }
    }
    
    res.json({ success: true, data: product });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - sku
 *               - brand
 *               - originalPrice
 *               - currentPrice
 *             properties:
 *               name:
 *                 type: string
 *                 example: iC60H Miniature Circuit Breaker
 *               sku:
 *                 type: string
 *                 example: SKU-001
 *               brand:
 *                 type: string
 *                 example: SCHNEIDER ELECTRIC
 *               description:
 *                 type: string
 *               originalPrice:
 *                 type: number
 *                 example: 500.00
 *               currentPrice:
 *                 type: number
 *                 example: 450.00
 *               stockStatus:
 *                 type: string
 *                 enum: [in_stock, low_stock, out_of_stock]
 *                 default: in_stock
 *               stockQuantity:
 *                 type: integer
 *                 default: 0
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["2 Pole", "16A Rating"]
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["/uploads/image1.jpg"]
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       400:
 *         description: Bad request (missing fields or duplicate SKU)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      name,
      sku,
      brand,
      category,
      description,
      originalPrice,
      currentPrice,
      stockStatus,
      stockQuantity,
      rating = 0,
      reviewCount = 0,
      features = [],
      technicalSpecs = [],
      reviews = [],
      images = []
    } = req.body;
    
    console.log('Received images:', images);
    console.log('Images type:', typeof images, 'Is array:', Array.isArray(images));
    
    // Validate required fields
    if (!name || !sku || !brand || !originalPrice || !currentPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, sku, brand, originalPrice, currentPrice'
      });
    }
    
    // Check if SKU already exists (only for non-deleted products)
    const existingProduct = await client.query(
      'SELECT id FROM products WHERE sku = $1 AND is_deleted = FALSE',
      [sku]
    );
    
    if (existingProduct.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'A product with this SKU already exists'
      });
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
      RETURNING *
    `, [
      name,
      sku,
      brand,
      category || null,
      description || null,
      originalPrice,
      currentPrice,
      stockStatus || 'in_stock',
      stockQuantity || 0,
      images && images.length > 0 ? images : null,
      rating || 0,
      reviewCount || 0,
      technicalSpecs && technicalSpecs.length > 0 ? JSON.stringify(technicalSpecs) : null,
      reviews && reviews.length > 0 ? JSON.stringify(reviews) : null
    ]);
    
    const product = productResult.rows[0];
    
    // Insert features if any
    if (features && features.length > 0) {
      const featureValues = features.map(feature => [product.id, feature]);
      const placeholders = featureValues.map((_, index) => 
        `($${index * 2 + 1}, $${index * 2 + 2})`
      ).join(', ');
      
      const featureParams = featureValues.flat();
      await client.query(`
        INSERT INTO product_features (product_id, feature)
        VALUES ${placeholders}
      `, featureParams);
    }
    
    await client.query('COMMIT');
    
    // Fetch the complete product with features
    const featuresResult = await client.query(
      'SELECT feature FROM product_features WHERE product_id = $1',
      [product.id]
    );
    
    const productWithFeatures = {
      ...product,
      features: featuresResult.rows.map(row => row.feature)
    };
    
    // Parse JSONB fields
    if (productWithFeatures.technical_specs && typeof productWithFeatures.technical_specs === 'string') {
      try {
        productWithFeatures.technical_specs = JSON.parse(productWithFeatures.technical_specs);
      } catch (e) {
        productWithFeatures.technical_specs = [];
      }
    }
    
    if (productWithFeatures.reviews && typeof productWithFeatures.reviews === 'string') {
      try {
        productWithFeatures.reviews = JSON.parse(productWithFeatures.reviews);
      } catch (e) {
        productWithFeatures.reviews = [];
      }
    }
    
    res.status(201).json({ success: true, data: productWithFeatures });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating product:', err);
    
    // Handle unique constraint violation (fallback - should not happen due to pre-check)
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A product with this SKU already exists (including deleted products)'
      });
    }
    
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               sku:
 *                 type: string
 *               brand:
 *                 type: string
 *               description:
 *                 type: string
 *               originalPrice:
 *                 type: number
 *               currentPrice:
 *                 type: number
 *               stockStatus:
 *                 type: string
 *                 enum: [in_stock, low_stock, out_of_stock]
 *               stockQuantity:
 *                 type: integer
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const {
      name,
      sku,
      brand,
      category,
      description,
      originalPrice,
      currentPrice,
      stockStatus,
      stockQuantity,
      rating,
      reviewCount,
      features = [],
      technicalSpecs,
      reviews,
      images = [],
      is_deleted, // Extract but don't use - only for validation
      ...rest // Ignore any other fields
    } = req.body;
    
    // is_deleted cannot be updated via this endpoint - only checked in WHERE clause
    if (is_deleted !== undefined) {
      console.warn('Warning: is_deleted field cannot be updated via PUT endpoint. Use DELETE endpoint instead.');
    }
    
    console.log('Update - Received images:', images);
    console.log('Update - Images type:', typeof images, 'Is array:', Array.isArray(images));
    
    // If SKU is being updated, check if it already exists (excluding current product)
    if (sku) {
      const existingProduct = await client.query(
        'SELECT id FROM products WHERE sku = $1 AND id != $2 AND is_deleted = FALSE',
        [sku, id]
      );
      
      if (existingProduct.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'A product with this SKU already exists'
        });
      }
    }
    
    // Update product
    // Note: images handling is done in the dynamic query section below
    const technicalSpecsValue = technicalSpecs !== undefined 
      ? (technicalSpecs && technicalSpecs.length > 0 ? JSON.stringify(technicalSpecs) : null)
      : null;
    const reviewsValue = reviews !== undefined 
      ? (reviews && reviews.length > 0 ? JSON.stringify(reviews) : null)
      : null;
    
    // Build dynamic UPDATE query based on provided fields
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }
    if (sku !== undefined) {
      updateFields.push(`sku = $${paramIndex}`);
      updateValues.push(sku);
      paramIndex++;
    }
    if (brand !== undefined) {
      updateFields.push(`brand = $${paramIndex}`);
      updateValues.push(brand);
      paramIndex++;
    }
    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex}`);
      updateValues.push(category);
      paramIndex++;
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(description);
      paramIndex++;
    }
    if (originalPrice !== undefined) {
      updateFields.push(`original_price = $${paramIndex}::numeric`);
      updateValues.push(originalPrice);
      paramIndex++;
    }
    if (currentPrice !== undefined) {
      updateFields.push(`current_price = $${paramIndex}::numeric`);
      updateValues.push(currentPrice);
      paramIndex++;
    }
    if (stockStatus !== undefined) {
      updateFields.push(`stock_status = $${paramIndex}`);
      updateValues.push(stockStatus);
      paramIndex++;
    }
    if (stockQuantity !== undefined) {
      updateFields.push(`stock_quantity = $${paramIndex}::integer`);
      updateValues.push(stockQuantity);
      paramIndex++;
    }
    if (images !== undefined) {
      // Handle images: empty array means clear images, null means don't update
      if (images.length === 0) {
        updateFields.push(`images = $${paramIndex}::text[]`);
        updateValues.push([]);
      } else {
        updateFields.push(`images = $${paramIndex}::text[]`);
        updateValues.push(images);
      }
      paramIndex++;
    }
    if (rating !== undefined) {
      updateFields.push(`rating = $${paramIndex}::numeric`);
      updateValues.push(rating);
      paramIndex++;
    }
    if (reviewCount !== undefined) {
      updateFields.push(`review_count = $${paramIndex}::integer`);
      updateValues.push(reviewCount);
      paramIndex++;
    }
    if (technicalSpecsValue !== null) {
      updateFields.push(`technical_specs = $${paramIndex}::jsonb`);
      updateValues.push(technicalSpecsValue);
      paramIndex++;
    }
    if (reviewsValue !== null) {
      updateFields.push(`reviews = $${paramIndex}::jsonb`);
      updateValues.push(reviewsValue);
      paramIndex++;
    }
    
    // Always update updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add WHERE clause
    updateValues.push(id);
    
    if (updateFields.length === 1) {
      // Only updated_at, no fields to update
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No fields provided to update'
      });
    }
    
    const productResult = await client.query(`
      UPDATE products
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex} AND is_deleted = FALSE
      RETURNING *
    `, updateValues);
    
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Product not found or deleted' });
    }
    
    // Update features only if features array is provided
    if (features !== undefined) {
      // Delete old features
      await client.query('DELETE FROM product_features WHERE product_id = $1', [id]);
      
      // Insert new features if any
      if (features && features.length > 0) {
        const featureValues = features.map(feature => [id, feature]);
        const placeholders = featureValues.map((_, index) => 
          `($${index * 2 + 1}, $${index * 2 + 2})`
        ).join(', ');
        
        const featureParams = featureValues.flat();
        await client.query(`
          INSERT INTO product_features (product_id, feature)
          VALUES ${placeholders}
        `, featureParams);
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch the complete product with features
    const featuresResult = await client.query(
      'SELECT feature FROM product_features WHERE product_id = $1',
      [id]
    );
    
    const product = {
      ...productResult.rows[0],
      features: featuresResult.rows.map(row => row.feature)
    };
    
    // Parse JSONB fields
    if (product.technical_specs && typeof product.technical_specs === 'string') {
      try {
        product.technical_specs = JSON.parse(product.technical_specs);
      } catch (e) {
        product.technical_specs = [];
      }
    }
    
    if (product.reviews && typeof product.reviews === 'string') {
      try {
        product.reviews = JSON.parse(product.reviews);
      } catch (e) {
        product.reviews = [];
      }
    }
    
    res.json({ success: true, data: product });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product UUID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product deleted successfully
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete: Set is_deleted to true instead of actually deleting
    const result = await pool.query(`
      UPDATE products 
      SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found or already deleted' });
    }
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
