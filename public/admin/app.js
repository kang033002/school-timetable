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

const timetableTitle = null; // 탭별로 동적으로 사용 (아래 loadTimetable 참조)
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
let pendingForcePayload = null; // stores payload to retry with force=true

const logsModal = document.getElementById('logs-modal');
const btnLogsClose = document.getElementById('btn-logs-close');
const logsBody = document.getElementById('logs-body');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today in local KST timezone
  const todayObj = new Date();
  const kstOffset = todayObj.getTimezoneOffset() * 60000;
  const today = new Date(todayObj.getTime() - kstOffset).toISOString().split('T')[0];
  if (datePicker) datePicker.value = today;

  // Check stored auth
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (token && userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u && u.role === 'MASTER_ADMIN') {
        // If master admin token remains, clear and show login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } else if (u) {
        currentUser = u;
        showDashboard();
      }
    } catch (e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  // Event Listeners
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  const tabBtnBase = document.getElementById('tab-btn-base');
  const tabBtnDaily = document.getElementById('tab-btn-daily');
  const tabBtnTeacher = document.getElementById('tab-btn-teacher');
  const tabBtnGenerator = document.getElementById('tab-btn-generator');

  if (btnRefresh) btnRefresh.addEventListener('click', loadTimetable);
  if (btnSettingsToggle) btnSettingsToggle.addEventListener('click', toggleSettingsPanel);

  if (tabBtnBase) tabBtnBase.addEventListener('click', () => switchTab('BASE'));
  if (tabBtnDaily) tabBtnDaily.addEventListener('click', () => switchTab('DAILY'));
  if (tabBtnTeacher) tabBtnTeacher.addEventListener('click', () => switchTab('TEACHER'));
  if (tabBtnGenerator) tabBtnGenerator.addEventListener('click', () => switchTab('GENERATOR'));

  // Default tab (1st tab: DAILY)
  switchTab('DAILY');

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

  linkShowStudentSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    schoolSignupForm.classList.add('hidden');
    studentSignupForm.classList.remove('hidden');
  });

  linkShowSchoolSignup?.addEventListener('click', (e) => {
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
  schoolSignupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolName = document.getElementById('school-signup-name').value.trim();
    const adminEmail = document.getElementById('school-signup-email').value.trim();
    const adminPassword = document.getElementById('school-signup-password').value.trim();

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

  studentSignupForm?.addEventListener('submit', async (e) => {
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
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';

  if (!email || !password) {
    alert('아이디(이메일)와 비밀번호를 모두 입력해주세요!');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '로그인 실패: 아이디 또는 비밀번호를 확인해주세요.');
      return;
    }

    // 마스터 계정일 경우 마스터 페이지로 안내
    if (data.user && data.user.role === 'MASTER_ADMIN') {
      window.location.href = '/master';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;

    showDashboard();
  } catch (err) {
    console.error('Login error:', err);
    alert('서버 통신 오류가 발생했습니다.');
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
  try {
    loginScreen?.classList.add('hidden');
    dashboardScreen?.classList.remove('hidden');

    const userNameElem = document.getElementById('user-name-display');
    const userRoleElem = document.getElementById('user-role-badge');
    const navSchoolNameElem = document.getElementById('nav-school-name');

    if (userNameElem) userNameElem.textContent = `${currentUser?.name || '사용자'}`;
    if (userRoleElem) userRoleElem.textContent = currentUser?.role === 'ADMIN' ? '관리자(일과계)' : '교사';
    if (navSchoolNameElem) navSchoolNameElem.textContent = `🏫 ${currentUser?.schoolName || '시간표'} 관리자 시스템`;

    // 1~10교시 그리드 즉시 항시 렌더링
    renderGrid([], 'CLASS');

    await loadSchoolMetadata();
    await loadTimetable();
  } catch (err) {
    console.error('showDashboard error:', err);
    renderGrid([], 'CLASS');
  }
}

// Load Metadata
async function loadSchoolMetadata() {
  if (!currentUser || !currentUser.schoolId) return;
  try {
    const res = await fetch(`${API_BASE}/schools/${currentUser.schoolId}/meta`);
    if (!res.ok) return;
    currentSchoolMeta = await res.json();

    if (currentSchoolMeta && currentSchoolMeta.gradeClasses) {
      // Populate Class Select
      classSelect.innerHTML = '';
      currentSchoolMeta.gradeClasses.forEach(gc => {
        const opt = document.createElement('option');
        opt.value = `${gc.grade}-${gc.class_number}`;
        opt.dataset.id = gc.id;
        opt.textContent = `${gc.grade}학년 ${gc.class_number}반 (${gc.homeroom_teacher_name || '담임미정'})`;
        classSelect.appendChild(opt);
      });
    }

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

    // Render Classes List with Homeroom Teacher Info for Deletion/View
    const cListUi = document.getElementById('admin-classes-list-ui');
    if (cListUi) {
      cListUi.innerHTML = '';
      if (!currentSchoolMeta.gradeClasses || currentSchoolMeta.gradeClasses.length === 0) {
        cListUi.innerHTML = '<p class="text-center text-muted" style="font-size:0.85rem;">등록된 학년/학급이 없습니다.</p>';
      } else {
        currentSchoolMeta.gradeClasses.forEach(c => {
          const homeroomTeacher = currentSchoolMeta.teachers.find(t => t.id === c.homeroom_teacher_id);
          const div = document.createElement('div');
          div.className = 'settings-list-item';
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          div.style.padding = '0.4rem 0.6rem';
          div.style.borderBottom = '1px solid var(--border-color)';
          div.style.fontSize = '0.88rem';
          div.innerHTML = `
            <span>🏫 <strong>${c.grade}학년 ${c.class_number}반</strong> ${homeroomTeacher ? `<span style="color:var(--primary-color); font-weight:600;">(담임: ${homeroomTeacher.name})</span>` : '<span style="color:var(--text-sub);">(담임 미지정)</span>'}</span>
            <button class="btn btn-danger btn-xs" onclick="deleteClass('${c.id}')" style="padding:2px 6px; font-size:11px; background:#ef4444; color:#fff; border-radius:4px;">삭제</button>
          `;
          cListUi.appendChild(div);
        });
      }
    }

  } catch (err) {
    console.error('Metadata load error:', err);
  }
}

window.deleteClass = async function(id) {
  if (!confirm('해당 학급을 삭제하시겠습니까? 관련 시간표 데이터도 삭제될 수 있습니다.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/classes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('학급이 삭제되었습니다.');
      loadMetadata();
    } else {
      alert('학급 삭제 실패');
    }
  } catch (err) {
    console.error(err);
  }
};

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

function updateFiltersForTab(tabName) {
  if (tabName === 'TEACHER') {
    classFilterGroup.classList.add('hidden');
    teacherFilterGroup.classList.remove('hidden');
  } else {
    classFilterGroup.classList.remove('hidden');
    teacherFilterGroup.classList.add('hidden');
  }
}

// Load Timetable Grid
async function loadTimetable() {
  if (!currentSchoolMeta) return;

  const dateVal = datePicker.value;
  const baseParam = activeTab === 'BASE' ? '&baseOnly=true' : '';

  try {
    let url = '';
    const titleElemDaily = document.getElementById('timetable-title-daily');
    const titleElemBase = document.getElementById('timetable-title-base');
    const titleElemTeacher = document.getElementById('timetable-title-teacher');
    
    let mode = 'CLASS';

    if (activeTab === 'TEACHER') {
      mode = 'TEACHER';
      const teacherId = teacherSelect.value;
      if (!teacherId) {
        weekDateSubtext.textContent = `기준주간 시작: -`;
        renderGrid([], mode);
        return;
      }
      const teacherObj = currentSchoolMeta.teachers.find(t => t.id === teacherId);
      url = `${API_BASE}/timetable/teacher?schoolId=${currentUser.schoolId}&teacherId=${teacherId}&date=${dateVal}${baseParam}`;
      if (titleElemTeacher) titleElemTeacher.textContent = `👩‍🏫 ${teacherObj ? teacherObj.name : ''} 선생님 시간표`;
    } else {
      mode = 'CLASS';
      if (!classSelect.value) {
        weekDateSubtext.textContent = `기준주간 시작: -`;
        renderGrid([], mode);
        return;
      }
      const [grade, classNum] = classSelect.value.split('-');
      url = `${API_BASE}/timetable/class?schoolId=${currentUser.schoolId}&grade=${grade}&classNumber=${classNum}&date=${dateVal}${baseParam}`;
      if (activeTab === 'BASE') {
        if (titleElemBase) titleElemBase.textContent = `🏫 ${grade}학년 ${classNum}반 기본 시간표 원본 설정`;
      } else {
        if (titleElemDaily) titleElemDaily.textContent = `📅 ${grade}학년 ${classNum}반 주간 시간표 (변동 내역 포함)`;
      }
    }

    const res = await fetch(url);
    const data = await res.json();

    weekDateSubtext.textContent = `기준주간 시작: ${data.mondayDate}`;
    renderGrid(data.timetable, mode);
  } catch (err) {
    console.error('Timetable load error:', err);
  }
}

function switchTab(tabName) {
  activeTab = tabName;
  updateFiltersForTab(tabName);

  const tabBtnBase = document.getElementById('tab-btn-base');
  const tabBtnDaily = document.getElementById('tab-btn-daily');
  const tabBtnTeacher = document.getElementById('tab-btn-teacher');
  const tabBtnGenerator = document.getElementById('tab-btn-generator');

  const contentBase = document.getElementById('tab-content-base');
  const contentDaily = document.getElementById('tab-content-daily');
  const contentTeacher = document.getElementById('tab-content-teacher');
  const contentGenerator = document.getElementById('tab-content-generator');

  [tabBtnBase, tabBtnDaily, tabBtnTeacher, tabBtnGenerator].forEach(btn => btn && btn.classList.remove('active'));
  [contentBase, contentDaily, contentTeacher, contentGenerator].forEach(cnt => cnt && cnt.classList.add('hidden'));

  if (tabName === 'BASE') {
    if (tabBtnBase) tabBtnBase.classList.add('active');
    if (contentBase) contentBase.classList.remove('hidden');
    datePicker.parentElement.style.display = 'none';
    loadTimetable();
    loadTeacherStats();
  } else if (tabName === 'DAILY') {
    if (tabBtnDaily) tabBtnDaily.classList.add('active');
    if (contentDaily) contentDaily.classList.remove('hidden');
    datePicker.parentElement.style.display = 'block';
    loadTimetable();
  } else if (tabName === 'TEACHER') {
    if (tabBtnTeacher) tabBtnTeacher.classList.add('active');
    if (contentTeacher) contentTeacher.classList.remove('hidden');
    datePicker.parentElement.style.display = 'block';
    loadTimetable();
  } else if (tabName === 'GENERATOR') {
    if (tabBtnGenerator) tabBtnGenerator.classList.add('active');
    if (contentGenerator) contentGenerator.classList.remove('hidden');
    datePicker.parentElement.style.display = 'none';
    renderGrid([], 'CLASS');
    initGeneratorTab();
    loadTeacherStats();
  }
}

// 교사별 시수 통계 불러오기
async function loadTeacherStats() {
  if (!currentUser || !currentUser.schoolId) return;
  try {
    const res = await fetch(`${API_BASE}/admin/teacher-stats?schoolId=${currentUser.schoolId}`);
    if (!res.ok) return;
    const stats = await res.json();

    const statsBodyBase = document.getElementById('stats-body-base');
    const statsBodyGen = document.getElementById('stats-body-gen');

    const renderStatsRows = (targetBody) => {
      if (!targetBody) return;
      targetBody.innerHTML = '';
      if (!stats || stats.length === 0) {
        targetBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-sub);">등록된 기본 시간표 정보가 없습니다.</td></tr>';
        return;
      }

      stats.forEach(st => {
        const tr = document.createElement('tr');
        
        const classDetails = st.classes.map(c => `${c.grade}학년 ${c.classNumber}반(${c.subjectName} ${c.weeklyHours}시간)`).join(', ');
        const monthlyEst = st.totalWeeklyHours * 4;
        const isOverload = st.totalWeeklyHours > 20;

        tr.innerHTML = `
          <td><strong>👩‍🏫 ${st.teacherName}</strong></td>
          <td style="font-size:0.88rem; color:var(--text-main);">${classDetails || '-'}</td>
          <td><span class="badge ${isOverload ? 'badge-danger' : 'badge-primary'}">${st.totalWeeklyHours} 시간</span></td>
          <td>약 ${monthlyEst} 시간</td>
          <td>${isOverload ? '<span style="color:#ef4444; font-weight:600;">⚠️ 과다 시수</span>' : '<span style="color:#10b981; font-weight:600;">✅ 적정</span>'}</td>
        `;
        targetBody.appendChild(tr);
      });
    };

    renderStatsRows(statsBodyBase);
    renderStatsRows(statsBodyGen);
  } catch (err) {
    console.error('Load teacher stats error:', err);
  }
}

function renderGrid(weeklyData, mode) {
  let targetBody = null;
  if (activeTab === 'DAILY') {
    targetBody = document.getElementById('timetable-body-daily');
  } else if (activeTab === 'BASE') {
    targetBody = document.getElementById('timetable-body-base');
  } else if (activeTab === 'TEACHER') {
    targetBody = document.getElementById('timetable-body-teacher');
  } else if (activeTab === 'GENERATOR') {
    targetBody = document.getElementById('timetable-body-gen');
  }

  if (!targetBody) return;
  targetBody.innerHTML = '';
  const maxPeriods = 10; // 고등학교 표준 10교시 고정 표출

    for (let p = 1; p <= maxPeriods; p++) {
      const tr = document.createElement('tr');

      // Period Header
      const th = document.createElement('th');
      th.textContent = `${p}교시`;
      tr.appendChild(th);

      // Days 1 to 5 (월~금)
      for (let d = 0; d < 5; d++) {
        const dayOfWeek = d + 1;
        const dayData = (weeklyData && Array.isArray(weeklyData) && weeklyData.length > d) ? weeklyData[d] : null;
        const slot = (dayData && dayData.slots && Array.isArray(dayData.slots) && dayData.slots.length >= p) ? dayData.slots[p - 1] : null;

        const td = document.createElement('td');
        td.className = 'timetable-cell';

        if (slot && slot.isChanged) {
          td.classList.add('is-changed');
          const badge = document.createElement('span');
          badge.className = 'change-badge';
          badge.textContent = slot.changeType === 'SUBSTITUTE' ? '변동' : '결강';
          td.appendChild(badge);
        }

        // 수업 내용이 있거나(subjectName/gradeName), 변경/보강 이력이 있으면 표시
        const hasContent = slot && (slot.subjectName || slot.gradeName || slot.teacherName);
        const hasChange = slot && slot.isChanged;

        if (hasContent || hasChange) {
          const subDiv = document.createElement('div');
          subDiv.className = 'cell-subject';
          if (mode === 'CLASS') {
            subDiv.textContent = slot.subjectName || (slot.changeType === 'CANCEL' ? '결강' : slot.changeType === 'SUBSTITUTE' ? '보강' : '수업없음');
          } else {
            subDiv.textContent = slot.gradeName || slot.subjectName || (hasChange ? '변경됨' : '빈교시');
          }
          td.appendChild(subDiv);

          const infoDiv = document.createElement('div');
          infoDiv.className = 'cell-subinfo';
          if (mode === 'CLASS') {
            infoDiv.textContent = slot.teacherName || (hasChange ? '변경' : '');
          } else {
            infoDiv.textContent = slot.subjectName || '';
          }
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
      targetBody.appendChild(tr);
    }
}

// Open Change Modal (일자별/기본 시간표 교시 셀 수동 클릭 수정)
function openChangeModal(targetDate, dayOfWeek, period, slot, mode) {
  if (activeTab === 'TEACHER') {
    alert('👩‍🏫 교사 시간표 탭은 조회 전용입니다. 시간표 변경은 [일자별 시간표] 또는 [학기 기본 시간표] 탭에서 진행해주세요.');
    return;
  }

  let selectedGcId = null;
  let gradeStr = '1';
  let classNumStr = '1';

  if (classSelect && classSelect.value) {
    const parts = classSelect.value.split('-');
    gradeStr = parts[0] || '1';
    classNumStr = parts[1] || '1';
    if (currentSchoolMeta && currentSchoolMeta.gradeClasses) {
      const gcObj = currentSchoolMeta.gradeClasses.find(gc => gc.grade == gradeStr && gc.class_number == classNumStr);
      if (gcObj) selectedGcId = gcObj.id;
    }
  }

  if (!selectedGcId && currentSchoolMeta && currentSchoolMeta.gradeClasses && currentSchoolMeta.gradeClasses.length > 0) {
    selectedGcId = currentSchoolMeta.gradeClasses[0].id;
    gradeStr = currentSchoolMeta.gradeClasses[0].grade;
    classNumStr = currentSchoolMeta.gradeClasses[0].class_number;
  }

  selectedSlotData = { targetDate, dayOfWeek, period, slot, mode, gradeClassId: selectedGcId };

  const daysKor = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = daysKor[dayOfWeek] || '월';
  const headerStr = activeTab === 'BASE' 
    ? `학기 기본 시간표 원본 설정 (${dayName}요일 ${period}교시)` 
    : `일자별 수업 조정 (${targetDate || '기본주간'} ${period}교시)`;

  if (slotInfoSummary) {
    slotInfoSummary.innerHTML = `
      <strong>[선택 교시]</strong> ${headerStr} - ${gradeStr}학년 ${classNumStr}반<br>
      <strong>[현재 배정 수업]</strong> ${slot && slot.subjectName ? `${slot.subjectName} (${slot.teacherName || '교사미정'} 선생님)` : '배정 없음'}
    `;
  }

  // Reset form
  if (conflictAlert) conflictAlert.classList.add('hidden');
  pendingForcePayload = null;

  // Show Modal
  if (changeModal) changeModal.classList.remove('hidden');

  const btnSave = document.getElementById('btn-modal-save');
  if (btnSave) {
    if (slot && slot.changeType === 'HOLIDAY') {
      if (conflictList) conflictList.innerHTML = '<li>해당 일자는 지정된 휴업일(휴일)이므로 시간표 수정이 불가능합니다.</li>';
      if (conflictAlert) conflictAlert.classList.remove('hidden');
      btnSave.disabled = true;
    } else {
      btnSave.disabled = false;
    }
  }
}



// Handle Change Submit (with Conflict Pre-checking)
async function handleApplyChange(e) {
  e.preventDefault();

  if (!selectedSlotData || !selectedSlotData.gradeClassId) {
    alert('선택된 학급 정보가 올바르지 않습니다. 학급을 선택한 후 다시 시도해 주세요.');
    return;
  }

  const changedSubjectId = changeSubjectSelect ? changeSubjectSelect.value : null;
  const changedTeacherId = changeTeacherSelect ? changeTeacherSelect.value : null;

  if (activeTab === 'GENERATOR') {
    if (!changedSubjectId || !changedTeacherId) {
      alert('과목과 교사를 선택해주세요.');
      return;
    }
    const subjectName = currentSchoolMeta?.subjects?.find(s => s.id === changedSubjectId)?.name || '';
    const teacherName = currentSchoolMeta?.teachers?.find(t => t.id === changedTeacherId)?.name || '';
    const gradeClassId = selectedSlotData.gradeClassId;
    const dayOfWeek = selectedSlotData.dayOfWeek;
    const period = selectedSlotData.period;

    if (!genClassMap[gradeClassId]) genClassMap[gradeClassId] = {};
    if (!genClassMap[gradeClassId][dayOfWeek]) genClassMap[gradeClassId][dayOfWeek] = {};
    genClassMap[gradeClassId][dayOfWeek][period] = {
      gradeClassId,
      dayOfWeek,
      period,
      subjectId: changedSubjectId,
      teacherId: changedTeacherId,
      subjectName,
      teacherName
    };

    const newSlot = { gradeClassId, dayOfWeek, period, subjectId: changedSubjectId, teacherId: changedTeacherId, subjectName, teacherName };
    if (generatedResult) {
      const idx = generatedResult.findIndex(r => r.gradeClassId === gradeClassId && r.dayOfWeek === dayOfWeek && r.period === period);
      if (idx >= 0) generatedResult[idx] = newSlot;
      else generatedResult.push(newSlot);
    } else {
      generatedResult = [newSlot];
    }

    if (changeModal) changeModal.classList.add('hidden');
    renderGenGrid(genCurrentClassId);
    return;
  }

  if (activeTab === 'BASE') {
    const payload = {
      schoolId: currentUser.schoolId,
      gradeClassId: selectedSlotData.gradeClassId,
      dayOfWeek: selectedSlotData.dayOfWeek,
      period: selectedSlotData.period,
      subjectId: changedSubjectId,
      teacherId: changedTeacherId,
      force: false
    };
    try {
      const res = await fetch(`${API_BASE}/admin/base-timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.status === 409) {
        // 충돌 감지 → 버튼 표시
        if (conflictList) {
          conflictList.innerHTML = '';
          (data.conflicts || []).forEach(c => {
            const li = document.createElement('li');
            li.textContent = c.message;
            conflictList.appendChild(li);
          });
        }
        pendingForcePayload = { ...payload, force: true };
        if (conflictAlert) conflictAlert.classList.remove('hidden');
        return;
      }
      if (res.ok) {
        alert('🎉 학기 기본 시간표 수업 설정이 성공적으로 저장되었습니다!');
        if (changeModal) changeModal.classList.add('hidden');
        loadTimetable();
        loadTeacherStats();
      } else {
        alert(data.error || '기본 시간표 저장 실패');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
    return;
  }

  // DAILY Tab Case
  const payload = {
    schoolId: currentUser.schoolId,
    targetDate: selectedSlotData.targetDate || new Date().toISOString().split('T')[0],
    period: selectedSlotData.period,
    gradeClassId: selectedSlotData.gradeClassId,
    changeType: 'SUBSTITUTE',
    changedTeacherId,
    changedSubjectId,
    changedRoomId: null,
    reason: '일과계 시간표 조정',
    createdBy: currentUser.name || '관리자',
    force: false
  };

  try {
    const res = await fetch(`${API_BASE}/timetable/change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.status === 409) {
      if (conflictList) {
        conflictList.innerHTML = '';
        (data.conflicts || []).forEach(c => {
          const li = document.createElement('li');
          li.textContent = c.message;
          conflictList.appendChild(li);
        });
      }
      pendingForcePayload = { ...payload, force: true };
      if (conflictAlert) conflictAlert.classList.remove('hidden');
      return;
    }

    if (res.ok) {
      alert('🎉 수업 변경/보강이 성공적으로 저장 및 적용되었습니다!');
      if (changeModal) changeModal.classList.add('hidden');
      loadTimetable();
    } else {
      alert(data.error || '수업 변경 저장 실패');
    }
  } catch (err) {
    console.error(err);
    alert('저장 처리 중 오류가 발생했습니다.');
  }
}

// ── 충돌 발생 시 OK/취소 버튼 처리 ───────────────────────────────────────────
document.getElementById('btn-force-ok').addEventListener('click', async () => {
  if (!pendingForcePayload) return;
  const payload = pendingForcePayload;
  pendingForcePayload = null;
  conflictAlert.classList.add('hidden');

  // 어떤 API 엔드포인트로 보낼지 결정
  const isBase = payload.dayOfWeek !== undefined && payload.targetDate === undefined;
  const url = isBase
    ? `${API_BASE}/admin/base-timetable`
    : `${API_BASE}/timetable/change`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert(isBase ? '기본 시간표가 저장되었습니다.' : '시간표 변경이 적용되었습니다.');
      changeModal.classList.add('hidden');
      loadTimetable();
    } else {
      const d = await res.json();
      alert(d.error || '저장 실패');
    }
  } catch (err) {
    console.error('Force save error:', err);
    alert('서버 오류가 발생했습니다.');
  }
});

document.getElementById('btn-force-cancel').addEventListener('click', () => {
  conflictAlert.classList.add('hidden');
  pendingForcePayload = null;
});

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

// ────────────────────────────────────────────────────────────────────────────
// 🤖 시간표 자동 생성기 탭 프론트엔드 연동 Logic
// ────────────────────────────────────────────────────────────────────────────
let generatorData = null;
let generatedResult = null;
let genClassMap = {};       // { gradeClassId: { day: { period: slot } } }
let genCurrentClassId = null; // 미리보기에서 현재 선택된 학급

async function initGeneratorTab() {
  if (!currentUser || !currentUser.schoolId) return;
  try {
    // 기본 빈 그리드 표출 (1~10교시)
    renderGenGrid(null);

    let classesList = [];
    let subjectsList = [];
    let teachersList = [];

    try {
      const res = await fetch(`${API_BASE}/generator/data?schoolId=${currentUser.schoolId}`);
      if (res.ok) {
        generatorData = await res.json();
        classesList = generatorData?.classes || [];
        subjectsList = generatorData?.subjects || [];
        teachersList = generatorData?.teachers || [];
      }
    } catch (e) {
      console.warn('API fetch failed, fallback to currentSchoolMeta:', e);
    }

    if (!classesList.length && currentSchoolMeta?.gradeClasses) {
      classesList = currentSchoolMeta.gradeClasses;
    }
    if (!subjectsList.length && currentSchoolMeta?.subjects) {
      subjectsList = currentSchoolMeta.subjects;
    }
    if (!teachersList.length && currentSchoolMeta?.teachers) {
      teachersList = currentSchoolMeta.teachers;
    }

    if (!generatorData) {
      generatorData = {
        classes: classesList,
        subjects: subjectsList,
        teachers: teachersList,
        maxPeriodsPerDay: 10,
        operatingDays: 5
      };
    }

    // ① 학급 선택 칩 버튼 목록 생성
    const classContainer = document.getElementById('gen-class-checkboxes');
    if (classContainer) {
      classContainer.innerHTML = '';
      if (classesList.length === 0) {
        classContainer.innerHTML = '<p style="color:var(--text-sub); font-size:0.85rem;">[⚙️ 학교/교사 설정]에서 먼저 학년/반을 등록해주세요.</p>';
      } else {
        classesList.forEach(c => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-sm btn-primary gen-class-chip active';
          btn.dataset.classId = c.id;
          btn.style.cssText = 'padding:0.35rem 0.75rem; font-size:0.88rem; font-weight:700;';
          btn.innerHTML = `🏫 ${c.grade}학년 ${c.class_number || c.classNumber}반`;
          btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) {
              btn.classList.remove('active', 'btn-primary');
              btn.classList.add('btn-outline');
              btn.style.background = '#ffffff';
              btn.style.color = '#64748b';
            } else {
              btn.classList.add('active', 'btn-primary');
              btn.classList.remove('btn-outline');
              btn.style.background = '';
              btn.style.color = '';
            }
          });
          classContainer.appendChild(btn);
        });
      }
    }

    // ② 과목/교사/시수 입력표 생성
    const subjectBody = document.getElementById('gen-subject-body');
    if (subjectBody) {
      subjectBody.innerHTML = '';
      if (!generatorData.subjects || generatorData.subjects.length === 0) {
        subjectBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1rem; color:var(--text-sub);">[⚙️ 학교/교사 설정]에서 먼저 과목과 교사를 등록해주세요.</td></tr>';
        return;
      }
      generatorData.subjects.forEach(sub => {
        const tr = document.createElement('tr');
        const teacherOptions = (generatorData.teachers || []).map(t =>
          `<option value="${t.id}">${t.name} 선생님</option>`
        ).join('');
        tr.innerHTML = `
          <td><strong>📚 ${sub.name}</strong></td>
          <td>
            <select class="form-select gen-teacher-select" data-subject-id="${sub.id}" style="padding:0.35rem 0.5rem; font-size:0.88rem;">
              ${teacherOptions}
            </select>
          </td>
          <td>
            <input type="number" class="form-input gen-hours-input" data-subject-id="${sub.id}"
              min="0" max="10" value="3"
              style="width:70px; padding:0.35rem; font-size:0.9rem; text-align:center;"> 시간/주
          </td>
        `;
        subjectBody.appendChild(tr);
      });
    }

  } catch (err) {
    console.error('Init generator tab error:', err);
  }
}

