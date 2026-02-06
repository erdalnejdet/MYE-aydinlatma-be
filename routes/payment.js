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
    
    // Validate paymentInfo
    if (!paymentInfo.cardNumber || !paymentInfo.cardName || 
        !paymentInfo.expiryDate || !paymentInfo.cvv) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Missing required paymentInfo fields: cardNumber, cardName, expiryDate, cvv'
      });
    }
    
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
    
    // Create order
    const orderResult = await client.query(`
      INSERT INTO orders (
        order_number, first_name, last_name, email, phone,
        total_price, kdv, grand_total, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      orderNumber,
      personalInfo.firstName,
      personalInfo.lastName,
      personalInfo.email,
      personalInfo.phone,
      totalPrice,
      kdv,
      grandTotal,
      'pending'
    ]);
    
    const order = orderResult.rows[0];
    
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
    
    // Create payment info
    await client.query(`
      INSERT INTO payment_info (
        order_id, card_number, card_name, expiry_date, cvv, payment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      order.id,
      paymentInfo.cardNumber,
      paymentInfo.cardName,
      paymentInfo.expiryDate,
      paymentInfo.cvv,
      'completed'
    ]);
    
    // Create order items
    for (const item of cartItems) {
      await client.query(`
        INSERT INTO order_items (
          order_id, product_id, product_name, product_price, quantity, product_image
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        order.id,
        item.id || null, // product_id can be null if product doesn't exist
        item.name,
        item.price,
        item.quantity,
        item.image || null
      ]);
    }
    
    // Update order status to completed
    await client.query(`
      UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [order.id]);
    
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
