async function test9Periods() {
  console.log('--- TESTING 9 PERIODS SKELETON TIMETABLE ---');
  const res = await fetch('http://localhost:3000/api/timetable/class?schoolId=sch-1&grade=1&classNumber=1');
  const data = await res.json();
  console.log('Timetable Slots Length per day:', data.timetable[0].slots.length);
  if (data.timetable[0].slots.length === 9) {
    console.log('SUCCESS: Timetable supports 9 periods!');
  } else {
    console.error('FAILED: Timetable does not support 9 periods. Length is:', data.timetable[0].slots.length);
  }
}
test9Periods().catch(console.error);
