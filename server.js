
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'local-development-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ==========================
// DATABASE
// ==========================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
    } else {
        console.log('Connected to MySQL successfully');
        connection.release();
    }
});

// ==========================
// AUTHENTICATION
// ==========================

function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please log in first' });
    }
    next();
}

// Current logged-in user
app.get('/api/me', (req, res) => {
    if (!req.session.userId) {
        return res.json({ loggedIn: false });
    }

    res.json({
        loggedIn: true,
        userId: req.session.userId,
        username: req.session.username
    });
});

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: 'Name, email, and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const passwordHash = await bcrypt.hash(password, 12);

        db.query(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name.trim(), normalizedEmail, passwordHash],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({
                            error: 'An account with this email already exists'
                        });
                    }

                    console.error(err);
                    return res.status(500).json({
                        error: 'Registration failed'
                    });
                }

                req.session.regenerate((sessionErr) => {
                    if (sessionErr) {
                        return res.status(500).json({
                            error: 'Session creation failed'
                        });
                    }

                    req.session.userId = result.insertId;
                    req.session.username = name.trim();

                    res.status(201).json({
                        message: 'Registration successful',
                        username: name.trim()
                    });
                });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    db.query(
        'SELECT * FROM users WHERE email = ?',
        [email.trim().toLowerCase()],
        async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Login failed'
                });
            }

            if (results.length === 0) {
                return res.status(401).json({
                    error: 'Invalid email or password'
                });
            }

            const user = results[0];

            try {
                const validPassword = await bcrypt.compare(
                    password,
                    user.password_hash
                );

                if (!validPassword) {
                    return res.status(401).json({
                        error: 'Invalid email or password'
                    });
                }

                req.session.regenerate((sessionErr) => {
                    if (sessionErr) {
                        return res.status(500).json({
                            error: 'Session creation failed'
                        });
                    }

                    req.session.userId = user.id;
                    req.session.username = user.name;

                    res.json({
                        message: 'Login successful',
                        username: user.name
                    });
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Login failed' });
            }
        }
    );
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                error: 'Logout failed'
            });
        }

        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out successfully' });
    });
});

// ==========================
// PRODUCTS
// ==========================

app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Failed to fetch products'
            });
        }

        const formattedProducts = results.map(product => ({
            ...product,
            sizes: typeof product.sizes === 'string'
                ? product.sizes.split(',').map(s => s.trim())
                : []
        }));

        res.json(formattedProducts);
    });
});

// ==========================
// CART
// ==========================

// Get user's cart
app.get('/api/cart', requireAuth, (req, res) => {
    db.query(
        'SELECT * FROM cart_items WHERE user_id = ?',
        [req.session.userId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to fetch cart'
                });
            }

            res.json(results);
        }
    );
});

