async function testDelete() {
  console.log('--- TESTING DELETE FLOW ---');
  
  // Fetch meta first
  const metaRes = await fetch('http://localhost:3000/api/schools/sch-1/meta');
  const meta = await metaRes.json();
  const testTeacher = meta.teachers[0];
  const testSubject = meta.subjects[0];

  console.log('Found teacher to delete:', testTeacher);
  console.log('Found subject to delete:', testSubject);

  if (testTeacher) {
    const tDel = await fetch(`http://localhost:3000/api/admin/teachers/${testTeacher.id}`, { method: 'DELETE' });
    console.log('Teacher delete status:', tDel.status, await tDel.json());
  }

  if (testSubject) {
    const sDel = await fetch(`http://localhost:3000/api/admin/subjects/${testSubject.id}`, { method: 'DELETE' });
    console.log('Subject delete status:', sDel.status, await sDel.json());
  }

  // Fetch meta again
  const metaRes2 = await fetch('http://localhost:3000/api/schools/sch-1/meta');
  const meta2 = await metaRes2.json();
  console.log('Teachers left:', meta2.teachers.length, 'Subjects left:', meta2.subjects.length);
}

testDelete().catch(console.error);
