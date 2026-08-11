const fs = require('fs');

const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

appJs.split('\n').forEach((line, idx) => {
  if (line.includes('gen-preview') || line.includes('gen-auto-section') || line.includes('tab-content')) {
    console.log(`app.js Line ${idx + 1}: ${line}`);
  }
});
