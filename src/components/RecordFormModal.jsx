import React, { useState, useEffect } from 'react';

export default function RecordFormModal({ kind = 'Branch', recordToEdit, currentUser, users = [], records = [], onSave, onClose }) {
  const isEditing = Boolean(recordToEdit && recordToEdit.id);
  const [isQuickAdd, setIsQuickAdd] = useState(!isEditing);
  const [formData, setFormData] = useState({});
  const [secondaryIps, setSecondaryIps] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentKind = formData.kind || (recordToEdit ? recordToEdit.kind : (kind === 'All' ? 'Branch' : kind));
  const isBranch = currentKind === 'Branch';

  useEffect(() => {
    if (recordToEdit) {
      const hasBsnlIp = Boolean((recordToEdit.bsnlIp && recordToEdit.bsnlIp.trim()) || (recordToEdit.bsnlGateway && recordToEdit.bsnlGateway.trim()));
      const hasJioIp = Boolean((recordToEdit.jioIp && recordToEdit.jioIp.trim()) || (recordToEdit.jioGateway && recordToEdit.jioGateway.trim()));
      const hasAirtelIp = Boolean(
        (recordToEdit.airtelIp && recordToEdit.airtelIp.trim()) ||
        (recordToEdit.airtelGateway && recordToEdit.airtelGateway.trim()) ||
        (recordToEdit.airtelLoopbackIp && recordToEdit.airtelLoopbackIp.trim()) ||
        recordToEdit.airtelIs4G === 'Yes'
      );

      setFormData({
        ...recordToEdit,
        deploymentStatus: recordToEdit.deploymentStatus || (recordToEdit.working === 'Yes' ? 'Completed' : (recordToEdit.working === 'No' ? 'Failed' : 'Pending')),
        isDhcp: recordToEdit.isDhcp || 'No',
        bsnlPresent: hasBsnlIp ? (recordToEdit.bsnlPresent || 'Yes') : (recordToEdit.bsnlPresent === 'Yes' ? 'Yes' : 'No'),
        jioPresent: hasJioIp ? (recordToEdit.jioPresent || 'Yes') : (recordToEdit.jioPresent === 'Yes' ? 'Yes' : 'No'),
        airtelPresent: hasAirtelIp ? (recordToEdit.airtelPresent || 'Yes') : (recordToEdit.airtelPresent === 'Yes' ? 'Yes' : 'No'),
        airtelIs4G: recordToEdit.airtelIs4G || 'No',
        airtelLoopbackIp: recordToEdit.airtelLoopbackIp || ''
      });
      setSecondaryIps(
        Array.isArray(recordToEdit.secondaryLanIps)
          ? recordToEdit.secondaryLanIps.map(s => ({
              gateway: s.gateway || s.ip || '',
              ip: s.gateway || s.ip || '',
              prefix: s.prefix || '',
              note: s.note || ''
            }))
          : []
      );
      setIsQuickAdd(false);
    } else {
      const userRole = (currentUser?.role || '').toLowerCase();
      const isPMOrAdmin = userRole === 'pm' || userRole === 'admin' || (currentUser?.username || '').toLowerCase().includes('admin');

      setFormData({
        kind: kind === 'All' ? 'Branch' : kind,
        // For PM & Admin: default to Unassigned so any NOC can claim it
        // For NOC: default to themselves
        claimedBy: isPMOrAdmin ? '' : (currentUser?.username || ''),
        claimedByName: isPMOrAdmin ? '' : (currentUser?.name || currentUser?.username || ''),
        isUnassigned: isPMOrAdmin,
        deploymentStatus: 'Pending',
        isDhcp: 'No',
        bsnlPresent: 'No',
        jioPresent: 'No',
        airtelPresent: 'No',
        airtelIs4G: 'No',
        airtelLoopbackIp: '',
        vlanConfigured: 'No',
        vlanRemoved: 'Not Removed',
        bsnlPing: 'No',
        jioPing: 'No',
        airtelPing: 'No',
        configuration: 'Not completed',
        mpAdded: 'No',
        deviceOnline: 'No',
        mailSent: 'No',
        dcMail: 'Not received',
        drcMail: 'Not received',
        cablesConnected: 'Not connected',
        working: 'No',
        uatSubmitted: 'No'
      });
      setSecondaryIps([]);
      setIsQuickAdd(true);
    }
  }, [recordToEdit, kind, currentUser]);

  const handleChange = (fieldId, val) => {
    setFormData(prev => {
      const next = { ...prev, [fieldId]: val };

      // Auto-toggle ISP Present checkmark based on IP
      if (fieldId === 'bsnlIp' || fieldId === 'bsnlGateway') {
        const bIp = fieldId === 'bsnlIp' ? val : (prev.bsnlIp || '');
        const bGw = fieldId === 'bsnlGateway' ? val : (prev.bsnlGateway || '');
        next.bsnlPresent = (bIp.trim() !== '' || bGw.trim() !== '') ? 'Yes' : 'No';
      }

      if (fieldId === 'jioIp' || fieldId === 'jioGateway') {
        const jIp = fieldId === 'jioIp' ? val : (prev.jioIp || '');
        const jGw = fieldId === 'jioGateway' ? val : (prev.jioGateway || '');
        next.jioPresent = (jIp.trim() !== '' || jGw.trim() !== '') ? 'Yes' : 'No';
      }

      if (fieldId === 'airtelIp' || fieldId === 'airtelGateway' || fieldId === 'airtelLoopbackIp' || fieldId === 'airtelIs4G') {
        const aIp = fieldId === 'airtelIp' ? val : (prev.airtelIp || '');
        const aGw = fieldId === 'airtelGateway' ? val : (prev.airtelGateway || '');
        const aLoop = fieldId === 'airtelLoopbackIp' ? val : (prev.airtelLoopbackIp || '');
        const is4G = fieldId === 'airtelIs4G' ? val : (prev.airtelIs4G || 'No');
        next.airtelPresent = (aIp.trim() !== '' || aGw.trim() !== '' || aLoop.trim() !== '' || is4G === 'Yes') ? 'Yes' : 'No';
      }

      return next;
    });
    if (errorMsg) setErrorMsg('');
  };

  // Secondary LAN Gateway handlers (Limit: 3)
  const handleAddSecondaryIp = () => {
    if (secondaryIps.length >= 3) return;
    setSecondaryIps(prev => [...prev, { gateway: '', ip: '', prefix: '', note: '' }]);
  };

  const handleUpdateSecondaryIp = (index, key, value) => {
    setSecondaryIps(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      if (key === 'gateway') copy[index].ip = value;
      if (key === 'ip') copy[index].gateway = value;
      return copy;
    });
  };

  const handleRemoveSecondaryIp = (index) => {
    setSecondaryIps(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isBranch && (!formData.dpCode || !formData.dpCode.trim())) {
      setErrorMsg('Branch DP code is required.');
      document.getElementById('f_dpCode')?.focus();
      return;
    }

    if (!isBranch) {
      if (!formData.atmId || !formData.atmId.trim()) {
        setErrorMsg('ATM Terminal ID is required.');
        document.getElementById('f_atmId')?.focus();
        return;
      }
      if (!formData.dpCode || !formData.dpCode.trim()) {
        setErrorMsg('Branch Base DP Code is required for ATM.');
        document.getElementById('f_baseDpCode')?.focus();
        return;
      }
    }

    // Stop duplicate entries (Branch DP Code or ATM ID)
    if (isBranch) {
      const cleanDp = (formData.dpCode || '').trim().toLowerCase();
      const duplicateBranch = records.find(r => 
        (r.kind || 'Branch') === 'Branch' &&
        (r.dpCode || '').trim().toLowerCase() === cleanDp &&
        r.id !== recordToEdit?.id
      );
      if (duplicateBranch) {
        setErrorMsg(`Branch DP Code "${formData.dpCode.trim()}" already exists in database (Site: ${duplicateBranch.dpCode}). Duplicate branch entries are not allowed.`);
        document.getElementById('f_dpCode')?.focus();
        return;
      }
    } else {
      const cleanAtm = (formData.atmId || '').trim().toLowerCase();
      const duplicateAtm = records.find(r => 
        r.kind === 'ATM' &&
        (r.atmId || '').trim().toLowerCase() === cleanAtm &&
        r.id !== recordToEdit?.id
      );
      if (duplicateAtm) {
        setErrorMsg(`ATM ID "${formData.atmId.trim()}" already exists in database (Site: ${duplicateAtm.atmId}). Duplicate ATM entries are not allowed.`);
        document.getElementById('f_atmId')?.focus();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Sync working with deploymentStatus
      const status = formData.deploymentStatus || 'Pending';
      const working = status === 'Completed' ? 'Yes' : (status === 'Failed' ? 'No' : 'No');

      await onSave({
        ...formData,
        kind: currentKind,
        deploymentStatus: status,
        working,
        primaryLanGateway: formData.primaryLanGateway || formData.lanGateway || '',
        lanGateway: formData.primaryLanGateway || formData.lanGateway || '',
        secondaryLanIps: secondaryIps
          .filter(s => (s.gateway || s.ip) && (s.gateway || s.ip).trim() !== '')
          .map(s => ({
            gateway: (s.gateway || s.ip).trim(),
            ip: (s.gateway || s.ip).trim(),
            prefix: (s.prefix || '').trim(),
            note: (s.note || '').trim()
          }))
      });
    } catch (err) {
      setErrorMsg(err.message || 'Error saving record');
      setIsSubmitting(false);
    }
  };

  const renderRadioPill = (fieldId, label, options) => {
    const value = formData[fieldId] ?? options[1] ?? 'No';
    return (
      <div key={fieldId} className="modal-form-field">
        <label className="field-title">{label}</label>
        <div className="choice-pills-row">
          {options.map(opt => {
            const isChecked = value === opt;
            return (
              <label
                key={opt}
                className={`choice-radio-pill ${isChecked ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name={fieldId}
                  value={opt}
                  checked={isChecked}
                  onChange={() => handleChange(fieldId, opt)}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay modal-overlay-fullscreen">
      <div className={`modal-window ${isQuickAdd ? 'quick-add-window' : 'record-form-fullscreen'}`} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-header">
            <div className="header-badge-title">
              <span className="modal-tag">
                {isQuickAdd ? 'QUICK REGISTRATION' : `${currentKind.toUpperCase()} SPECIFICATION`}
              </span>
              <h2>
                {isEditing
                  ? `Edit ${currentKind} Deployment`
                  : isQuickAdd
                  ? `Register New ${currentKind} (Move to Pending)`
                  : `Full ${currentKind} Deployment Setup`}
              </h2>
            </div>
            <button
              type="button"
              className="modal-close-button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ✕ Close
            </button>
          </div>

          {errorMsg && (
            <div className="modal-error-alert">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* ==============================================================
              VIEW 1: QUICK ADD VIEW (DP Code, FE Name & Phone -> Pending)
              ============================================================== */}
          {isQuickAdd ? (
            <div className="modal-form-scrollable quick-add-body">
              {/* Deployment Type Selector (Branch vs ATM) */}
              <div className="site-kind-selector-bar">
                <span className="kind-selector-title">Deployment Type:</span>
                <div className="kind-toggle-pills">
                  <button
                    type="button"
                    className={`kind-pill-btn ${isBranch ? 'active' : ''}`}
                    onClick={() => handleChange('kind', 'Branch')}
                  >
                    🏢 Branch Router
                  </button>
                  <button
                    type="button"
                    className={`kind-pill-btn ${!isBranch ? 'active' : ''}`}
                    onClick={() => handleChange('kind', 'ATM')}
                  >
                    🏧 ATM Terminal
                  </button>
                </div>
              </div>

              <div className="quick-add-banner">
                <span className="banner-icon">💡</span>
                <div>
                  <strong>Quick Registration Mode</strong>
                  <p>Register the site code and on-site FE. This deployment will be immediately moved to the <strong>⏳ Pending</strong> queue. All detailed network IPs, VLANs, and ISP parameters can be added separately later.</p>
                </div>
              </div>

              <div className="form-section-card">
                <div className="form-fields-grid">
                  {isBranch ? (
                    <div className="modal-form-field full">
                      <label htmlFor="f_dpCode" className="field-title required">
                        Branch DP Code
                      </label>
                      <input
                        id="f_dpCode"
                        type="text"
                        className="field-input ip-code primary-highlight-input"
                        placeholder="e.g. DP-4102, DP-9821"
                        value={formData.dpCode || ''}
                        onChange={(e) => handleChange('dpCode', e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div className="modal-form-field">
                        <label htmlFor="f_atmId" className="field-title required">
                          ATM Terminal ID
                        </label>
                        <input
                          id="f_atmId"
                          type="text"
                          className="field-input ip-code primary-highlight-input"
                          placeholder="e.g. ATM-CN-9921"
                          value={formData.atmId || ''}
                          onChange={(e) => handleChange('atmId', e.target.value)}
                          autoFocus
                          required
                        />
                      </div>

                      <div className="modal-form-field">
                        <label htmlFor="f_baseDpCode" className="field-title required">
                          Branch Base DP Code
                        </label>
                        <input
                          id="f_baseDpCode"
                          type="text"
                          className="field-input ip-code primary-highlight-input"
                          placeholder="e.g. DP-4102 (Base Branch DP)"
                          value={formData.dpCode || ''}
                          onChange={(e) => handleChange('dpCode', e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="modal-form-field">
                    <label htmlFor="f_feName" className="field-title">
                      On-Site Field Engineer Name <span className="field-hint">(Optional)</span>
                    </label>
                    <input
                      id="f_feName"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.feName || ''}
                      onChange={(e) => handleChange('feName', e.target.value)}
                    />
                  </div>

                  <div className="modal-form-field">
                    <label htmlFor="f_feNumber" className="field-title">
                      Field Engineer Contact Number <span className="field-hint">(Optional)</span>
                    </label>
                    <input
                      id="f_feNumber"
                      type="tel"
                      className="field-input"
                      placeholder="e.g. 9845012345"
                      value={formData.feNumber || ''}
                      onChange={(e) => handleChange('feNumber', e.target.value)}
                    />
                  </div>

                  {/* Site Assignment & NOC Ownership */}
                  <div className="modal-form-field full site-assignment-field">
                    <label htmlFor="f_qa_claimedBy" className="field-title">
                      Site Assignment & NOC Ownership
                    </label>
                    <select
                      id="f_qa_claimedBy"
                      className="field-input assignment-dropdown"
                      value={formData.claimedBy || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          handleChange('claimedBy', '');
                          handleChange('claimedByName', '');
                          handleChange('isUnassigned', true);
                        } else {
                          const found = users.find(u => u.username === val);
                          handleChange('claimedBy', val);
                          handleChange('claimedByName', found ? (found.name || found.username) : val);
                          handleChange('isUnassigned', false);
                        }
                      }}
                    >
                      <option value="">⚪ Unassigned (Open Pool - Available for any NOC to Take/Claim)</option>
                      {currentUser && (
                        <option value={currentUser.username}>
                          👤 Assign to Myself ({currentUser.name || currentUser.username})
                        </option>
                      )}
                      {users.filter(u => u.username !== currentUser?.username).length > 0 && (
                        <optgroup label="Assign to Specific Team Member:">
                          {users.filter(u => u.username !== currentUser?.username).map(u => (
                            <option key={u.id || u.username} value={u.username}>
                              🧑‍💻 {u.name ? `${u.name} (${u.username})` : u.username} {u.role ? `[${u.role.toUpperCase()}]` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {!formData.claimedBy ? (
                      <div className="assignment-help-hint unassigned">
                        🌐 <strong>Open Pool:</strong> This site will be added as unassigned so any NOC engineer can claim it using the <strong>"Take / Claim Site"</strong> button.
                      </div>
                    ) : (
                      <div className="assignment-help-hint assigned">
                        📌 <strong>Assigned to:</strong> {formData.claimedByName || formData.claimedBy}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="quick-add-toggle-row">
                <button
                  type="button"
                  className="switch-full-form-btn"
                  onClick={() => setIsQuickAdd(false)}
                >
                  ⚙️ Or Switch to Full Technical Specs Form Now
                </button>
              </div>
            </div>
          ) : (
            /* ==============================================================
                VIEW 2: FULL TECHNICAL SPECIFICATION FORM
                ============================================================== */
            <div className="modal-form-scrollable">
              {/* Deployment Type Selector (Branch vs ATM) */}
              {!isEditing && (
                <div className="site-kind-selector-bar">
                  <span className="kind-selector-title">Select Site Type:</span>
                  <div className="kind-toggle-pills">
                    <button
                      type="button"
                      className={`kind-pill-btn ${isBranch ? 'active' : ''}`}
                      onClick={() => handleChange('kind', 'Branch')}
                    >
                      🏢 Branch Router
                    </button>
                    <button
                      type="button"
                      className={`kind-pill-btn ${!isBranch ? 'active' : ''}`}
                      onClick={() => handleChange('kind', 'ATM')}
                    >
                      🏧 ATM Terminal
                    </button>
                  </div>
                </div>
              )}

              {/* 1. STATUS & ASSIGNMENT */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">🚦</span>
                  <h4>Deployment Status & Ownership</h4>
                </div>
                <div className="form-fields-grid">
                  <div className="modal-form-field">
                    <label className="field-title">Deployment Status</label>
                    <div className="choice-pills-row">
                      {['Pending', 'Completed', 'On Hold', 'Failed'].map(st => {
                        const isChecked = (formData.deploymentStatus || 'Pending') === st;
                        return (
                          <label key={st} className={`choice-radio-pill status-pill-choice ${st.toLowerCase().replace(' ', '-')} ${isChecked ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="deploymentStatus"
                              value={st}
                              checked={isChecked}
                              onChange={() => handleChange('deploymentStatus', st)}
                            />
                            <span>
                              {st === 'Completed' ? '🟢 ' : st === 'Pending' ? '⏳ ' : st === 'On Hold' ? '🟡 ' : '🔴 '}
                              {st}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="modal-form-field full site-assignment-field">
                    <label className="field-title">Assigned NOC Engineer & Ownership</label>
                    <select
                      className="field-input"
                      value={formData.claimedBy || ''}
                      onChange={(e) => {
                        const selectedUname = e.target.value;
                        const found = users.find(u => u.username === selectedUname);
                        handleChange('claimedBy', selectedUname);
                        handleChange('claimedByName', found ? (found.name || found.username) : selectedUname);
                        handleChange('isUnassigned', !selectedUname);
                      }}
                    >
                      <option value="">⚪ Unassigned / Open Pool (Available for any NOC to Take/Claim)</option>
                      {currentUser && (
                        <option value={currentUser.username}>
                          👤 Assign to Myself ({currentUser.name || currentUser.username})
                        </option>
                      )}
                      {users.filter(u => u.username !== currentUser?.username).length > 0 && (
                        <optgroup label="Assign to Specific Team Member:">
                          {users.filter(u => u.username !== currentUser?.username).map(u => (
                            <option key={u.id || u.username} value={u.username}>
                              🧑‍💻 {u.name ? `${u.name} (${u.username})` : u.username} {u.role ? `[${u.role.toUpperCase()}]` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {!formData.claimedBy ? (
                      <div className="assignment-help-hint unassigned">
                        🌐 <strong>Open Pool:</strong> This site is unassigned so NOC engineers can claim it using the <strong>"Take / Claim Site"</strong> button.
                      </div>
                    ) : (
                      <div className="assignment-help-hint assigned">
                        📌 <strong>Assigned to:</strong> {formData.claimedByName || formData.claimedBy}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. CORE SITE & FIELD ENGINEER INFO */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">📍</span>
                  <h4>{isBranch ? 'Branch Information' : 'ATM Terminal Information'}</h4>
                </div>
                <div className="form-fields-grid">
                  {isBranch ? (
                    <div className="modal-form-field full">
                      <label htmlFor="f_dpCode" className="field-title required">
                        Branch DP Code
                      </label>
                      <input
                        id="f_dpCode"
                        type="text"
                        className="field-input ip-code"
                        placeholder="e.g. DP-4102"
                        value={formData.dpCode || ''}
                        onChange={(e) => handleChange('dpCode', e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div className="modal-form-field">
                        <label htmlFor="f_atmId" className="field-title required">
                          ATM Terminal ID
                        </label>
                        <input
                          id="f_atmId"
                          type="text"
                          className="field-input ip-code"
                          placeholder="e.g. ATM-CN-9921"
                          value={formData.atmId || ''}
                          onChange={(e) => handleChange('atmId', e.target.value)}
                          required
                        />
                      </div>

                      <div className="modal-form-field">
                        <label htmlFor="f_baseDpCode" className="field-title required">
                          Branch Base DP Code
                        </label>
                        <input
                          id="f_baseDpCode"
                          type="text"
                          className="field-input ip-code"
                          placeholder="e.g. DP-4102 (Base Branch DP)"
                          value={formData.dpCode || ''}
                          onChange={(e) => handleChange('dpCode', e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  <div className="modal-form-field">
                    <label htmlFor="f_feName" className="field-title">
                      Field Engineer (FE) Name
                    </label>
                    <input
                      id="f_feName"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Rajesh Sharma"
                      value={formData.feName || ''}
                      onChange={(e) => handleChange('feName', e.target.value)}
                    />
                  </div>

                  <div className="modal-form-field">
                    <label htmlFor="f_feNumber" className="field-title">
                      FE Contact Number
                    </label>
                    <input
                      id="f_feNumber"
                      type="tel"
                      className="field-input"
                      placeholder="e.g. 9845012345"
                      value={formData.feNumber || ''}
                      onChange={(e) => handleChange('feNumber', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 3. HARDWARE & DEVICE SERIAL NUMBERS */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">📦</span>
                  <h4>Device Hardware Serial Numbers</h4>
                </div>
                <div className="form-fields-grid">
                  <div className="modal-form-field full">
                    <label htmlFor="f_newDeviceSerial" className="field-title">
                      New SD-WAN Device Serial Number
                    </label>
                    <input
                      id="f_newDeviceSerial"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. CN-SDWAN-994821"
                      value={formData.newDeviceSerial || ''}
                      onChange={(e) => handleChange('newDeviceSerial', e.target.value)}
                    />
                  </div>

                  <div className="modal-form-field">
                    <label htmlFor="f_oldDeviceModel" className="field-title">
                      Old Device Model
                    </label>
                    <input
                      id="f_oldDeviceModel"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Cisco 1921/K9, Fortinet 40F"
                      value={formData.oldDeviceModel || ''}
                      onChange={(e) => handleChange('oldDeviceModel', e.target.value)}
                    />
                  </div>

                  <div className="modal-form-field">
                    <label htmlFor="f_oldDeviceSerial" className="field-title">
                      Old Device Serial Number
                    </label>
                    <input
                      id="f_oldDeviceSerial"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. FTX1842A001"
                      value={formData.oldDeviceSerial || ''}
                      onChange={(e) => handleChange('oldDeviceSerial', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 4. VLAN CONFIGURATION */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">🔀</span>
                  <h4>VLAN Configuration</h4>
                </div>
                <div className="form-fields-grid">
                  {renderRadioPill('vlanConfigured', 'VLAN Configured?', ['Yes', 'No'])}

                  {formData.vlanConfigured === 'Yes' && (
                    <>
                      <div className="modal-form-field">
                        <label htmlFor="f_vlanDetails" className="field-title">
                          Which VLAN is there?
                        </label>
                        <input
                          id="f_vlanDetails"
                          type="text"
                          className="field-input"
                          placeholder="e.g. VLAN 100 (Core Banking), VLAN 20"
                          value={formData.vlanDetails || ''}
                          onChange={(e) => handleChange('vlanDetails', e.target.value)}
                        />
                      </div>

                      {renderRadioPill('vlanRemoved', 'VLAN Removed or Not?', ['Removed', 'Not Removed'])}
                    </>
                  )}
                </div>
              </div>

              {/* 5. LAN NETWORK & SECONDARY GATEWAYS */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">🌐</span>
                  <h4>Primary LAN Gateway & DHCP Configuration</h4>
                </div>
                <div className="form-fields-grid">
                  {/* DHCP Checkbox */}
                  <div className="modal-form-field full dhcp-toggle-card">
                    <label className="checkbox-control-label">
                      <input
                        type="checkbox"
                        checked={formData.isDhcp === 'Yes'}
                        onChange={(e) => handleChange('isDhcp', e.target.checked ? 'Yes' : 'No')}
                      />
                      <span><strong>☑️ Branch Uses DHCP (Automatic IP Assignment)</strong></span>
                    </label>
                    <span className="sub-hint">Check if this branch obtains its primary network via DHCP rather than static configuration</span>
                  </div>

                  <div className="modal-form-field">
                    <label htmlFor="f_primaryLanGateway" className="field-title">
                      LAN Gateway
                    </label>
                    <input
                      id="f_primaryLanGateway"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 10.24.120.254"
                      value={formData.primaryLanGateway || formData.lanGateway || ''}
                      onChange={(e) => {
                        handleChange('primaryLanGateway', e.target.value);
                        handleChange('lanGateway', e.target.value);
                      }}
                    />
                  </div>

                  <div className="modal-form-field">
                    <label htmlFor="f_lanIpPrefix" className="field-title">
                      Prefix / Subnet
                    </label>
                    <input
                      id="f_lanIpPrefix"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. /24, /28, 255.255.255.0"
                      value={formData.lanIpPrefix || ''}
                      onChange={(e) => handleChange('lanIpPrefix', e.target.value)}
                    />
                  </div>
                </div>

                {/* Dynamic Secondary LAN Gateways (Limit 3) */}
                <div className="secondary-ips-container">
                  <div className="sec-header-row">
                    <div>
                      <h5>Secondary LAN Gateways ({secondaryIps.length}/3)</h5>
                      <p className="sub-hint">Add additional LAN gateway interfaces (Max 3 sections)</p>
                    </div>
                    <button
                      type="button"
                      className="add-sec-ip-btn"
                      onClick={handleAddSecondaryIp}
                      disabled={secondaryIps.length >= 3}
                    >
                      {secondaryIps.length >= 3 ? '(Limit 3 Reached)' : '＋ Add Secondary LAN Gateway'}
                    </button>
                  </div>

                  {secondaryIps.map((sec, idx) => (
                    <div key={idx} className="secondary-ip-box">
                      <div className="sec-box-header">
                        <strong>Secondary LAN Gateway #{idx + 1}</strong>
                        <button
                          type="button"
                          className="remove-sec-btn"
                          onClick={() => handleRemoveSecondaryIp(idx)}
                        >
                          ✕ Remove
                        </button>
                      </div>
                      <div className="form-fields-grid">
                        <div className="modal-form-field">
                          <label className="field-title">Secondary Gateway</label>
                          <input
                            type="text"
                            className="field-input ip-code"
                            placeholder="e.g. 10.24.120.60"
                            value={sec.gateway || sec.ip || ''}
                            onChange={(e) => handleUpdateSecondaryIp(idx, 'gateway', e.target.value)}
                          />
                        </div>
                        <div className="modal-form-field">
                          <label className="field-title">Prefix / Subnet</label>
                          <input
                            type="text"
                            className="field-input ip-code"
                            placeholder="e.g. /28"
                            value={sec.prefix || ''}
                            onChange={(e) => handleUpdateSecondaryIp(idx, 'prefix', e.target.value)}
                          />
                        </div>
                        <div className="modal-form-field full">
                          <label className="field-title">Purpose / Note</label>
                          <input
                            type="text"
                            className="field-input"
                            placeholder="e.g. ATM Switch, Surveillance VLAN"
                            value={sec.note || ''}
                            onChange={(e) => handleUpdateSecondaryIp(idx, 'note', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. BSNL CONNECTIVITY */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">⚡</span>
                  <div>
                    <h4>BSNL Circuit</h4>
                    {formData.bsnlPresent !== 'Yes' && (
                      <span className="isp-off-subhint">⚪ Off (Not Present) — enter IP below to activate</span>
                    )}
                  </div>
                  <div className="isp-availability-toggle">
                    <label className="isp-toggle-label">
                      <input
                        type="checkbox"
                        checked={formData.bsnlPresent === 'Yes'}
                        onChange={(e) => handleChange('bsnlPresent', e.target.checked ? 'Yes' : 'No')}
                      />
                      <span>{formData.bsnlPresent === 'Yes' ? '☑️ Present at Site' : '⚪ Not Present (Off)'}</span>
                    </label>
                  </div>
                </div>

                <div className="form-fields-grid">
                  <div className="modal-form-field">
                    <label htmlFor="f_bsnlIp" className="field-title">BSNL IP</label>
                    <input
                      id="f_bsnlIp"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 192.168.10.2 (Enter IP to enable)"
                      value={formData.bsnlIp || ''}
                      onChange={(e) => handleChange('bsnlIp', e.target.value)}
                    />
                  </div>
                  <div className="modal-form-field">
                    <label htmlFor="f_bsnlGateway" className="field-title">BSNL Gateway</label>
                    <input
                      id="f_bsnlGateway"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 192.168.10.1"
                      value={formData.bsnlGateway || ''}
                      onChange={(e) => handleChange('bsnlGateway', e.target.value)}
                    />
                  </div>
                  {renderRadioPill('bsnlPing', 'BSNL IP Pinging?', ['Yes', 'No'])}
                </div>
              </div>

              {/* 7. JIO CONNECTIVITY */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">⚡</span>
                  <div>
                    <h4>Jio Circuit</h4>
                    {formData.jioPresent !== 'Yes' && (
                      <span className="isp-off-subhint">⚪ Off (Not Present) — enter IP below to activate</span>
                    )}
                  </div>
                  <div className="isp-availability-toggle">
                    <label className="isp-toggle-label">
                      <input
                        type="checkbox"
                        checked={formData.jioPresent === 'Yes'}
                        onChange={(e) => handleChange('jioPresent', e.target.checked ? 'Yes' : 'No')}
                      />
                      <span>{formData.jioPresent === 'Yes' ? '☑️ Present at Site' : '⚪ Not Present (Off)'}</span>
                    </label>
                  </div>
                </div>

                <div className="form-fields-grid">
                  <div className="modal-form-field">
                    <label htmlFor="f_jioIp" className="field-title">Jio IP</label>
                    <input
                      id="f_jioIp"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 172.16.20.2 (Enter IP to enable)"
                      value={formData.jioIp || ''}
                      onChange={(e) => handleChange('jioIp', e.target.value)}
                    />
                  </div>
                  <div className="modal-form-field">
                    <label htmlFor="f_jioGateway" className="field-title">Jio Gateway</label>
                    <input
                      id="f_jioGateway"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 172.16.20.1"
                      value={formData.jioGateway || ''}
                      onChange={(e) => handleChange('jioGateway', e.target.value)}
                    />
                  </div>
                  {renderRadioPill('jioPing', 'Jio IP Pinging?', ['Yes', 'No'])}
                </div>
              </div>

              {/* 8. AIRTEL CONNECTIVITY (4G Loopback IP Support, CE Removed) */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">⚡</span>
                  <div>
                    <h4>Airtel Circuit</h4>
                    {formData.airtelPresent !== 'Yes' && (
                      <span className="isp-off-subhint">⚪ Off (Not Present) — enter IP below to activate</span>
                    )}
                  </div>
                  <div className="isp-availability-toggle">
                    <label className="isp-toggle-label">
                      <input
                        type="checkbox"
                        checked={formData.airtelPresent === 'Yes'}
                        onChange={(e) => handleChange('airtelPresent', e.target.checked ? 'Yes' : 'No')}
                      />
                      <span>{formData.airtelPresent === 'Yes' ? '☑️ Present at Site' : '⚪ Not Present (Off)'}</span>
                    </label>
                  </div>
                </div>

                <div className="form-fields-grid">
                  {/* Airtel 4G Option */}
                  <div className="modal-form-field full airtel-4g-toggle-card">
                    <label className="checkbox-control-label">
                      <input
                        type="checkbox"
                        checked={formData.airtelIs4G === 'Yes'}
                        onChange={(e) => handleChange('airtelIs4G', e.target.checked ? 'Yes' : 'No')}
                      />
                      <span><strong>📶 Airtel is a 4G Connection</strong></span>
                    </label>
                  </div>

                  {/* Loopback IP (if 4G) */}
                  {formData.airtelIs4G === 'Yes' && (
                    <div className="modal-form-field full loopback-field-highlight">
                      <label htmlFor="f_airtelLoopbackIp" className="field-title required">
                        Airtel 4G Loopback IP
                      </label>
                      <input
                        id="f_airtelLoopbackIp"
                        type="text"
                        className="field-input ip-code primary-highlight-input"
                        placeholder="e.g. 10.200.12.1"
                        value={formData.airtelLoopbackIp || ''}
                        onChange={(e) => handleChange('airtelLoopbackIp', e.target.value)}
                      />
                    </div>
                  )}

                  <div className="modal-form-field">
                    <label htmlFor="f_airtelIp" className="field-title">Airtel IP</label>
                    <input
                      id="f_airtelIp"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 10.100.5.2 (Enter IP to enable)"
                      value={formData.airtelIp || ''}
                      onChange={(e) => handleChange('airtelIp', e.target.value)}
                    />
                  </div>
                  <div className="modal-form-field">
                    <label htmlFor="f_airtelGateway" className="field-title">Airtel Gateway</label>
                    <input
                      id="f_airtelGateway"
                      type="text"
                      className="field-input ip-code"
                      placeholder="e.g. 10.100.5.1"
                      value={formData.airtelGateway || ''}
                      onChange={(e) => handleChange('airtelGateway', e.target.value)}
                    />
                  </div>
                  {renderRadioPill('airtelPing', 'Airtel IP Pinging?', ['Yes', 'No'])}
                </div>
              </div>

              {/* 9. CONFIGURATION & HANDOVER CHECKLIST */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">📋</span>
                  <h4>SD-WAN Handover & Sign-Off Checklist</h4>
                </div>
                <div className="form-fields-grid">
                  {renderRadioPill('configuration', 'Configuration Status', ['Completed', 'Not completed'])}
                  {renderRadioPill('mpAdded', 'Device Added in CS?', ['Yes', 'No'])}
                  {renderRadioPill('deviceOnline', 'Device Online?', ['Yes', 'No'])}
                  {renderRadioPill('mailSent', 'Handover Mail Sent?', ['Yes', 'No'])}
                  {renderRadioPill('dcMail', 'Mail from DC', ['Received', 'Not received'])}
                  {renderRadioPill('drcMail', 'Mail from DRC', ['Received', 'Not received'])}
                  {renderRadioPill('cablesConnected', 'ISP & LAN Cables Connected?', ['Connected', 'Not connected'])}
                  {renderRadioPill('uatSubmitted', 'UAT Form Given?', ['Yes', 'No'])}
                  {renderRadioPill('working', 'Is Site Operational & Working?', ['Yes', 'No'])}
                </div>
              </div>

              {/* 10. NOTES */}
              <div className="form-section-card">
                <div className="form-section-header">
                  <span className="sec-icon">📝</span>
                  <h4>Engineering Notes & Observations</h4>
                </div>
                <div className="modal-form-field full">
                  <textarea
                    className="field-input"
                    rows="3"
                    placeholder="Enter any site handover notes or remarks..."
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="modal-form-footer">
            {isQuickAdd ? (
              <>
                <button
                  type="submit"
                  className="save-btn quick-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Registering...' : '＋ Register & Move to Pending'}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className="save-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving to Database...'
                    : isEditing
                    ? 'Save Changes'
                    : `Create ${currentKind} Record`}
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
