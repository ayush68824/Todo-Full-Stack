const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { authenticateUser } = require('./middleware/auth');
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
    endpoints: {
      auth: {
        register: {
          method: "POST",
          path: "/api/auth/register",
          body: {
            email: "string (required)",
            password: "string (required)"
          },
          description: "Register a new user"
        },
        login: {
          method: "POST",
          path: "/api/auth/login",
          body: {
            email: "string (required)",
            password: "string (required)"
          },
          description: "Login to get JWT token"
        }
      },
      tasks: {
        create: {
          method: "POST",
          path: "/api/tasks",
          auth: "Bearer token required",
          body: {
            title: "string (required)",
            description: "string (optional)",
            dueDate: "Date (optional)",
            priority: "string (Low/Medium/High)",
            status: "string (Pending/In Progress/Completed)"
          },
          description: "Create a new task"
        },
        getAll: {
          method: "GET",
          path: "/api/tasks",
          auth: "Bearer token required",
          query: {
            status: "string (optional) - Filter by status",
            sortBy: "string (optional) - Sort by dueDate/createdAt/priority",
            q: "string (optional) - Search in title and description"
          },
          description: "Get all tasks with optional filtering and sorting"
        },
        update: {
          method: "PUT",
          path: "/api/tasks/:id",
          auth: "Bearer token required",
          body: "Same as create task (all fields optional)",
          description: "Update an existing task"
        },
        delete: {
          method: "DELETE",
          path: "/api/tasks/:id",
          auth: "Bearer token required",
          description: "Delete a task"
        }
      },
      health: {
        method: "GET",
        path: "/api/health",
        description: "Check API health status"
      }
    },
    examples: {
      register: {
        request: {
          method: "POST",
          url: "/api/auth/register",
          body: {
            email: "user@example.com",
            password: "securepassword123"
          }
        }
      },
      createTask: {
        request: {
          method: "POST",
          url: "/api/tasks",
          headers: {
            "Authorization": "Bearer your_jwt_token"
          },
          body: {
            title: "Complete Project",
            description: "Finish the todo app project",
            dueDate: "2024-03-20",
            priority: "High",
            status: "In Progress"
          }
        }
      }
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
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
