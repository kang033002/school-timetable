$lines = Get-Content public\admin\app.js
$lines[2274] = "        if (parsedIds.length > 0) {"
$lines[2275] = "          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];"
$lines[2276] = "          buildPreviewChips(parsedIds);"
$lines[2277] = "          if (window.loadClassHours) window.loadClassHours(genCurrentClassId);"
$lines[2278] = "          renderGenGrid(genCurrentClassId, defaultMaxPeriods);"
$lines[2279] = "        }"
Set-Content public\admin\app.js $lines
