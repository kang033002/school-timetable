const { Pool } = require('pg');

// Use DATABASE_URL env var for PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database via pg.Pool');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

/**
 * Converts SQLite-style positional params (?) to PostgreSQL-style ($1, $2, ...)
 */
function convertParams(sql, params) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  return { pgSql, params };
}

// run: execute INSERT/UPDATE/DELETE — returns { lastID, changes } for SQLite compatibility
async function run(sql, params = []) {
  const { pgSql, params: pgParams } = convertParams(sql, params);
  const result = await pool.query(pgSql, pgParams);
  return { lastID: null, changes: result.rowCount };
}

// get: SELECT a single row
async function get(sql, params = []) {
  const { pgSql, params: pgParams } = convertParams(sql, params);
  const result = await pool.query(pgSql, pgParams);
  return result.rows[0] || undefined;
}

// all: SELECT multiple rows
async function all(sql, params = []) {
  const { pgSql, params: pgParams } = convertParams(sql, params);
  const result = await pool.query(pgSql, pgParams);
  return result.rows;
}

// Initialize Tables (CREATE TABLE IF NOT EXISTS)
async function initSchema() {
  // 1. Schools
  await pool.query(`
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
  await pool.query(`
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
  await pool.query(`
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  // 5. Rooms (장소 / 특별실)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_special_room INTEGER DEFAULT 0,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  // 6. BaseTimetable (원본시간표)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS base_timetable (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      grade_class_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      period INTEGER NOT NULL,
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

  // 7. TimetableChanges (시간표 변경 이력)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS timetable_changes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      target_date TEXT NOT NULL,
      period INTEGER NOT NULL,
      grade_class_id TEXT NOT NULL,
      change_type TEXT NOT NULL,
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      teacher_id TEXT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
    )
  `);

  // 9. Holidays
  await pool.query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      target_date TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(school_id, target_date),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  // ── Seed default accounts if they don't exist ──────────────────────────────

  // Master admin system school
  const masterSchoolId = 'sch-system-master';
  const masterSchool = await pool.query(`SELECT id FROM schools WHERE id = $1`, [masterSchoolId]);
  if (masterSchool.rows.length === 0) {
    await pool.query(
      `INSERT INTO schools (id, code, name, max_periods_per_day, operating_days, status)
       VALUES ($1, 'SYS-MASTER', '시스템(마스터)', 9, 5, 'APPROVED')`,
      [masterSchoolId]
    );
    await pool.query(
      `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
       VALUES ($1, $2, 'master', 'master123', 'MASTER_ADMIN', null, '마스터관리자', 'APPROVED')`,
      ['u-master-001', masterSchoolId]
    );
    console.log('Default master account created: master / master123');
  }

  // Default demo school + admin
  const demoSchoolId = 'sch-demo-admin';
  const demoSchool = await pool.query(`SELECT id FROM schools WHERE id = $1`, [demoSchoolId]);
  if (demoSchool.rows.length === 0) {
    await pool.query(
      `INSERT INTO schools (id, code, name, max_periods_per_day, operating_days, status)
       VALUES ($1, 'SCH-DEMO', '데모학교', 7, 5, 'APPROVED')`,
      [demoSchoolId]
    );
    await pool.query(
      `INSERT INTO user_accounts (id, school_id, email, password_hash, role, teacher_id, name, status)
       VALUES ($1, $2, 'admin', 'admin123', 'ADMIN', null, '관리자', 'APPROVED')`,
      ['u-admin-001', demoSchoolId]
    );
    console.log('Default admin account created: admin / admin123');
  }

  console.log('Database schema initialized successfully (PostgreSQL).');
}


module.exports = {
  pool,
  run,
  get,
  all,
  initSchema,
};
