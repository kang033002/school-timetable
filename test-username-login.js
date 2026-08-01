async function testUsernameLogin() {
  console.log('--- TESTING SIMPLE USERNAME LOGIN & MASTER CREDENTIALS ---');

  // 1. Register new school "인터넷고등학교" with admin ID "internet" and password "internet123"
  const regRes = await fetch('http://localhost:3000/api/auth/register-school', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: '인터넷고등학교',
      adminEmail: 'internet', // sent in email property
      adminPassword: 'internet123'
    })
  });
  console.log('1. School Registration:', regRes.status, await regRes.json());

  // 2. Login as Master Admin using "master" / "master123"
  const loginMaster = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'master',
      password: 'master123'
    })
  });
  const masterData = await loginMaster.json();
  console.log('2. Master Login:', loginMaster.status, masterData);
  const masterToken = masterData.token;

  // 3. Fetch school list (should show internet / internet123 in list)
  const listRes = await fetch('http://localhost:3000/api/master/schools', {
    headers: { 'Authorization': `Bearer ${masterToken}` }
  });
  const schools = await listRes.json();
  console.log('3. Schools list with credentials:', schools);

  // 4. Update Master credentials to "newmaster" / "newpass"
  const changeRes = await fetch('http://localhost:3000/api/master/change-credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${masterToken}`
    },
    body: JSON.stringify({
      userId: masterData.user.id,
      newUsername: 'newmaster',
      newPassword: 'newpass'
    })
  });
  console.log('4. Change Master Credentials:', changeRes.status, await changeRes.json());

  // 5. Try login with old master credentials (should fail)
  const loginMasterOld = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'master',
      password: 'master123'
    })
  });
  console.log('5. Login with old credentials (fails):', loginMasterOld.status, await loginMasterOld.json());

  // 6. Login with new master credentials (should succeed)
  const loginMasterNew = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'newmaster',
      password: 'newpass'
    })
  });
  console.log('6. Login with new credentials (succeeds):', loginMasterNew.status, await loginMasterNew.json());
}

testUsernameLogin().catch(console.error);
