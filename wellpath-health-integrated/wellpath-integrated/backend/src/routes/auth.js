import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { authenticate, generateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const [users] = await pool.query(`
      SELECT 
        u.user_id,
        u.role_id,
        u.account_status,
        u.password_hash,
        r.role_name,
        p.full_name,
        p.email
      FROM user_pii p
      JOIN users u ON u.user_id = p.user_id
      JOIN roles r ON r.role_id = u.role_id
      WHERE p.email = ?
    `, [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = users[0];
    
    if (user.account_status === 'locked') {
      return res.status(403).json({ error: 'Account locked' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = generateToken(user.user_id, user.role_name);
    
    let patientId = null;
    if (user.role_name === 'patient') {
      const [patients] = await pool.query(
        'SELECT patient_id FROM patient_profiles WHERE user_id = ?',
        [user.user_id]
      );
      if (patients.length > 0) {
        patientId = patients[0].patient_id;
      }
    }
    
    res.json({
      token,
      user: {
        id: user.user_id,
        name: user.full_name,
        role: user.role_name,
        patientId,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.user_id, r.role_name, p.full_name, p.email
      FROM users u
      JOIN roles r ON r.role_id = u.role_id
      JOIN user_pii p ON p.user_id = u.user_id
      WHERE u.user_id = ? AND u.account_status = 'active'
      LIMIT 1
    `, [req.user.userId]);

    if (!users.length) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = users[0];
    let patientId = null;
    if (account.role_name === 'patient') {
      const [patients] = await pool.query(
        'SELECT patient_id FROM patient_profiles WHERE user_id = ? LIMIT 1',
        [account.user_id]
      );
      patientId = patients[0]?.patient_id || null;
    }

    res.json({
      user: {
        id: account.user_id,
        name: account.full_name,
        role: account.role_name,
        patientId,
        email: account.email,
      },
    });
  } catch (error) {
    console.error('Session lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
