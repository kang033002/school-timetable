$content = [System.IO.File]::ReadAllText('public/admin/app.js')

$startStr = "// Format data into genClassMap"
$endStr = "if (typeof genCurrentClassId !== 'undefined' && genCurrentClassId)"

$startIndex = $content.IndexOf($startStr)
$endIndex = $content.IndexOf($endStr, $startIndex)

if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
    # Let's preserve what comes right before $endStr (which includes the alert)
    # Actually, if we just replace from $startIndex to $endIndex
    $target = $content.Substring($startIndex, $endIndex - $startIndex)
    
    $replacement = "// Format data into genClassMap`n" +
"    generatorData.baseTimetable = data;`n" +
"    genClassMap = {};`n" +
"    window.genClassHoursMap = window.genClassHoursMap || {};`n" +
"    const newClassHoursMap = {};`n" +
"    const loadedClassIds = new Set();`n`n" +
"    data.forEach(item => {`n" +
"      loadedClassIds.add(item.gradeClassId);`n" +
"      if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};`n" +
"      if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};`n" +
"      genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;`n" +
"      `n" +
"      if (item.subjectId && item.teacherId) {`n" +
"        if (!newClassHoursMap[item.gradeClassId]) newClassHoursMap[item.gradeClassId] = {};`n" +
"        const key = item.subjectId + '_' + item.teacherId;`n" +
"        if (!newClassHoursMap[item.gradeClassId][key]) {`n" +
"          newClassHoursMap[item.gradeClassId][key] = { subjectId: item.subjectId, teacherId: item.teacherId, hours: 0 };`n" +
"        }`n" +
"        newClassHoursMap[item.gradeClassId][key].hours++;`n" +
"      }`n" +
"    });`n`n" +
"    Object.keys(newClassHoursMap).forEach(gcId => {`n" +
"      window.genClassHoursMap[gcId] = Object.values(newClassHoursMap[gcId]);`n" +
"    });`n" +
"    localStorage.setItem('gen_class_hours_' + currentUser.schoolId, JSON.stringify(window.genClassHoursMap));`n`n" +
"    window.activeGenClassIds = Array.from(loadedClassIds);`n" +
"    localStorage.setItem('genSelectedClassIds', JSON.stringify(window.activeGenClassIds));`n" +
"    `n" +
"    if (window.activeGenClassIds.length > 0) {`n" +
"      genCurrentClassId = window.activeGenClassIds[0];`n" +
"    }`n" +
"    if (window.renderCreatedClassBadges) window.renderCreatedClassBadges();`n" +
"    if (typeof buildPreviewChips === 'function') buildPreviewChips(window.activeGenClassIds);`n" +
"    if (window.loadClassHours && genCurrentClassId) window.loadClassHours(genCurrentClassId);`n`n    "

    $content = $content.Replace($target, $replacement)
    [System.IO.File]::WriteAllText('public/admin/app.js', $content)
    Write-Host "Replacement successful."
} else {
    Write-Host "Start or end string not found."
}
