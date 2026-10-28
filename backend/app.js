require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db/index');
const { authMiddleware, optionalAuth, JWT_SECRET } = require('./middleware/auth');

const app = express();

// Security and CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsing
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// -------------------------------------------------------------
// 1. HEALTH & SYSTEM ROUTES
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.getDbStatus();
  res.json({
    status: 'ok',
    service: 'Branch & ATM Work Tracker API',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute stats', details: err.message });
  }
});

// -------------------------------------------------------------
// 2. AUTHENTICATION ROUTES
// -------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Please enter both username and password' });
    }

    const user = await db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Authentication successful',
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }
    const dbStatus = await db.getDbStatus();
    res.json({
      user,
      database: dbStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user session' });
  }
});

// -------------------------------------------------------------
// 3. RECORDS CRUD (PROTECTED)
// -------------------------------------------------------------
app.get('/api/records', authMiddleware, async (req, res) => {
  try {
    const { kind, working, search } = req.query;
    const records = await db.getAllRecords({ kind, working, search });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch records', details: err.message });
  }
});

app.get('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const record = await db.getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

app.post('/api/records', authMiddleware, async (req, res) => {
  try {
    const data = req.body || {};
    const kind = data.kind || 'Branch';

    // Validation
    if (kind === 'Branch' && (!data.dpCode || !data.dpCode.trim())) {
      return res.status(400).json({ error: 'DP code is required for Branch records' });
    }
    if (kind === 'ATM' && (!data.atmId || !data.atmId.trim())) {
      return res.status(400).json({ error: 'ATM ID is required for ATM records' });
    }

    const created = await db.createRecord(data, req.user);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Failed to create record', details: err.message });
  }
});

app.put('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body || {};
    const updated = await db.updateRecord(id, updates, req.user);
    if (!updated) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update record', details: err.message });
  }
});

app.delete('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const success = await db.deleteRecord(id);
    if (!success) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ message: 'Record deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

app.post('/api/records/bulk', authMiddleware, async (req, res) => {
  try {
    const { records, mode } = req.body || {};
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Payload must include an array of records' });
    }
    const result = await db.bulkImportRecords(records, mode || 'append', req.user);
    res.json({ message: `Successfully imported ${records.length} records`, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Bulk import failed', details: err.message });
  }
});

app.get('/api/export', optionalAuth, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const kind = req.query.kind;
    const records = await db.getAllRecords({ kind });

    if (format === 'csv') {
      const fields = [
        'id', 'kind', 'dpCode', 'atmId', 'vlan',
        'lanIp', 'lanGateway', 'atmIp', 'atmGateway',
        'bsnlIp', 'bsnlGateway', 'bsnlPing',
        'jioIp', 'jioGateway', 'jioPing',
        'airtelIp', 'airtelGateway', 'ceIp', 'airtelPing',
        'configuration', 'mp', 'online', 'mail', 'dcMail', 'drcMail', 'cables', 'working',
        'createdBy', 'updatedBy', 'created', 'updated'
      ];

      const csvHeader = fields.join(',');
      const csvRows = records.map(r => {
        return fields.map(f => {
          const val = r[f] !== undefined && r[f] !== null ? String(r[f]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',');
      });

      const csvContent = [csvHeader, ...csvRows].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${kind ? kind.toLowerCase() : 'all'}-records.csv"`);
      return res.send(csvContent);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${kind ? kind.toLowerCase() : 'all'}-records.json"`);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

// -------------------------------------------------------------
// 4. STATIC CLIENT SERVING & SPA FALLBACK
// -------------------------------------------------------------
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

module.exports = app;
