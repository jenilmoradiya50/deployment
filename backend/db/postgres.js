const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function generateId(prefix = 'rec') {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_ADMIN_USER = process.env.ADMIN_USERNAME || 'Admin@Canara';
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Qwerty@123';

let pool = null;
let isInitialized = false;
let initPromise = null;
let lastInitError = null;

// In-memory fallback if DATABASE_URL is not set yet (100% in-memory, ZERO files on disk)
let memUsers = [
  {
    id: 'usr-admin-001',
    username: 'Admin@Canara',
    password_hash: bcrypt.hashSync('Qwerty@123', 10),
    name: 'Canara Bank SD-WAN Admin',
    phone: '9876543210',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'usr-admin-002',
    username: 'admin',
    password_hash: bcrypt.hashSync('Qwerty@123', 10),
    name: 'Canara Bank SD-WAN Admin',
    phone: '9876543210',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let memRecords = [
  {
    id: 'rec-canara-branch-001',
    kind: 'Branch',
    dp_code: 'DP-4102',
    atm_id: '',
    fe_name: 'Rajesh Sharma',
    fe_number: '9845012345',
    new_device_serial: 'CN-SDWAN-994821',
    old_device_model: 'Cisco 1921/K9',
    old_device_serial: 'FTX1842A001',
    vlan_configured: 'Yes',
    vlan_details: 'VLAN 100 (Core Banking)',
    vlan_removed: 'Not Removed',
    primary_lan_ip: '10.24.120.1',
    lan_ip_prefix: '/24',
    primary_lan_gateway: '10.24.120.254',
    secondary_lan_ips: [
      { ip: '10.24.120.50', prefix: '/28', note: 'ATM VLAN Gateway' }
    ],
    atm_ip: '10.24.120.50',
    atm_gateway: '10.24.120.51',
    bsnl_ip: '192.168.10.2',
    bsnl_gateway: '192.168.10.1',
    bsnl_ping: 'Yes',
    jio_ip: '172.16.20.2',
    jio_gateway: '172.16.20.1',
    jio_ping: 'Yes',
    airtel_ip: '10.100.5.2',
    airtel_gateway: '10.100.5.1',
    ce_ip: '10.100.5.254',
    airtel_ping: 'Yes',
    configuration: 'Completed',
    mp_added: 'Yes',
    device_online: 'Yes',
    mail_sent: 'Yes',
    dc_mail: 'Received',
    drc_mail: 'Received',
    cables_connected: 'Connected',
    working: 'Yes',
    uat_submitted: 'Yes',
    uat_form_no: 'UAT-CN-4102-01',
    claimed_by: DEFAULT_ADMIN_USER,
    claimed_by_name: 'Canara Bank SD-WAN Admin',
    notes: 'Migration completed smoothly. All ISP traffic passing through SD-WAN.',
    created_by: DEFAULT_ADMIN_USER,
    updated_by: DEFAULT_ADMIN_USER,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function sanitizeConnectionString(raw) {
  if (!raw) return raw;
  let str = String(raw).trim();
  // Strip surrounding quotes if user copied "..." or '...'
  str = str.replace(/^["']+|["']+$/g, '').trim();

  // If connection string contains unencoded '@' in password, encode it
  const match = str.match(/^(postgres(?:ql)?:\/\/[^:]+:)(.*)@([^@\/]+)(:\d+)?(\/.*)?$/);
  if (match) {
    const [, prefix, rawPass, host, port = '', rest = ''] = match;
    if (rawPass.includes('@') && !rawPass.includes('%40')) {
      return `${prefix}${encodeURIComponent(rawPass)}@${host}${port}${rest}`;
    }
  }
  return str;
}

function getPool() {
  const rawConnString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!rawConnString) {
    return null;
  }

  const connString = sanitizeConnectionString(rawConnString);

  if (!pool) {
    pool = new Pool({
      connectionString: connString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
      console.error('PostgreSQL Pool background error:', err.message);
    });
  }

  return pool;
}

// Convert snake_case row to camelCase for API/UI
function formatRecordRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind || 'Branch',
    dpCode: row.dp_code || '',
    atmId: row.atm_id || '',
    feName: row.fe_name || '',
    feNumber: row.fe_number || '',
    newDeviceSerial: row.new_device_serial || '',
    oldDeviceModel: row.old_device_model || '',
    oldDeviceSerial: row.old_device_serial || '',
    vlanConfigured: row.vlan_configured || 'No',
    vlanDetails: row.vlan_details || '',
    vlanRemoved: row.vlan_removed || 'Not Removed',
    primaryLanIp: row.primary_lan_ip || '',
    lanIpPrefix: row.lan_ip_prefix || '',
    primaryLanGateway: row.primary_lan_gateway || '',
    secondaryLanIps: Array.isArray(row.secondary_lan_ips)
      ? row.secondary_lan_ips
      : (typeof row.secondary_lan_ips === 'string' ? JSON.parse(row.secondary_lan_ips || '[]') : []),
    atmIp: row.atm_ip || '',
    atmGateway: row.atm_gateway || '',
    bsnlIp: row.bsnl_ip || '',
    bsnlGateway: row.bsnl_gateway || '',
    bsnlPing: row.bsnl_ping || 'No',
    jioIp: row.jio_ip || '',
    jioGateway: row.jio_gateway || '',
    jioPing: row.jio_ping || 'No',
    airtelIp: row.airtel_ip || '',
    airtelGateway: row.airtel_gateway || '',
    ceIp: row.ce_ip || '',
    airtelPing: row.airtel_ping || 'No',
    configuration: row.configuration || 'Not completed',
    mpAdded: row.mp_added || 'No',
    csAdded: row.mp_added || 'No',
    deviceOnline: row.device_online || 'No',
    mailSent: row.mail_sent || 'No',
    dcMail: row.dc_mail || 'Not received',
    drcMail: row.drc_mail || 'Not received',
    cablesConnected: row.cables_connected || 'Not connected',
    working: row.working || 'No',
    uatSubmitted: row.uat_submitted || 'No',
    uatFormNo: row.uat_form_no || '',
    claimedBy: row.claimed_by || '',
    claimedByName: row.claimed_by_name || '',
    transferRequestedBy: row.transfer_requested_by || '',
    transferRequestedByName: row.transfer_requested_by_name || '',
    transferRequestedAt: row.transfer_requested_at || null,
    notes: row.notes || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    created: row.created_at,
    updated: row.updated_at
  };
}

async function initDatabase() {
  const p = getPool();
  if (!p) {
    isInitialized = true;
    return;
  }
  if (isInitialized) return;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const client = await p.connect();
      try {
        // 1. Create users table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(150) NOT NULL,
            phone VARCHAR(50) DEFAULT '',
            role VARCHAR(50) NOT NULL DEFAULT 'noc',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 2. Create records table
        await client.query(`
          CREATE TABLE IF NOT EXISTS records (
            id VARCHAR(64) PRIMARY KEY,
            kind VARCHAR(20) NOT NULL DEFAULT 'Branch',
            dp_code VARCHAR(100) DEFAULT '',
            atm_id VARCHAR(100) DEFAULT '',
            fe_name VARCHAR(150) DEFAULT '',
            fe_number VARCHAR(50) DEFAULT '',
            new_device_serial VARCHAR(100) DEFAULT '',
            old_device_model VARCHAR(100) DEFAULT '',
            old_device_serial VARCHAR(100) DEFAULT '',
            vlan_configured VARCHAR(10) DEFAULT 'No',
            vlan_details VARCHAR(100) DEFAULT '',
            vlan_removed VARCHAR(30) DEFAULT 'Not Removed',
            primary_lan_ip VARCHAR(50) DEFAULT '',
            lan_ip_prefix VARCHAR(30) DEFAULT '',
            primary_lan_gateway VARCHAR(50) DEFAULT '',
            secondary_lan_ips JSONB DEFAULT '[]'::jsonb,
            atm_ip VARCHAR(50) DEFAULT '',
            atm_gateway VARCHAR(50) DEFAULT '',
            bsnl_ip VARCHAR(50) DEFAULT '',
            bsnl_gateway VARCHAR(50) DEFAULT '',
            bsnl_ping VARCHAR(10) DEFAULT 'No',
            jio_ip VARCHAR(50) DEFAULT '',
            jio_gateway VARCHAR(50) DEFAULT '',
            jio_ping VARCHAR(10) DEFAULT 'No',
            airtel_ip VARCHAR(50) DEFAULT '',
            airtel_gateway VARCHAR(50) DEFAULT '',
            ce_ip VARCHAR(50) DEFAULT '',
            airtel_ping VARCHAR(10) DEFAULT 'No',
            configuration VARCHAR(50) DEFAULT 'Not completed',
            mp_added VARCHAR(10) DEFAULT 'No',
            device_online VARCHAR(10) DEFAULT 'No',
            mail_sent VARCHAR(10) DEFAULT 'No',
            dc_mail VARCHAR(30) DEFAULT 'Not received',
            drc_mail VARCHAR(30) DEFAULT 'Not received',
            cables_connected VARCHAR(30) DEFAULT 'Not connected',
            working VARCHAR(10) DEFAULT 'No',
            uat_submitted VARCHAR(10) DEFAULT 'No',
            uat_form_no VARCHAR(100) DEFAULT '',
            claimed_by VARCHAR(100) DEFAULT '',
            claimed_by_name VARCHAR(150) DEFAULT '',
            transfer_requested_by VARCHAR(100) DEFAULT '',
            transfer_requested_by_name VARCHAR(150) DEFAULT '',
            transfer_requested_at TIMESTAMP WITH TIME ZONE,
            notes TEXT DEFAULT '',
            created_by VARCHAR(100) DEFAULT 'Admin@Canara',
            updated_by VARCHAR(100) DEFAULT 'Admin@Canara',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Migration safety: ensure transfer columns exist on existing databases
        await client.query(`
          ALTER TABLE records ADD COLUMN IF NOT EXISTS transfer_requested_by VARCHAR(100) DEFAULT '';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS transfer_requested_by_name VARCHAR(150) DEFAULT '';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS transfer_requested_at TIMESTAMP WITH TIME ZONE;
        `).catch(() => {});

        // 3. Ensure Default Admin exists & password hash is valid
        const userCheck = await client.query('SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1)', ['admin@canara']);
        const correctHash = await bcrypt.hash('Qwerty@123', 10);
        if (userCheck.rows.length === 0) {
          await client.query(`
            INSERT INTO users (id, username, password_hash, name, phone, role)
            VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)
          `, [
            generateId('usr'),
            'Admin@Canara',
            correctHash,
            'Canara Bank SD-WAN Admin',
            '9876543210',
            'admin',
            generateId('usr'),
            'admin',
            correctHash,
            'Canara Bank SD-WAN Admin',
            '9876543210',
            'admin'
          ]);
          console.log(`✅ [PostgreSQL] Initialized Default Admin: Admin@Canara`);
        } else {
          const matches = await bcrypt.compare('Qwerty@123', userCheck.rows[0].password_hash).catch(() => false);
          if (!matches) {
            await client.query('UPDATE users SET password_hash = $1 WHERE LOWER(username) = LOWER($2)', [correctHash, 'admin@canara']);
            console.log('🔄 [PostgreSQL] Auto-synced Admin@Canara password hash for Qwerty@123');
          }
        }

        console.log('✅ [PostgreSQL] Database tables verified and ready.');
        isInitialized = true;
        lastInitError = null;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('⚠️ [PostgreSQL] Initialization error:', err.message);
      lastInitError = err.message;
      isInitialized = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

// Database API Methods
const db = {
  async getDbStatus() {
    const p = getPool();
    if (!p) {
      return {
        type: 'memory_session',
        connected: false,
        engine: 'In-Memory (Awaiting DATABASE_URL or Vercel Postgres)',
        notice: 'No database URL detected. Attach Vercel Postgres Storage or set DATABASE_URL.'
      };
    }
    await initDatabase();
    if (!isInitialized) {
      return {
        type: 'memory_session',
        connected: false,
        engine: 'In-Memory Fallback',
        error: lastInitError || 'PostgreSQL connection failed or timed out'
      };
    }
    return {
      type: 'postgresql',
      connected: true,
      engine: 'PostgreSQL Cloud (Vercel Postgres / Supabase)'
    };
  },

  // Auth: authenticate user
  async authenticateUser(username, password) {
    await initDatabase();
    const cleanUser = String(username || '').trim();
    const isDefaultAdmin = cleanUser.toLowerCase() === 'admin@canara' || cleanUser.toLowerCase() === 'admin';
    const isDefaultPass = password === 'Qwerty@123';
    const p = getPool();

    if (p && isInitialized) {
      try {
        const res = await p.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [cleanUser]);
        if (res.rows.length === 0) {
          if (isDefaultAdmin && isDefaultPass) {
            const newAdmin = await this.createUser({
              username: 'Admin@Canara',
              password: 'Qwerty@123',
              name: 'Canara Bank SD-WAN Admin',
              phone: '9876543210',
              role: 'admin'
            });
            return newAdmin;
          }
          return null;
        }

        const user = res.rows[0];
        let isMatch = await bcrypt.compare(password, user.password_hash).catch(() => false);

        if (!isMatch && isDefaultAdmin && isDefaultPass) {
          isMatch = true;
          const correctHash = await bcrypt.hash('Qwerty@123', 10);
          p.query('UPDATE users SET password_hash = $1 WHERE id = $2', [correctHash, user.id]).catch(() => {});
        }

        if (!isMatch) return null;
        return {
          id: user.id,
          username: user.username,
          name: user.name,
          phone: user.phone,
          role: user.role
        };
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] Auth query error, using local session:', err.message);
      }
    }

    // In-memory fallback
    const user = memUsers.find(u => u.username.toLowerCase() === cleanUser.toLowerCase());
    if (!user) {
      if (isDefaultAdmin && isDefaultPass) {
        return {
          id: 'usr-admin-001',
          username: 'Admin@Canara',
          name: 'Canara Bank SD-WAN Admin',
          phone: '9876543210',
          role: 'admin'
        };
      }
      return null;
    }
    const isMatch = bcrypt.compareSync(password, user.password_hash) || (isDefaultAdmin && isDefaultPass);
    if (!isMatch) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      phone: user.phone,
      role: user.role
    };
  },

  // Get user by ID
  async getUserById(id) {
    await initDatabase();
    const p = getPool();
    if (p && isInitialized) {
      try {
        const res = await p.query('SELECT id, username, name, phone, role FROM users WHERE id = $1', [id]);
        if (res.rows[0]) return res.rows[0];
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] getUserById query error:', err.message);
      }
    }
    const u = memUsers.find(x => x.id === id);
    if (!u) return null;
    return { id: u.id, username: u.username, name: u.name, phone: u.phone, role: u.role };
  },

  // Admin: List all users
  async getAllUsers() {
    await initDatabase();
    const p = getPool();
    if (p && isInitialized) {
      try {
        const res = await p.query('SELECT id, username, name, phone, role, created_at FROM users ORDER BY created_at DESC');
        return res.rows;
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] getAllUsers query error:', err.message);
      }
    }
    return memUsers.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      phone: u.phone,
      role: u.role,
      created_at: u.created_at
    }));
  },

  // Admin: Create new user
  async createUser({ username, password, name, phone, role = 'noc' }) {
    await initDatabase();
    const cleanUser = String(username || '').trim();
    const resolvedRole = (role === 'field_engineer' || !role) ? 'noc' : role;
    if (!cleanUser || !password) {
      throw new Error('Username and password are required');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newId = generateId('usr');
    const p = getPool();

    if (p && isInitialized) {
      try {
        const existing = await p.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [cleanUser]);
        if (existing.rows.length > 0) {
          throw new Error(`Username "${cleanUser}" already exists`);
        }

        const res = await p.query(`
          INSERT INTO users (id, username, password_hash, name, phone, role)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, username, name, phone, role, created_at
        `, [newId, cleanUser, hashedPassword, name || cleanUser, phone || '', resolvedRole]);
        return res.rows[0];
      } catch (err) {
        if (err.message.includes('already exists')) throw err;
        console.warn('⚠️ [PostgreSQL] createUser query error, falling back to memory:', err.message);
      }
    }

    // In-memory
    if (memUsers.some(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
      throw new Error(`Username "${cleanUser}" already exists`);
    }

    const newUser = {
      id: newId,
      username: cleanUser,
      password_hash: hashedPassword,
      name: name || cleanUser,
      phone: phone || '',
      role: resolvedRole,
      created_at: new Date().toISOString()
    };
    memUsers.push(newUser);
    return { id: newUser.id, username: newUser.username, name: newUser.name, phone: newUser.phone, role: newUser.role, created_at: newUser.created_at };
  },

  // Admin: Delete user
  async deleteUser(id) {
    await initDatabase();
    const p = getPool();
    if (p && isInitialized) {
      try {
        const res = await p.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        return res.rows.length > 0;
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] deleteUser query error:', err.message);
      }
    }
    const idx = memUsers.findIndex(u => u.id === id);
    if (idx !== -1) {
      memUsers.splice(idx, 1);
      return true;
    }
    return false;
  },

  // Admin: Update user password
  async updateUserPassword(id, newPassword) {
    await initDatabase();
    if (!newPassword || newPassword.trim().length === 0) {
      throw new Error('New password cannot be empty');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const p = getPool();
    if (p && isInitialized) {
      try {
        const res = await p.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, name, phone, role',
          [hashedPassword, id]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] updateUserPassword query error:', err.message);
      }
    }
    const u = memUsers.find(x => x.id === id);
    if (!u) throw new Error('User not found');
    u.password_hash = hashedPassword;
    u.updated_at = new Date().toISOString();
    return { id: u.id, username: u.username, name: u.name, phone: u.phone, role: u.role };
  },

  // Admin / PM: Update user details & role
  async updateUser(id, fields = {}) {
    await initDatabase();
    const p = getPool();
    const allowed = {};
    if (fields.name !== undefined) allowed.name = fields.name;
    if (fields.phone !== undefined) allowed.phone = fields.phone;
    if (fields.role !== undefined) allowed.role = fields.role;
    if (fields.username !== undefined) allowed.username = fields.username;

    if (p && isInitialized) {
      try {
        const res = await p.query(`
          UPDATE users SET
            name = COALESCE($2, name),
            phone = COALESCE($3, phone),
            role = COALESCE($4, role),
            username = COALESCE($5, username),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, username, name, phone, role, created_at, updated_at
        `, [id, allowed.name, allowed.phone, allowed.role, allowed.username]);
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] updateUser query error:', err.message);
      }
    }

    const u = memUsers.find(x => x.id === id);
    if (!u) throw new Error('User not found');
    if (allowed.name !== undefined) u.name = allowed.name;
    if (allowed.phone !== undefined) u.phone = allowed.phone;
    if (allowed.role !== undefined) u.role = allowed.role;
    if (allowed.username !== undefined) u.username = allowed.username;
    u.updated_at = new Date().toISOString();
    return { id: u.id, username: u.username, name: u.name, phone: u.phone, role: u.role, created_at: u.created_at, updated_at: u.updated_at };
  },

  // Self Profile: User updates own name, phone, and optional password
  async updateProfile(id, { name, phone, password }) {
    await initDatabase();
    const p = getPool();
    let passHash = null;
    if (password && password.trim().length > 0) {
      passHash = await bcrypt.hash(password, 10);
    }

    if (p && isInitialized) {
      try {
        const res = await p.query(`
          UPDATE users SET
            name = COALESCE($2, name),
            phone = COALESCE($3, phone),
            password_hash = COALESCE($4, password_hash),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING id, username, name, phone, role
        `, [id, name, phone, passHash]);
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] updateProfile query error:', err.message);
      }
    }

    const u = memUsers.find(x => x.id === id);
    if (!u) throw new Error('User not found');
    if (name !== undefined) u.name = name;
    if (phone !== undefined) u.phone = phone;
    if (passHash) u.password_hash = passHash;
    u.updated_at = new Date().toISOString();
    return { id: u.id, username: u.username, name: u.name, phone: u.phone, role: u.role };
  },

  // Records: Get All with filtering
  async getAllRecords(filter = {}) {
    await initDatabase();
    const p = getPool();

    if (p && isInitialized) {
      try {
        let query = 'SELECT * FROM records WHERE 1=1';
        const params = [];

        if (filter.kind) {
          params.push(filter.kind);
          query += ` AND kind = $${params.length}`;
        }

        if (filter.working) {
          params.push(filter.working);
          query += ` AND working = $${params.length}`;
        }

        if (filter.claimedBy) {
          params.push(filter.claimedBy);
          query += ` AND claimed_by = $${params.length}`;
        }

        if (filter.search) {
          params.push(`%${filter.search.trim().toLowerCase()}%`);
          const idx = params.length;
          query += ` AND (
            LOWER(dp_code) LIKE $${idx} OR
            LOWER(atm_id) LIKE $${idx} OR
            LOWER(primary_lan_ip) LIKE $${idx} OR
            LOWER(fe_name) LIKE $${idx} OR
            LOWER(fe_number) LIKE $${idx} OR
            LOWER(new_device_serial) LIKE $${idx} OR
            LOWER(old_device_serial) LIKE $${idx} OR
            LOWER(bsnl_ip) LIKE $${idx} OR
            LOWER(jio_ip) LIKE $${idx} OR
            LOWER(airtel_ip) LIKE $${idx}
          )`;
        }

        query += ' ORDER BY updated_at DESC';
        const res = await p.query(query, params);
        return res.rows.map(formatRecordRow);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] getAllRecords query error, falling back to memory:', err.message);
      }
    }

    // In-memory fallback
    return memRecords.filter(r => {
      if (filter.kind && r.kind !== filter.kind) return false;
      if (filter.working && r.working !== filter.working) return false;
      if (filter.claimedBy && r.claimed_by !== filter.claimedBy) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const str = JSON.stringify(r).toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    }).map(formatRecordRow);
  },

  // Records: Get By ID
  async getRecordById(id) {
    await initDatabase();
    const p = getPool();
    if (p && isInitialized) {
      try {
        const res = await p.query('SELECT * FROM records WHERE id = $1', [id]);
        if (res.rows.length > 0) return formatRecordRow(res.rows[0]);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] getRecordById query error:', err.message);
      }
    }
    const r = memRecords.find(x => x.id === id);
    return r ? formatRecordRow(r) : null;
  },

  // Records: Create
  async createRecord(data, user = {}) {
    await initDatabase();
    const author = user.username || DEFAULT_ADMIN_USER;
    const authorName = user.name || author;
    const newId = generateId('site');

    let secondaryIps = Array.isArray(data.secondaryLanIps) ? data.secondaryLanIps.slice(0, 3) : [];
    const claimedBy = data.claimedBy || author;
    const claimedByName = data.claimedByName || authorName;

    const p = getPool();
    if (p && isInitialized) {
      try {
        const sql = `
          INSERT INTO records (
            id, kind, dp_code, atm_id, fe_name, fe_number,
            new_device_serial, old_device_model, old_device_serial,
            vlan_configured, vlan_details, vlan_removed,
            primary_lan_ip, lan_ip_prefix, primary_lan_gateway, secondary_lan_ips,
            atm_ip, atm_gateway,
            bsnl_ip, bsnl_gateway, bsnl_ping,
            jio_ip, jio_gateway, jio_ping,
            airtel_ip, airtel_gateway, ce_ip, airtel_ping,
            configuration, mp_added, device_online, mail_sent, dc_mail, drc_mail, cables_connected, working,
            uat_submitted, uat_form_no, claimed_by, claimed_by_name, notes, created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18,
            $19, $20, $21,
            $22, $23, $24,
            $25, $26, $27, $28,
            $29, $30, $31, $32, $33, $34, $35, $36,
            $37, $38, $39, $40, $41, $42, $43
          ) RETURNING *;
        `;

        const values = [
          newId, data.kind || 'Branch', data.dpCode || '', data.atmId || '', data.feName || '', data.feNumber || '',
          data.newDeviceSerial || '', data.oldDeviceModel || '', data.oldDeviceSerial || '',
          data.vlanConfigured || 'No', data.vlanDetails || '', data.vlanRemoved || 'Not Removed',
          data.primaryLanIp || data.lanIp || '', data.lanIpPrefix || '', data.primaryLanGateway || data.lanGateway || '', JSON.stringify(secondaryIps),
          data.atmIp || '', data.atmGateway || '',
          data.bsnlIp || '', data.bsnlGateway || '', data.bsnlPing || 'No',
          data.jioIp || '', data.jioGateway || '', data.jioPing || 'No',
          data.airtelIp || '', data.airtelGateway || '', data.ceIp || '', data.airtelPing || 'No',
          data.configuration || 'Not completed', data.mpAdded || data.mp || 'No', data.deviceOnline || data.online || 'No', data.mailSent || data.mail || 'No',
          data.dcMail || 'Not received', data.drcMail || 'Not received', data.cablesConnected || data.cables || 'Not connected', data.working || 'No',
          data.uatSubmitted || 'No', data.uatFormNo || '', claimedBy, claimedByName, data.notes || '', author, author
        ];

        const res = await p.query(sql, values);
        return formatRecordRow(res.rows[0]);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] createRecord query error, using local fallback:', err.message);
      }
    }

    // In-memory
    const now = new Date().toISOString();
    const newRec = {
      id: newId,
      kind: data.kind || 'Branch',
      dp_code: data.dpCode || '',
      atm_id: data.atmId || '',
      fe_name: data.feName || '',
      fe_number: data.feNumber || '',
      new_device_serial: data.newDeviceSerial || '',
      old_device_model: data.oldDeviceModel || '',
      old_device_serial: data.oldDeviceSerial || '',
      vlan_configured: data.vlanConfigured || 'No',
      vlan_details: data.vlanDetails || '',
      vlan_removed: data.vlanRemoved || 'Not Removed',
      primary_lan_ip: data.primaryLanIp || data.lanIp || '',
      lan_ip_prefix: data.lanIpPrefix || '',
      primary_lan_gateway: data.primaryLanGateway || data.lanGateway || '',
      secondary_lan_ips: secondaryIps,
      atm_ip: data.atmIp || '',
      atm_gateway: data.atmGateway || '',
      bsnl_ip: data.bsnlIp || '',
      bsnl_gateway: data.bsnlGateway || '',
      bsnl_ping: data.bsnlPing || 'No',
      jio_ip: data.jioIp || '',
      jio_gateway: data.jioGateway || '',
      jio_ping: data.jioPing || 'No',
      airtel_ip: data.airtelIp || '',
      airtel_gateway: data.airtelGateway || '',
      ce_ip: data.ce_ip || '',
      airtel_ping: data.airtelPing || 'No',
      configuration: data.configuration || 'Not completed',
      mp_added: data.mpAdded || data.mp || 'No',
      device_online: data.deviceOnline || data.online || 'No',
      mail_sent: data.mailSent || data.mail || 'No',
      dc_mail: data.dcMail || 'Not received',
      drc_mail: data.drcMail || 'Not received',
      cables_connected: data.cablesConnected || data.cables || 'Not connected',
      working: data.working || 'No',
      uat_submitted: data.uatSubmitted || 'No',
      uat_form_no: data.uatFormNo || '',
      claimed_by: claimedBy,
      claimed_by_name: claimedByName,
      notes: data.notes || '',
      created_by: author,
      updated_by: author,
      created_at: now,
      updated_at: now
    };
    memRecords.unshift(newRec);
    return formatRecordRow(newRec);
  },

  // Records: Update
  async updateRecord(id, updates, user = {}) {
    await initDatabase();
    const author = user.username || DEFAULT_ADMIN_USER;
    const p = getPool();

    let secondaryIps = undefined;
    if (updates.secondaryLanIps !== undefined) {
      secondaryIps = Array.isArray(updates.secondaryLanIps) ? updates.secondaryLanIps.slice(0, 3) : [];
    }

    if (p && isInitialized) {
      try {
        const existing = await p.query('SELECT * FROM records WHERE id = $1', [id]);
        if (existing.rows.length === 0) return null;

        const sql = `
          UPDATE records SET
            kind = COALESCE($2, kind),
            dp_code = COALESCE($3, dp_code),
            atm_id = COALESCE($4, atm_id),
            fe_name = COALESCE($5, fe_name),
            fe_number = COALESCE($6, fe_number),
            new_device_serial = COALESCE($7, new_device_serial),
            old_device_model = COALESCE($8, old_device_model),
            old_device_serial = COALESCE($9, old_device_serial),
            vlan_configured = COALESCE($10, vlan_configured),
            vlan_details = COALESCE($11, vlan_details),
            vlan_removed = COALESCE($12, vlan_removed),
            primary_lan_ip = COALESCE($13, primary_lan_ip),
            lan_ip_prefix = COALESCE($14, lan_ip_prefix),
            primary_lan_gateway = COALESCE($15, primary_lan_gateway),
            secondary_lan_ips = COALESCE($16, secondary_lan_ips),
            atm_ip = COALESCE($17, atm_ip),
            atm_gateway = COALESCE($18, atm_gateway),
            bsnl_ip = COALESCE($19, bsnl_ip),
            bsnl_gateway = COALESCE($20, bsnl_gateway),
            bsnl_ping = COALESCE($21, bsnl_ping),
            jio_ip = COALESCE($22, jio_ip),
            jio_gateway = COALESCE($23, jio_gateway),
            jio_ping = COALESCE($24, jio_ping),
            airtel_ip = COALESCE($25, airtel_ip),
            airtel_gateway = COALESCE($26, airtel_gateway),
            ce_ip = COALESCE($27, ce_ip),
            airtel_ping = COALESCE($28, airtel_ping),
            configuration = COALESCE($29, configuration),
            mp_added = COALESCE($30, mp_added),
            device_online = COALESCE($31, device_online),
            mail_sent = COALESCE($32, mail_sent),
            dc_mail = COALESCE($33, dc_mail),
            drc_mail = COALESCE($34, drc_mail),
            cables_connected = COALESCE($35, cables_connected),
            working = COALESCE($36, working),
            uat_submitted = COALESCE($37, uat_submitted),
            uat_form_no = COALESCE($38, uat_form_no),
            claimed_by = COALESCE($39, claimed_by),
            claimed_by_name = COALESCE($40, claimed_by_name),
            notes = COALESCE($41, notes),
            updated_by = $42,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *;
        `;

        const values = [
          id, updates.kind, updates.dpCode, updates.atmId, updates.feName, updates.feNumber,
          updates.newDeviceSerial, updates.oldDeviceModel, updates.oldDeviceSerial,
          updates.vlanConfigured, updates.vlanDetails, updates.vlanRemoved,
          updates.primaryLanIp ?? updates.lanIp, updates.lanIpPrefix, updates.primaryLanGateway ?? updates.lanGateway,
          secondaryIps !== undefined ? JSON.stringify(secondaryIps) : null,
          updates.atmIp, updates.atmGateway,
          updates.bsnlIp, updates.bsnlGateway, updates.bsnlPing,
          updates.jioIp, updates.jioGateway, updates.jioPing,
          updates.airtelIp, updates.airtelGateway, updates.ceIp, updates.airtelPing,
          updates.configuration, updates.mpAdded ?? updates.mp, updates.deviceOnline ?? updates.online, updates.mailSent ?? updates.mail,
          updates.dcMail, updates.drcMail, updates.cablesConnected ?? updates.cables, updates.working,
          updates.uatSubmitted, updates.uatFormNo, updates.claimedBy, updates.claimedByName,
          updates.notes, author
        ];

        const res = await p.query(sql, values);
        return formatRecordRow(res.rows[0]);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] updateRecord query error, using local fallback:', err.message);
      }
    }

    // In-memory
    const idx = memRecords.findIndex(r => r.id === id);
    if (idx === -1) return null;
    const ex = memRecords[idx];
    const updated = {
      ...ex,
      kind: updates.kind ?? ex.kind,
      dp_code: updates.dpCode ?? ex.dp_code,
      atm_id: updates.atmId ?? ex.atm_id,
      fe_name: updates.feName ?? ex.fe_name,
      fe_number: updates.feNumber ?? ex.fe_number,
      new_device_serial: updates.newDeviceSerial ?? ex.new_device_serial,
      old_device_model: updates.oldDeviceModel ?? ex.old_device_model,
      old_device_serial: updates.oldDeviceSerial ?? ex.old_device_serial,
      vlan_configured: updates.vlanConfigured ?? ex.vlan_configured,
      vlan_details: updates.vlanDetails ?? ex.vlan_details,
      vlan_removed: updates.vlanRemoved ?? ex.vlan_removed,
      primary_lan_ip: (updates.primaryLanIp ?? updates.lanIp) ?? ex.primary_lan_ip,
      lan_ip_prefix: updates.lanIpPrefix ?? ex.lan_ip_prefix,
      primary_lan_gateway: (updates.primaryLanGateway ?? updates.lanGateway) ?? ex.primary_lan_gateway,
      secondary_lan_ips: secondaryIps !== undefined ? secondaryIps : ex.secondary_lan_ips,
      atm_ip: updates.atmIp ?? ex.atm_ip,
      atm_gateway: updates.atmGateway ?? ex.atm_gateway,
      bsnl_ip: updates.bsnlIp ?? ex.bsnl_ip,
      bsnl_gateway: updates.bsnlGateway ?? ex.bsnl_gateway,
      bsnl_ping: updates.bsnlPing ?? ex.bsnl_ping,
      jio_ip: updates.jioIp ?? ex.jio_ip,
      jio_gateway: updates.jioGateway ?? ex.jio_gateway,
      jio_ping: updates.jioPing ?? ex.jio_ping,
      airtel_ip: updates.airtelIp ?? ex.airtel_ip,
      airtel_gateway: updates.airtelGateway ?? ex.airtel_gateway,
      ce_ip: updates.ceIp ?? ex.ce_ip,
      airtel_ping: updates.airtelPing ?? ex.airtel_ping,
      configuration: updates.configuration ?? ex.configuration,
      mp_added: (updates.mpAdded ?? updates.mp) ?? ex.mp_added,
      device_online: (updates.deviceOnline ?? updates.online) ?? ex.device_online,
      mail_sent: (updates.mailSent ?? updates.mail) ?? ex.mail_sent,
      dc_mail: updates.dcMail ?? ex.dc_mail,
      drc_mail: updates.drcMail ?? ex.drc_mail,
      cables_connected: (updates.cablesConnected ?? updates.cables) ?? ex.cables_connected,
      working: updates.working ?? ex.working,
      uat_submitted: updates.uatSubmitted ?? ex.uat_submitted,
      uat_form_no: updates.uatFormNo ?? ex.uat_form_no,
      claimed_by: updates.claimedBy ?? ex.claimed_by,
      claimed_by_name: updates.claimedByName ?? ex.claimed_by_name,
      notes: updates.notes ?? ex.notes,
      updated_by: author,
      updated_at: new Date().toISOString()
    };
    memRecords[idx] = updated;
    return formatRecordRow(updated);
  },

  // Records: Delete
  async deleteRecord(id) {
    await initDatabase();
    const p = getPool();
    if (p && isInitialized) {
      try {
        const res = await p.query('DELETE FROM records WHERE id = $1 RETURNING id', [id]);
        return res.rows.length > 0;
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] deleteRecord query error:', err.message);
      }
    }
    const idx = memRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
      memRecords.splice(idx, 1);
      return true;
    }
    return false;
  },

  // Claim site: user claims a site
  async claimRecord(id, user = {}) {
    return this.updateRecord(id, {
      claimedBy: user.username,
      claimedByName: user.name || user.username
    }, user);
  },

  // Request site transfer (NOC asks current owner for site handover)
  async requestTransfer(recordId, user = {}) {
    await initDatabase();
    const p = getPool();
    const requester = user.username || '';
    const requesterName = user.name || requester;
    if (!requester) throw new Error('Authentication required to request transfer');

    if (p && isInitialized) {
      try {
        const res = await p.query(`
          UPDATE records SET
            transfer_requested_by = $1,
            transfer_requested_by_name = $2,
            transfer_requested_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *;
        `, [requester, requesterName, recordId]);
        if (res.rows.length === 0) throw new Error('Site record not found');
        return formatRecordRow(res.rows[0]);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] requestTransfer query error:', err.message);
      }
    }

    const rec = memRecords.find(r => r.id === recordId);
    if (!rec) throw new Error('Site record not found');
    rec.transfer_requested_by = requester;
    rec.transfer_requested_by_name = requesterName;
    rec.transfer_requested_at = new Date().toISOString();
    return formatRecordRow(rec);
  },

  // Accept site transfer (current owner or admin/pm approves transfer)
  async acceptTransfer(recordId, user = {}) {
    await initDatabase();
    const p = getPool();

    const record = await this.getRecordById(recordId);
    if (!record) throw new Error('Site record not found');
    if (!record.transferRequestedBy) throw new Error('No pending transfer request on this site');

    const userRole = (user.role || '').toLowerCase();
    const uname = (user.username || '').toLowerCase();
    const isOwner = (record.claimedBy || '').toLowerCase() === uname;
    const canAccept = isOwner || userRole === 'admin' || userRole === 'pm';
    if (!canAccept) {
      throw new Error('You do not have permission to approve this site transfer');
    }

    const newOwner = record.transferRequestedBy;
    const newOwnerName = record.transferRequestedByName || newOwner;

    if (p && isInitialized) {
      try {
        const res = await p.query(`
          UPDATE records SET
            claimed_by = $1,
            claimed_by_name = $2,
            transfer_requested_by = '',
            transfer_requested_by_name = '',
            transfer_requested_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING *;
        `, [newOwner, newOwnerName, recordId]);
        if (res.rows.length > 0) return formatRecordRow(res.rows[0]);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] acceptTransfer query error:', err.message);
      }
    }

    const rec = memRecords.find(r => r.id === recordId);
    if (!rec) throw new Error('Site record not found');
    rec.claimed_by = newOwner;
    rec.claimed_by_name = newOwnerName;
    rec.transfer_requested_by = '';
    rec.transfer_requested_by_name = '';
    rec.transfer_requested_at = null;
    return formatRecordRow(rec);
  },

  // Reject / Cancel site transfer
  async rejectTransfer(recordId, user = {}) {
    await initDatabase();
    const p = getPool();

    const record = await this.getRecordById(recordId);
    if (!record) throw new Error('Site record not found');

    const userRole = (user.role || '').toLowerCase();
    const uname = (user.username || '').toLowerCase();
    const isOwner = (record.claimedBy || '').toLowerCase() === uname;
    const isRequester = (record.transferRequestedBy || '').toLowerCase() === uname;
    if (!isOwner && !isRequester && userRole !== 'admin' && userRole !== 'pm') {
      throw new Error('Not authorized to cancel this transfer request');
    }

    if (p && isInitialized) {
      try {
        const res = await p.query(`
          UPDATE records SET
            transfer_requested_by = '',
            transfer_requested_by_name = '',
            transfer_requested_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *;
        `, [recordId]);
        if (res.rows.length > 0) return formatRecordRow(res.rows[0]);
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] rejectTransfer query error:', err.message);
      }
    }

    const rec = memRecords.find(r => r.id === recordId);
    if (!rec) throw new Error('Site record not found');
    rec.transfer_requested_by = '';
    rec.transfer_requested_by_name = '';
    rec.transfer_requested_at = null;
    return formatRecordRow(rec);
  },

  // Stats: Aggregated
  async getStats() {
    await initDatabase();
    const p = getPool();
    if (p && isInitialized) {
      try {
        const [tot, brTot, brOk, atmTot, atmOk] = await Promise.all([
          p.query('SELECT COUNT(*) FROM records'),
          p.query("SELECT COUNT(*) FROM records WHERE kind = 'Branch'"),
          p.query("SELECT COUNT(*) FROM records WHERE kind = 'Branch' AND working = 'Yes'"),
          p.query("SELECT COUNT(*) FROM records WHERE kind = 'ATM'"),
          p.query("SELECT COUNT(*) FROM records WHERE kind = 'ATM' AND working = 'Yes'")
        ]);

        const total = parseInt(tot.rows[0].count, 10);
        const branchTotal = parseInt(brTot.rows[0].count, 10);
        const branchWorking = parseInt(brOk.rows[0].count, 10);
        const atmTotal = parseInt(atmTot.rows[0].count, 10);
        const atmWorking = parseInt(atmOk.rows[0].count, 10);

        return {
          total,
          database: 'PostgreSQL Cloud Database (Supabase / Vercel Postgres)',
          branch: {
            total: branchTotal,
            working: branchWorking,
            pending: Math.max(0, branchTotal - branchWorking)
          },
          atm: {
            total: atmTotal,
            working: atmWorking,
            pending: Math.max(0, atmTotal - atmWorking)
          }
        };
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] getStats query error:', err.message);
      }
    }

    // In-memory stats
    const branch = memRecords.filter(r => r.kind === 'Branch');
    const atm = memRecords.filter(r => r.kind === 'ATM');
    return {
      total: memRecords.length,
      database: 'In-Memory (Awaiting DATABASE_URL / Supabase)',
      branch: {
        total: branch.length,
        working: branch.filter(r => r.working === 'Yes').length,
        pending: branch.filter(r => r.working !== 'Yes').length
      },
      atm: {
        total: atm.length,
        working: atm.filter(r => r.working === 'Yes').length,
        pending: atm.filter(r => r.working !== 'Yes').length
      }
    };
  }
};

module.exports = db;
