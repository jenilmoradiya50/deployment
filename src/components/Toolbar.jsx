import React from 'react';

export default function Toolbar({
  activeView = 'my-pending',
  onViewChange,
  viewCounts = { myPending: 0, completed: 0, unassignedPending: 0, all: 0 },
  kind = 'All',
  onKindChange,
  totalCount = 0,
  branchCount = 0,
  atmCount = 0,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  ownershipFilter,
  onOwnershipFilterChange,
  users = [],
  onAddNew,
  canManageUsers = false,
  onOpenUserManagement
}) {
  return (
    <div className="toolbar-wrapper">
      {/* 1. Primary Dashboard View Navigation Tabs */}
      <div className="dashboard-view-tabs" role="tablist">
        <button
          type="button"
          className={`view-tab-btn ${activeView === 'my-pending' ? 'active' : ''}`}
          onClick={() => onViewChange && onViewChange('my-pending')}
          title="Sites assigned to you that are pending or in progress"
        >
          <span className="tab-icon">📌</span>
          <span className="tab-label">My Pending Sites</span>
          <span className="view-tab-badge">{viewCounts.myPending}</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeView === 'completed' ? 'active' : ''}`}
          onClick={() => onViewChange && onViewChange('completed')}
          title="View completed deployments"
        >
          <span className="tab-icon">✅</span>
          <span className="tab-label">Completed Sites</span>
          <span className="view-tab-badge">{viewCounts.completed}</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeView === 'unassigned' ? 'active' : ''}`}
          onClick={() => onViewChange && onViewChange('unassigned')}
          title="Open pool of unassigned pending sites waiting for a NOC engineer to claim"
        >
          <span className="tab-icon">🌐</span>
          <span className="tab-label">Open Pool (Unassigned)</span>
          <span className="view-tab-badge unassigned-badge">{viewCounts.unassignedPending}</span>
        </button>

        <button
          type="button"
          className={`view-tab-btn ${activeView === 'all' ? 'active' : ''}`}
          onClick={() => onViewChange && onViewChange('all')}
          title="View all team deployments with user & status filters"
        >
          <span className="tab-icon">👥</span>
          <span className="tab-label">All Sites & Team</span>
          <span className="view-tab-badge">{viewCounts.all}</span>
        </button>
      </div>

      {/* 2. Controls & Search Row */}
      <div className="toolbar-container">
        {/* Segmented Switcher (Mixed All Sites, Branch, ATM) */}
        <div className="segmented-tabs" role="tablist">
          <button
            type="button"
            className={`segment-btn ${kind === 'All' ? 'active' : ''}`}
            onClick={() => onKindChange('All')}
            title="Show both Branch Routers & ATM Terminals combined"
          >
            <span>🌐 All</span>
            <span className="segment-count">{totalCount}</span>
          </button>

          <button
            type="button"
            className={`segment-btn ${kind === 'Branch' ? 'active' : ''}`}
            onClick={() => onKindChange('Branch')}
            title="Filter only Branch Routers"
          >
            <span>🏢 Branches</span>
            <span className="segment-count">{branchCount}</span>
          </button>

          <button
            type="button"
            className={`segment-btn ${kind === 'ATM' ? 'active' : ''}`}
            onClick={() => onKindChange('ATM')}
            title="Filter only ATM Terminals"
          >
            <span>🏧 ATMs</span>
            <span className="segment-count">{atmCount}</span>
          </button>
        </div>

        {/* Controls & Search */}
        <div className="toolbar-actions">
          <div className="search-field">
            <svg className="search-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search DP, ATM ID, FE, IP, S/N..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => onSearchChange('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Show full status and owner filters when on All Sites tab */}
          {activeView === 'all' && (
            <>
              {/* Status Filter */}
              <select
                className="filter-dropdown status-filter-dropdown"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value)}
                aria-label="Filter by Deployment Status"
              >
                <option value="all">Status: All</option>
                <option value="pending">⏳ Pending Queue</option>
                <option value="completed">🟢 Completed</option>
                <option value="onHold">🟡 On Hold</option>
                <option value="failed">🔴 Failed / Issues</option>
              </select>

              {/* Ownership & Specific User Filter */}
              <select
                className="filter-dropdown"
                value={ownershipFilter}
                onChange={(e) => onOwnershipFilterChange(e.target.value)}
                aria-label="Filter by Site Assignment"
              >
                <option value="all">Site Owner: All Team</option>
                <option value="mine">📌 My Taken Sites</option>
                <option value="unassigned">⚪ Unassigned / Available</option>
                {users && users.length > 0 && (
                  <optgroup label="Select Specific NOC / User:">
                    {users.map(u => (
                      <option key={u.id || u.username} value={`user:${u.username}`}>
                        👤 {u.name ? `${u.name} (${u.username})` : u.username}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </>
          )}

          {/* Add Deployment Button */}
          <button
            type="button"
            className="add-primary-btn"
            onClick={onAddNew}
            title="Add a new Branch or ATM site deployment"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            ＋ Add Deployment
          </button>

          {canManageUsers && (
            <button
              type="button"
              className="toolbar-add-user-btn"
              onClick={onOpenUserManagement}
              title="Create or Manage Team Accounts and Passwords"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <line x1="19" y1="8" x2="19" y2="14"></line>
                <line x1="22" y1="11" x2="16" y2="11"></line>
              </svg>
              👥 Manage Users
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
