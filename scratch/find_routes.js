const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/src';

function searchDir(currentPath) {
  const files = fs.readdirSync(currentPath);
  for (const file of files) {
    const fullPath = path.join(currentPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('approved-students') || content.includes('delete-students-bulk') || content.includes('approved_students')) {
        console.log('FOUND IN:', fullPath);
      }
    }
  }
}

searchDir(dir);
console.log('Search done.');
