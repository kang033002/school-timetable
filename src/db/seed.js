const { run, initSchema } = require('./database');

async function seed() {
  console.log('Starting DB Seeding...');
  await initSchema();

  // Clear existing data
  await run(`DELETE FROM timetable_changes`);
  await run(`DELETE FROM base_timetable`);
  await run(`DELETE FROM user_accounts`);
  await run(`DELETE FROM grade_classes`);
  await run(`DELETE FROM teachers`);
  await run(`DELETE FROM subjects`);
  await run(`DELETE FROM rooms`);
  await run(`DELETE FROM schools`);

  // 1. Insert School
  const schoolId = 'sch-1';
  await run(
    `INSERT INTO schools (id, code, name, max_periods_per_day, operating_days, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [schoolId, 'SCH-SEOUL', '서울고등학교', 9, 5, 'APPROVED']
  );

  // 2. Insert Teachers
  const teachers = [
    { id: 't-1', name: '김철수', code: '김철', subject: '국어' },
    { id: 't-2', name: '이영희', code: '이영', subject: '수학' },
    { id: 't-3', name: '박민수', code: '박민', subject: '영어' },
    { id: 't-4', name: '최지훈', code: '최지', subject: '과학' },
    { id: 't-5', name: '정유진', code: '정유', subject: '사회' },
    { id: 't-6', name: '강동원', code: '강동', subject: '체육' },
    { id: 't-7', name: '윤서연', code: '윤서', subject: '음악' },
    { id: 't-8', name: '한승우', code: '한승', subject: '미술' },
  ];

  for (const t of teachers) {
    await run(
      `INSERT INTO teachers (id, school_id, name, code, subject_name)
       VALUES (?, ?, ?, ?, ?)`,
      [t.id, schoolId, t.name, t.code, t.subject]
    );
  }

  // 3. Insert GradeClasses
  const gradeClasses = [
    { id: 'gc-1-1', grade: 1, class_number: 1, homeroom: 't-1' },
    { id: 'gc-1-2', grade: 1, class_number: 2, homeroom: 't-2' },
    { id: 'gc-2-1', grade: 2, class_number: 1, homeroom: 't-3' },
  ];

  for (const gc of gradeClasses) {
    await run(
      `INSERT INTO grade_classes (id, school_id, grade, class_number, homeroom_teacher_id)
       VALUES (?, ?, ?, ?, ?)`,
      [gc.id, schoolId, gc.grade, gc.class_number, gc.homeroom]
    );
  }

  // 4. Insert Subjects
  const subjects = [
    { id: 'sub-1', name: '국어', short_name: '국어' },
    { id: 'sub-2', name: '수학', short_name: '수학' },
    { id: 'sub-3', name: '영어', short_name: '영어' },
    { id: 'sub-4', name: '과학실험', short_name: '과학' },
    { id: 'sub-5', name: '사회', short_name: '사회' },
    { id: 'sub-6', name: '체육', short_name: '체육' },
    { id: 'sub-7', name: '음악', short_name: '음악' },
    { id: 'sub-8', name: '미술', short_name: '미술' },
  ];

  for (const s of subjects) {
    await run(
      `INSERT INTO subjects (id, school_id, name, short_name)
       VALUES (?, ?, ?, ?)`,
      [s.id, schoolId, s.name, s.short_name]
    );
  }

  // 5. Insert Rooms
  const rooms = [
    { id: 'r-main', name: '일반교실', is_special_room: 0 },
    { id: 'r-sci', name: '과학1실', is_special_room: 1 },
    { id: 'r-mus', name: '음악실', is_special_room: 1 },
    { id: 'r-gym', name: '체육관', is_special_room: 1 },
  ];

  for (const r of rooms) {
    await run(
      `INSERT INTO rooms (id, school_id, name, is_special_room)
       VALUES (?, ?, ?, ?)`,
      [r.id, schoolId, r.name, r.is_special_room]
    );
  }

  // 6. Insert BaseTimetable for 1-1, 1-2, 2-1 (5 days x 7 periods)
  // Teacher mapping per subject:
  // sub-1 (국어) -> t-1
  // sub-2 (수학) -> t-2
  // sub-3 (영어) -> t-3
  // sub-4 (과학) -> t-4 (Room: r-sci)
  // sub-5 (사회) -> t-5
  // sub-6 (체육) -> t-6 (Room: r-gym)
  // sub-7 (음악) -> t-7 (Room: r-mus)
  // sub-8 (미술) -> t-8

  const pattern1_1 = [
    ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5', 'sub-6', 'sub-7'], // 월
    ['sub-2', 'sub-1', 'sub-4', 'sub-3', 'sub-6', 'sub-5', 'sub-8'], // 화
    ['sub-3', 'sub-5', 'sub-1', 'sub-2', 'sub-7', 'sub-8', 'sub-6'], // 수
    ['sub-4', 'sub-3', 'sub-2', 'sub-1', 'sub-5', 'sub-6', 'sub-7'], // 목
    ['sub-5', 'sub-4', 'sub-3', 'sub-2', 'sub-1', 'sub-7', 'sub-8'], // 금
  ];

  const pattern1_2 = [
    ['sub-2', 'sub-1', 'sub-5', 'sub-6', 'sub-3', 'sub-4', 'sub-8'], // 월
    ['sub-3', 'sub-4', 'sub-1', 'sub-2', 'sub-5', 'sub-7', 'sub-6'], // 화
    ['sub-1', 'sub-2', 'sub-3', 'sub-5', 'sub-8', 'sub-6', 'sub-7'], // 수
    ['sub-5', 'sub-1', 'sub-4', 'sub-3', 'sub-2', 'sub-7', 'sub-8'], // 목
    ['sub-4', 'sub-3', 'sub-2', 'sub-5', 'sub-6', 'sub-1', 'sub-7'], // 금
  ];

  const pattern2_1 = [
    ['sub-3', 'sub-4', 'sub-1', 'sub-2', 'sub-7', 'sub-5', 'sub-6'], // 월
    ['sub-1', 'sub-3', 'sub-2', 'sub-5', 'sub-4', 'sub-8', 'sub-7'], // 화
    ['sub-2', 'sub-4', 'sub-5', 'sub-1', 'sub-6', 'sub-7', 'sub-8'], // 수
    ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-6', 'sub-5', 'sub-7'], // 목
    ['sub-2', 'sub-1', 'sub-5', 'sub-3', 'sub-4', 'sub-8', 'sub-6'], // 금
  ];

  const teacherMap = {
    'sub-1': 't-1',
    'sub-2': 't-2',
    'sub-3': 't-3',
    'sub-4': 't-4',
    'sub-5': 't-5',
    'sub-6': 't-6',
    'sub-7': 't-7',
    'sub-8': 't-8',
  };

  const roomMap = {
    'sub-4': 'r-sci',
    'sub-6': 'r-gym',
    'sub-7': 'r-mus',
  };

  async function populateClassTimetable(classId, pattern) {
    let entryCount = 0;
    for (let day = 1; day <= 5; day++) {
      for (let period = 1; period <= 7; period++) {
        const subId = pattern[day - 1][period - 1];
        const teacherId = teacherMap[subId];
        const roomId = roomMap[subId] || null;
        const entryId = `bt-${classId}-${day}-${period}`;

        await run(
          `INSERT INTO base_timetable (id, school_id, grade_class_id, day_of_week, period, teacher_id, subject_id, room_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [entryId, schoolId, classId, day, period, teacherId, subId, roomId]
        );
        entryCount++;
      }
    }
    return entryCount;
  }

  await populateClassTimetable('gc-1-1', pattern1_1);
  await populateClassTimetable('gc-1-2', pattern1_2);
  await populateClassTimetable('gc-2-1', pattern2_1);

  // 7. Insert User Accounts
  await run(
    `INSERT INTO schools (id, code, name, max_periods_per_day, operating_days, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['SYSTEM', 'SYSTEM_ADMIN_CODE', '시스템 관리 본부', 7, 5, 'APPROVED']
  );

  await run(
    `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['u-master', 'SYSTEM', 'master', 'master123', 'MASTER_ADMIN', null, '개발자(마스터)', 'APPROVED']
  );

  await run(
    `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['u-admin', schoolId, 'admin', 'admin123', 'ADMIN', null, '일과계 관리자', 'APPROVED']
  );

  await run(
    `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['u-t1', schoolId, 'teacher1', 'teacher123', 'TEACHER', 't-1', '김철수 선생님', 'APPROVED']
  );

  console.log('DB Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Seed error:', err);
});
