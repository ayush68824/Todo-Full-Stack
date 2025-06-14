const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const authenticateUser = require('./middleware/auth'); // <-- import as a function!
const scheduleNotifications = require('./utils/notifications');

// Load environment variables
dotenv.config();

// Debug: Log environment variables
console.log('Environment Variables:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('PORT:', process.env.PORT);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));

// CORS configuration
const allowedOrigins = [
  'https://timely-hummingbird-648821.netlify.app', // Netlify frontend
  'http://localhost:5173',                        // Vite local dev (optional)
  'http://localhost:3000',                        // React local dev (optional)
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS not allowed from this origin: ' + origin), false);
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use(express.json());

// Ensure public/avatars directory exists
const avatarsDir = path.join(__dirname, 'public', 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
  console.log('Created directory:', avatarsDir);
}

// Serve static files from the public directory
const publicPath = path.join(__dirname, 'public');
console.log('Serving static files from:', publicPath);
app.use(express.static(publicPath));

// Serve static files from the public directory
const publicPath = path.join(__dirname, '../public');
console.log('Serving static files from:', publicPath);
app.use(express.static(publicPath));

// API Documentation route
app.get('/', (req, res) => {
  res.json({
    name: "Todo API",
    version: "1.0.0",
    description: "RESTful API for Todo Application",
    // ... (rest of your documentation unchanged)
  });
});

// Auth routes (no auth middleware needed)
app.use('/api/auth', authRoutes);

// Task routes (protected, require authentication)
app.use('/api/tasks', authenticateUser, taskRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal server error',
      status: err.status || 500
    }
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Set port
const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/todo-app';
    console.log('MongoDB URI:', mongoURI);

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('MongoDB connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Frontend available at http://localhost:${PORT}`);
    });

    // Schedule notifications after server starts
    scheduleNotifications();
  } catch (err) {
    console.error('Failed to start server:', err);
    console.error('Please make sure MongoDB is running and accessible');
    console.error('You can either:');
    console.error('1. Install MongoDB locally: https://www.mongodb.com/try/download/community');
    console.error('2. Use MongoDB Atlas: https://www.mongodb.com/cloud/atlas');
    process.exit(1);
  }
};

// Start the server
startServer();

// Export app for Vercel
module.exports = app;
