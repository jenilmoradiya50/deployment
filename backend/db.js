const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');

// In-memory cache for ultra-fast queries and serverless safety
let recordsCache = null;

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function loadRecords() {
  if (recordsCache !== null) {
    return recordsCache;
  }

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      recordsCache = JSON.parse(raw);
      if (!Array.isArray(recordsCache)) {
        recordsCache = [];
      }
      return recordsCache;
    }
  } catch (err) {
    console.warn('[DB] Warning: Could not read local records file:', err.message);
  }

  // Fallback defaults if file doesn't exist yet
  recordsCache = [
    {
      id: 'rec-demo-branch-001',
      kind: 'Branch',
      dpCode: 'DP-4102',
      vlan: 'Yes',
      lanIp: '10.24.120.1',
      lanGateway: '10.24.120.254',
      atmIp: '10.24.120.50',
      atmGateway: '10.24.120.51',
      bsnlIp: '192.168.10.2',
      bsnlGateway: '192.168.10.1',
      bsnlPing: 'Yes',
      jioIp: '172.16.20.2',
      jioGateway: '172.16.20.1',
      jioPing: 'Yes',
      airtelIp: '10.100.5.2',
      airtelGateway: '10.100.5.1',
      ceIp: '10.100.5.254',
      airtelPing: 'Yes',
      configuration: 'Completed',
      mp: 'Yes',
      online: 'Yes',
      mail: 'Yes',
      dcMail: 'Received',
      drcMail: 'Received',
      cables: 'Connected',
      working: 'Yes',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  ];

  persistRecords(recordsCache);
  return recordsCache;
}

function persistRecords(records) {
  recordsCache = records;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf-8');
    return true;
  } catch (err) {
    // In Vercel serverless environment, local filesystem might be read-only.
    // We catch and log quietly so the serverless function does not crash.
    console.warn('[DB] Warning: Local persistence disabled or read-only filesystem:', err.message);
    return false;
  }
}

function getAllRecords(filter = {}) {
  const records = loadRecords();
  return records.filter(r => {
    if (filter.kind && r.kind !== filter.kind) return false;
    if (filter.working && r.working !== filter.working) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const stringified = JSON.stringify(r).toLowerCase();
      if (!stringified.includes(q)) return false;
    }
    return true;
  });
}

function getRecordById(id) {
  const records = loadRecords();
  return records.find(r => r.id === id) || null;
}

function createRecord(data) {
  const records = loadRecords();
  const now = new Date().toISOString();
  const newRecord = {
    ...data,
    id: data.id || generateId(),
    created: now,
    updated: now
  };
  records.unshift(newRecord);
  persistRecords(records);
  return newRecord;
}

function updateRecord(id, updates) {
  const records = loadRecords();
  const index = records.findIndex(r => r.id === id);
  if (index === -1) {
    return null;
  }
  const existing = records[index];
  const updatedRecord = {
    ...existing,
    ...updates,
    id: existing.id, // prevent id overwrite
    kind: updates.kind || existing.kind,
    created: existing.created,
    updated: new Date().toISOString()
  };
  records[index] = updatedRecord;
  persistRecords(records);
  return updatedRecord;
}

function deleteRecord(id) {
  const records = loadRecords();
  const initialLength = records.length;
  const filtered = records.filter(r => r.id !== id);
  if (filtered.length !== initialLength) {
    persistRecords(filtered);
    return true;
  }
  return false;
}

function bulkImportRecords(importedList, mode = 'append') {
  if (!Array.isArray(importedList)) {
    throw new Error('Import data must be an array of records');
  }

  const existing = loadRecords();
  const now = new Date().toISOString();

  const formatted = importedList.map(item => ({
    ...item,
    id: item.id || generateId(),
    created: item.created || now,
    updated: item.updated || now
  }));

  let finalRecords;
  if (mode === 'replace') {
    finalRecords = formatted;
  } else {
    // Append or update existing by id
    const existingMap = new Map(existing.map(r => [r.id, r]));
    for (const item of formatted) {
      existingMap.set(item.id, item);
    }
    finalRecords = Array.from(existingMap.values());
  }

  persistRecords(finalRecords);
  return finalRecords;
}

function getStats() {
  const records = loadRecords();
  const branchRecords = records.filter(r => r.kind === 'Branch');
  const atmRecords = records.filter(r => r.kind === 'ATM');

  return {
    total: records.length,
    branch: {
      total: branchRecords.length,
      working: branchRecords.filter(r => r.working === 'Yes').length,
      notWorking: branchRecords.filter(r => r.working === 'No').length,
      pending: branchRecords.filter(r => !r.working || (r.working !== 'Yes' && r.working !== 'No')).length
    },
    atm: {
      total: atmRecords.length,
      working: atmRecords.filter(r => r.working === 'Yes').length,
      notWorking: atmRecords.filter(r => r.working === 'No').length,
      pending: atmRecords.filter(r => !r.working || (r.working !== 'Yes' && r.working !== 'No')).length
    }
  };
}

module.exports = {
  getAllRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  bulkImportRecords,
  getStats
};
