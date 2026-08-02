const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchFiles(fullPath);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('teacher-signup') || content.includes('signup-teacher') || content.includes('교사 가입') || content.includes('register')) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  });
}

searchFiles('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public');
