const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'timetable.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper for promise-based queries
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize Tables
async function initSchema() {
  await run(`PRAGMA foreign_keys = ON;`);

  // 1. Schools
  await run(`
    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      max_periods_per_day INTEGER DEFAULT 7,
      operating_days INTEGER DEFAULT 5,
      status TEXT DEFAULT 'PENDING'
    )
  `);

  // 2. Teachers
  await run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      subject_name TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  // 3. GradeClasses (학년-반)
  await run(`
    CREATE TABLE IF NOT EXISTS grade_classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      grade INTEGER NOT NULL,
      class_number INTEGER NOT NULL,
      homeroom_teacher_id TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (homeroom_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      UNIQUE(school_id, grade, class_number)
    )
  `);

  // 4. Subjects
  await run(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  // 5. Rooms (장소 / 특별실)
  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_special_room INTEGER DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  // 6. BaseTimetable (원본시간표)
  await run(`
    CREATE TABLE IF NOT EXISTS base_timetable (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      grade_class_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL, -- 1:월 ~ 5:금
      period INTEGER NOT NULL,       -- 1~7교시
      teacher_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      room_id TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (grade_class_id) REFERENCES grade_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
      UNIQUE(grade_class_id, day_of_week, period)
    )
  `);

  // 7. TimetableChanges (시간표 변경 이력 및 변경건)
  await run(`
    CREATE TABLE IF NOT EXISTS timetable_changes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      target_date TEXT NOT NULL, -- YYYY-MM-DD
      period INTEGER NOT NULL,
      grade_class_id TEXT NOT NULL,
      change_type TEXT NOT NULL, -- 'SUBSTITUTE', 'CANCEL', 'SWAP'
      original_teacher_id TEXT,
      changed_teacher_id TEXT,
      original_subject_id TEXT,
      changed_subject_id TEXT,
      original_room_id TEXT,
      changed_room_id TEXT,
      reason TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (grade_class_id) REFERENCES grade_classes(id) ON DELETE CASCADE
    )
  `);

  // 8. UserAccounts
  await run(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- 'ADMIN', 'TEACHER'
      teacher_id TEXT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    )
  `);

  // 9. Holidays
  await run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      target_date TEXT UNIQUE NOT NULL, -- YYYY-MM-DD
      name TEXT NOT NULL,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  console.log('Database schema initialized successfully.');
}

module.exports = {
  db,
  run,
  get,
  all,
  initSchema
};
