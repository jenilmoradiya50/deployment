import React, { useState } from 'react';

export default function ImportExportModal({
  isOpen,
  onClose,
  records,
  currentKind,
  onExportCurrent,
  onExportAll,
  onExportCSV
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window import-export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-form-header">
          <div className="header-badge-title">
            <span className="modal-tag">BACKUP & REPORTING</span>
            <h2>Export Database Records</h2>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form-scrollable">
          <p className="tab-description">
            Download an offline backup of all registered Branch and ATM site deployments. CSV exports are fully compatible with Microsoft Excel and Google Sheets.
          </p>

          <div className="export-options-grid">
            <div className="export-option-card">
              <div className="export-option-icon">📊</div>
              <div className="export-option-text">
                <strong>Export Spreadsheet (CSV for Excel)</strong>
                <span>All columns: FE details, UAT status, VLAN, Secondary IPs, Device serials, and ISP ping health.</span>
              </div>
              <button type="button" className="save-btn" onClick={onExportCSV}>
                Download CSV
              </button>
            </div>

            <div className="export-option-card">
              <div className="export-option-icon">📄</div>
              <div className="export-option-text">
                <strong>Export {currentKind} Sites Only (JSON)</strong>
                <span>Downloads all active {currentKind.toLowerCase()} site records ({records.filter(r => r.kind === currentKind).length} sites).</span>
              </div>
              <button type="button" className="cancel-btn" onClick={onExportCurrent}>
                Download JSON
              </button>
            </div>

            <div className="export-option-card">
              <div className="export-option-icon">📦</div>
              <div className="export-option-text">
                <strong>Export Complete Database (JSON)</strong>
                <span>Full database export of all Branch routers and ATM terminals ({records.length} total).</span>
              </div>
              <button type="button" className="cancel-btn" onClick={onExportAll}>
                Download Full JSON
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
