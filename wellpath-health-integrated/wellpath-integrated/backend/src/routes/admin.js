import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, authorize('dba'));

async function connectionSummary() {
  try {
    const [rows] = await pool.query(`
      SELECT provider, connection_status AS status, COUNT(*) AS accounts,
        MAX(last_sync) AS last_sync
      FROM patient_health_connections
      GROUP BY provider, connection_status
      ORDER BY provider, connection_status
    `);
    return rows.map((row) => ({ ...row, accounts: Number(row.accounts) || 0 }));
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return [];
    throw error;
  }
}

router.get('/overview', async (req, res) => {
  try {
    const [[accountCounts], [roleRows], [patientCounts], [assignmentCounts], [auditCounts], connections] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total_accounts,
        SUM(account_status = 'active') AS active_accounts,
        SUM(account_status = 'locked') AS locked_accounts,
        SUM(account_status = 'inactive') AS inactive_accounts FROM users`),
      pool.query(`SELECT r.role_name AS role, COUNT(*) AS count
        FROM users u JOIN roles r ON r.role_id = u.role_id
        GROUP BY r.role_name ORDER BY r.role_name`),
      pool.query(`SELECT COUNT(*) AS patients, SUM(consent_status = 1) AS consented FROM patient_profiles`),
      pool.query(`SELECT COUNT(*) AS active_assignments FROM care_assignments WHERE end_date IS NULL`),
      pool.query(`SELECT COUNT(*) AS events_last_24h FROM access_audit_log WHERE access_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)`),
      connectionSummary(),
    ]);
    const accounts = accountCounts[0] || {};
    const patients = patientCounts[0] || {};
    res.json({
      accounts: {
        total: Number(accounts.total_accounts) || 0,
        active: Number(accounts.active_accounts) || 0,
        locked: Number(accounts.locked_accounts) || 0,
        inactive: Number(accounts.inactive_accounts) || 0,
      },
      roles: roleRows.map((row) => ({ role: row.role, count: Number(row.count) || 0 })),
      consent: { totalPatients: Number(patients.patients) || 0, consented: Number(patients.consented) || 0 },
      activeAssignments: Number(assignmentCounts[0]?.active_assignments) || 0,
      auditEventsLast24h: Number(auditCounts[0]?.events_last_24h) || 0,
      connectedAccounts: connections.filter((item) => item.status === 'connected').reduce((sum, item) => sum + item.accounts, 0),
      system: { api: 'operational', database: 'operational', authentication: 'operational' },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Could not load the admin overview.' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.user_id AS id, p.full_name AS name, p.email, r.role_name AS role,
        u.account_status AS status, u.created_at AS createdAt
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      JOIN user_pii p ON p.user_id = u.user_id
      ORDER BY FIELD(r.role_name, 'dba', 'clinician', 'trainer', 'patient'), p.full_name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Could not load accounts.' });
  }
});

router.patch('/users/:userId/status', async (req, res) => {
  try {
    const status = String(req.body.status || '');
    if (!['active', 'inactive', 'locked'].includes(status)) {
      return res.status(400).json({ error: 'Unsupported account status.' });
    }
    if (Number(req.params.userId) === Number(req.user.userId) && status !== 'active') {
      return res.status(400).json({ error: 'You cannot disable your own active admin session.' });
    }
    const [result] = await pool.query('UPDATE users SET account_status = ? WHERE user_id = ?', [status, req.params.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Account not found.' });
    await pool.query(`INSERT INTO access_audit_log
      (accessed_by_user_id, patient_id, table_name, access_type)
      VALUES (?, NULL, 'users.account_status', 'UPDATE')`, [req.user.userId]);
    res.json({ id: Number(req.params.userId), status });
  } catch (error) {
    console.error('Admin status update error:', error);
    res.status(500).json({ error: 'Could not update the account.' });
  }
});

router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 80, 1), 200);
    const [rows] = await pool.query(`
      SELECT a.audit_id AS id, actor.full_name AS actor, r.role_name AS role,
        a.table_name AS resource, a.access_type AS action, a.access_time AS occurredAt
      FROM access_audit_log a
      JOIN user_pii actor ON actor.user_id = a.accessed_by_user_id
      JOIN users u ON u.user_id = a.accessed_by_user_id
      JOIN roles r ON r.role_id = u.role_id
      ORDER BY a.access_time DESC LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (error) {
    console.error('Admin audit error:', error);
    res.status(500).json({ error: 'Could not load audit activity.' });
  }
});

router.get('/connections', async (req, res) => {
  try {
    res.json(await connectionSummary());
  } catch (error) {
    console.error('Admin connections error:', error);
    res.status(500).json({ error: 'Could not load connection health.' });
  }
});

export default router;
