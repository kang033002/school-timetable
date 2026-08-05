const fs = require('fs');

const path = 'public/admin/app.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /\n\s+if \(item\.subjectId && item\.teacherId\) \{\s+if \(!newClassHoursMap\[item\.gradeClassId\]\) newClassHoursMap\[item\.gradeClassId\] = \{\};\s+const key = item\.subjectId \+ '_' \+ item\.teacherId;\s+if \(!newClassHoursMap\[item\.gradeClassId\]\[key\]\) \{\s+newClassHoursMap\[item\.gradeClassId\]\[key\] = \{ subjectId: item\.subjectId, teacherId: item\.teacherId, hours: 0 \};\s+\}\s+newClassHoursMap\[item\.gradeClassId\]\[key\]\.hours\+\+;\s+\}\s+\}\);\s+Object\.keys\(newClassHoursMap\)\.forEach\(gcId => \{\s+window\.genClassHoursMap\[gcId\] = Object\.values\(newClassHoursMap\[gcId\]\);\s+\}\);\s+localStorage\.setItem\('gen_class_hours_' \+ currentUser\.schoolId, JSON\.stringify\(window\.genClassHoursMap\)\);/g;

content = content.replace(regex, `
    });
    // Removed logic that overwrites genClassHoursMap from base timetable to prevent data loss
`);

// Also fix valHours inside addGenRow
const regex2 = /let valHours = defaultHours;\s+if \(false\) \{\s+valHours = '';\s+\}/g;
content = content.replace(regex2, `
          let valHours = defaultHours;
          // Fixed valHours to be correctly displayed
`);

fs.writeFileSync(path, content, 'utf8');
console.log('Replaced app.js logic successfully');
