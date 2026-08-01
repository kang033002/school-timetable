const express = require('express');
const router = express.Router();
const { run, all, get } = require('../db/database');

// GET /api/master/schools
router.get('/schools', async (req, res) => {
  try {
    const list = await all(
      `SELECT s.*, u.email as admin_username, u.password_hash as admin_password
       FROM schools s
       LEFT JOIN user_accounts u ON u.school_id = s.id AND u.role = 'ADMIN'
       WHERE s.id != 'SYSTEM' 
       ORDER BY s.name`
    );
    res.json(list);
  } catch (err) {
    console.error('Fetch master schools error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/master/schools/approve
router.post('/schools/approve', async (req, res) => {
  try {
    const { schoolId, status } = req.body; // status: 'APPROVED', 'REJECTED'
    if (!schoolId || !status) {
      return res.status(400).json({ error: 'schoolId and status are required' });
    }

    await run(`UPDATE schools SET status = ? WHERE id = ?`, [status, schoolId]);
    res.json({ message: `학교 가입이 정상적으로 처리되었습니다. (${status})` });
  } catch (err) {
    console.error('Approve school error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/master/change-credentials
router.post('/change-credentials', async (req, res) => {
  try {
    const { userId, newUsername, newPassword } = req.body;
    if (!userId || !newUsername || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if username taken
    const existing = await get(`SELECT id FROM user_accounts WHERE email = ? AND id != ?`, [newUsername, userId]);
    if (existing) {
      return res.status(400).json({ error: 'Username already in use' });
    }

    await run(`UPDATE user_accounts SET email = ?, password_hash = ? WHERE id = ?`, [newUsername, newPassword, userId]);
    res.json({ message: 'Master credentials updated successfully' });
  } catch (err) {
    console.error('Master credentials change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