// 전체 선택 / 해제 버튼
document.addEventListener('click', (e) => {
  if (e.target?.id === 'btn-gen-select-all' || e.target?.closest('#btn-gen-select-all')) {
    document.querySelectorAll('.gen-class-chip').forEach(btn => {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline');
      btn.style.background = '';
      btn.style.color = '';
    });
  }
  if (e.target?.id === 'btn-gen-deselect-all' || e.target?.closest('#btn-gen-deselect-all')) {
    document.querySelectorAll('.gen-class-chip').forEach(btn => {
      btn.classList.remove('active', 'btn-primary');
      btn.classList.add('btn-outline');
      btn.style.background = '#ffffff';
      btn.style.color = '#64748b';
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// AI 자동 생성 시작
// ────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-generate')?.addEventListener('click', async () => {
  const selectedClassIds = Array.from(document.querySelectorAll('.gen-class-chip.active')).map(b => b.dataset.classId);
  if (selectedClassIds.length === 0) {
    alert('시간표를 적용할 학급을 최소 1개 이상 선택해주세요!');
    return;
  }

  const subjectsList = [];
  document.querySelectorAll('.gen-hours-input').forEach(input => {
    const subjectId = input.getAttribute('data-subject-id');
    const weeklyHours = parseInt(input.value) || 0;
    const teacherSel = document.querySelector(`.gen-teacher-select[data-subject-id="${subjectId}"]`);
    const teacherId = teacherSel ? teacherSel.value : null;
    if (weeklyHours > 0 && teacherId) {
      subjectsList.push({ subjectId, teacherId, weeklyHours });
    }
  });

  if (subjectsList.length === 0) {
    alert('주간 시수가 1시간 이상인 과목이 없습니다. 시수를 입력해주세요.');
    return;
  }

  const assignments = selectedClassIds.map(gcId => ({ gradeClassId: gcId, subjects: subjectsList }));

  const btnGen = document.getElementById('btn-generate');
  try {
    if (btnGen) { btnGen.textContent = '⏳ AI가 배정 작업 중...'; btnGen.disabled = true; }

    const res = await fetch(`${API_BASE}/generator/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: currentUser.schoolId, assignments })
    });

    if (btnGen) { btnGen.textContent = '🤖 AI 시간표 자동 생성 시작'; btnGen.disabled = false; }

    if (!res.ok) { alert('자동 생성 실패'); return; }

    const data = await res.json();
    generatedResult = data.timetable;

    // classMap 빌드: { gcId: { day: { period: slotData } } }
    genClassMap = {};
    (data.timetable || []).forEach(t => {
      if (!genClassMap[t.gradeClassId]) genClassMap[t.gradeClassId] = {};
      if (!genClassMap[t.gradeClassId][t.dayOfWeek]) genClassMap[t.gradeClassId][t.dayOfWeek] = {};
      genClassMap[t.gradeClassId][t.dayOfWeek][t.period] = t;
    });

    // 미배정 알림
    const unassignedAlert = document.getElementById('gen-unassigned-alert');
    const unassignedList = document.getElementById('gen-unassigned-list');
    if (data.unassigned && data.unassigned.length > 0) {
      if (unassignedAlert) unassignedAlert.classList.remove('hidden');
      if (unassignedList) {
        unassignedList.innerHTML = '';
        data.unassigned.forEach(u => {
          const gc = (generatorData?.classes || []).find(c => c.id === u.gradeClassId);
          const li = document.createElement('li');
          li.textContent = `${gc ? `${gc.grade}학년 ${gc.class_number}반` : ''} - ${u.subjectName} (${u.teacherName} 선생님)`;
          unassignedList.appendChild(li);
        });
      }
    } else {
      if (unassignedAlert) unassignedAlert.classList.add('hidden');
    }

    // 학급 선택 드롭다운 채우기
    const classSel = document.getElementById('gen-preview-class-select');
    if (classSel) {
      classSel.innerHTML = '';
      selectedClassIds.forEach(gcId => {
        const gc = (generatorData?.classes || []).find(c => c.id === gcId);
        const opt = document.createElement('option');
        opt.value = gcId;
        opt.textContent = gc ? `${gc.grade}학년 ${gc.class_number}반` : gcId;
        classSel.appendChild(opt);
      });
      // 첫 번째 학급 미리보기
      genCurrentClassId = selectedClassIds[0];
      classSel.value = genCurrentClassId;
      renderGenGrid(genCurrentClassId, data.maxPeriodsPerDay || 10);
    }

    alert(`🎉 AI 시간표 자동 생성 완료!\n${selectedClassIds.length}개 학급 × ${subjectsList.length}개 과목\n아래 미리보기를 확인 후 수정하세요.`);

  } catch (err) {
    if (btnGen) { btnGen.textContent = '🤖 AI 시간표 자동 생성 시작'; btnGen.disabled = false; }
    console.error('Generate error:', err);
    alert('생성 중 오류가 발생했습니다.');
  }
});

// 다시 생성
document.getElementById('btn-regen')?.addEventListener('click', () => {
  document.getElementById('btn-generate')?.click();
});

// 학급 드롭다운 변경 시 미리보기 전환
document.addEventListener('change', (e) => {
  if (e.target?.id === 'gen-preview-class-select') {
    genCurrentClassId = e.target.value;
    renderGenGrid(genCurrentClassId);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 자동 생성 탭 미리보기 그리드 렌더링 (timetable-body-gen 사용)
// ────────────────────────────────────────────────────────────────────────────
function renderGenGrid(gradeClassId, maxPeriods) {
  const tbody = document.getElementById('timetable-body-gen');
  if (!tbody) return;
  tbody.innerHTML = '';
  const periods = maxPeriods || 10;
  const classMap = gradeClassId ? genClassMap[gradeClassId] : null;
  const gc = gradeClassId ? (generatorData?.classes || []).find(c => c.id === gradeClassId) : null;

  for (let p = 1; p <= periods; p++) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = `${p}교시`;
    tr.appendChild(th);

    for (let d = 1; d <= 5; d++) {
      const td = document.createElement('td');
      td.className = 'timetable-cell';
      const slot = classMap?.[d]?.[p];

      if (slot) {
        td.style.background = 'rgba(59, 130, 246, 0.08)';
        const subDiv = document.createElement('div');
        subDiv.className = 'cell-subject';
        subDiv.textContent = slot.subjectName || '(과목)';
        td.appendChild(subDiv);
        const infoDiv = document.createElement('div');
        infoDiv.className = 'cell-subinfo';
        infoDiv.textContent = slot.teacherName || '';
        td.appendChild(infoDiv);
      } else {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'cell-subinfo';
        emptyDiv.textContent = gradeClassId ? '-' : '생성 전';
        td.appendChild(emptyDiv);
      }

      // 클릭 시 수동 수정 모달 열기 (BASE 탭과 동일한 모달 재사용)
      td.addEventListener('click', () => {
        if (!gradeClassId) {
          alert('먼저 AI 생성을 실행하거나 학급을 선택해주세요.');
          return;
        }
        openGenCellModal(gradeClassId, d, p, slot, gc);
      });

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 자동생성 탭 셀 수동 수정 모달 (기존 changeModal 재사용)
// ────────────────────────────────────────────────────────────────────────────
function openGenCellModal(gradeClassId, dayOfWeek, period, slot, gc) {
  const daysKor = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = daysKor[dayOfWeek] || '?';
  const gcName = gc ? `${gc.grade}학년 ${gc.class_number}반` : '';

  if (slotInfoSummary) {
    slotInfoSummary.innerHTML = `
      <strong>[자동생성 수정]</strong> ${gcName} ${dayName}요일 ${period}교시<br>
      <strong>[현재 배정]</strong> ${slot ? `${slot.subjectName} (${slot.teacherName} 선생님)` : '배정 없음'}
    `;
  }
  if (conflictAlert) conflictAlert.classList.add('hidden');
  pendingForcePayload = null;

  // 과목/교사 셀렉트 채우기 (currentSchoolMeta 사용)
  if (changeSubjectSelect && currentSchoolMeta?.subjects) {
    changeSubjectSelect.innerHTML = currentSchoolMeta.subjects.map(s =>
      `<option value="${s.id}" ${slot?.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`
    ).join('');
  }
  if (changeTeacherSelect && currentSchoolMeta?.teachers) {
    changeTeacherSelect.innerHTML = currentSchoolMeta.teachers.map(t =>
      `<option value="${t.id}" ${slot?.teacherId === t.id ? 'selected' : ''}>${t.name} 선생님</option>`
    ).join('');
  }

  // selectedSlotData 및 activeTab 바인딩
  activeTab = 'GENERATOR';
  selectedSlotData = {
    gradeClassId,
    dayOfWeek,
    period,
    slot,
    mode: 'CLASS',
    targetDate: null
  };

  const btnSave = document.getElementById('btn-modal-save');
  if (btnSave) {
    btnSave.disabled = false;
  }

  if (changeModal) changeModal.classList.remove('hidden');
}

// ────────────────────────────────────────────────────────────────────────────
// 전체 학년/반 기본 시간표로 최종 적용
// ────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-apply-timetable')?.addEventListener('click', async () => {
  if (!generatedResult || generatedResult.length === 0) {
    alert('적용할 시간표 데이터가 없습니다. AI 자동 생성 또는 수동 입력 후 시도해주세요.');
    return;
  }
  if (!confirm(`생성된 시간표를 전 학년/반 기본 시간표로 최종 저장할까요?\n총 ${generatedResult.length}개 수업 슬롯이 저장됩니다.\n\n⚠️ 기존 기본 시간표는 덮어씌워집니다.`)) return;

  try {
    const res = await fetch(`${API_BASE}/generator/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: currentUser.schoolId, timetable: generatedResult })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`🎉 시간표 적용 완료!\n총 ${data.applied}개 수업이 기본 시간표에 저장되었습니다.\n이제 [학기 기본 시간표] 탭에서 확인할 수 있습니다.`);
      // 학기 기본 시간표 탭으로 이동 + 새로고침
      switchTab('BASE');
      loadTimetable();
      loadTeacherStats();
    } else {
      alert(data.error || '시간표 적용 실패');
    }
  } catch (err) {
    console.error('Apply timetable error:', err);
    alert('적용 처리 중 오류가 발생했습니다.');
  }
});

