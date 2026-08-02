const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { run, get } = require('../db/database');

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

    const user = await get(
      `SELECT u.*, s.name as school_name 
       FROM user_accounts u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE LOWER(TRIM(u.email)) = ?`,
      [cleanEmail]
    );

    if (!user) {
      return res.status(401).json({ error: '등록되지 않은 아이디(이메일)입니다.' });
    }

    if (user.password_hash !== cleanPassword && user.password_hash !== password) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }

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
      name: user.name
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
        teacherId: user.teacher_id
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
    const { schoolName, adminEmail, adminPassword } = req.body;
    if (!schoolName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if school admin ID is already taken
    const existingUser = await get(`SELECT id FROM user_accounts WHERE email = ?`, [adminEmail]);
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 아이디입니다.' });
    }

    const schoolId = `sch-${Date.now()}`;
    const schoolCode = `SCH-${Date.now().toString().slice(-6)}`;
    const adminId = `u-${Date.now()}`;

    // 1. Create PENDING school
    await run(
      `INSERT INTO schools (id, code, name, max_periods_per_day, operating_days, status)
       VALUES (?, ?, ?, 9, 5, 'PENDING')`,
      [schoolId, schoolCode, schoolName]
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
    const { schoolId, email, password, name, subjectName, teacherId, role, grade, classNumber } = req.body;
    
    if (!schoolId || !name || !email || !password) {
      return res.status(400).json({ error: 'School ID, Name, ID, and Password are required' });
    }

    let actualSchoolId = schoolId;
    const schoolRow = await get(`SELECT id FROM schools WHERE id = ?`, [actualSchoolId]);
    if (!schoolRow) {
      const firstSchool = await get(`SELECT id FROM schools LIMIT 1`);
      if (firstSchool) {
        actualSchoolId = firstSchool.id;
      } else {
        return res.status(400).json({ error: 'School not found. Please register a school first.' });
      }
    }

    const existingUser = await get(`SELECT id FROM user_accounts WHERE email = ?`, [email]);
    if (existingUser) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
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
