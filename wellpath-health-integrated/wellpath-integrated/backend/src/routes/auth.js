import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
    
    const token = jwt.sign(
      { userId: user.user_id, role: user.role_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
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

export default router;