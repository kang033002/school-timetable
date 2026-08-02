const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/src/routes';

fs.readdirSync(dir).forEach(file => {
  const code = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes("'/teachers'") || line.includes('"/teachers"') || line.includes("'/teachers/:") || line.includes('"/teachers/:') || line.includes("'/students'") || line.includes('"/students"')) {
      console.log(`${file}:${idx + 1}: ${line}`);
    }
  });
});
