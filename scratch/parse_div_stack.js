const fs = require('fs');

const html = fs.readFileSync('C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/index.html', 'utf8');

const lines = html.split('\n');
let stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNo = i + 1;

  // Simple regex for tags
  const tags = line.match(/<\/?([a-z0-9]+)[^>]*>/gi) || [];
  for (const tag of tags) {
    if (tag.startsWith('</')) {
      const tagName = tag.match(/<\/([a-z0-9]+)/i)[1].toLowerCase();
      if (['div', 'section', 'main', 'table', 'tbody', 'thead', 'form'].includes(tagName)) {
        if (stack.length > 0) {
          const popped = stack.pop();
          if (popped.id === 'tab-content-generator') {
            console.log(`Line ${lineNo}: Closed tab-content-generator! Tag: ${tag}`);
          }
        }
      }
    } else if (!tag.endsWith('/>') && !tag.includes('img') && !tag.includes('input') && !tag.includes('hr') && !tag.includes('br') && !tag.includes('meta') && !tag.includes('link')) {
      const tagName = tag.match(/<([a-z0-9]+)/i)[1].toLowerCase();
      if (['div', 'section', 'main', 'table', 'tbody', 'thead', 'form'].includes(tagName)) {
        const idMatch = tag.match(/id=["']([^"']+)["']/i);
        const classMatch = tag.match(/class=["']([^"']+)["']/i);
        stack.push({
          tag: tagName,
          id: idMatch ? idMatch[1] : '',
          cls: classMatch ? classMatch[1] : '',
          line: lineNo
        });
        if (idMatch && idMatch[1] === 'tab-content-generator') {
          console.log(`Line ${lineNo}: Opened tab-content-generator!`);
        }
      }
    }
  }
}
