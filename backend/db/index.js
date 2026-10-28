const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { connectToDatabase, isMongoConnected } = require('./connect');
const RecordModel = require('../models/Record');
const UserModel = require('../models/User');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// In-memory local stores
let localRecords = null;
let localUsers = null;

function generateId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Ensure local users exist with default admin
function loadLocalUsers() {
  if (localUsers !== null) return localUsers;
  try {
    if (fs.existsSync(USERS_FILE)) {
      localUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      if (Array.isArray(localUsers) && localUsers.length > 0) return localUsers;
    }
  } catch (err) {
    console.warn('[DB] Could not read local users file:', err.message);
  }

  // Seed default admin
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin@123';
  const hashedPassword = bcrypt.hashSync(defaultAdminPassword, 10);
  localUsers = [
    {
      id: 'usr-admin-001',
      username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase(),
      name: 'System Administrator',
      email: 'admin@branch-tracker.bank',
      password: hashedPassword,
      role: 'admin',
      created: new Date().toISOString()
    }
  ];

  persistLocalUsers(localUsers);
  return localUsers;
}

function persistLocalUsers(users) {
  localUsers = users;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    // Read-only serverless environment safe
  }
}

// Load local records
function loadLocalRecords() {
  if (localRecords !== null) return localRecords;
  try {
    if (fs.existsSync(RECORDS_FILE)) {
      localRecords = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
      if (Array.isArray(localRecords)) return localRecords;
    }
  } catch (err) {
    console.warn('[DB] Could not read local records file:', err.message);
  }

  localRecords = [
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
      createdBy: 'admin',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    },
    {
      id: 'rec-demo-atm-001',
      kind: 'ATM',
      atmId: 'ATM-MH-9941',
      dpCode: 'DP-4102',
      vlan: 'Yes',
      lanIp: '10.24.120.50',
      lanGateway: '10.24.120.254',
      bsnlIp: '192.168.12.2',
      bsnlGateway: '192.168.12.1',
      bsnlPing: 'Yes',
      jioIp: '172.16.22.2',
      jioGateway: '172.16.22.1',
      jioPing: 'No',
      airtelIp: '10.100.7.2',
      airtelGateway: '10.100.7.1',
      ceIp: '10.100.7.254',
      airtelPing: 'Yes',
      configuration: 'Completed',
      mp: 'Yes',
      online: 'Yes',
      mail: 'Yes',
      dcMail: 'Received',
      drcMail: 'Not received',
      cables: 'Connected',
      working: 'No',
      createdBy: 'admin',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  ];

  persistLocalRecords(localRecords);
  return localRecords;
}

function persistLocalRecords(records) {
  localRecords = records;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (e) {
    // Read-only serverless safe
  }
}

