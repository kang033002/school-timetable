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
    const { ids, schoolId } = req.query;
    
    if (ids === 'ALL_STUDENTS') {
      if (!schoolId) return res.status(400).json({ error: 'schoolId is required for deleting all students' });
      await run(`DELETE FROM user_accounts WHERE school_id = ? AND role = 'STUDENT'`, [schoolId]);
      return res.json({ message: 'All students deleted successfully' });
    }

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

// Bulk student registration by admin
router.post('/users/register-students-bulk', async (req, res) => {
  try {
    const { schoolId, students } = req.body;
    if (!schoolId || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'schoolId and students list are required' });
    }

    const results = [];
    for (const student of students) {
      const { grade, classNumber, name } = student;
      if (!grade || !classNumber || !name) continue;

      const paddedClass = String(classNumber).padStart(2, '0');
      const prefix = `s${grade}${paddedClass}`;
      
      // Count existing students to generate sequential number
      const countRow = await get(
        `SELECT COUNT(*) as cnt FROM user_accounts WHERE school_id = ? AND email LIKE ?`,
        [schoolId, `${prefix}%`]
      );
      const nextSeq = String(countRow.cnt + 1).padStart(2, '0');
      const email = `${prefix}${nextSeq}`;
      const password = '1234'; // Default password

      const userId = `u-s-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const displayName = `${name} (${grade}학년 ${classNumber}반 학생)`;

      await run(
        `INSERT INTO user_accounts (id, school_id, email, password_hash, role, name, status, grade, class_number)
         VALUES (?, ?, ?, ?, 'STUDENT', ?, 'APPROVED', ?, ?)`,
        [userId, schoolId, email, password, displayName, grade, classNumber]
      );

      results.push({ id: userId, email, password, name, grade, classNumber });
    }

    res.json({ message: 'Students registered successfully', registered: results });
  } catch (err) {
    console.error('Bulk register students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk delete teachers
router.delete('/teachers', async (req, res) => {
  try {
    const { ids, schoolId } = req.query;
    if (ids === 'ALL_TEACHERS') {
      if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
      const teachers = await all(`SELECT id FROM teachers WHERE school_id = ?`, [schoolId]);
      const teacherIds = teachers.map(t => t.id);
      if (teacherIds.length > 0) {
        const placeholders = teacherIds.map(() => '?').join(',');
        await run(`DELETE FROM user_accounts WHERE teacher_id IN (${placeholders})`, teacherIds);
      }
      await run(`DELETE FROM teachers WHERE school_id = ?`, [schoolId]);
      await run(`DELETE FROM subjects WHERE school_id = ?`, [schoolId]);
      return res.json({ message: 'All teachers deleted successfully' });
    }

    if (!ids) return res.status(400).json({ error: 'ids is required' });
    const idList = ids.split(',').map(id => id.trim());
    if (idList.length === 0) return res.status(400).json({ error: 'No IDs provided' });

    const placeholders = idList.map(() => '?').join(',');
    await run(`DELETE FROM user_accounts WHERE teacher_id IN (${placeholders})`, idList);
    await run(`DELETE FROM teachers WHERE id IN (${placeholders})`, idList);
    res.json({ message: 'Teachers deleted successfully' });
  } catch (err) {
    console.error('Delete teachers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1.7 PUT /api/admin/users/:userId
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, password, name, grade, classNumber } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    // Check if email is already taken by another user
    const existing = await get(`SELECT id FROM user_accounts WHERE email = ? AND id != ?`, [email, userId]);
    if (existing) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    }

    const user = await get(`SELECT * FROM user_accounts WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let finalName = name || user.name;
    if (user.role === 'STUDENT' && name && grade && classNumber) {
      // Reconstruct display name for students
      finalName = `${name} (${grade}학년 ${classNumber}반 학생)`;
    }

    await run(
      `UPDATE user_accounts 
       SET email = ?, password_hash = ?, name = ?, grade = ?, class_number = ? 
       WHERE id = ?`,
      [email, password, finalName, grade || null, classNumber || null, userId]
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
    const { userId, userIds, status, updates } = req.body; // status: 'APPROVED' or 'REJECTED', updates: [{id, email, password_hash}]
    if (!status) return res.status(400).json({ error: 'status is required' });

    const targetIds = userIds && Array.isArray(userIds) ? userIds : (userId ? [userId] : []);
    if (targetIds.length === 0) return res.status(400).json({ error: 'userId or userIds required' });

    const updatesMap = {};
    if (Array.isArray(updates)) {
      updates.forEach(u => {
        if (u.id) updatesMap[u.id] = u;
      });
    }

    for (const id of targetIds) {
      const user = await get(`SELECT * FROM user_accounts WHERE id = ?`, [id]);
      if (!user) continue;

      let newEmail = user.email;
      let newPwd = user.password_hash;
      if (updatesMap[id]) {
        if (updatesMap[id].email) newEmail = updatesMap[id].email.trim();
        if (updatesMap[id].password_hash) newPwd = updatesMap[id].password_hash.trim();
      }

      await run(`UPDATE user_accounts SET status = ?, email = ?, password_hash = ? WHERE id = ?`, [status, newEmail, newPwd, id]);

      if (user.role === 'TEACHER' && status === 'APPROVED') {
        const existingTeacher = await get(
          `SELECT * FROM teachers WHERE school_id = ? AND name = ?`,
          [user.school_id, user.name]
        );

        const subject = user.subject_name || '미지정';
        if (subject && subject !== '미지정') {
          const existingSub = await get(`SELECT id FROM subjects WHERE school_id = ? AND name = ?`, [user.school_id, subject]);
          if (!existingSub) {
            await run(`INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`, [`sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`, user.school_id, subject, subject]);
          }
        }

        if (existingTeacher) {
          await run(`UPDATE teachers SET subject_name = ? WHERE id = ?`, [subject, existingTeacher.id]);
          await run(`UPDATE user_accounts SET teacher_id = ? WHERE id = ?`, [existingTeacher.id, id]);
        } else {
          const newTeacherId = `tch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await run(
            `INSERT INTO teachers (id, school_id, name, subject_name) VALUES (?, ?, ?, ?)`,
            [newTeacherId, user.school_id, user.name, subject]
          );
          await run(`UPDATE user_accounts SET teacher_id = ? WHERE id = ?`, [newTeacherId, id]);
        }
      }
    }

    res.json({ message: `User account status updated to ${status}` });
  } catch (err) {
    console.error('Approve user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/teachers
router.get('/teachers', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const list = await all(
      `SELECT t.*, u.email, u.password_hash as password_plain
       FROM teachers t
       LEFT JOIN user_accounts u ON u.teacher_id = t.id
       WHERE t.school_id = ?
       ORDER BY t.name`,
      [schoolId]
    );
    res.json(list);
  } catch (err) {
    console.error('Fetch teachers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk teacher registration by admin
// Bulk teacher registration by admin
router.post('/teachers/register-teachers-bulk', async (req, res) => {
  try {
    const { schoolId, teachers } = req.body;
    if (!schoolId || !Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({ error: 'schoolId and teachers list are required' });
    }

    const results = [];
    for (const item of teachers) {
      const { subjectName, name } = item;
      if (!name) continue;

      const trimmedName = name.trim();
      const subName = (subjectName || '미지정').trim();

      if (subName && subName !== '미지정') {
        const existingSub = await get(`SELECT id FROM subjects WHERE school_id = ? AND name = ?`, [schoolId, subName]);
        if (!existingSub) {
          await run(`INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`, [`sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`, schoolId, subName, subName]);
        }
      }

      // 동일 학교 내 동명 교사가 이미 아이디를 보유 중인지 체크 (아이디 재사용)
      const existingUser = await get(
        `SELECT email, password_hash FROM user_accounts WHERE school_id = ? AND role = 'TEACHER' AND name = ? LIMIT 1`,
        [schoolId, trimmedName]
      );

      let finalEmail = '';
      let password = '1234';

      if (existingUser && existingUser.email) {
        // 이미 존재하는 교사의 아이디와 비밀번호 공유
        finalEmail = existingUser.email;
        password = existingUser.password_hash || '1234';
      } else {
        // 신규 교사의 경우 순차적 아이디 부여 (t1, t2... / t01, t02...)
        const countRow = await get(
          `SELECT COUNT(DISTINCT name) as cnt FROM teachers WHERE school_id = ?`,
          [schoolId]
        );
        const nextSeq = String(countRow.cnt + 1).padStart(2, '0');
        const baseEmail = `t${nextSeq}`;

        finalEmail = baseEmail;
        let existingEmail = await get(`SELECT id FROM user_accounts WHERE email = ?`, [finalEmail]);
        let salt = 1;
        while (existingEmail) {
          finalEmail = `t${nextSeq}_${salt++}`;
          existingEmail = await get(`SELECT id FROM user_accounts WHERE email = ?`, [finalEmail]);
        }
      }

      const teacherId = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await run(
        `INSERT INTO teachers (id, school_id, name, subject_name) VALUES (?, ?, ?, ?)`,
        [teacherId, schoolId, trimmedName, subName]
      );

      const userId = `u-t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await run(
        `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
         VALUES (?, ?, ?, ?, 'TEACHER', ?, ?, 'APPROVED')`,
        [userId, schoolId, finalEmail, password, teacherId, trimmedName]
      );

      results.push({ id: teacherId, email: finalEmail, password, name: trimmedName, subjectName: subName });
    }

    res.json({ message: 'Teachers registered successfully', registered: results });
  } catch (err) {
    console.error('Bulk register teachers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. POST /api/admin/teachers (Create/Update teacher)
router.post('/teachers', async (req, res) => {
  try {
    const { id, schoolId, name, code, subjectName, email, password } = req.body;
    if (!schoolId || !name) return res.status(400).json({ error: 'schoolId and name are required' });

    const trimmedName = name.trim();
    const trimmedSub = (subjectName || '').trim();

    let teacherId = id;
    if (teacherId) {
      // Update teacher
      await run(
        `UPDATE teachers SET name = ?, code = ?, subject_name = ? WHERE id = ? AND school_id = ?`,
        [trimmedName, code || null, trimmedSub || null, teacherId, schoolId]
      );
      // Update user_account
      if (email && password) {
        const existing = await get(`SELECT id, name FROM user_accounts WHERE email = ? AND school_id = ?`, [email.trim(), schoolId]);
        if (existing && existing.name.trim() !== trimmedName) {
          return res.status(400).json({ error: '이미 다른 교사가 사용 중인 아이디입니다.' });
        }
        
        const userAcc = await get(`SELECT id FROM user_accounts WHERE teacher_id = ?`, [teacherId]);
        if (userAcc) {
          await run(
            `UPDATE user_accounts SET email = ?, password_hash = ?, name = ? WHERE teacher_id = ?`,
            [email.trim(), password.trim(), trimmedName, teacherId]
          );
        } else {
          const userId = `u-t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await run(
            `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
             VALUES (?, ?, ?, ?, 'TEACHER', ?, ?, 'APPROVED')`,
            [userId, schoolId, email.trim(), password.trim(), teacherId, trimmedName]
          );
        }
      }
    } else {
      // Create teacher
      teacherId = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await run(
        `INSERT INTO teachers (id, school_id, name, code, subject_name) VALUES (?, ?, ?, ?, ?)`,
        [teacherId, schoolId, trimmedName, code || null, trimmedSub || null]
      );
      if (email && password) {
        const existing = await get(`SELECT id, name FROM user_accounts WHERE email = ? AND school_id = ?`, [email.trim(), schoolId]);
        if (existing && existing.name.trim() !== trimmedName) {
          return res.status(400).json({ error: '이미 다른 교사가 사용 중인 아이디입니다.' });
        }
        const userId = `u-t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await run(
          `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
           VALUES (?, ?, ?, ?, 'TEACHER', ?, ?, 'APPROVED')`,
          [userId, schoolId, email.trim(), password.trim(), teacherId, trimmedName]
        );
      }
    }

    // Auto-create subject if it doesn't exist
    if (trimmedSub) {
      const existingSub = await get(`SELECT id FROM subjects WHERE school_id = ? AND name = ?`, [schoolId, trimmedSub]);
      if (!existingSub) {
        const subId = `s-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await run(`INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`, [subId, schoolId, trimmedSub, trimmedSub]);
      }
    }

    res.status(200).json({ message: 'Teacher saved successfully', id: teacherId });
  } catch (err) {
    console.error('Teacher setup error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
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

// DELETE /api/admin/classes (Bulk delete or Delete all for school)
router.delete('/classes', async (req, res) => {
  try {
    const { schoolId, ids } = req.query;
    if (ids === 'ALL_CLASSES' && schoolId) {
      const classes = await all(`SELECT id FROM grade_classes WHERE school_id = ?`, [schoolId]);
      for (const c of classes) {
        await run(`DELETE FROM base_timetable WHERE grade_class_id = ?`, [c.id]);
        await run(`DELETE FROM timetable_changes WHERE grade_class_id = ?`, [c.id]);
        await run(`DELETE FROM grade_classes WHERE id = ?`, [c.id]);
      }
      return res.json({ message: 'All classes deleted successfully' });
    }

    if (ids) {
      const idList = ids.split(',');
      for (const id of idList) {
        await run(`DELETE FROM base_timetable WHERE grade_class_id = ?`, [id]);
        await run(`DELETE FROM timetable_changes WHERE grade_class_id = ?`, [id]);
        await run(`DELETE FROM grade_classes WHERE id = ?`, [id]);
      }
      return res.json({ message: 'Selected classes deleted successfully' });
    }

    res.status(400).json({ error: 'schoolId or ids required' });
  } catch (err) {
    console.error('Delete bulk classes error:', err);
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
           AND t.name = (SELECT name FROM teachers WHERE id = ?) AND bt.grade_class_id != ?`,
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

// DELETE /api/admin/base-timetable
router.delete('/base-timetable', async (req, res) => {
  try {
    const { schoolId, gradeClassId, dayOfWeek, period } = req.body;
    if (!schoolId || !gradeClassId || !dayOfWeek || !period) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    await run(
      `DELETE FROM base_timetable WHERE school_id = ? AND grade_class_id = ? AND day_of_week = ? AND period = ?`,
      [schoolId, gradeClassId, dayOfWeek, period]
    );
    res.json({ message: 'Slot deleted successfully' });
  } catch (err) {
    console.error('Delete base-timetable slot error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/base-timetable-all
router.get('/base-timetable-all', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const data = await all(`
      SELECT bt.grade_class_id as "gradeClassId", bt.day_of_week as "dayOfWeek", bt.period,
             bt.subject_id as "subjectId", bt.teacher_id as "teacherId", bt.room_id as "roomId",
             s.name as "subjectName", t.name as "teacherName"
      FROM base_timetable bt
      LEFT JOIN subjects s ON bt.subject_id = s.id
      LEFT JOIN teachers t ON bt.teacher_id = t.id
      WHERE bt.school_id = ?
    `, [schoolId]);
    res.json(data);
  } catch (err) {
    console.error('Fetch all base-timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
