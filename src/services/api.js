const API_BASE = '/api';
const TOKEN_KEY = 'canara_sdwan_token';
const USER_KEY = 'canara_sdwan_user';

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
      throw new Error(data.error || 'Login failed. Please verify credentials.');
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
      return { user: getStoredUser(), database: { type: 'offline_or_session' } };
    }
  },

  // Auth: Logout
  logout() {
    setStoredToken(null);
    setStoredUser(null);
  },

  // Admin: User Management
  async getUsers() {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: authHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch users');
    }
    return await res.json();
  },

  async createUser(payload) {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create user');
    }
    return await res.json();
  },

  async deleteUser(id) {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete user');
    }
    return await res.json();
  },

  async updateUserPassword(id, password) {
    const res = await fetch(`${API_BASE}/admin/users/${id}/password`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update user password');
    }
    return await res.json();
  },

  // Records: Query
  async getRecords(params = {}) {
    const query = new URLSearchParams();
    if (params.kind) query.set('kind', params.kind);
    if (params.working) query.set('working', params.working);
    if (params.search) query.set('search', params.search);
    if (params.claimedBy) query.set('claimedBy', params.claimedBy);

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
    return { data, isLive: true };
  },

  // Records: Create
  async createRecord(payload) {
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
      throw new Error(errJson.error || `Failed to create record`);
    }

    return await res.json();
  },

  // Records: Update
  async updateRecord(id, updates) {
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
      throw new Error(errJson.error || `Failed to update record`);
    }

    return await res.json();
  },

  // Records: Claim Site (Link to user)
  async claimRecord(id) {
    const res = await fetch(`${API_BASE}/records/${id}/claim`, {
      method: 'PUT',
      headers: authHeaders()
    });

    if (res.status === 401) {
      setStoredToken(null);
      throw new Error('UNAUTHORIZED');
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to claim site`);
    }

    return await res.json();
  },

  // Records: Delete
  async deleteRecord(id) {
    const res = await fetch(`${API_BASE}/records/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (res.status === 401) {
      setStoredToken(null);
      throw new Error('UNAUTHORIZED');
    }

    if (!res.ok) {
      throw new Error(`Failed to delete record`);
    }

    return true;
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
