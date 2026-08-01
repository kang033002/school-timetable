async function testAPIs() {
  console.log('--- TESTING BACKEND APIS ---');

  // 1. Health Check
  const healthRes = await fetch('http://localhost:3000/api/health');
  console.log('1. Health Check:', await healthRes.json());

  // 2. School Search
  const searchRes = await fetch('http://localhost:3000/api/schools/search?q=서울');
  console.log('2. School Search:', await searchRes.json());

  // 3. School Metadata
  const metaRes = await fetch('http://localhost:3000/api/schools/sch-1/meta');
  const meta = await metaRes.json();
  console.log('3. Meta (GradeClasses count):', meta.gradeClasses.length, 'Teachers count:', meta.teachers.length);

  // 4. Class Timetable (1-1)
  const classRes = await fetch('http://localhost:3000/api/timetable/class?schoolId=sch-1&grade=1&classNumber=1&date=2026-08-03');
  const classTt = await classRes.json();
  console.log('4. Class Timetable 1-1 Mon 1st period:', classTt.timetable[0].slots[0]);

  // 5. Conflict Test: Try assigning 김철수 (t-1) to 1-2 at Mon 1st period (he is already at 1-1!)
  const conflictRes = await fetch('http://localhost:3000/api/timetable/change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      targetDate: '2026-08-03',
      period: 1,
      gradeClassId: 'gc-1-2',
      changeType: 'SUBSTITUTE',
      changedTeacherId: 't-1', // 김철수 선생님
      changedSubjectId: 'sub-1',
      reason: '보강 충돌 테스트'
    })
  });
  console.log('5. Conflict Response Status:', conflictRes.status);
  console.log('   Conflict Body:', await conflictRes.json());

  // 6. Valid Change Test: Assign 이영희 (t-2) or substitute
  const validRes = await fetch('http://localhost:3000/api/timetable/change', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      targetDate: '2026-08-03',
      period: 5,
      gradeClassId: 'gc-1-1',
      changeType: 'SUBSTITUTE',
      changedTeacherId: 't-8', // 한승우 선생님
      changedSubjectId: 'sub-8', // 미술
      reason: '사회 선생님 조퇴로 인한 미술 보강'
    })
  });
  console.log('6. Valid Change Status:', validRes.status, await validRes.json());

  // 7. Verify updated Class Timetable for 1-1 (should show change with isChanged=true)
  const updatedClassRes = await fetch('http://localhost:3000/api/timetable/class?schoolId=sch-1&grade=1&classNumber=1&date=2026-08-03');
  const updatedClassTt = await updatedClassRes.json();
  console.log('7. Updated Mon 5th period slot:', updatedClassTt.timetable[0].slots[4]);
}

testAPIs().catch(console.error);
