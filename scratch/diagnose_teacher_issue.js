const { get, all } = require('../src/db/database');

async function diagnose() {
  try {
    console.log("=== 1. Checking Schools ===");
    const schools = await all(`SELECT * FROM schools`);
    console.log("Schools:", schools);

    if (schools.length === 0) {
      console.log("No schools in database!");
      return;
    }

    const schoolId = schools[0].id;
    console.log(`Using schoolId = ${schoolId}`);

    console.log("\n=== 2. Checking Teachers ===");
    const teachers = await all(`SELECT id, school_id, name, subject_name FROM teachers WHERE school_id = ?`, [schoolId]);
    console.log(`Found ${teachers.length} teachers:`, teachers.slice(0, 10));

    console.log("\n=== 3. Checking Grade Classes ===");
    const classes = await all(`SELECT id, school_id, grade, class_number FROM grade_classes WHERE school_id = ?`, [schoolId]);
    console.log(`Found ${classes.length} classes:`, classes.slice(0, 10));

    console.log("\n=== 4. Checking Base Timetable ===");
    const baseCount = await get(`SELECT count(*) as cnt FROM base_timetable WHERE school_id = ?`, [schoolId]);
    console.log(`Total base_timetable slots for school ${schoolId}:`, baseCount.cnt);

    const baseSample = await all(`SELECT * FROM base_timetable WHERE school_id = ? LIMIT 10`, [schoolId]);
    console.log("Sample base_timetable slots:", baseSample);

    console.log("\n=== 5. Checking Timetable Changes ===");
    const changeCount = await get(`SELECT count(*) as cnt FROM timetable_changes WHERE school_id = ?`, [schoolId]);
    console.log(`Total timetable_changes slots for school ${schoolId}:`, changeCount.cnt);

    if (teachers.length > 0) {
      const teacher = teachers[0];
      console.log(`\n=== 6. Testing query for Teacher: ${teacher.name} (id: ${teacher.id}) ===`);
      
      const teacherSlots = await all(`
        SELECT bt.*, sub.name as subject_name, t.name as teacher_name
        FROM base_timetable bt
        LEFT JOIN subjects sub ON bt.subject_id = sub.id
        LEFT JOIN teachers t ON bt.teacher_id = t.id
        WHERE bt.school_id = ? AND (bt.teacher_id = ? OR t.name = ?)
      `, [schoolId, String(teacher.id), teacher.name]);

      console.log(`Found ${teacherSlots.length} base slots for teacher ${teacher.name}`);
      console.log("Sample teacher slots:", teacherSlots.slice(0, 5));
    }

  } catch (err) {
    console.error("Diagnosis error:", err);
  }
}

diagnose();
