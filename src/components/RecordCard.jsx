import React, { useState } from 'react';

export default function RecordCard({ record, onEdit, onDelete, onExport, onNotify }) {
  const [copiedKey, setCopiedKey] = useState(null);

  const isBranch = record.kind === 'Branch';
  const title = isBranch ? (record.dpCode || 'Branch Record') : (record.atmId || 'ATM Record');
  const isWorking = record.working === 'Yes';
  const isNotWorking = record.working === 'No';

  const updatedTime = record.updated || record.created;
  const formattedDate = updatedTime
    ? new Date(updatedTime).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : '—';

  const handleCopy = (text, key) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (onNotify) onNotify(`Copied ${text} to clipboard!`);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const renderIpItem = (label, val, key) => {
    if (!val) return null;
    return (
      <div className="ip-chip">
        <span className="ip-chip-label">{label}:</span>
        <span className="ip-chip-val">{val}</span>
        <button
          type="button"
          className="ip-copy-trigger"
          onClick={() => handleCopy(val, key)}
          title={`Copy ${val}`}
        >
          {copiedKey === key ? '✓' : '⧉'}
        </button>
      </div>
    );
  };

  const renderPingBadge = (pingStatus) => {
    const isOk = pingStatus === 'Yes';
    return (
      <span className={`ping-pill ${isOk ? 'ok' : 'fail'}`}>
        <span className="ping-dot"></span>
        {isOk ? 'Ping OK' : 'Ping Failed'}
      </span>
    );
  };

  return (
    <article className="site-record-card">
      {/* Card Header */}
      <div className="site-card-header">
        <div className="site-title-group">
          <div className="site-primary-row">
            <span className="site-kind-badge">{isBranch ? 'BRANCH' : 'ATM'}</span>
            <h3 className="site-title">{title}</h3>
            <span
              className={`site-status-pill ${
                isWorking ? 'working' : isNotWorking ? 'issue' : 'unconfirmed'
              }`}
            >
              <span className="status-dot"></span>
              {isWorking
                ? 'Operational & Working'
                : isNotWorking
                ? 'Issue / Not Working'
                : 'Pending Confirmation'}
            </span>
          </div>

          <div className="site-meta-row">
            {!isBranch && (
              <span className="meta-item">
                Base Branch: <strong>{record.dpCode || '—'}</strong>
              </span>
            )}
            {isBranch && (
              <span className="meta-item">
                DP Code: <strong>{record.dpCode || '—'}</strong>
              </span>
            )}
            <span className="meta-separator">·</span>
            <span className="meta-item">Updated {formattedDate}</span>
            {record.updatedBy && (
              <>
                <span className="meta-separator">·</span>
                <span className="meta-item">By <strong>{record.updatedBy}</strong></span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Structured Sections Grid */}
      <div className="site-sections-container">
        {/* LAN Configuration */}
        <div className="site-section-panel">
          <div className="section-panel-header">
            <span className="panel-icon">🌐</span>
            <span className="panel-title">LAN & Routing</span>
            <span className={`badge-pill ${record.vlan === 'Yes' ? 'good' : 'warn'}`}>
              VLAN: {record.vlan || 'No'}
            </span>
          </div>
          <div className="panel-chips-row">
            {renderIpItem('LAN IP', record.lanIp, 'lanIp')}
            {renderIpItem('Gateway', record.lanGateway, 'lanGateway')}
            {isBranch && renderIpItem('ATM IP', record.atmIp, 'atmIp')}
            {isBranch && renderIpItem('2nd ATM IP', record.atmGateway, 'atmGateway')}
            {!record.lanIp && !record.lanGateway && (
              <span className="empty-sub">LAN IP not configured</span>
            )}
          </div>
        </div>

        {/* ISP Circuits */}
        <div className="site-section-panel">
          <div className="section-panel-header">
            <span className="panel-icon">⚡</span>
            <span className="panel-title">ISP Connectivity & Ping</span>
          </div>
          <div className="isp-circuits-grid">
            {/* BSNL */}
            <div className="circuit-box">
              <div className="circuit-head">
                <strong>BSNL</strong>
                {renderPingBadge(record.bsnlPing)}
              </div>
              <div className="circuit-body">
                {renderIpItem('IP', record.bsnlIp, 'bsnlIp')}
                {renderIpItem('GW', record.bsnlGateway, 'bsnlGateway')}
                {!record.bsnlIp && <span className="empty-sub">—</span>}
              </div>
            </div>

            {/* JIO */}
            <div className="circuit-box">
              <div className="circuit-head">
                <strong>Jio</strong>
                {renderPingBadge(record.jioPing)}
              </div>
              <div className="circuit-body">
                {renderIpItem('IP', record.jioIp, 'jioIp')}
                {renderIpItem('GW', record.jioGateway, 'jioGateway')}
                {!record.jioIp && <span className="empty-sub">—</span>}
              </div>
            </div>

            {/* AIRTEL & CE */}
            <div className="circuit-box">
              <div className="circuit-head">
                <strong>Airtel & CE</strong>
                {renderPingBadge(record.airtelPing)}
              </div>
              <div className="circuit-body">
                {renderIpItem('Airtel', record.airtelIp, 'airtelIp')}
                {renderIpItem('GW', record.airtelGateway, 'airtelGateway')}
                {renderIpItem('CE IP', record.ceIp, 'ceIp')}
                {!record.airtelIp && <span className="empty-sub">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Handover & SD-WAN Checklist */}
        <div className="site-section-panel">
          <div className="section-panel-header">
            <span className="panel-icon">📋</span>
            <span className="panel-title">SD-WAN Handover & Checklist</span>
            <span className={`badge-pill ${record.configuration === 'Completed' ? 'good' : 'warn'}`}>
              Config: {record.configuration || 'Not completed'}
            </span>
          </div>
          <div className="checklist-badges-wrap">
            <span className={`check-pill ${record.mp === 'Yes' ? 'good' : 'neutral'}`}>
              MP Device: {record.mp || 'No'}
            </span>
            <span className={`check-pill ${record.online === 'Yes' ? 'good' : 'neutral'}`}>
              Online: {record.online || 'No'}
            </span>
            <span className={`check-pill ${record.mail === 'Yes' ? 'good' : 'neutral'}`}>
              Mail Sent: {record.mail || 'No'}
            </span>
            <span className={`check-pill ${record.dcMail === 'Received' ? 'good' : 'neutral'}`}>
              DC Mail: {record.dcMail || 'Not received'}
            </span>
            <span className={`check-pill ${record.drcMail === 'Received' ? 'good' : 'neutral'}`}>
              DRC Mail: {record.drcMail || 'Not received'}
            </span>
            <span className={`check-pill ${record.cables === 'Connected' ? 'good' : 'neutral'}`}>
              Cables: {record.cables || 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Card Action Bar */}
      <div className="site-card-actions">
        <button
          type="button"
          className="card-action-btn primary-outline"
          onClick={() => onEdit(record)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          Edit Record
        </button>

        <button
          type="button"
          className="card-action-btn"
          onClick={() => onExport(record)}
          title="Download single record as JSON"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export JSON
        </button>

        <button
          type="button"
          className="card-action-btn danger"
          onClick={() => onDelete(record)}
          title="Delete record from database"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        </button>
      </div>
    </article>
  );
}
