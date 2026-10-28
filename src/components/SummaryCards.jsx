import React from 'react';

export default function SummaryCards({
  kind,
  total = 0,
  completed = 0,
  pending = 0,
  onHold = 0,
  failed = 0,
  activeFilter = 'all',
  onSelectStatus
}) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="summary-cards-grid">
      {/* 1. Total */}
      <div
        className={`kpi-card ${activeFilter === 'all' ? 'is-active-filter' : ''}`}
        onClick={() => onSelectStatus && onSelectStatus('all')}
        title="Click to view all deployments"
      >
        <div className="kpi-top">
          <span className="kpi-title">{kind === 'All' ? 'Total Deployments' : `Total ${kind}s`}</span>
          <span className="kpi-icon-badge">{kind === 'ATM' ? '🏧' : '🏢'}</span>
        </div>
        <div className="kpi-value">{total}</div>
        <div className="kpi-subtitle">Managed deployments</div>
      </div>

      {/* 2. Pending */}
      <div
        className={`kpi-card kpi-pending ${activeFilter === 'pending' ? 'is-active-filter' : ''}`}
        onClick={() => onSelectStatus && onSelectStatus('pending')}
        title="Click to filter Pending queue"
      >
        <div className="kpi-top">
          <span className="kpi-title">⏳ Pending</span>
          <span className="kpi-icon-badge warn">⏳</span>
        </div>
        <div className="kpi-value text-amber">{pending}</div>
        <div className="kpi-subtitle">Awaiting setup & testing</div>
      </div>

      {/* 3. Completed */}
      <div
        className={`kpi-card kpi-completed ${activeFilter === 'completed' ? 'is-active-filter' : ''}`}
        onClick={() => onSelectStatus && onSelectStatus('completed')}
        title="Click to filter Completed deployments"
      >
        <div className="kpi-top">
          <span className="kpi-title">🟢 Completed</span>
          <span className="kpi-icon-badge good">✓</span>
        </div>
        <div className="kpi-value text-green">
          {completed}
          <span className="kpi-rate">({percentage}%)</span>
        </div>
        <div className="kpi-subtitle">Live, tested & verified</div>
      </div>

      {/* 4. On Hold */}
      <div
        className={`kpi-card kpi-onhold ${activeFilter === 'onHold' ? 'is-active-filter' : ''}`}
        onClick={() => onSelectStatus && onSelectStatus('onHold')}
        title="Click to filter On Hold deployments"
      >
        <div className="kpi-top">
          <span className="kpi-title">🟡 On Hold</span>
          <span className="kpi-icon-badge hold">⏸</span>
        </div>
        <div className="kpi-value text-purple">{onHold}</div>
        <div className="kpi-subtitle">Waiting on ISP or branch access</div>
      </div>

      {/* 5. Failed */}
      <div
        className={`kpi-card kpi-failed ${activeFilter === 'failed' ? 'is-active-filter' : ''}`}
        onClick={() => onSelectStatus && onSelectStatus('failed')}
        title="Click to filter Failed deployments"
      >
        <div className="kpi-top">
          <span className="kpi-title">🔴 Failed</span>
          <span className="kpi-icon-badge fail">✕</span>
        </div>
        <div className="kpi-value text-rose">{failed}</div>
        <div className="kpi-subtitle">Circuit or config issues</div>
      </div>
    </div>
  );
}
