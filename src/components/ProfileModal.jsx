import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function ProfileModal({ isOpen, onClose, currentUser, onProfileUpdated, onNotify }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setPassword('');
      setConfirmPassword('');
      setErrorMsg('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password && password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim() || currentUser.username,
        phone: phone.trim()
      };
      if (password.trim()) {
        payload.password = password.trim();
      }

      const res = await api.updateProfile(payload);
      if (onProfileUpdated) {
        onProfileUpdated(res.user);
      }
      if (onNotify) {
        onNotify('Your profile has been updated successfully!');
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const userRole = (currentUser.role || 'noc').toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-form-header">
          <div className="header-badge-title">
            <span className="modal-tag">MY ACCOUNT</span>
            <h2>User Profile & Security</h2>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-scrollable">
          <div className="profile-hero-card">
            <div className="profile-avatar-lg">
              {(currentUser.username || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div className="profile-hero-info">
              <h3>{currentUser.name || currentUser.username}</h3>
              <div className="profile-hero-meta">
                <span className="meta-uname">@{currentUser.username}</span>
                <span className={`role-chip ${currentUser.role === 'admin' ? 'admin' : currentUser.role === 'pm' ? 'pm' : 'noc'}`}>
                  {userRole}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && <div className="modal-error-alert">{errorMsg}</div>}

          <div className="profile-form-grid">
            <div className="modal-form-field">
              <label className="field-title">Full Name</label>
              <input
                type="text"
                className="field-input"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
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
              <label className="field-title">New Password (Leave blank to keep current)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="field-input"
                  style={{ paddingRight: '40px' }}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                  onClick={() => setShowPass(!showPass)}
                  title={showPass ? 'Hide' : 'Show'}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {password && (
              <div className="modal-form-field">
                <label className="field-title">Confirm New Password</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="field-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="modal-footer-actions">
            <button type="submit" className="save-btn" disabled={isSaving}>
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
