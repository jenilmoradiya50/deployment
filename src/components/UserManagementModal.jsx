import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function UserManagementModal({ isOpen, onClose, onNotify, currentUser }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(true);

  const isFullAdmin = (currentUser?.role || '').toLowerCase() === 'admin' || (currentUser?.username || '').toLowerCase().includes('admin');
  const isPM = (currentUser?.role || '').toLowerCase() === 'pm';

  // New user form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('noc');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('noc');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
      setEditingUser(null);
      setResetUserId(null);
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
        role: isPM ? 'noc' : role
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

  const handleStartEdit = (user) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setEditRole(user.role || 'noc');
    setResetUserId(null);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingEdit(true);

    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim()
      };
      if (isFullAdmin) {
        payload.role = editRole;
      }

      await api.updateUser(editingUser.id, payload);
      if (onNotify) onNotify(`User "${editingUser.username}" updated successfully!`);
      setEditingUser(null);
      await fetchUsers();
    } catch (err) {
      if (onNotify) onNotify(err.message || 'Failed to update user', 'error');
    } finally {
      setIsSavingEdit(false);
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
            <span className="modal-tag">{isFullAdmin ? 'ADMINISTRATION' : 'PROJECT MANAGEMENT'}</span>
            <h2>Team & User Access Management</h2>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form-scrollable">
          {/* Top Bar with Add User Toggle */}
          <div className="user-mgmt-top-bar">
            <div>
              <h3>👥 System Accounts ({users.length})</h3>
              <p className="sub-text">
                {isFullAdmin
                  ? 'Manage Administrator, Project Manager (PM), and NOC Engineer access and roles.'
                  : 'Add and manage NOC Engineers (on-site Field Engineers coordinate directly with NOC).'}
              </p>
            </div>
            <button
              type="button"
              className="primary-btn-sm"
              onClick={() => { setShowAddForm(!showAddForm); setEditingUser(null); setErrorMsg(''); }}
            >
              {showAddForm ? '▲ Hide Add Form' : '＋ Add User Account'}
            </button>
          </div>

          {/* Edit User Form Card */}
          {editingUser && (
            <form onSubmit={handleSaveEdit} className="add-user-card edit-user-highlight">
              <div className="add-user-card-header">
                <h4>✏️ Edit Account: {editingUser.username}</h4>
                <span className="card-badge-info">Update name, contact phone, and system role</span>
              </div>

              <div className="user-form-grid">
                <div className="modal-form-field">
                  <label className="field-title">Username</label>
                  <input
                    type="text"
                    className="field-input"
                    value={editingUser.username}
                    disabled
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Full Name</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="Full name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Contact Phone</label>
                  <input
                    type="tel"
                    className="field-input"
                    placeholder="Contact number"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">User Role</label>
                  {isFullAdmin ? (
                    <select
                      className="field-input"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                    >
                      <option value="noc">NOC Engineer (Site deployment & operations)</option>
                      <option value="pm">Project Manager (PM - Reports, NOC oversight)</option>
                      <option value="admin">Administrator (Full System Control)</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="field-input"
                      value={editingUser.role === 'admin' ? 'Administrator' : editingUser.role === 'pm' ? 'Project Manager' : 'NOC Engineer'}
                      disabled
                    />
                  )}
                </div>
              </div>

              <div className="user-form-actions">
                <button type="submit" className="save-btn" disabled={isSavingEdit}>
                  {isSavingEdit ? 'Saving...' : 'Save User Updates'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Create User Form */}
          {showAddForm && !editingUser && (
            <form onSubmit={handleCreateUser} className="add-user-card">
              <div className="add-user-card-header">
                <h4>➕ Create New User Account</h4>
                <span className="card-badge-info">Set username & password for team member</span>
              </div>
              {errorMsg && <div className="modal-error-alert">{errorMsg}</div>}

              <div className="user-form-grid">
                <div className="modal-form-field">
                  <label className="field-title required">Username *</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. NOC_Ramesh or PM_Sharma"
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
                  {isFullAdmin ? (
                    <select
                      className="field-input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="noc">NOC Engineer (Site deployment & operations)</option>
                      <option value="pm">Project Manager (PM - Reports & NOC oversight)</option>
                      <option value="admin">Administrator (Full Access & User Management)</option>
                    </select>
                  ) : (
                    <select
                      className="field-input"
                      value={role}
                      disabled
                    >
                      <option value="noc">NOC Engineer (Operations)</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="user-form-actions">
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating Account...' : '＋ Create & Authorize Account'}
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
            <h4>Authorized Accounts ({users.length})</h4>
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
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const uRole = (u.role || 'noc').toLowerCase();
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.username}</strong>
                        </td>
                        <td>{u.name || '—'}</td>
                        <td>{u.phone || '—'}</td>
                        <td>
                          <span className={`role-chip ${uRole === 'admin' ? 'admin' : uRole === 'pm' ? 'pm' : 'noc'}`}>
                            {uRole === 'admin' ? 'Administrator' : uRole === 'pm' ? 'Project Manager' : 'NOC Engineer'}
                          </span>
                        </td>
                        <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="action-link-btn"
                            style={{ marginRight: '8px' }}
                            onClick={() => handleStartEdit(u)}
                            title="Edit user details and role"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="action-link-btn"
                            style={{ marginRight: '8px' }}
                            onClick={() => {
                              setResetUserId(u.id);
                              setResetNewPass('');
                              setEditingUser(null);
                            }}
                            title="Set or reset password for this user"
                          >
                            🔑 Password
                          </button>
                          {isFullAdmin && u.id !== currentUser?.id && (
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
