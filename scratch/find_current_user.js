const fs = require('fs');
const code = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('currentUser =')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
