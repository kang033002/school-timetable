async function testHolidays() {
  console.log('--- TESTING BASE TIMETABLE AND HOLIDAYS ---');

  const schoolId = 'sch-1';
  const classId = 'gc-1-1'; // 1학년 1반 ID
  const testDate = '2026-08-04'; // 화요일 (dayOfWeek = 2)

  // 0. Fetch metadata to get valid IDs
  const metaRes = await fetch(`http://localhost:3000/api/schools/${schoolId}/meta`);
  const meta = await metaRes.json();
  const teacherId = meta.teachers[0].id;
  const subjectId = meta.subjects[0].id;
  console.log('Resolved Teacher ID:', teacherId, 'Subject ID:', subjectId);

  // 1. Create a base timetable slot: Tuesday 2nd period
  const btRes = await fetch('http://localhost:3000/api/admin/base-timetable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId,
      gradeClassId: classId,
      dayOfWeek: 2,
      period: 2,
      subjectId,
      teacherId
    })
  });
  console.log('1. Base Timetable Update:', btRes.status, await btRes.json());

  // 2. Fetch class timetable for the week of testDate
  const ttResBefore = await fetch(`http://localhost:3000/api/timetable/class?schoolId=${schoolId}&grade=1&classNumber=1&date=${testDate}`);
  const ttDataBefore = await ttResBefore.json();
  const tuesdaySlot = ttDataBefore.timetable[1].slots[1]; // Tuesday 2nd period
  console.log('2. Tuesday 2nd period before holiday:', tuesdaySlot);

  // 3. Register a Holiday on Tuesday 2026-08-04 -> "개교기념일"
  const holRes = await fetch('http://localhost:3000/api/admin/holidays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId,
      targetDate: testDate,
      name: '개교기념일'
    })
  });
  console.log('3. Holiday Register:', holRes.status, await holRes.json());

  // 4. Fetch class timetable for the week of testDate again
  const ttResAfter = await fetch(`http://localhost:3000/api/timetable/class?schoolId=${schoolId}&grade=1&classNumber=1&date=${testDate}`);
  const ttDataAfter = await ttResAfter.json();
  const tuesdaySlotAfter = ttDataAfter.timetable[1].slots[1]; // Tuesday 2nd period
  console.log('4. Tuesday 2nd period after holiday:', tuesdaySlotAfter);
}

testHolidays().catch(console.error);
