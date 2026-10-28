import React, { useState, useRef } from 'react';

export default function ImportExportModal({
  isOpen,
  onClose,
  records,
  currentKind,
  onImport,
  onExportCurrent,
  onExportAll,
  onExportCSV
}) {
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
  const [importMode, setImportMode] = useState('append'); // 'append' | 'replace'
  const [importFile, setImportFile] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setSuccessMsg('');
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (Array.isArray(parsed)) {
          setPreviewCount(parsed.length);
        } else if (parsed && typeof parsed === 'object') {
          // single record object wrapped
          setPreviewCount(1);
        } else {
          setErrorMsg('Invalid JSON format: Must be an array of records or a record object.');
          setImportFile(null);
        }
      } catch (err) {
        setErrorMsg('Error parsing JSON file: ' + err.message);
        setImportFile(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!importFile) {
      setErrorMsg('Please select a JSON file to import.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let parsed = JSON.parse(event.target.result);
        if (!Array.isArray(parsed)) {
          parsed = [parsed];
        }
        await onImport(parsed, importMode);
        setSuccessMsg(`Successfully imported ${parsed.length} records!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch (err) {
        setErrorMsg('Failed to process import: ' + err.message);
      }
    };
    reader.readAsText(importFile);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content import-export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Data Management & Backup</h2>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => { setActiveTab('export'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Export Backup
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => { setActiveTab('import'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Import JSON Data
          </button>
        </div>

        <div className="modal-tab-body">
          {errorMsg && <div className="form-error-banner">⚠️ {errorMsg}</div>}
          {successMsg && <div className="form-success-banner">✓ {successMsg}</div>}

          {activeTab === 'export' && (
            <div className="export-panel">
              <p className="tab-description">
                Download a clean copy of your work records. Backups can be restored at any time or imported into other tools.
              </p>

              <div className="export-options-grid">
                <div className="export-option-card">
                  <div className="export-option-icon">📄</div>
                  <div className="export-option-text">
                    <strong>Export {currentKind} Records (JSON)</strong>
                    <span>Downloads all {currentKind.toLowerCase()} records only ({records.filter(r => r.kind === currentKind).length} records).</span>
                  </div>
                  <button type="button" className="secondary-btn" onClick={onExportCurrent}>
                    Download JSON
                  </button>
                </div>

                <div className="export-option-card">
                  <div className="export-option-icon">📦</div>
                  <div className="export-option-text">
                    <strong>Export Entire Database (JSON)</strong>
                    <span>Complete backup of all Branch and ATM records ({records.length} total).</span>
                  </div>
                  <button type="button" className="primary-btn" onClick={onExportAll}>
                    Download Full JSON
                  </button>
                </div>

                <div className="export-option-card">
                  <div className="export-option-icon">📊</div>
                  <div className="export-option-text">
                    <strong>Export as Spreadsheet (CSV)</strong>
                    <span>Exports all columns and records compatible with Excel and Google Sheets.</span>
                  </div>
                  <button type="button" className="secondary-btn" onClick={onExportCSV}>
                    Download CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="import-panel">
              <p className="tab-description">
                Upload a previously exported JSON backup file to restore or add records.
              </p>

              <div className="file-drop-area" onClick={() => fileInputRef.current?.click()}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="drop-icon">📥</div>
                <strong>{importFile ? importFile.name : 'Click to select JSON backup file'}</strong>
                <span className="drop-sub">
                  {previewCount !== null
                    ? `Found ${previewCount} record(s) ready to import`
                    : 'Supports JSON arrays exported from this tracker'}
                </span>
              </div>

              <div className="import-mode-selection">
                <label className="mode-label">Import Strategy:</label>
                <div className="radio-group">
                  <label className="radio-choice">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                    />
                    <span>Merge / Append (Preserves existing, updates matching IDs)</span>
                  </label>
                  <label className="radio-choice">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                    />
                    <span>Replace All (Overwrites current database with imported file)</span>
                  </label>
                </div>
              </div>

              <div className="import-actions">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={!importFile}
                  onClick={handleExecuteImport}
                >
                  Confirm & Import Records
                </button>
                <button type="button" className="secondary-btn" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
