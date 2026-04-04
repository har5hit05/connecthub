const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const config = require('./config');
const helmet = require('helmet');

const db = require('./config/database');
const redisClient = require('./config/redis');
const logger = require('./utils/logger');
const { setupSocketHandlers } = require('./socket/socketHandler');
const { authLimiter, uploadLimiter, generalLimiter } = require('./middleware/rateLimiter');
const xssSanitizer = require('./middleware/xssSanitizer');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
    cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true               // Allow cookies in Socket.io handshake
    }
});

// Security Middleware
app.use(helmet());                     // HTTP Security headers
app.use(xssSanitizer());               // Prevent Cross-Site Scripting locally

// Core Middleware
app.use(cors({
    origin: config.corsOrigin,         // Must be explicit (not *) when credentials: true
    credentials: true                  // Allow cookies to be sent with cross-origin requests
}));
app.use(cookieParser());               // Parses cookies into req.cookies
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/chat/upload', uploadLimiter); // Moderate: 20 req/15min (prevents storage abuse)
app.use('/api/profile/avatar', uploadLimiter); // Moderate: 20 req/15min
app.use('/api', generalLimiter);         // General: 100 req/15min (all other API routes)

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);

const friendRoutes = require('./routes/friendRoutes');
app.use('/api/friends', friendRoutes);

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

const blockRoutes = require('./routes/blockRoutes');
app.use('/api/block', blockRoutes);

const webrtcRoutes = require('./routes/webrtcRoutes');
app.use('/api/webrtc', webrtcRoutes);  // GET /api/webrtc/turn
app.use('/api/calls', webrtcRoutes);   // POST/GET /api/calls/:id/metrics

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'ConnectHub API is running!' });
});

// Health Check Endpoints
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/ready', async (req, res, next) => {
    try {
        await db.query('SELECT 1');
        await redisClient.ping();
        res.status(200).json({ status: 'ready', dependencies: 'connected' });
    } catch (error) {
        logger.error({ err: error }, 'Ready check failed');
        res.status(503).json({ status: 'unavailable', error: error.message });
    }
});

// Register Global Error Handler — must be the LAST routing middleware
app.use(errorHandler);



// Socket.io authentication middleware
// Reads JWT from the httpOnly cookie sent automatically by the browser.
// cookie-parser only parses HTTP request headers; for Socket.io we parse manually.
io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const cookies = cookie.parse(cookieHeader);
    const token = cookies.jwt;

    if (!token) {
        return next(new Error('Authentication required'));
    }
    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.userId = decoded.id;
        next();
    } catch (err) {
        next(new Error('Invalid or expired token'));
    }
});

// Socket.io connection
setupSocketHandlers(io);

// Start server
server.listen(config.port, () => {
    logger.info(`🚀 Server running on port ${config.port}`);
    logger.info(`🌐 CORS origin: ${config.corsOrigin}`);
    logger.info(`🔧 Environment: ${config.nodeEnv}`);
});

// Graceful Shutdown Handling
const gracefulShutdown = () => {
    logger.info('Received shutdown signal. Stopping server gracefully...');
    server.close(async () => {
        logger.info('HTTP server closed.');
        try {
            await db.end();
            logger.info('PostgreSQL pool closed.');
            await redisClient.quit();
            logger.info('Redis connection closed.');
            process.exit(0);
        } catch (error) {
            logger.error({ err: error }, 'Error during graceful shutdown');
            process.exit(1);
        }
    });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);