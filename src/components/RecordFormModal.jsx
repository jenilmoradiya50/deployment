import React, { useState, useEffect } from 'react';
import { FIELD_DEFINITIONS, SECTIONS } from '../constants/fieldDefinitions';

export default function RecordFormModal({ kind, recordToEdit, onSave, onClose }) {
  const isBranch = kind === 'Branch';
  const isEditing = Boolean(recordToEdit && recordToEdit.id);

  const [formData, setFormData] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (recordToEdit) {
      setFormData({ ...recordToEdit });
    } else {
      setFormData({
        kind,
        vlan: 'No',
        bsnlPing: 'No',
        jioPing: 'No',
        airtelPing: 'No',
        configuration: 'Not completed',
        mp: 'No',
        online: 'No',
        mail: 'No',
        dcMail: 'Not received',
        drcMail: 'Not received',
        cables: 'Not connected',
        working: 'No'
      });
    }
  }, [recordToEdit, kind]);

  const handleChange = (fieldId, val) => {
    setFormData(prev => ({ ...prev, [fieldId]: val }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isBranch && (!formData.dpCode || !formData.dpCode.trim())) {
      setErrorMsg('DP code is required for Branch records.');
      document.getElementById('f_dpCode')?.focus();
      return;
    }

    if (!isBranch && (!formData.atmId || !formData.atmId.trim())) {
      setErrorMsg('ATM ID is required for ATM records.');
      document.getElementById('f_atmId')?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        kind
      });
    } catch (err) {
      setErrorMsg(err.message || 'Error saving record');
      setIsSubmitting(false);
    }
  };

  const renderField = (fieldId) => {
    const def = FIELD_DEFINITIONS[fieldId];
    if (!def) return null;
    if (def.branchOnly && !isBranch) return null;

    const value = formData[fieldId] ?? '';

    if (def.type === 'choice') {
      return (
        <div key={fieldId} className="modal-form-field">
          <label className="field-title">{def.label}</label>
          <div className="choice-pills-row">
            {def.options.map(opt => {
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
    }

    return (
      <div key={fieldId} className="modal-form-field">
        <label htmlFor={`f_${fieldId}`} className="field-title">
          {def.label}
        </label>
        <input
          id={`f_${fieldId}`}
          type="text"
          className={`field-input ${def.isIp ? 'ip-code' : ''}`}
          placeholder={def.placeholder || `Enter ${def.label.toLowerCase()}`}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => handleChange(fieldId, e.target.value)}
        />
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
            {/* Identification */}
            <div className="form-section-card">
              <div className="form-section-header">
                <span className="sec-icon">🏷️</span>
                <h4>Site Identification</h4>
              </div>
              <div className="form-fields-grid">
                {isBranch ? (
                  <div className="modal-form-field full">
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
              </div>
            </div>

            {/* SECTIONS */}
            {SECTIONS.map(section => {
              const fields = section.fields.filter(f => {
                const def = FIELD_DEFINITIONS[f];
                if (!def) return false;
                if (def.branchOnly && !isBranch) return false;
                return true;
              });

              if (fields.length === 0) return null;

              return (
                <div key={section.id} className="form-section-card">
                  <div className="form-section-header">
                    <span className="sec-icon">
                      {section.id === 'lan' ? '🌐' : section.id === 'config' ? '📋' : '⚡'}
                    </span>
                    <h4>{section.title}</h4>
                  </div>
                  <div className="form-fields-grid">
                    {fields.map(f => renderField(f))}
                  </div>
                </div>
              );
            })}
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
