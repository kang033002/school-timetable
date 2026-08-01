async function testStudentRegister() {
  console.log('--- TESTING STUDENT SIGNUP FLOW ---');

  // 1. Submit student signup
  const regRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      role: 'STUDENT',
      grade: 1,
      classNumber: 3,
      name: '이순신'
    })
  });
  console.log('1. Student Register Status:', regRes.status, await regRes.json());

  // 2. Fetch pending list as Admin
  const pendingRes = await fetch('http://localhost:3000/api/admin/users/pending?schoolId=sch-1');
  const pending = await pendingRes.json();
  console.log('2. Pending Requests:', pending);
}

testStudentRegister().catch(console.error);
