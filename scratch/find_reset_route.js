const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      searchDir(full);
    } else if (full.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('reset-timetable')) {
        console.log(`Found in: ${full}`);
      }
    }
  });
}
searchDir('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/src');
