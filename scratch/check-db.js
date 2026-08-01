const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./src/db/timetable.db');

db.serialize(() => {
  db.all('SELECT * FROM teachers', (err, rows) => {
    console.log('Teachers:', rows);
  });
  db.all('SELECT * FROM subjects', (err, rows) => {
    console.log('Subjects:', rows);
  });
});
db.close();
