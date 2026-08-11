const fs = require('fs');

const css = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/style.css', 'utf8');

css.split('\n').forEach((line, idx) => {
  if (line.includes('hidden') || line.includes('tab-content')) {
    console.log(`CSS Line ${idx + 1}: ${line}`);
  }
});
