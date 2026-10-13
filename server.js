const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Create connection pool to MySQL database
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the database connection
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error connecting to MySQL database:', err.message);
    } else {
        console.log('✅ Connected to MySQL database (`wardrobe_db`) successfully!');
        connection.release();
    }
});

// ==========================
// API ENDPOINTS
// ==========================

// 1. Get all products (replaces hardcoded products array in index.html)
app.get('/api/products', (req, res) => {
    const query = 'SELECT * FROM products';
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error while fetching products' });
        }
        
        // Format sizes string back into an array for frontend compatibility (e.g. 'S,M,L,XL' -> ['S', 'M', 'L', 'XL'])
        const formattedProducts = results.map(product => ({
            ...product,
            sizes: product.sizes.split(',')
        }));

        res.json(formattedProducts);
    });
});

// 2. Checkout / Place Order endpoint (receives data from payment.html)
app.post('/api/orders', (req, res) => {
    const { total_amount, shipping_name, shipping_email, shipping_address, city, state, zip_code, items } = req.body;

    const orderQuery = `
        INSERT INTO orders (total_amount, shipping_name, shipping_email, shipping_address, city, state, zip_code) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(orderQuery, [total_amount, shipping_name, shipping_email, shipping_address, city, state, zip_code], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to place order' });
        }
        res.status(201).json({ message: 'Order placed successfully!', orderId: result.insertId });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});