async function testCredentials() {
  console.log('--- TESTING CHANGE CREDENTIALS FLOW ---');

  // 1. Submit credentials update for admin
  const chgRes = await fetch('http://localhost:3000/api/admin/change-credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'u-admin',
      newEmail: 'admin-new@seoul.hs.kr',
      newPassword: 'newpassword123'
    })
  });
  console.log('1. Credentials Update Status:', chgRes.status, await chgRes.json());

  // 2. Attempt login with old credentials
  const oldLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@seoul.hs.kr',
      password: 'admin123'
    })
  });
  console.log('2. Old Login Status:', oldLogin.status, await oldLogin.json());

  // 3. Attempt login with new credentials
  const newLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin-new@seoul.hs.kr',
      password: 'newpassword123'
    })
  });
  console.log('3. New Login Status:', newLogin.status, await newLogin.json());
}

testCredentials().catch(console.error);
