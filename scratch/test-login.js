async function testLogin() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dofj34@ansdf.cm',
      password: '1234'
    })
  });
  console.log('Login Status:', res.status, await res.json());
}
testLogin().catch(console.error);
