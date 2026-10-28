import React, { useState } from 'react';

export default function RecordCard({ record, currentUser, onEdit, onDelete, onClaim, onExport, onNotify }) {
  const [copiedKey, setCopiedKey] = useState(null);

  const isBranch = record.kind === 'Branch';
  const title = isBranch ? (record.dpCode || 'Branch Record') : (record.atmId || 'ATM Record');
  const isWorking = record.working === 'Yes';
  const isNotWorking = record.working === 'No';

  const isClaimedByMe = record.claimedBy && currentUser && record.claimedBy.toLowerCase() === currentUser.username.toLowerCase();
  const hasClaimant = Boolean(record.claimedBy);

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

  const renderIpChip = (label, val, key, prefix = '') => {
    if (!val) return null;
    const displayVal = prefix ? `${val} ${prefix}` : val;

    return (
      <div className="ip-chip">
        <span className="ip-chip-label">{label}:</span>
        <span className="ip-chip-val">{displayVal}</span>
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
      {/* Top Claim/Ownership Bar */}
      <div className="site-claim-strip">
        <div className="claim-left">
          <span className="claim-icon">📌</span>
          <span className="claim-label">Site Assigned To:</span>
          {hasClaimant ? (
            <span className={`claim-name-pill ${isClaimedByMe ? 'is-me' : ''}`}>
              <strong>{record.claimedByName || record.claimedBy}</strong>
              {isClaimedByMe && <span className="you-tag">(You)</span>}
            </span>
          ) : (
            <span className="claim-unassigned-tag">Unassigned / Open</span>
          )}
        </div>

        {!isClaimedByMe && onClaim && (
          <button
            type="button"
            className="claim-action-btn"
            onClick={() => onClaim(record.id)}
            title="Link this site to your account"
          >
            Take / Claim Site
          </button>
        )}
      </div>

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
                Base Branch DP: <strong>{record.dpCode || '—'}</strong>
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
        {/* Field Engineer & Hardware Info */}
        <div className="site-section-panel fe-hardware-panel">
          <div className="fe-row">
            <div className="fe-col">
              <span className="panel-mini-label">Field Engineer:</span>
              <strong>{record.feName || 'Not Assigned'}</strong>
              {record.feNumber && (
                <a href={`tel:${record.feNumber}`} className="fe-tel-link">
                  📞 {record.feNumber}
                </a>
              )}
            </div>

            <div className="fe-col">
              <span className="panel-mini-label">UAT Form:</span>
              <span className={`uat-badge ${record.uatSubmitted === 'Yes' ? 'submitted' : 'pending'}`}>
                {record.uatSubmitted === 'Yes' ? '✓ Handed Over' : 'Pending / Not Given'}
              </span>
              {record.uatFormNo && <span className="uat-no">Ref: {record.uatFormNo}</span>}
            </div>

            <div className="fe-col">
              <span className="panel-mini-label">New Device S/N:</span>
              <span className="device-sn">{record.newDeviceSerial || '—'}</span>
            </div>

            <div className="fe-col">
              <span className="panel-mini-label">Old Device:</span>
              <span>{record.oldDeviceModel || '—'} {record.oldDeviceSerial ? `(S/N: ${record.oldDeviceSerial})` : ''}</span>
            </div>
          </div>
        </div>

        {/* LAN Configuration with Primary & up to 3 Secondary IPs */}
        <div className="site-section-panel">
          <div className="section-panel-header">
            <span className="panel-icon">🌐</span>
            <span className="panel-title">LAN Configuration & VLAN</span>
            <div className="vlan-status-group">
              <span className={`badge-pill ${record.vlanConfigured === 'Yes' ? 'good' : 'warn'}`}>
                VLAN: {record.vlanConfigured || 'No'}
              </span>
              {record.vlanConfigured === 'Yes' && record.vlanDetails && (
                <span className="vlan-id-pill">{record.vlanDetails}</span>
              )}
              {record.vlanConfigured === 'Yes' && (
                <span className={`vlan-removed-pill ${record.vlanRemoved === 'Removed' ? 'removed' : 'kept'}`}>
                  {record.vlanRemoved || 'Not Removed'}
                </span>
              )}
            </div>
          </div>

          <div className="panel-chips-row">
            {renderIpChip('Primary LAN IP', record.primaryLanIp, 'primaryLanIp', record.lanIpPrefix)}
            {renderIpChip('Gateway', record.primaryLanGateway, 'primaryLanGateway')}

            {/* Secondary LAN IPs (Limit of 3) */}
            {Array.isArray(record.secondaryLanIps) && record.secondaryLanIps.map((sec, idx) => (
              sec.ip ? (
                <div key={idx} className="ip-chip secondary-lan">
                  <span className="ip-chip-label">Secondary #{idx + 1}:</span>
                  <span className="ip-chip-val">{sec.ip} {sec.prefix || ''}</span>
                  {sec.note && <span className="sec-note">({sec.note})</span>}
                  <button
                    type="button"
                    className="ip-copy-trigger"
                    onClick={() => handleCopy(sec.ip, `sec_${idx}`)}
                    title={`Copy ${sec.ip}`}
                  >
                    {copiedKey === `sec_${idx}` ? '✓' : '⧉'}
                  </button>
                </div>
              ) : null
            ))}
          </div>
        </div>

        {/* ISP Circuits with Ping Badges */}
        <div className="site-section-panel">
          <div className="section-panel-header">
            <span className="panel-icon">⚡</span>
            <span className="panel-title">ISP Connectivity & Ping</span>
          </div>
          <div className="isp-circuits-grid">
            {/* BSNL */}
            <div className="circuit-box">
              <div className="circuit-head">
                <strong>BSNL Circuit</strong>
                {renderPingBadge(record.bsnlPing)}
              </div>
              <div className="circuit-body">
                {renderIpChip('IP', record.bsnlIp, 'bsnlIp')}
                {renderIpChip('GW', record.bsnlGateway, 'bsnlGateway')}
                {!record.bsnlIp && <span className="empty-sub">—</span>}
              </div>
            </div>

            {/* JIO */}
            <div className="circuit-box">
              <div className="circuit-head">
                <strong>Jio Circuit</strong>
                {renderPingBadge(record.jioPing)}
              </div>
              <div className="circuit-body">
                {renderIpChip('IP', record.jioIp, 'jioIp')}
                {renderIpChip('GW', record.jioGateway, 'jioGateway')}
                {!record.jioIp && <span className="empty-sub">—</span>}
              </div>
            </div>

            {/* AIRTEL & CE */}
            <div className="circuit-box">
              <div className="circuit-head">
                <strong>Airtel & CE Circuit</strong>
                {renderPingBadge(record.airtelPing)}
              </div>
              <div className="circuit-body">
                {renderIpChip('Airtel', record.airtelIp, 'airtelIp')}
                {renderIpChip('GW', record.airtelGateway, 'airtelGateway')}
                {renderIpChip('CE IP', record.ceIp, 'ceIp')}
                {!record.airtelIp && <span className="empty-sub">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* SD-WAN Handover & Sign-off Checklist */}
        <div className="site-section-panel">
          <div className="section-panel-header">
            <span className="panel-icon">📋</span>
            <span className="panel-title">SD-WAN Handover & Sign-off Checklist</span>
            <span className={`badge-pill ${record.configuration === 'Completed' ? 'good' : 'warn'}`}>
              Config: {record.configuration || 'Not completed'}
            </span>
          </div>
          <div className="checklist-badges-wrap">
            <span className={`check-pill ${record.mpAdded === 'Yes' || record.csAdded === 'Yes' ? 'good' : 'neutral'}`}>
              Device in CS: {record.csAdded || record.mpAdded || 'No'}
            </span>
            <span className={`check-pill ${record.deviceOnline === 'Yes' ? 'good' : 'neutral'}`}>
              Online: {record.deviceOnline || 'No'}
            </span>
            <span className={`check-pill ${record.mailSent === 'Yes' ? 'good' : 'neutral'}`}>
              Mail Sent: {record.mailSent || 'No'}
            </span>
            <span className={`check-pill ${record.dcMail === 'Received' ? 'good' : 'neutral'}`}>
              DC Mail: {record.dcMail || 'Not received'}
            </span>
            <span className={`check-pill ${record.drcMail === 'Received' ? 'good' : 'neutral'}`}>
              DRC Mail: {record.drcMail || 'Not received'}
            </span>
            <span className={`check-pill ${record.cablesConnected === 'Connected' ? 'good' : 'neutral'}`}>
              Cables: {record.cablesConnected || 'Not connected'}
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
          title="Download single record JSON"
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
          title="Permanently remove site from database"
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
