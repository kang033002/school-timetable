const fs = require('fs');

const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

appJs.split('\n').forEach((line, idx) => {
  if (line.includes('teacherTitleSelect') || line.includes('teacher-title-select')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
