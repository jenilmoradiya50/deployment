/**
 * Canara Bank SD-WAN Tracker - Secure Local Pull-Sync Agent & Web Companion (SQLite Engine)
 * 
 * Capabilities:
 * 1. Pulls new/updated site deployment records from the hosted cloud application via outbound HTTPS.
 * 2. Saves full technical deployment data safely into local SQLite database (canara_local.db).
 * 3. Sends acknowledgment (ACK) to hosted DB so cloud can track sync status.
 * 4. Local Web Companion HTTP Bridge: Listens on http://127.0.0.1:41732 with W3C Private Network Access
 *    and CORS headers. When the user opens the web app in their browser on this PC, the browser connects
 *    to this local bridge to retrieve confidential IP details even after cloud 36-hour retention purge.
 * 5. Admin-Controlled Local IP Data Purge: Allows authorized admins to scrub sensitive IP details
 *    from local database only when site is Completed and >= 36 hours have elapsed, with audit logging.
 * 6. CLI Viewer: Query historical site records locally even when cloud has purged IP details.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { DatabaseSync } = require('node:sqlite');

// Load environment configuration
const CONFIG_FILE = path.join(__dirname, 'config.json');
let config = {
  remoteUrl: process.env.REMOTE_URL || 'https://deployment-six-pi.vercel.app',
  syncToken: process.env.SYNC_AGENT_TOKEN || 'canara_sync_secret_2026',
  dbFile: path.join(__dirname, 'canara_local.db'),
  localPort: 41732,
  pollIntervalSeconds: 60
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...loaded };
  } catch (e) {
    console.warn('⚠️ Could not parse config.json, using defaults:', e.message);
  }
}

// Initialize SQLite database
const db = new DatabaseSync(config.dbFile);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS local_records (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'Branch',
    provider TEXT DEFAULT 'Uniserved',
    dp_code TEXT DEFAULT '',
    atm_id TEXT DEFAULT '',
    fe_name TEXT DEFAULT '',
    fe_number TEXT DEFAULT '',
    new_device_serial TEXT DEFAULT '',
    old_device_model TEXT DEFAULT '',
    old_device_serial TEXT DEFAULT '',
    vlan_configured TEXT DEFAULT 'No',
    vlan_details TEXT DEFAULT '',
    vlan_removed TEXT DEFAULT 'Not Removed',
    primary_lan_ip TEXT DEFAULT '',
    lan_ip_prefix TEXT DEFAULT '',
    primary_lan_gateway TEXT DEFAULT '',
    secondary_lan_ips TEXT DEFAULT '[]',
    atm_ip TEXT DEFAULT '',
    atm_gateway TEXT DEFAULT '',
    is_dhcp TEXT DEFAULT 'No',
    ip_source TEXT DEFAULT 'Sheet',
    bsnl_present TEXT DEFAULT 'Yes',
    bsnl_ip TEXT DEFAULT '',
    bsnl_gateway TEXT DEFAULT '',
    bsnl_ping TEXT DEFAULT 'No',
    jio_present TEXT DEFAULT 'Yes',
    jio_ip TEXT DEFAULT '',
    jio_gateway TEXT DEFAULT '',
    jio_ping TEXT DEFAULT 'No',
    airtel_present TEXT DEFAULT 'Yes',
    airtel_is_4g TEXT DEFAULT 'No',
    airtel_loopback_ip TEXT DEFAULT '',
    airtel_ip TEXT DEFAULT '',
    airtel_gateway TEXT DEFAULT '',
    ce_ip TEXT DEFAULT '',
    airtel_ping TEXT DEFAULT 'No',
    deployment_status TEXT DEFAULT 'Pending',
    configuration TEXT DEFAULT 'Not completed',
    mp_added TEXT DEFAULT 'No',
    device_online TEXT DEFAULT 'No',
    cables_connected TEXT DEFAULT 'Not connected',
    working TEXT DEFAULT 'No',
    uat_submitted TEXT DEFAULT 'No',
    uat_form_no TEXT DEFAULT '',
    claimed_by TEXT DEFAULT '',
    claimed_by_name TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    handler_history TEXT DEFAULT '[]',
    completed_at TEXT,
    local_ip_purged INTEGER DEFAULT 0,
    local_ip_purged_at TEXT,
    local_ip_purged_by TEXT,
    created_at TEXT,
    updated_at TEXT,
    last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS local_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    record_id TEXT NOT NULL,
    dp_code TEXT NOT NULL,
    admin_user TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    details TEXT DEFAULT ''
  );
`);

// Row Formatter: Converts snake_case DB row to camelCase frontend schema
function formatLocalRecordRow(row) {
  if (!row) return null;
  let secIps = [];
  try {
    secIps = JSON.parse(row.secondary_lan_ips || '[]');
  } catch {}

  let history = [];
  try {
    history = JSON.parse(row.handler_history || '[]');
  } catch {}

  return {
    id: row.id,
    kind: row.kind || 'Branch',
    provider: row.provider || 'Uniserved',
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
    secondaryLanIps: secIps,
    atmIp: row.atm_ip || '',
    atmGateway: row.atm_gateway || '',
    isDhcp: row.is_dhcp || 'No',
    ipSource: row.ip_source || 'Sheet',
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
    deploymentStatus: row.deployment_status || 'Pending',
    configuration: row.configuration || 'Not completed',
    csAdded: row.mp_added || 'No',
    mpAdded: row.mp_added || 'No',
    deviceOnline: row.device_online || 'No',
    cablesConnected: row.cables_connected || 'Not connected',
    working: row.working || 'No',
    uatSubmitted: row.uat_submitted || 'No',
    uatFormNo: row.uat_form_no || '',
    claimedBy: row.claimed_by || '',
    claimedByName: row.claimed_by_name || '',
    notes: row.notes || '',
    handlerHistory: history,
    completedAt: row.completed_at || null,
    localIpPurged: Boolean(row.local_ip_purged),
    localIpPurgedAt: row.local_ip_purged_at || null,
    created: row.created_at,
    updated: row.updated_at,
    lastSyncedAt: row.last_synced_at
  };
}

// HTTP Request Helper for Cloud Sync
function makeRequest(urlStr, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqHeaders = {
      'User-Agent': 'Canara-Local-Sync-Agent/2.0',
      'X-Sync-Token': config.syncToken,
      ...headers
    };

    let bodyStr = null;
    if (data) {
      bodyStr = JSON.stringify(data);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = client.request(url, {
      method,
      headers: reqHeaders,
      timeout: 15000
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}: ${raw}`));
          }
        } catch {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(raw);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout to hosted cloud'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// -------------------------------------------------------------
// CORE SYNC LOGIC
// -------------------------------------------------------------
async function runSyncCycle() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] 🔄 [Sync Agent] Checking cloud records at: ${config.remoteUrl}`);
  try {
    const pendingUrl = `${config.remoteUrl.replace(/\/$/, '')}/api/sync/pending?limit=100`;
    const res = await makeRequest(pendingUrl, 'GET');
    const records = res.records || [];

    if (records.length === 0) {
      console.log(`[${timestamp}] ✓ [Sync Agent] Local SQLite is up to date. (0 pending records)`);
      return { syncedCount: 0 };
    }

    console.log(`[${timestamp}] 📥 [Sync Agent] Received ${records.length} pending record(s) from cloud. Saving to SQLite...`);

    const insertOrUpdate = db.prepare(`
      INSERT INTO local_records (
        id, kind, provider, dp_code, atm_id, fe_name, fe_number,
        new_device_serial, old_device_model, old_device_serial,
        vlan_configured, vlan_details, vlan_removed,
        primary_lan_ip, lan_ip_prefix, primary_lan_gateway, secondary_lan_ips,
        atm_ip, atm_gateway, is_dhcp, ip_source,
        bsnl_present, bsnl_ip, bsnl_gateway, bsnl_ping,
        jio_present, jio_ip, jio_gateway, jio_ping,
        airtel_present, airtel_is_4g, airtel_loopback_ip, airtel_ip, airtel_gateway, ce_ip, airtel_ping,
        deployment_status, configuration, mp_added, device_online, cables_connected, working,
        uat_submitted, uat_form_no, claimed_by, claimed_by_name, notes, handler_history,
        completed_at, created_at, updated_at, last_synced_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        provider = excluded.provider,
        dp_code = excluded.dp_code,
        atm_id = excluded.atm_id,
        fe_name = excluded.fe_name,
        fe_number = excluded.fe_number,
        new_device_serial = excluded.new_device_serial,
        old_device_model = excluded.old_device_model,
        old_device_serial = excluded.old_device_serial,
        vlan_configured = excluded.vlan_configured,
        vlan_details = excluded.vlan_details,
        vlan_removed = excluded.vlan_removed,
        primary_lan_ip = CASE WHEN local_ip_purged = 1 THEN local_records.primary_lan_ip ELSE excluded.primary_lan_ip END,
        lan_ip_prefix = CASE WHEN local_ip_purged = 1 THEN local_records.lan_ip_prefix ELSE excluded.lan_ip_prefix END,
        primary_lan_gateway = CASE WHEN local_ip_purged = 1 THEN local_records.primary_lan_gateway ELSE excluded.primary_lan_gateway END,
        secondary_lan_ips = CASE WHEN local_ip_purged = 1 THEN local_records.secondary_lan_ips ELSE excluded.secondary_lan_ips END,
        atm_ip = CASE WHEN local_ip_purged = 1 THEN local_records.atm_ip ELSE excluded.atm_ip END,
        atm_gateway = CASE WHEN local_ip_purged = 1 THEN local_records.atm_gateway ELSE excluded.atm_gateway END,
        is_dhcp = excluded.is_dhcp,
        ip_source = excluded.ip_source,
        bsnl_present = excluded.bsnl_present,
        bsnl_ip = CASE WHEN local_ip_purged = 1 THEN local_records.bsnl_ip ELSE excluded.bsnl_ip END,
        bsnl_gateway = CASE WHEN local_ip_purged = 1 THEN local_records.bsnl_gateway ELSE excluded.bsnl_gateway END,
        bsnl_ping = excluded.bsnl_ping,
        jio_present = excluded.jio_present,
        jio_ip = CASE WHEN local_ip_purged = 1 THEN local_records.jio_ip ELSE excluded.jio_ip END,
        jio_gateway = CASE WHEN local_ip_purged = 1 THEN local_records.jio_gateway ELSE excluded.jio_gateway END,
        jio_ping = excluded.jio_ping,
        airtel_present = excluded.airtel_present,
        airtel_is_4g = excluded.airtel_is_4g,
        airtel_loopback_ip = CASE WHEN local_ip_purged = 1 THEN local_records.airtel_loopback_ip ELSE excluded.airtel_loopback_ip END,
        airtel_ip = CASE WHEN local_ip_purged = 1 THEN local_records.airtel_ip ELSE excluded.airtel_ip END,
        airtel_gateway = CASE WHEN local_ip_purged = 1 THEN local_records.airtel_gateway ELSE excluded.airtel_gateway END,
        ce_ip = CASE WHEN local_ip_purged = 1 THEN local_records.ce_ip ELSE excluded.ce_ip END,
        airtel_ping = excluded.airtel_ping,
        deployment_status = excluded.deployment_status,
        configuration = excluded.configuration,
        mp_added = excluded.mp_added,
        device_online = excluded.device_online,
        cables_connected = excluded.cables_connected,
        working = excluded.working,
        uat_submitted = excluded.uat_submitted,
        uat_form_no = excluded.uat_form_no,
        claimed_by = excluded.claimed_by,
        claimed_by_name = excluded.claimed_by_name,
        notes = excluded.notes,
        handler_history = excluded.handler_history,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at,
        last_synced_at = CURRENT_TIMESTAMP;
    `);

    const syncedIds = [];
    for (const r of records) {
      insertOrUpdate.run(
        r.id, r.kind || 'Branch', r.provider || 'Uniserved', r.dpCode || '', r.atmId || '', r.feName || '', r.feNumber || '',
        r.newDeviceSerial || '', r.oldDeviceModel || '', r.oldDeviceSerial || '',
        r.vlanConfigured || 'No', r.vlanDetails || '', r.vlanRemoved || 'Not Removed',
        r.primaryLanIp || '', r.lanIpPrefix || '', r.primaryLanGateway || '', JSON.stringify(r.secondaryLanIps || []),
        r.atmIp || '', r.atmGateway || '', r.isDhcp || 'No', r.ipSource || 'Sheet',
        r.bsnlPresent || 'Yes', r.bsnlIp || '', r.bsnlGateway || '', r.bsnlPing || 'No',
        r.jioPresent || 'Yes', r.jioIp || '', r.jioGateway || '', r.jioPing || 'No',
        r.airtelPresent || 'Yes', r.airtelIs4G || 'No', r.airtelLoopbackIp || '', r.airtelIp || '', r.airtelGateway || '', r.ceIp || '', r.airtelPing || 'No',
        r.deploymentStatus || 'Pending', r.configuration || 'Not completed', r.mpAdded || 'No', r.deviceOnline || 'No', r.cablesConnected || 'Not connected', r.working || 'No',
        r.uatSubmitted || 'No', r.uatFormNo || '', r.claimedBy || '', r.claimedByName || '', r.notes || '', JSON.stringify(r.handlerHistory || []),
        r.completedAt || null, r.created || null, r.updated || null
      );
      syncedIds.push(r.id);
    }

    // Acknowledge sync back to cloud
    const ackUrl = `${config.remoteUrl.replace(/\/$/, '')}/api/sync/ack`;
    await makeRequest(ackUrl, 'POST', { recordIds: syncedIds });
    console.log(`[${timestamp}] ✅ [Sync Agent] Successfully synced and acknowledged ${syncedIds.length} record(s) to SQLite.`);
    return { syncedCount: syncedIds.length };
  } catch (err) {
    console.error(`[${timestamp}] ❌ [Sync Agent] Sync failed: ${err.message}`);
    return { error: err.message };
  }
}

// -------------------------------------------------------------
// LOCAL WEB COMPANION HTTP SERVER (Port 41732)
// -------------------------------------------------------------
function startCompanionServer() {
  const localPort = config.localPort || 41732;

  const server = http.createServer((req, res) => {
    // Enable CORS and W3C Private Network Access for browsers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Token');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://127.0.0.1:${localPort}`);
    const pathname = parsedUrl.pathname;

    // Route: GET /api/local/status
    if (pathname === '/api/local/status' && req.method === 'GET') {
      try {
        const tot = db.prepare('SELECT COUNT(*) as count FROM local_records').get().count;
        const comp = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE deployment_status = 'Completed'").get().count;
        const pend = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE deployment_status = 'Pending'").get().count;
        const purged = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE local_ip_purged = 1").get().count;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'online',
          machine: process.env.COMPUTERNAME || 'LocalPC',
          engine: 'SQLite (node:sqlite)',
          dbPath: config.dbFile,
          totalSites: tot,
          completedSites: comp,
          pendingSites: pend,
          localPurgedSites: purged,
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // Route: GET /api/local/records
    if (pathname === '/api/local/records' && req.method === 'GET') {
      try {
        const rows = db.prepare('SELECT * FROM local_records ORDER BY last_synced_at DESC').all();
        const records = rows.map(formatLocalRecordRow);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ count: records.length, records }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // Route: GET /api/local/record/:identifier
    if (pathname.startsWith('/api/local/record/') && req.method === 'GET') {
      try {
        const identifier = decodeURIComponent(pathname.replace('/api/local/record/', '')).trim();
        const row = db.prepare(`
          SELECT * FROM local_records
          WHERE id = ? OR LOWER(dp_code) = LOWER(?) OR LOWER(atm_id) = LOWER(?)
        `).get(identifier, identifier, identifier);

        if (!row) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: `Site "${identifier}" not found in local SQLite` }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ record: formatLocalRecordRow(row) }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    }

    // Route: POST /api/local/purge-ips
    if (pathname === '/api/local/purge-ips' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { identifier, adminUser } = JSON.parse(body || '{}');
          if (!identifier) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'identifier is required' }));
          }
          const result = purgeLocalIps(identifier, adminUser || 'Admin');
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // Route: POST /api/local/sync-now
    if (pathname === '/api/local/sync-now' && req.method === 'POST') {
      runSyncCycle().then(result => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }).catch(e => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
  });

  server.listen(localPort, '127.0.0.1', () => {
    console.log(`🌐 [Companion Server] Local SQLite HTTP Bridge listening at: http://127.0.0.1:${localPort}`);
    console.log(`📡 [Companion Server] Web browsers on this PC can now automatically retrieve confidential IP details from local SQLite!`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ [Companion Server] Port ${localPort} is already in use by another instance.`);
    } else {
      console.error(`⚠️ [Companion Server] Server error:`, err.message);
    }
  });

  return server;
}

// -------------------------------------------------------------
// REQUIREMENT 2: ADMIN-CONTROLLED LOCAL DATA DELETION
// -------------------------------------------------------------
function purgeLocalIps(identifier, adminUser = 'admin') {
  console.log(`\n🔒 [Local Purge] Evaluating site for local IP purge: "${identifier}"`);

  const selectStmt = db.prepare(`
    SELECT * FROM local_records
    WHERE id = ? OR LOWER(dp_code) = LOWER(?) OR LOWER(atm_id) = LOWER(?)
  `);
  const record = selectStmt.get(identifier, identifier, identifier);

  if (!record) {
    console.log(`❌ [Local Purge Denied] Site "${identifier}" does not exist in local database.`);
    return { success: false, error: `Site "${identifier}" not found in local database.` };
  }

  // Idempotency: check if already purged
  if (record.local_ip_purged === 1) {
    console.log(`✓ [Local Purge Idempotent] IP parameters for site "${record.dp_code || record.atm_id}" were already purged on ${record.local_ip_purged_at} by ${record.local_ip_purged_by}.`);
    return { success: true, alreadyPurged: true, message: `IP details already purged on ${record.local_ip_purged_at}.` };
  }

  // Rule 1: Site MUST be completed
  if (record.deployment_status !== 'Completed') {
    console.log(`❌ [Local Purge Denied] Site "${record.dp_code || record.atm_id}" status is "${record.deployment_status}". IP deletion is only permitted for Completed sites.`);
    return { success: false, error: `Site status is "${record.deployment_status}". Deletion is only allowed for Completed sites.` };
  }

  // Rule 2: At least 36 hours must have elapsed since completion
  if (!record.completed_at) {
    console.log(`❌ [Local Purge Denied] Completion timestamp is missing for site "${record.dp_code || record.atm_id}".`);
    return { success: false, error: 'Completion timestamp is missing.' };
  }

  const completedTime = new Date(record.completed_at).getTime();
  const elapsedMs = Date.now() - completedTime;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours < 36) {
    const remainingHours = (36 - elapsedHours).toFixed(1);
    console.log(`❌ [Local Purge Denied] Site was completed ${elapsedHours.toFixed(1)}h ago. Must wait at least 36 hours (${remainingHours}h remaining).`);
    return { success: false, error: `Site was completed ${elapsedHours.toFixed(1)}h ago. Must wait at least 36 hours (${remainingHours}h remaining).` };
  }

  // Execute Local IP Purge
  db.prepare(`
    UPDATE local_records SET
      primary_lan_ip = '',
      lan_ip_prefix = '',
      primary_lan_gateway = '',
      secondary_lan_ips = '[]',
      atm_ip = '',
      atm_gateway = '',
      bsnl_ip = '',
      bsnl_gateway = '',
      jio_ip = '',
      jio_gateway = '',
      airtel_loopback_ip = '',
      airtel_ip = '',
      airtel_gateway = '',
      ce_ip = '',
      local_ip_purged = 1,
      local_ip_purged_at = CURRENT_TIMESTAMP,
      local_ip_purged_by = ?
    WHERE id = ?
  `).run(adminUser, record.id);

  // Audit Logging (WITHOUT logging the sensitive IP values)
  db.prepare(`
    INSERT INTO local_audit_log (action, record_id, dp_code, admin_user, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'LOCAL_IP_PURGE',
    record.id,
    record.dp_code || record.atm_id || 'UNKNOWN',
    adminUser,
    `Admin purged IP technical parameters after ${elapsedHours.toFixed(1)}h of deployment completion.`
  );

  console.log(`✅ [Local Purge Success] Sensitive IP parameters for site "${record.dp_code || record.atm_id}" permanently deleted from local SQLite. Audited by ${adminUser}.`);
  return { success: true, message: `IP parameters purged successfully for ${record.dp_code || record.atm_id}.` };
}

function purgeAllEligible(adminUser = 'admin') {
  console.log(`\n🧹 [Bulk Local Purge] Scanning for completed sites with >= 36 hours elapsed...`);
  const thirtySixHoursAgo = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();

  const candidates = db.prepare(`
    SELECT id, dp_code, atm_id, completed_at FROM local_records
    WHERE deployment_status = 'Completed'
      AND completed_at IS NOT NULL
      AND completed_at <= ?
      AND (local_ip_purged = 0 OR local_ip_purged IS NULL)
  `).all(thirtySixHoursAgo);

  if (candidates.length === 0) {
    console.log(`✓ No eligible sites found for local purge.`);
    return { purgedCount: 0 };
  }

  let count = 0;
  for (const c of candidates) {
    const res = purgeLocalIps(c.id, adminUser);
    if (res.success && !res.alreadyPurged) count++;
  }

  console.log(`✅ [Bulk Local Purge] Purged sensitive IP parameters from ${count} eligible site(s).`);
  return { purgedCount: count };
}

// -------------------------------------------------------------
// CLI COMMANDS & VIEWER
// -------------------------------------------------------------
function showStatus() {
  const tot = db.prepare('SELECT COUNT(*) as count FROM local_records').get().count;
  const comp = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE deployment_status = 'Completed'").get().count;
  const pend = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE deployment_status = 'Pending'").get().count;
  const hold = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE deployment_status = 'On Hold'").get().count;
  const purged = db.prepare("SELECT COUNT(*) as count FROM local_records WHERE local_ip_purged = 1").get().count;
  const auditCount = db.prepare("SELECT COUNT(*) as count FROM local_audit_log").get().count;

  console.log(`\n📊 Canara Local SQLite Database Status:`);
  console.log(`   Database File:    ${config.dbFile}`);
  console.log(`   Total Sites:      ${tot}`);
  console.log(`   Completed:        ${comp}`);
  console.log(`   Pending:          ${pend}`);
  console.log(`   On Hold:          ${hold}`);
  console.log(`   Local IPs Purged: ${purged}`);
  console.log(`   Audit Log Events: ${auditCount}`);
}

function viewRecord(identifier) {
  const row = db.prepare(`
    SELECT * FROM local_records
    WHERE id = ? OR LOWER(dp_code) = LOWER(?) OR LOWER(atm_id) = LOWER(?)
  `).get(identifier, identifier, identifier);

  if (!row) {
    console.error(`❌ Site "${identifier}" not found in local database.`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`Site: ${row.dp_code || row.atm_id} (${row.kind}) | Provider: ${row.provider}`);
  console.log(`Status: ${row.deployment_status} | Working: ${row.working}`);
  console.log(`Completed At: ${row.completed_at || 'Not completed'}`);
  console.log(`Local IP Purged: ${row.local_ip_purged ? `YES (${row.local_ip_purged_at} by ${row.local_ip_purged_by})` : 'NO (Stored locally)'}`);
  console.log(`------------------------------------------------------`);
  if (row.local_ip_purged) {
    console.log(`[IP Parameters]: PURGED by Admin Policy`);
  } else {
    console.log(`LAN Gateway:    ${row.primary_lan_gateway} ${row.lan_ip_prefix || ''}`);
    console.log(`BSNL Circuit:   IP: ${row.bsnl_ip || 'N/A'} | GW: ${row.bsnl_gateway || 'N/A'} (Ping: ${row.bsnl_ping})`);
    console.log(`Jio Circuit:    IP: ${row.jio_ip || 'N/A'} | GW: ${row.jio_gateway || 'N/A'} (Ping: ${row.jio_ping})`);
    console.log(`Airtel Circuit: IP: ${row.airtel_ip || 'N/A'} | GW: ${row.airtel_gateway || 'N/A'} (Ping: ${row.airtel_ping})`);
  }
  console.log(`New Router S/N: ${row.new_device_serial || '—'}`);
  console.log(`On-site FE:     ${row.fe_name || '—'} (${row.fe_number || '—'})`);
  console.log(`Engineering Remarks: ${row.notes || 'None'}`);
  console.log(`======================================================\n`);
}

// -------------------------------------------------------------
// CLI DISPATCHER
// -------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes('--status')) {
  showStatus();
  process.exit(0);
} else if (args.includes('--purge-ips')) {
  const target = args[args.indexOf('--purge-ips') + 1];
  if (!target) {
    console.error('Usage: node sync.js --purge-ips <DP_CODE_OR_ID>');
    process.exit(1);
  }
  purgeLocalIps(target, process.env.ADMIN_USER || 'admin');
  process.exit(0);
} else if (args.includes('--purge-all-eligible')) {
  purgeAllEligible(process.env.ADMIN_USER || 'admin');
  process.exit(0);
} else if (args.includes('--view')) {
  const target = args[args.indexOf('--view') + 1];
  if (!target) {
    console.error('Usage: node sync.js --view <DP_CODE_OR_ID>');
    process.exit(1);
  }
  viewRecord(target);
  process.exit(0);
} else if (args.includes('--watch') || args.includes('-w') || args.includes('--daemon')) {
  console.log(`\n🚀 Starting Canara Bank SD-WAN Local Sync Daemon (Interval: ${config.pollIntervalSeconds}s)`);
  showStatus();
  startCompanionServer();
  runSyncCycle();
  setInterval(runSyncCycle, config.pollIntervalSeconds * 1000);
} else {
  // Default: start companion server + run sync cycle once
  // If run via CLI for one-shot: check if --oneshot
  if (args.includes('--oneshot')) {
    runSyncCycle().then(() => {
      showStatus();
      process.exit(0);
    });
  } else {
    // Default interactive or background execution: keep companion server active
    console.log(`\n🚀 Canara Bank SD-WAN Local Sync Companion`);
    showStatus();
    startCompanionServer();
    runSyncCycle();
    setInterval(runSyncCycle, config.pollIntervalSeconds * 1000);
  }
}
