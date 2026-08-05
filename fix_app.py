import re

# Try multiple encodings
for enc in ['utf-8', 'euc-kr', 'cp949', 'latin1']:
    try:
        with open('public/admin/app.js', 'r', encoding=enc) as f:
            content = f.read()
        print(f"Successfully read with {enc}")
        break
    except Exception as e:
        pass

pattern = r"// Format data into genClassMap.*?if \(typeof genCurrentClassId !== 'undefined' && genCurrentClassId\).*?renderGenGrid\(genCurrentClassId, max\); \}"

replacement = """// Format data into genClassMap
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
    if (typeof genCurrentClassId !== 'undefined' && genCurrentClassId) { const max = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10; renderGenGrid(genCurrentClassId, max); }"""

if not re.search(pattern, content, flags=re.DOTALL):
    print("Pattern not found!")
else:
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    with open('public/admin/app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replaced successfully and saved as UTF-8")
