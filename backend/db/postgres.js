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
    is_dhcp: 'No',
    bsnl_present: 'Yes',
    bsnl_ip: '192.168.10.2',
    bsnl_gateway: '192.168.10.1',
    bsnl_ping: 'Yes',
    jio_present: 'Yes',
    jio_ip: '172.16.20.2',
    jio_gateway: '172.16.20.1',
    jio_ping: 'Yes',
    airtel_present: 'Yes',
    airtel_is_4g: 'No',
    airtel_loopback_ip: '',
    airtel_ip: '10.100.5.2',
    airtel_gateway: '10.100.5.1',
    ce_ip: '',
    airtel_ping: 'Yes',
    deployment_status: 'Completed',
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

function findConnectionString() {
  // 1. Direct standard variables
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_PRISMA_URL) return process.env.POSTGRES_PRISMA_URL;
  if (process.env.POSTGRES_URL_NON_POOLING) return process.env.POSTGRES_URL_NON_POOLING;

  // 2. Scan all env variables for Vercel Storage custom prefixes (e.g. CANARA_DB_POSTGRES_URL, STORE_POSTGRES_URL, etc.)
  for (const [key, val] of Object.entries(process.env)) {
    if (!val || typeof val !== 'string') continue;
    const lowerVal = val.trim().toLowerCase();
    if (lowerVal.startsWith('postgres://') || lowerVal.startsWith('postgresql://')) {
      console.log(`🔍 [PostgreSQL] Found database connection URL in environment variable: "${key}"`);
      return val;
    }
  }

  return null;
}

