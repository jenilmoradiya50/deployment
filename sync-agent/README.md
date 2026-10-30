# Canara Bank SD-WAN Local Sync Agent (SQLite Engine)

This is the standalone **Local Pull-Sync Agent** for securely syncing confidential IP and circuit deployment parameters from the cloud to your local system, storing them in a local SQLite database (`canara_local.db`).

## Features
- **Zero Software Installation**: Runs natively on Node.js using built-in `node:sqlite`. No external server or software needed.
- **Outbound-Only HTTPS**: Connects out to your hosted cloud application via TLS. Zero inbound ports or public IP exposure.
- **Offline Resilient**: If your PC is off, records wait in the cloud sync queue and automatically sync when you turn it on.
- **Admin-Controlled Local Data Deletion**: Allows administrators to purge sensitive IP parameters from the local database for completed deployments that have exceeded the 36-hour window, with full audit logging.
- **Local Record Viewer**: Query full historical network parameters for any site locally even after cloud records have purged their IPs.

---

## Usage

### 1. Run a Sync Cycle (One-Time)
```bash
npm run sync
```
This contacts the cloud, downloads any pending records, updates `canara_local.db`, and marks them as synced.

### 2. Run in Continuous Background Watch Mode
```bash
npm run sync:watch
```
Polls the cloud periodically (default: every 60 seconds) and syncs new updates automatically.

### 3. Check Local Database Status
```bash
npm run sync:status
```

### 4. View Full Historical Technical Specs of a Site
```bash
node sync-agent/sync.js --view DP-4102
```

### 5. Admin-Controlled Local IP Purge (Requirement 2)
To scrub sensitive IP parameters for a specific completed site (only allowed if Completed and >= 36 hours elapsed):
```bash
node sync-agent/sync.js --purge-ips DP-4102
```
To bulk-purge all eligible completed sites older than 36 hours:
```bash
node sync-agent/sync.js --purge-all-eligible
```
All deletions are audited in the `local_audit_log` table without logging sensitive IP values.
