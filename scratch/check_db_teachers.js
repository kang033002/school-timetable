const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/timetable.db');

db.all("SELECT * FROM teachers LIMIT 10", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("Teachers in DB:", rows);
  }
  db.close();
});
