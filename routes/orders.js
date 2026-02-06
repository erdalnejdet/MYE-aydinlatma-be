const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Get all orders with pagination and filters
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by customer email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Filter by order status
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
 *           enum: [created_at, updated_at, grand_total, order_number]
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       500:
 *         description: Server error
 */
router.get('/', async (req, res) => {
  try {
    const {
      email,
      status,
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    if (email) {
      conditions.push(`o.email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    }
    
    if (status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    
    // Validate sortBy
    const allowedSortFields = ['created_at', 'updated_at', 'grand_total', 'order_number'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Get orders
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number as "orderNumber",
        o.first_name as "firstName",
        o.last_name as "lastName",
        o.email,
        o.phone,
        o.total_price as "totalPrice",
        o.kdv,
        o.grand_total as "grandTotal",
        o.status,
        o.created_at as "created_at",
        o.updated_at as "updated_at",
        json_build_object(
          'id', da.id,
          'address', da.address,
          'city', da.city,
          'district', da.district,
          'postalCode', da.postal_code
        ) as delivery_address,
        json_build_object(
          'id', pi.id,
          'cardNumber', pi.card_number,
          'cardName', pi.card_name,
          'expiryDate', pi.expiry_date,
          'paymentStatus', pi.payment_status
        ) as payment_info
      FROM orders o
      LEFT JOIN delivery_addresses da ON o.id = da.order_id
      LEFT JOIN payment_info pi ON o.id = pi.order_id
      ${whereClause}
      ORDER BY o.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(parseInt(limit), offset);
    const result = await pool.query(ordersQuery, params);
    
    // Get order items for each order
    const orders = await Promise.all(result.rows.map(async (order) => {
      const itemsResult = await pool.query(`
        SELECT 
          id,
          product_id as "productId",
          product_name as "productName",
          product_price as "productPrice",
          quantity,
          product_image as "productImage"
        FROM order_items
        WHERE order_id = $1
        ORDER BY created_at
      `, [order.id]);
      
      return {
        ...order,
        items: itemsResult.rows
      };
    }));
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      success: true,
      data: orders,
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
    console.error('Error fetching orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Get a single order by ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     responses:
 *       200:
 *         description: Successful response
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get order with delivery address and payment info
    const orderResult = await pool.query(`
      SELECT 
        o.id,
        o.order_number as "orderNumber",
        o.first_name as "firstName",
        o.last_name as "lastName",
        o.email,
        o.phone,
        o.total_price as "totalPrice",
        o.kdv,
        o.grand_total as "grandTotal",
        o.status,
        o.created_at as "created_at",
        o.updated_at as "updated_at",
        json_build_object(
          'id', da.id,
          'address', da.address,
          'city', da.city,
          'district', da.district,
          'postalCode', da.postal_code
        ) as delivery_address,
        json_build_object(
          'id', pi.id,
          'cardNumber', pi.card_number,
          'cardName', pi.card_name,
          'expiryDate', pi.expiry_date,
          'paymentStatus', pi.payment_status
        ) as payment_info
      FROM orders o
      LEFT JOIN delivery_addresses da ON o.id = da.order_id
      LEFT JOIN payment_info pi ON o.id = pi.order_id
      WHERE o.id = $1
    `, [id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    const order = orderResult.rows[0];
    
    // Get order items
    const itemsResult = await pool.query(`
      SELECT 
        id,
        product_id as "productId",
        product_name as "productName",
        product_price as "productPrice",
        quantity,
        product_image as "productImage"
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at
    `, [id]);
    
    const orderData = {
      ...order,
      items: itemsResult.rows
    };
    
    res.json({ success: true, data: orderData });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/summary:
 *   get:
 *     summary: Get orders summary statistics
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Successful response with order statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalOrders:
 *                       type: integer
 *                     totalRevenue:
 *                       type: number
 *                     pendingOrders:
 *                       type: integer
 *                     completedOrders:
 *                       type: integer
 *                     cancelledOrders:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/summary', async (req, res) => {
  try {
    // Get total orders count
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM orders');
    const totalOrders = parseInt(totalResult.rows[0].count);
    
    // Get total revenue (sum of grand_total for completed orders)
    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(grand_total), 0) as total_revenue 
      FROM orders 
      WHERE status = 'completed'
    `);
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue) || 0;
    
    // Get orders by status
    const statusResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM orders
      GROUP BY status
    `);
    
    const statusCounts = {
      pending: 0,
      completed: 0,
      cancelled: 0
    };
    
    statusResult.rows.forEach(row => {
      statusCounts[row.status] = parseInt(row.count);
    });
    
    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        pendingOrders: statusCounts.pending,
        completedOrders: statusCounts.completed,
        cancelledOrders: statusCounts.cancelled
      }
    });
  } catch (err) {
    console.error('Error fetching orders summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, cancelled]
 *                 example: completed
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       404:
 *         description: Order not found
 *       400:
 *         description: Invalid status
 *       500:
 *         description: Server error
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    const result = await pool.query(`
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Order status updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
