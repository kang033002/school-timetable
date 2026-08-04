const API_BASE = '/api';
const urlParams = new URLSearchParams(window.location.search);
const targetDate = urlParams.get('date');

let currentUser = null;
let allData = null; // { timetable: [...], maxPeriods: N, ... }

document.addEventListener('DOMContentLoaded', async () => {
  if (!targetDate) {
    alert('날짜 파라미터가 없습니다.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`);
    if (res.ok) {
      currentUser = await res.json();
    } else {
      alert('로그인이 필요합니다.');
      window.close();
      return;
    }

    await loadDailyAllTimetable();

    document.getElementById('grade-filter').addEventListener('change', renderTable);
  } catch (err) {
    console.error(err);
    alert('데이터를 불러오는데 실패했습니다.');
  }
});

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

async function loadDailyAllTimetable() {
  const res = await fetch(`${API_BASE}/timetable/daily-all?schoolId=${currentUser.schoolId}&date=${targetDate}`);
  if (!res.ok) throw new Error('API request failed');

  allData = await res.json();
  
  const dateObj = new Date(targetDate);
  const dayStr = dayNames[dateObj.getDay()];
  const formattedDate = `${dateObj.getFullYear()}.${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;
  
  document.getElementById('page-title').textContent = `📅 ${formattedDate} (${dayStr}) 전체 학급 시간표`;

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('content').classList.remove('hidden');

  renderTable();
}

function renderTable() {
  if (!allData || !allData.timetable) return;

  const filterGrade = document.getElementById('grade-filter').value;
  
  // Filter classes by grade
  const classesToRender = allData.timetable.filter(gc => {
    if (filterGrade === 'all') return true;
    return gc.grade.toString() === filterGrade;
  });

  const thead = document.getElementById('daily-thead');
  const tbody = document.getElementById('daily-tbody');

  // Build Head
  let headHtml = `<tr><th class="th-period">교시</th>`;
  classesToRender.forEach(gc => {
    headHtml += `<th>${gc.grade}-${gc.classNumber}</th>`;
  });
  headHtml += `</tr>`;
  thead.innerHTML = headHtml;

  // Build Body
  let bodyHtml = '';
  for (let p = 1; p <= allData.maxPeriods; p++) {
    bodyHtml += `<tr><td class="th-period">${p}교시</td>`;
    
    classesToRender.forEach(gc => {
      const slot = gc.slots.find(s => s.period === p);
      if (slot && slot.subjectName) {
        let cls = 'slot-assigned';
        if (slot.isChanged) {
          cls += ' slot-changed';
        }
        bodyHtml += `
          <td>
            <div class="slot-content ${cls}">
              <div class="slot-subject">${slot.shortSubjectName || slot.subjectName}</div>
              <div class="slot-teacher">${slot.teacherName}</div>
            </div>
          </td>
        `;
      } else {
        bodyHtml += `<td><div class="slot-empty"></div></td>`;
      }
    });

    bodyHtml += `</tr>`;
  }
  tbody.innerHTML = bodyHtml;
}
