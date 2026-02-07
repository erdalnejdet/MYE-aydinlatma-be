const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Generate unique order number
 */
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `MYE-${timestamp}-${random}`;
};

/**
 * @swagger
 * /api/payment:
 *   post:
 *     summary: Process payment and create order
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - personalInfo
 *               - deliveryAddress
 *               - paymentInfo
 *               - cartItems
 *               - totalPrice
 *               - kdv
 *               - grandTotal
 *             properties:
 *               personalInfo:
 *                 type: object
 *                 required:
 *                   - firstName
 *                   - lastName
 *                   - email
 *                   - phone
 *                 properties:
 *                   firstName:
 *                     type: string
 *                     example: Ahmet
 *                   lastName:
 *                     type: string
 *                     example: Yılmaz
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: ahmet@ornek.com
 *                   phone:
 *                     type: string
 *                     example: "0555 123 45 67"
 *               deliveryAddress:
 *                 type: object
 *                 required:
 *                   - address
 *                   - city
 *                   - district
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: "Cumhuriyet Mah. Atatürk Cad. No:123 D:4"
 *                   city:
 *                     type: string
 *                     example: İstanbul
 *                   district:
 *                     type: string
 *                     example: Kadıköy
 *                   postalCode:
 *                     type: string
 *                     example: "34722"
 *               paymentInfo:
 *                 type: object
 *                 required:
 *                   - cardNumber
 *                   - cardName
 *                   - expiryDate
 *                   - cvv
 *                 properties:
 *                   cardNumber:
 *                     type: string
 *                     example: "1234 5678 9012 3456"
 *                   cardName:
 *                     type: string
 *                     example: "AHMET YILMAZ"
 *                   expiryDate:
 *                     type: string
 *                     example: "12/28"
 *                   cvv:
 *                     type: string
 *                     example: "123"
 *               cartItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - name
 *                     - price
 *                     - quantity
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "1"
 *                     name:
 *                       type: string
 *                       example: "Philips LED Ampul 9W"
 *                     price:
 *                       type: number
 *                       example: 45.90
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *                     image:
 *                       type: string
 *                       example: "/images/bulb.jpg"
 *               totalPrice:
 *                 type: number
 *                 example: 219.30
 *               kdv:
 *                 type: number
 *                 example: 43.86
 *               grandTotal:
 *                 type: number
 *                 example: 263.16
 *     responses:
 *       201:
 *         description: Payment processed and order created successfully
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
 *                   example: Payment processed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId:
 *                       type: string
 *                       format: uuid
 *                     orderNumber:
 *                       type: string
 *                       example: "MYE-1234567890-123"
 *       400:
 *         description: Bad request (missing required fields)
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
      personalInfo,
      deliveryAddress,
      paymentInfo,
      cartItems,
      totalPrice,
      kdv,
      grandTotal
    } = req.body;
    
    // Validate required fields
    if (!personalInfo || !deliveryAddress || !paymentInfo || !cartItems || 
        !totalPrice || kdv === undefined || !grandTotal) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: personalInfo, deliveryAddress, paymentInfo, cartItems, totalPrice, kdv, grandTotal'
      });
    }
    
    // Validate personalInfo
    if (!personalInfo.firstName || !personalInfo.lastName || 
        !personalInfo.email || !personalInfo.phone) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required personalInfo fields: firstName, lastName, email, phone'
      });
    }
    
    // Validate deliveryAddress
    if (!deliveryAddress.address || !deliveryAddress.city || !deliveryAddress.district) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required deliveryAddress fields: address, city, district'
      });
    }
    
    // Validate paymentInfo (card details are processed but not stored for security)
    // Note: Card information is validated but not saved to database for PCI-DSS compliance
    if (!paymentInfo.cardNumber || !paymentInfo.cardName || 
        !paymentInfo.expiryDate || !paymentInfo.cvv) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required paymentInfo fields: cardNumber, cardName, expiryDate, cvv'
      });
    }
    
    // Security: Card information is validated but NOT stored in database
    // Only payment status is saved for tracking purposes
    
    // Validate cartItems
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'cartItems must be a non-empty array'
      });
    }
    
    // Generate unique order number
    const orderNumber = generateOrderNumber();
    
    // Check if user exists by email, if not create one
    let userResult = await client.query(`
      SELECT id FROM users WHERE email = $1
    `, [personalInfo.email]);
    
    let userId;
    if (userResult.rows.length === 0) {
      // Create new user
      const newUserResult = await client.query(`
        INSERT INTO users (first_name, last_name, email, phone)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [
        personalInfo.firstName,
        personalInfo.lastName,
        personalInfo.email,
        personalInfo.phone
      ]);
      userId = newUserResult.rows[0].id;
    } else {
      // Update existing user info if changed
      userId = userResult.rows[0].id;
      await client.query(`
        UPDATE users 
        SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [
        personalInfo.firstName,
        personalInfo.lastName,
        personalInfo.phone,
        userId
      ]);
    }
    
    // Create order with user_id
    const orderResult = await client.query(`
      INSERT INTO orders (
        order_number, user_id, total_price, kdv, grand_total, status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      orderNumber,
      userId,
      totalPrice,
      kdv,
      grandTotal,
      'order_received'
    ]);
    
    const order = orderResult.rows[0];
    
    // Create initial status history entry
    await client.query(`
      INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
      VALUES ($1, NULL, $2, $3, $4)
    `, [
      order.id,
      'order_received',
      'system',
      'Sipariş oluşturuldu'
    ]);
    
    // Create delivery address
    await client.query(`
      INSERT INTO delivery_addresses (
        order_id, address, city, district, postal_code
      )
      VALUES ($1, $2, $3, $4, $5)
    `, [
      order.id,
      deliveryAddress.address,
      deliveryAddress.city,
      deliveryAddress.district,
      deliveryAddress.postalCode || null
    ]);
    
    // Create payment info (only payment status, NO card data stored)
    // Security: Card numbers, CVV, expiry dates, and card names are NOT stored for PCI-DSS compliance
    // Payment info is validated but immediately discarded after processing
    await client.query(`
      INSERT INTO payment_info (
        order_id, payment_status
      )
      VALUES ($1, $2)
    `, [
      order.id,
      'completed'
    ]);
    
    // Create order items and update stock quantities
    for (const item of cartItems) {
      // Parse product_id (can be string or number)
      const productId = item.id ? parseInt(item.id) : null;
      
      // Use currentPrice if available, otherwise fallback to price
      const productPrice = item.currentPrice || item.price || 0;
      
      // Insert order item
      await client.query(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_price, quantity, product_image
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        order.id,
        productId, // product_id as integer
        item.name,
        productPrice,
        item.quantity,
        item.image || null
      ]);
      
      // Update stock quantity if product_id exists
      if (productId) {
        // Get current stock quantity
        const productResult = await client.query(`
          SELECT stock_quantity, stock_status 
          FROM products 
          WHERE id = $1 AND is_deleted = FALSE
        `, [productId]);
        
        if (productResult.rows.length > 0) {
          const currentStock = parseInt(productResult.rows[0].stock_quantity) || 0;
          const orderQuantity = parseInt(item.quantity) || 0;
          
          // Check if enough stock available
          if (currentStock < orderQuantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              error: `Yetersiz stok: ${item.name} için ${currentStock} adet mevcut, ${orderQuantity} adet talep edildi.`
            });
          }
          
          // Calculate new stock quantity
          const newStock = currentStock - orderQuantity;
          
          // Determine new stock status
          let newStockStatus = 'in_stock';
          if (newStock === 0) {
            newStockStatus = 'out_of_stock';
          } else if (newStock <= 10) {
            newStockStatus = 'low_stock';
          }
          
          // Update product stock
          await client.query(`
            UPDATE products 
            SET 
              stock_quantity = $1,
              stock_status = $2,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND is_deleted = FALSE
          `, [newStock, newStockStatus, item.id]);
          
          console.log(`✅ Stok güncellendi: ${item.name} - Eski: ${currentStock}, Yeni: ${newStock}, Durum: ${newStockStatus}`);
        }
      }
    }
    
    // Order status is already set to 'order_received' when created
    // Status will be updated through the order management system
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        grandTotal: order.grand_total
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing payment:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
