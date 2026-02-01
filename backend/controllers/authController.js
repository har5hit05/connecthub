const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─────────────────────────────────────
// REGISTER — Create a new user account
// ─────────────────────────────────────
const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Step 1: Check if all fields are provided
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please fill all fields' });
        }

        // Step 2: Check if email already exists in database
        const existingEmail = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        if (existingEmail.rows.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Step 3: Check if username already exists
        const existingUsername = await db.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        if (existingUsername.rows.length > 0) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        // Step 4: Encrypt the password (never store plain text passwords!)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Step 5: Save user to database
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
            [username, email, hashedPassword]
        );

        const newUser = result.rows[0];

        // Step 6: Send success response
        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// ─────────────────────────────────────
// LOGIN — Check credentials and give token
// ─────────────────────────────────────
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Step 1: Check if all fields are provided
        if (!email || !password) {
            return res.status(400).json({ message: 'Please fill all fields' });
        }

        // Step 2: Find user by email
        const result = await db.query(
            'SELECT id, username, email, password_hash FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Step 3: Compare entered password with stored hashed password
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Step 4: Create a JWT token
        // This token contains the user's info and is signed with our secret key
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // Token is valid for 7 days
        );

        // Step 5: Send token and user info back
        res.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// ─────────────────────────────────────
// GET PROFILE — Get current user's info
// ─────────────────────────────────────
const getProfile = async (req, res) => {
    try {
        // req.user is set by authMiddleware after verifying the token
        const result = await db.query(
            'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { register, login, getProfile };