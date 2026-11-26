const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configure session middleware before routes
app.use(session({
    secret: process.env.SESSION_SECRET || 'change_this_secret_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if serving strictly over HTTPS with trust proxy enabled
}));

// Serve the website files too, so the whole site runs at http://localhost:3000
app.use(express.static(require('path').join(__dirname, 'public')));

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

// Require users to be logged in before accessing private data
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please log in first' });
    }

    next();
}


// ==========================
// CART API ENDPOINTS
// ==========================

// Get only the logged-in user's cart
app.get('/api/cart', requireAuth, (req, res) => {
    const query = 'SELECT * FROM cart_items WHERE user_id = ?';

    db.query(query, [req.session.userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error fetching cart' });
        }

        res.json(results);
    });
});

// Add an item to the logged-in user's cart
app.post('/api/cart', requireAuth, (req, res) => {
    const { product_id, name, color, size, price, quantity } = req.body;

    const query = `
        INSERT INTO cart_items
        (user_id, product_id, name, color, size, price, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [req.session.userId, product_id, name, color, size, price, quantity || 1],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to add item to cart' });
            }

            res.status(201).json({
                message: 'Added to cart successfully',
                id: result.insertId
            });
        }
    );
});

// Change quantity only if the cart item belongs to this user
app.patch('/api/cart/:id', requireAuth, (req, res) => {
    const quantity = parseInt(req.body.quantity, 10);

    if (!quantity || quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be at least 1' });
    }

    const query = `
        UPDATE cart_items
        SET quantity = ?
        WHERE id = ? AND user_id = ?
    `;

    db.query(query, [quantity, req.params.id, req.session.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to update cart item' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ message: 'Cart item updated' });
    });
});

// Empty only this user's cart
app.delete('/api/cart', requireAuth, (req, res) => {
    db.query(
        'DELETE FROM cart_items WHERE user_id = ?',
        [req.session.userId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to clear cart' });
            }

            res.json({ message: 'Cart cleared' });
        }
    );
});

// Remove an item only if it belongs to this user
app.delete('/api/cart/:id', requireAuth, (req, res) => {
    const query = 'DELETE FROM cart_items WHERE id = ? AND user_id = ?';

    db.query(query, [req.params.id, req.session.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to remove cart item' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        res.json({ message: 'Cart item removed' });
    });
});

// ==========================
// WISHLIST API ENDPOINTS
// ==========================

// Get wishlist items
app.get('/api/wishlist', (req, res) => {
    const query = 'SELECT * FROM wishlist_items';
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error fetching wishlist' });
        }
        res.json(results);
    });
});

// Add item to wishlist
app.post('/api/wishlist', (req, res) => {
    const { product_id, name, color, size, price } = req.body;
    const query = 'INSERT INTO wishlist_items (product_id, name, color, size, price) VALUES (?, ?, ?, ?, ?)';

    db.query(query, [product_id, name, color, size, price], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to add to wishlist' });
        }
        res.status(201).json({ message: 'Added to wishlist successfully', id: result.insertId });
    });
});

// Remove item from wishlist
app.delete('/api/wishlist/:id', (req, res) => {
    const wishlistId = req.params.id;
    const query = 'DELETE FROM wishlist_items WHERE id = ?';

    db.query(query, [wishlistId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to remove wishlist item' });
        }
        res.json({ message: 'Wishlist item removed' });
    });
});


// ==========================
// WISHLIST API ENDPOINTS
// ==========================

// Get only the logged-in user's wishlist
app.get('/api/wishlist', requireAuth, (req, res) => {
    const query = 'SELECT * FROM wishlist_items WHERE user_id = ?';

    db.query(query, [req.session.userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error fetching wishlist' });
        }

        res.json(results);
    });
});

// Add an item to the logged-in user's wishlist
app.post('/api/wishlist', requireAuth, (req, res) => {
    const { product_id, name, color, size, price } = req.body;

    const query = `
        INSERT INTO wishlist_items
        (user_id, product_id, name, color, size, price)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [req.session.userId, product_id, name, color, size, price],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Failed to add to wishlist' });
            }

            res.status(201).json({
                message: 'Added to wishlist successfully',
                id: result.insertId
            });
        }
    );
});

// Remove an item only if it belongs to this user
app.delete('/api/wishlist/:id', requireAuth, (req, res) => {
    const query = 'DELETE FROM wishlist_items WHERE id = ? AND user_id = ?';

    db.query(query, [req.params.id, req.session.userId], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to remove wishlist item' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Wishlist item not found' });
        }

        res.json({ message: 'Wishlist item removed' });
    });
});