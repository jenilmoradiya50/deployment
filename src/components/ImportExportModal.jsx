import React, { useState } from 'react';

export default function ImportExportModal({
  isOpen,
  onClose,
  records = [],
  users = [],
  currentKind,
  onExportFilteredCSV,
  onExportAllJSON
}) {
  const [filterKind, setFilterKind] = useState('All');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  if (!isOpen) return null;

  // Compute matched records count based on export filters
  const matchedRecords = records.filter(r => {
    if (filterKind !== 'All' && r.kind !== filterKind) return false;
    if (filterStatus === 'working' && r.working !== 'Yes') return false;
    if (filterStatus === 'notWorking' && r.working !== 'No') return false;
    if (filterStatus === 'pending' && (r.working === 'Yes' || r.working === 'No')) return false;
    if (filterUser !== 'all' && (r.claimedBy || '').toLowerCase() !== filterUser.toLowerCase()) return false;
    return true;
  });

  const handleDownloadCSV = () => {
    if (onExportFilteredCSV) {
      onExportFilteredCSV(matchedRecords, { filterKind, filterStatus, filterUser });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window import-export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-form-header">
          <div className="header-badge-title">
            <span className="modal-tag">PM & ADMIN REPORTING</span>
            <h2>Export Database Records (Excel / CSV)</h2>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form-scrollable">
          <p className="tab-description">
            Generate custom Excel-compatible CSV reports with dedicated filters for Project Managers, NOC leads, and Auditors.
          </p>

          {/* Filter Configuration Card */}
          <div className="export-filter-box">
            <h4>🎯 Custom Report Filters</h4>
            <div className="export-filter-grid">
              <div className="modal-form-field">
                <label className="field-title">Site Type</label>
                <select
                  className="field-input"
                  value={filterKind}
                  onChange={(e) => setFilterKind(e.target.value)}
                >
                  <option value="All">All Types (Branch & ATM)</option>
                  <option value="Branch">Branches Only</option>
                  <option value="ATM">ATMs Only</option>
                </select>
              </div>

              <div className="modal-form-field">
                <label className="field-title">Working Status</label>
                <select
                  className="field-input"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="working">🟢 Working Only</option>
                  <option value="notWorking">🔴 Not Working Only</option>
                  <option value="pending">⏳ Pending Verification</option>
                </select>
              </div>

              <div className="modal-form-field">
                <label className="field-title">Assigned NOC / User</label>
                <select
                  className="field-input"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                >
                  <option value="all">All Users / Claimants</option>
                  {users.map(u => (
                    <option key={u.id || u.username} value={u.username}>
                      👤 {u.name ? `${u.name} (${u.username})` : u.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-summary-row">
              <span className="matched-counter">
                Matched <strong>{matchedRecords.length}</strong> of {records.length} total deployments
              </span>
              <button
                type="button"
                className="save-btn"
                onClick={handleDownloadCSV}
                disabled={matchedRecords.length === 0}
              >
                📊 Download Filtered CSV ({matchedRecords.length})
              </button>
            </div>
          </div>

          <div className="export-options-grid" style={{ marginTop: '20px' }}>
            <div className="export-option-card">
              <div className="export-option-icon">📦</div>
              <div className="export-option-text">
                <strong>Export Complete Raw Database (JSON)</strong>
                <span>Full backup of all records ({records.length} total) for system migration or archiving.</span>
              </div>
              <button type="button" className="cancel-btn" onClick={onExportAllJSON}>
                Download JSON
              </button>
            </div>
          </div>
        </div>

        <div className="modal-form-footer">
          <button type="button" className="cancel-btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
