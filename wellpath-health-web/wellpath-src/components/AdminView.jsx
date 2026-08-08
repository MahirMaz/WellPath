import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Gauge, Database, FileClock, HeartPulse, KeyRound, Lock,
  LogOut, Menu, Moon, RefreshCw, Search, ShieldCheck, Sun, Users, X,
} from 'lucide-react';
import { api } from '../api.js';
import '../styles/admin-workspace.css';
import AdminDashboard from './admin/AdminDashboard.jsx';

const navItems = [
  ['overview', 'Overview', Gauge],
  ['accounts', 'Accounts', Users],
  ['access', 'Access', KeyRound],
  ['connections', 'Connections', Database],
  ['audit', 'Audit', FileClock],
];

const roleLabels = { patient: 'Patient', trainer: 'Trainer', clinician: 'Clinician', dba: 'Admin' };

const emptyOverview = {
  accounts: { total: 0, active: 0, locked: 0, inactive: 0 },
  roles: [],
  consent: { totalPatients: 0, consented: 0 },
  activeAssignments: 0,
  auditEventsLast24h: 0,
  connectedAccounts: 0,
  system: { api: 'unknown', database: 'unknown', authentication: 'unknown' },
};

export default function AdminView({ user, onLogout, theme, setTheme }) {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(emptyOverview);
  const [accounts, setAccounts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [command, setCommand] = useState('');

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, accountData, connectionData, auditData] = await Promise.all([
        api.getAdminOverview(), api.getAdminUsers(), api.getAdminConnections(), api.getAdminAudit(),
      ]);
      setOverview(overviewData);
      setAccounts(accountData);
      setConnections(connectionData);
      setAudit(auditData);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message || 'The admin workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); }, []);
  useEffect(() => { window.scrollTo(0, 0); setMenuOpen(false); }, [tab]);

  const submitCommand = (event) => {
    event.preventDefault();
    const normalized = command.trim().toLowerCase();
    const match = navItems.find(([id, label]) => id.includes(normalized) || label.toLowerCase().includes(normalized));
    if (match) setTab(match[0]);
  };

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="admin-brand"><span><HeartPulse size={22} /></span><div><strong>WellPath</strong><small>Administration</small></div></div>
        <nav aria-label="Admin sections">
          {navItems.map(([id, label, Icon]) => (
            <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>
          ))}
        </nav>
        <div className="admin-privacy-mini"><ShieldCheck size={17} /><p>Operations only. Patient readings and private notes stay outside this workspace.</p></div>
      </aside>

      {menuOpen && <button className="admin-sidebar-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Open navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <div><span>System workspace</span><h1>{navItems.find(([id]) => id === tab)?.[1]}</h1></div>
          <form className="admin-command-search" onSubmit={submitCommand}>
            <Search size={16} />
            <label className="sr-only" htmlFor="admin-command-search">Go to admin section</label>
            <input id="admin-command-search" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Go to accounts, access, connections..." />
          </form>
          <div className="admin-top-actions">
            <span className="admin-signed-in">Signed in as <strong>{user?.name}</strong></span>
            <button type="button" title="Refresh data" onClick={loadAdminData} disabled={loading}><RefreshCw size={17} className={loading ? 'spinning' : ''} /></button>
            <button type="button" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
            <button type="button" title="Sign out" onClick={onLogout}><LogOut size={17} /></button>
          </div>
        </header>

        <div className="admin-content">
          {error && <div className="admin-error" role="alert"><span>{error}</span><button type="button" onClick={loadAdminData}>Try again</button></div>}
          {loading && !lastUpdated ? <AdminLoading /> : <>
            {tab === 'overview' && <AdminDashboard overview={overview} accounts={accounts} connections={connections} audit={audit} lastUpdated={lastUpdated} onNavigate={setTab} />}
            {tab === 'accounts' && <Accounts accounts={accounts} currentUserId={user?.id} onAccountsChange={setAccounts} />}
            {tab === 'access' && <AccessView overview={overview} />}
            {tab === 'connections' && <ConnectionsView connections={connections} />}
            {tab === 'audit' && <AuditView events={audit} />}
          </>}
        </div>
      </main>
    </div>
  );
}

