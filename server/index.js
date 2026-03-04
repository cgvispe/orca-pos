const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const settingsRoutes = require('./routes/settings');
const sesamiRoutes = require('./routes/sesami');
const categoriesRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const devicesRoutes = require('./routes/devices');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (product images, logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sesami', sesamiRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/devices', devicesRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// In production, serve the Vue build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Demo POS Server running at http://0.0.0.0:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Default credentials: admin/password | cashier/password\n`);
});
