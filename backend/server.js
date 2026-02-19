const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const db = require('./config/database');
const { setupSocketHandlers } = require('./socket/socketHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
    cors: {
        origin: 'http://localhost:5173', // React app URL
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);

// Friend routes
const friendRoutes = require('./routes/friendRoutes');
app.use('/api/friends', friendRoutes);

// Profile routes
const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

// Block routes
const blockRoutes = require('./routes/blockRoutes');
app.use('/api/block', blockRoutes);

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'ConnectHub API is running!' });
});

// Test database connection
app.get('/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({
            message: 'Database connected!',
            time: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Run database migration to add file columns and relax message NOT NULL constraint
const runMigrations = async () => {
    try {
        // Add file columns if they don't exist yet
        await db.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS file_url TEXT,
            ADD COLUMN IF NOT EXISTS file_type TEXT,
            ADD COLUMN IF NOT EXISTS file_name TEXT
        `);
        // Allow message to be NULL so file-only messages can be sent
        await db.query(`
            ALTER TABLE messages ALTER COLUMN message DROP NOT NULL
        `);
        // Ensure file columns are TEXT (not VARCHAR with a short limit).
        // If the columns already existed as VARCHAR(50), this widens them to TEXT
        // so long MIME types and filenames don't cause "value too long" errors.
        await db.query(`
            ALTER TABLE messages
            ALTER COLUMN file_url  TYPE TEXT,
            ALTER COLUMN file_type TYPE TEXT,
            ALTER COLUMN file_name TYPE TEXT
        `);
        console.log('✅ Database migration complete (file columns ensured as TEXT, message nullable)');
    } catch (err) {
        console.log('ℹ️  Migration note:', err.message);
    }
};

runMigrations();

// Socket.io connection
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 Socket.io server is ready`);
});