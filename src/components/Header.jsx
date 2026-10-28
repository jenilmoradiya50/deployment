import React from 'react';

export default function Header({
  currentUser,
  dbStatus,
  onOpenImportExport,
  onOpenUserManagement,
  onQuickBackup,
  onLogout
}) {
  const isPostgres = dbStatus?.type === 'postgresql';
  const username = currentUser?.username || 'Admin@Canara';
  const userRole = (currentUser?.role || 'admin').toLowerCase();
  const isAdmin = userRole === 'admin' || username.toLowerCase().includes('admin');
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-branding">
          <div className="logo-container">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5dade2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            <div className="brand-text">
              <h1>Canara Bank SD-WAN Tracker</h1>
              <p>Branch & ATM Infrastructure Deployment & ISP Operations</p>
            </div>
          </div>

          <div className="db-indicator-chip" title={isPostgres ? 'Connected to Cloud PostgreSQL' : 'Using Session In-Memory Storage'}>
            <span className={`status-pulse ${isPostgres ? 'mongo' : 'local'}`}></span>
            <span className="db-text">
              {isPostgres ? 'PostgreSQL Cloud DB Active' : 'SQL Engine Active'}
            </span>
          </div>
        </div>

        <div className="header-actions">
          {isAdmin && (
            <button
              type="button"
              className="header-btn admin-highlight"
              onClick={onOpenUserManagement}
              title="Manage NOC Engineers and Admin Users"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <line x1="19" y1="8" x2="19" y2="14"></line>
                <line x1="22" y1="11" x2="16" y2="11"></line>
              </svg>
              👥 Manage NOC Users
            </button>
          )}

          <button
            type="button"
            className="header-btn"
            onClick={onQuickBackup}
            title="Download full JSON database backup"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Quick Backup
          </button>

          <button
            type="button"
            className="header-btn"
            onClick={onOpenImportExport}
            title="Export CSV for Excel or JSON"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Export CSV / JSON
          </button>

          {/* User Profile & Logout */}
          <div className="user-profile-badge">
            <div className="user-avatar" title={`Logged in as ${username}`}>
              {initials}
            </div>
            <div className="user-details">
              <span className="user-name">{currentUser?.name || username}</span>
              <span className="user-role-pill">{isAdmin ? 'ADMIN' : 'NOC'}</span>
            </div>
            <button
              type="button"
              className="logout-btn"
              onClick={onLogout}
              title="Sign Out"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Exit
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
