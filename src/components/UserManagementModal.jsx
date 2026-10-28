import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function UserManagementModal({ isOpen, onClose, onNotify }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(true);

  // New user form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('noc');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password reset inline state
  const [resetUserId, setResetUserId] = useState(null);
  const [resetNewPass, setResetNewPass] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err) {
      if (onNotify) onNotify(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setShowAddForm(true);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username and password are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await api.createUser({
        username: username.trim(),
        password,
        name: name.trim() || username.trim(),
        phone: phone.trim(),
        role
      });

      if (onNotify) onNotify(`User "${username}" created and authorized successfully!`);
      setUsername('');
      setPassword('');
      setName('');
      setPhone('');
      await fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (userId, userUname) => {
    if (!resetNewPass || resetNewPass.trim().length === 0) {
      if (onNotify) onNotify('Please enter a new password', 'error');
      return;
    }

    setIsResetting(true);
    try {
      await api.updateUserPassword(userId, resetNewPass);
      if (onNotify) onNotify(`Password for "${userUname}" updated successfully!`);
      setResetUserId(null);
      setResetNewPass('');
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to update password', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async (userId, userUname) => {
    if (!confirm(`Are you sure you want to delete user account "${userUname}"?`)) return;

    try {
      await api.deleteUser(userId);
      if (onNotify) onNotify(`User "${userUname}" deleted successfully.`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      if (onNotify) onNotify(err.message, 'error');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window user-mgmt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-form-header">
          <div className="header-badge-title">
            <span className="modal-tag">ADMINISTRATION</span>
            <h2>NOC Engineers & User Management</h2>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form-scrollable">
          {/* Top Bar with Add User Toggle */}
          <div className="user-mgmt-top-bar">
            <div>
              <h3>👥 NOC & Admin Accounts ({users.length})</h3>
              <p className="sub-text">Authorize NOC Engineers to monitor sites and coordinate with on-site Field Engineers (FE).</p>
            </div>
            <button
              type="button"
              className="primary-btn-sm"
              onClick={() => { setShowAddForm(!showAddForm); setErrorMsg(''); }}
            >
              {showAddForm ? '▲ Hide Add Form' : '＋ Add NOC Account'}
            </button>
          </div>

          {/* Create User Form */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="add-user-card">
              <div className="add-user-card-header">
                <h4>➕ Create New NOC User Account</h4>
                <span className="card-badge-info">Set username & password for NOC staff</span>
              </div>
              {errorMsg && <div className="modal-error-alert">{errorMsg}</div>}

              <div className="user-form-grid">
                <div className="modal-form-field">
                  <label className="field-title required">Username *</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. NOC_Ramesh or NOC_Team1"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title required">Password *</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="field-input"
                      style={{ paddingRight: '40px' }}
                      placeholder="Set login password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#64748b'
                      }}
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Full Name</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. Ramesh Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Contact Phone</label>
                  <input
                    type="tel"
                    className="field-input"
                    placeholder="e.g. 9845012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Role / Access Level</label>
                  <select
                    className="field-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="noc">NOC Engineer (Coordinates with FE, claims & updates sites)</option>
                    <option value="admin">Administrator (Full Access & User Management)</option>
                  </select>
                </div>
              </div>

              <div className="user-form-actions">
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating NOC Account...' : '＋ Create & Authorize NOC Account'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowAddForm(false)}
                >
                  Close
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Modal / Row Inline Card */}
          {resetUserId && (
            <div className="password-reset-box">
              <div className="reset-box-header">
                <strong>🔑 Change Password for User:</strong>
                <span className="reset-uname">{users.find(u => u.id === resetUserId)?.username}</span>
              </div>
              <div className="reset-box-controls">
                <input
                  type="text"
                  className="field-input reset-input"
                  placeholder="Enter new password"
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="save-btn-sm"
                  onClick={() => handleResetPassword(resetUserId, users.find(u => u.id === resetUserId)?.username)}
                  disabled={isResetting}
                >
                  {isResetting ? 'Saving...' : 'Save New Password'}
                </button>
                <button
                  type="button"
                  className="cancel-btn-sm"
                  onClick={() => { setResetUserId(null); setResetNewPass(''); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* User List Table */}
          <div className="users-table-header-row">
            <h4>Authorized System Accounts ({users.length})</h4>
          </div>

          {isLoading ? (
            <div className="loading-box">Loading users...</div>
          ) : (
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Full Name</th>
                    <th>Contact Phone</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'center' }}>Password / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.username}</strong>
                      </td>
                      <td>{u.name || '—'}</td>
                      <td>{u.phone || '—'}</td>
                      <td>
                        <span className={`role-chip ${u.role === 'admin' ? 'admin' : 'noc'}`}>
                          {u.role === 'admin' ? 'Administrator' : 'NOC Engineer'}
                        </span>
                      </td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="action-link-btn"
                          style={{ marginRight: '10px' }}
                          onClick={() => {
                            setResetUserId(u.id);
                            setResetNewPass('');
                          }}
                          title="Set or reset password for this user"
                        >
                          🔑 Set Password
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            className="danger-text-btn"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            title="Delete user account"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
