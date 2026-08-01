async function testAdminFlow() {
  console.log('--- TESTING ADMIN FLOW ---');

  // 1. Create Teacher
  const tRes = await fetch('http://localhost:3000/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      name: '홍길동',
      code: '홍길',
      subjectName: '역사'
    })
  });
  console.log('1. Teacher Creation Status:', tRes.status, await tRes.json());

  // 2. Create Subject
  const sRes = await fetch('http://localhost:3000/api/admin/subjects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      name: '세계사',
      shortName: '세사'
    })
  });
  console.log('2. Subject Creation Status:', sRes.status, await sRes.json());

  // 3. Create Class (2학년 2반, 담임: 홍길동 (t-9 or the newly created teacher id))
  const cRes = await fetch('http://localhost:3000/api/admin/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      grade: 2,
      classNumber: 2,
      homeroomTeacherId: 't-1' // Assigning existing t-1 for testing
    })
  });
  console.log('3. Class Creation Status:', cRes.status, await cRes.json());

  // 4. Test Teacher Registration Request (Sign up)
  const regRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: 'sch-1',
      email: 'teacher2@seoul.hs.kr',
      password: 'password123',
      name: '홍길동'
    })
  });
  console.log('4. Register Status:', regRes.status, await regRes.json());

  // 5. Fetch Pending Users
  const pendingRes = await fetch('http://localhost:3000/api/admin/users/pending?schoolId=sch-1');
  const pendingUsers = await pendingRes.json();
  console.log('5. Pending Users List:', pendingUsers);

  if (pendingUsers.length > 0) {
    // 6. Approve User
    const approveRes = await fetch('http://localhost:3000/api/admin/users/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: pendingUsers[0].id,
        status: 'APPROVED'
      })
    });
    console.log('6. Approve Status:', approveRes.status, await approveRes.json());
  }
}

testAdminFlow().catch(console.error);
