const express = require('express');
const router = express.Router();
const { get, all, run } = require('../db/database');

// ────────────────────────────────────────────────────────────────────────────
// 그리디 + 백트래킹 시간표 자동 생성 알고리즘
// ────────────────────────────────────────────────────────────────────────────

// 1. 단일 시도 함수
function attemptGeneration(assignments, maxPeriodsPerDay, operatingDays, fixedSlots, targetSubjectIds, allowOverlap) {
  const schedule = {};
  const teacherBusy = {};
  const result = [];

  for (const gc of assignments) {
    schedule[gc.gradeClassId] = {};
    for (let d = 1; d <= operatingDays; d++) {
      schedule[gc.gradeClassId][d] = {};
    }
  }

  // 1. 수동 배치된 셀(fixedSlots) 먼저 고정(Lock) 처리
  const fixedCounts = {}; // key: `${gradeClassId}_${subjectId}_${teacherId}` -> count
  for (const fs of fixedSlots) {
    const { gradeClassId, dayOfWeek, period, subjectId, teacherId } = fs;
    if (!schedule[gradeClassId]) schedule[gradeClassId] = {};
    if (!schedule[gradeClassId][dayOfWeek]) schedule[gradeClassId][dayOfWeek] = {};

    schedule[gradeClassId][dayOfWeek][period] = { subjectId, teacherId };
    
    if (teacherId) {
      if (!teacherBusy[teacherId]) teacherBusy[teacherId] = {};
      if (!teacherBusy[teacherId][dayOfWeek]) teacherBusy[teacherId][dayOfWeek] = new Set();
      teacherBusy[teacherId][dayOfWeek].add(period);
    }

    result.push({ gradeClassId, dayOfWeek, period, subjectId, teacherId, isFixed: true });

    const key = `${gradeClassId}_${subjectId}_${teacherId}`;
    fixedCounts[key] = (fixedCounts[key] || 0) + 1;
  }

  // 2. 배정해야 할 잔여 슬롯 목록 생성
  const targetSet = targetSubjectIds.length > 0 ? new Set(targetSubjectIds) : null;
  const slots = [];

  for (const gc of assignments) {
    for (const sub of gc.subjects) {
      if (targetSet && !targetSet.has(sub.subjectId)) continue;

      const key = `${gc.gradeClassId}_${sub.subjectId}_${sub.teacherId}`;
      const alreadyPlaced = fixedCounts[key] || 0;
      const remainingHours = Math.max(0, sub.weeklyHours - alreadyPlaced);

      for (let i = 0; i < remainingHours; i++) {
        slots.push({
          gradeClassId: gc.gradeClassId,
          subjectId: sub.subjectId,
          teacherId: sub.teacherId,
          subjectName: sub.subjectName,
          teacherName: sub.teacherName
        });
      }
    }
  }

  slots.sort(() => Math.random() - 0.5);

  const unassigned = [];

  for (const slot of slots) {
    const { gradeClassId, subjectId, teacherId } = slot;
    let placed = false;

    const options = [];
    for (let d = 1; d <= operatingDays; d++) {
      for (let p = 1; p <= maxPeriodsPerDay; p++) {
        options.push({ d, p });
      }
    }
    options.sort(() => Math.random() - 0.5);

    for (const { d, p } of options) {
      if (schedule[gradeClassId]?.[d]?.[p]) continue;
      if (!allowOverlap && teacherBusy[teacherId]?.[d]?.has(p)) continue;

      const sameSubjectToday = Object.values(schedule[gradeClassId]?.[d] || {})
        .filter(s => s.subjectId === subjectId).length;
      if (sameSubjectToday >= 2) continue;

      if (!schedule[gradeClassId]) schedule[gradeClassId] = {};
      if (!schedule[gradeClassId][d]) schedule[gradeClassId][d] = {};
      schedule[gradeClassId][d][p] = { subjectId, teacherId };

      if (!teacherBusy[teacherId]) teacherBusy[teacherId] = {};
      if (!teacherBusy[teacherId][d]) teacherBusy[teacherId][d] = new Set();
      teacherBusy[teacherId][d].add(p);

      result.push({ gradeClassId, dayOfWeek: d, period: p, subjectId, teacherId });
      placed = true;
      break;
    }

    if (!placed) {
      unassigned.push(slot);
    }
  }

  return { result, unassigned };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. GET /api/generator/data?schoolId=...
//    자동 생성에 필요한 학급/과목/교사 데이터 반환
// ────────────────────────────────────────────────────────────────────────────
router.get('/data', async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    // sports 삭제 및 교사 목록에 존재하는 모든 교과목이 subjects 테이블에 존재하도록 자동 동기화
    await run(`DELETE FROM subjects WHERE LOWER(name) = 'sports' OR LOWER(short_name) = 'sports'`);
    
    const teacherSubjects = await all(
      `SELECT DISTINCT subject_name FROM teachers WHERE school_id = ? AND subject_name IS NOT NULL AND subject_name != '' AND LOWER(subject_name) != 'sports'`,
      [schoolId]
    );
    for (const ts of teacherSubjects) {
      const subName = (ts.subject_name || '').trim();
      if (!subName || subName === '미지정' || subName.toLowerCase() === 'sports') continue;
      const existing = await get(
        `SELECT id FROM subjects WHERE school_id = ? AND LOWER(name) = ?`,
        [schoolId, subName.toLowerCase()]
      );
      if (!existing) {
        await run(
          `INSERT INTO subjects (id, school_id, name, short_name) VALUES (?, ?, ?, ?)`,
          [`sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`, schoolId, subName, subName]
        );
      }
    }

    const classes = await all(
      `SELECT id, grade, class_number FROM grade_classes WHERE school_id = ? ORDER BY grade, class_number`,
      [schoolId]
    );
    const rawSubjects = await all(
      `SELECT id, name FROM subjects WHERE school_id = ? AND LOWER(name) != 'sports' ORDER BY name`,
      [schoolId]
    );
    const seenNames = new Set();
    const subjects = rawSubjects.filter(s => {
      if (seenNames.has(s.name)) return false;
      seenNames.add(s.name);
      return true;
    });
    const teachers = await all(
      `SELECT id, name, subject_name, weekly_hours FROM teachers WHERE school_id = ? ORDER BY name`,
      [schoolId]
    );
    const school = await get(
      `SELECT max_periods_per_day, operating_days FROM schools WHERE id = ?`,
      [schoolId]
    );

    res.json({
      classes,
      subjects,
      teachers,
      maxPeriodsPerDay: Math.max(school?.max_periods_per_day || 10, 10),
      operatingDays: school?.operating_days || 5
    });
  } catch (err) {
    console.error('Generator error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 2. POST /api/generator/generate
//    시간표 자동 생성 (수동 배치 셀 보존 및 선택 과목만 빈 공간에 생성)
// ────────────────────────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const { schoolId, assignments, fixedSlots = [], targetSubjectIds = [] } = req.body;
    if (!schoolId || !assignments?.length) {
      return res.status(400).json({ error: 'schoolId and assignments are required' });
    }

    const subjects = await all(`SELECT id, name FROM subjects WHERE school_id = ?`, [schoolId]);
    const teachers = await all(`SELECT id, name FROM teachers WHERE school_id = ?`, [schoolId]);
    const subMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));
    const tchMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));

    const school = await get(`SELECT max_periods_per_day, operating_days FROM schools WHERE id = ?`, [schoolId]);
    const maxPeriodsPerDay = req.body.maxPeriodsPerDay || school?.max_periods_per_day || 10;
    const operatingDays = req.body.operatingDays || school?.operating_days || 5;

    // 과목명/교사명 주입
    const enrichedAssignments = assignments.map(gc => ({
      ...gc,
      subjects: gc.subjects.map(s => ({
        ...s,
        subjectName: subMap[s.subjectId] || s.subjectId,
        teacherName: tchMap[s.teacherId] || s.teacherId
      }))
    }));

    const { result, unassigned } = generateTimetable(
      enrichedAssignments,
      maxPeriodsPerDay,
      operatingDays,
      fixedSlots,
      targetSubjectIds,
      req.body.allowOverlap === true
    );

    // 결과에 이름 추가
    const enrichedResult = result.map(r => ({
      ...r,
      subjectName: subMap[r.subjectId] || r.subjectId,
      teacherName: tchMap[r.teacherId] || r.teacherId
    }));

    const enrichedUnassigned = unassigned.map(u => ({
      gradeClassId: u.gradeClassId,
      subjectName: subMap[u.subjectId] || u.subjectId,
      teacherName: tchMap[u.teacherId] || u.teacherId
    }));

    res.json({
      success: true,
      timetable: enrichedResult,
      unassigned: enrichedUnassigned,
      maxPeriodsPerDay,
      operatingDays
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 3. POST /api/generator/apply
//    생성된 시간표를 base_timetable에 저장 (기존 데이터 덮어쓰기)
// ────────────────────────────────────────────────────────────────────────────
router.post('/apply', async (req, res) => {
  try {
    const { schoolId, timetable } = req.body;
    if (!schoolId || !timetable?.length) {
      return res.status(400).json({ error: 'schoolId and timetable are required' });
    }

    // 해당 학교의 학급들 중 포함된 gradeClassIds만 초기화
    const affectedClasses = [...new Set(timetable.map(r => r.gradeClassId))];

    for (const gcId of affectedClasses) {
      await run(
        `DELETE FROM base_timetable WHERE school_id = ? AND grade_class_id = ?`,
        [schoolId, gcId]
      );
      // Clear old changes for these classes as well to ensure a clean slate
      await run(
        `DELETE FROM timetable_changes WHERE school_id = ? AND grade_class_id = ?`,
        [schoolId, gcId]
      );
    }

    // 새 시간표 삽입
    for (const slot of timetable) {
      const id = `bt-${slot.gradeClassId}-${slot.dayOfWeek}-${slot.period}`;
      await run(
        `INSERT INTO base_timetable (id, school_id, grade_class_id, day_of_week, period, teacher_id, subject_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(grade_class_id, day_of_week, period) DO UPDATE SET
         teacher_id = excluded.teacher_id, subject_id = excluded.subject_id`,
        [id, schoolId, slot.gradeClassId, slot.dayOfWeek, slot.period, slot.teacherId, slot.subjectId]
      );
    }

    res.json({ success: true, applied: timetable.length });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

module.exports = router;