function AdminLoading() {
  return <div className="admin-loading"><Activity className="spinning" size={24} /><p>Loading operational data...</p></div>;
}

function PanelHeading({ icon: Icon, title, caption }) {
  return <div className="admin-panel-heading"><span><Icon size={17} /></span><div><h3>{title}</h3><p>{caption}</p></div></div>;
}

function Accounts({ accounts, currentUserId, onAccountsChange }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const filtered = useMemo(() => accounts.filter((account) => {
    const matchesQuery = `${account.name} ${account.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (role === 'all' || account.role === role) && (status === 'all' || account.status === status);
  }), [accounts, query, role, status]);

  const changeStatus = async (account, nextStatus) => {
    setBusyId(account.id); setMessage('');
    try {
      const saved = await api.updateAdminUserStatus(account.id, nextStatus);
      onAccountsChange((rows) => rows.map((row) => row.id === account.id ? { ...row, status: saved.status } : row));
      setMessage(`${account.name}'s account is now ${saved.status}.`);
    } catch (error) { setMessage(error.message || 'The account could not be updated.'); }
    finally { setBusyId(null); }
  };

  return <div className="admin-page-flow"><section className="admin-page-heading"><div><span>Identity and access</span><h2>Account management</h2><p>Review roles and account status. Clinical content is not available here.</p></div></section>
    <section className="admin-toolbar"><label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /></label><select value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All roles</option>{Object.entries(roleLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="locked">Locked</option></select></section>
    {message && <p className="admin-form-message" role="status">{message}</p>}
    <section className="admin-panel admin-table-panel"><AccountTable rows={filtered} currentUserId={currentUserId} busyId={busyId} onStatusChange={changeStatus} emptyText="No accounts match those filters." /></section>
  </div>;
}

function AccountTable({ rows, currentUserId, busyId, onStatusChange, compact = false, emptyText }) {
  if (!rows.length) return <div className="admin-empty">{emptyText}</div>;
  return <div className="admin-table-scroll"><table className={compact ? 'compact' : ''}><thead><tr><th>Account</th><th>Role</th><th>Status</th>{onStatusChange && <th>Access</th>}</tr></thead><tbody>{rows.map((account) => <tr key={account.id}><td><strong>{account.name}</strong><small>{account.email}</small></td><td>{roleLabels[account.role] || account.role}</td><td><span className={`admin-status status-${account.status}`}>{account.status}</span></td>{onStatusChange && <td><select aria-label={`Change ${account.name} status`} disabled={busyId === account.id || Number(currentUserId) === Number(account.id)} value={account.status} onChange={(event) => onStatusChange(account, event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="locked">Locked</option></select></td>}</tr>)}</tbody></table></div>;
}

function AccessView({ overview }) {
  const rows = [
    ['Patient', 'Own summaries, food logs, mood, goals, and preferences', 'Other patients and operational admin tools'],
    ['Trainer', 'Assigned activity, shared goals, sessions, and feedback', 'Clinical readings, private mood entries, and AI conversations'],
    ['Clinician', 'Assigned patient trends, signals, care plans, and reports', 'Admin account controls and unrelated patients'],
    ['Admin', 'Accounts, roles, consent metadata, connections, and audit events', 'Individual readings, private notes, and AI conversations'],
  ];
  const rate = overview.consent.totalPatients ? Math.round((overview.consent.consented / overview.consent.totalPatients) * 100) : 0;
  return <div className="admin-page-flow"><section className="admin-page-heading"><div><span>Least-privilege review</span><h2>Roles and access</h2><p>Confirm what each workspace can see and where its boundary ends.</p></div></section>
    <section className="admin-access-summary"><article><ShieldCheck size={20} /><div><strong>{rate}% patient consent recorded</strong><span>{overview.consent.consented} of {overview.consent.totalPatients} patient profiles</span></div></article><article><Users size={20} /><div><strong>{overview.activeAssignments} active care assignments</strong><span>Trainer and clinician access mappings</span></div></article><article><Lock size={20} /><div><strong>Admin content restricted</strong><span>Operational metadata only</span></div></article></section>
    <section className="admin-panel admin-table-panel"><div className="admin-table-scroll"><table><thead><tr><th>Workspace</th><th>Can access</th><th>Cannot access</th></tr></thead><tbody>{rows.map(([workspace, allowed, denied]) => <tr key={workspace}><td><strong>{workspace}</strong></td><td>{allowed}</td><td>{denied}</td></tr>)}</tbody></table></div></section><PrivacyBoundary /></div>;
}

function ConnectionsView({ connections }) {
  return <div className="admin-page-flow"><section className="admin-page-heading"><div><span>Integration monitoring</span><h2>Health data connections</h2><p>See aggregate connection status without opening anyone's health data.</p></div></section><section className="admin-panel"><PanelHeading icon={Database} title="Connected services" caption="Grouped account status" /><ConnectionRows rows={connections} detailed /></section><section className="admin-connection-guidance"><div><strong>Read-only by design</strong><p>WellPath requests only approved summary data types from Apple Health or Health Connect.</p></div><div><strong>Patient-controlled permission</strong><p>Connection permission can be changed from the phone's system health settings.</p></div><div><strong>No admin health browsing</strong><p>Admins can monitor sync status, but not view the readings being synchronized.</p></div></section></div>;
}

function ConnectionRows({ rows, detailed = false }) {
  if (!rows.length) return <div className="admin-empty">No health connections have been registered yet.</div>;
  return <div className="connection-health-list">{rows.map((row, index) => <div key={`${row.provider}-${row.status}-${index}`}><span className={`connection-provider-icon status-${row.status}`}><Database size={16} /></span><div><strong>{row.provider === 'apple_health' ? 'Apple Health' : row.provider === 'health_connect' ? 'Health Connect' : row.provider}</strong><small>{detailed && row.last_sync ? `Last sync ${new Date(row.last_sync).toLocaleString()}` : `${row.accounts} account${row.accounts === 1 ? '' : 's'}`}</small></div><span className={`admin-status status-${row.status}`}>{row.status.replace('_', ' ')}</span><b>{row.accounts}</b></div>)}</div>;
}

function AuditView({ events }) {
  const [query, setQuery] = useState('');
  const filtered = events.filter((event) => `${event.actor} ${event.role} ${event.resource} ${event.action}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="admin-page-flow"><section className="admin-page-heading"><div><span>Traceable operations</span><h2>Audit activity</h2><p>Review who accessed or changed a system resource. Private record contents are never shown here.</p></div></section><section className="admin-toolbar"><label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit events" /></label></section><section className="admin-panel"><AuditRows rows={filtered} detailed /></section></div>;
}

function AuditRows({ rows, detailed = false }) {
  if (!rows.length) return <div className="admin-empty">No audit events match this view.</div>;
  return <div className="admin-audit-list">{rows.map((event) => <div key={event.id}><span className={`audit-action action-${String(event.action).toLowerCase()}`}>{event.action}</span><div><strong>{event.actor}</strong><p>{roleLabels[event.role] || event.role} accessed <b>{event.resource}</b></p></div>{detailed && <span>{new Date(event.occurredAt).toLocaleDateString()}</span>}<time>{new Date(event.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>)}</div>;
}

function PrivacyBoundary() {
  return <section className="admin-privacy-banner"><Lock size={21} /><div><strong>Admin privacy boundary</strong><p>This workspace manages platform operations. Individual health readings, clinician notes, patient mood entries, and AI conversations are intentionally unavailable.</p></div></section>;
}
