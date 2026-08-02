const fs = require('fs');
const code = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/src/routes/admin.js', 'utf8');

const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('router.get(') || line.includes('router.post(') || line.includes('router.delete(') || line.includes('router.put(')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
