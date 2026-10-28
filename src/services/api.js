const API_BASE = '/api';
const TOKEN_KEY = 'branch_tracker_token';
const USER_KEY = 'branch_tracker_user';
const STORAGE_KEY = 'branchAtmTrackerV2';

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function authHeaders() {
  const token = getStoredToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  getStoredToken,
  getStoredUser,

  // Auth: Login
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed. Please check credentials.');
    }

    setStoredToken(data.token);
    setStoredUser(data.user);
    return data;
  },

  // Auth: Get current session
  async getCurrentUser() {
    const token = getStoredToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: authHeaders()
      });

      if (!res.ok) {
        setStoredToken(null);
        setStoredUser(null);
        return null;
      }

      const data = await res.json();
      setStoredUser(data.user);
      return data;
    } catch {
      return { user: getStoredUser(), database: { type: 'local_cache' } };
    }
  },

  // Auth: Logout
  logout() {
    setStoredToken(null);
    setStoredUser(null);
  },

  // Records: Get all records with filters
  async getRecords(params = {}) {
    const query = new URLSearchParams();
    if (params.kind) query.set('kind', params.kind);
    if (params.working) query.set('working', params.working);
    if (params.search) query.set('search', params.search);

    try {
      const res = await fetch(`${API_BASE}/records?${query.toString()}`, {
        headers: authHeaders()
      });

      if (res.status === 401) {
        setStoredToken(null);
        throw new Error('UNAUTHORIZED');
      }

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data) && !params.search && !params.working) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      return { data, isLive: true };
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') throw err;
      console.warn('[API] Backend query failed, using local offline fallback:', err.message);
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      let filtered = local;
      if (params.kind) filtered = filtered.filter(r => r.kind === params.kind);
      if (params.working) filtered = filtered.filter(r => r.working === params.working);
      if (params.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      }
      return { data: filtered, isLive: false, error: err.message };
    }
  },

  // Records: Create record
  async createRecord(payload) {
    try {
      const res = await fetch(`${API_BASE}/records`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setStoredToken(null);
        throw new Error('UNAUTHORIZED');
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to create record`);
      }

      const created = await res.json();
      return created;
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') throw err;
      // Local fallback
      const now = new Date().toISOString();
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const newRec = {
        ...payload,
        id: 'rec-' + Date.now(),
        created: now,
        updated: now,
        createdBy: getStoredUser()?.username || 'admin'
      };
      local.unshift(newRec);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
      return newRec;
    }
  },

  // Records: Update record
  async updateRecord(id, updates) {
    try {
      const res = await fetch(`${API_BASE}/records/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates)
      });

      if (res.status === 401) {
        setStoredToken(null);
        throw new Error('UNAUTHORIZED');
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Failed to update record`);
      }

      return await res.json();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') throw err;
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const idx = local.findIndex(r => r.id === id);
      if (idx !== -1) {
        const updated = {
          ...local[idx],
          ...updates,
          updated: new Date().toISOString(),
          updatedBy: getStoredUser()?.username || 'admin'
        };
        local[idx] = updated;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
        return updated;
      }
      throw err;
    }
  },

  // Records: Delete record
  async deleteRecord(id) {
    try {
      const res = await fetch(`${API_BASE}/records/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.status === 401) {
        setStoredToken(null);
        throw new Error('UNAUTHORIZED');
      }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') throw err;
    }
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    return true;
  },

  // Bulk Import
  async bulkImport(records, mode = 'append') {
    try {
      const res = await fetch(`${API_BASE}/records/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ records, mode })
      });
      if (res.status === 401) {
        setStoredToken(null);
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) throw new Error('Bulk import failed on server');
      return await res.json();
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') throw err;
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      let merged;
      if (mode === 'replace') {
        merged = records;
      } else {
        const map = new Map(existing.map(r => [r.id, r]));
        for (const item of records) map.set(item.id, item);
        merged = Array.from(map.values());
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return { total: merged.length };
    }
  },

  // Stats
  async getStats() {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      if (res.ok) return await res.json();
    } catch {
      // Ignore
    }
    return null;
  },

  // Helper download file
  downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
