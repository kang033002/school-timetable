const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./src/db/timetable.db');

db.run(
  `UPDATE user_accounts SET email = ?, password_hash = ? WHERE id = ?`,
  ['master', 'master123', 'u-master'],
  (err) => {
    console.log('Reset master credentials status:', err || 'SUCCESS');
    db.close();
  }
);
