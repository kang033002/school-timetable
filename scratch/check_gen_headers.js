const fs = require('fs');

const html = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/index.html', 'utf8');

html.split('\n').forEach((line, idx) => {
  if (line.includes('시간표 만들기') || line.includes('gen-preview') || line.includes('gen-auto-section')) {
    console.log(`HTML Line ${idx + 1}: ${line}`);
  }
});
