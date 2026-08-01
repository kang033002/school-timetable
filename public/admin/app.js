const API_BASE = '/api';

let currentUser = null;
let currentSchoolMeta = null;
let selectedSlotData = null;
let activeTab = 'DAILY'; // 'DAILY' or 'BASE'

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const btnLogout = document.getElementById('btn-logout');

const viewModeSelect = document.getElementById('view-mode-select');
const classFilterGroup = document.getElementById('class-filter-group');
const teacherFilterGroup = document.getElementById('teacher-filter-group');
const classSelect = document.getElementById('class-select');
const teacherSelect = document.getElementById('teacher-select');
const datePicker = document.getElementById('date-picker');
const btnRefresh = document.getElementById('btn-refresh');
const btnLogs = document.getElementById('btn-logs');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');

const timetableTitle = document.getElementById('timetable-title');
const weekDateSubtext = document.getElementById('week-date-subtext');
const timetableBody = document.getElementById('timetable-body');

// Admin panel selectors
const settingsPanel = document.getElementById('settings-panel');
const timetableDisplayContainer = document.getElementById('timetable-display-container');
const pendingUsersList = document.getElementById('pending-users-list');

const teacherSetupForm = document.getElementById('teacher-setup-form');
const teacherSetupName = document.getElementById('teacher-setup-name');
const teacherSetupSubject = document.getElementById('teacher-setup-subject');

const subjectSetupForm = document.getElementById('subject-setup-form');
const subjectSetupName = document.getElementById('subject-setup-name');

const classSetupForm = document.getElementById('class-setup-form');
const classSetupGrade = document.getElementById('class-setup-grade');
const classSetupNumber = document.getElementById('class-setup-number');
const classSetupHomeroom = document.getElementById('class-setup-homeroom');

// New base timetable & holiday selectors


const holidaySetupForm = document.getElementById('holiday-setup-form');
const holidaySetupDate = document.getElementById('holiday-setup-date');
const holidaySetupName = document.getElementById('holiday-setup-name');
const chkIsHoliday = document.getElementById('chk-is-holiday');
const adminHolidaysListUi = document.getElementById('admin-holidays-list-ui');

const changeModal = document.getElementById('change-modal');
const btnModalClose = document.getElementById('btn-modal-close');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const changeForm = document.getElementById('change-form');
const slotInfoSummary = document.getElementById('slot-info-summary');

const changeDetailsGroup = document.getElementById('change-details-group');
const changeSubjectSelect = document.getElementById('change-subject-select');
const changeTeacherSelect = document.getElementById('change-teacher-select');
const conflictAlert = document.getElementById('conflict-alert');
const conflictList = document.getElementById('conflict-list');
const chkForceOverride = document.getElementById('chk-force-override');

