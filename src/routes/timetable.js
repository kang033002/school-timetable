const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

// Helper to safely parse YYYY-MM-DD string to local Date object (avoids timezone shift)
function parseKstDate(dateStr) {
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// Helper to convert date YYYY-MM-DD to DayOfWeek (1: Mon, 2: Tue ... 5: Fri)
function getDayOfWeek(dateStr) {
  const d = parseKstDate(dateStr);
  const day = d.getDay(); // 0: Sun, 1: Mon ... 6: Sat
  return day === 0 ? 7 : day;
}

// Helper to get week start (Monday) date string
function getMonday(dateStr) {
  const d = parseKstDate(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), diff);
  
  const yyyy = mon.getFullYear();
  const mm = String(mon.getMonth() + 1).padStart(2, '0');
  const dd = String(mon.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 1. GET /api/schools/search?q=...
router.get('/schools/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const schools = await all(
      `SELECT * FROM schools WHERE name LIKE ? OR code LIKE ? LIMIT 10`,
      [`%${q}%`, `%${q}%`]
    );
    res.json(schools);
  } catch (err) {
    console.error('School search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET /api/schools/:schoolId/meta
router.get('/schools/:schoolId/meta', async (req, res) => {
  try {
    const { schoolId } = req.params;
    const school = await get(`SELECT * FROM schools WHERE id = ? OR code = ?`, [schoolId, schoolId]);
    if (!school) return res.status(404).json({ error: 'School not found' });

    // 1) 현재 등록된 교사의 과목만 추출하여 유효한 과목 집합(Set) 생성
    const activeTeacherSubjects = await all(
      `SELECT DISTINCT subject_name FROM teachers WHERE school_id = ? AND subject_name IS NOT NULL AND subject_name != ''`,
      [school.id]
    );
    const validSubjectNames = new Set(activeTeacherSubjects.map(ts => (ts.subject_name || '').trim()));

    // 2) 현재 교사 목록에 존재하지 않는 과거 삭제 과목(유령 과목: 상담, 스포츠동아리, 인공지능 등) DB에서 즉시 영구 삭제
    const allDbSubjects = await all(`SELECT id, name FROM subjects WHERE school_id = ?`, [school.id]);
    for (const s of allDbSubjects) {
      if (!validSubjectNames.has(s.name) || s.name === '미지정' || s.name.toLowerCase() === 'sports') {
        await run(`DELETE FROM subjects WHERE id = ? AND school_id = ?`, [s.id, school.id]);
      }
    }

    // 3) 현재 교사가 담당하는 과목 중 subjects 테이블에 없는 경우만 신규 등록하여 동기화
    for (const tsName of validSubjectNames) {
      if (!tsName || tsName === '미지정' || tsName.toLowerCase() === 'sports') continue;
      const existing = await get(
        `SELECT id FROM subjects WHERE school_id = ? AND name = ?`,
        [school.id, tsName]
      );
      if (!existing) {
        await run(
          `INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`,
          [`sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`, school.id, tsName, tsName]
        );
      }
    }

    const gradeClasses = await all(
      `SELECT gc.*, t.name as homeroom_teacher_name 
       FROM grade_classes gc 
       LEFT JOIN teachers t ON gc.homeroom_teacher_id = t.id 
       WHERE gc.school_id = ? 
       ORDER BY grade, class_number`,
      [school.id]
    );

    const teachers = await all(
      `SELECT t.*, u.email, u.password_hash 
       FROM teachers t
       LEFT JOIN user_accounts u ON u.teacher_id = t.id AND u.role = 'TEACHER'
       WHERE t.school_id = ? 
       ORDER BY t.name`,
      [school.id]
    );

    const rawSubjects = await all(
      `SELECT id, name FROM subjects WHERE school_id = ? AND LOWER(name) != 'sports' ORDER BY name`,
      [school.id]
    );
    const seenNames = new Set();
    const subjects = rawSubjects.filter(s => {
      if (seenNames.has(s.name)) return false;
      seenNames.add(s.name);
      return true;
    });

    const rooms = await all(
      `SELECT * FROM rooms WHERE school_id = ? ORDER BY name`,
      [school.id]
    );

    res.json({
      school,
      gradeClasses,
      teachers,
      subjects,
      rooms
    });
  } catch (err) {
    console.error('School meta error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function getEffectiveSlot(schoolId, gradeClassId, targetDate, dayOfWeek, period) {
  // Check if holiday
  const holiday = await get(`SELECT name FROM holidays WHERE school_id = ? AND target_date = ?`, [schoolId, targetDate]);
  if (holiday) {
    return {
      dayOfWeek,
      period,
      targetDate,
      gradeClassId,
      subjectId: null,
      subjectName: holiday.name,
      shortSubjectName: '휴일',
      teacherId: null,
      teacherName: '-',
      roomId: null,
      roomName: '-',
      isChanged: true,
      changeType: 'HOLIDAY',
      originalSubjectName: null,
      originalTeacherName: null,
      reason: holiday.name
    };
  }

  // Base timetable
  const base = await get(
    `SELECT bt.*, 
            sub.name as subject_name, sub.short_name as short_subject_name,
            t.name as teacher_name, t.code as teacher_code,
            r.name as room_name, r.is_special_room
     FROM base_timetable bt
     LEFT JOIN subjects sub ON CAST(bt.subject_id AS VARCHAR) = CAST(sub.id AS VARCHAR)
     LEFT JOIN teachers t ON (CAST(bt.teacher_id AS VARCHAR) = CAST(t.id AS VARCHAR) OR CAST(bt.teacher_id AS VARCHAR) = t.code OR CAST(bt.teacher_id AS VARCHAR) = t.name)
     LEFT JOIN rooms r ON CAST(bt.room_id AS VARCHAR) = CAST(r.id AS VARCHAR)
     WHERE bt.school_id = ? AND bt.grade_class_id = ? AND bt.day_of_week = ? AND bt.period = ?`,
    [schoolId, gradeClassId, dayOfWeek, period]
  );

  // Check override/change
  const change = await get(
    `SELECT tc.*,
            orig_sub.name as orig_subject_name,
            chg_sub.name as chg_subject_name, chg_sub.short_name as chg_short_subject_name,
            orig_t.name as orig_teacher_name,
            chg_t.name as chg_teacher_name,
            orig_r.name as orig_room_name,
            chg_r.name as chg_room_name
     FROM timetable_changes tc
     LEFT JOIN subjects orig_sub ON CAST(tc.original_subject_id AS VARCHAR) = CAST(orig_sub.id AS VARCHAR)
     LEFT JOIN subjects chg_sub ON CAST(tc.changed_subject_id AS VARCHAR) = CAST(chg_sub.id AS VARCHAR)
     LEFT JOIN teachers orig_t ON (CAST(tc.original_teacher_id AS VARCHAR) = CAST(orig_t.id AS VARCHAR) OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.code OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.name)
     LEFT JOIN teachers chg_t ON (CAST(tc.changed_teacher_id AS VARCHAR) = CAST(chg_t.id AS VARCHAR) OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.code OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.name)
     LEFT JOIN rooms orig_r ON CAST(tc.original_room_id AS VARCHAR) = CAST(orig_r.id AS VARCHAR)
     LEFT JOIN rooms chg_r ON CAST(tc.changed_room_id AS VARCHAR) = CAST(chg_r.id AS VARCHAR)
     WHERE tc.school_id = ? AND tc.grade_class_id = ? AND tc.target_date = ? AND tc.period = ?
     ORDER BY tc.created_at DESC LIMIT 1`,
    [schoolId, gradeClassId, targetDate, period]
  );

  if (!base && !change) return null;

  if (change) {
    if (change.change_type === 'CANCEL') {
      return {
        dayOfWeek,
        period,
        targetDate,
        gradeClassId,
        subjectId: null,
        subjectName: '결강',
        shortSubjectName: '결강',
        teacherId: null,
        teacherName: '-',
        roomId: null,
        roomName: '-',
        isChanged: true,
        changeType: 'CANCEL',
        originalSubjectName: base ? base.subject_name : null,
        originalTeacherName: base ? base.teacher_name : null,
        reason: change.reason
      };
    }

    return {
      dayOfWeek,
      period,
      targetDate,
      gradeClassId,
      subjectId: change.changed_subject_id || (base ? base.subject_id : null),
      subjectName: change.chg_subject_name || (base ? base.subject_name : ''),
      shortSubjectName: change.chg_short_subject_name || (base ? base.short_subject_name : ''),
      teacherId: change.changed_teacher_id || (base ? base.teacher_id : null),
      teacherName: change.chg_teacher_name || (base ? base.teacher_name : ''),
      roomId: change.changed_room_id || (base ? base.room_id : null),
      roomName: change.chg_room_name || (base ? base.room_name : ''),
      isChanged: true,
      changeType: change.change_type,
      originalSubjectName: base ? base.subject_name : change.orig_subject_name,
      originalTeacherName: base ? base.teacher_name : change.orig_teacher_name,
      reason: change.reason
    };
  }

  return {
    dayOfWeek,
    period,
    targetDate,
    gradeClassId,
    subjectId: base.subject_id,
    subjectName: base.subject_name,
    shortSubjectName: base.short_subject_name,
    teacherId: base.teacher_id,
    teacherName: base.teacher_name,
    roomId: base.room_id,
    roomName: base.room_name || '일반교실',
    isChanged: false,
    changeType: null
  };
}

// 3. GET /api/timetable/class?schoolId=...&grade=...&classNumber=...&date=...
router.get('/timetable/class', async (req, res) => {
  try {
    const { schoolId, grade, classNumber, date } = req.query;
    if (!schoolId || !grade || !classNumber) {
      return res.status(400).json({ error: 'schoolId, grade, and classNumber are required' });
    }

    const refDate = date || new Date().toISOString().split('T')[0];
    const mondayStr = getMonday(refDate);
    const monday = new Date(mondayStr);
    
    const fridayDate = new Date(monday);
    fridayDate.setDate(monday.getDate() + 4);
    const fridayStr = fridayDate.toISOString().split('T')[0];

    const baseOnly = req.query.baseOnly === 'true';

    // Get school to find max_periods_per_day
    const school = await get(`SELECT max_periods_per_day FROM schools WHERE id = ?`, [schoolId]);
    const maxPeriods = school ? school.max_periods_per_day : 9;

    // Get gradeClass
    const gc = await get(
      `SELECT * FROM grade_classes WHERE school_id = ? AND grade = ? AND class_number = ?`,
      [schoolId, grade, classNumber]
    );

    if (!gc) return res.status(404).json({ error: 'Grade and Class not found' });

    // Generate weekly schedule (Days 1 to 5, Periods 1 to maxPeriods)
    const baseRows = await all(`
      SELECT bt.*, 
             sub.name as subject_name, sub.short_name as short_subject_name,
             t.name as teacher_name, t.code as teacher_code,
             r.name as room_name, r.is_special_room
      FROM base_timetable bt
      LEFT JOIN subjects sub ON CAST(bt.subject_id AS VARCHAR) = CAST(sub.id AS VARCHAR)
      LEFT JOIN teachers t ON (CAST(bt.teacher_id AS VARCHAR) = CAST(t.id AS VARCHAR) OR CAST(bt.teacher_id AS VARCHAR) = t.code OR CAST(bt.teacher_id AS VARCHAR) = t.name)
      LEFT JOIN rooms r ON CAST(bt.room_id AS VARCHAR) = CAST(r.id AS VARCHAR)
      WHERE bt.school_id = ? AND bt.grade_class_id = ?
    `, [schoolId, gc.id]);

    let changeRows = [];
    let holidayRows = [];
    if (!baseOnly) {
      changeRows = await all(`
        SELECT tc.*,
               orig_sub.name as orig_subject_name,
               chg_sub.name as chg_subject_name, chg_sub.short_name as chg_short_subject_name,
               orig_t.name as orig_teacher_name,
               chg_t.name as chg_teacher_name,
               orig_r.name as orig_room_name,
               chg_r.name as chg_room_name
        FROM timetable_changes tc
        LEFT JOIN subjects orig_sub ON CAST(tc.original_subject_id AS VARCHAR) = CAST(orig_sub.id AS VARCHAR)
        LEFT JOIN subjects chg_sub ON CAST(tc.changed_subject_id AS VARCHAR) = CAST(chg_sub.id AS VARCHAR)
        LEFT JOIN teachers orig_t ON (CAST(tc.original_teacher_id AS VARCHAR) = CAST(orig_t.id AS VARCHAR) OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.code OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.name)
        LEFT JOIN teachers chg_t ON (CAST(tc.changed_teacher_id AS VARCHAR) = CAST(chg_t.id AS VARCHAR) OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.code OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.name)
        LEFT JOIN rooms orig_r ON CAST(tc.original_room_id AS VARCHAR) = CAST(orig_r.id AS VARCHAR)
        LEFT JOIN rooms chg_r ON CAST(tc.changed_room_id AS VARCHAR) = CAST(chg_r.id AS VARCHAR)
        WHERE tc.school_id = ? AND tc.grade_class_id = ? AND tc.target_date >= ? AND tc.target_date <= ?
        ORDER BY tc.created_at DESC
      `, [schoolId, gc.id, mondayStr, fridayStr]);

      holidayRows = await all(`
        SELECT * FROM holidays WHERE school_id = ? AND target_date >= ? AND target_date <= ?
      `, [schoolId, mondayStr, fridayStr]);
    }

    const effectiveMap = {};
    for (const b of baseRows) {
      const key = `${b.day_of_week}_${b.period}`;
      effectiveMap[key] = {
        gradeClassId: gc.id,
        dayOfWeek: b.day_of_week,
        period: b.period,
        subjectId: b.subject_id,
        subjectName: b.subject_name,
        shortSubjectName: b.short_subject_name,
        teacherId: b.teacher_id,
        teacherName: b.teacher_name,
        roomId: b.room_id,
        roomName: b.room_name || '일반교실',
        isChanged: false,
        changeType: null
      };
    }

    if (!baseOnly) {
      const seenChanges = new Set();
      for (const ch of changeRows) {
        const chDate = new Date(ch.target_date);
        const dayOfWeek = chDate.getDay() === 0 ? 7 : chDate.getDay();
        const key = `${dayOfWeek}_${ch.period}`;
        
        if (seenChanges.has(key)) continue; // We only want the latest
        seenChanges.add(key);

        if (ch.change_type === 'CANCEL' || ch.change_type === 'HOLIDAY') {
          if (effectiveMap[key]) {
             effectiveMap[key].teacherId = null;
             effectiveMap[key].subjectName = '결강';
             effectiveMap[key].shortSubjectName = '결강';
             effectiveMap[key].teacherName = '-';
             effectiveMap[key].roomName = '-';
             effectiveMap[key].isChanged = true;
             effectiveMap[key].changeType = ch.change_type;
          }
        } else {
          if (effectiveMap[key]) {
             effectiveMap[key].subjectId = ch.changed_subject_id || effectiveMap[key].subjectId;
             effectiveMap[key].subjectName = ch.chg_subject_name || effectiveMap[key].subjectName;
             effectiveMap[key].shortSubjectName = ch.chg_short_subject_name || effectiveMap[key].shortSubjectName;
             effectiveMap[key].teacherId = ch.changed_teacher_id || effectiveMap[key].teacherId;
             effectiveMap[key].teacherName = ch.chg_teacher_name || effectiveMap[key].teacherName;
             effectiveMap[key].roomId = ch.changed_room_id || effectiveMap[key].roomId;
             effectiveMap[key].roomName = ch.chg_room_name || effectiveMap[key].roomName;
             effectiveMap[key].isChanged = true;
             effectiveMap[key].changeType = ch.change_type;
          } else {
             effectiveMap[key] = {
               gradeClassId: ch.grade_class_id,
               dayOfWeek,
               period: ch.period,
               subjectId: ch.changed_subject_id,
               subjectName: ch.chg_subject_name,
               shortSubjectName: ch.chg_short_subject_name,
               teacherId: ch.changed_teacher_id,
               teacherName: ch.chg_teacher_name,
               roomId: ch.changed_room_id,
               roomName: ch.chg_room_name || '일반교실',
               isChanged: true,
               changeType: ch.change_type
             };
          }
        }
      }
    }

    const timetable = [];
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const curDate = new Date(monday);
      curDate.setDate(monday.getDate() + dayOffset);
      const curDateStr = curDate.toISOString().split('T')[0];
      const dayOfWeek = dayOffset + 1;

      const holiday = holidayRows.find(h => h.target_date === curDateStr);

      const daySlots = [];
      for (let period = 1; period <= maxPeriods; period++) {
        let slot = null;
        if (holiday && !baseOnly) {
           slot = {
             dayOfWeek,
             period,
             targetDate: curDateStr,
             gradeClassId: gc.id,
             subjectName: holiday.name,
             shortSubjectName: '휴일',
             teacherName: '-',
             roomName: '-',
             isChanged: true,
             changeType: 'HOLIDAY'
           };
        } else {
           const key = `${dayOfWeek}_${period}`;
           if (effectiveMap[key]) {
             slot = {
               ...effectiveMap[key],
               targetDate: curDateStr
             };
           }
        }

        daySlots.push(slot || {
          dayOfWeek,
          period,
          targetDate: curDateStr,
          gradeClassId: gc.id,
          subjectName: '',
          shortSubjectName: '',
          teacherName: '',
          roomName: '',
          isChanged: false
        });
      }

      timetable.push({
        dayOfWeek,
        date: curDateStr,
        slots: daySlots
      });
    }

    res.json({
      schoolId,
      gradeClass: gc,
      mondayDate: mondayStr,
      timetable
    });
  } catch (err) {
    console.error('Class timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3.5 GET /api/timetable/daily-all?schoolId=...&date=...
router.get('/timetable/daily-all', async (req, res) => {
  try {
    const { schoolId, date } = req.query;
    if (!schoolId || !date) {
      return res.status(400).json({ error: 'schoolId and date are required' });
    }

    const targetDateObj = new Date(date);
    const dayOfWeek = targetDateObj.getDay() === 0 ? 7 : targetDateObj.getDay();

    const school = await get(`SELECT max_periods_per_day FROM schools WHERE id = ?`, [schoolId]);
    const maxPeriods = school ? school.max_periods_per_day : 9;

    const classes = await all(`SELECT * FROM grade_classes WHERE school_id = ? ORDER BY grade, class_number`, [schoolId]);

    const holiday = await get(`SELECT name FROM holidays WHERE school_id = ? AND target_date = ?`, [schoolId, date]);

    const baseRows = await all(`
      SELECT bt.*, 
             sub.name as subject_name, sub.short_name as short_subject_name,
             t.name as teacher_name, t.code as teacher_code,
             r.name as room_name, r.is_special_room
      FROM base_timetable bt
      LEFT JOIN subjects sub ON CAST(bt.subject_id AS VARCHAR) = CAST(sub.id AS VARCHAR)
      LEFT JOIN teachers t ON (CAST(bt.teacher_id AS VARCHAR) = CAST(t.id AS VARCHAR) OR CAST(bt.teacher_id AS VARCHAR) = t.code OR CAST(bt.teacher_id AS VARCHAR) = t.name)
      LEFT JOIN rooms r ON CAST(bt.room_id AS VARCHAR) = CAST(r.id AS VARCHAR)
      WHERE bt.school_id = ? AND bt.day_of_week = ?
    `, [schoolId, dayOfWeek]);

    const changeRows = await all(`
      SELECT tc.*,
             orig_sub.name as orig_subject_name,
             chg_sub.name as chg_subject_name, chg_sub.short_name as chg_short_subject_name,
             orig_t.name as orig_teacher_name,
             chg_t.name as chg_teacher_name,
             orig_r.name as orig_room_name,
             chg_r.name as chg_room_name
      FROM timetable_changes tc
      LEFT JOIN subjects orig_sub ON CAST(tc.original_subject_id AS VARCHAR) = CAST(orig_sub.id AS VARCHAR)
      LEFT JOIN subjects chg_sub ON CAST(tc.changed_subject_id AS VARCHAR) = CAST(chg_sub.id AS VARCHAR)
      LEFT JOIN teachers orig_t ON (CAST(tc.original_teacher_id AS VARCHAR) = CAST(orig_t.id AS VARCHAR) OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.code OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.name)
      LEFT JOIN teachers chg_t ON (CAST(tc.changed_teacher_id AS VARCHAR) = CAST(chg_t.id AS VARCHAR) OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.code OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.name)
      LEFT JOIN rooms orig_r ON CAST(tc.original_room_id AS VARCHAR) = CAST(orig_r.id AS VARCHAR)
      LEFT JOIN rooms chg_r ON CAST(tc.changed_room_id AS VARCHAR) = CAST(chg_r.id AS VARCHAR)
      WHERE tc.school_id = ? AND tc.target_date = ?
      ORDER BY tc.created_at DESC
    `, [schoolId, date]);

    const effectiveMap = {};
    for (const b of baseRows) {
      const key = `${b.grade_class_id}_${b.period}`;
      effectiveMap[key] = {
        gradeClassId: b.grade_class_id,
        dayOfWeek: b.day_of_week,
        period: b.period,
        subjectId: b.subject_id,
        subjectName: b.subject_name,
        shortSubjectName: b.short_subject_name,
        teacherId: b.teacher_id,
        teacherName: b.teacher_name,
        roomId: b.room_id,
        roomName: b.room_name || '일반교실',
        isChanged: false,
        changeType: null
      };
    }

    const seenChanges = new Set();
    for (const ch of changeRows) {
      const key = `${ch.grade_class_id}_${ch.period}`;
      if (seenChanges.has(key)) continue;
      seenChanges.add(key);

      if (ch.change_type === 'CANCEL' || ch.change_type === 'HOLIDAY') {
        if (effectiveMap[key]) {
           effectiveMap[key].teacherId = null;
           effectiveMap[key].subjectName = '결강';
           effectiveMap[key].shortSubjectName = '결강';
           effectiveMap[key].teacherName = '-';
           effectiveMap[key].roomName = '-';
           effectiveMap[key].isChanged = true;
           effectiveMap[key].changeType = ch.change_type;
        }
      } else {
        if (effectiveMap[key]) {
           effectiveMap[key].subjectId = ch.changed_subject_id || effectiveMap[key].subjectId;
           effectiveMap[key].subjectName = ch.chg_subject_name || effectiveMap[key].subjectName;
           effectiveMap[key].shortSubjectName = ch.chg_short_subject_name || effectiveMap[key].shortSubjectName;
           effectiveMap[key].teacherId = ch.changed_teacher_id || effectiveMap[key].teacherId;
           effectiveMap[key].teacherName = ch.chg_teacher_name || effectiveMap[key].teacherName;
           effectiveMap[key].roomId = ch.changed_room_id || effectiveMap[key].roomId;
           effectiveMap[key].roomName = ch.chg_room_name || effectiveMap[key].roomName;
           effectiveMap[key].isChanged = true;
           effectiveMap[key].changeType = ch.change_type;
        } else {
           effectiveMap[key] = {
             gradeClassId: ch.grade_class_id,
             dayOfWeek,
             period: ch.period,
             subjectId: ch.changed_subject_id,
             subjectName: ch.chg_subject_name,
             shortSubjectName: ch.chg_short_subject_name,
             teacherId: ch.changed_teacher_id,
             teacherName: ch.chg_teacher_name,
             roomId: ch.changed_room_id,
             roomName: ch.chg_room_name || '일반교실',
             isChanged: true,
             changeType: ch.change_type
           };
        }
      }
    }

    const timetable = [];
    for (const gc of classes) {
      const classSlots = [];
      for (let period = 1; period <= maxPeriods; period++) {
        let slot = null;
        if (holiday) {
           slot = {
             dayOfWeek,
             period,
             targetDate: date,
             gradeClassId: gc.id,
             subjectName: holiday.name,
             shortSubjectName: '휴일',
             teacherName: '-',
             roomName: '-',
             isChanged: true,
             changeType: 'HOLIDAY'
           };
        } else {
           const key = `${gc.id}_${period}`;
           if (effectiveMap[key]) {
             slot = {
               ...effectiveMap[key],
               targetDate: date
             };
           }
        }
        
        classSlots.push(slot || {
          dayOfWeek,
          period,
          targetDate: date,
          gradeClassId: gc.id,
          subjectName: '',
          shortSubjectName: '',
          teacherName: '',
          roomName: '',
          isChanged: false
        });
      }
      timetable.push({
        gradeClassId: gc.id,
        grade: gc.grade,
        classNumber: gc.class_number,
        slots: classSlots
      });
    }

    res.json({
      schoolId,
      date,
      dayOfWeek,
      maxPeriods,
      timetable
    });
  } catch (err) {
    console.error('Daily all timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. GET /api/timetable/teacher?schoolId=...&teacherId=...&date=...
router.get('/timetable/teacher', async (req, res) => {
  try {
    const { schoolId, teacherId, date } = req.query;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const refDate = date || new Date().toISOString().split('T')[0];
    const mondayStr = getMonday(refDate);
    const monday = new Date(mondayStr);
    
    // Friday
    const fridayDate = new Date(monday);
    fridayDate.setDate(monday.getDate() + 4);
    const fridayStr = fridayDate.toISOString().split('T')[0];

    // Fetch all teachers in this school
    const schoolTeachers = await all(`SELECT id, name, code, subject_name FROM teachers WHERE school_id = ?`, [schoolId]);

    const inputStr = String(teacherId || '').trim();
    const rawInputs = inputStr.split(',').map(s => s.trim()).filter(Boolean);

    // Match teachers by ID, code, or Name
    const matched = schoolTeachers.filter(t => {
      const idStr = String(t.id);
      const codeStr = String(t.code || '');
      const cleanName = (t.name || '').trim();
      return rawInputs.some(input => {
        const cleanInput = input.replace(/\s*\([^)]*\)/g, '').trim();
        return idStr === input || codeStr === input || cleanName === cleanInput || cleanName.includes(cleanInput);
      });
    });

    // Collect all target names for this teacher
    const allNames = Array.from(new Set([
      ...matched.map(t => (t.name || '').trim()),
      ...rawInputs.map(input => input.replace(/\s*\([^)]*\)/g, '').trim())
    ])).filter(Boolean);

    // Collect all target teacher records
    const targetTeacherRecords = schoolTeachers.filter(t => allNames.includes((t.name || '').trim()));

    const teacherIds = Array.from(new Set([
      ...targetTeacherRecords.map(t => String(t.id)),
      ...rawInputs.filter(input => !isNaN(Number(input)))
    ]));

    const teacherCodes = Array.from(new Set([
      ...targetTeacherRecords.map(t => String(t.code || '')).filter(Boolean),
      ...rawInputs
    ]));

    const baseOnly = req.query.baseOnly === 'true';

    const school = await get(`SELECT max_periods_per_day FROM schools WHERE id = ?`, [schoolId]);
    const maxPeriods = school ? school.max_periods_per_day : 9;

    // Bulk fetch ALL grade_classes
    const classes = await all(`SELECT * FROM grade_classes WHERE school_id = ?`, [schoolId]);
    const classMap = {};
    classes.forEach(c => classMap[c.id] = c);

    // Bulk fetch ALL base_timetable for school
    const baseRows = await all(`
      SELECT bt.*, 
             sub.name as subject_name, sub.short_name as short_subject_name,
             t.name as teacher_name, t.code as teacher_code,
             r.name as room_name, r.is_special_room
      FROM base_timetable bt
      LEFT JOIN subjects sub ON CAST(bt.subject_id AS VARCHAR) = CAST(sub.id AS VARCHAR)
      LEFT JOIN teachers t ON (CAST(bt.teacher_id AS VARCHAR) = CAST(t.id AS VARCHAR) OR CAST(bt.teacher_id AS VARCHAR) = t.code OR CAST(bt.teacher_id AS VARCHAR) = t.name)
      LEFT JOIN rooms r ON CAST(bt.room_id AS VARCHAR) = CAST(r.id AS VARCHAR)
      WHERE bt.school_id = ?
    `, [schoolId]);

    // Bulk fetch ALL timetable_changes for the week
    let changeRows = [];
    if (!baseOnly) {
      changeRows = await all(`
        SELECT tc.*, 
               sub.name as subject_name, sub.short_name as short_subject_name,
               t.name as teacher_name, t.code as teacher_code,
               r.name as room_name, r.is_special_room
        FROM timetable_changes tc
        LEFT JOIN subjects sub ON CAST(tc.changed_subject_id AS VARCHAR) = CAST(sub.id AS VARCHAR)
        LEFT JOIN teachers t ON (CAST(tc.changed_teacher_id AS VARCHAR) = CAST(t.id AS VARCHAR) OR CAST(tc.changed_teacher_id AS VARCHAR) = t.code OR CAST(tc.changed_teacher_id AS VARCHAR) = t.name)
        LEFT JOIN rooms r ON CAST(tc.changed_room_id AS VARCHAR) = CAST(r.id AS VARCHAR)
        WHERE tc.school_id = ? AND tc.target_date >= ? AND tc.target_date <= ?
      `, [schoolId, mondayStr, fridayStr]);
    }

    // Build effective memory map: classId -> dayOfWeek -> period -> slot
    const effectiveMap = {}; 

    for (const b of baseRows) {
      const key = `${b.grade_class_id}_${b.day_of_week}_${b.period}`;
      const gc = classMap[b.grade_class_id];
      if (!gc) continue;
      effectiveMap[key] = {
        gradeClassId: b.grade_class_id,
        gradeName: `${gc.grade}학년 ${gc.class_number}반`,
        dayOfWeek: b.day_of_week,
        period: b.period,
        subjectId: b.subject_id,
        subjectName: b.subject_name,
        shortSubjectName: b.short_subject_name,
        teacherId: b.teacher_id,
        teacherName: b.teacher_name,
        teacherCode: b.teacher_code,
        roomId: b.room_id,
        roomName: b.room_name || '일반교실',
        isChanged: false,
        changeType: null
      };
    }

    // Overlay changes
    if (!baseOnly) {
      for (const ch of changeRows) {
        const dateParts = String(ch.target_date).split('-').map(Number);
        const chDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const dayOfWeek = chDate.getDay() === 0 ? 7 : chDate.getDay();
        const key = `${ch.grade_class_id}_${dayOfWeek}_${ch.period}`;
        const gc = classMap[ch.grade_class_id];
        if (!gc) continue;
        
        if (ch.change_type === 'CANCEL' || ch.change_type === 'HOLIDAY') {
          if (effectiveMap[key]) {
            effectiveMap[key].teacherId = null;
            effectiveMap[key].teacherName = null;
            effectiveMap[key].isChanged = true;
            effectiveMap[key].changeType = ch.change_type;
          }
        } else {
          if (effectiveMap[key]) {
            effectiveMap[key].subjectId = ch.changed_subject_id;
            effectiveMap[key].subjectName = ch.subject_name;
            effectiveMap[key].shortSubjectName = ch.short_subject_name;
            effectiveMap[key].teacherId = ch.changed_teacher_id;
            effectiveMap[key].teacherName = ch.teacher_name;
            effectiveMap[key].roomId = ch.changed_room_id;
            effectiveMap[key].roomName = ch.room_name || '일반교실';
            effectiveMap[key].isChanged = true;
            effectiveMap[key].changeType = ch.change_type;
          } else {
            effectiveMap[key] = {
              gradeClassId: ch.grade_class_id,
              gradeName: `${gc.grade}학년 ${gc.class_number}반`,
              dayOfWeek,
              period: ch.period,
              subjectId: ch.changed_subject_id,
              subjectName: ch.subject_name,
              shortSubjectName: ch.short_subject_name,
              teacherId: ch.changed_teacher_id,
              teacherName: ch.teacher_name,
              roomId: ch.changed_room_id,
              roomName: ch.room_name || '일반교실',
              isChanged: true,
              changeType: ch.change_type
            };
          }
        }
      }
    }

    const isMatch = (tId, tName, tCode) => {
      const idStr = String(tId || '').trim();
      const nameStr = String(tName || '').trim();
      const codeStr = String(tCode || '').trim();

      if (idStr && (teacherIds.includes(idStr) || teacherCodes.includes(idStr) || allNames.includes(idStr))) return true;
      if (codeStr && (teacherCodes.includes(codeStr) || teacherIds.includes(codeStr))) return true;
      if (nameStr && allNames.some(n => nameStr === n || nameStr.includes(n) || n.includes(nameStr))) return true;

      return false;
    };

    const timetable = [];
    for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
      const curDate = new Date(monday);
      curDate.setDate(monday.getDate() + dayOffset);
      const curDateStr = curDate.toISOString().split('T')[0];
      const dayOfWeek = dayOffset + 1;

      const daySlots = [];
      for (let period = 1; period <= maxPeriods; period++) {
        let assignedSlot = null;
        
        for (const gcId in classMap) {
          const key = `${gcId}_${dayOfWeek}_${period}`;
          const slot = effectiveMap[key];
          if (slot && isMatch(slot.teacherId, slot.teacherName, slot.teacherCode)) {
            if (!assignedSlot) {
              assignedSlot = {
                ...slot,
                targetDate: curDateStr,
                gradeName: slot.gradeName,
                subjectName: slot.subjectName
              };
            } else {
              // Aggregate multiple classes for the same period
              const currentGrade = assignedSlot.gradeName || '';
              const newGrade = slot.gradeName || '';
              if (newGrade && !currentGrade.includes(newGrade)) {
                assignedSlot.gradeName = currentGrade ? `${currentGrade}, ${newGrade}` : newGrade;
              }
              const currentSub = assignedSlot.subjectName || '';
              const newSub = slot.subjectName || '';
              if (newSub && !currentSub.includes(newSub)) {
                assignedSlot.subjectName = currentSub ? `${currentSub}, ${newSub}` : newSub;
              }
            }
          }
        }

        // Check if this teacher was the original teacher of a cancelled or changed class
        if (!assignedSlot && !baseOnly) {
          const origChanges = changeRows.filter(ch => {
            const dateParts = String(ch.target_date).split('-').map(Number);
            const chDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            const chDay = chDate.getDay() === 0 ? 7 : chDate.getDay();
            return ch.target_date === curDateStr && chDay === dayOfWeek && parseInt(ch.period) === period && isMatch(ch.original_teacher_id, ch.teacher_name, ch.teacher_code);
          });

          if (origChanges.length > 0) {
            origChanges.forEach(origChange => {
              const gc = classMap[origChange.grade_class_id];
              const gName = gc ? `${gc.grade}학년 ${gc.class_number}반` : '';
              const sName = origChange.subject_name || '';
              
              if (!assignedSlot) {
                assignedSlot = {
                  gradeClassId: origChange.grade_class_id,
                  gradeName: gName,
                  dayOfWeek,
                  period,
                  subjectId: origChange.original_subject_id,
                  subjectName: sName,
                  shortSubjectName: origChange.short_subject_name || '',
                  teacherId: origChange.original_teacher_id,
                  teacherName: origChange.teacher_name || '',
                  roomId: origChange.original_room_id,
                  roomName: '일반교실',
                  isChanged: true,
                  changeType: origChange.change_type,
                  targetDate: curDateStr
                };
              } else {
                const currentGrade = assignedSlot.gradeName || '';
                if (gName && !currentGrade.includes(gName)) {
                  assignedSlot.gradeName = currentGrade ? `${currentGrade}, ${gName}` : gName;
                }
                const currentSub = assignedSlot.subjectName || '';
                if (sName && !currentSub.includes(sName)) {
                  assignedSlot.subjectName = currentSub ? `${currentSub}, ${sName}` : sName;
                }
              }
            });
          }
        }

        daySlots.push(assignedSlot || {
          dayOfWeek,
          period,
          targetDate: curDateStr,
          subjectName: '',
          shortSubjectName: '',
          gradeName: '',
          roomName: '',
          isChanged: false
        });
      }

      timetable.push({
        dayOfWeek,
        date: curDateStr,
        slots: daySlots
      });
    }

    res.json({
      schoolId,
      mondayDate: mondayStr,
      timetable
    });
  } catch (err) {
    console.error('Teacher timetable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. POST /api/timetable/change (Conflict Detection & Change Creation)
router.post('/timetable/change', async (req, res) => {
  try {
    const {
      schoolId,
      targetDate,
      period,
      gradeClassId,
      changeType, // 'SUBSTITUTE', 'CANCEL', 'SWAP'
      changedTeacherId,
      changedSubjectId,
      changedRoomId,
      reason,
      createdBy,
      force,
      sandbox
    } = req.body;

    if (!schoolId || !targetDate || !period || !gradeClassId || !changeType) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const dayOfWeek = getDayOfWeek(targetDate);
    const conflicts = [];

    if (changeType !== 'CANCEL') {
      // Fetch all classes in school for conflict check
      const allClasses = await all(`SELECT * FROM grade_classes WHERE school_id = ?`, [schoolId]);

      for (const gc of allClasses) {
        const slot = await getEffectiveSlot(schoolId, gc.id, targetDate, dayOfWeek, period);
        if (!slot) continue;

        // a) 학급 충돌: 해당 학급에 이미 다른 수업이 존재
        if (gc.id === gradeClassId && slot.subjectId && slot.teacherId) {
          // If it's a replacement for the same slot, note it
        }

        // b) 교사 충돌: 동일 교사가 다른 반 수업에 이미 배정되어 있음
        if (changedTeacherId && slot.teacherId && gc.id !== gradeClassId && slot.changeType !== 'CANCEL') {
          const teacher = await get(`SELECT name FROM teachers WHERE id = ?`, [changedTeacherId]);
          if (teacher && teacher.name === slot.teacherName) {
            conflicts.push({
              type: 'TEACHER_DUPLICATE',
              message: `[교사 충돌] ${teacher ? teacher.name : '해당 교사'}는 같은 시간(${targetDate} ${period}교시)에 ${gc.grade}학년 ${gc.class_number}반 수업에 이미 배정되어 있습니다.`
            });
          }
        }

        // c) 장소/특별실 충돌: 동일 장소(특별실)가 다른 반에 이미 배정되어 있음
        if (changedRoomId && slot.roomId === changedRoomId && gc.id !== gradeClassId && slot.changeType !== 'CANCEL') {
          const room = await get(`SELECT name FROM rooms WHERE id = ?`, [changedRoomId]);
          conflicts.push({
            type: 'ROOM_DUPLICATE',
            message: `[장소 충돌] ${room ? room.name : '해당 장소'}는 동일 시간(${targetDate} ${period}교시)에 ${gc.grade}학년 ${gc.class_number}반에서 이미 사용 중입니다.`
          });
        }
      }
    }

    if (conflicts.length > 0 && !force) {
      return res.status(409).json({
        hasConflict: true,
        conflicts
      });
    }

    // Get current base info for history
    const base = await get(
      `SELECT * FROM base_timetable WHERE school_id = ? AND grade_class_id = ? AND day_of_week = ? AND period = ?`,
      [schoolId, gradeClassId, dayOfWeek, period]
    );

    if (sandbox || String(sandbox) === 'true') {
      return res.status(200).json({ message: 'Sandbox change validated successfully (No database write)', sandbox: true });
    }

    const changeId = `chg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await run(
      `INSERT INTO timetable_changes (
        id, school_id, target_date, period, grade_class_id, change_type,
        original_teacher_id, changed_teacher_id,
        original_subject_id, changed_subject_id,
        original_room_id, changed_room_id,
        reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        changeId,
        schoolId,
        targetDate,
        period,
        gradeClassId,
        changeType,
        base ? base.teacher_id : null,
        changedTeacherId || null,
        base ? base.subject_id : null,
        changedSubjectId || null,
        base ? base.room_id : null,
        changedRoomId || null,
        reason || '일과계 시간표 조정',
        createdBy || '관리자'
      ]
    );

    const createdChange = await get(`SELECT * FROM timetable_changes WHERE id = ?`, [changeId]);

    res.status(201).json({
      message: 'Timetable change applied successfully',
      change: createdChange
    });
  } catch (err) {
    console.error('Timetable change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. GET /api/timetable/logs?schoolId=...
router.get('/timetable/logs', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const logs = await all(
      `SELECT tc.*, 
              gc.grade, gc.class_number,
              orig_sub.name as orig_subject_name, chg_sub.name as chg_subject_name,
              orig_t.name as orig_teacher_name, chg_t.name as chg_teacher_name
       FROM timetable_changes tc
       JOIN grade_classes gc ON tc.grade_class_id = gc.id
       LEFT JOIN subjects orig_sub ON CAST(tc.original_subject_id AS VARCHAR) = CAST(orig_sub.id AS VARCHAR)
       LEFT JOIN subjects chg_sub ON CAST(tc.changed_subject_id AS VARCHAR) = CAST(chg_sub.id AS VARCHAR)
       LEFT JOIN teachers orig_t ON (CAST(tc.original_teacher_id AS VARCHAR) = CAST(orig_t.id AS VARCHAR) OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.code OR CAST(tc.original_teacher_id AS VARCHAR) = orig_t.name)
       LEFT JOIN teachers chg_t ON (CAST(tc.changed_teacher_id AS VARCHAR) = CAST(chg_t.id AS VARCHAR) OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.code OR CAST(tc.changed_teacher_id AS VARCHAR) = chg_t.name)
       WHERE tc.school_id = ?
       ORDER BY tc.created_at DESC
       LIMIT 50`,
      [schoolId]
    );

    res.json(logs);
  } catch (err) {
    console.error('Timetable logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
