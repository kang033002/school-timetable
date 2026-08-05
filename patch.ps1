$content = Get-Content public\admin\app.js -Raw

$targetToRemove = @"
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
"@

$replacement = @"
    const loadedClassIds = new Set();
    data.forEach(item => {
      loadedClassIds.add(item.gradeClassId);
      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};
      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
    });
"@

$targetValHours = @"
          let valHours = defaultHours;
          if (false) {
            valHours = '';
          }
"@

$replacementValHours = @"
          let valHours = defaultHours;
"@

$content = $content.Replace($targetToRemove, $replacement)
$content = $content.Replace($targetValHours, $replacementValHours)

Set-Content public\admin\app.js $content -NoNewline