const logsModal = document.getElementById('logs-modal');
const btnLogsClose = document.getElementById('btn-logs-close');
const logsBody = document.getElementById('logs-body');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  datePicker.value = today;

  // Check stored auth
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (token && user) {
    currentUser = JSON.parse(user);
    showDashboard();
  }

  // Event Listeners
  loginForm.addEventListener('submit', handleLogin);
  btnLogout.addEventListener('click', handleLogout);

  viewModeSelect.addEventListener('change', handleViewModeChange);
  classSelect.addEventListener('change', loadTimetable);
  teacherSelect.addEventListener('change', loadTimetable);
  datePicker.addEventListener('change', loadTimetable);
  btnRefresh.addEventListener('click', loadTimetable);

  btnSettingsToggle.addEventListener('click', toggleSettingsPanel);

  const tabBtnDaily = document.getElementById('tab-btn-daily');
  const tabBtnBase = document.getElementById('tab-btn-base');

  tabBtnDaily.addEventListener('click', () => {
    tabBtnDaily.classList.add('active');
    tabBtnBase.classList.remove('active');
    activeTab = 'DAILY';
    datePicker.parentElement.style.display = 'block';
    loadTimetable();
  });

  tabBtnBase.addEventListener('click', () => {
    tabBtnBase.classList.add('active');
    tabBtnDaily.classList.remove('active');
    activeTab = 'BASE';
    datePicker.parentElement.style.display = 'none';
    loadTimetable();
  });

  teacherSetupForm.addEventListener('submit', handleTeacherSetup);
  subjectSetupForm.addEventListener('submit', handleSubjectSetup);
  classSetupForm.addEventListener('submit', handleClassSetup);
  holidaySetupForm.addEventListener('submit', handleHolidaySetup);

  const adminCredentialsForm = document.getElementById('admin-credentials-form');
  adminCredentialsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = document.getElementById('admin-setup-email').value;
    const newPassword = document.getElementById('admin-setup-password').value;

    try {
      const res = await fetch(`${API_BASE}/admin/change-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          newEmail,
          newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('계정 정보가 성공적으로 변경되었습니다. 보안을 위해 다시 로그인해주세요.');
        handleLogout();
      } else {
        alert(data.error || '계정 정보 변경 실패');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  });

  btnModalClose.addEventListener('click', () => changeModal.classList.add('hidden'));
  btnModalCancel.addEventListener('click', () => changeModal.classList.add('hidden'));
  changeForm.addEventListener('submit', handleApplyChange);

  btnLogs.addEventListener('click', openLogsModal);
  btnLogsClose.addEventListener('click', () => logsModal.classList.add('hidden'));

  // Student & School signup toggles
  const linkShowStudentSignup = document.getElementById('link-show-student-signup');
  const linkShowSchoolSignup = document.getElementById('link-show-school-signup');
  const studentSignupForm = document.getElementById('student-signup-form');
  const schoolSignupForm = document.getElementById('school-signup-form');

  linkShowStudentSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    schoolSignupForm.classList.add('hidden');
    studentSignupForm.classList.remove('hidden');
  });

  linkShowSchoolSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    studentSignupForm.classList.add('hidden');
    schoolSignupForm.classList.remove('hidden');
  });

  document.querySelectorAll('.link-back-to-login').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      studentSignupForm.classList.add('hidden');
      schoolSignupForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  });

  // School signup form submit
  schoolSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolName = document.getElementById('school-signup-name').value;
    const adminEmail = document.getElementById('school-signup-email').value;
    const adminPassword = document.getElementById('school-signup-password').value;

    try {
      const res = await fetch(`${API_BASE}/auth/register-school`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName, adminEmail, adminPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        schoolSignupForm.reset();
        schoolSignupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        alert(data.error || '학교 등록 신청 실패');
      }
    } catch (err) {
      console.error(err);
      alert('서버 통신 오류가 발생했습니다.');
    }
  });

  studentSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('student-name').value;
    const grade = parseInt(document.getElementById('student-grade').value);
    const classNumber = parseInt(document.getElementById('student-class').value);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: 'sch-1',
          role: 'STUDENT',
          name,
          grade,
          classNumber
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('학생 가입 신청이 완료되었습니다! 관리자 승인 완료 후 조회가 가능합니다.');
        studentSignupForm.reset();
        studentSignupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        alert(data.error || '가입 신청 실패');
      }
    } catch (err) {
      console.error(err);
      alert('통신 중 오류가 발생했습니다.');
    }
  });
});

// Auth handlers
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '로그인 실패');
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;

    showDashboard();
  } catch (err) {
    console.error('Login error:', err);
    alert('서버통신 오류가 발생했습니다.');
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  dashboardScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

// Show Dashboard
async function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');

  document.getElementById('user-name-display').textContent = `${currentUser.name}`;
  document.getElementById('user-role-badge').textContent = currentUser.role === 'ADMIN' ? '관리자(일과계)' : '교사';
  document.getElementById('nav-school-name').textContent = `🏫 ${currentUser.schoolName} 시간표 관리자`;

  await loadSchoolMetadata();
  await loadTimetable();
}

// Load Metadata
async function loadSchoolMetadata() {
  try {
    const res = await fetch(`${API_BASE}/schools/${currentUser.schoolId}/meta`);
    currentSchoolMeta = await res.json();

    // Populate Class Select
    classSelect.innerHTML = '';
    currentSchoolMeta.gradeClasses.forEach(gc => {
      const opt = document.createElement('option');
      opt.value = `${gc.grade}-${gc.class_number}`;
      opt.dataset.id = gc.id;
      opt.textContent = `${gc.grade}학년 ${gc.class_number}반 (${gc.homeroom_teacher_name || '담임미정'})`;
      classSelect.appendChild(opt);
    });

    // Populate Teacher Select
    teacherSelect.innerHTML = '';
    classSetupHomeroom.innerHTML = '';
    
    // Add default empty option for homeroom selection
    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = '담임 없음';
    classSetupHomeroom.appendChild(optNone);

    currentSchoolMeta.teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.subject_name || '과목'})`;
      teacherSelect.appendChild(opt);

      // Also copy to classSetupHomeroom dropdown
      const optHr = opt.cloneNode(true);
      classSetupHomeroom.appendChild(optHr);
    });

    // Populate Modal Selects
    changeSubjectSelect.innerHTML = '';
    currentSchoolMeta.subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      changeSubjectSelect.appendChild(opt);
    });

    changeTeacherSelect.innerHTML = '';
    currentSchoolMeta.teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} (${t.subject_name || ''})`;
      changeTeacherSelect.appendChild(opt);
    });

    // Refresh pending requests & holidays if visible
    if (!settingsPanel.classList.contains('hidden')) {
      await loadPendingUsers();
      await loadHolidays();
    }

    // Render Teachers List for Deletion
    const tListUi = document.getElementById('admin-teachers-list-ui');
    tListUi.innerHTML = '';
    currentSchoolMeta.teachers.forEach(t => {
      const div = document.createElement('div');
      div.className = 'settings-list-item';
      div.innerHTML = `
        <span>${t.name} (${t.subject_name || '과목없음'})</span>
        <button onclick="deleteTeacher('${t.id}')">삭제</button>
      `;
      tListUi.appendChild(div);
    });

    // Render Subjects List for Deletion
    const sListUi = document.getElementById('admin-subjects-list-ui');
    sListUi.innerHTML = '';
    currentSchoolMeta.subjects.forEach(s => {
      const div = document.createElement('div');
      div.className = 'settings-list-item';
      div.innerHTML = `
        <span>${s.name} (${s.short_name || s.name})</span>
        <button onclick="deleteSubject('${s.id}')">삭제</button>
      `;
      sListUi.appendChild(div);
    });

  } catch (err) {
    console.error('Metadata load error:', err);
  }
}

// Global scope deletion methods
window.deleteTeacher = async function(id) {
  if (!confirm('정말로 이 교사를 삭제하시겠습니까? 관련 시간표 데이터가 소실되거나 초기화될 수 있습니다.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/teachers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('성공적으로 삭제되었습니다.');
      await loadSchoolMetadata();
    } else {
      alert('교사 삭제 실패');
    }
  } catch (err) {
    console.error(err);
  }
};

window.deleteSubject = async function(id) {
  if (!confirm('정말로 이 과목을 삭제하시겠습니까? 관련 시간표 데이터가 소실되거나 초기화될 수 있습니다.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/subjects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('성공적으로 삭제되었습니다.');
      await loadSchoolMetadata();
    } else {
      alert('과목 삭제 실패');
    }
  } catch (err) {
    console.error(err);
  }
};

// Administrative View Toggling & Forms
function toggleSettingsPanel() {
  const isHidden = settingsPanel.classList.contains('hidden');
  if (isHidden) {
    settingsPanel.classList.remove('hidden');
    timetableDisplayContainer.classList.add('hidden');
    btnSettingsToggle.textContent = '📅 시간표 보기';
    loadPendingUsers();
  } else {
    settingsPanel.classList.add('hidden');
    timetableDisplayContainer.classList.remove('hidden');
    btnSettingsToggle.textContent = '⚙️ 학교/교사 설정';
  }
}

async function loadPendingUsers() {
  try {
    const res = await fetch(`${API_BASE}/admin/users/pending?schoolId=${currentUser.schoolId}`);
    const users = await res.json();
    pendingUsersList.innerHTML = '';
    
    if (users.length === 0) {
      pendingUsersList.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-sub);">대기 중인 승인 요청이 없습니다.</td></tr>`;
      return;
    }

    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="approveUser('${u.id}', 'APPROVED')">승인</button>
          <button class="btn btn-sm btn-outline" style="border-color:var(--danger-color); color:var(--danger-color);" onclick="approveUser('${u.id}', 'REJECTED')">반려</button>
        </td>
      `;
      pendingUsersList.appendChild(tr);
    });
  } catch (err) {
    console.error('Load pending users error:', err);
  }
}

window.approveUser = async function(userId, status) {
  try {
    const res = await fetch(`${API_BASE}/admin/users/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status })
    });
    if (res.ok) {
      alert(`성공적으로 처리되었습니다 (${status})`);
      loadPendingUsers();
    } else {
      alert('승인 요청 처리 중 실패했습니다.');
    }
  } catch (err) {
    console.error('Approve user fetch error:', err);
  }
};

