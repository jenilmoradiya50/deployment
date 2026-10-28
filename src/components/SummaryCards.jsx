import React from 'react';

export default function SummaryCards({ kind, totalKind, doneKind, totalAll }) {
  const pendingKind = Math.max(0, totalKind - doneKind);
  const percentage = totalKind > 0 ? Math.round((doneKind / totalKind) * 100) : 0;

  return (
    <div className="summary-cards-grid">
      <div className="kpi-card">
        <div className="kpi-top">
          <span className="kpi-title">Total {kind} Sites</span>
          <span className="kpi-icon-badge">🏢</span>
        </div>
        <div className="kpi-value">{totalKind}</div>
        <div className="kpi-subtitle">Managed deployments</div>
      </div>

      <div className="kpi-card good">
        <div className="kpi-top">
          <span className="kpi-title">Operational & Working</span>
          <span className="kpi-icon-badge good">✓</span>
        </div>
        <div className="kpi-value text-green">
          {doneKind}
          <span className="kpi-rate">({percentage}%)</span>
        </div>
        <div className="kpi-subtitle">Confirmed live and passing traffic</div>
      </div>

      <div className="kpi-card warn">
        <div className="kpi-top">
          <span className="kpi-title">Pending / Issues</span>
          <span className="kpi-icon-badge warn">⚠️</span>
        </div>
        <div className="kpi-value text-amber">{pendingKind}</div>
        <div className="kpi-subtitle">Setup incomplete or testing required</div>
      </div>

      <div className="kpi-card db">
        <div className="kpi-top">
          <span className="kpi-title">Database Records</span>
          <span className="kpi-icon-badge db">🗄️</span>
        </div>
        <div className="kpi-value">{totalAll}</div>
        <div className="kpi-subtitle">Total synced across Branches & ATMs</div>
      </div>
    </div>
  );
}
