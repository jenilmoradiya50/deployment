import React, { useState, useEffect } from 'react';

export default function RecordFormModal({ kind, recordToEdit, currentUser, users = [], onSave, onClose }) {
  const isBranch = kind === 'Branch';
  const isEditing = Boolean(recordToEdit && recordToEdit.id);

  const [formData, setFormData] = useState({});
  const [secondaryIps, setSecondaryIps] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (recordToEdit) {
      setFormData({ ...recordToEdit });
      setSecondaryIps(Array.isArray(recordToEdit.secondaryLanIps) ? [...recordToEdit.secondaryLanIps] : []);
    } else {
      setFormData({
        kind,
        claimedBy: currentUser?.username || 'Admin@Canara',
        claimedByName: currentUser?.name || currentUser?.username || 'Admin',
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
    }
  }, [recordToEdit, kind, currentUser]);

  const handleChange = (fieldId, val) => {
    setFormData(prev => ({ ...prev, [fieldId]: val }));
    if (errorMsg) setErrorMsg('');
  };

  // Secondary LAN IP handlers (Limit: 3)
  const handleAddSecondaryIp = () => {
    if (secondaryIps.length >= 3) return;
    setSecondaryIps(prev => [...prev, { ip: '', prefix: '', note: '' }]);
  };

  const handleUpdateSecondaryIp = (index, key, value) => {
    setSecondaryIps(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
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

    if (!isBranch && (!formData.atmId || !formData.atmId.trim())) {
      setErrorMsg('ATM ID is required.');
      document.getElementById('f_atmId')?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        kind,
        secondaryLanIps: secondaryIps.filter(s => s.ip && s.ip.trim() !== '')
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-form-header">
            <div className="header-badge-title">
              <span className="modal-tag">{kind.toUpperCase()}</span>
              <h2>{isEditing ? `Edit ${kind} Record` : `Add New ${kind} Record`}</h2>
            </div>
            <button
              type="button"
              className="modal-close-button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </div>

          {errorMsg && (
            <div className="modal-error-alert">
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="modal-form-scrollable">
            {/* 1. SITE IDENTIFICATION & OWNERSHIP */}
            <div className="form-section-card">
              <div className="form-section-header">
                <span className="sec-icon">🏷️</span>
                <h4>Site Identification & Ownership</h4>
              </div>
              <div className="form-fields-grid">
                {isBranch ? (
                  <div className="modal-form-field">
                    <label htmlFor="f_dpCode" className="field-title required">
                      Branch DP Code *
                    </label>
                    <input
                      id="f_dpCode"
                      type="text"
                      className="field-input"
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
                        ATM ID *
                      </label>
                      <input
                        id="f_atmId"
                        type="text"
                        className="field-input"
                        placeholder="e.g. ATM-MH-9941"
                        value={formData.atmId || ''}
                        onChange={(e) => handleChange('atmId', e.target.value)}
                        required
                      />
                    </div>
                    <div className="modal-form-field">
                      <label htmlFor="f_dpCode" className="field-title">
                        Base Branch DP Code
                      </label>
                      <input
                        id="f_dpCode"
                        type="text"
                        className="field-input"
                        placeholder="e.g. DP-4102"
                        value={formData.dpCode || ''}
                        onChange={(e) => handleChange('dpCode', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Site Assigned / Claimed By */}
                <div className="modal-form-field">
                  <label htmlFor="f_claimedBy" className="field-title">
                    Assigned To / Site Taken By
                  </label>
                  <select
                    id="f_claimedBy"
                    className="field-input"
                    value={formData.claimedBy || ''}
                    onChange={(e) => {
                      const selectedUname = e.target.value;
                      const matched = users.find(u => u.username === selectedUname);
                      setFormData(prev => ({
                        ...prev,
                        claimedBy: selectedUname,
                        claimedByName: matched ? matched.name : selectedUname
                      }));
                    }}
                  >
                    <option value="">-- Unassigned --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.username}>
                        {u.name || u.username} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. FIELD ENGINEER (FE) DETAILS & UAT FORM */}
            <div className="form-section-card">
              <div className="form-section-header">
                <span className="sec-icon">👷</span>
                <h4>Field Engineer (FE) & UAT Sign-Off</h4>
              </div>
              <div className="form-fields-grid">
                <div className="modal-form-field">
                  <label htmlFor="f_feName" className="field-title">
                    FE Name
                  </label>
                  <input
                    id="f_feName"
                    type="text"
                    className="field-input"
                    placeholder="Enter Field Engineer Name"
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

                {renderRadioPill('uatSubmitted', 'FE Gave UAT Form?', ['Yes', 'No'])}

                <div className="modal-form-field">
                  <label htmlFor="f_uatFormNo" className="field-title">
                    UAT Form / Reference Number
                  </label>
                  <input
                    id="f_uatFormNo"
                    type="text"
                    className="field-input"
                    placeholder="e.g. UAT-CN-4102-01"
                    value={formData.uatFormNo || ''}
                    onChange={(e) => handleChange('uatFormNo', e.target.value)}
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

            {/* 5. LAN NETWORK & SECONDARY IPS (LIMIT 3) */}
            <div className="form-section-card">
              <div className="form-section-header">
                <span className="sec-icon">🌐</span>
                <h4>Primary LAN & Secondary IP Configuration</h4>
              </div>
              <div className="form-fields-grid">
                <div className="modal-form-field">
                  <label htmlFor="f_primaryLanIp" className="field-title">
                    Primary LAN IP
                  </label>
                  <input
                    id="f_primaryLanIp"
                    type="text"
                    className="field-input ip-code"
                    placeholder="e.g. 10.24.120.1"
                    value={formData.primaryLanIp || formData.lanIp || ''}
                    onChange={(e) => handleChange('primaryLanIp', e.target.value)}
                  />
                </div>

                <div className="modal-form-field">
                  <label htmlFor="f_lanIpPrefix" className="field-title">
                    LAN IP Prefix / Subnet
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

                <div className="modal-form-field full">
                  <label htmlFor="f_primaryLanGateway" className="field-title">
                    Primary LAN Gateway
                  </label>
                  <input
                    id="f_primaryLanGateway"
                    type="text"
                    className="field-input ip-code"
                    placeholder="e.g. 10.24.120.254"
                    value={formData.primaryLanGateway || formData.lanGateway || ''}
                    onChange={(e) => handleChange('primaryLanGateway', e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Secondary LAN IPs (Limit 3) */}
              <div className="secondary-ips-container">
                <div className="sec-header-row">
                  <div>
                    <h5>Secondary LAN IPs ({secondaryIps.length}/3)</h5>
                    <p className="sub-hint">Add additional LAN subnets or interfaces (Max 3 sections)</p>
                  </div>
                  <button
                    type="button"
                    className="add-sec-ip-btn"
                    onClick={handleAddSecondaryIp}
                    disabled={secondaryIps.length >= 3}
                  >
                    {secondaryIps.length >= 3 ? '(Limit 3 Reached)' : '＋ Add Secondary LAN IP'}
                  </button>
                </div>

                {secondaryIps.map((sec, idx) => (
                  <div key={idx} className="secondary-ip-box">
                    <div className="sec-box-header">
                      <strong>Secondary LAN Section #{idx + 1}</strong>
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
                        <label className="field-title">Secondary IP</label>
                        <input
                          type="text"
                          className="field-input ip-code"
                          placeholder="e.g. 10.24.120.60"
                          value={sec.ip || ''}
                          onChange={(e) => handleUpdateSecondaryIp(idx, 'ip', e.target.value)}
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
                <h4>BSNL Circuit</h4>
              </div>
              <div className="form-fields-grid">
                <div className="modal-form-field">
                  <label htmlFor="f_bsnlIp" className="field-title">BSNL IP</label>
                  <input
                    id="f_bsnlIp"
                    type="text"
                    className="field-input ip-code"
                    placeholder="e.g. 192.168.10.2"
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
                <h4>Jio Circuit</h4>
              </div>
              <div className="form-fields-grid">
                <div className="modal-form-field">
                  <label htmlFor="f_jioIp" className="field-title">Jio IP</label>
                  <input
                    id="f_jioIp"
                    type="text"
                    className="field-input ip-code"
                    placeholder="e.g. 172.16.20.2"
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

            {/* 8. AIRTEL & CE CONNECTIVITY */}
            <div className="form-section-card">
              <div className="form-section-header">
                <span className="sec-icon">⚡</span>
                <h4>Airtel & CE Circuit</h4>
              </div>
              <div className="form-fields-grid">
                <div className="modal-form-field">
                  <label htmlFor="f_airtelIp" className="field-title">Airtel IP</label>
                  <input
                    id="f_airtelIp"
                    type="text"
                    className="field-input ip-code"
                    placeholder="e.g. 10.100.5.2"
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
                <div className="modal-form-field">
                  <label htmlFor="f_ceIp" className="field-title">CE IP</label>
                  <input
                    id="f_ceIp"
                    type="text"
                    className="field-input ip-code"
                    placeholder="e.g. 10.100.5.254"
                    value={formData.ceIp || ''}
                    onChange={(e) => handleChange('ceIp', e.target.value)}
                  />
                </div>
                {renderRadioPill('airtelPing', 'Airtel / CE IP Pinging?', ['Yes', 'No'])}
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

          <div className="modal-form-footer">
            <button
              type="submit"
              className="save-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving to Database...'
                : isEditing
                ? 'Save Changes'
                : `Create ${kind} Record`}
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
