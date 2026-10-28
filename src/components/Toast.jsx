import React from 'react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  return (
    <div className={`toast-container ${toast.type || 'info'}`}>
      <span className="toast-icon">
        {toast.type === 'error' ? '❌' : toast.type === 'success' ? '✓' : 'ℹ️'}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}
