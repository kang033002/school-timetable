const fs = require('fs');
const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

appJs.split('\n').forEach((line, idx) => {
  if (line.includes('change-modal') || line.includes('slot-info-summary') || line.includes('openModal') || line.includes('change-teacher-select') || line.includes('change-subject-select')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
