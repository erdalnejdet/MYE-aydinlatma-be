const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

// Email notification function (basic implementation)
const sendStatusChangeEmail = async (email, oldStatus, newStatus, orderNumber) => {
  // TODO: Implement actual email sending with nodemailer or similar
  // For now, just log the notification
  const statusNames = {
    'order_received': 'Sipariş Alındı',
    'preparing': 'Hazırlanıyor',
    'shipped': 'Kargoya Verildi',
    'returned': 'İade Edildi',
    'cancelled': 'İptal',
    'completed': 'Tamamlandı',
  };
  
  console.log(`📧 Email notification would be sent to ${email}:`);
  console.log(`   Order #${orderNumber} status changed from "${statusNames[oldStatus] || oldStatus}" to "${statusNames[newStatus] || newStatus}"`);
  
  // Example implementation with nodemailer (uncomment when ready):
  /*
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Sipariş Durumu Güncellendi - #${orderNumber}`,
    html: `
      <h2>Sipariş Durumu Güncellendi</h2>
      <p>Sipariş numaranız: <strong>#${orderNumber}</strong></p>
      <p>Eski durum: <strong>${statusNames[oldStatus] || oldStatus}</strong></p>
      <p>Yeni durum: <strong>${statusNames[newStatus] || newStatus}</strong></p>
    `,
  });
  */
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Status definitions with Turkish and English names
const orderStatuses = [
  {
    value: 'order_received',
    name: 'Sipariş Alındı',
    nameEn: 'Order Received'
  },
  {
    value: 'preparing',
    name: 'Hazırlanıyor',
    nameEn: 'Preparing'
  },
  {
    value: 'shipped',
    name: 'Kargoya Verildi',
    nameEn: 'Shipped'
  },
  {
    value: 'returned',
    name: 'İade Edildi',
    nameEn: 'Returned'
  },
  {
    value: 'cancelled',
    name: 'İptal',
    nameEn: 'Cancelled'
  },
  {
    value: 'completed',
    name: 'Tamamlandı',
    nameEn: 'Completed'
  }
];

// Status transition rules
const isValidStatusTransition = (oldStatus, newStatus) => {
  // Define allowed transitions
  const allowedTransitions = {
    'order_received': ['preparing', 'cancelled'],
    'preparing': ['shipped', 'cancelled'],
    'shipped': ['completed', 'returned'],
    'returned': ['completed', 'cancelled'],
    'cancelled': [], // Cannot transition from cancelled
    'completed': [], // Cannot transition from completed
  };

  // If no old status (new order), allow any initial status
  if (!oldStatus) {
    return true;
  }

  // Check if transition is allowed
  return allowedTransitions[oldStatus]?.includes(newStatus) || false;
};

// Get status display name
const getStatusDisplayName = (status) => {
  const statusNames = {
    'order_received': 'Sipariş Alındı',
    'preparing': 'Hazırlanıyor',
    'shipped': 'Kargoya Verildi',
    'returned': 'İade Edildi',
    'cancelled': 'İptal',
    'completed': 'Tamamlandı',
  };
  return statusNames[status] || status;
};

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
 *           enum: [order_received, preparing, shipped, returned, cancelled, completed]
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
      conditions.push(`u.email = $${paramIndex}`);
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
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Get orders
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number as "orderNumber",
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.phone,
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
          'paymentStatus', pi.payment_status
        ) as payment_info
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
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
 *                     orderReceivedOrders:
 *                       type: integer
 *                     preparingOrders:
 *                       type: integer
 *                     shippedOrders:
 *                       type: integer
 *                     returnedOrders:
 *                       type: integer
 *                     cancelledOrders:
 *                       type: integer
 *                     completedOrders:
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
      order_received: 0,
      preparing: 0,
      shipped: 0,
      returned: 0,
      cancelled: 0,
      completed: 0
    };
    
    statusResult.rows.forEach(row => {
      if (statusCounts.hasOwnProperty(row.status)) {
        statusCounts[row.status] = parseInt(row.count);
      }
    });
    
    res.json({
      success: true,
      data: {
        totalOrders,
        totalRevenue,
        orderReceivedOrders: statusCounts.order_received,
        preparingOrders: statusCounts.preparing,
        shippedOrders: statusCounts.shipped,
        returnedOrders: statusCounts.returned,
        cancelledOrders: statusCounts.cancelled,
        completedOrders: statusCounts.completed
      }
    });
  } catch (err) {
    console.error('Error fetching orders summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/statuses:
 *   get:
 *     summary: Get all order statuses with Turkish and English names
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Successful response with status list
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
 *                       value:
 *                         type: string
 *                         example: order_received
 *                       name:
 *                         type: string
 *                         example: Sipariş Alındı
 *                       nameEn:
 *                         type: string
 *                         example: Order Received
 *       500:
 *         description: Server error
 */
router.get('/statuses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        value,
        name,
        name_en as "nameEn",
        color,
        display_order as "displayOrder",
        is_active as "isActive"
      FROM order_statuses
      WHERE is_active = TRUE
      ORDER BY display_order ASC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching order statuses:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/orders/by-number/{orderNumber}/status:
 *   patch:
 *     summary: Update order status by order number
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Order number (e.g., MYE-1234567890-123)
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
 *                 enum: [order_received, preparing, shipped, returned, cancelled, completed]
 *                 example: completed
 *               notes:
 *                 type: string
 *                 example: Status updated via order number
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       404:
 *         description: Order not found
 *       400:
 *         description: Invalid status or transition
 *       500:
 *         description: Server error
 */
router.patch('/by-number/:orderNumber/status', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status, notes } = req.body;
    const changedBy = req.headers['x-user-id'] || 'admin';
    
    const validStatuses = ['order_received', 'preparing', 'shipped', 'returned', 'cancelled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Get current order by order number
    const currentOrderResult = await pool.query(`
      SELECT id, status FROM orders WHERE order_number = $1
    `, [orderNumber]);
    
    if (currentOrderResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `Order with number "${orderNumber}" not found` 
      });
    }
    
    const orderId = currentOrderResult.rows[0].id;
    const oldStatus = currentOrderResult.rows[0].status;
    
    // Check if status is the same
    if (oldStatus === status) {
      return res.status(400).json({
        success: false,
        error: 'Order is already in this status'
      });
    }
    
    // Validate status transition
    if (!isValidStatusTransition(oldStatus, status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from "${getStatusDisplayName(oldStatus)}" to "${getStatusDisplayName(status)}". Allowed transitions: ${isValidStatusTransition(oldStatus, 'order_received') ? 'order_received' : ''}${isValidStatusTransition(oldStatus, 'preparing') ? ', preparing' : ''}${isValidStatusTransition(oldStatus, 'shipped') ? ', shipped' : ''}${isValidStatusTransition(oldStatus, 'returned') ? ', returned' : ''}${isValidStatusTransition(oldStatus, 'cancelled') ? ', cancelled' : ''}${isValidStatusTransition(oldStatus, 'completed') ? ', completed' : ''}`
      });
    }
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Update order status
      const result = await pool.query(`
        UPDATE orders 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status, orderId]);
      
      // Save status history
      await pool.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
        VALUES ($1, $2, $3, $4, $5)
      `, [orderId, oldStatus, status, changedBy, notes || null]);
      
      await pool.query('COMMIT');
      
      // Get user email for notification
      const orderWithUser = await pool.query(`
        SELECT o.*, u.email 
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `, [orderId]);
      
      // Send email notification (async, don't wait for it)
      if (orderWithUser.rows[0]?.email) {
        sendStatusChangeEmail(orderWithUser.rows[0].email, oldStatus, status, orderNumber)
          .catch(err => console.error('Error sending status change email:', err));
      }
      
      res.json({ 
        success: true, 
        message: `Order #${orderNumber} status updated from "${getStatusDisplayName(oldStatus)}" to "${getStatusDisplayName(status)}"`,
        data: {
          ...result.rows[0],
          orderNumber: orderNumber
        }
      });
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Error updating order status by order number:', err);
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
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.phone,
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
          'paymentStatus', pi.payment_status
        ) as payment_info
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
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
    
    // Get status history
    const historyResult = await pool.query(`
      SELECT 
        id,
        old_status as "oldStatus",
        new_status as "newStatus",
        changed_by as "changedBy",
        notes,
        created_at as "createdAt"
      FROM order_status_history
      WHERE order_id = $1
      ORDER BY created_at DESC
    `, [id]);
    
    const orderData = {
      ...order,
      items: itemsResult.rows,
      statusHistory: historyResult.rows
    };
    
    res.json({ success: true, data: orderData });
  } catch (err) {
    console.error('Error fetching order:', err);
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
 *                 enum: [order_received, preparing, shipped, returned, cancelled, completed]
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

/**
 * @swagger
 * /api/orders/{id}/status-history:
 *   get:
 *     summary: Get order status history
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
 *         description: Successful response with status history
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get('/:id/status-history', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const historyResult = await pool.query(`
      SELECT 
        id,
        old_status as "oldStatus",
        new_status as "newStatus",
        changed_by as "changedBy",
        notes,
        created_at as "createdAt"
      FROM order_status_history
      WHERE order_id = $1
      ORDER BY created_at DESC
    `, [id]);
    
    res.json({
      success: true,
      data: historyResult.rows
    });
  } catch (err) {
    console.error('Error fetching status history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const changedBy = req.headers['x-user-id'] || 'admin'; // Can be set from auth middleware
    
    const validStatuses = ['order_received', 'preparing', 'shipped', 'returned', 'cancelled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Get current order status
    const currentOrderResult = await pool.query(`
      SELECT status FROM orders WHERE id = $1
    `, [id]);
    
    if (currentOrderResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
      });
    }
    
    const oldStatus = currentOrderResult.rows[0].status;
    
    // Check if status is the same
    if (oldStatus === status) {
      return res.status(400).json({
        success: false,
        error: 'Order is already in this status'
      });
    }
    
    // Validate status transition
    if (!isValidStatusTransition(oldStatus, status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from "${getStatusDisplayName(oldStatus)}" to "${getStatusDisplayName(status)}". Allowed transitions: ${isValidStatusTransition(oldStatus, 'order_received') ? 'order_received' : ''}${isValidStatusTransition(oldStatus, 'preparing') ? ', preparing' : ''}${isValidStatusTransition(oldStatus, 'shipped') ? ', shipped' : ''}${isValidStatusTransition(oldStatus, 'returned') ? ', returned' : ''}${isValidStatusTransition(oldStatus, 'cancelled') ? ', cancelled' : ''}${isValidStatusTransition(oldStatus, 'completed') ? ', completed' : ''}`
      });
    }
    
    // Start transaction
    await pool.query('BEGIN');
    
    try {
      // Update order status
      const result = await pool.query(`
        UPDATE orders 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status, id]);
      
      // Save status history
      await pool.query(`
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, oldStatus, status, changedBy, notes || null]);
      
      await pool.query('COMMIT');
      
      // Send email notification (async, don't wait for it)
      const orderData = result.rows[0];
      sendStatusChangeEmail(orderData.email, oldStatus, status, orderData.order_number)
        .catch(err => console.error('Error sending status change email:', err));
      
      res.json({ 
        success: true, 
        message: `Order status updated from "${getStatusDisplayName(oldStatus)}" to "${getStatusDisplayName(status)}"`,
        data: result.rows[0]
      });
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