// Add to cart
app.post('/api/cart', requireAuth, (req, res) => {
    const { product_id, name, color, size, price, quantity } = req.body;

    if (!product_id || !size || !quantity || quantity < 1) {
        return res.status(400).json({
            error: 'Invalid cart item'
        });
    }

    db.query(
        `INSERT INTO cart_items
        (user_id, product_id, name, color, size, price, quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            req.session.userId,
            product_id,
            name,
            color,
            size,
            price,
            quantity
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to add item to cart'
                });
            }

            res.status(201).json({
                message: 'Added to cart',
                id: result.insertId
            });
        }
    );
});

// Update cart quantity
app.patch('/api/cart/:id', requireAuth, (req, res) => {
    const quantity = parseInt(req.body.quantity, 10);

    if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
            error: 'Quantity must be at least 1'
        });
    }

    db.query(
        `UPDATE cart_items
         SET quantity = ?
         WHERE id = ? AND user_id = ?`,
        [quantity, req.params.id, req.session.userId],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to update cart'
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    error: 'Cart item not found'
                });
            }

            res.json({ message: 'Cart updated' });
        }
    );
});

// Remove single cart item
app.delete('/api/cart/:id', requireAuth, (req, res) => {
    db.query(
        'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to remove cart item'
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    error: 'Cart item not found'
                });
            }

            res.json({ message: 'Cart item removed' });
        }
    );
});

// Clear user's cart
app.delete('/api/cart', requireAuth, (req, res) => {
    db.query(
        'DELETE FROM cart_items WHERE user_id = ?',
        [req.session.userId],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to clear cart'
                });
            }

            res.json({ message: 'Cart cleared' });
        }
    );
});

// ==========================
// WISHLIST
// ==========================

// Get wishlist
app.get('/api/wishlist', requireAuth, (req, res) => {
    db.query(
        'SELECT * FROM wishlist_items WHERE user_id = ?',
        [req.session.userId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to fetch wishlist'
                });
            }

            res.json(results);
        }
    );
});

// Add to wishlist
app.post('/api/wishlist', requireAuth, (req, res) => {
    const { product_id, name, color, size, price } = req.body;

    if (!product_id || !size) {
        return res.status(400).json({
            error: 'Product and size are required'
        });
    }

    db.query(
        `INSERT INTO wishlist_items
        (user_id, product_id, name, color, size, price)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
            req.session.userId,
            product_id,
            name,
            color,
            size,
            price
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to add to wishlist'
                });
            }

            res.status(201).json({
                message: 'Added to wishlist',
                id: result.insertId
            });
        }
    );
});

// Remove from wishlist
app.delete('/api/wishlist/:id', requireAuth, (req, res) => {
    db.query(
        'DELETE FROM wishlist_items WHERE id = ? AND user_id = ?',
        [req.params.id, req.session.userId],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    error: 'Failed to remove wishlist item'
                });
            }

            if (!result.affectedRows) {
                return res.status(404).json({
                    error: 'Wishlist item not found'
                });
            }

            res.json({ message: 'Wishlist item removed' });
        }
    );
});

// ==========================
// CHECKOUT
// ==========================

// No real payment processing is performed
app.post('/api/orders', requireAuth, (req, res) => {
    const {
        shipping_name,
        shipping_email,
        shipping_address,
        city,
        state,
        zip_code
    } = req.body;

    if (
        !shipping_name ||
        !shipping_email ||
        !shipping_address ||
        !city ||
        !state ||
        !zip_code
    ) {
        return res.status(400).json({
            error: 'Please complete all shipping fields'
        });
    }

    // Calculate order total using items stored in the user's cart
    db.query(
        'SELECT price, quantity FROM cart_items WHERE user_id = ?',
        [req.session.userId],
        (cartErr, cartItems) => {
            if (cartErr) {
                console.error(cartErr);
                return res.status(500).json({
                    error: 'Failed to retrieve cart'
                });
            }

            if (!cartItems.length) {
                return res.status(400).json({
                    error: 'Your cart is empty'
                });
            }

            const total = cartItems.reduce(
                (sum, item) => sum + (Number(item.price) * item.quantity),
                0
            );

            db.query(
                `INSERT INTO orders
                (user_id, total_amount, shipping_name, shipping_email,
                 shipping_address, city, state, zip_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.session.userId,
                    total.toFixed(2),
                    shipping_name,
                    shipping_email,
                    shipping_address,
                    city,
                    state,
                    zip_code
                ],
                (orderErr, result) => {
                    if (orderErr) {
                        console.error(orderErr);
                        return res.status(500).json({
                            error: 'Failed to place order'
                        });
                    }

                    // Clear cart after order is saved
                    db.query(
                        'DELETE FROM cart_items WHERE user_id = ?',
                        [req.session.userId],
                        (clearErr) => {
                            if (clearErr) {
                                console.error(clearErr);
                            }

                            res.status(201).json({
                                message: 'Order placed successfully',
                                orderId: result.insertId,
                                total: total.toFixed(2)
                            });
                        }
                    );
                }
            );
        }
    );
});

// ==========================
// START SERVER
// ==========================

app.listen(PORT, () => {
    console.log(`Wardrobe server running on port ${PORT}`);
});
