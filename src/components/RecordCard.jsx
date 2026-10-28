import React, { useState } from 'react';

export default function RecordCard({
  record,
  currentUser,
  onEdit,
  onDelete,
  onClaim,
  onRequestTransfer,
  onAcceptTransfer,
  onRejectTransfer,
  onExport,
  onNotify
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isBranch = record.kind === 'Branch';
  const title = isBranch ? (record.dpCode || 'Branch Record') : (record.atmId || 'ATM Record');
  const isWorking = record.working === 'Yes';
  const isNotWorking = record.working === 'No';

  const role = (currentUser?.role || '').toLowerCase();
  const uname = (currentUser?.username || '').toLowerCase();
  const isAdminOrPM = role === 'admin' || role === 'pm' || uname.includes('admin');
  const isClaimedByMe = record.claimedBy && record.claimedBy.toLowerCase() === uname;
  const isUnassigned = !record.claimedBy;
  const hasClaimant = Boolean(record.claimedBy);

  // Transfer state
  const hasPendingTransfer = Boolean(record.transferRequestedBy);
  const isRequester = record.transferRequestedBy && record.transferRequestedBy.toLowerCase() === uname;
  const canEdit = isAdminOrPM || isClaimedByMe || isUnassigned;

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
    <article className={`site-record-card ${isExpanded ? 'is-expanded' : 'is-compact'}`}>
      {/* Handover / Transfer Pending Banner */}
      {hasPendingTransfer && (isClaimedByMe || isAdminOrPM) && (
        <div className="site-transfer-banner">
          <div className="transfer-banner-info">
            <span className="transfer-icon">⚠️</span>
            <div>
              <strong>Site Handover Request:</strong>
              <span> <em>{record.transferRequestedByName || record.transferRequestedBy}</em> requested to take over this site.</span>
            </div>
          </div>
          <div className="transfer-banner-actions">
            <button
              type="button"
              className="accept-transfer-btn"
              onClick={() => onAcceptTransfer && onAcceptTransfer(record.id)}
            >
              ✓ Allow & Transfer
            </button>
            <button
              type="button"
              className="decline-transfer-btn"
              onClick={() => onRejectTransfer && onRejectTransfer(record.id)}
            >
              ✕ Decline
            </button>
          </div>
        </div>
      )}

      {/* Top Claim/Ownership Bar */}
      <div className="site-claim-strip">
        <div className="claim-left">
          <span className="claim-icon">📌</span>
          <span className="claim-label">Site Owner (NOC):</span>
          {hasClaimant ? (
            <span className={`claim-name-pill ${isClaimedByMe ? 'is-me' : ''}`}>
              <strong>{record.claimedByName || record.claimedBy}</strong>
              {isClaimedByMe && <span className="you-tag">(You)</span>}
            </span>
          ) : (
            <span className="claim-unassigned-tag">Unassigned / Open</span>
          )}
        </div>

        {/* Claim or Request Handover */}
        <div className="claim-right">
          {isUnassigned && onClaim && (
            <button
              type="button"
              className="claim-action-btn"
              onClick={() => onClaim(record.id)}
              title="Take ownership of this unassigned site"
            >
              Take / Claim Site
            </button>
          )}

          {!isClaimedByMe && !isUnassigned && !isAdminOrPM && (
            isRequester ? (
              <span className="transfer-pending-pill">⏳ Handover Requested</span>
            ) : (
              <button
                type="button"
                className="request-transfer-btn"
                onClick={() => onRequestTransfer && onRequestTransfer(record.id)}
                title="Ask the current NOC owner for permission to take over this site"
              >
                🤝 Request Handover
              </button>
            )
          )}
        </div>
      </div>

      {/* Card Header (Click to toggle expansion) */}
      <div className="site-card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="site-title-group">
          <div className="site-primary-row">
            <span className="site-kind-badge">{isBranch ? 'BRANCH' : 'ATM'}</span>
            <h3 className="site-title">{title}</h3>
            <span
              className={`site-status-pill ${
                isWorking ? 'working' : isNotWorking ? 'issue' : 'unconfirmed'
              }`}
            >
              <span className="status-indicator-dot"></span>
              {isWorking ? 'Working' : isNotWorking ? 'Not Working' : 'Pending Verification'}
            </span>
          </div>
        </div>

        <div className="card-actions-wrapper" onClick={(e) => e.stopPropagation()}>
          {canEdit ? (
            <button
              type="button"
              className="card-action-icon edit-btn"
              onClick={() => onEdit(record)}
              title="Edit site details"
            >
              ✏️ Edit
            </button>
          ) : (
            <button
              type="button"
              className="card-action-icon edit-disabled"
              disabled
              title={`Claimed by ${record.claimedByName || record.claimedBy}. Request handover to edit.`}
            >
              🔒 Locked
            </button>
          )}

          {isAdminOrPM && (
            <button
              type="button"
              className="card-action-icon delete-btn"
              onClick={() => onDelete(record)}
              title="Delete site record"
            >
              🗑️
            </button>
          )}

          <button
            type="button"
            className="expand-indicator-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand full details'}
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* COMPACT SUMMARY VIEW (Always visible) */}
      <div className="site-compact-summary">
        <div className="compact-field">
          <span className="compact-lbl">On-Site FE:</span>
          <strong>{record.feName || 'Not Assigned'}</strong>
          {record.feNumber && (
            <a href={`tel:${record.feNumber}`} className="fe-call-link" onClick={(e) => e.stopPropagation()}>
              📞 {record.feNumber}
            </a>
          )}
        </div>

        <div className="compact-circuits-row">
          <span className="circuit-mini-badge" title={`BSNL IP: ${record.bsnlIp || 'N/A'}`}>
            BSNL: {record.bsnlPing === 'Yes' ? '🟢 OK' : '🔴'}
          </span>
          <span className="circuit-mini-badge" title={`Jio IP: ${record.jioIp || 'N/A'}`}>
            Jio: {record.jioPing === 'Yes' ? '🟢 OK' : '🔴'}
          </span>
          <span className="circuit-mini-badge" title={`Airtel IP: ${record.airtelIp || 'N/A'}`}>
            Airtel: {record.airtelPing === 'Yes' ? '🟢 OK' : '🔴'}
          </span>
        </div>

        {record.primaryLanIp && (
          <div className="compact-field">
            <span className="compact-lbl">LAN:</span>
            <code>{record.primaryLanIp} {record.lanIpPrefix || ''}</code>
          </div>
        )}

        <button
          type="button"
          className="toggle-expand-link"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▲ Hide Full Technical Specs' : '▼ Show Full Technical Specs'}
        </button>
      </div>

      {/* FULL EXPANDED TECHNICAL DETAILS (Visible when expanded) */}
      {isExpanded && (
        <div className="expanded-details-container">
          {/* FE & Hardware Panel */}
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
                  {record.uatSubmitted === 'Yes' ? '✓ Submitted' : 'Pending'}
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

          {/* VLAN & Primary LAN Section */}
          <div className="site-section-panel">
            <div className="panel-header-sub">
              <span>Local Network & VLAN</span>
              <span className={`vlan-chip ${record.vlanConfigured === 'Yes' ? 'active' : 'none'}`}>
                VLAN: {record.vlanConfigured === 'Yes' ? `${record.vlanDetails || 'Configured'} (${record.vlanRemoved || 'Not Removed'})` : 'No VLAN'}
              </span>
            </div>

            <div className="chips-flow-row">
              {renderIpChip('Primary LAN IP', record.primaryLanIp, `${record.id}-lan`, record.lanIpPrefix)}
              {renderIpChip('Primary Gateway', record.primaryLanGateway, `${record.id}-langw`)}
              {record.atmIp && renderIpChip('ATM IP', record.atmIp, `${record.id}-atmip`)}
            </div>

            {/* Secondary LAN IPs (up to 3) */}
            {Array.isArray(record.secondaryLanIps) && record.secondaryLanIps.length > 0 && (
              <div className="secondary-lan-chips-box">
                <span className="secondary-lan-title">Secondary LAN IPs ({record.secondaryLanIps.length}/3):</span>
                <div className="chips-flow-row">
                  {record.secondaryLanIps.map((sec, idx) => (
                    <div key={idx} className="secondary-ip-tag">
                      <strong>{sec.ip} {sec.prefix || ''}</strong>
                      {sec.note && <span className="sec-note">({sec.note})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* WAN ISP Circuits (BSNL, Jio, Airtel) */}
          <div className="site-section-panel circuits-panel">
            <div className="panel-header-sub">
              <span>ISP Circuit Deliveries</span>
            </div>

            <div className="circuits-stack">
              {/* BSNL */}
              <div className="circuit-row">
                <div className="circuit-id-col">
                  <span className="isp-badge bsnl">BSNL</span>
                  {renderPingBadge(record.bsnlPing)}
                </div>
                <div className="circuit-chips-col">
                  {renderIpChip('IP', record.bsnlIp, `${record.id}-bsnlip`)}
                  {renderIpChip('GW', record.bsnlGateway, `${record.id}-bsnlgw`)}
                </div>
              </div>

              {/* Jio */}
              <div className="circuit-row">
                <div className="circuit-id-col">
                  <span className="isp-badge jio">Jio</span>
                  {renderPingBadge(record.jioPing)}
                </div>
                <div className="circuit-chips-col">
                  {renderIpChip('IP', record.jioIp, `${record.id}-jioip`)}
                  {renderIpChip('GW', record.jioGateway, `${record.id}-jiogw`)}
                </div>
              </div>

              {/* Airtel */}
              <div className="circuit-row">
                <div className="circuit-id-col">
                  <span className="isp-badge airtel">Airtel</span>
                  {renderPingBadge(record.airtelPing)}
                </div>
                <div className="circuit-chips-col">
                  {renderIpChip('IP', record.airtelIp, `${record.id}-airtelip`)}
                  {renderIpChip('GW', record.airtelGateway, `${record.id}-airtelgw`)}
                  {renderIpChip('CE IP', record.ceIp, `${record.id}-ceip`)}
                </div>
              </div>
            </div>
          </div>

          {/* Handover & Acceptance Checklist */}
          <div className="site-section-panel checklist-panel">
            <div className="panel-header-sub">
              <span>Acceptance & Operations Checklist</span>
            </div>

            <div className="checklist-badges-grid">
              <span className={`check-chip ${record.configuration === 'Completed' ? 'done' : 'pending'}`}>
                Config: {record.configuration || 'Pending'}
              </span>
              <span className={`check-chip ${record.csAdded === 'Yes' || record.mpAdded === 'Yes' ? 'done' : 'pending'}`}>
                Added in CS: {record.csAdded || record.mpAdded || 'No'}
              </span>
              <span className={`check-chip ${record.deviceOnline === 'Yes' ? 'done' : 'pending'}`}>
                Device Online: {record.deviceOnline || 'No'}
              </span>
              <span className={`check-chip ${record.mailSent === 'Yes' ? 'done' : 'pending'}`}>
                Mail Sent: {record.mailSent || 'No'}
              </span>
              <span className={`check-chip ${record.dcMail === 'Received' ? 'done' : 'pending'}`}>
                DC Mail: {record.dcMail || 'No'}
              </span>
              <span className={`check-chip ${record.drcMail === 'Received' ? 'done' : 'pending'}`}>
                DRC Mail: {record.drcMail || 'No'}
              </span>
              <span className={`check-chip ${record.cablesConnected === 'Connected' ? 'done' : 'pending'}`}>
                Cables: {record.cablesConnected || 'Pending'}
              </span>
            </div>
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="site-section-panel notes-panel">
              <span className="panel-mini-label">Deployment Notes:</span>
              <p className="record-notes-text">{record.notes}</p>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="site-card-footer">
            <span className="timestamp-info">Updated {formattedDate}</span>
            {onExport && (
              <button
                type="button"
                className="export-single-btn"
                onClick={() => onExport(record)}
                title="Export technical slip for this site"
              >
                📄 Export Slip
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
