import React, { useState, useMemo } from 'react';

export default function ArchivedRecordsView({
  archivedRecords = [],
  currentUser,
  onAddArchive,
  onDeleteArchive,
  onNotify
}) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New archive form state
  const [newEntry, setNewEntry] = useState({
    dpCode: '',
    completedBy: currentUser?.name || currentUser?.username || '',
    kind: 'Branch',
    atmId: '',
    provider: 'Uniserved',
    deviceSerial: '',
    notes: '',
    completedAt: new Date().toISOString().slice(0, 10)
  });

  const [formError, setFormError] = useState('');

  const role = (currentUser?.role || '').toLowerCase();
  const isAdminOrPM = role === 'admin' || role === 'pm' || (currentUser?.username || '').toLowerCase().includes('admin');

  // Filtered list
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return archivedRecords.filter(r => {
      if (kindFilter !== 'All' && r.kind !== kindFilter) return false;
      if (providerFilter !== 'All' && r.provider !== providerFilter) return false;
      if (q) {
        const text = `${r.dpCode || ''} ${r.atmId || ''} ${r.completedBy || ''} ${r.deviceSerial || ''} ${r.notes || ''}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [archivedRecords, search, kindFilter, providerFilter]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newEntry.dpCode.trim()) {
      setFormError('Branch DP Code is required.');
      return;
    }
    if (!newEntry.completedBy.trim()) {
      setFormError('Completed by (handler name) is required.');
      return;
    }

    try {
      if (onAddArchive) {
        await onAddArchive(newEntry);
      }
      setIsAddModalOpen(false);
      setNewEntry({
        dpCode: '',
        completedBy: currentUser?.name || currentUser?.username || '',
        kind: 'Branch',
        atmId: '',
        provider: 'Uniserved',
        deviceSerial: '',
        notes: '',
        completedAt: new Date().toISOString().slice(0, 10)
      });
      setFormError('');
      if (onNotify) onNotify(`Archived record for ${newEntry.dpCode} saved successfully!`);
    } catch (err) {
      setFormError(err.message || 'Failed to create archive record');
    }
  };

  return (
    <div className="archived-section-wrapper">
      {/* Archive Header Banner */}
      <div className="archived-banner">
        <div className="archived-banner-content">
          <span className="archived-banner-icon">📦</span>
          <div>
            <h3>Archived Deployment Records</h3>
            <p>
              Minimal historical repository of completed deployments. Stores essential completion reference without confidential IP addresses, circuits, or technical network details.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="add-archive-btn"
          onClick={() => {
            setFormError('');
            setIsAddModalOpen(true);
          }}
        >
          ＋ Add Archived Record
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="archived-toolbar">
        <div className="archived-search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search archived DP, handler, S/N, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          )}
        </div>

        <div className="archived-filter-group">
          {/* Kind Filter */}
          <select
            className="filter-dropdown"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
          >
            <option value="All">Type: All Sites</option>
            <option value="Branch">🏢 Branch Only</option>
            <option value="ATM">🏧 ATM Only</option>
          </select>

          {/* Provider Filter */}
          <select
            className="filter-dropdown"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            <option value="All">Provider: All</option>
            <option value="Uniserved">🏢 Uniserved</option>
            <option value="Sify">🏢 Sify</option>
          </select>
        </div>
      </div>

      {/* Records Table / Grid */}
      {filteredList.length > 0 ? (
        <div className="archived-records-table-wrap">
          <table className="archived-table">
            <thead>
              <tr>
                <th>Site Identifier</th>
                <th>Type</th>
                <th>Provider</th>
                <th>Completed By (NOC Handler)</th>
                <th>Completion Date</th>
                <th>Router S/N</th>
                <th>Historical Remarks</th>
                {isAdminOrPM && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="site-cell">
                      <strong>{r.dpCode}</strong>
                      {r.atmId && <span className="atm-sub-tag">ATM: {r.atmId}</span>}
                    </div>
                  </td>
                  <td>
                    <span className="kind-badge-mini">{r.kind}</span>
                  </td>
                  <td>
                    <span className={`provider-badge-pill ${r.provider === 'Sify' ? 'sify' : 'uniserved'}`}>
                      {r.provider || 'Uniserved'}
                    </span>
                  </td>
                  <td>
                    <div className="handler-cell">
                      👤 <strong>{r.completedBy}</strong>
                    </div>
                  </td>
                  <td>
                    {r.completedAt
                      ? new Date(r.completedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                      : '—'}
                  </td>
                  <td>
                    <code>{r.deviceSerial || '—'}</code>
                  </td>
                  <td className="notes-cell">
                    <span>{r.notes || '—'}</span>
                  </td>
                  {isAdminOrPM && (
                    <td>
                      <button
                        type="button"
                        className="archive-delete-btn"
                        onClick={() => onDeleteArchive && onDeleteArchive(r.id, r.dpCode)}
                        title="Delete archived entry"
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="feed-empty-state">
          <div className="empty-badge-icon">📦</div>
          <h3>No Archived Records Found</h3>
          <p>
            {search
              ? `No archived deployments matched "${search}".`
              : 'There are no deployment records in the historical archive yet. You can manually register past deployments or click "Archive" on any Completed site card.'}
          </p>
          <button
            type="button"
            className="add-site-cta"
            onClick={() => setIsAddModalOpen(true)}
          >
            ＋ Add First Archived Record
          </button>
        </div>
      )}

      {/* Manual Add Archive Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-window archive-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-form-header">
              <div className="header-badge-title">
                <span className="modal-tag">HISTORICAL ARCHIVE</span>
                <h2>Record Minimal Archived Deployment</h2>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setIsAddModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="modal-error-alert">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="archive-form-body">
              <p className="archive-dialog-desc">
                🛡️ This form stores <strong>only essential completion reference</strong>. IP addresses, circuit details, and UAT forms are never collected or stored in the archive.
              </p>

              <div className="form-fields-grid">
                {/* Branch DP Code */}
                <div className="modal-form-field">
                  <label className="field-title required">Branch DP Code</label>
                  <input
                    type="text"
                    className="field-input ip-code primary-highlight-input"
                    placeholder="e.g. DP-4102"
                    value={newEntry.dpCode}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, dpCode: e.target.value }))}
                    autoFocus
                    required
                  />
                </div>

                {/* Completed By Handler */}
                <div className="modal-form-field">
                  <label className="field-title required">Completed By (NOC Handler)</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. Rajesh Sharma"
                    value={newEntry.completedBy}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, completedBy: e.target.value }))}
                    required
                  />
                </div>

                {/* Site Kind */}
                <div className="modal-form-field">
                  <label className="field-title">Deployment Type</label>
                  <select
                    className="field-input"
                    value={newEntry.kind}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, kind: e.target.value }))}
                  >
                    <option value="Branch">🏢 Branch Router</option>
                    <option value="ATM">🏧 ATM Terminal</option>
                  </select>
                </div>

                {/* ATM ID if applicable */}
                {newEntry.kind === 'ATM' && (
                  <div className="modal-form-field">
                    <label className="field-title">ATM Terminal ID</label>
                    <input
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. ATM-CN-9921"
                      value={newEntry.atmId}
                      onChange={(e) => setNewEntry(prev => ({ ...prev, atmId: e.target.value }))}
                    />
                  </div>
                )}

                {/* Provider Selection */}
                <div className="modal-form-field">
                  <label className="field-title required">Deployment Provider</label>
                  <div className="choice-pills-row">
                    {['Uniserved', 'Sify'].map(pvd => (
                      <label key={pvd} className={`choice-radio-pill ${newEntry.provider === pvd ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="archiveProvider"
                          value={pvd}
                          checked={newEntry.provider === pvd}
                          onChange={() => setNewEntry(prev => ({ ...prev, provider: pvd }))}
                        />
                        <span>🏢 {pvd}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Router Serial */}
                <div className="modal-form-field">
                  <label className="field-title">Router Serial Number <span className="field-hint">(Optional)</span></label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. CN-SDWAN-994821"
                    value={newEntry.deviceSerial}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, deviceSerial: e.target.value }))}
                  />
                </div>

                {/* Completion Date */}
                <div className="modal-form-field">
                  <label className="field-title">Completion Date</label>
                  <input
                    type="date"
                    className="field-input"
                    value={newEntry.completedAt}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, completedAt: e.target.value }))}
                  />
                </div>

                {/* Historical Notes */}
                <div className="modal-form-field full">
                  <label className="field-title">Historical Remarks / Reference <span className="field-hint">(Optional)</span></label>
                  <textarea
                    className="field-input"
                    rows="3"
                    placeholder="e.g. Completed during Q1 rollout, decommissioned old 1921 Cisco router, signed off by branch manager."
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-form-footer">
                <button type="submit" className="save-btn primary-btn">
                  ✓ Save to Historic Archive
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
