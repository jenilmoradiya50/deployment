import React, { useState } from 'react';

export default function RecordCard({
  record,
  currentUser,
  onEdit,
  onDelete,
  onClaim,
  onStatusChange,
  onRequestTransfer,
  onAcceptTransfer,
  onRejectTransfer,
  onArchiveSite,
  onExport,
  onNotify
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isBranch = record.kind === 'Branch';
  const title = isBranch ? (record.dpCode || 'Branch Record') : (record.atmId || 'ATM Record');

  // Status computation: Pending, Completed, On Hold, Failed
  const status = record.deploymentStatus || (record.working === 'Yes' ? 'Completed' : (record.working === 'No' ? 'Failed' : 'Pending'));
  const isCompleted = status === 'Completed';
  const isPending = status === 'Pending';
  const isOnHold = status === 'On Hold';
  const isFailed = status === 'Failed';

  const role = (currentUser?.role || '').toLowerCase();
  const uname = (currentUser?.username || '').toLowerCase();
  const isAdminOrPM = role === 'admin' || role === 'pm' || uname.includes('admin');
  const isClaimedByMe = record.claimedBy && record.claimedBy.toLowerCase() === uname;
  const isUnassigned = !record.claimedBy;
  const hasClaimant = Boolean(record.claimedBy);

  // Handler History & Movement tracking
  const handlerHistory = Array.isArray(record.handlerHistory) ? record.handlerHistory : [];
  const prevHandlerEntry = handlerHistory.find(h => h.handler && h.handler !== 'Unassigned') || null;
  const prevHandlerName = prevHandlerEntry ? (prevHandlerEntry.handlerName || prevHandlerEntry.handler) : '';
  const holdEntry = handlerHistory.find(h => h.action && h.action.includes('Hold'));
  const holdReason = holdEntry?.reason || '';

  // Transfer state
  const hasPendingTransfer = Boolean(record.transferRequestedBy);
  const isRequester = record.transferRequestedBy && record.transferRequestedBy.toLowerCase() === uname;
  const isCreatedByMe = record.createdBy && record.createdBy.toLowerCase() === uname;
  const canEdit = isAdminOrPM || isClaimedByMe;
  const canDelete = isAdminOrPM || isClaimedByMe || isCreatedByMe;

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

  const renderPingBadge = (pingStatus, hasIp = true) => {
    if (!hasIp) {
      return (
        <span className="ping-pill unconfigured" title="IP address not configured yet">
          <span className="ping-dot"></span>
          Not Configured
        </span>
      );
    }
    const isOk = pingStatus === 'Yes';
    return (
      <span className={`ping-pill ${isOk ? 'ok' : 'fail'}`}>
        <span className="ping-dot"></span>
        {isOk ? 'Ping OK' : 'Ping Failed'}
      </span>
    );
  };

  return (
    <article className={`site-record-card ${isExpanded ? 'is-expanded' : 'is-compact'} status-${status.toLowerCase().replace(' ', '-')}`}>
      {/* Handover / Transfer Pending Banner */}
      {hasPendingTransfer && (
        <div className="site-transfer-banner">
          <div className="transfer-banner-info">
            <span className="transfer-icon">⚠️</span>
            <div>
              <strong>Site Handover Request:</strong>
              {isRequester ? (
                <span> You requested to take over this site. Waiting for approval from {record.claimedByName || record.claimedBy || 'current handler'}.</span>
              ) : (
                <span> <em>{record.transferRequestedByName || record.transferRequestedBy}</em> requested to take over this site as handler.</span>
              )}
            </div>
          </div>
          <div className="transfer-banner-actions">
            {isRequester ? (
              <button
                type="button"
                className="cancel-handover-btn-banner"
                onClick={() => onRejectTransfer && onRejectTransfer(record.id)}
                title="Cancel your handover request"
              >
                ✕ Cancel My Request
              </button>
            ) : (isClaimedByMe || isAdminOrPM) ? (
              <>
                <button
                  type="button"
                  className="accept-transfer-btn"
                  onClick={() => onAcceptTransfer && onAcceptTransfer(record.id)}
                >
                  ✓ Allow Handover
                </button>
                <button
                  type="button"
                  className="decline-transfer-btn"
                  onClick={() => onRejectTransfer && onRejectTransfer(record.id)}
                >
                  ✕ Decline
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Top Claim/Handler Bar */}
      <div className={`site-claim-strip ${isOnHold ? 'is-on-hold-strip' : ''}`}>
        <div className="claim-left">
          <span className="claim-icon">{isOnHold ? '⏸️' : '📌'}</span>
          <span className="claim-label">Site Handler (NOC):</span>
          {hasClaimant ? (
            <span className={`claim-name-pill ${isClaimedByMe ? 'is-me' : ''}`}>
              <strong>{record.claimedByName || record.claimedBy}</strong>
              {isClaimedByMe && <span className="you-tag">(You)</span>}
            </span>
          ) : isOnHold ? (
            <div className="hold-handler-info">
              <span className="claim-unassigned-tag hold-tag">⚪ Unassigned (On Hold)</span>
              {prevHandlerName && (
                <span className="prev-handler-tag" title={`Site was placed on hold. Previous NOC: ${prevHandlerName}`}>
                  👤 Prev NOC: <strong>{prevHandlerName}</strong>
                </span>
              )}
            </div>
          ) : (
            <span className="claim-unassigned-tag">⚪ Open Pool (Unassigned)</span>
          )}
        </div>

        {/* Claim or Request Handover */}
        <div className="claim-right">
          {(isUnassigned || isOnHold) && onClaim && (
            <button
              type="button"
              className="claim-action-btn"
              onClick={() => onClaim(record.id)}
              title={isOnHold ? "Take this on-hold site into your active queue to resume work" : "Take this unassigned site into your active queue as handler"}
            >
              ✋ {isOnHold ? 'Resume / Take Site' : 'Take / Claim Site'}
            </button>
          )}

          {isRequester ? (
            <div className="handover-requester-actions">
              <span className="transfer-pending-pill">⏳ Handover Requested</span>
              <button
                type="button"
                className="cancel-handover-btn"
                onClick={() => onRejectTransfer && onRejectTransfer(record.id)}
                title="Cancel your handover request"
              >
                ✕ Cancel Request
              </button>
            </div>
          ) : (
            !isClaimedByMe && !isUnassigned && !isOnHold && !isAdminOrPM && (
              <button
                type="button"
                className="request-transfer-btn"
                onClick={() => onRequestTransfer && onRequestTransfer(record.id)}
                title="Ask the current NOC handler for handover of this site"
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
            <span className={`provider-badge-pill ${record.provider === 'Sify' ? 'sify' : 'uniserved'}`} title={`Deployment Provider: ${record.provider || 'Uniserved'}`}>
              🏢 {record.provider || 'Uniserved'}
            </span>
            <h3 className="site-title">{title}</h3>
            {!isBranch && record.dpCode && (
              <span className="base-dp-badge" title="Parent Branch Base DP">
                🏛️ Base DP: <strong>{record.dpCode}</strong>
              </span>
            )}
            {isUnassigned && (
              <span className="open-pool-badge" title="Open site in deployment pool: click 'Take / Claim Site' to assign to yourself">
                🌐 Open Site
              </span>
            )}
            {record.cloudIpPurged && (
              <span className="cloud-purged-pill" title="Sensitive IP parameters were scrubbed from cloud after 36-hour retention policy. Full records are archived safely in local SQLite.">
                🔒 Local Storage (IP Purged)
              </span>
            )}
            
            {/* Main Status Pill */}
            <span className={`site-status-pill ${status.toLowerCase().replace(' ', '-')}`}>
              <span className="status-indicator-dot"></span>
              {status === 'Completed' ? '🟢 Completed' : status === 'Pending' ? '⏳ Pending' : status === 'On Hold' ? '🟡 On Hold' : '🔴 Failed'}
            </span>
          </div>
        </div>

        <div className="card-actions-wrapper" onClick={(e) => e.stopPropagation()}>
          {isCompleted && onArchiveSite && (
            <button
              type="button"
              className="card-action-btn archive-action-btn"
              onClick={() => onArchiveSite(record)}
              title="Save a minimal historic reference to the Archived Deployments section"
            >
              <span className="btn-icon">📦</span>
              <span className="btn-text">Archive</span>
            </button>
          )}

          {canEdit ? (
            <button
              type="button"
              className="card-action-btn edit-btn primary-edit-btn"
              onClick={() => onEdit(record)}
              title="Edit site details & technical parameters"
            >
              <span className="btn-icon">✏️</span>
              <span className="btn-text">Edit</span>
            </button>
          ) : (
            <button
              type="button"
              className="card-action-btn edit-disabled"
              disabled
              title={isUnassigned ? "Unassigned site. Click 'Take / Claim Site' first to edit." : isOnHold ? "Site is On Hold. Click 'Resume / Take Site' first to edit." : `Handled by ${record.claimedByName || record.claimedBy}. Request handover to edit.`}
            >
              <span className="btn-icon">🔒</span>
              <span className="btn-text">Locked</span>
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="card-action-btn delete-btn"
              onClick={() => onDelete(record)}
              title="Delete site record"
            >
              <span className="btn-icon">🗑️</span>
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
        {isOnHold ? (
          <div className="compact-field hold-summary-box">
            <div className="hold-summary-headline">
              <span className="compact-lbl">Status:</span>
              <span className="hold-status-pill">⏸️ On Hold (Unassigned Pool)</span>
              {prevHandlerName && (
                <span className="prev-noc-info">
                  Previous NOC: <strong>{prevHandlerName}</strong>
                </span>
              )}
            </div>
            {holdReason && (
              <div className="compact-hold-reason">
                💬 <strong>Reason:</strong> {holdReason}
              </div>
            )}
          </div>
        ) : isUnassigned ? (
          <div className="compact-field">
            <span className="compact-lbl">Assignment:</span>
            <span className="open-tag-pill">⚪ Open Pool (Unassigned)</span>
          </div>
        ) : null}

        {!isBranch && record.dpCode && (
          <div className="compact-field">
            <span className="compact-lbl">Base Branch DP:</span>
            <strong>{record.dpCode}</strong>
          </div>
        )}

        {record.cloudIpPurged && (
          <div className="compact-field purged-security-banner">
            <span className="purged-shield-icon">🔒</span>
            <div className="purged-text-block">
              <strong>IP Details Archived Locally (Cloud Purged):</strong>
              <span> Per security policy, confidential IP & circuit parameters were purged from cloud after 36h retention. Complete parameters are stored securely in your local SQLite database.</span>
            </div>
          </div>
        )}

        <div className="compact-field">
          <span className="compact-lbl">On-Site FE:</span>
          <strong>{record.feName || 'Not Assigned'}</strong>
          {record.feNumber && (
            <a href={`tel:${record.feNumber}`} className="fe-call-link" onClick={(e) => e.stopPropagation()}>
              📞 {record.feNumber}
            </a>
          )}
        </div>

        {/* ISP Status Pills in Compact View */}
        <div className="compact-circuits-row">
          <span className="circuit-mini-badge source-badge" title={`Source of IP Details: ${record.ipSource || 'Sheet'}`}>
            📂 {record.ipSource || 'Sheet'}
          </span>
          {record.isDhcp === 'Yes' && (
            <span className="circuit-mini-badge dhcp-badge" title="Branch utilizes DHCP for IP configuration">
              📶 DHCP
            </span>
          )}
          <span className={`circuit-mini-badge ${record.bsnlPresent === 'No' ? 'not-present' : ''}`} title={`BSNL IP: ${record.bsnlIp || 'N/A'}`}>
            BSNL: {record.bsnlPresent === 'No' ? '⚪ N/A' : (!record.bsnlIp ? '⚪ No IP' : (record.bsnlPing === 'Yes' ? '🟢 OK' : '🔴 Ping Failed'))}
          </span>
          <span className={`circuit-mini-badge ${record.jioPresent === 'No' ? 'not-present' : ''}`} title={`Jio IP: ${record.jioIp || 'N/A'}`}>
            Jio: {record.jioPresent === 'No' ? '⚪ N/A' : (!record.jioIp ? '⚪ No IP' : (record.jioPing === 'Yes' ? '🟢 OK' : '🔴 Ping Failed'))}
          </span>
          <span className={`circuit-mini-badge ${record.airtelPresent === 'No' ? 'not-present' : ''}`} title={`Airtel IP: ${record.airtelIp || 'N/A'}`}>
            Airtel{record.airtelIs4G === 'Yes' ? ' (4G)' : ''}: {record.airtelPresent === 'No' ? '⚪ N/A' : (!record.airtelIp && !record.airtelLoopbackIp ? '⚪ No IP' : (record.airtelPing === 'Yes' ? '🟢 OK' : '🔴 Ping Failed'))}
          </span>
        </div>

        {(record.primaryLanGateway || record.lanGateway || record.primaryLanIp) && (
          <div className="compact-field">
            <span className="compact-lbl">Gateway:</span>
            <code>{record.primaryLanGateway || record.lanGateway || record.primaryLanIp} {record.lanIpPrefix || ''}</code>
          </div>
        )}

        {/* Quick Lifecycle Action Buttons */}
        {canEdit && (
          <div className="card-status-quick-buttons" onClick={(e) => e.stopPropagation()}>
            {!isCompleted && (
              <button
                type="button"
                className="status-action-btn complete-btn"
                onClick={() => onStatusChange && onStatusChange(record.id, 'Completed')}
                title="Mark site deployment as Completed"
              >
                ✓ Completed
              </button>
            )}
            {!isOnHold && (
              <button
                type="button"
                className="status-action-btn hold-btn"
                onClick={() => onStatusChange && onStatusChange(record.id, 'On Hold')}
                title="Put site deployment on Hold"
              >
                ⏸ Hold
              </button>
            )}
            {!isFailed && (
              <button
                type="button"
                className="status-action-btn fail-btn"
                onClick={() => onStatusChange && onStatusChange(record.id, 'Failed')}
                title="Mark site deployment as Failed / Issue"
              >
                ✕ Failed
              </button>
            )}
            {!isPending && (
              <button
                type="button"
                className="status-action-btn pending-btn"
                onClick={() => onStatusChange && onStatusChange(record.id, 'Pending')}
                title="Shift site back to Pending queue"
              >
                ↺ Pending
              </button>
            )}
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
        <div className="site-expanded-details">
          {/* Top Quick Actions Bar inside full technical description */}
          <div className="expanded-top-action-bar">
            <div className="expanded-title-area">
              <span className="expanded-bar-icon">📋</span>
              <span className="expanded-bar-heading">Full Technical Description & Parameters</span>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="full-spec-edit-btn"
                onClick={() => onEdit(record)}
                title="Edit this site's technical parameters"
              >
                ✏️ Edit Specifications
              </button>
            ) : (
              <span className="specs-locked-pill">
                🔒 Locked ({record.claimedByName || record.claimedBy || 'Unassigned'})
              </span>
            )}
          </div>

          {/* Inside Status Control Section */}
          <div className="expanded-status-control-strip">
            <div className="expanded-status-left">
              <span className="expanded-status-lbl">Deployment Status:</span>
              <span className={`status-pill status-${status.toLowerCase().replace(' ', '-')}`}>
                {status === 'Completed' ? '🟢 Completed' : status === 'On Hold' ? '🟡 On Hold' : status === 'Failed' ? '🔴 Failed' : '⏳ Pending'}
              </span>
            </div>
            {canEdit && (
              <div className="expanded-status-actions" onClick={(e) => e.stopPropagation()}>
                <span className="actions-prefix">Change Status:</span>
                <div className="card-status-quick-buttons">
                  {!isCompleted && (
                    <button
                      type="button"
                      className="status-action-btn complete-btn"
                      onClick={() => onStatusChange && onStatusChange(record.id, 'Completed')}
                      title="Mark site deployment as Completed"
                    >
                      ✓ Completed
                    </button>
                  )}
                  {!isOnHold && (
                    <button
                      type="button"
                      className="status-action-btn hold-btn"
                      onClick={() => onStatusChange && onStatusChange(record.id, 'On Hold')}
                      title="Put site deployment on Hold"
                    >
                      ⏸ Hold
                    </button>
                  )}
                  {!isFailed && (
                    <button
                      type="button"
                      className="status-action-btn fail-btn"
                      onClick={() => onStatusChange && onStatusChange(record.id, 'Failed')}
                      title="Mark site deployment as Failed / Issue"
                    >
                      ✕ Failed
                    </button>
                  )}
                  {!isPending && (
                    <button
                      type="button"
                      className="status-action-btn pending-btn"
                      onClick={() => onStatusChange && onStatusChange(record.id, 'Pending')}
                      title="Shift site back to Pending queue"
                    >
                      ↺ Pending
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hardware & Physical Details */}
          <div className="site-section-panel hardware-panel">
            <div className="panel-header-sub">
              <span>Hardware & Deployment</span>
            </div>
            <div className="hardware-info-grid">
              {!isBranch && (
                <div className="hw-col">
                  <span className="hw-lbl">Branch Base DP:</span>
                  <code className="hw-val highlight">{record.dpCode || 'Not recorded'}</code>
                </div>
              )}
              <div className="hw-col">
                <span className="hw-lbl">New SD-WAN S/N:</span>
                <code className="hw-val highlight">{record.newDeviceSerial || 'Not recorded'}</code>
              </div>
              <div className="hw-col">
                <span className="hw-lbl">Old Router Model:</span>
                <span className="hw-val">{record.oldDeviceModel || '—'}</span>
              </div>
              <div className="hw-col">
                <span className="hw-lbl">Old Router S/N:</span>
                <code className="hw-val">{record.oldDeviceSerial || '—'}</code>
              </div>
            </div>
          </div>

          {/* LAN & VLAN Routing */}
          <div className="site-section-panel lan-panel">
            <div className="panel-header-sub">
              <span>LAN Gateway & Subnets</span>
              <span className="source-pill-badge" title="Source of IP details">📂 IP Source: <strong>{record.ipSource || 'Sheet'}</strong></span>
              {record.isDhcp === 'Yes' && (
                <span className="dhcp-pill-badge">📶 DHCP Enabled</span>
              )}
            </div>

            <div className="lan-info-grid">
              <div className="lan-col">
                <span className="lan-lbl">LAN Gateway:</span>
                <code className="lan-val">{(record.primaryLanGateway || record.lanGateway || record.primaryLanIp) || '—'}</code>
              </div>
              <div className="lan-col">
                <span className="lan-lbl">Prefix / Subnet:</span>
                <code className="lan-val">{record.lanIpPrefix || '—'}</code>
              </div>
              <div className="lan-col">
                <span className="lan-lbl">VLAN Configured:</span>
                <span className="lan-val">
                  {record.vlanConfigured === 'Yes' ? (
                    <span className="vlan-tag-active">✓ {record.vlanDetails || 'VLAN Configured'}</span>
                  ) : (
                    'No VLAN'
                  )}
                </span>
              </div>
              {record.vlanConfigured === 'Yes' && (
                <div className="lan-col">
                  <span className="lan-lbl">Old VLAN Status:</span>
                  <span className="lan-val">{record.vlanRemoved || 'Not Removed'}</span>
                </div>
              )}
            </div>

            {/* Dynamic Secondary LAN Gateways */}
            {record.secondaryLanIps && record.secondaryLanIps.length > 0 && (
              <div className="secondary-lans-block">
                <span className="secondary-lan-title">Secondary LAN Gateways ({record.secondaryLanIps.length}/3):</span>
                <div className="chips-flow-row">
                  {record.secondaryLanIps.map((sec, idx) => (
                    <div key={idx} className="secondary-ip-tag">
                      <strong>{sec.gateway || sec.ip} {sec.prefix || ''}</strong>
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
                  {record.bsnlPresent === 'No' ? (
                    <span className="not-present-badge">Not Present</span>
                  ) : (
                    renderPingBadge(record.bsnlPing, Boolean(record.bsnlIp && record.bsnlIp.trim()))
                  )}
                </div>
                <div className="circuit-chips-col">
                  {record.bsnlPresent === 'No' ? (
                    <span className="dim-sub-text">⚪ Circuit not present at this branch</span>
                  ) : (
                    <>
                      {renderIpChip('IP', record.bsnlIp, `${record.id}-bsnlip`)}
                      {renderIpChip('GW', record.bsnlGateway, `${record.id}-bsnlgw`)}
                      {!record.bsnlIp && !record.bsnlGateway && (
                        <span className="dim-sub-text">No IP/Gateway configured</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Jio */}
              <div className="circuit-row">
                <div className="circuit-id-col">
                  <span className="isp-badge jio">Jio</span>
                  {record.jioPresent === 'No' ? (
                    <span className="not-present-badge">Not Present</span>
                  ) : (
                    renderPingBadge(record.jioPing, Boolean(record.jioIp && record.jioIp.trim()))
                  )}
                </div>
                <div className="circuit-chips-col">
                  {record.jioPresent === 'No' ? (
                    <span className="dim-sub-text">⚪ Circuit not present at this branch</span>
                  ) : (
                    <>
                      {renderIpChip('IP', record.jioIp, `${record.id}-jioip`)}
                      {renderIpChip('GW', record.jioGateway, `${record.id}-jiogw`)}
                      {!record.jioIp && !record.jioGateway && (
                        <span className="dim-sub-text">No IP/Gateway configured</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Airtel */}
              <div className="circuit-row">
                <div className="circuit-id-col">
                  <span className="isp-badge airtel">
                    Airtel{record.airtelIs4G === 'Yes' ? ' (4G)' : ''}
                  </span>
                  {record.airtelPresent === 'No' ? (
                    <span className="not-present-badge">Not Present</span>
                  ) : (
                    renderPingBadge(
                      record.airtelPing,
                      Boolean((record.airtelIp && record.airtelIp.trim()) || (record.airtelIs4G === 'Yes' && record.airtelLoopbackIp && record.airtelLoopbackIp.trim()))
                    )
                  )}
                </div>
                <div className="circuit-chips-col">
                  {record.airtelPresent === 'No' ? (
                    <span className="dim-sub-text">⚪ Circuit not present at this branch</span>
                  ) : (
                    <>
                      {record.airtelIs4G === 'Yes' && record.airtelLoopbackIp && (
                        renderIpChip('4G Loopback', record.airtelLoopbackIp, `${record.id}-airtelloop`)
                      )}
                      {renderIpChip('IP', record.airtelIp, `${record.id}-airtelip`)}
                      {renderIpChip('GW', record.airtelGateway, `${record.id}-airtelgw`)}
                      {!record.airtelIp && !record.airtelGateway && !record.airtelLoopbackIp && (
                        <span className="dim-sub-text">No IP/Gateway configured</span>
                      )}
                    </>
                  )}
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
                Online: {record.deviceOnline || 'No'}
              </span>
              <span className={`check-chip ${record.cablesConnected === 'Connected' ? 'done' : 'pending'}`}>
                Cables: {record.cablesConnected || 'Not connected'}
              </span>
              <span className={`check-chip ${record.uatSubmitted === 'Yes' ? 'done' : 'pending'}`}>
                UAT Form: {record.uatSubmitted === 'Yes' ? 'Given' : 'Pending'}
              </span>
              <span className={`check-chip ${(record.dcDrReply === 'Received' || record.dcMail === 'Received' || record.drcMail === 'Received') ? 'done' : 'pending'}`}>
                DC/DR Reply: {(record.dcDrReply || (record.dcMail === 'Received' || record.drcMail === 'Received' ? 'Received' : 'Not received'))}
              </span>
            </div>
          </div>

          {/* Notes if any */}
          {record.notes && (
            <div className="site-section-panel notes-panel">
              <div className="panel-header-sub">
                <span>Engineering Remarks</span>
              </div>
              <p className="site-notes-text">{record.notes}</p>
            </div>
          )}

          {/* NOC Handler History & Movement Log */}
          {handlerHistory.length > 0 && (
            <div className="site-section-panel handler-history-panel">
              <div className="panel-header-sub">
                <span>📜 NOC Handler History & Movements</span>
                <span className="history-count-badge">
                  {handlerHistory.length} event{handlerHistory.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="history-timeline">
                {handlerHistory.map((item, idx) => (
                  <div key={idx} className="history-timeline-item">
                    <div className="history-bullet"></div>
                    <div className="history-item-content">
                      <div className="history-top-line">
                        <span className="history-handler-name">
                          👤 <strong>{item.handlerName || item.handler}</strong>
                        </span>
                        <span className={`history-action-tag ${item.action?.includes('Hold') ? 'action-hold' : (item.action?.includes('Resumed') || item.action?.includes('Claimed') ? 'action-claim' : 'action-transfer')}`}>
                          {item.action}
                        </span>
                        <span className="history-time">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString(undefined, {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          }) : '—'}
                        </span>
                      </div>
                      {item.reason && (
                        <div className="history-reason-text">
                          💬 <em>"{item.reason}"</em>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Metadata */}
          <div className="site-card-footer">
            <span className="last-sync-meta">Updated: {formattedDate}</span>
            <div className="footer-actions">
              {canEdit && (
                <button
                  type="button"
                  className="card-text-action footer-edit-action"
                  onClick={() => onEdit(record)}
                  title="Edit full site specifications"
                >
                  ✏️ Edit Site Specifications
                </button>
              )}
              {onExport && (
                <button
                  type="button"
                  className="card-text-action"
                  onClick={() => onExport(record)}
                >
                  📥 Export Record
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
