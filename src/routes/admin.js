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

// 1.5 GET /api/admin/students/approved?schoolId=...
router.get('/students/approved', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const students = await all(
      `SELECT * FROM user_accounts WHERE school_id = ? AND role = 'STUDENT' AND status = 'APPROVED'`,
      [schoolId]
    );
    res.json(students);
  } catch (err) {
    console.error('Fetch approved students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1.6 DELETE /api/admin/users
router.delete('/users', async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ error: 'User IDs are required' });
    
    const idList = ids.split(',').map(id => id.trim());
    if (idList.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    const placeholders = idList.map(() => '?').join(',');
    
    await run(
      `DELETE FROM user_accounts WHERE id IN (${placeholders})`,
      idList
    );

    res.json({ message: 'Users deleted successfully' });
  } catch (err) {
    console.error('Delete users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1.7 PUT /api/admin/users/:userId
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    // Check if email is already taken by another user
    const existing = await get(`SELECT id FROM user_accounts WHERE email = ? AND id != ?`, [email, userId]);
    if (existing) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }

    await run(
      `UPDATE user_accounts SET email = ?, password_hash = ? WHERE id = ?`,
      [email, password, userId]
    );
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
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
    const { id, schoolId, name, code, subjectName, email, password } = req.body;
    if (!schoolId || !name) return res.status(400).json({ error: 'schoolId and name are required' });

    let teacherId = id;
    if (teacherId) {
      // Update teacher
      await run(
        `UPDATE teachers SET name = ?, code = ?, subject_name = ? WHERE id = ? AND school_id = ?`,
        [name, code || null, subjectName || null, teacherId, schoolId]
      );
      // Update user_account
      if (email && password) {
        const existing = await get(`SELECT id FROM user_accounts WHERE email = ? AND (teacher_id != ? OR teacher_id IS NULL)`, [email, teacherId]);
        if (existing) {
          return res.status(400).json({ error: '이미 사용 중인 교사 아이디입니다.' });
        }
        const userAcc = await get(`SELECT id FROM user_accounts WHERE teacher_id = ?`, [teacherId]);
        if (userAcc) {
          await run(
            `UPDATE user_accounts SET email = ?, password_hash = ?, name = ? WHERE teacher_id = ?`,
            [email, password, name, teacherId]
          );
        } else {
          const userId = `u-t-${Date.now()}`;
          await run(
            `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
             VALUES (?, ?, ?, ?, 'TEACHER', ?, ?, 'APPROVED')`,
            [userId, schoolId, email, password, teacherId, name]
          );
        }
      }
    } else {
      // Create teacher
      teacherId = `t-${Date.now()}`;
      await run(
        `INSERT INTO teachers (id, school_id, name, code, subject_name) VALUES (?, ?, ?, ?, ?)`,
        [teacherId, schoolId, name, code || null, subjectName || null]
      );
      if (email && password) {
        const existing = await get(`SELECT id FROM user_accounts WHERE email = ?`, [email]);
        if (existing) {
          return res.status(400).json({ error: '이미 사용 중인 교사 아이디입니다.' });
        }
        const userId = `u-t-${Date.now()}`;
        await run(
          `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
           VALUES (?, ?, ?, ?, 'TEACHER', ?, ?, 'APPROVED')`,
          [userId, schoolId, email, password, teacherId, name]
        );
      }
    }

    // Auto-create subject if it doesn't exist
    if (subjectName) {
      const existingSub = await get(`SELECT id FROM subjects WHERE school_id = ? AND name = ?`, [schoolId, subjectName]);
      if (!existingSub) {
        const subId = `s-${Date.now()}`;
        await run(`INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`, [subId, schoolId, subjectName, subjectName]);
      }
    }

    res.status(200).json({ message: 'Teacher saved successfully', id: teacherId });
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
    await run(`DELETE FROM user_accounts WHERE teacher_id = ?`, [id]);
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

// DELETE /api/admin/classes/:id
router.delete('/classes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });

    await run(`DELETE FROM base_timetable WHERE grade_class_id = ?`, [id]);
    await run(`DELETE FROM timetable_changes WHERE grade_class_id = ?`, [id]);
    await run(`DELETE FROM grade_classes WHERE id = ?`, [id]);

    res.json({ message: 'Class deleted successfully' });
  } catch (err) {
    console.error('Delete class error:', err);
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

// POST /api/admin/reset-timetable
router.post('/reset-timetable', async (req, res) => {
  try {
    const { schoolId } = req.body;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    await run(`DELETE FROM base_timetable WHERE school_id = ?`, [schoolId]);
    await run(`DELETE FROM timetable_changes WHERE school_id = ?`, [schoolId]);

    res.json({ message: '학교의 모든 시간표 데이터가 완전히 초기화되었습니다.' });
  } catch (err) {
    console.error('Reset timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 9. POST /api/admin/base-timetable (Upsert base timetable slot)
router.post('/base-timetable', async (req, res) => {
  try {
    const { schoolId, gradeClassId, dayOfWeek, period, subjectId, teacherId, roomId, force } = req.body;
    if (!schoolId || !gradeClassId || !dayOfWeek || !period || !subjectId || !teacherId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // ── 충돌 감지: 동일 교사가 같은 요일+교시에 다른 반에 이미 배정되어 있는지 확인 ──
    if (!force) {
      const conflictingSlots = await all(
        `SELECT bt.grade_class_id, gc.grade, gc.class_number, t.name as teacher_name, s.name as subject_name
         FROM base_timetable bt
         JOIN grade_classes gc ON bt.grade_class_id = gc.id
         JOIN teachers t ON bt.teacher_id = t.id
         JOIN subjects s ON bt.subject_id = s.id
         WHERE bt.school_id = ? AND bt.day_of_week = ? AND bt.period = ?
           AND bt.teacher_id = ? AND bt.grade_class_id != ?`,
        [schoolId, dayOfWeek, period, teacherId, gradeClassId]
      );

      if (conflictingSlots.length > 0) {
        const dayNames = ['', '월', '화', '수', '목', '금', '토', '일'];
        const dayName = dayNames[dayOfWeek] || dayOfWeek;
        const conflicts = conflictingSlots.map(slot => ({
          type: 'TEACHER_DUPLICATE',
          message: `[교사 충돌] ${slot.teacher_name} 선생님은 동일 시간(${dayName}요일 ${period}교시)에 ${slot.grade}학년 ${slot.class_number}반 (${slot.subject_name})에 이미 배정되어 있습니다.`
        }));
        return res.status(409).json({ hasConflict: true, conflicts });
      }
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
      `INSERT INTO holidays (id, school_id, target_date, name) VALUES (?, ?, ?, ?)
       ON CONFLICT(school_id, target_date) DO UPDATE SET name = EXCLUDED.name, id = EXCLUDED.id`,
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
