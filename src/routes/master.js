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

    if (status === 'REJECTED') {
      await run(`DELETE FROM schools WHERE id = ?`, [schoolId]);
      await run(`DELETE FROM user_accounts WHERE school_id = ?`, [schoolId]);
    } else {
      await run(`UPDATE schools SET status = ? WHERE id = ?`, [status, schoolId]);
      await run(`UPDATE user_accounts SET status = ? WHERE school_id = ?`, [status, schoolId]);
    }
    res.json({ message: `학교 가입이 정상적으로 처리되었습니다. (${status})` });
  } catch (err) {
    console.error('Approve school error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/master/me/:userId
router.get('/me/:userId', async (req, res) => {
  try {
    const user = await get(`SELECT email, password_hash FROM user_accounts WHERE id = ?`, [req.params.userId]);
    if (user) {
      res.json({ email: user.email, password: user.password_hash });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    console.error('Fetch master info error:', err);
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
      return res.status(400).json({ error: '이미 사용중인 관리자 ID입니다. 다른 ID를 입력해주세요.' });
    }

    await run(`UPDATE user_accounts SET email = ?, password_hash = ? WHERE id = ?`, [newUsername, newPassword, userId]);
    res.json({ message: 'Master credentials updated successfully' });
  } catch (err) {
    console.error('Master credentials change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/master/schools/:id
router.delete('/schools/:id', async (req, res) => {
  try {
    const schoolId = req.params.id;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    // Ensure we don't delete SYSTEM
    if (schoolId === 'SYSTEM') return res.status(400).json({ error: 'Cannot delete SYSTEM school' });

    await run(`DELETE FROM user_accounts WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM grade_classes WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM teachers WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM subjects WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM base_timetable WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM timetable_changes WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM schools WHERE id = ?`, [schoolId]);
    
    res.json({ message: '학교가 삭제되었습니다.' });
  } catch (err) {
    console.error('Delete school error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/master/schools/batch-delete
router.post('/schools/batch-delete', async (req, res) => {
  try {
    const { schoolIds } = req.body;
    if (!Array.isArray(schoolIds) || schoolIds.length === 0) {
      return res.status(400).json({ error: 'schoolIds array is required' });
    }

    // Filter out SYSTEM just in case
    const validIds = schoolIds.filter(id => id !== 'SYSTEM');

    for (const schoolId of validIds) {
      await run(`DELETE FROM user_accounts WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM grade_classes WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM teachers WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM subjects WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM base_timetable WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM timetable_changes WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM schools WHERE id = ?`, [schoolId]);
    }

    res.json({ message: `${validIds.length}개의 학교가 일괄 삭제되었습니다.` });
  } catch (err) {
    console.error('Batch delete schools error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/master/schools/update-admin
router.post('/schools/update-admin', async (req, res) => {
  try {
    const { schoolId, adminUsername, adminPassword, schoolCode } = req.body;
    if (!schoolId || !adminUsername || !adminPassword || !schoolCode) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const adminAccount = await get(
      `SELECT id FROM user_accounts WHERE school_id = ? AND role = 'ADMIN'`,
      [schoolId]
    );

    if (!adminAccount) {
      return res.status(404).json({ error: 'School admin account not found' });
    }

    const existingEmail = await get(
      `SELECT id FROM user_accounts WHERE email = ? AND id != ?`,
      [adminUsername, adminAccount.id]
    );
    if (existingEmail) {
      return res.status(400).json({ error: '이미 사용중인 관리자 ID입니다. 다른 ID를 입력해주세요.' });
    }

    const existingCode = await get(
      `SELECT id FROM schools WHERE code = ? AND id != ?`,
      [schoolCode, schoolId]
    );
    if (existingCode) {
      return res.status(400).json({ error: '이미 사용중인 학교 코드입니다. 다른 코드를 입력해주세요.' });
    }

    await run(
      `UPDATE schools SET code = ? WHERE id = ?`,
      [schoolCode, schoolId]
    );

    await run(
      `UPDATE user_accounts SET email = ?, password_hash = ? WHERE id = ?`,
      [adminUsername, adminPassword, adminAccount.id]
    );

    res.json({ message: '학교 관리자 계정 정보가 성공적으로 변경되었습니다.' });
  } catch (err) {
    console.error('Update school admin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
