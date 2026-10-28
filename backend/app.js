require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db/index');
const { authMiddleware, optionalAuth, JWT_SECRET } = require('./middleware/auth');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// -------------------------------------------------------------
// 1. HEALTH & SYSTEM STATUS
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.getDbStatus();
  res.json({
    status: 'ok',
    service: 'Canara Bank SD-WAN Work Tracker API',
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
        name: user.name,
        phone: user.phone
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
    res.json({ user, database: dbStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Self Profile Update (Any logged-in user can update their name, phone, password)
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, password } = req.body || {};
    const updated = await db.updateProfile(req.user.id, { name, phone, password });
    res.json({ message: 'Profile updated successfully', user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update profile' });
  }
});

// -------------------------------------------------------------
// 3. ADMIN & PM USER MANAGEMENT
// -------------------------------------------------------------
function requireAdmin(req, res, next) {
  const role = (req.user?.role || '').toLowerCase();
  const uname = (req.user?.username || '').toLowerCase();
  if (role !== 'admin' && !uname.includes('admin')) {
    return res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
  }
  next();
}

function requireAdminOrPM(req, res, next) {
  const role = (req.user?.role || '').toLowerCase();
  const uname = (req.user?.username || '').toLowerCase();
  if (role !== 'admin' && role !== 'pm' && !uname.includes('admin')) {
    return res.status(403).json({ error: 'Access denied: Administrator or Project Manager privileges required.' });
  }
  next();
}

// User List (Both /api/admin/users and /api/users)
app.get(['/api/admin/users', '/api/users'], authMiddleware, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Create User (Admin can create any role; PM can create NOC users)
app.post(['/api/admin/users', '/api/users'], authMiddleware, requireAdminOrPM, async (req, res) => {
  try {
    const { username, password, name, phone, role } = req.body || {};
    const callerRole = (req.user?.role || '').toLowerCase();
    const callerUname = (req.user?.username || '').toLowerCase();
    const isFullAdmin = callerRole === 'admin' || callerUname.includes('admin');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // PM can only create NOC accounts
    let assignedRole = role || 'noc';
    if (!isFullAdmin && assignedRole !== 'noc') {
      assignedRole = 'noc';
    }

    const created = await db.createUser({
      username,
      password,
      name,
      phone,
      role: assignedRole
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create user' });
  }
});

// Edit User Details & Role (Admin can edit any user & role; PM can edit NOC users)
app.put(['/api/admin/users/:id', '/api/users/:id'], authMiddleware, requireAdminOrPM, async (req, res) => {
  try {
    const { name, phone, role, username } = req.body || {};
    const callerRole = (req.user?.role || '').toLowerCase();
    const callerUname = (req.user?.username || '').toLowerCase();
    const isFullAdmin = callerRole === 'admin' || callerUname.includes('admin');

    // If caller is PM, they cannot promote to admin or pm, only manage NOC
    if (!isFullAdmin && role && role !== 'noc') {
      return res.status(403).json({ error: 'Project Managers can only assign NOC roles.' });
    }

    const updated = await db.updateUser(req.params.id, { name, phone, role, username });
    res.json({ message: 'User updated successfully', user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update user' });
  }
});

// Update User Password (Admin & PM feature)
app.put(['/api/admin/users/:id/password', '/api/users/:id/password'], authMiddleware, requireAdminOrPM, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }
    const updated = await db.updateUserPassword(req.params.id, password);
    res.json({ message: 'Password updated successfully', user: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update user password' });
  }
});

// Delete User (Admin only)
app.delete(['/api/admin/users/:id', '/api/users/:id'], authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own active administrator account' });
    }
    const ok = await db.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// -------------------------------------------------------------
// 4. SITE RECORDS CRUD (PROTECTED)
// -------------------------------------------------------------
app.get('/api/records', authMiddleware, async (req, res) => {
  try {
    const { kind, working, search, claimedBy } = req.query;
    const records = await db.getAllRecords({ kind, working, search, claimedBy });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to query records', details: err.message });
  }
});

app.get('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const record = await db.getRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

app.post('/api/records', authMiddleware, async (req, res) => {
  try {
    const data = req.body || {};
    const kind = data.kind || 'Branch';

    if (kind === 'Branch' && (!data.dpCode || !data.dpCode.trim())) {
      return res.status(400).json({ error: 'Branch DP Code is required' });
    }
    if (kind === 'ATM' && (!data.atmId || !data.atmId.trim())) {
      return res.status(400).json({ error: 'ATM ID is required' });
    }

    const created = await db.createRecord(data, req.user);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create record', details: err.message });
  }
});

app.put('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await db.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const role = (req.user?.role || '').toLowerCase();
    const uname = (req.user?.username || '').toLowerCase();
    const isOwner = (existing.claimedBy || '').toLowerCase() === uname;
    const isUnassigned = !existing.claimedBy;
    const canEdit = isOwner || isUnassigned || role === 'admin' || role === 'pm';

    if (!canEdit) {
      return res.status(403).json({
        error: `This site is owned by ${existing.claimedByName || existing.claimedBy}. Only the assigned NOC, PM, or Admin can edit it. You can click "Request Transfer" to ask for site handover.`
      });
    }

    const updated = await db.updateRecord(req.params.id, req.body || {}, req.user);
    if (!updated) return res.status(404).json({ error: 'Record not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update record', details: err.message });
  }
});

// Claim site endpoint (only if unassigned, or user is admin/PM)
app.put('/api/records/:id/claim', authMiddleware, async (req, res) => {
  try {
    const existing = await db.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const role = (req.user?.role || '').toLowerCase();
    if (existing.claimedBy && existing.claimedBy !== req.user.username && role !== 'admin' && role !== 'pm') {
      return res.status(400).json({ error: 'Site is already claimed. Request a transfer instead.' });
    }

    const updated = await db.claimRecord(req.params.id, req.user);
    if (!updated) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Site claimed successfully', record: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to claim site', details: err.message });
  }
});

// Site Handover: Request transfer from current NOC
app.post('/api/records/:id/request-transfer', authMiddleware, async (req, res) => {
  try {
    const updated = await db.requestTransfer(req.params.id, req.user);
    res.json({ message: 'Site transfer requested successfully', record: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to request transfer' });
  }
});

// Site Handover: Current owner or Admin/PM accepts transfer
app.post('/api/records/:id/accept-transfer', authMiddleware, async (req, res) => {
  try {
    const updated = await db.acceptTransfer(req.params.id, req.user);
    res.json({ message: 'Site transfer accepted! Ownership updated.', record: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to accept transfer' });
  }
});

// Site Handover: Reject or cancel transfer request
app.post('/api/records/:id/reject-transfer', authMiddleware, async (req, res) => {
  try {
    const updated = await db.rejectTransfer(req.params.id, req.user);
    res.json({ message: 'Site transfer request declined/cancelled', record: updated });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to decline transfer' });
  }
});

app.delete('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const success = await db.deleteRecord(req.params.id);
    if (!success) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

app.get('/api/export', optionalAuth, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const kind = req.query.kind;
    const working = req.query.working;
    const claimedBy = req.query.claimedBy || req.query.user;
    const records = await db.getAllRecords({ kind, working, claimedBy });

    if (format === 'csv') {
      const fields = [
        'id', 'kind', 'dpCode', 'atmId', 'feName', 'feNumber',
        'newDeviceSerial', 'oldDeviceModel', 'oldDeviceSerial',
        'vlanConfigured', 'vlanDetails', 'vlanRemoved',
        'primaryLanIp', 'lanIpPrefix', 'primaryLanGateway',
        'bsnlIp', 'bsnlGateway', 'bsnlPing',
        'jioIp', 'jioGateway', 'jioPing',
        'airtelIp', 'airtelGateway', 'ceIp', 'airtelPing',
        'configuration', 'csAdded', 'deviceOnline', 'mailSent', 'dcMail', 'drcMail', 'cablesConnected', 'working',
        'uatSubmitted', 'uatFormNo', 'claimedBy', 'claimedByName',
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
      res.setHeader('Content-Disposition', `attachment; filename="${kind ? kind.toLowerCase() : 'all'}-canara-sites.csv"`);
      return res.send(csvContent);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${kind ? kind.toLowerCase() : 'all'}-canara-sites.json"`);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

// -------------------------------------------------------------
// 5. STATIC DISTRIBUTION FOR VITE SPA
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
