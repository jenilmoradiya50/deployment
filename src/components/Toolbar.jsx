import React from 'react';

export default function Toolbar({
  kind,
  onKindChange,
  branchCount,
  atmCount,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  ispFilter,
  onIspFilterChange,
  onAddNew
}) {
  return (
    <div className="toolbar-container">
      {/* Segmented Switcher */}
      <div className="segmented-tabs" role="tablist">
        <button
          type="button"
          className={`segment-btn ${kind === 'Branch' ? 'active' : ''}`}
          onClick={() => onKindChange('Branch')}
        >
          <span>Branch Routers</span>
          <span className="segment-count">{branchCount}</span>
        </button>

        <button
          type="button"
          className={`segment-btn ${kind === 'ATM' ? 'active' : ''}`}
          onClick={() => onKindChange('ATM')}
        >
          <span>ATM Terminals</span>
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
            placeholder="Search DP code, ATM ID, IP, or Gateway..."
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

        <select
          className="filter-dropdown"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          aria-label="Filter by Working Status"
        >
          <option value="all">Working Status: All</option>
          <option value="working">🟢 Marked Working</option>
          <option value="notWorking">🔴 Not Working</option>
          <option value="pending">⏳ Pending Confirmation</option>
        </select>

        <select
          className="filter-dropdown"
          value={ispFilter}
          onChange={(e) => onIspFilterChange(e.target.value)}
          aria-label="Filter by ISP Circuit"
        >
          <option value="all">ISP Filter: All</option>
          <option value="bsnlOk">BSNL Ping OK</option>
          <option value="jioOk">Jio Ping OK</option>
          <option value="airtelOk">Airtel Ping OK</option>
        </select>

        <button
          type="button"
          className="add-primary-btn"
          onClick={onAddNew}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add {kind}
        </button>
      </div>
    </div>
  );
}
