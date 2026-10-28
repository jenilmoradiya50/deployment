import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function UserManagementModal({ isOpen, onClose, onNotify }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('field_engineer');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      if (onNotify) onNotify(`User "${username}" created successfully!`);
      setUsername('');
      setPassword('');
      setName('');
      setPhone('');
      setShowAddForm(false);
      await fetchUsers();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userUname) => {
    if (!confirm(`Are you sure you want to delete user account "${userUname}"?`)) return;

    try {
      await api.deleteUser(userId);
      if (onNotify) onNotify(`User "${userUname}" removed.`);
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
            <h2>Field Engineer & User Management</h2>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form-scrollable">
          <div className="user-mgmt-top-bar">
            <div>
              <h3>System Users ({users.length})</h3>
              <p className="sub-text">Authorize Field Engineers and Staff to access and claim sites.</p>
            </div>
            <button
              type="button"
              className="primary-btn-sm"
              onClick={() => { setShowAddForm(!showAddForm); setErrorMsg(''); }}
            >
              {showAddForm ? '✕ Close Form' : '＋ Add New User'}
            </button>
          </div>

          {/* Create User Form */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="add-user-card">
              <h4>Create New User Account</h4>
              {errorMsg && <div className="modal-error-alert">{errorMsg}</div>}

              <div className="user-form-grid">
                <div className="modal-form-field">
                  <label className="field-title required">Username *</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. FE_Ramesh"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title required">Password *</label>
                  <input
                    type="password"
                    className="field-input"
                    placeholder="Set user password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Full Name</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Mobile Number</label>
                  <input
                    type="tel"
                    className="field-input"
                    placeholder="e.g. 9845012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="modal-form-field">
                  <label className="field-title">Role</label>
                  <select
                    className="field-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="field_engineer">Field Engineer (Can take & update sites)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>
              </div>

              <div className="user-form-actions">
                <button type="submit" className="save-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* User List Table */}
          {isLoading ? (
            <div className="loading-box">Loading users...</div>
          ) : (
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Full Name</th>
                    <th>Contact Phone</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Action</th>
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
                        <span className={`role-chip ${u.role === 'admin' ? 'admin' : 'fe'}`}>
                          {u.role === 'admin' ? 'Admin' : 'Field Engineer'}
                        </span>
                      </td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td>
                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            className="danger-text-btn"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                          >
                            Delete
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
