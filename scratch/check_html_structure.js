const fs = require('fs');

const html = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/index.html', 'utf8');

const lines = html.split('\n');
let depth = 0;
lines.forEach((line, idx) => {
  const lineNo = idx + 1;
  if (line.includes('id="tab-content-generator"')) {
    console.log(`Line ${lineNo}: OPEN tab-content-generator`);
  }
  if (line.includes('id="gen-preview"')) {
    console.log(`Line ${lineNo}: FOUND gen-preview`);
  }
  if (line.includes('id="change-modal"')) {
    console.log(`Line ${lineNo}: FOUND change-modal`);
  }
});