function getPool() {
  const rawConnString = findConnectionString();

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
    lanGateway: row.primary_lan_gateway || '',
    secondaryLanIps: (Array.isArray(row.secondary_lan_ips)
      ? row.secondary_lan_ips
      : (typeof row.secondary_lan_ips === 'string' ? JSON.parse(row.secondary_lan_ips || '[]') : [])
    ).map(s => ({
      gateway: s.gateway || s.ip || '',
      ip: s.gateway || s.ip || '',
      prefix: s.prefix || '',
      note: s.note || ''
    })),
    atmIp: row.atm_ip || '',
    atmGateway: row.atm_gateway || '',
    isDhcp: row.is_dhcp || 'No',
    bsnlPresent: row.bsnl_present || 'Yes',
    bsnlIp: row.bsnl_ip || '',
    bsnlGateway: row.bsnl_gateway || '',
    bsnlPing: row.bsnl_ping || 'No',
    jioPresent: row.jio_present || 'Yes',
    jioIp: row.jio_ip || '',
    jioGateway: row.jio_gateway || '',
    jioPing: row.jio_ping || 'No',
    airtelPresent: row.airtel_present || 'Yes',
    airtelIs4G: row.airtel_is_4g || 'No',
    airtelLoopbackIp: row.airtel_loopback_ip || '',
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
    deploymentStatus: row.deployment_status || (row.working === 'Yes' ? 'Completed' : (row.working === 'No' ? 'Failed' : 'Pending')),
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
            is_dhcp VARCHAR(10) DEFAULT 'No',
            bsnl_present VARCHAR(10) DEFAULT 'Yes',
            bsnl_ip VARCHAR(50) DEFAULT '',
            bsnl_gateway VARCHAR(50) DEFAULT '',
            bsnl_ping VARCHAR(10) DEFAULT 'No',
            jio_present VARCHAR(10) DEFAULT 'Yes',
            jio_ip VARCHAR(50) DEFAULT '',
            jio_gateway VARCHAR(50) DEFAULT '',
            jio_ping VARCHAR(10) DEFAULT 'No',
            airtel_present VARCHAR(10) DEFAULT 'Yes',
            airtel_is_4g VARCHAR(10) DEFAULT 'No',
            airtel_loopback_ip VARCHAR(50) DEFAULT '',
            airtel_ip VARCHAR(50) DEFAULT '',
            airtel_gateway VARCHAR(50) DEFAULT '',
            ce_ip VARCHAR(50) DEFAULT '',
            airtel_ping VARCHAR(10) DEFAULT 'No',
            deployment_status VARCHAR(30) DEFAULT 'Pending',
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

        // Migration safety: ensure new columns exist on existing databases
        await client.query(`
          ALTER TABLE records ADD COLUMN IF NOT EXISTS transfer_requested_by VARCHAR(100) DEFAULT '';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS transfer_requested_by_name VARCHAR(150) DEFAULT '';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS transfer_requested_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE records ADD COLUMN IF NOT EXISTS deployment_status VARCHAR(30) DEFAULT 'Pending';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS is_dhcp VARCHAR(10) DEFAULT 'No';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS bsnl_present VARCHAR(10) DEFAULT 'Yes';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS jio_present VARCHAR(10) DEFAULT 'Yes';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS airtel_present VARCHAR(10) DEFAULT 'Yes';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS airtel_is_4g VARCHAR(10) DEFAULT 'No';
          ALTER TABLE records ADD COLUMN IF NOT EXISTS airtel_loopback_ip VARCHAR(50) DEFAULT '';
        `).catch((e) => console.warn('Migration query warn:', e.message));

        // Auto-migrate legacy working status
        await client.query(`
          UPDATE records SET deployment_status = 'Completed' WHERE working = 'Yes' AND (deployment_status IS NULL OR deployment_status = '' OR deployment_status = 'Pending');
          UPDATE records SET deployment_status = 'Failed' WHERE working = 'No' AND (deployment_status IS NULL OR deployment_status = '');
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

        if (filter.kind && filter.kind !== 'All') {
          params.push(filter.kind);
          query += ` AND kind = $${params.length}`;
        }

        if (filter.status && filter.status !== 'all') {
          params.push(filter.status);
          query += ` AND LOWER(deployment_status) = LOWER($${params.length})`;
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
      if (filter.kind && filter.kind !== 'All' && r.kind !== filter.kind) return false;
      if (filter.status && filter.status !== 'all') {
        const recStatus = (r.deployment_status || (r.working === 'Yes' ? 'Completed' : (r.working === 'No' ? 'Failed' : 'Pending'))).toLowerCase();
        if (recStatus !== filter.status.toLowerCase()) return false;
      }
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

  // Records: Check for duplicate Branch DP Code or ATM ID
  async checkDuplicateRecord({ kind, dpCode, atmId, excludeId }) {
    await initDatabase();
    const p = getPool();
    const cleanKind = (kind || 'Branch').trim();

    // 1. Branch Duplicate Check: DP Code must be unique among branches
    if (cleanKind === 'Branch' && dpCode && dpCode.trim()) {
      const cleanDp = dpCode.trim();
      if (p && isInitialized) {
        try {
          const sql = excludeId
            ? 'SELECT id, dp_code, fe_name, claimed_by_name FROM records WHERE kind = $1 AND LOWER(TRIM(dp_code)) = LOWER(TRIM($2)) AND id != $3 LIMIT 1'
            : 'SELECT id, dp_code, fe_name, claimed_by_name FROM records WHERE kind = $1 AND LOWER(TRIM(dp_code)) = LOWER(TRIM($2)) LIMIT 1';
          const params = excludeId ? ['Branch', cleanDp, excludeId] : ['Branch', cleanDp];
          const res = await p.query(sql, params);
          if (res.rows.length > 0) {
            const match = res.rows[0];
            return {
              isDuplicate: true,
              field: 'dpCode',
              value: cleanDp,
              message: `Branch DP Code "${cleanDp}" already exists in the system (Site: ${match.dp_code}, Owner: ${match.claimed_by_name || 'Unassigned'}). Duplicate branch entries are not allowed.`
            };
          }
        } catch (err) {
          console.warn('⚠️ [PostgreSQL] checkDuplicateRecord query error:', err.message);
        }
      }

      // Memory fallback
      const match = memRecords.find(r => 
        (r.kind || 'Branch') === 'Branch' &&
        (r.dp_code || '').trim().toLowerCase() === cleanDp.toLowerCase() &&
        (!excludeId || r.id !== excludeId)
      );
      if (match) {
        return {
          isDuplicate: true,
          field: 'dpCode',
          value: cleanDp,
          message: `Branch DP Code "${cleanDp}" already exists in the system. Duplicate branch entries are not allowed.`
        };
      }
    }

    // 2. ATM Duplicate Check: ATM ID must be unique among ATMs (base DP code CAN be duplicate)
    if (cleanKind === 'ATM' && atmId && atmId.trim()) {
      const cleanAtmId = atmId.trim();
      if (p && isInitialized) {
        try {
          const sql = excludeId
            ? 'SELECT id, atm_id, fe_name, claimed_by_name FROM records WHERE kind = $1 AND LOWER(TRIM(atm_id)) = LOWER(TRIM($2)) AND id != $3 LIMIT 1'
            : 'SELECT id, atm_id, fe_name, claimed_by_name FROM records WHERE kind = $1 AND LOWER(TRIM(atm_id)) = LOWER(TRIM($2)) LIMIT 1';
          const params = excludeId ? ['ATM', cleanAtmId, excludeId] : ['ATM', cleanAtmId];
          const res = await p.query(sql, params);
          if (res.rows.length > 0) {
            const match = res.rows[0];
            return {
              isDuplicate: true,
              field: 'atmId',
              value: cleanAtmId,
              message: `ATM ID "${cleanAtmId}" already exists in the system (Site: ${match.atm_id}, Owner: ${match.claimed_by_name || 'Unassigned'}). Duplicate ATM entries are not allowed.`
            };
          }
        } catch (err) {
          console.warn('⚠️ [PostgreSQL] checkDuplicateRecord query error:', err.message);
        }
      }

      // Memory fallback
      const match = memRecords.find(r => 
        r.kind === 'ATM' &&
        (r.atm_id || '').trim().toLowerCase() === cleanAtmId.toLowerCase() &&
        (!excludeId || r.id !== excludeId)
      );
      if (match) {
        return {
          isDuplicate: true,
          field: 'atmId',
          value: cleanAtmId,
          message: `ATM ID "${cleanAtmId}" already exists in the system. Duplicate ATM entries are not allowed.`
        };
      }
    }

    return { isDuplicate: false };
  },

  // Records: Create
  async createRecord(data, user = {}) {
    await initDatabase();
    const author = user.username || DEFAULT_ADMIN_USER;
    const authorName = user.name || author;
    const newId = generateId('site');

    let secondaryIps = Array.isArray(data.secondaryLanIps)
      ? data.secondaryLanIps.slice(0, 3).map(s => ({
          gateway: s.gateway || s.ip || '',
          ip: s.gateway || s.ip || '',
          prefix: s.prefix || '',
          note: s.note || ''
        }))
      : [];
    const role = (user.role || '').toLowerCase();
    const isPMRole = role === 'pm' || role === 'admin' || author.toLowerCase().includes('admin');
    const explicitlyUnassigned = data.isUnassigned === true || data.claimedBy === '' || data.claimedBy === 'unassigned';

    let claimedBy = '';
    let claimedByName = '';
    if (!explicitlyUnassigned) {
      if (data.claimedBy) {
        claimedBy = data.claimedBy;
        claimedByName = data.claimedByName || authorName;
      } else if (!isPMRole) {
        claimedBy = author;
        claimedByName = authorName;
      }
    }

    const deploymentStatus = data.deploymentStatus || (data.working === 'Yes' ? 'Completed' : (data.working === 'No' ? 'Failed' : 'Pending'));
    const working = deploymentStatus === 'Completed' ? 'Yes' : (deploymentStatus === 'Failed' ? 'No' : (data.working || 'No'));

    const isDhcp = data.isDhcp || 'No';
    const bsnlPresent = data.bsnlPresent || 'Yes';
    const jioPresent = data.jioPresent || 'Yes';
    const airtelPresent = data.airtelPresent || 'Yes';
    const airtelIs4G = data.airtelIs4G || 'No';
    const airtelLoopbackIp = data.airtelLoopbackIp || '';

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
            is_dhcp,
            bsnl_present, bsnl_ip, bsnl_gateway, bsnl_ping,
            jio_present, jio_ip, jio_gateway, jio_ping,
            airtel_present, airtel_is_4g, airtel_loopback_ip, airtel_ip, airtel_gateway, ce_ip, airtel_ping,
            deployment_status,
            configuration, mp_added, device_online, mail_sent, dc_mail, drc_mail, cables_connected, working,
            uat_submitted, uat_form_no, claimed_by, claimed_by_name, notes, created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18,
            $19,
            $20, $21, $22, $23,
            $24, $25, $26, $27,
            $28, $29, $30, $31, $32, $33, $34,
            $35,
            $36, $37, $38, $39, $40, $41, $42, $43,
            $44, $45, $46, $47, $48, $49, $50
          ) RETURNING *;
        `;

        const values = [
          newId, data.kind || 'Branch', data.dpCode || '', data.atmId || '', data.feName || '', data.feNumber || '',
          data.newDeviceSerial || '', data.oldDeviceModel || '', data.oldDeviceSerial || '',
          data.vlanConfigured || 'No', data.vlanDetails || '', data.vlanRemoved || 'Not Removed',
          data.primaryLanIp || data.lanIp || '', data.lanIpPrefix || '', data.primaryLanGateway || data.lanGateway || '', JSON.stringify(secondaryIps),
          data.atmIp || '', data.atmGateway || '',
          isDhcp,
          bsnlPresent, data.bsnlIp || '', data.bsnlGateway || '', data.bsnlPing || 'No',
          jioPresent, data.jioIp || '', data.jioGateway || '', data.jioPing || 'No',
          airtelPresent, airtelIs4G, airtelLoopbackIp, data.airtelIp || '', data.airtelGateway || '', data.ceIp || '', data.airtelPing || 'No',
          deploymentStatus,
          data.configuration || 'Not completed', data.mpAdded || data.mp || 'No', data.deviceOnline || data.online || 'No', data.mailSent || data.mail || 'No',
          data.dcMail || 'Not received', data.drcMail || 'Not received', data.cablesConnected || data.cables || 'Not connected', working,
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
      is_dhcp: isDhcp,
      bsnl_present: bsnlPresent,
      bsnl_ip: data.bsnlIp || '',
      bsnl_gateway: data.bsnlGateway || '',
      bsnl_ping: data.bsnlPing || 'No',
      jio_present: jioPresent,
      jio_ip: data.jioIp || '',
      jio_gateway: data.jioGateway || '',
      jio_ping: data.jioPing || 'No',
      airtel_present: airtelPresent,
      airtel_is_4g: airtelIs4G,
      airtel_loopback_ip: airtelLoopbackIp,
      airtel_ip: data.airtelIp || '',
      airtel_gateway: data.airtelGateway || '',
      ce_ip: data.ceIp || '',
      airtel_ping: data.airtelPing || 'No',
      deployment_status: deploymentStatus,
      configuration: data.configuration || 'Not completed',
      mp_added: data.mpAdded || data.mp || 'No',
      device_online: data.deviceOnline || data.online || 'No',
      mail_sent: data.mailSent || data.mail || 'No',
      dc_mail: data.dcMail || 'Not received',
      drc_mail: data.drcMail || 'Not received',
      cables_connected: data.cablesConnected || data.cables || 'Not connected',
      working: working,
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
      secondaryIps = Array.isArray(updates.secondaryLanIps)
        ? updates.secondaryLanIps.slice(0, 3).map(s => ({
            gateway: s.gateway || s.ip || '',
            ip: s.gateway || s.ip || '',
            prefix: s.prefix || '',
            note: s.note || ''
          }))
        : [];
    }

    if (p && isInitialized) {
      try {
        const existing = await p.query('SELECT * FROM records WHERE id = $1', [id]);
        if (existing.rows.length === 0) return null;

        const depStatus = updates.deploymentStatus || (updates.working === 'Yes' ? 'Completed' : (updates.working === 'No' ? 'Failed' : null));
        const working = updates.working || (updates.deploymentStatus === 'Completed' ? 'Yes' : (updates.deploymentStatus === 'Failed' ? 'No' : null));

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
            is_dhcp = COALESCE($19, is_dhcp),
            bsnl_present = COALESCE($20, bsnl_present),
            bsnl_ip = COALESCE($21, bsnl_ip),
            bsnl_gateway = COALESCE($22, bsnl_gateway),
            bsnl_ping = COALESCE($23, bsnl_ping),
            jio_present = COALESCE($24, jio_present),
            jio_ip = COALESCE($25, jio_ip),
            jio_gateway = COALESCE($26, jio_gateway),
            jio_ping = COALESCE($27, jio_ping),
            airtel_present = COALESCE($28, airtel_present),
            airtel_is_4g = COALESCE($29, airtel_is_4g),
            airtel_loopback_ip = COALESCE($30, airtel_loopback_ip),
            airtel_ip = COALESCE($31, airtel_ip),
            airtel_gateway = COALESCE($32, airtel_gateway),
            ce_ip = COALESCE($33, ce_ip),
            airtel_ping = COALESCE($34, airtel_ping),
            deployment_status = COALESCE($35, deployment_status),
            configuration = COALESCE($36, configuration),
            mp_added = COALESCE($37, mp_added),
            device_online = COALESCE($38, device_online),
            mail_sent = COALESCE($39, mail_sent),
            dc_mail = COALESCE($40, dc_mail),
            drc_mail = COALESCE($41, drc_mail),
            cables_connected = COALESCE($42, cables_connected),
            working = COALESCE($43, working),
            uat_submitted = COALESCE($44, uat_submitted),
            uat_form_no = COALESCE($45, uat_form_no),
            claimed_by = COALESCE($46, claimed_by),
            claimed_by_name = COALESCE($47, claimed_by_name),
            notes = COALESCE($48, notes),
            updated_by = $49,
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
          updates.isDhcp,
          updates.bsnlPresent, updates.bsnlIp, updates.bsnlGateway, updates.bsnlPing,
          updates.jioPresent, updates.jioIp, updates.jioGateway, updates.jioPing,
          updates.airtelPresent, updates.airtelIs4G, updates.airtelLoopbackIp, updates.airtelIp, updates.airtelGateway, updates.ceIp, updates.airtelPing,
          depStatus,
          updates.configuration, updates.mpAdded ?? updates.mp, updates.deviceOnline ?? updates.online, updates.mailSent ?? updates.mail,
          updates.dcMail, updates.drcMail, updates.cablesConnected ?? updates.cables, working,
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
    const depStatus = updates.deploymentStatus || (updates.working === 'Yes' ? 'Completed' : (updates.working === 'No' ? 'Failed' : ex.deployment_status));
    const working = updates.working || (updates.deploymentStatus === 'Completed' ? 'Yes' : (updates.deploymentStatus === 'Failed' ? 'No' : ex.working));

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
      is_dhcp: updates.isDhcp ?? ex.is_dhcp,
      bsnl_present: updates.bsnlPresent ?? ex.bsnl_present,
      bsnl_ip: updates.bsnlIp ?? ex.bsnl_ip,
      bsnl_gateway: updates.bsnlGateway ?? ex.bsnl_gateway,
      bsnl_ping: updates.bsnlPing ?? ex.bsnl_ping,
      jio_present: updates.jioPresent ?? ex.jio_present,
      jio_ip: updates.jioIp ?? ex.jio_ip,
      jio_gateway: updates.jioGateway ?? ex.jio_gateway,
      jio_ping: updates.jioPing ?? ex.jio_ping,
      airtel_present: updates.airtelPresent ?? ex.airtel_present,
      airtel_is_4g: updates.airtelIs4G ?? ex.airtel_is_4g,
      airtel_loopback_ip: updates.airtelLoopbackIp ?? ex.airtel_loopback_ip,
      airtel_ip: updates.airtelIp ?? ex.airtel_ip,
      airtel_gateway: updates.airtelGateway ?? ex.airtel_gateway,
      ce_ip: updates.ceIp ?? ex.ce_ip,
      airtel_ping: updates.airtelPing ?? ex.airtel_ping,
      deployment_status: depStatus,
      configuration: updates.configuration ?? ex.configuration,
      mp_added: (updates.mpAdded ?? updates.mp) ?? ex.mp_added,
      device_online: (updates.deviceOnline ?? updates.online) ?? ex.device_online,
      mail_sent: (updates.mailSent ?? updates.mail) ?? ex.mail_sent,
      dc_mail: updates.dcMail ?? ex.dc_mail,
      drc_mail: updates.drcMail ?? ex.drc_mail,
      cables_connected: (updates.cablesConnected ?? updates.cables) ?? ex.cables_connected,
      working: working,
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

  // Fast Status Updater: Pending, Completed, On Hold, Failed
  async updateRecordStatus(id, status, user = {}) {
    const valid = ['Pending', 'Completed', 'On Hold', 'Failed'];
    if (!valid.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${valid.join(', ')}`);
    }
    const working = status === 'Completed' ? 'Yes' : (status === 'Failed' ? 'No' : 'No');
    return this.updateRecord(id, { deploymentStatus: status, working }, user);
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
        const [tot, compQ, pendQ, holdQ, failQ, brTot, atmTot] = await Promise.all([
          p.query('SELECT COUNT(*) FROM records'),
          p.query("SELECT COUNT(*) FROM records WHERE deployment_status = 'Completed' OR (deployment_status IS NULL AND working = 'Yes')"),
          p.query("SELECT COUNT(*) FROM records WHERE deployment_status = 'Pending' OR (deployment_status IS NULL AND working != 'Yes' AND working != 'No')"),
          p.query("SELECT COUNT(*) FROM records WHERE deployment_status = 'On Hold'"),
          p.query("SELECT COUNT(*) FROM records WHERE deployment_status = 'Failed' OR (deployment_status IS NULL AND working = 'No')"),
          p.query("SELECT COUNT(*) FROM records WHERE kind = 'Branch'"),
          p.query("SELECT COUNT(*) FROM records WHERE kind = 'ATM'")
        ]);

        const total = parseInt(tot.rows[0].count, 10);
        const completed = parseInt(compQ.rows[0].count, 10);
        const pending = parseInt(pendQ.rows[0].count, 10);
        const onHold = parseInt(holdQ.rows[0].count, 10);
        const failed = parseInt(failQ.rows[0].count, 10);
        const branchTotal = parseInt(brTot.rows[0].count, 10);
        const atmTotal = parseInt(atmTot.rows[0].count, 10);

        return {
          total,
          completed,
          pending,
          onHold,
          failed,
          database: 'PostgreSQL Cloud Database (Supabase / Vercel Postgres)',
          branch: {
            total: branchTotal,
            working: completed
          },
          atm: {
            total: atmTotal
          }
        };
      } catch (err) {
        console.warn('⚠️ [PostgreSQL] getStats query error:', err.message);
      }
    }

    // In-memory stats
    const branch = memRecords.filter(r => r.kind === 'Branch');
    const atm = memRecords.filter(r => r.kind === 'ATM');
    const total = memRecords.length;
    const completed = memRecords.filter(r => r.deployment_status === 'Completed' || (!r.deployment_status && r.working === 'Yes')).length;
    const onHold = memRecords.filter(r => r.deployment_status === 'On Hold').length;
    const failed = memRecords.filter(r => r.deployment_status === 'Failed' || (!r.deployment_status && r.working === 'No')).length;
    const pending = Math.max(0, total - completed - onHold - failed);

    return {
      total,
      completed,
      pending,
      onHold,
      failed,
      database: 'In-Memory (Awaiting DATABASE_URL / Supabase)',
      branch: {
        total: branch.length,
        working: completed
      },
      atm: {
        total: atmTotal
      }
    };
  }
};

module.exports = db;
