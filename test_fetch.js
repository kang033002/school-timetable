const http = require('http');

http.get('http://localhost:10000/api/admin/base-timetable-all?schoolId=1', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed.slice(0, 3), null, 2));
    } catch (e) {
      console.log('Parse error:', e, data);
    }
  });
});
