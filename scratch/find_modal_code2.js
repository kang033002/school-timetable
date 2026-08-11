const fs = require('fs');
const appJs = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/app.js', 'utf8');

appJs.split('\n').forEach((line, idx) => {
  if (line.includes('openModal') || line.includes('changeModal') || line.includes('slotInfoSummary') || line.includes('change-form') || line.includes('handleModalSave')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
