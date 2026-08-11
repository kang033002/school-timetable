const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/src/routes';

fs.readdirSync(dir).forEach(file => {
  const code = fs.readFileSync(path.join(dir, file), 'utf8');
  code.split('\n').forEach((line, idx) => {
    if (line.includes('/meta') || line.includes("'/schools/:schoolId/meta'")) {
      console.log(`${file}:${idx + 1}: ${line}`);
    }
  });
});
