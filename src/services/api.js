const API_BASE = '/api';
const TOKEN_KEY = 'canara_sdwan_token';
const USER_KEY = 'canara_sdwan_user';
const LOGIN_TIME_KEY = 'canara_sdwan_login_time';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours session limit

function getStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  if (!token) return '';

  const loginTimeStr = localStorage.getItem(LOGIN_TIME_KEY);
  if (loginTimeStr) {
    const loginTime = parseInt(loginTimeStr, 10);
    if (Date.now() - loginTime > SESSION_MAX_AGE_MS) {
      console.warn('⚠️ [Session] 8-hour login session has expired. Clearing credentials.');
      setStoredToken(null);
      setStoredUser(null);
      return '';
    }
  }
  return token;
}

function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LOGIN_TIME_KEY, String(Date.now()));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_TIME_KEY);
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

  async updateUser(id, payload) {
    const res = await fetch(`${API_BASE}/admin/users/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update user');
    }
    return await res.json();
  },

  async updateProfile(payload) {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update profile');
    }
    const data = await res.json();
    if (data.user) {
      setStoredUser(data.user);
    }
    return data;
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

  // Records: Quick Status Update (Completed, Pending, On Hold, Failed)
  async updateRecordStatus(id, status) {
    const res = await fetch(`${API_BASE}/records/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });

    if (res.status === 401) {
      setStoredToken(null);
      throw new Error('UNAUTHORIZED');
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Failed to update site status`);
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

  // Records: Request Site Handover / Transfer
  async requestTransfer(id) {
    const res = await fetch(`${API_BASE}/records/${id}/request-transfer`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to request transfer');
    }
    return await res.json();
  },

  // Records: Accept Site Handover / Transfer
  async acceptTransfer(id) {
    const res = await fetch(`${API_BASE}/records/${id}/accept-transfer`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to accept transfer');
    }
    return await res.json();
  },

  // Records: Reject / Cancel Site Handover
  async rejectTransfer(id) {
    const res = await fetch(`${API_BASE}/records/${id}/reject-transfer`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to decline transfer');
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
