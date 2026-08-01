async function testMultitenant() {
  console.log('--- TESTING MULTI-TENANT ARCHITECTURE ---');

  // 1. Login with approved school admin (서울고등학교)
  const loginSeoul = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@seoul.hs.kr',
      password: 'admin123'
    })
  });
  console.log('1. Seoul Admin Login Status:', loginSeoul.status, await loginSeoul.json());

  // 2. Request new school registration: "부산고등학교"
  const regBusan = await fetch('http://localhost:3000/api/auth/register-school', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: '부산고등학교',
      adminEmail: 'busan@school.com',
      adminPassword: 'busanpassword123'
    })
  });
  console.log('2. Busan School Registration Status:', regBusan.status, await regBusan.json());

  // 3. Attempt login with Busan school admin (should fail - school is pending approval)
  const loginBusanBefore = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'busan@school.com',
      password: 'busanpassword123'
    })
  });
  console.log('3. Busan Admin Login Before Master Approval Status:', loginBusanBefore.status, await loginBusanBefore.json());

  // 4. Log in as Master Developer Admin
  const loginMaster = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'master@admin.com',
      password: 'master123'
    })
  });
  const masterData = await loginMaster.json();
  console.log('4. Master Developer Login Status:', loginMaster.status, masterData);
  const masterToken = masterData.token;

  // 5. Get school list from master portal
  const listRes = await fetch('http://localhost:3000/api/master/schools', {
    headers: { 'Authorization': `Bearer ${masterToken}` }
  });
  const schools = await listRes.json();
  console.log('5. Schools in Master Portal:', schools);
  const busanSchool = schools.find(s => s.name === '부산고등학교');

  if (busanSchool) {
    // 6. Approve Busan School
    const approveRes = await fetch('http://localhost:3000/api/master/schools/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${masterToken}`
      },
      body: JSON.stringify({
        schoolId: busanSchool.id,
        status: 'APPROVED'
      })
    });
    console.log('6. Master Approving Busan School Status:', approveRes.status, await approveRes.json());

    // 7. Login with Busan school admin again (should succeed now)
    const loginBusanAfter = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'busan@school.com',
        password: 'busanpassword123'
      })
    });
    console.log('7. Busan Admin Login After Master Approval Status:', loginBusanAfter.status, await loginBusanAfter.json());
  }
}

testMultitenant().catch(console.error);
