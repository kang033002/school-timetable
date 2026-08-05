$filepath = "public\admin\app.js"
$content = [System.IO.File]::ReadAllText((Resolve-Path $filepath).Path, [System.Text.Encoding]::UTF8)

# Fix 1
$target1 = "        if (parsedIds.length > 0) {`n          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];`n          buildPreviewChips(parsedIds);`n          renderGenGrid(genCurrentClassId, defaultMaxPeriods);`n        }"
$replacement1 = "        if (parsedIds.length > 0) {`n          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];`n          buildPreviewChips(parsedIds);`n          if (window.loadClassHours) window.loadClassHours(genCurrentClassId);`n          renderGenGrid(genCurrentClassId, defaultMaxPeriods);`n        }"
$content = $content.Replace($target1.Replace("`n", "`r`n"), $replacement1.Replace("`n", "`r`n"))

$content = $content.Replace($target1, $replacement1)

# Fix 2
$target2 = "        let valHours = defaultHours;`n        if (false) {`n          valHours = '';`n        }"
$replacement2 = "        let valHours = defaultHours;"
$content = $content.Replace($target2.Replace("`n", "`r`n"), $replacement2.Replace("`n", "`r`n"))
$content = $content.Replace($target2, $replacement2)

# Fix 3
$target3 = "    generatorData.baseTimetable = data;`n    genClassMap = {};`n    window.genClassHoursMap = window.genClassHoursMap || {};`n    const newClassHoursMap = {};`n    const loadedClassIds = new Set();`n    data.forEach(item => {`n      loadedClassIds.add(item.gradeClassId);`n      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};`n      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};`n      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;`n      `n      if (item.subjectId && item.teacherId) {`n        if (!newClassHoursMap[item.gradeClassId]) newClassHoursMap[item.gradeClassId] = {};`n        const key = item.subjectId + '_' + item.teacherId;`n        if (!newClassHoursMap[item.gradeClassId][key]) {`n          newClassHoursMap[item.gradeClassId][key] = { subjectId: item.subjectId, teacherId: item.teacherId, hours: 0 };`n        }`n        newClassHoursMap[item.gradeClassId][key].hours++;`n      }`n    });`n`n    Object.keys(newClassHoursMap).forEach(gcId => {`n      window.genClassHoursMap[gcId] = Object.values(newClassHoursMap[gcId]);`n    });`n    localStorage.setItem('gen_class_hours_' + currentUser.schoolId, JSON.stringify(window.genClassHoursMap));"
$replacement3 = "    generatorData.baseTimetable = data;`n    genClassMap = {};`n    window.genClassHoursMap = window.genClassHoursMap || {};`n    const loadedClassIds = new Set();`n    data.forEach(item => {`n      loadedClassIds.add(item.gradeClassId);`n      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};`n      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};`n      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;`n    });"
$content = $content.Replace($target3.Replace("`n", "`r`n"), $replacement3.Replace("`n", "`r`n"))
$content = $content.Replace($target3, $replacement3)

# Write back in UTF-8 without BOM if possible, but standard UTF8 is fine for JS usually in modern browsers.
[System.IO.File]::WriteAllText((Resolve-Path $filepath).Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Patched correctly."
