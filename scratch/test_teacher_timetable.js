const { get, all } = require('../src/db/database');

async function testTeacherTimetable() {
  try {
    const schoolId = 3; // Example school ID
    const date = '2026-08-03';
    
    // Get all teachers in school 3
    const teachers = await all(`SELECT id, name, subject_name FROM teachers WHERE school_id = ?`, [schoolId]);
    console.log("Teachers in school:", teachers);

    if (teachers.length === 0) {
      console.log("No teachers found!");
      return;
    }

    const testTeacher = teachers[0];
    console.log("Testing with teacher:", testTeacher);

    // Run base_timetable query
    const baseRows = await all(`
      SELECT bt.*, 
             sub.name as subject_name,
             t.name as teacher_name
      FROM base_timetable bt
      JOIN subjects sub ON bt.subject_id = sub.id
      JOIN teachers t ON bt.teacher_id = t.id
      WHERE bt.school_id = ?
    `, [schoolId]);

    console.log("Base timetable rows count:", baseRows.length);
    console.log("Sample base row:", baseRows[0]);

  } catch (err) {
    console.error("Test error:", err);
  }
}

testTeacherTimetable();
