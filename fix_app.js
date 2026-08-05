const fs = require('fs');
const content = fs.readFileSync('public/admin/app.js', 'utf8');

const pattern = /\/\/ Format data into genClassMap.*?if \(typeof genCurrentClassId !== 'undefined' && genCurrentClassId\).*?renderGenGrid\(genCurrentClassId, max\); \}/s;

const replacement = `// Format data into genClassMap
    generatorData.baseTimetable = data;
    genClassMap = {};
    window.genClassHoursMap = window.genClassHoursMap || {};
    const newClassHoursMap = {};
    const loadedClassIds = new Set();

    data.forEach(item => {
      loadedClassIds.add(item.gradeClassId);
      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};
      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
      
      if (item.subjectId && item.teacherId) {
        if (!newClassHoursMap[item.gradeClassId]) newClassHoursMap[item.gradeClassId] = {};
        const key = item.subjectId + '_' + item.teacherId;
        if (!newClassHoursMap[item.gradeClassId][key]) {
          newClassHoursMap[item.gradeClassId][key] = { subjectId: item.subjectId, teacherId: item.teacherId, hours: 0 };
        }
        newClassHoursMap[item.gradeClassId][key].hours++;
      }
    });

    Object.keys(newClassHoursMap).forEach(gcId => {
      window.genClassHoursMap[gcId] = Object.values(newClassHoursMap[gcId]);
    });
    localStorage.setItem('gen_class_hours_' + currentUser.schoolId, JSON.stringify(window.genClassHoursMap));

    window.activeGenClassIds = Array.from(loadedClassIds);
    localStorage.setItem('genSelectedClassIds', JSON.stringify(window.activeGenClassIds));
    
    if (window.activeGenClassIds.length > 0) {
      genCurrentClassId = window.activeGenClassIds[0];
    }
    if (window.renderCreatedClassBadges) window.renderCreatedClassBadges();
    if (typeof buildPreviewChips === 'function') buildPreviewChips(window.activeGenClassIds);
    if (window.loadClassHours && genCurrentClassId) window.loadClassHours(genCurrentClassId);

    alert('기존 시간표를 성공적으로 불러왔습니다.');
    if (typeof genCurrentClassId !== 'undefined' && genCurrentClassId) { const max = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10; renderGenGrid(genCurrentClassId, max); }`;

const newContent = content.replace(pattern, replacement);
fs.writeFileSync('public/admin/app.js', newContent, 'utf8');