// Unified Database Methods
const db = {
  async getDbStatus() {
    await connectToDatabase();
    const mongoActive = isMongoConnected();
    return {
      type: mongoActive ? 'mongodb' : 'local_json',
      connected: true,
      hasUri: Boolean(process.env.MONGODB_URI),
      recordsCount: mongoActive ? await RecordModel.countDocuments() : loadLocalRecords().length
    };
  },

  // Auth: authenticate user
  async authenticateUser(username, password) {
    const cleanUser = String(username || '').trim().toLowerCase();
    await connectToDatabase();

    if (isMongoConnected()) {
      let user = await UserModel.findOne({ username: cleanUser });
      if (!user) {
        // Seed initial admin if zero users exist in MongoDB
        const count = await UserModel.countDocuments();
        if (count === 0 && cleanUser === (process.env.ADMIN_USERNAME || 'admin').toLowerCase()) {
          const defaultPassword = process.env.ADMIN_PASSWORD || 'admin@123';
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);
          user = await UserModel.create({
            username: cleanUser,
            password: hashedPassword,
            name: 'System Administrator',
            email: 'admin@branch-tracker.bank',
            role: 'admin'
          });
        }
      }

      if (!user) return null;
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return null;

      return {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }

    // Local fallback auth
    const users = loadLocalUsers();
    const user = users.find(u => u.username === cleanUser);
    if (!user) return null;

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return null;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role
    };
  },

  // Get user by ID
  async getUserById(id) {
    await connectToDatabase();
    if (isMongoConnected()) {
      const user = await UserModel.findById(id);
      if (!user) return null;
      return {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role
      };
    }
    const users = loadLocalUsers();
    const user = users.find(u => u.id === id);
    if (!user) return null;
    return { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role };
  },

  // Records: Get All
  async getAllRecords(filter = {}) {
    await connectToDatabase();

    if (isMongoConnected()) {
      const query = {};
      if (filter.kind) query.kind = filter.kind;
      if (filter.working) query.working = filter.working;
      if (filter.search) {
        const q = filter.search.trim();
        query.$or = [
          { dpCode: { $regex: q, $options: 'i' } },
          { atmId: { $regex: q, $options: 'i' } },
          { lanIp: { $regex: q, $options: 'i' } },
          { bsnlIp: { $regex: q, $options: 'i' } },
          { jioIp: { $regex: q, $options: 'i' } },
          { airtelIp: { $regex: q, $options: 'i' } }
        ];
      }
      const records = await RecordModel.find(query).sort({ updatedAt: -1 });
      return records.map(r => r.toJSON());
    }

    // Local records
    const records = loadLocalRecords();
    return records.filter(r => {
      if (filter.kind && r.kind !== filter.kind) return false;
      if (filter.working && r.working !== filter.working) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const str = JSON.stringify(r).toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  },

  // Records: Get By ID
  async getRecordById(id) {
    await connectToDatabase();
    if (isMongoConnected()) {
      const rec = await RecordModel.findById(id);
      return rec ? rec.toJSON() : null;
    }
    const records = loadLocalRecords();
    return records.find(r => r.id === id) || null;
  },

  // Records: Create
  async createRecord(data, user = {}) {
    await connectToDatabase();
    const author = user.username || 'admin';

    if (isMongoConnected()) {
      const created = await RecordModel.create({
        ...data,
        createdBy: author,
        updatedBy: author
      });
      return created.toJSON();
    }

    const records = loadLocalRecords();
    const now = new Date().toISOString();
    const newRecord = {
      ...data,
      id: data.id || generateId(),
      createdBy: author,
      updatedBy: author,
      created: now,
      updated: now
    };
    records.unshift(newRecord);
    persistLocalRecords(records);
    return newRecord;
  },

  // Records: Update
  async updateRecord(id, updates, user = {}) {
    await connectToDatabase();
    const author = user.username || 'admin';

    if (isMongoConnected()) {
      const updated = await RecordModel.findByIdAndUpdate(
        id,
        { ...updates, updatedBy: author },
        { new: true, runValidators: true }
      );
      return updated ? updated.toJSON() : null;
    }

    const records = loadLocalRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;

    const existing = records[index];
    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      kind: updates.kind || existing.kind,
      created: existing.created,
      updated: new Date().toISOString(),
      updatedBy: author
    };
    records[index] = updated;
    persistLocalRecords(records);
    return updated;
  },

  // Records: Delete
  async deleteRecord(id) {
    await connectToDatabase();
    if (isMongoConnected()) {
      const res = await RecordModel.findByIdAndDelete(id);
      return Boolean(res);
    }
    const records = loadLocalRecords();
    const lenBefore = records.length;
    const remaining = records.filter(r => r.id !== id);
    if (remaining.length !== lenBefore) {
      persistLocalRecords(remaining);
      return true;
    }
    return false;
  },

  // Records: Bulk Import
  async bulkImportRecords(importedList, mode = 'append', user = {}) {
    if (!Array.isArray(importedList)) throw new Error('Input must be an array of records');
    await connectToDatabase();
    const author = user.username || 'admin';

    if (isMongoConnected()) {
      if (mode === 'replace') {
        await RecordModel.deleteMany({});
      }
      const docs = importedList.map(item => {
        const copy = { ...item };
        delete copy.id;
        delete copy._id;
        return {
          ...copy,
          createdBy: copy.createdBy || author,
          updatedBy: author
        };
      });
      await RecordModel.insertMany(docs);
      return { total: await RecordModel.countDocuments() };
    }

    // Local Bulk Import
    const existing = loadLocalRecords();
    const now = new Date().toISOString();
    const formatted = importedList.map(item => ({
      ...item,
      id: item.id || generateId(),
      createdBy: item.createdBy || author,
      updatedBy: author,
      created: item.created || now,
      updated: item.updated || now
    }));

    let finalRecords;
    if (mode === 'replace') {
      finalRecords = formatted;
    } else {
      const map = new Map(existing.map(r => [r.id, r]));
      for (const item of formatted) map.set(item.id, item);
      finalRecords = Array.from(map.values());
    }

    persistLocalRecords(finalRecords);
    return { total: finalRecords.length };
  },

  // Stats: Aggregate
  async getStats() {
    await connectToDatabase();
    if (isMongoConnected()) {
      const [total, branchTotal, branchWorking, branchNotWorking, atmTotal, atmWorking, atmNotWorking] = await Promise.all([
        RecordModel.countDocuments(),
        RecordModel.countDocuments({ kind: 'Branch' }),
        RecordModel.countDocuments({ kind: 'Branch', working: 'Yes' }),
        RecordModel.countDocuments({ kind: 'Branch', working: 'No' }),
        RecordModel.countDocuments({ kind: 'ATM' }),
        RecordModel.countDocuments({ kind: 'ATM', working: 'Yes' }),
        RecordModel.countDocuments({ kind: 'ATM', working: 'No' })
      ]);

      return {
        total,
        database: 'MongoDB Atlas',
        branch: {
          total: branchTotal,
          working: branchWorking,
          notWorking: branchNotWorking,
          pending: Math.max(0, branchTotal - branchWorking - branchNotWorking)
        },
        atm: {
          total: atmTotal,
          working: atmWorking,
          notWorking: atmNotWorking,
          pending: Math.max(0, atmTotal - atmWorking - atmNotWorking)
        }
      };
    }

    // Local stats
    const records = loadLocalRecords();
    const branch = records.filter(r => r.kind === 'Branch');
    const atm = records.filter(r => r.kind === 'ATM');

    return {
      total: records.length,
      database: 'Local JSON Store',
      branch: {
        total: branch.length,
        working: branch.filter(r => r.working === 'Yes').length,
        notWorking: branch.filter(r => r.working === 'No').length,
        pending: branch.filter(r => r.working !== 'Yes' && r.working !== 'No').length
      },
      atm: {
        total: atm.length,
        working: atm.filter(r => r.working === 'Yes').length,
        notWorking: atm.filter(r => r.working === 'No').length,
        pending: atm.filter(r => r.working !== 'Yes' && r.working !== 'No').length
      }
    };
  }
};

module.exports = db;
