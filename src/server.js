const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initSchema } = require('./db/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const timetableRoutes = require('./routes/timetable');
const generatorRoutes = require('./routes/generator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static admin web dashboard
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.use('/master', express.static(path.join(__dirname, '../public/master')));
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/master', require('./routes/master'));
app.use('/api/generator', generatorRoutes);
app.use('/api', timetableRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'School Timetable Management API', timestamp: new Date().toISOString() });
});

// Initialize DB and start server
async function startServer() {
  await initSchema();
  app.listen(PORT, () => {
    console.log(`Backend API & Admin Web Server running at http://localhost:${PORT}`);
    console.log(`Web Admin Interface: http://localhost:${PORT}/admin`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
