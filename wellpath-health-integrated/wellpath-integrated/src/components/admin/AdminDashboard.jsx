import React, { useMemo, useState } from 'react';
import {
  Activity, ArrowRight, CheckCircle2, Database, FileClock, KeyRound,
  Lock, RefreshCw, ShieldCheck, UserCog, Users,
} from 'lucide-react';

const roleLabels = { patient: 'Patient', trainer: 'Trainer', clinician: 'Clinician', dba: 'Admin' };

function providerLabel(provider = '') {
  if (provider === 'apple_health') return 'Apple Health';
  if (provider === 'health_connect') return 'Health Connect';
  return provider.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeLabel(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function connectionNeedsAttention(status = '') {
  return ['error', 'failed', 'sync_failed', 'degraded', 'expired'].includes(String(status).toLowerCase());
}

export default function AdminDashboard({ overview, accounts, connections, audit, lastUpdated, onNavigate }) {
  const [severity, setSeverity] = useState('all');
  const roleTotal = Math.max(1, overview.accounts.total);
  const activeAccounts = accounts.filter((account) => account.status === 'active').length;
  const accessReviews = accounts.filter((account) => account.status !== 'active');
  const connectionIssues = connections.filter((connection) => connectionNeedsAttention(connection.status));

  const attentionItems = useMemo(() => [
    ...accessReviews.map((account) => ({
      id: `account-${account.id}`,
      issue: account.status === 'locked' ? 'Locked account requires review' : 'Inactive account requires review',
      subject: account.name,
      context: `${roleLabels[account.role] || account.role} account`,
      severity: account.status === 'locked' ? 'high' : 'medium',
      status: account.status,
      destination: 'accounts',
    })),
    ...connectionIssues.map((connection, index) => ({
      id: `connection-${connection.provider}-${index}`,
      issue: 'Health data connection needs attention',
      subject: providerLabel(connection.provider),
      context: connection.last_sync ? `Last sync ${timeLabel(connection.last_sync)}` : 'No successful sync recorded',
      severity: 'high',
      status: String(connection.status).replaceAll('_', ' '),
      destination: 'connections',
    })),
  ], [accessReviews, connectionIssues]);
  const visibleAttention = severity === 'all' ? attentionItems : attentionItems.filter((item) => item.severity === severity);

  return <div className="admin-command-flow">
    <section className="admin-command-meta"><div><strong>System operations</strong><span>Identity, access, integrations, and audit only.</span></div><span><i /> Updated {lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'now'}</span></section>

    <section className="admin-command-kpis" aria-label="System operations summary">
      <AdminCommandKpi icon={Users} label="Active accounts" value={activeAccounts} detail={`${overview.accounts.total} total`} />
      <AdminCommandKpi icon={KeyRound} label="Access reviews" value={accessReviews.length} detail="Locked or inactive" tone={accessReviews.length ? 'attention' : ''} />
      <AdminCommandKpi icon={RefreshCw} label="Sync issues" value={connectionIssues.length} detail="Actionable failures" tone={connectionIssues.length ? 'danger' : ''} />
      <AdminCommandKpi icon={FileClock} label="Audit events" value={overview.auditEventsLast24h} detail="Last 24 hours" tone="blue" />
    </section>

    <div className="admin-command-top-grid">
      <section className="admin-command-panel admin-attention-panel">
        <div className="admin-command-heading"><div><h2>Attention queue</h2><p>Operational issues that need an administrator decision.</p></div><label><span className="sr-only">Filter queue severity</span><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option><option value="high">High</option><option value="medium">Medium</option></select></label></div>
        {visibleAttention.length ? <div className="admin-attention-table-wrap"><table className="admin-attention-table"><thead><tr><th>Issue</th><th>Affected account or service</th><th>Severity</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>
          {visibleAttention.map((item) => <tr key={item.id}><td><strong>{item.issue}</strong><small>{item.context}</small></td><td>{item.subject}</td><td><span className={`admin-severity ${item.severity}`}>{item.severity}</span></td><td><span className="admin-queue-status">{item.status}</span></td><td><button type="button" onClick={() => onNavigate(item.destination)}>Review</button></td></tr>)}
        </tbody></table></div> : <div className="admin-healthy-empty"><CheckCircle2 size={22} /><div><strong>No urgent operational items</strong><p>Services are responding and no locked or inactive accounts require action.</p></div><button type="button" onClick={() => onNavigate('access')}>Run access review <ArrowRight size={15} /></button></div>}
      </section>

      <section className="admin-command-panel admin-service-panel">
        <div className="admin-command-heading"><div><h2>Service health</h2><p>Current availability from the admin API.</p></div></div>
        <div className="admin-service-table"><div className="header"><span>Service</span><span>Status</span><span>Checked</span></div>{Object.entries(overview.system).map(([service, status]) => <div key={service}><strong>{service[0].toUpperCase() + service.slice(1)}</strong><span className={`admin-service-status ${status}`}><i /> {status}</span><time>{lastUpdated ? 'Just now' : 'Waiting'}</time></div>)}</div>
        <button className="admin-panel-link" type="button" onClick={() => onNavigate('connections')}>Review integrations <ArrowRight size={15} /></button>
      </section>
    </div>

    <div className="admin-command-middle-grid">
      <section className="admin-command-panel">
        <div className="admin-command-heading"><div><h2>Identity lifecycle</h2><p>Current account state.</p></div><UserCog size={18} /></div>
        <div className="admin-lifecycle-grid">
          <LifecycleRow label="Active" value={overview.accounts.active} total={roleTotal} tone="active" />
          <LifecycleRow label="Locked" value={overview.accounts.locked} total={roleTotal} tone="locked" />
          <LifecycleRow label="Inactive" value={overview.accounts.inactive} total={roleTotal} tone="inactive" />
        </div>
        <button className="admin-panel-link" type="button" onClick={() => onNavigate('accounts')}>Open account management <ArrowRight size={15} /></button>
      </section>

      <section className="admin-command-panel">
        <div className="admin-command-heading"><div><h2>Role distribution</h2><p>Active accounts by workspace.</p></div><Users size={18} /></div>
        <div className="admin-role-bars">{overview.roles.map((role) => <div key={role.role}><span>{roleLabels[role.role] || role.role}</span><i><em style={{ width: `${Math.max(4, (role.count / roleTotal) * 100)}%` }} /></i><strong>{role.count}</strong></div>)}</div>
        <button className="admin-panel-link" type="button" onClick={() => onNavigate('access')}>Review roles and permissions <ArrowRight size={15} /></button>
      </section>

      <section className="admin-command-panel">
        <div className="admin-command-heading"><div><h2>Connection health</h2><p>Aggregate status, never reading contents.</p></div><Database size={18} /></div>
        <div className="admin-connection-summary">{connections.slice(0, 5).map((connection, index) => <div key={`${connection.provider}-${index}`}><span className="admin-connection-mark"><Database size={15} /></span><div><strong>{providerLabel(connection.provider)}</strong><small>{connection.accounts} account{connection.accounts === 1 ? '' : 's'}</small></div><span className={`admin-service-status ${connection.status}`}><i /> {String(connection.status).replaceAll('_', ' ')}</span><time>{timeLabel(connection.last_sync)}</time></div>)}{!connections.length && <p className="admin-command-empty">No health data connections are registered.</p>}</div>
        <button className="admin-panel-link" type="button" onClick={() => onNavigate('connections')}>Open connection monitoring <ArrowRight size={15} /></button>
      </section>
    </div>

    <section className="admin-command-panel admin-audit-panel">
      <div className="admin-command-heading"><div><h2>Recent audit activity</h2><p>Who acted, what resource changed, and when.</p></div><button type="button" onClick={() => onNavigate('audit')}>View full audit log <ArrowRight size={15} /></button></div>
      <div className="admin-command-audit"><div className="header"><span>Time</span><span>Event</span><span>Actor</span><span>Role</span><span>Resource</span></div>{audit.slice(0, 6).map((event) => <div key={event.id}><time>{new Date(event.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time><span className="admin-event-name">{String(event.action).replaceAll('_', ' ')}</span><strong>{event.actor}</strong><span>{roleLabels[event.role] || event.role}</span><span>{event.resource}</span></div>)}</div>
    </section>

    <section className="admin-command-boundary"><Lock size={17} /><p><strong>Least-privilege boundary:</strong> administrators can manage platform operations and access metadata, but cannot open patient readings, clinical notes, mood entries, or AI conversations.</p><ShieldCheck size={17} /></section>
  </div>;
}

function AdminCommandKpi({ icon: Icon, label, value, detail, tone = '' }) {
  return <article className={`admin-command-kpi ${tone}`}><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function LifecycleRow({ label, value, total, tone }) {
  const percentage = Math.round((value / total) * 100);
  return <div><span><i className={tone} /> {label}</span><strong>{value}</strong><em>{percentage}%</em><b><i className={tone} style={{ width: `${percentage}%` }} /></b></div>;
}
