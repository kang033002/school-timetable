const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

// 1. GET /api/admin/users/pending?schoolId=...
router.get('/users/pending', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const users = await all(
      `SELECT u.*, t.name as teacher_name 
       FROM user_accounts u
       LEFT JOIN teachers t ON u.teacher_id = t.id
       WHERE u.school_id = ? AND u.status = 'PENDING'`,
      [schoolId]
    );
    res.json(users);
  } catch (err) {
    console.error('Fetch pending users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. POST /api/admin/users/approve
router.post('/users/approve', async (req, res) => {
  try {
    const { userId, status } = req.body; // status: 'APPROVED' or 'REJECTED'
    if (!userId || !status) return res.status(400).json({ error: 'userId and status are required' });

    await run(
      `UPDATE user_accounts SET status = ? WHERE id = ?`,
      [status, userId]
    );

    res.json({ message: `User account status updated to ${status}` });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. POST /api/admin/teachers (Create/Update teacher)
router.post('/teachers', async (req, res) => {
  try {
    const { id, schoolId, name, code, subjectName } = req.body;
    if (!schoolId || !name) return res.status(400).json({ error: 'schoolId and name are required' });

    if (id) {
      // Update
      await run(
        `UPDATE teachers SET name = ?, code = ?, subject_name = ? WHERE id = ? AND school_id = ?`,
        [name, code || null, subjectName || null, id, schoolId]
      );
      res.json({ message: 'Teacher updated successfully' });
    } else {
      // Create
      const newId = `t-${Date.now()}`;
      await run(
        `INSERT INTO teachers (id, school_id, name, code, subject_name) VALUES (?, ?, ?, ?, ?)`,
        [newId, schoolId, name, code || null, subjectName || null]
      );
      res.status(201).json({ message: 'Teacher created successfully', id: newId });
    }
  } catch (err) {
    console.error('Teacher setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. POST /api/admin/subjects (Create/Update subject)
router.post('/subjects', async (req, res) => {
  try {
    const { id, schoolId, name, shortName } = req.body;
    if (!schoolId || !name) return res.status(400).json({ error: 'schoolId and name are required' });

    if (id) {
      // Update
      await run(
        `UPDATE subjects SET name = ?, short_name = ? WHERE id = ? AND school_id = ?`,
        [name, shortName || null, id, schoolId]
      );
      res.json({ message: 'Subject updated successfully' });
    } else {
      // Create
      const newId = `sub-${Date.now()}`;
      await run(
        `INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`,
        [newId, schoolId, name, shortName || null]
      );
      res.status(201).json({ message: 'Subject created successfully', id: newId });
    }
  } catch (err) {
    console.error('Subject setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. POST /api/admin/classes (Create/Update GradeClass)
router.post('/classes', async (req, res) => {
  try {
    const { id, schoolId, grade, classNumber, homeroomTeacherId } = req.body;
    if (!schoolId || !grade || !classNumber) {
      return res.status(400).json({ error: 'schoolId, grade, and classNumber are required' });
    }

    if (id) {
      // Update
      await run(
        `UPDATE grade_classes SET grade = ?, class_number = ?, homeroom_teacher_id = ? WHERE id = ? AND school_id = ?`,
        [grade, classNumber, homeroomTeacherId || null, id, schoolId]
      );
      res.json({ message: 'Class updated successfully' });
    } else {
      // Create
      const newId = `gc-${schoolId}-${grade}-${classNumber}`;
      // Check unique constraint manually
      const existing = await get(
        `SELECT id FROM grade_classes WHERE school_id = ? AND grade = ? AND class_number = ?`,
        [schoolId, grade, classNumber]
      );
      if (existing) {
        return res.status(400).json({ error: 'Class number already exists in this grade' });
      }

      await run(
        `INSERT INTO grade_classes (id, school_id, grade, class_number, homeroom_teacher_id) VALUES (?, ?, ?, ?, ?)`,
        [newId, schoolId, grade, classNumber, homeroomTeacherId || null]
      );
      res.status(201).json({ message: 'Class created successfully', id: newId });
    }
  } catch (err) {
    console.error('Class setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. DELETE /api/admin/teachers/:id
router.delete('/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`DELETE FROM teachers WHERE id = ?`, [id]);
    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 7. DELETE /api/admin/subjects/:id
router.delete('/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`DELETE FROM subjects WHERE id = ?`, [id]);
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. POST /api/admin/change-credentials
router.post('/change-credentials', async (req, res) => {
  try {
    const { userId, newEmail, newPassword } = req.body;
    if (!userId || !newEmail || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if new email is taken by another user
    const existing = await get(`SELECT id FROM user_accounts WHERE email = ? AND id != ?`, [newEmail, userId]);
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    await run(
      `UPDATE user_accounts SET email = ?, password_hash = ? WHERE id = ?`,
      [newEmail, newPassword, userId]
    );

    res.json({ message: 'Credentials updated successfully' });
  } catch (err) {
    console.error('Change credentials error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. POST /api/admin/base-timetable (Upsert base timetable slot)
router.post('/base-timetable', async (req, res) => {
  try {
    const { schoolId, gradeClassId, dayOfWeek, period, subjectId, teacherId, roomId } = req.body;
    if (!schoolId || !gradeClassId || !dayOfWeek || !period || !subjectId || !teacherId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const id = `bt-${gradeClassId}-${dayOfWeek}-${period}`;
    await run(
      `INSERT INTO base_timetable (id, school_id, grade_class_id, day_of_week, period, teacher_id, subject_id, room_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(grade_class_id, day_of_week, period) DO UPDATE SET
       teacher_id = excluded.teacher_id,
       subject_id = excluded.subject_id,
       room_id = excluded.room_id`,
      [id, schoolId, gradeClassId, dayOfWeek, period, teacherId, subjectId, roomId || null]
    );

    res.json({ message: 'Base timetable slot updated successfully' });
  } catch (err) {
    console.error('Base timetable update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 10. GET /api/admin/holidays
router.get('/holidays', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const list = await all(`SELECT * FROM holidays WHERE school_id = ? ORDER BY target_date`, [schoolId]);
    res.json(list);
  } catch (err) {
    console.error('Fetch holidays error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 11. POST /api/admin/holidays
router.post('/holidays', async (req, res) => {
  try {
    const { schoolId, targetDate, name } = req.body;
    if (!schoolId || !targetDate || !name) return res.status(400).json({ error: 'Missing parameters' });

    const id = `hol-${Date.now()}`;
    await run(
      `INSERT OR REPLACE INTO holidays (id, school_id, target_date, name) VALUES (?, ?, ?, ?)`,
      [id, schoolId, targetDate, name]
    );

    res.status(201).json({ message: 'Holiday registered successfully' });
  } catch (err) {
    console.error('Register holiday error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 12. DELETE /api/admin/holidays/:id
router.delete('/holidays/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`DELETE FROM holidays WHERE id = ?`, [id]);
    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    console.error('Delete holiday error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
