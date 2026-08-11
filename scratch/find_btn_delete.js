const fs = require('fs');
const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

appJs.split('\n').forEach((line, idx) => {
  if (line.includes('btn-modal-delete')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
