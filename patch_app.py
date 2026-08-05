import io

filepath = 'public/admin/app.js'

with io.open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: initGeneratorTab loadClassHours
target1 = """        if (parsedIds.length > 0) {
          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];
          buildPreviewChips(parsedIds);
          renderGenGrid(genCurrentClassId, defaultMaxPeriods);
        }"""
replacement1 = """        if (parsedIds.length > 0) {
          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];
          buildPreviewChips(parsedIds);
          if (window.loadClassHours) window.loadClassHours(genCurrentClassId);
          renderGenGrid(genCurrentClassId, defaultMaxPeriods);
        }"""
content = content.replace(target1, replacement1)

# Fix 2: addGenRow
target2 = """        let valHours = defaultHours;
        if (false) {
          valHours = '';
        }"""
replacement2 = """        let valHours = defaultHours;"""
content = content.replace(target2, replacement2)

# Fix 3: Base timetable override logic
target3 = """    generatorData.baseTimetable = data;
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
    localStorage.setItem('gen_class_hours_' + currentUser.schoolId, JSON.stringify(window.genClassHoursMap));"""

replacement3 = """    generatorData.baseTimetable = data;
    genClassMap = {};
    window.genClassHoursMap = window.genClassHoursMap || {};
    const loadedClassIds = new Set();
    data.forEach(item => {
      loadedClassIds.add(item.gradeClassId);
      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};
      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
    });"""

content = content.replace(target3, replacement3)

with io.open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patch applied successfully.")
