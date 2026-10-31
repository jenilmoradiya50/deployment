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
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Sync-Token', 'x-sync-token']
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// -------------------------------------------------------------
// 1. HEALTH & SYSTEM STATUS
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.getDbStatus();
  const dbRelatedKeys = Object.keys(process.env).filter(k => 
    k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('DB') || k.includes('SQL') || k.includes('STORAGE')
  );
  res.json({
    status: 'ok',
    service: 'Canara Bank SD-WAN Work Tracker API',
    database: dbStatus,
    detectedDbKeys: dbRelatedKeys,
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
      { expiresIn: '8h' }
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

let lastPurgeCheck = 0;
let localSqliteDb = null;
const localDbPath = path.join(__dirname, '../sync-agent/canara_local.db');

function getLocalSqlite() {
  if (localSqliteDb) return localSqliteDb;
  if (fs.existsSync(localDbPath)) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      localSqliteDb = new DatabaseSync(localDbPath);
      return localSqliteDb;
    } catch {
      return null;
    }
  }
  return null;
}

function rehydrateLocalIpsIfAvailable(records) {
  const ldb = getLocalSqlite();
  if (!ldb || !Array.isArray(records)) return records;

  try {
    const rows = ldb.prepare('SELECT * FROM local_records WHERE local_ip_purged = 0').all();
    if (rows.length === 0) return records;
    const lmap = new Map();
    rows.forEach(r => {
      if (r.id) lmap.set(r.id, r);
      if (r.dp_code) lmap.set(String(r.dp_code).trim().toLowerCase(), r);
      if (r.atm_id) lmap.set(String(r.atm_id).trim().toLowerCase(), r);
    });

    return records.map(r => {
      if (r.cloudIpPurged) {
        const m = lmap.get(r.id) ||
                  (r.dpCode ? lmap.get(String(r.dpCode).trim().toLowerCase()) : null) ||
                  (r.atmId ? lmap.get(String(r.atmId).trim().toLowerCase()) : null);
        if (m) {
          return {
            ...r,
            primaryLanIp: m.primary_lan_ip || r.primaryLanIp,
            primaryLanGateway: m.primary_lan_gateway || r.primaryLanGateway,
            lanGateway: m.primary_lan_gateway || r.lanGateway,
            bsnlIp: m.bsnl_ip || r.bsnlIp,
            bsnlGateway: m.bsnl_gateway || r.bsnlGateway,
            jioIp: m.jio_ip || r.jioIp,
            jioGateway: m.jio_gateway || r.jioGateway,
            airtelIp: m.airtel_ip || r.airtelIp,
            airtelGateway: m.airtel_gateway || r.airtelGateway,
            retrievedFromLocal: true
          };
        }
      }
      return r;
    });
  } catch {
    return records;
  }
}

// -------------------------------------------------------------
// 4. SITE RECORDS CRUD (PROTECTED)
// -------------------------------------------------------------
app.get('/api/records', authMiddleware, async (req, res) => {
  try {
    // Passive 36h IP Purge: check periodically (every 10 minutes) on incoming queries
    if (Date.now() - lastPurgeCheck > 10 * 60 * 1000) {
      lastPurgeCheck = Date.now();
      db.purgeEligibleCloudIps().catch(e => console.warn('Passive IP purge warn:', e.message));
    }

    const { kind, working, status, search, claimedBy } = req.query;
    const records = await db.getAllRecords({ kind, working, status, search, claimedBy });
    res.json(rehydrateLocalIpsIfAvailable(records));
  } catch (err) {
    res.status(500).json({ error: 'Failed to query records', details: err.message });
  }
});

