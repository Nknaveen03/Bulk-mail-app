import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load models
import User from './models/User.js';

// Load routes
import authRoutes from './routes/auth.js';
import mailRoutes from './routes/mail.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bulk-mail-db';
const PORT = process.env.PORT || 5000;

// Seed Admin User
const seedAdmin = async () => {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const adminExists = await User.findOne({ username: adminUsername });
    if (!adminExists) {
      const admin = new User({
        username: adminUsername,
        password: adminPassword, // will be hashed by mongoose pre-save hook
      });
      await admin.save();
      console.log(`[SEED] Default admin user created! Username: ${adminUsername}, Password: ${adminPassword}`);
    } else {
      console.log(`[SEED] Admin user '${adminUsername}' already exists in database.`);
    }
  } catch (error) {
    console.error('[SEED] Error seeding admin user:', error);
  }
};

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected successfully.');
    // Seed default admin
    await seedAdmin();
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mail', mailRoutes);

// Simple status route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server!' });
});
