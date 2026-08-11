const fs = require('fs');
const html = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/index.html', 'utf8');

const lines = html.split('\n');
let stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNo = i + 1;
  const regex = /<\/?div[^>]*>/gi;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const fullTag = match[0];
    if (fullTag.startsWith('</')) {
      if (stack.length > 0) {
        const popped = stack.pop();
        if (popped.id) {
          console.log(`Line ${lineNo}: Closed element id="${popped.id}" (opened at line ${popped.line})`);
        }
      } else {
        console.log(`Line ${lineNo}: Extra closing </div>!`);
      }
    } else {
      const idMatch = fullTag.match(/id=["']([^"']+)["']/i);
      stack.push({ id: idMatch ? idMatch[1] : '', line: lineNo });
      if (idMatch) {
        console.log(`Line ${lineNo}: Opened element id="${idMatch[1]}"`);
      }
    }
  }
}

console.log("Unclosed divs left:", stack);