app.get('/api/records/:id', authMiddleware, async (req, res) => {
  try {
    const record = await db.getRecordById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    const hydrated = rehydrateLocalIpsIfAvailable([record])[0];
    res.json(hydrated);
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
    if (kind === 'ATM') {
      if (!data.atmId || !data.atmId.trim()) {
        return res.status(400).json({ error: 'ATM ID is required' });
      }
      if (!data.dpCode || !data.dpCode.trim()) {
        return res.status(400).json({ error: 'Branch Base DP Code is required for ATM' });
      }
    }

    // Check for duplicate Branch DP Code or ATM ID
    const dupCheck = await db.checkDuplicateRecord({
      kind,
      dpCode: data.dpCode,
      atmId: data.atmId
    });
    if (dupCheck.isDuplicate) {
      return res.status(400).json({ error: dupCheck.message });
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
    const isAdminOrPM = role === 'admin' || role === 'pm' || uname.includes('admin');
    const canEdit = isOwner || isAdminOrPM;

    if (!canEdit) {
      if (!existing.claimedBy) {
        return res.status(403).json({
          error: 'This site is unassigned. Please click "Take / Claim Site" first to assign it to yourself before editing.'
        });
      }
      return res.status(403).json({
        error: `This site is handled by ${existing.claimedByName || existing.claimedBy}. Only the assigned NOC handler, PM, or Admin can edit it. You can click "Request Transfer" to ask for site handover.`
      });
    }

    // Check for duplicate Branch DP Code or ATM ID against other records
    const targetKind = req.body?.kind || existing.kind || 'Branch';
    const targetDpCode = req.body?.dpCode !== undefined ? req.body.dpCode : existing.dpCode;
    const targetAtmId = req.body?.atmId !== undefined ? req.body.atmId : existing.atmId;

    const dupCheck = await db.checkDuplicateRecord({
      kind: targetKind,
      dpCode: targetDpCode,
      atmId: targetAtmId,
      excludeId: req.params.id
    });
    if (dupCheck.isDuplicate) {
      return res.status(400).json({ error: dupCheck.message });
    }

    const updated = await db.updateRecord(req.params.id, req.body || {}, req.user);
    if (!updated) return res.status(404).json({ error: 'Record not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update record', details: err.message });
  }
});

// Fast Deployment Status Update: Completed, Pending, On Hold, Failed
app.patch('/api/records/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, reason } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const existing = await db.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const role = (req.user?.role || '').toLowerCase();
    const uname = (req.user?.username || '').toLowerCase();
    const isOwner = (existing.claimedBy || '').toLowerCase() === uname;
    const isAdminOrPM = role === 'admin' || role === 'pm' || uname.includes('admin');
    const canEdit = isOwner || isAdminOrPM;

    if (!canEdit) {
      if (!existing.claimedBy) {
        return res.status(403).json({
          error: 'This site is unassigned. Please click "Take / Claim Site" first to assign it to yourself before updating status.'
        });
      }
      return res.status(403).json({
        error: `Only the assigned NOC (${existing.claimedByName || existing.claimedBy}), PM, or Admin can update site status.`
      });
    }

    const updated = await db.updateRecordStatus(req.params.id, status, req.user, reason);
    if (!updated) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: `Site status updated to ${status}`, record: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update site status', details: err.message });
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

// Site Handover: Current handler or Admin/PM accepts transfer
app.post('/api/records/:id/accept-transfer', authMiddleware, async (req, res) => {
  try {
    const updated = await db.acceptTransfer(req.params.id, req.user);
    res.json({ message: 'Site transfer accepted! Handler updated.', record: updated });
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
    const existing = await db.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const role = (req.user?.role || '').toLowerCase();
    const uname = (req.user?.username || '').toLowerCase();
    const isOwner = (existing.claimedBy || '').toLowerCase() === uname;
    const isCreator = (existing.createdBy || '').toLowerCase() === uname;
    const isAdminOrPM = role === 'admin' || role === 'pm' || uname.includes('admin');

    if (!isAdminOrPM && !isOwner && !isCreator) {
      return res.status(403).json({
        error: 'Permission denied: You can only delete sites that you added or are assigned to you.'
      });
    }

    const success = await db.deleteRecord(req.params.id);
    if (!success) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete record', details: err.message });
  }
});

app.get('/api/export', optionalAuth, async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const kind = req.query.kind;
    const working = req.query.working;
    const status = req.query.status;
    const claimedBy = req.query.claimedBy || req.query.user;
    const records = await db.getAllRecords({ kind, working, status, claimedBy });

    if (format === 'csv') {
      const fields = [
        'id', 'kind', 'provider', 'dpCode', 'atmId', 'feName', 'feNumber',
        'deploymentStatus', 'working',
        'newDeviceSerial', 'oldDeviceModel', 'oldDeviceSerial',
        'vlanConfigured', 'vlanDetails', 'vlanRemoved',
        'primaryLanIp', 'lanIpPrefix', 'primaryLanGateway', 'isDhcp', 'ipSource',
        'bsnlPresent', 'bsnlIp', 'bsnlGateway', 'bsnlPing',
        'jioPresent', 'jioIp', 'jioGateway', 'jioPing',
        'airtelPresent', 'airtelIs4G', 'airtelLoopbackIp', 'airtelIp', 'airtelGateway', 'airtelPing',
        'configuration', 'csAdded', 'deviceOnline', 'dcDrReply', 'cablesConnected',
        'uatSubmitted', 'uatFormNo', 'claimedBy', 'claimedByName',
        'completedAt', 'createdBy', 'updatedBy', 'created', 'updated'
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
// 5. SECURE SYNC & 36-HOUR PURGE (REQUIREMENT 1 & 2)
// -------------------------------------------------------------
function syncAuth(req, res, next) {
  const syncToken = req.headers['x-sync-token'];
  const expectedToken = process.env.SYNC_AGENT_TOKEN || 'canara_sync_secret_2026';
  if (syncToken && syncToken === expectedToken) {
    req.user = { username: 'sync_agent', role: 'admin', name: 'Local Sync Agent' };
    return next();
  }
  return authMiddleware(req, res, next);
}

// GET /api/sync/pending - Local agent pulls pending records
app.get('/api/sync/pending', syncAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 250);
    const records = await db.getPendingSyncRecords(limit);
    res.json({
      count: records.length,
      records,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending sync records', details: err.message });
  }
});

// POST /api/sync/ack - Local agent acknowledges storage
app.post('/api/sync/ack', syncAuth, async (req, res) => {
  try {
    const { recordIds } = req.body || {};
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: 'recordIds array is required' });
    }
    const result = await db.acknowledgeSync(recordIds);
    res.json({ message: 'Sync acknowledged successfully', updated: result.updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge sync', details: err.message });
  }
});

// ALL /api/cron/purge-completed-ips - 36-hour hosted IP purge trigger
app.all('/api/cron/purge-completed-ips', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = cronSecret && req.headers['x-vercel-cron-secret'] === cronSecret;
    const syncToken = req.headers['x-sync-token'];
    const isSyncToken = syncToken && syncToken === (process.env.SYNC_AGENT_TOKEN || 'canara_sync_secret_2026');

    let isAuthorized = isVercelCron || isSyncToken;
    if (!isAuthorized && authHeader) {
      try {
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && (decoded.role === 'admin' || decoded.role === 'pm')) {
          isAuthorized = true;
        }
      } catch {}
    }

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized to trigger IP purge' });
    }

    const result = await db.purgeEligibleCloudIps();
    res.json({
      message: `36-hour cloud IP purge completed. Purged ${result.purgedCount} site(s).`,
      purgedCount: result.purgedCount,
      purgedRecords: result.records,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute 36-hour IP purge', details: err.message });
  }
});

// -------------------------------------------------------------
// 6. ARCHIVED DEPLOYMENT RECORDS (REQUIREMENT 4)
// -------------------------------------------------------------
app.get('/api/archived-records', authMiddleware, async (req, res) => {
  try {
    const list = await db.getArchivedRecords(req.query);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch archived records', details: err.message });
  }
});

app.post('/api/archived-records', authMiddleware, async (req, res) => {
  try {
    const created = await db.createArchivedRecord(req.body, req.user);
    res.status(201).json({ message: 'Deployment record archived successfully', record: created });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to archive record' });
  }
});

app.delete('/api/archived-records/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await db.deleteArchivedRecord(req.params.id, req.user);
    if (!deleted) return res.status(404).json({ error: 'Archived record not found' });
    res.json({ message: 'Archived record deleted' });
  } catch (err) {
    res.status(403).json({ error: err.message });
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
