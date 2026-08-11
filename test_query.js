const { all } = require('./src/db/database');

async function test() {
  try {
    const res = await all(`
      SELECT bt.id, bt.teacher_id, t.id as t_id, t.code, t.name
      FROM base_timetable bt
      LEFT JOIN teachers t ON (CAST(bt.teacher_id AS VARCHAR) = CAST(t.id AS VARCHAR) OR bt.teacher_id = t.code OR bt.teacher_id = t.name)
      LIMIT 5
    `);
    console.log('Result:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
