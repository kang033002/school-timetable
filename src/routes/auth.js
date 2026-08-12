const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { run, get, all } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'timetable-secret-key-2026';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    let query = `SELECT u.*, s.name as school_name, s.code as school_code 
                 FROM user_accounts u
                 LEFT JOIN schools s ON u.school_id = s.id
                 WHERE LOWER(TRIM(u.email)) = ?`;
    let params = [cleanEmail];

    if (req.body.schoolCode) {
      query += ` AND (s.code = ? OR u.role = 'MASTER_ADMIN')`;
      params.push(req.body.schoolCode.trim());
    }

    const users = await all(query, params);

    if (users.length === 0) {
      return res.status(401).json({ error: '등록되지 않은 아이디이거나 학교 코드가 다릅니다.' });
    }

    const validUsers = users.filter(u => u.password_hash === cleanPassword || u.password_hash === password);

    if (validUsers.length === 0) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

    let targetUser = validUsers[0];

    if (validUsers.length > 1) {
      if (req.body.schoolCode) {
        // If schoolCode provided, the query already filtered `users` down to the matching school.
        targetUser = validUsers[0];
      } else {
        // If no schoolCode provided, try to find if there's only ONE approved school among them
        const approvedUsers = [];
        for (const u of validUsers) {
          if (u.role === 'MASTER_ADMIN') {
            approvedUsers.push(u);
          } else {
            const school = await get(`SELECT status FROM schools WHERE id = ?`, [u.school_id]);
            if (school && school.status === 'APPROVED') {
              approvedUsers.push(u);
            }
          }
        }
        
        if (approvedUsers.length === 1) {
          targetUser = approvedUsers[0];
        } else if (approvedUsers.length > 1) {
          return res.status(400).json({ error: '동일한 아이디가 여러 승인된 학교에 존재합니다. 로그인 화면에서 [학교 코드]를 입력해주세요.' });
        } else {
          // all are pending/rejected
          targetUser = validUsers[0];
        }
      }
    }

    const user = targetUser;

    // Validate school approval status
    if (user.role !== 'MASTER_ADMIN') {
      const school = await get(`SELECT status FROM schools WHERE id = ?`, [user.school_id]);
      if (!school || school.status !== 'APPROVED') {
        return res.status(403).json({
          error: '해당 학교가 가입 승인 대기 중이거나 정지되었습니다. 개발자(마스터 관리자) 승인 완료 후 이용해주세요.'
        });
      }
      
      // 학교가 승인되었는데 사용자 status가 PENDING인 경우 자동으로 APPROVED 업데이트
      if (user.status !== 'APPROVED') {
        await run(`UPDATE user_accounts SET status = 'APPROVED' WHERE id = ?`, [user.id]);
      }
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id,
      teacherId: user.teacher_id,
      name: user.name,
      grade: user.grade,
      classNumber: user.class_number
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.school_id,
        schoolName: user.school_name,
        schoolCode: user.school_code,
        teacherId: user.teacher_id,
        grade: user.grade,
        classNumber: user.class_number
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register-school (New School and Admin Account Registration Request)
router.post('/register-school', async (req, res) => {
  try {
    const { schoolName, schoolType, adminEmail, adminPassword } = req.body;
    if (!schoolName || !schoolType || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Global uniqueness for school admin ID is no longer required
    // because school code at login can distinguish them.

    const schoolId = `sch-${Date.now()}`;
    const allSchools = await all(`SELECT code FROM schools`);
    let maxCodeNum = 0;
    for (const s of allSchools) {
      if (s.code && /^[0-9]+$/.test(s.code)) {
        const num = parseInt(s.code, 10);
        if (num > maxCodeNum) maxCodeNum = num;
      }
    }
    const schoolCode = (maxCodeNum + 1).toString();
    const adminId = `u-${Date.now()}`;

    // 1. Create PENDING school
    await run(
      `INSERT INTO schools (id, code, name, school_type, max_periods_per_day, operating_days, status)
       VALUES (?, ?, ?, ?, 9, 5, 'PENDING')`,
      [schoolId, schoolCode, schoolName, schoolType]
    );

    // 2. Create PENDING user account under that school (requires Master Approval)
    await run(
      `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
       VALUES (?, ?, ?, ?, 'ADMIN', null, '학교관리자', 'PENDING')`,
      [adminId, schoolId, adminEmail, adminPassword]
    );

    res.status(201).json({
      message: '학교 등록 신청이 정상적으로 완료되었습니다! 개발자(마스터 관리자) 승인 후 이용 가능합니다.'
    });
  } catch (err) {
    console.error('Register school error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { schoolCode, email, password, name, subjectName, teacherId, role, grade, classNumber } = req.body;
    
    if (!schoolCode || !name || !email || !password) {
      return res.status(400).json({ error: '학교 코드, 이름, 아이디, 비밀번호는 필수 입력 항목입니다.' });
    }

    const schoolRow = await get(`SELECT id FROM schools WHERE code = ?`, [schoolCode]);
    if (!schoolRow) {
      return res.status(400).json({ error: '유효하지 않은 학교 코드입니다. 코드를 다시 확인해주세요.' });
    }
    const actualSchoolId = schoolRow.id;

    const existingUser = await get(`SELECT id FROM user_accounts WHERE email = ? AND school_id = ?`, [email, actualSchoolId]);
    if (existingUser) {
      return res.status(400).json({ error: '해당 학교 내에 이미 사용 중인 아이디입니다.' });
    }

    const userId = `u-${Date.now()}`;

    if (role === 'STUDENT') {
      if (!grade || !classNumber) {
        return res.status(400).json({ error: 'Grade and Class number are required for student registration' });
      }
      const displayName = `${name} (${grade}학년 ${classNumber}반 학생)`;
      
      await run(
        `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status, grade, class_number)
         VALUES (?, ?, ?, ?, 'STUDENT', null, ?, 'PENDING', ?, ?)`,
        [userId, actualSchoolId, email, password, displayName, grade, classNumber]
      );
      
      return res.status(201).json({ message: '학생 가입 신청 완료. 관리자 승인 대기 중.' });
    }

    // Teacher signup
    await run(
      `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status, subject_name)
       VALUES (?, ?, ?, ?, 'TEACHER', ?, ?, 'PENDING', ?)`,
      [userId, actualSchoolId, email, password, teacherId || null, name, subjectName || '미지정']
    );

    res.status(201).json({ message: '선생님 가입 신청이 성공적으로 접수되었습니다. 관리자 승인 완료 후 로그인할 수 있습니다.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
