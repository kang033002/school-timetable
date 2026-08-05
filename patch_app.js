const fs = require('fs');

const filepath = 'public/admin/app.js';
let content = fs.readFileSync(filepath, 'utf-8');

// Fix 1
const target1 = `        if (parsedIds.length > 0) {
          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];
          buildPreviewChips(parsedIds);
          renderGenGrid(genCurrentClassId, defaultMaxPeriods);
        }`;
const replacement1 = `        if (parsedIds.length > 0) {
          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];
          buildPreviewChips(parsedIds);
          if (window.loadClassHours) window.loadClassHours(genCurrentClassId);
          renderGenGrid(genCurrentClassId, defaultMaxPeriods);
        }`;
content = content.replace(target1, replacement1);

// Fix 2
const target2 = `        let valHours = defaultHours;
        if (false) {
          valHours = '';
        }`;
const replacement2 = `        let valHours = defaultHours;`;
content = content.replace(target2, replacement2);

// Fix 3
const target3 = `    generatorData.baseTimetable = data;
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
    localStorage.setItem('gen_class_hours_' + currentUser.schoolId, JSON.stringify(window.genClassHoursMap));`;

const replacement3 = `    generatorData.baseTimetable = data;
    genClassMap = {};
    window.genClassHoursMap = window.genClassHoursMap || {};
    const loadedClassIds = new Set();
    data.forEach(item => {
      loadedClassIds.add(item.gradeClassId);
      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};
      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
    });`;

content = content.replace(target3, replacement3);

fs.writeFileSync(filepath, content, 'utf-8');
console.log("Patched successfully");