async function handleTeacherSetup(e) {
  e.preventDefault();
  const payload = {
    schoolId: currentUser.schoolId,
    name: teacherSetupName.value,
    code: teacherSetupName.value.slice(0, 2),
    subjectName: teacherSetupSubject.value
  };
  try {
    const res = await fetch(`${API_BASE}/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('선생님 정보가 정상적으로 저장되었습니다.');
      teacherSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      alert('선생님 등록 실패');
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleSubjectSetup(e) {
  e.preventDefault();
  const payload = {
    schoolId: currentUser.schoolId,
    name: subjectSetupName.value,
    shortName: subjectSetupName.value
  };
  try {
    const res = await fetch(`${API_BASE}/admin/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('신규 과목이 성공적으로 생성되었습니다.');
      subjectSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      alert('과목 생성 실패');
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleClassSetup(e) {
  e.preventDefault();
  const payload = {
    schoolId: currentUser.schoolId,
    grade: parseInt(classSetupGrade.value),
    classNumber: parseInt(classSetupNumber.value),
    homeroomTeacherId: classSetupHomeroom.value || null
  };
  try {
    const res = await fetch(`${API_BASE}/admin/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      alert('학급 설정이 성공적으로 저장되었습니다.');
      classSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      alert(data.error || '학급 생성/수정 실패');
    }
  } catch (err) {
    console.error(err);
  }
}

function handleViewModeChange() {
  if (viewModeSelect.value === 'CLASS') {
    classFilterGroup.classList.remove('hidden');
    teacherFilterGroup.classList.add('hidden');
  } else {
    classFilterGroup.classList.add('hidden');
    teacherFilterGroup.classList.remove('hidden');
  }
  loadTimetable();
}

// Load Timetable Grid
async function loadTimetable() {
  if (!currentSchoolMeta) return;

  const mode = viewModeSelect.value;
  const dateVal = datePicker.value;
  const baseParam = activeTab === 'BASE' ? '&baseOnly=true' : '';

  try {
    let url = '';
    if (mode === 'CLASS') {
      if (!classSelect.value) {
        weekDateSubtext.textContent = `기준주간 시작: -`;
        renderGrid([], mode);
        return;
      }
      const [grade, classNum] = classSelect.value.split('-');
      url = `${API_BASE}/timetable/class?schoolId=${currentUser.schoolId}&grade=${grade}&classNumber=${classNum}&date=${dateVal}${baseParam}`;
      timetableTitle.textContent = activeTab === 'BASE'
        ? `${grade}학년 ${classNum}반 학기 기본 시간표 (원본)`
        : `${grade}학년 ${classNum}반 주간 시간표`;
    } else {
      const teacherId = teacherSelect.value;
      if (!teacherId) {
        weekDateSubtext.textContent = `기준주간 시작: -`;
        renderGrid([], mode);
        return;
      }
      const teacherObj = currentSchoolMeta.teachers.find(t => t.id === teacherId);
      url = `${API_BASE}/timetable/teacher?schoolId=${currentUser.schoolId}&teacherId=${teacherId}&date=${dateVal}${baseParam}`;
      timetableTitle.textContent = activeTab === 'BASE'
        ? `${teacherObj ? teacherObj.name : ''} 선생님 학기 기본 시간표 (원본)`
        : `${teacherObj ? teacherObj.name : ''} 선생님 주간 시간표`;
    }

    const res = await fetch(url);
    const data = await res.json();

    weekDateSubtext.textContent = `기준주간 시작: ${data.mondayDate}`;
    renderGrid(data.timetable, mode);
  } catch (err) {
    console.error('Timetable load error:', err);
  }
}

// Render Grid
function renderGrid(weeklyData, mode) {
  timetableBody.innerHTML = '';
  const maxPeriods = (currentSchoolMeta && currentSchoolMeta.school) 
    ? currentSchoolMeta.school.max_periods_per_day 
    : 9;

  for (let p = 1; p <= maxPeriods; p++) {
    const tr = document.createElement('tr');

    // Period Header
    const th = document.createElement('th');
    th.textContent = `${p}교시`;
    tr.appendChild(th);

    // Days 1 to 5
    for (let d = 0; d < 5; d++) {
      const dayOfWeek = d + 1;
      const dayData = weeklyData[d];
      const slot = dayData ? dayData.slots[p - 1] : null;

      const td = document.createElement('td');
      td.className = 'timetable-cell';

      if (slot && slot.isChanged) {
        td.classList.add('is-changed');
        const badge = document.createElement('span');
        badge.className = 'change-badge';
        badge.textContent = slot.changeType === 'SUBSTITUTE' ? '보강' : '결강';
        td.appendChild(badge);
      }

      if (slot && (slot.subjectName || slot.gradeName)) {
        const subDiv = document.createElement('div');
        subDiv.className = 'cell-subject';
        subDiv.textContent = mode === 'CLASS' ? (slot.subjectName || '수업없음') : (slot.gradeName || '빈교시');
        td.appendChild(subDiv);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'cell-subinfo';
        infoDiv.textContent = mode === 'CLASS' ? (slot.teacherName || '') : (slot.subjectName || '');
        td.appendChild(infoDiv);

        if (slot.roomName && slot.roomName !== '일반교실') {
          const roomDiv = document.createElement('div');
          roomDiv.className = 'cell-room';
          roomDiv.textContent = `📍 ${slot.roomName}`;
          td.appendChild(roomDiv);
        }
      } else {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'cell-subinfo';
        emptyDiv.textContent = '-';
        td.appendChild(emptyDiv);
      }

      // Click event for editing slot
      const targetDate = dayData ? dayData.date : null;
      td.addEventListener('click', () => openChangeModal(targetDate, dayOfWeek, p, slot, mode));

      tr.appendChild(td);
    }

    timetableBody.appendChild(tr);
  }
}

// Open Change Modal
function openChangeModal(targetDate, dayOfWeek, period, slot, mode) {
  if (!classSelect.value) {
    alert('학급(학년/반) 설정이 존재하지 않습니다. 우측 상단의 [⚙️ 학교/교사 설정] 패널로 가셔서 먼저 학년/학급을 등록해주세요!');
    return;
  }
  selectedSlotData = { targetDate, dayOfWeek, period, slot, mode };

  const [grade, classNum] = classSelect.value.split('-');
  const gcObj = currentSchoolMeta.gradeClasses.find(gc => gc.grade == grade && gc.class_number == classNum);

  selectedSlotData.gradeClassId = gcObj ? gcObj.id : null;

  const daysKor = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = daysKor[dayOfWeek] || '월';
  const headerStr = activeTab === 'BASE' 
    ? `학기 기본 시간표 원본 설정 (${dayName}요일 ${period}교시)` 
    : `일자별 수업 조정 (${targetDate} ${period}교시)`;

  slotInfoSummary.innerHTML = `
    <strong>[선택 구분]</strong> ${headerStr} - ${grade}학년 ${classNum}반<br>
    <strong>[현재 배정 상태]</strong> ${slot && slot.subjectName ? `${slot.subjectName} (${slot.teacherName} 선생님)` : '배정 없음'}
  `;

  // Reset form
  conflictAlert.classList.add('hidden');
  chkForceOverride.checked = false;

  const btnSave = document.getElementById('btn-modal-save');
  if (slot && slot.changeType === 'HOLIDAY') {
    conflictList.innerHTML = '<li>해당 일자는 지정된 휴업일(휴일)이므로 시간표 수정이 불가능합니다.</li>';
    conflictAlert.classList.remove('hidden');
    btnSave.disabled = true;
  } else {
    btnSave.disabled = false;
  }

  changeModal.classList.remove('hidden');
}

// Handle Change Submit (with Conflict Pre-checking)
async function handleApplyChange(e) {
  e.preventDefault();

  const changedSubjectId = changeSubjectSelect.value;
  const changedTeacherId = changeTeacherSelect.value;
  const force = chkForceOverride.checked;

  if (activeTab === 'BASE') {
    const payload = {
      schoolId: currentUser.schoolId,
      gradeClassId: selectedSlotData.gradeClassId,
      dayOfWeek: selectedSlotData.dayOfWeek,
      period: selectedSlotData.period,
      subjectId: changedSubjectId,
      teacherId: changedTeacherId
    };
    try {
      const res = await fetch(`${API_BASE}/admin/base-timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('기본 시간표 원본 설정이 성공적으로 저장되었습니다.');
        changeModal.classList.add('hidden');
        loadTimetable();
      } else {
        alert('기본 시간표 저장 실패');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
    return;
  }

  const payload = {
    schoolId: currentUser.schoolId,
    targetDate: selectedSlotData.targetDate,
    period: selectedSlotData.period,
    gradeClassId: selectedSlotData.gradeClassId,
    changeType: 'SUBSTITUTE',
    changedTeacherId,
    changedSubjectId,
    changedRoomId: null,
    reason: '일과계 시간표 조정',
    createdBy: currentUser.name,
    force
  };

  try {
    const res = await fetch(`${API_BASE}/timetable/change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.status === 409) {
      // Conflict detected!
      conflictList.innerHTML = '';
      data.conflicts.forEach(c => {
        const li = document.createElement('li');
        li.textContent = c.message;
        conflictList.appendChild(li);
      });
      conflictAlert.classList.remove('hidden');
      return;
    }

    if (!res.ok) {
      alert(data.error || '수정 실패');
      return;
    }

    alert('시간표 변경이 성공적으로 적용되었습니다!');
    changeModal.classList.add('hidden');
    loadTimetable();
  } catch (err) {
    console.error('Apply change error:', err);
    alert('서버통신 중 오류가 발생했습니다.');
  }
}

// Logs Modal
async function openLogsModal() {
  try {
    const res = await fetch(`${API_BASE}/timetable/logs?schoolId=${currentUser.schoolId}`);
    const logs = await res.json();

    logsBody.innerHTML = '';
    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.created_at}</td>
        <td>${log.target_date}</td>
        <td>${log.period}교시</td>
        <td>${log.grade}학년 ${log.class_number}반</td>
        <td><span class="badge ${log.change_type === 'CANCEL' ? 'badge-admin' : 'badge-admin'}">${log.change_type}</span></td>
        <td>${log.orig_subject_name || '-'} (${log.orig_teacher_name || '-'})</td>
        <td>${log.chg_subject_name || '결강'} (${log.chg_teacher_name || '-'})</td>
        <td>${log.reason} (${log.created_by})</td>
      `;
      logsBody.appendChild(tr);
    });

    logsModal.classList.remove('hidden');
  } catch (err) {
    console.error('Logs fetch error:', err);
  }
}



async function handleHolidaySetup(e) {
  e.preventDefault();
  const payload = {
    schoolId: currentUser.schoolId,
    targetDate: holidaySetupDate.value,
    name: holidaySetupName.value
  };

  try {
    const res = await fetch(`${API_BASE}/admin/holidays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('휴업일이 성공적으로 등록되었습니다.');
      holidaySetupForm.reset();
      loadHolidays();
      loadTimetable();
    } else {
      alert('휴일 등록 실패');
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadHolidays() {
  try {
    const res = await fetch(`${API_BASE}/admin/holidays?schoolId=${currentUser.schoolId}`);
    const list = await res.json();
    adminHolidaysListUi.innerHTML = '';
    
    if (list.length === 0) {
      adminHolidaysListUi.innerHTML = '<p class="text-center text-muted">등록된 휴일이 없습니다.</p>';
      return;
    }

    list.forEach(h => {
      const div = document.createElement('div');
      div.className = 'flex justify-between items-center py-2 border-b';
      div.innerHTML = `
        <span>📅 <strong>${h.target_date}</strong>: ${h.name}</span>
        <button class="btn btn-danger btn-xs" onclick="deleteHoliday('${h.id}')" style="background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">삭제</button>
      `;
      adminHolidaysListUi.appendChild(div);
    });
  } catch (err) {
    console.error('loadHolidays error:', err);
  }
}

window.deleteHoliday = async function(id) {
  if (!confirm('해당 휴일을 삭제하시겠습니까?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/holidays/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      alert('휴일이 삭제되었습니다.');
      loadHolidays();
      loadTimetable();
    } else {
      alert('휴일 삭제 실패');
    }
  } catch (err) {
    console.error(err);
  }
};
