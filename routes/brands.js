const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * @swagger
 * /api/brands:
 *   get:
 *     summary: Get all brands
 *     tags: [Brands]
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    // First check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'brands'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist, create it
      console.log('Brands table not found, creating...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS brands (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) UNIQUE NOT NULL,
          is_deleted BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
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
    }
    
    // Only fetch non-deleted brands
    const result = await pool.query(`
      SELECT id, name, created_at
      FROM brands
      WHERE is_deleted = FALSE
      ORDER BY name ASC
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching brands:', err);
    console.error('Error code:', err.code);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/brands:
 *   post:
 *     summary: Create a new brand
 *     tags: [Brands]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: SCHNEIDER ELECTRIC
 *     responses:
 *       201:
 *         description: Brand created successfully
 *       400:
 *         description: Bad request (missing name or duplicate)
 *       500:
 *         description: Server error
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Marka adı gereklidir'
      });
    }
    
    // Check if brand already exists (including deleted ones for unique constraint)
    // But allow re-adding deleted brands
    const existingBrand = await pool.query(
      'SELECT id, is_deleted FROM brands WHERE name = $1',
      [name.trim()]
    );
    
    if (existingBrand.rows.length > 0) {
      const brand = existingBrand.rows[0];
      if (brand.is_deleted) {
        // Restore deleted brand
        const result = await pool.query(`
          UPDATE brands 
          SET is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `, [brand.id]);
        return res.status(200).json({ success: true, data: result.rows[0], restored: true });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Bu marka zaten mevcut'
        });
      }
    }
    
    const result = await pool.query(`
      INSERT INTO brands (name)
      VALUES ($1)
      RETURNING *
    `, [name.trim()]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating brand:', err);
    
    // Handle unique constraint violation
    if (err.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Bu marka zaten mevcut'
      });
    }
    
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/brands/{id}:
 *   delete:
 *     summary: Delete a brand
 *     tags: [Brands]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Brand deleted successfully
 *       404:
 *         description: Brand not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete: Set is_deleted to true instead of actually deleting
    const result = await pool.query(`
      UPDATE brands 
      SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_deleted = FALSE
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Marka bulunamadı veya zaten silinmiş' });
    }
    
    res.json({ success: true, message: 'Marka başarıyla silindi' });
  } catch (err) {
    console.error('Error deleting brand:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
