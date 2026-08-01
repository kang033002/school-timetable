const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./src/db/timetable.db');

db.serialize(() => {
  db.all('SELECT id, name, status FROM schools', (err, rows) => {
    console.log('Schools in DB:', rows);
  });
  db.all('SELECT email, role, status, school_id, password_hash FROM user_accounts', (err, rows) => {
    console.log('Users in DB:', rows);
  });
});
db.close();
