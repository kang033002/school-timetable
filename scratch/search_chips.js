const fs = require('fs');
const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

const lines = appJs.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('gen-subject-chips') || line.includes('subjects') && line.includes('chip') || line.includes('target-subjects') || line.includes('subjects.map')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
