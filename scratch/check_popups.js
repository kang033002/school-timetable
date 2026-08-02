const fs = require('fs');

const indexHtml = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/index.html', 'utf8');
const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

console.log('--- index.html references to popup ---');
indexHtml.split('\n').forEach((line, idx) => {
  if (line.includes('popup') || line.includes('openWindow') || line.includes('window.open') || line.includes('teacher')) {
    console.log(`index.html:${idx + 1}: ${line}`);
  }
});

console.log('--- app.js references to popup ---');
appJs.split('\n').forEach((line, idx) => {
  if (line.includes('popup') || line.includes('openWindow') || line.includes('window.open') || line.includes('teacher')) {
    console.log(`app.js:${idx + 1}: ${line}`);
  }
});
