const API_BASE = '/api';
window.API_BASE = API_BASE;

let currentUser = null;
Object.defineProperty(window, 'currentUser', {
  get: () => currentUser,
  set: (val) => { currentUser = val; }
});
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
const filterGradeSelect = document.getElementById('filter-grade-select');
const filterClassSelect = document.getElementById('filter-class-select');
const teacherTitleSelect = document.getElementById('teacher-title-select');
const datePicker = document.getElementById('date-picker');
const btnRefresh = document.getElementById('btn-refresh');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today in local KST timezone
  const todayObj = new Date();
  const kstOffset = todayObj.getTimezoneOffset() * 60000;
  const today = new Date(todayObj.getTime() - kstOffset).toISOString().split('T')[0];
  if (datePicker) datePicker.value = today;

  async function init() {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';

  const savedUser = localStorage.getItem('timetable_user');
  const token = sessionStorage.getItem('token');
  const userStr = sessionStorage.getItem('user');
  if (token && userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u && u.role === 'MASTER_ADMIN') {
        // If master admin token remains, clear and show login
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      } else if (u) {
        currentUser = u;
        showDashboard();
      }
    } catch (e) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
  }
}
init();

  // Event Listeners
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);

  const tabBtnBase = document.getElementById('tab-btn-base');
  const tabBtnDaily = document.getElementById('tab-btn-daily');
  const tabBtnTeacher = document.getElementById('tab-btn-teacher');
  const tabBtnGenerator = document.getElementById('tab-btn-generator');

  if (btnRefresh) btnRefresh.addEventListener('click', loadTimetable);
  if (btnSettingsToggle) btnSettingsToggle.addEventListener('click', toggleSettingsPanel);
  
  const btnDailyAll = document.getElementById('btn-daily-all');
  if (btnDailyAll) {
    btnDailyAll.addEventListener('click', () => {
      const selectedDate = datePicker.value;
      if (!selectedDate) {
        alert('기준 일자를 먼저 선택해주세요.');
        return;
      }
      window.open(`daily-all.html?schoolId=${currentUser.schoolId}&date=${selectedDate}`, '_blank');
    });
  }

  if (filterClassSelect) {
    filterClassSelect.addEventListener('change', () => {
      if (activeTab !== 'TEACHER' && activeTab !== 'GENERATOR') {
        loadTimetable();
      }
    });
  }

  if (datePicker) {
    datePicker.addEventListener('change', () => {
      if (activeTab !== 'GENERATOR') {
        // loadTimetable();
      }
    });
  }

window.executeTeacherQuery = function() {
  if (activeTab !== 'TEACHER') switchTab('TEACHER');
  loadTimetable();
};

  // Only use button for searching teacher timetable as requested by the user
  // teacherTitleSelect change listener removed

  if (tabBtnBase) tabBtnBase.addEventListener('click', () => switchTab('BASE'));
  if (tabBtnDaily) tabBtnDaily.addEventListener('click', () => switchTab('DAILY'));
  if (tabBtnTeacher) tabBtnTeacher.addEventListener('click', () => switchTab('TEACHER'));
  if (tabBtnGenerator) tabBtnGenerator.addEventListener('click', () => switchTab('GENERATOR'));

  // Default tab (1st tab: DAILY)
  switchTab('DAILY');

  teacherSetupForm.addEventListener('submit', handleTeacherSetup);
  classSetupForm.addEventListener('submit', handleClassSetup);
  holidaySetupForm.addEventListener('submit', handleHolidaySetup);

  document.getElementById('chk-select-all-students')?.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.chk-student');
    checkboxes.forEach(chk => chk.checked = e.target.checked);
  });

  document.getElementById('btn-delete-selected-students')?.addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.chk-student:checked')).map(chk => chk.value);
    if (selectedIds.length === 0) {
      alert('삭제할 학생을 선택해주세요.');
      return;
    }
    deleteStudents(selectedIds);
  });

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

  // Student & School signup toggles
  const linkShowStudentSignup = document.getElementById('link-show-student-signup');
  const linkShowTeacherSignup = document.getElementById('link-show-teacher-signup');
  const linkShowSchoolSignup = document.getElementById('link-show-school-signup');
  const studentSignupForm = document.getElementById('student-signup-form');
  const teacherSignupFormPublic = document.getElementById('teacher-signup-form-public');
  const schoolSignupForm = document.getElementById('school-signup-form');

  linkShowStudentSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    schoolSignupForm.classList.add('hidden');
    teacherSignupFormPublic.classList.add('hidden');
    studentSignupForm.classList.remove('hidden');
  });

  linkShowTeacherSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    schoolSignupForm.classList.add('hidden');
    studentSignupForm.classList.add('hidden');
    teacherSignupFormPublic.classList.remove('hidden');
  });

  linkShowSchoolSignup?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    studentSignupForm.classList.add('hidden');
    teacherSignupFormPublic.classList.add('hidden');
    schoolSignupForm.classList.remove('hidden');
  });

  document.querySelectorAll('.link-back-to-login').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      studentSignupForm.classList.add('hidden');
      teacherSignupFormPublic.classList.add('hidden');
      schoolSignupForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  });

  // School signup form submit
  schoolSignupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolName = document.getElementById('school-signup-name').value.trim();
    const schoolType = document.getElementById('school-signup-type').value;
    const adminEmail = document.getElementById('school-signup-email').value.trim();
    const adminPassword = document.getElementById('school-signup-password').value.trim();

    try {
      const res = await fetch(`${API_BASE}/auth/register-school`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName, schoolType, adminEmail, adminPassword })
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

  // Teacher signup form submit
  teacherSignupFormPublic?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolCode = document.getElementById('teacher-signup-school-code')?.value.trim();
    const subjectName = document.getElementById('teacher-signup-subject')?.value.trim() || '';
    const name = document.getElementById('teacher-signup-name').value.trim();
    const email = document.getElementById('teacher-signup-email').value.trim();
    const password = document.getElementById('teacher-signup-password').value.trim();

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolCode,
          role: 'TEACHER',
          name,
          subjectName,
          email,
          password
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert('선생님 가입 신청이 완료되었습니다! 관리자 승인 대기 중입니다.');
        teacherSignupFormPublic.reset();
        teacherSignupFormPublic.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        alert(data.error || '가입 신청 실패');
      }
    } catch (err) {
      console.error(err);
      alert('서버 통신 오류가 발생했습니다.');
    }
  });

  studentSignupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const schoolCode = document.getElementById('student-signup-school-code')?.value.trim();
    const name = document.getElementById('student-name').value;
    const grade = parseInt(document.getElementById('student-grade').value);
    const classNumber = parseInt(document.getElementById('student-class').value);
    const email = document.getElementById('student-email').value;
    const password = document.getElementById('student-password').value;

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolCode,
          role: 'STUDENT',
          name,
          grade,
          classNumber,
          email,
          password
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
  const schoolCodeInput = document.getElementById('login-school-code');

  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value.trim() : '';
  const schoolCode = schoolCodeInput ? schoolCodeInput.value.trim() : '';

  if (!email || !password) {
    alert('아이디(이메일)와 비밀번호를 모두 입력해주세요!');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, schoolCode })
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

    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;

    showDashboard();
  } catch (err) {
    console.error('Login error:', err);
    alert('서버 통신 오류가 발생했습니다.');
  }
}

function handleLogout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  currentUser = null;
  window.sandboxChanges = [];
  dashboardScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  location.reload();
}

// Show Dashboard
async function showDashboard() {
  try {
    loginScreen?.classList.add('hidden');
    dashboardScreen?.classList.remove('hidden');

    const contactBox = document.getElementById('login-contact-box');
    if (contactBox) contactBox.style.display = 'none';

    const userNameElem = document.getElementById('user-name-display');
    const userRoleElem = document.getElementById('user-role-badge');
    const navSchoolNameElem = document.getElementById('nav-school-name');

    try {
      const savedMapStr = localStorage.getItem('gen_class_hours_' + currentUser.schoolId);
      if (savedMapStr) {
        window.genClassHoursMap = JSON.parse(savedMapStr);
      } else {
        window.genClassHoursMap = {};
      }
    } catch(e) {
      window.genClassHoursMap = {};
    }

    if (navSchoolNameElem) {
      const schoolTitle = currentUser?.schoolName || '시간표';
      const codeStr = currentUser?.schoolCode ? ` (학교 코드 번호 ${currentUser.schoolCode})` : '';
      
      if (currentUser?.role === 'STUDENT') {
        navSchoolNameElem.textContent = `🏫 ${schoolTitle} 학생 시간표${codeStr}`;
      } else {
        navSchoolNameElem.textContent = `🏫 ${schoolTitle} 관리자 시스템${codeStr}`;
      }
    }
    
    if (userRoleElem) {
      if (currentUser?.role === 'STUDENT') {
        userRoleElem.style.display = 'none';
      } else {
        userRoleElem.style.display = 'inline-block';
        userRoleElem.textContent = currentUser?.role === 'ADMIN' ? '관리자' : '교사';
      }
    }
    if (userNameElem) {
      userNameElem.textContent = currentUser?.name || (currentUser?.role === 'ADMIN' ? '관리자' : '교사');
    }

    const tabDaily = document.getElementById('tab-btn-daily');
    const tabBase = document.getElementById('tab-btn-base');
    const tabTeacher = document.getElementById('tab-btn-teacher');
    const tabGen = document.getElementById('tab-btn-generator');
    const btnSettings = document.getElementById('btn-settings-toggle');
    const btnMainResets = document.querySelectorAll('.btn-main-reset');
    
    if (currentUser?.role === 'TEACHER') {
      if (tabDaily) {
        tabDaily.style.display = 'inline-block';
        tabDaily.textContent = '📅 학급 시간표';
      }
      if (tabBase) tabBase.style.display = 'none';
      if (tabTeacher) {
        tabTeacher.style.display = 'inline-block';
        tabTeacher.textContent = '👩‍🏫 자기 수업 시간표';
      }
      if (tabGen) tabGen.style.display = 'none';
      if (btnSettings) btnSettings.style.display = 'inline-block';
      btnMainResets.forEach(btn => btn.style.display = 'none');
      
      // Default to Teacher timetable or class timetable if active tab is restricted
      if (activeTab === 'BASE' || activeTab === 'GENERATOR') {
        switchTab('DAILY');
      }
    } else if (currentUser?.role === 'STUDENT') {
      const classFilterGroup = document.getElementById('class-filter-group');
      const timetableTabs = document.querySelector('.timetable-tabs');
      const weekDateSubtext = document.getElementById('week-date-subtext');
      const btnDailyAll = document.getElementById('btn-daily-all');
      const btnResetDailyChanges = document.getElementById('btn-reset-daily-changes');

      if (classFilterGroup) classFilterGroup.style.display = 'none';
      if (timetableTabs) timetableTabs.style.display = 'none';
      if (weekDateSubtext) weekDateSubtext.style.display = 'none';
      if (btnDailyAll) btnDailyAll.style.display = 'none';
      if (btnResetDailyChanges) btnResetDailyChanges.style.display = 'none';

      if (tabBase) tabBase.style.display = 'none';
      if (tabTeacher) tabTeacher.style.display = 'none';
      if (tabGen) tabGen.style.display = 'none';
      if (btnSettings) btnSettings.style.display = 'none';
      
      if (activeTab !== 'DAILY') {
        switchTab('DAILY');
      }
    } else {
      if (tabDaily) {
        tabDaily.style.display = 'inline-block';
        tabDaily.textContent = '📅 일자별 시간표';
      }
      if (tabBase) tabBase.style.display = 'inline-block';
      if (tabTeacher) {
        tabTeacher.style.display = 'inline-block';
        tabTeacher.textContent = '👩‍🏫 교사 시간표';
      }
      if (tabGen) tabGen.style.display = 'inline-block';
      if (btnSettings) btnSettings.style.display = 'inline-block';
    }

    // 1~10교시 그리드 즉시 항시 렌더링
    renderGrid([], 'CLASS');

    await loadSchoolMetadata();
  } catch (err) {
    console.error('showDashboard error:', err);
    renderGrid([], 'CLASS');
  }
}

// Render Classes Table
function renderAdminClassesTable() {
  const cTableBody = document.getElementById('admin-classes-table-body');
  if (!cTableBody) return;
  cTableBody.innerHTML = '';

  const gradeClasses = currentSchoolMeta?.gradeClasses || [];
  const teachers = currentSchoolMeta?.teachers || [];

  if (gradeClasses.length === 0) {
    cTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-sub); padding:1rem;">등록된 학년/학급이 없습니다. 상단 [학급 생성/수정 저장]에서 학년과 반을 등록해주세요.</td></tr>`;
    return;
  }

  gradeClasses.forEach(c => {
    const tr = document.createElement('tr');
    
    let optionsHtml = '<option value="">담임 미지정</option>';
    teachers.forEach(t => {
      const isSelected = t.id === c.homeroom_teacher_id ? 'selected' : '';
      optionsHtml += `<option value="${t.id}" ${isSelected}>${t.name} (${t.subject_name || '과목없음'})</option>`;
    });

    tr.innerHTML = `
      <td><strong>${c.grade}학년</strong></td>
      <td><strong>${c.class_number}반</strong></td>
      <td>
        <select id="class-homeroom-${c.id}" class="form-select" style="padding: 4px 8px; font-size: 0.9em; height: auto;" onchange="updateClassHomeroom('${c.id}', ${c.grade}, ${c.class_number})">
          ${optionsHtml}
        </select>
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-sm btn-outline" style="border-color:var(--danger-color); color:var(--danger-color); padding:0.25rem 0.6rem; border-radius:4px; font-weight:600;" onclick="deleteClass('${c.id}')">삭제</button>
      </td>
    `;
    cTableBody.appendChild(tr);
  });
}
window.renderAdminClassesTable = renderAdminClassesTable;

// Load Metadata
async function loadSchoolMetadata() {
  if (!currentUser || !currentUser.schoolId) return;
  try {
    const res = await fetch(`${API_BASE}/schools/${currentUser.schoolId}/meta`);
    if (!res.ok) return;
    currentSchoolMeta = await res.json();

    if (currentSchoolMeta && currentSchoolMeta.gradeClasses && filterGradeSelect && filterClassSelect) {
      const updateClassOptions = () => {
        const selectedGrade = filterGradeSelect.value;
        filterClassSelect.innerHTML = '';
        const filteredClasses = currentSchoolMeta.gradeClasses.filter(gc => String(gc.grade) === selectedGrade);
        filteredClasses.forEach(gc => {
          const opt = document.createElement('option');
          opt.value = `${gc.class_number}`;
          opt.dataset.id = gc.id;
          opt.textContent = `${gc.class_number}반 (${gc.homeroom_teacher_name ? gc.homeroom_teacher_name + ' 선생님' : '공석'})`;
          filterClassSelect.appendChild(opt);
        });
      };
      
      // Update class options dropdown when grade changes (do NOT auto-load timetable)
      filterGradeSelect.addEventListener('change', () => {
        updateClassOptions();
      });
      
      // Initialize class options
      updateClassOptions();
    }

    // Populate Teacher Title Dropdown
    if (teacherTitleSelect) {
      teacherTitleSelect.innerHTML = '';
      const defTeacherOpt = document.createElement('option');
      defTeacherOpt.value = '';
      defTeacherOpt.textContent = '교사 선택';
      teacherTitleSelect.appendChild(defTeacherOpt);

      if (currentSchoolMeta.teachers) {
        const groupMap = new Map();
        currentSchoolMeta.teachers.forEach(t => {
          const tName = (t.name || '').trim();
          if (!tName) return;
          if (!groupMap.has(tName)) {
            groupMap.set(tName, {
              name: tName,
              ids: [t.id],
              subjects: [t.subject_name || t.subjectName].filter(Boolean)
            });
          } else {
            const grp = groupMap.get(tName);
            grp.ids.push(t.id);
            const sub = t.subject_name || t.subjectName;
            if (sub && !grp.subjects.includes(sub)) {
              grp.subjects.push(sub);
            }
          }
        });

        groupMap.forEach((grp) => {
          const opt = document.createElement('option');
          opt.value = grp.name;
          opt.textContent = `${grp.name} (${grp.subjects.join(', ') || '과목미정'})`;
          teacherTitleSelect.appendChild(opt);
        });
      }

      if (currentUser?.role === 'TEACHER') {
        const curName = (currentUser.name || currentUser.teacherName || '').trim();
        const opts = Array.from(teacherTitleSelect.options);
        const matchOpt = opts.find(o => o.value === curName || o.value.split(',').includes(String(currentUser.teacherId)));
        if (matchOpt) {
          teacherTitleSelect.value = matchOpt.value;
        }
      }
    }

    if (classSetupHomeroom) {
      classSetupHomeroom.innerHTML = '';
      
      // Add default empty option for homeroom selection
      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '담임 없음';
      classSetupHomeroom.appendChild(optNone);

      if (currentSchoolMeta.teachers) {
        currentSchoolMeta.teachers.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = `${t.name} (${t.subject_name || '과목'})`;
          
          if (typeof teacherSelect !== 'undefined' && teacherSelect) {
            teacherSelect.appendChild(opt);
          }

          // Also copy to classSetupHomeroom dropdown
          const optHr = opt.cloneNode(true);
          if (classSetupHomeroom) classSetupHomeroom.appendChild(optHr);
        });
      }
    }

    // Populate Modal Selects
    if (changeSubjectSelect && currentSchoolMeta.subjects) {
      changeSubjectSelect.innerHTML = '';
      currentSchoolMeta.subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        changeSubjectSelect.appendChild(opt);
      });
    }

    if (changeTeacherSelect && currentSchoolMeta.teachers) {
      changeTeacherSelect.innerHTML = '';
      currentSchoolMeta.teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.subject_name || ''})`;
        changeTeacherSelect.appendChild(opt);
      });
    }

    // Refresh pending requests if visible
    if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
      try { await loadPendingUsers(); } catch(e){}
      try { if (typeof loadApprovedStudents === 'function') loadApprovedStudents(); } catch(e){}
    }

    // Render Teachers Table
    const tTableBody = document.getElementById('admin-teachers-table-body');
    if (tTableBody) {
      tTableBody.innerHTML = '';
      if (!currentSchoolMeta.teachers || currentSchoolMeta.teachers.length === 0) {
        tTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-sub); padding:1rem;">등록된 교사가 없습니다.</td></tr>`;
      } else {
        currentSchoolMeta.teachers.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><input type="text" class="form-input" id="teacher-name-${t.id}" value="${t.name}" style="padding: 4px; font-size: 0.9em;"></td>
            <td><input type="text" class="form-input" id="teacher-subject-${t.id}" value="${t.subject_name || ''}" style="padding: 4px; font-size: 0.9em;" placeholder="과목 입력"></td>
            <td><input type="text" class="form-input" id="teacher-email-${t.id}" value="${t.email || ''}" style="padding: 4px; font-size: 0.9em;" placeholder="아이디 생성"></td>
            <td><input type="text" class="form-input" id="teacher-pwd-${t.id}" value="${t.password_hash || ''}" style="padding: 4px; font-size: 0.9em;" placeholder="비밀번호 설정"></td>
            <td style="text-align:center; white-space: nowrap;">
              <button class="btn btn-sm btn-outline" style="border-color:var(--primary-color); color:var(--primary-color); margin-right: 4px;" onclick="updateTeacherCredentials('${t.id}', '${t.code || ''}')">수정</button>
              <button class="btn btn-sm btn-outline" style="border-color:var(--danger-color); color:var(--danger-color);" onclick="deleteTeacher('${t.id}')">삭제</button>
            </td>
          `;
          tTableBody.appendChild(tr);
        });
      }
    }

    // Render Classes Table
    renderAdminClassesTable();

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
      await loadSchoolMetadata();
    } else {
      alert('학급 삭제 실패');
    }
  } catch (err) {
    console.error(err);
  }
};

window.deleteAllClasses = async function() {
  if (!confirm('🚨 경고: 학교의 모든 학년/학급 및 연관된 시간표 데이터가 영구 삭제됩니다. 정말로 전체 삭제하시겠습니까?')) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/admin/classes?ids=ALL_CLASSES&schoolId=${currentUser.schoolId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      alert('모든 학급 데이터가 성공적으로 삭제되었습니다.');
      await loadSchoolMetadata();
    } else {
      alert('전체 삭제 처리에 실패했습니다.');
    }
  } catch (err) {
    console.error(err);
    alert('서버 통신 오류가 발생했습니다.');
  }
};

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

window.updateTeacherCredentials = async function(teacherId, code) {
  const nameVal = document.getElementById(`teacher-name-${teacherId}`).value.trim();
  const subVal = document.getElementById(`teacher-subject-${teacherId}`).value.trim();
  const emailVal = document.getElementById(`teacher-email-${teacherId}`).value.trim();
  const pwdVal = document.getElementById(`teacher-pwd-${teacherId}`).value.trim();

  if (!nameVal) {
    alert('교사명을 입력해주세요.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: teacherId,
        schoolId: currentUser.schoolId,
        name: nameVal,
        code: code || nameVal.slice(0, 2),
        subjectName: subVal,
        email: emailVal,
        password: pwdVal
      })
    });
    const data = await res.json();
    if (res.ok) {
      alert('성공적으로 수정되었습니다.');
      await loadSchoolMetadata();
    } else {
      alert(data.error || '수정 실패');
    }
  } catch (err) {
    console.error(err);
    alert('수정 중 오류 발생');
  }
};

window.updateClassHomeroom = async function(classId, grade, classNumber) {
  const selectElem = document.getElementById(`class-homeroom-${classId}`);
  const homeroomTeacherId = selectElem.value || null;

  try {
    const res = await fetch(`${API_BASE}/admin/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: classId,
        schoolId: currentUser.schoolId,
        grade,
        classNumber,
        homeroomTeacherId
      })
    });
    if (res.ok) {
      alert('담임 교사가 성공적으로 수정되었습니다.');
      await loadSchoolMetadata();
    } else {
      alert('담임 교사 수정 실패');
    }
  } catch (err) {
    console.error(err);
    alert('수정 중 오류 발생');
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
    
    const isTeacher = currentUser?.role === 'TEACHER';
    const cardPending = document.getElementById('card-pending-approvals');
    const cardTeacherSetup = document.getElementById('card-teacher-setup');
    const cardClassSetup = document.getElementById('card-class-setup');
    const cardApprovedStudents = document.getElementById('card-approved-students');
    const cardTeacherMgmt = document.getElementById('card-teacher-management');
    const cardClassMgmt = document.getElementById('card-class-management');
    const cardAccount = document.getElementById('card-account-settings');
    const cardHolidays = document.getElementById('card-holidays-manager');

    if (isTeacher) {
      if (cardPending) cardPending.style.display = 'block';
      if (cardTeacherSetup) cardTeacherSetup.style.display = 'none';
      if (cardClassSetup) cardClassSetup.style.display = 'none';
      if (cardApprovedStudents) cardApprovedStudents.style.display = 'block';
      if (cardTeacherMgmt) cardTeacherMgmt.style.display = 'none';
      if (cardClassMgmt) cardClassMgmt.style.display = 'block';
      if (cardAccount) cardAccount.style.display = 'none';
      if (cardHolidays) cardHolidays.style.display = 'none';
    } else {
      if (cardPending) cardPending.style.display = 'block';
      if (cardTeacherSetup) cardTeacherSetup.style.display = 'block';
      if (cardClassSetup) cardClassSetup.style.display = 'block';
      if (cardApprovedStudents) cardApprovedStudents.style.display = 'block';
      if (cardTeacherMgmt) cardTeacherMgmt.style.display = 'block';
      if (cardClassMgmt) cardClassMgmt.style.display = 'block';
      if (cardAccount) cardAccount.style.display = 'block';
      if (cardHolidays) cardHolidays.style.display = 'block';
    }

    loadSchoolMetadata();
    loadPendingUsers();
    loadApprovedStudents();
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
    
    const studentsList = document.getElementById('pending-students-list');
    const teachersList = document.getElementById('pending-teachers-list');
    
    if (!studentsList || !teachersList) return;

    studentsList.innerHTML = '';
    teachersList.innerHTML = '';
    
    const students = users.filter(u => u.role === 'STUDENT');
    const teachers = users.filter(u => u.role === 'TEACHER');

    if (students.length === 0) {
      studentsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-sub);">대기 중인 승인 요청이 없습니다.</td></tr>`;
    } else {
      students.forEach(u => {
        const match = u.name.match(/^(.*?)\s*\((\d+)학년\s*(\d+)반\s*학생\)$/);
        const name = match ? match[1] : u.name;
        const grade = match ? match[2] + '학년' : '-';
        const classNum = match ? match[3] + '반' : '-';

        const tr = document.createElement('tr');
        tr.dataset.id = u.id;
        tr.innerHTML = `
          <td style="text-align:center;"><input type="checkbox" class="chk-pending-student"></td>
          <td>${grade}</td>
          <td>${classNum}</td>
          <td>${name}</td>
          <td><input type="text" class="form-input pending-email" value="${u.email}" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
          <td><input type="text" class="form-input pending-password" placeholder="변경 시 입력" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
        `;
        studentsList.appendChild(tr);
      });
    }

    if (teachers.length === 0) {
      teachersList.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-sub);">대기 중인 승인 요청이 없습니다.</td></tr>`;
    } else {
      teachers.forEach(u => {
        const match = u.name.match(/^(.*?)\s*\((.*?)\s*교사\)$/);
        const name = match ? match[1] : u.name;
        const subject = match ? match[2] : '-';

        const tr = document.createElement('tr');
        tr.dataset.id = u.id;
        tr.innerHTML = `
          <td style="text-align:center;"><input type="checkbox" class="chk-pending-teacher"></td>
          <td>${subject}</td>
          <td>${name}</td>
          <td><input type="text" class="form-input pending-email" value="${u.email}" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
          <td><input type="text" class="form-input pending-password" placeholder="변경 시 입력" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
        `;
        teachersList.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Load pending users error:', err);
  }
}

window.toggleAllPending = function(role, checkbox) {
  const cbs = document.querySelectorAll(`.chk-pending-${role.toLowerCase()}`);
  cbs.forEach(cb => cb.checked = checkbox.checked);
};

window.approveSelectedUsers = function(role) {
  processPendingUsers(role, 'APPROVED', false);
};

window.approveAllUsers = function(role) {
  processPendingUsers(role, 'APPROVED', true);
};

window.rejectSelectedUsers = function(role) {
  processPendingUsers(role, 'REJECTED', false);
};

async function processPendingUsers(role, status, all) {
  const listId = role === 'STUDENT' ? 'pending-students-list' : 'pending-teachers-list';
  const rows = document.querySelectorAll(`#${listId} tr[data-id]`);
  const updates = [];
  const userIds = [];

  rows.forEach(tr => {
    const cb = tr.querySelector(`.chk-pending-${role.toLowerCase()}`);
    if (all || (cb && cb.checked)) {
      const id = tr.dataset.id;
      userIds.push(id);
      
      const emailInput = tr.querySelector('.pending-email');
      const pwdInput = tr.querySelector('.pending-password');
      
      const updateData = { id };
      if (emailInput && emailInput.value) updateData.email = emailInput.value;
      if (pwdInput && pwdInput.value) updateData.password_hash = pwdInput.value;
      
      updates.push(updateData);
    }
  });

  if (userIds.length === 0) {
    alert('선택된 사용자가 없습니다.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/users/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, status, updates })
    });
    if (res.ok) {
      alert(`성공적으로 처리되었습니다.(${status})`);
      loadPendingUsers();
      if (status === 'APPROVED') {
        if (role === 'STUDENT') loadApprovedStudents();
        else loadTeachers();
      }
    } else {
      alert('요청 처리에 실패했습니다.');
    }
  } catch (err) {
    console.error('Approve user fetch error:', err);
  }
}

async function loadApprovedStudents() {
  try {
    const res = await fetch(`${API_BASE}/admin/students/approved?schoolId=${currentUser.schoolId}`);
    const students = await res.json();
    const listUI = document.getElementById('approved-students-list');
    listUI.innerHTML = '';

    if (students.length === 0) {
      listUI.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-sub);">가입된 학생이 없습니다.</td></tr>`;
      return;
    }

    students.forEach(s => {
      const nameMatch = s.name.match(/^(.*?)\s*\((\d+)학년\s*(\d+)반\s*학생\)$/);
      let actualName = s.name;
      let grade = '-';
      let classNum = '-';
      if (nameMatch) {
        actualName = nameMatch[1];
        grade = nameMatch[2];
        classNum = nameMatch[3];
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align:center;"><input type="checkbox" class="chk-student" value="${s.id}"></td>
        <td>${grade}</td>
        <td>${classNum}</td>
        <td>${actualName}</td>
        <td><input type="text" class="form-input" id="student-email-${s.id}" value="${s.email}" style="padding: 4px; font-size: 0.9em;"></td>
        <td><input type="text" class="form-input" id="student-pwd-${s.id}" value="${s.password_hash || ''}" style="padding: 4px; font-size: 0.9em;"></td>
        <td style="text-align:center; white-space: nowrap;">
          <button class="btn btn-sm btn-outline" style="border-color:var(--primary-color); color:var(--primary-color); margin-right: 4px;" onclick="updateStudent('${s.id}')">수정</button>
          <button class="btn btn-sm btn-outline" style="border-color:var(--danger-color); color:var(--danger-color);" onclick="deleteStudents(['${s.id}'])">삭제</button>
        </td>
      `;
      listUI.appendChild(tr);
    });
    
    const selectAllChk = document.getElementById('chk-select-all-students');
    if (selectAllChk) selectAllChk.checked = false;

  } catch (err) {
    console.error('Load approved students error:', err);
  }
}

window.updateStudent = async function(userId) {
  const emailElem = document.getElementById(`student-email-${userId}`);
  const pwdElem = document.getElementById(`student-pwd-${userId}`);
  
  if (!emailElem || !pwdElem) return;
  const email = emailElem.value.trim();
  const password = pwdElem.value.trim();
  
  if (!email || !password) {
    alert('아이디와 비밀번호를 모두 입력해주세요.');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      alert('성공적으로 수정되었습니다.');
      loadApprovedStudents();
    } else {
      alert(data.error || '수정 중 오류가 발생했습니다.');
    }
  } catch (err) {
    console.error('Update student error:', err);
    alert('수정 중 오류가 발생했습니다.');
  }
};

window.deleteStudents = async function(ids) {
  if (!confirm(`선택한 ${ids.length}명의 학생을 삭제하시겠습니까?`)) return;
  try {
    const res = await fetch(`${API_BASE}/admin/users?ids=${ids.join(',')}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      alert('성공적으로 삭제되었습니다.');
      loadApprovedStudents();
    } else {
      alert('삭제 처리 중 실패했습니다.');
    }
  } catch (err) {
    console.error('Delete students error:', err);
  }
};

async function handleTeacherSetup(e) {
  e.preventDefault();
  const payload = {
    schoolId: currentUser.schoolId,
    name: teacherSetupName.value,
    code: teacherSetupName.value.slice(0, 2),
    subjectName: teacherSetupSubject.value,
    email: document.getElementById('teacher-setup-email').value.trim(),
    password: document.getElementById('teacher-setup-password').value.trim()
  };
  try {
    const res = await fetch(`${API_BASE}/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      alert('선생님 정보가 정상적으로 저장되었습니다.');
      teacherSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      alert(data.error || '선생님 등록 실패');
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
      alert('🎉 학급 설정이 성공적으로 저장되었습니다.');
      classSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      let errorMsg = data.error || '학급 생성/수정 실패';
      if (typeof errorMsg === 'string' && errorMsg.includes('already exists')) {
        errorMsg = '⚠️ 이미 개설된 학년/반입니다. 아래 [🏫 학년/학급 생성 및 담임 관리] 목록에서 확인 및 수정이 가능합니다.';
      }
      alert(errorMsg);
    }
  } catch (err) {
    console.error(err);
    alert('서버 통신 오류가 발생했습니다.');
  }
}

function updateFiltersForTab(tabName) {
  if (tabName === 'TEACHER' || tabName === 'GENERATOR') {
    classFilterGroup.classList.add('hidden');
  } else {
    classFilterGroup.classList.remove('hidden');
  }
}

let teacherSubtab = 'BASE'; // 'BASE' or 'DAILY'

window.switchTeacherSubtab = function(tab) {
  teacherSubtab = tab;
  const btnBase = document.getElementById('teacher-subtab-base');
  const btnDaily = document.getElementById('teacher-subtab-daily');

  if (btnBase && btnDaily) {
    if (tab === 'BASE') {
      btnBase.style.background = 'var(--primary-color)';
      btnBase.style.color = '#ffffff';
      btnDaily.style.background = 'transparent';
      btnDaily.style.color = 'var(--primary-color)';
    } else {
      btnDaily.style.background = 'var(--primary-color)';
      btnDaily.style.color = '#ffffff';
      btnBase.style.background = 'transparent';
      btnBase.style.color = 'var(--primary-color)';
    }
  }

  loadTimetable();
};

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
      const teacherId = teacherTitleSelect.value;
      if (!teacherId) {
        weekDateSubtext.textContent = `기준주간 시작: -`;
        renderGrid([], mode);
        return;
      }
      const isTeacherBase = teacherSubtab === 'BASE';
      url = `${API_BASE}/timetable/teacher?schoolId=${currentUser.schoolId}&teacherId=${encodeURIComponent(teacherId)}&date=${dateVal}${isTeacherBase ? '&baseOnly=true' : ''}`;
    } else {
      mode = 'CLASS';
      let grade, classNum;
      if (currentUser?.role === 'STUDENT') {
        grade = currentUser.grade;
        classNum = currentUser.classNumber;
      } else {
        if (!filterGradeSelect.value || !filterClassSelect.value) {
          weekDateSubtext.textContent = `기준주간 시작: -`;
          renderGrid([], mode);
          return;
        }
        grade = filterGradeSelect.value;
        classNum = filterClassSelect.value;
      }
      url = `${API_BASE}/timetable/class?schoolId=${currentUser.schoolId}&grade=${grade}&classNumber=${classNum}&date=${dateVal}${baseParam}`;
      if (activeTab === 'BASE') {
        if (titleElemBase) titleElemBase.textContent = `🏫 ${grade}학년 ${classNum}반 기본 시간표 원본 설정`;
      } else {
        if (titleElemDaily) {
          if (currentUser?.role === 'STUDENT') {
            titleElemDaily.textContent = `📅 ${grade}학년 ${classNum}반 시간표`;
          } else {
            titleElemDaily.textContent = `📅 ${grade}학년 ${classNum}반 일자별 시간표`;
          }
        }
      }
    }

    const res = await fetch(url);
    const data = await res.json();

    // Patch data.timetable with window.sandboxChanges
    if (window.sandboxChanges && window.sandboxChanges.length > 0) {
      data.timetable = data.timetable.map(dayObj => {
        if (!dayObj.slots) return dayObj;
        return {
          ...dayObj,
          slots: dayObj.slots.map(slot => {
            const patch = window.sandboxChanges.find(p => 
              parseInt(p.period) === parseInt(slot.period) &&
              parseInt(p.dayOfWeek) === parseInt(slot.dayOfWeek) &&
              (p.gradeClassId === slot.gradeClassId || String(p.gradeClassId) === String(slot.gradeClassId)) &&
              p.targetDate === slot.targetDate
            );
            if (patch) {
              return {
                ...slot,
                subjectId: patch.subjectId,
                subjectName: patch.subjectName,
                teacherId: patch.teacherId,
                teacherName: patch.teacherName,
                isChanged: true,
                changeType: 'SUBSTITUTE'
              };
            }
            return slot;
          })
        };
      });
    }

    weekDateSubtext.textContent = `기준주간 시작: ${data.mondayDate}`;
    renderGrid(data.timetable, mode);
  } catch (err) {
    console.error('Timetable load error:', err);
  }
}

function switchTab(tabName) {
  if (activeTab === 'GENERATOR' && tabName !== 'GENERATOR' && window.isGenTableDirty) {
    if (!confirm('작업 중인 과목별 시수 및 교사 설정이 적용(저장)되지 않았습니다.\n적용을 누르지 않으면 작업 내용이 손실됩니다.\n정말 다른 메뉴로 이동하시겠습니까?')) {
      return;
    }
  }
  activeTab = tabName;
  updateFiltersForTab(tabName);

  const tabBtnDaily = document.getElementById('tab-btn-daily');
  const tabBtnTeacher = document.getElementById('tab-btn-teacher');
  const tabBtnGenerator = document.getElementById('tab-btn-generator');

  const contentDaily = document.getElementById('tab-content-daily');
  const contentTeacher = document.getElementById('tab-content-teacher');
  const contentGenerator = document.getElementById('tab-content-generator');

  [tabBtnDaily, tabBtnTeacher, tabBtnGenerator].forEach(btn => btn && btn.classList.remove('active'));
  [contentDaily, contentTeacher, contentGenerator].forEach(cnt => cnt && cnt.classList.add('hidden'));

  if (tabName === 'DAILY') {
    if (tabBtnDaily) tabBtnDaily.classList.add('active');
    if (contentDaily) contentDaily.classList.remove('hidden');
    datePicker.parentElement.style.display = 'flex';
  } else if (tabName === 'TEACHER') {
    if (tabBtnTeacher) tabBtnTeacher.classList.add('active');
    if (contentTeacher) contentTeacher.classList.remove('hidden');
    datePicker.parentElement.style.display = 'flex';
  } else if (tabName === 'GENERATOR') {
    if (tabBtnGenerator) tabBtnGenerator.classList.add('active');
    if (contentGenerator) contentGenerator.classList.remove('hidden');
    datePicker.parentElement.style.display = 'none';
    renderGrid([], 'CLASS');
    initGeneratorTab();
  }
}



function renderGrid(weeklyData, mode) {
  let targetBody = null;
  if (activeTab === 'DAILY') {
    targetBody = document.getElementById('timetable-body-daily');
  } else if (activeTab === 'TEACHER') {
    targetBody = document.getElementById('timetable-body-teacher');
  } else if (activeTab === 'GENERATOR') {
    targetBody = document.getElementById('timetable-body-gen');
  }

  if (!targetBody) return;
  targetBody.innerHTML = '';
  
  // Update table headers with dates
  const theadThs = targetBody.parentElement.querySelectorAll('thead th');
  if (theadThs.length === 6) {
    for (let d = 0; d < 5; d++) {
      if (weeklyData && weeklyData[d] && weeklyData[d].date) {
        const parts = weeklyData[d].date.split('-');
        const dateStr = `${parts[0]}년 ${parseInt(parts[1], 10)}월 ${parseInt(parts[2], 10)}일`;
        theadThs[d + 1].innerHTML = `${['월요일', '화요일', '수요일', '목요일', '금요일'][d]}<br><span style="font-size:0.85em;font-weight:normal;">(${dateStr})</span>`;
      } else {
        theadThs[d + 1].textContent = ['월', '화', '수', '목', '금'][d];
      }
    }
  }

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

        const isCancel = slot && slot.changeType === 'CANCEL';

        if (slot && slot.isChanged && !isCancel) {
          td.classList.add('is-changed');
          if (currentUser?.role !== 'STUDENT') {
            const badge = document.createElement('span');
            badge.className = 'change-badge';
            badge.textContent = slot.changeType === 'SUBSTITUTE' ? '변동' : '결강';
            td.appendChild(badge);
          }
        }

        // 수업 내용이 있거나(subjectName/gradeName), 변경/보강 이력이 있으면 표시 (CANCEL은 제외하여 완전한 빈 칸으로 표시)
        const hasContent = slot && (slot.subjectName || slot.gradeName || slot.teacherName);
        const hasChange = slot && slot.isChanged && !isCancel;

        if ((hasContent || hasChange) && !isCancel) {
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

        // Click event for editing slot (Disabled for STUDENTS)
        if (currentUser?.role === 'STUDENT') {
          td.style.cursor = 'default';
        } else {
          td.style.cursor = 'pointer';
          const targetDate = dayData ? dayData.date : null;
          td.addEventListener('click', () => openChangeModal(targetDate, dayOfWeek, p, slot, mode));
        }

        tr.appendChild(td);
      }
      targetBody.appendChild(tr);
    }
}

// Open Change Modal (일자별/기본 시간표 교시 셀 수동 클릭 수정)
function populateModalDropdowns(slot) {
  const subs = (currentSchoolMeta?.subjects?.length ? currentSchoolMeta.subjects : generatorData?.subjects) || [];
  const tchs = (currentSchoolMeta?.teachers?.length ? currentSchoolMeta.teachers : generatorData?.teachers) || [];

  if (changeTeacherSelect) {
    changeTeacherSelect.innerHTML = '<option value="">-- 해당 교시 교과 및 교사 선택 --</option>';
    changeTeacherSelect.innerHTML += tchs.map(t => {
      const subName = t.subject_name || t.subjectName || '';
      const isSelected = slot?.teacherId && String(slot.teacherId) === String(t.id);
      return `<option value="${t.id}" ${isSelected ? 'selected' : ''}>${t.name} (${subName})</option>`;
    }).join('');
  }

  // 모달 오픈 시 기존 배정 과목 ID 자동 연결
  if (slot?.teacherId && changeTeacherSelect && changeSubjectSelect) {
    const tch = tchs.find(t => String(t.id) === String(slot.teacherId));
    if (tch) {
      const subName = tch.subject_name || tch.subjectName;
      const sub = subs.find(s => s.name === subName);
      if (sub) changeSubjectSelect.value = sub.id;
    }
  }
}

// 모달 드롭다운 교사 선택 시 과목 ID 자동 연동
if (changeTeacherSelect) {
  changeTeacherSelect.addEventListener('change', (e) => {
    const selectedTchId = e.target.value;
    const subs = (currentSchoolMeta?.subjects?.length ? currentSchoolMeta.subjects : generatorData?.subjects) || [];
    const tchs = (currentSchoolMeta?.teachers?.length ? currentSchoolMeta.teachers : generatorData?.teachers) || [];
    const tch = tchs.find(t => String(t.id) === String(selectedTchId));
    if (tch && changeSubjectSelect) {
      const subName = tch.subject_name || tch.subjectName;
      const sub = subs.find(s => s.name === subName);
      if (sub) {
        changeSubjectSelect.value = sub.id;
      } else {
        changeSubjectSelect.value = '';
      }
    } else if (changeSubjectSelect) {
      changeSubjectSelect.value = '';
    }
  });
}

function openChangeModal(targetDate, dayOfWeek, period, slot, mode) {
  if (currentUser?.role === 'STUDENT') {
    return;
  }
  if (activeTab === 'TEACHER') {
    alert('👩‍🏫 교사 시간표 탭은 조회 전용입니다. 시간표 변경은 [일자별 시간표] 또는 [학기 기본 시간표] 탭에서 진행해주세요.');
    return;
  }

  let selectedGcId = null;
  let gradeStr = '1';
  let classNumStr = '1';

  if (filterGradeSelect && filterClassSelect) {
    gradeStr = filterGradeSelect.value || '1';
    classNumStr = filterClassSelect.value || '1';
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

  if (slotInfoSummary) {
    const curAssign = (slot && (slot.subjectName || slot.teacherName))
      ? `${slot.subjectName || ''} (${slot.teacherName || ''} 선생님)`
      : '배정 없음';

    slotInfoSummary.innerHTML = `
      <strong>[수업 생성 수정]</strong> ${gradeStr}학년 ${classNumStr}반 ${dayName}요일 ${period}교시<br>
      <strong>[현재 배정]</strong> ${curAssign}
    `;
  }

  // Reset form
  if (conflictAlert) conflictAlert.classList.add('hidden');
  pendingForcePayload = null;

  // 과목/교사 드롭다운 채우기
  populateModalDropdowns(slot);

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

  const changedTeacherId = changeTeacherSelect ? changeTeacherSelect.value : null;
  let changedSubjectId = changeSubjectSelect ? changeSubjectSelect.value : null;

  if (changedTeacherId && (!changedSubjectId || changedSubjectId === '')) {
    const subs = (currentSchoolMeta?.subjects?.length ? currentSchoolMeta.subjects : generatorData?.subjects) || [];
    const tchs = (currentSchoolMeta?.teachers?.length ? currentSchoolMeta.teachers : generatorData?.teachers) || [];
    const tch = tchs.find(t => String(t.id) === String(changedTeacherId));
    if (tch) {
      const subName = tch.subject_name || tch.subjectName;
      const sub = subs.find(s => s.name === subName);
      if (sub) changedSubjectId = sub.id;
    }
  }

  if (activeTab === 'GENERATOR') {
    const { gradeClassId, dayOfWeek, period } = selectedSlotData;
    if (!genClassMap) genClassMap = {};
    if (!genClassMap[gradeClassId]) genClassMap[gradeClassId] = {};

    const subObj = (generatorData?.subjects || currentSchoolMeta?.subjects || []).find(s => s.id === changedSubjectId);
    const tchObj = (generatorData?.teachers || currentSchoolMeta?.teachers || []).find(t => t.id === changedTeacherId);

    const subjectName = subObj ? subObj.name : '';
    const teacherName = tchObj ? tchObj.name : '';

    if (!changedSubjectId || !changedTeacherId || changedSubjectId === 'DELETE') {
      if (genClassMap[gradeClassId]?.[dayOfWeek]) {
        delete genClassMap[gradeClassId][dayOfWeek][period];
      }
      if (generatedResult) {
        generatedResult = generatedResult.filter(r => !(r.gradeClassId === gradeClassId && r.dayOfWeek === dayOfWeek && r.period === period));
      }
    } else {
      // 1. 교사 다른 학년/반 중복 배정 검사 (모든 학년/반 검사)
      let teacherConflict = null;
      Object.keys(genClassMap).forEach(gcId => {
        if (gcId !== gradeClassId && genClassMap[gcId]?.[dayOfWeek]?.[period]) {
          const otherSlot = genClassMap[gcId][dayOfWeek][period];
          if (otherSlot.teacherId === changedTeacherId) {
            const otherGc = (generatorData?.classes || currentSchoolMeta?.gradeClasses || []).find(c => c.id === gcId);
            const otherGcName = otherGc ? `${otherGc.grade}학년 ${otherGc.class_number || otherGc.classNumber}반` : gcId;
            const tchName = otherSlot.teacherName || teacherName || '해당 교사';
            const daysKor = ['일', '월', '화', '수', '목', '금', '토'];
            teacherConflict = `❌ [교사 중복 배정 오류] ${tchName} 선생님은 ${daysKor[dayOfWeek]}요일 ${period}교시에 이미 [${otherGcName}] 수업에 배정되어 있습니다!`;
          }
        }
      });

      if (teacherConflict) {
        if (conflictList) {
          conflictList.innerHTML = `<li>${teacherConflict}</li>`;
        }
        if (conflictAlert) conflictAlert.classList.remove('hidden');
        alert(teacherConflict);
        return;
      }

      // 2. 동일 과목 하루 중복 연속배정 경고
      let sameSubjToday = 0;
      if (genClassMap[gradeClassId]?.[dayOfWeek]) {
        Object.keys(genClassMap[gradeClassId][dayOfWeek]).forEach(p => {
          if (parseInt(p) !== parseInt(period) && genClassMap[gradeClassId][dayOfWeek][p]?.subjectId === changedSubjectId) {
            sameSubjToday++;
          }
        });
      }
      if (sameSubjToday >= 2) {
        const warnMsg = `⚠️ [동일 과목 중복 경고] 하루에 [${subjectName}] 과목이 이미 2시간 이상 배정되어 있습니다. 추가 배치하시겠습니까?`;
        if (!confirm(warnMsg)) return;
      }

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
    }

    if (changeModal) changeModal.classList.add('hidden');
    const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
    renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
    return;
  }

  if (activeTab === 'BASE') {
    const isDelete = (changedSubjectId === 'DELETE');
    const payload = {
      schoolId: currentUser.schoolId,
      gradeClassId: selectedSlotData.gradeClassId,
      dayOfWeek: selectedSlotData.dayOfWeek,
      period: selectedSlotData.period,
      subjectId: isDelete ? null : changedSubjectId,
      teacherId: isDelete ? null : changedTeacherId,
      force: false
    };
    try {
      const res = await fetch(`${API_BASE}/admin/base-timetable`, {
        method: isDelete ? 'DELETE' : 'POST',
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
  const isTeacher = currentUser?.role === 'TEACHER';
  const isDelete = (changedSubjectId === 'DELETE');
  const payload = {
    schoolId: currentUser.schoolId,
    targetDate: selectedSlotData.targetDate || new Date().toISOString().split('T')[0],
    period: selectedSlotData.period,
    gradeClassId: selectedSlotData.gradeClassId,
    changeType: isDelete ? 'CANCEL' : 'SUBSTITUTE',
    changedTeacherId: isDelete ? null : changedTeacherId,
    changedSubjectId: isDelete ? null : changedSubjectId,
    changedRoomId: null,
    reason: isTeacher ? '[교사 테스트] 시간표 ' + (isDelete ? '해당 교시 삭제' : '모의 수업 교체') : '일과계 시간표 ' + (isDelete ? '해당 교시 삭제' : '조정'),
    createdBy: currentUser.name || '관리자',
    force: false,
    sandbox: isTeacher
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
      if (isTeacher) {
        window.sandboxChanges = window.sandboxChanges || [];
        window.sandboxChanges = window.sandboxChanges.filter(p =>
          !(parseInt(p.period) === parseInt(selectedSlotData.period) &&
            parseInt(p.dayOfWeek) === parseInt(selectedSlotData.dayOfWeek) &&
            String(p.gradeClassId) === String(selectedSlotData.gradeClassId) &&
            p.targetDate === selectedSlotData.targetDate)
        );
        window.sandboxChanges.push({
          gradeClassId: selectedSlotData.gradeClassId,
          targetDate: selectedSlotData.targetDate,
          dayOfWeek: selectedSlotData.dayOfWeek,
          period: selectedSlotData.period,
          subjectId: changedSubjectId,
          subjectName: currentSchoolMeta.subjects.find(s => s.id === changedSubjectId)?.name || '',
          teacherId: changedTeacherId,
          teacherName: currentSchoolMeta.teachers.find(t => t.id === changedTeacherId)?.name || ''
        });
        alert('🎉 [시뮬레이션 모드] 시간표 변경이 임시 적용되었습니다! (서버 데이터에는 영향이 없으며, 로그아웃 또는 새로고침 시 원래대로 돌아갑니다)');
      } else {
        alert('🎉 수업 변경/보강이 성공적으로 저장 및 적용되었습니다!');
      }
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

  if (payload.mode === 'generatorForce') {
    const tc = window.genCurrentClassId;
    const cgc = payload.conflictGcId;
    const d = payload.dayOfWeek;
    const p = payload.period;
    
    if (genClassMap[cgc] && genClassMap[cgc][d] && genClassMap[cgc][d][p]) {
      delete genClassMap[cgc][d][p];
    }
    
    if (!genClassMap[tc]) genClassMap[tc] = {};
    if (!genClassMap[tc][d]) genClassMap[tc][d] = {};
    
    genClassMap[tc][d][p] = {
      gradeClassId: tc,
      dayOfWeek: d,
      period: p,
      subjectId: payload.subjectId,
      teacherId: payload.teacherId,
      isFixed: true
    };
    
    renderGenGrid(tc, window.generatorData.maxPeriodsPerDay);
    return;
  }

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
      if (currentUser?.role === 'TEACHER') {
        window.sandboxChanges = window.sandboxChanges || [];
        const dayVal = payload.dayOfWeek !== undefined ? payload.dayOfWeek : (new Date(payload.targetDate).getDay());
        window.sandboxChanges = window.sandboxChanges.filter(p =>
          !(parseInt(p.period) === parseInt(payload.period) &&
            parseInt(p.dayOfWeek) === parseInt(dayVal) &&
            String(p.gradeClassId) === String(payload.gradeClassId) &&
            p.targetDate === payload.targetDate)
        );
        window.sandboxChanges.push({
          gradeClassId: payload.gradeClassId,
          targetDate: payload.targetDate,
          dayOfWeek: dayVal,
          period: payload.period,
          subjectId: payload.changedSubjectId,
          subjectName: currentSchoolMeta.subjects.find(s => s.id === payload.changedSubjectId)?.name || '',
          teacherId: payload.changedTeacherId,
          teacherName: currentSchoolMeta.teachers.find(t => t.id === payload.changedTeacherId)?.name || ''
        });
        alert('🎉 [시뮬레이션 모드] 충돌을 무시하고 임시 강제 적용되었습니다! (서버 데이터에는 영향이 없으며, 로그아웃 또는 새로고침 시 원래대로 돌아갑니다)');
      } else {
        alert(isBase ? '기본 시간표가 저장되었습니다.' : '시간표 변경이 적용되었습니다.');
      }
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
    // 기본 빈 그리드 표출 (선택된 최대 교시 기준)
    const maxPeriodSelect = document.getElementById('gen-max-period-select');
    const defaultMaxPeriods = maxPeriodSelect ? parseInt(maxPeriodSelect.value) : 10;
    renderGenGrid(null, defaultMaxPeriods);

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

    // Auto-load base timetable if there is no saved state, to prevent wiping data on partial edits.
    // Check localStorage directly so we don't overwrite a user's in-progress (or explicitly cleared) generator state.
    const hasSavedState = localStorage.getItem('genResult') !== null;
    if (!generatedResult && !hasSavedState) {
      try {
        const btRes = await fetch(API_BASE + '/admin/base-timetable-all?schoolId=' + currentUser.schoolId);
        if (btRes.ok) {
          const btData = await btRes.json();
          if (btData && btData.length > 0) {
            generatedResult = [...btData];
            genClassMap = {};
            const loadedClassIds = new Set();
            btData.forEach(item => {
              loadedClassIds.add(item.gradeClassId);
              if (!genClassMap[item.gradeClassId]) genClassMap[item.gradeClassId] = {};
              if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
              genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
            });
            window.activeGenClassIds = Array.from(loadedClassIds);
            localStorage.setItem('genSelectedClassIds', JSON.stringify(window.activeGenClassIds));
            localStorage.setItem('genClassMap', JSON.stringify(genClassMap));
            localStorage.setItem('genResult', JSON.stringify(generatedResult));
          }
        }
      } catch (e) {
        console.warn('Failed to auto-load base timetable:', e);
      }
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

    // 모든 등록된 교사의 과목명이 과목 선택 목록(subjects)에 100% 누락 없이 들어가도록 자동 융합 (sports 제외)
    if (generatorData && generatorData.teachers && generatorData.subjects) {
      generatorData.subjects = generatorData.subjects.filter(s => (s.name || '').toLowerCase() !== 'sports');
      const existingSubNames = new Set(generatorData.subjects.map(s => s.name));
      generatorData.teachers.forEach(t => {
        const subName = (t.subject_name || t.subjectName || '').trim();
        if (subName && subName !== '미지정' && subName.toLowerCase() !== 'sports' && !existingSubNames.has(subName)) {
          const newSub = { id: `sub-gen-${t.id}`, name: subName };
          generatorData.subjects.push(newSub);
          existingSubNames.add(subName);
        }
      });
      // 과목명 순 정렬
      generatorData.subjects.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }

    // 과목 필터 체크박스 렌더링 (2번 과목/교사 설정표에 등록된 과목과 실시간 연동)
    window.renderGenSubjectFilter = function() {
      const container = document.getElementById('gen-subject-filter-container');
      if (!container) return;
      
      const configuredSubMap = new Map();
      document.querySelectorAll('.gen-row').forEach(row => {
        const subSel = row.querySelector('.gen-subject-select');
        if (subSel && subSel.value) {
          const subId = subSel.value;
          const subObj = (generatorData?.subjects || []).find(s => String(s.id) === String(subId));
          const subName = subObj ? subObj.name : (subSel.options[subSel.selectedIndex]?.text || subId);
          if (subName && subName !== '-- 선택 --') {
            configuredSubMap.set(subId, subName);
          }
        }
      });

      const subs = Array.from(configuredSubMap.entries()).map(([id, name]) => ({ id, name }));
      
      if (subs.length === 0) {
        container.innerHTML = '<span style="color:var(--text-sub); font-size:0.88rem;">[② 과목별 주간 시수 및 담당 교사 설정]에서 과목을 생성해 주세요.</span>';
        return;
      }

      const savedFilters = localStorage.getItem('gen_subject_filter_' + currentUser.schoolId);
      let checkedSet = null;
      if (savedFilters) {
        try { checkedSet = new Set(JSON.parse(savedFilters)); } catch(e){}
      }

      container.innerHTML = subs.map(s => {
        const isChecked = checkedSet ? checkedSet.has(s.id) : true;
        return `
          <label style="display:inline-flex; align-items:center; gap:0.35rem; background:var(--bg-card); padding:0.3rem 0.65rem; border-radius:6px; border:1px solid var(--border-color); cursor:pointer; user-select:none; font-size:0.88rem;">
            <input type="checkbox" class="gen-subject-chk" value="${s.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer;" onchange="saveGenSubjectFilters()">
            <span style="font-weight:600; color:var(--text-main);">${s.name}</span>
          </label>
        `;
      }).join('');
    };

    window.saveGenSubjectFilters = function() {
      const checkedIds = Array.from(document.querySelectorAll('.gen-subject-chk:checked')).map(c => c.value);
      localStorage.setItem('gen_subject_filter_' + currentUser.schoolId, JSON.stringify(checkedIds));
    };

    window.selectAllGenSubjectFilters = function(checked) {
      document.querySelectorAll('.gen-subject-chk').forEach(chk => {
        chk.checked = checked;
      });
      window.saveGenSubjectFilters();
    };

    renderGenSubjectFilter();

    // ① 생성된 학급 박스 렌더링 및 상태 관리
    window.activeGenClassIds = classesList.map(c => c.id);
    const savedGenClassesStr = localStorage.getItem('genSelectedClassIds');
    if (savedGenClassesStr) {
      try {
        const parsed = JSON.parse(savedGenClassesStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          window.activeGenClassIds = parsed;
        }
      } catch(e){}
    }
    if (!genCurrentClassId && window.activeGenClassIds.length > 0) {
      genCurrentClassId = window.activeGenClassIds[0];
    }

    window.renderCreatedClassBadges = function() {
      const box = document.getElementById('gen-class-list-box');
      if (!box) return;

      if (!window.activeGenClassIds || window.activeGenClassIds.length === 0) {
        box.innerHTML = '<span style="font-size:0.88rem; color:var(--text-sub);">등록된 학급이 없습니다. 상단에서 학년과 반을 선택 후 [생성] 버튼을 눌러주세요.</span>';
        return;
      }

      box.innerHTML = window.activeGenClassIds.map(gcId => {
        const gc = classesList.find(c => c.id === gcId);
        const gcName = gc ? `${gc.grade}학년 ${gc.class_number || gc.classNumber}반` : gcId;
        const isSelected = gcId === genCurrentClassId;
        return `
          <span class="gen-class-badge" style="display:inline-flex; align-items:center; gap:0.4rem; background:${isSelected ? 'var(--primary-color)' : 'var(--bg-card)'}; color:${isSelected ? '#ffffff' : 'var(--text-main)'}; padding:0.35rem 0.75rem; border-radius:20px; border:1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}; font-weight:700; font-size:0.88rem; cursor:pointer; user-select:none; transition:all 0.2s;">
            <span onclick="window.selectActiveGenClass('${gcId}')">${gcName}</span>
            <span onclick="event.stopPropagation(); window.removeActiveGenClass('${gcId}')" style="font-size:0.9rem; opacity:0.8; margin-left:0.2rem; cursor:pointer;" title="목록에서 삭제">&times;</span>
          </span>
        `;
      }).join('');
    };

    window.selectActiveGenClass = function(gcId) {
      if (window.isGenTableDirty && genCurrentClassId && genCurrentClassId !== gcId) {
        if (!confirm('작업 중인 과목별 시수 및 교사 설정이 [적용]되지 않았습니다.\n[적용] 버튼을 누르지 않고 이동하면 수정 사항이 모두 손실됩니다.\n정말 다른 학급으로 이동하시겠습니까?')) {
          return;
        }
      }
      genCurrentClassId = gcId;
      window.isGenTableDirty = false;

      // 학급 칩 클릭 시 이전 학급 정보가 남지 않도록 빈 상태(또는 저장된 상태)를 명확히 로드합니다.
      if (window.loadClassHours) {
        window.loadClassHours(gcId);
      } else {
        const body = document.getElementById('gen-subject-body');
        if (body) body.innerHTML = '';
        if (window.renderGenSubjectFilter) window.renderGenSubjectFilter();
      }

      window.renderCreatedClassBadges();
      buildPreviewChips(window.activeGenClassIds);
      const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
      if (typeof renderGenGrid === 'function') {
        renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
      }
    };

    window.removeActiveGenClass = function(gcId) {
      window.activeGenClassIds = (window.activeGenClassIds || []).filter(id => id !== gcId);
      localStorage.setItem('genSelectedClassIds', JSON.stringify(window.activeGenClassIds));
      if (genCurrentClassId === gcId) {
        genCurrentClassId = window.activeGenClassIds.length > 0 ? window.activeGenClassIds[0] : null;
      }
      window.renderCreatedClassBadges();
      buildPreviewChips(window.activeGenClassIds);
      const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
      renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
    };

    window.renderCreatedClassBadges();
    buildPreviewChips(window.activeGenClassIds);
    
    const btnAddClass = document.getElementById('btn-gen-add-class');
    if (btnAddClass) {
      const newBtnAddClass = btnAddClass.cloneNode(true);
      btnAddClass.parentNode.replaceChild(newBtnAddClass, btnAddClass);
      
      newBtnAddClass.addEventListener('click', () => {
        const grade = document.getElementById('gen-grade-select').value;
        const classNum = document.getElementById('gen-class-select').value;
        
        const classObj = classesList.find(c => String(c.grade) === String(grade) && (String(c.class_number) === String(classNum) || String(c.classNumber) === String(classNum)));
        
        if (!classObj) {
          alert(`${grade}학년 ${classNum}반은 학교 설정에 등록되어 있지 않습니다. [⚙️ 학교/교사 설정] 탭에서 먼저 반을 등록해주세요.`);
          return;
        }

        if (!window.activeGenClassIds.includes(classObj.id)) {
          window.activeGenClassIds.push(classObj.id);
          localStorage.setItem('genSelectedClassIds', JSON.stringify(window.activeGenClassIds));
        }

        window.selectActiveGenClass(classObj.id);
      });
    }

    const btnView = document.getElementById('btn-gen-view');
    if (btnView) {
      const targetDropdown = document.getElementById('gen-class-list-select');
      btnView.addEventListener('click', async () => {
        const selectedGcId = targetDropdown.value;
        if (!selectedGcId) return;

        if (window.isGenTableDirty) {
          if (!confirm('설정하신 시수 및 교사 작업이 적용(저장)되지 않았습니다.\n이대로 이동하면 설정이 유실됩니다.\n다른 학급으로 이동하여 조회하시겠습니까?')) {
            targetDropdown.value = genCurrentClassId;
            return;
          }
        }

                genCurrentClassId = selectedGcId;

        // If no local data exists for this class, fetch from DB
        if (!genClassMap[selectedGcId] || Object.keys(genClassMap[selectedGcId]).length === 0) {
          try {
            const btRes = await fetch(API_BASE + '/admin/base-timetable-all?schoolId=' + currentUser.schoolId);
            if (btRes.ok) {
              const btData = await btRes.json();
              const classData = btData.filter(item => item.gradeClassId === selectedGcId);
              if (classData.length > 0) {
                if (!genClassMap[selectedGcId]) genClassMap[selectedGcId] = {};
                classData.forEach(item => {
                  if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
                  genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
                });
                if (!generatedResult) generatedResult = [];
                generatedResult = generatedResult.filter(r => r.gradeClassId !== selectedGcId);
                generatedResult.push(...classData);
                localStorage.setItem('genClassMap', JSON.stringify(genClassMap));
                localStorage.setItem('genResult', JSON.stringify(generatedResult));
              }
            }
          } catch (e) {
            console.error('Failed to load class from DB', e);
          }
        }

        if (window.loadClassHours) {
          window.loadClassHours(selectedGcId);
        }
        const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
        renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
      });
    }

    const btnDeleteClass = document.getElementById('btn-gen-delete-class');
    if (btnDeleteClass) {
      const newBtnDeleteClass = btnDeleteClass.cloneNode(true);
      btnDeleteClass.parentNode.replaceChild(newBtnDeleteClass, btnDeleteClass);
      
      newBtnDeleteClass.addEventListener('click', () => {
        const grade = document.getElementById('gen-grade-select').value;
        const classNum = document.getElementById('gen-class-select').value;
        const classObj = classesList.find(c => String(c.grade) === String(grade) && (String(c.class_number) === String(classNum) || String(c.classNumber) === String(classNum)));
        
        if (classObj) {
          window.removeActiveGenClass(classObj.id);
        } else if (genCurrentClassId) {
          window.removeActiveGenClass(genCurrentClassId);
        }
      });
    }

    // ② 과목/교사/시수 입력표 생성
    const subjectBody = document.getElementById('gen-subject-body');
    if (subjectBody) {
      subjectBody.innerHTML = '';
      
      window.isGenTableDirty = false;

      window.markGenTableDirty = function() {
        window.isGenTableDirty = true;
      };

      window.updateTotalGenHours = function() {
        let sum = 0;
        document.querySelectorAll('.gen-hours-input').forEach(input => {
          const val = parseInt(input.value);
          if (!isNaN(val) && val > 0) {
            sum += val;
          }
        });
        const display = document.getElementById('gen-total-hours-display');
        if (display) {
          display.innerText = `(총 시수: ${sum} 시간/주)`;
        }
      };

      window.clearAllGenRows = function() {
        const body = document.getElementById('gen-subject-body');
        if (body) {
          body.innerHTML = '';
          window.markGenTableDirty();
          if (window.renderGenSubjectFilter) window.renderGenSubjectFilter();
          if (window.updateTotalGenHours) window.updateTotalGenHours();
        }
      };

      window.openTeacherSelectPopup = function() {
        const width = 680;
        const height = 550;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open('popup-select-teachers.html?v=' + Date.now(), 'SelectTeachersPopup', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
      };

      window.syncGenRowsWithTeachers = function(selectedTeacherIds) {
        if (!Array.isArray(selectedTeacherIds)) return;

        const existingRows = Array.from(document.querySelectorAll('.gen-row'));
        const existingTeacherIds = [];

        // 1. 선택 해제된 교사 제거 (선택된 목록에 없는 경우 삭제)
        existingRows.forEach(row => {
          const tSelect = row.querySelector('.gen-teacher-select');
          const tId = tSelect ? tSelect.value : null;
          if (tId) {
            if (!selectedTeacherIds.includes(tId)) {
              row.remove();
            } else {
              existingTeacherIds.push(tId);
            }
          }
        });

        // 2. 새로 선택된 교사 추가 (기존에 없는 경우만 추가)
        selectedTeacherIds.forEach(tId => {
          if (!existingTeacherIds.includes(tId)) {
            const t = (generatorData.teachers || []).find(x => x.id === tId);
            const subName = t ? (t.subject_name || t.subjectName) : null;
            const sub = subName ? (generatorData.subjects || []).find(s => s.name === subName) : null;
            window.addGenRow(sub ? sub.id : '', tId, '');
          }
        });

        window.markGenTableDirty();
        if (window.renderGenSubjectFilter) window.renderGenSubjectFilter();
        if (window.updateTotalGenHours) window.updateTotalGenHours();
      };

      window.applyClassSetup = function() {
        if (!genCurrentClassId) {
          alert('설정을 적용할 학급을 선택하거나 생성해 주세요.');
          return;
        }

        if (window.saveCurrentClassHours) {
          window.saveCurrentClassHours(genCurrentClassId);
        }

        window.isGenTableDirty = false;
        
        if (window.renderGenSubjectFilter) window.renderGenSubjectFilter();
        if (window.updateTotalGenHours) window.updateTotalGenHours();

        const gc = (generatorData.classes || []).find(c => c.id === genCurrentClassId);
        const gcName = gc ? `${gc.grade}학년 ${gc.class_number || gc.classNumber}반` : '선택한 학급';
        
        alert(`[${gcName}]의 과목별 시수 및 담당 교사 설정이 정상적으로 적용(저장)되었습니다!`);
      };

      window.executeClassQuery = function() {
        if (window.isGenTableDirty) {
          if (!confirm('과목별 시수 및 교사 설정 작업 내용이 적용(저장)되지 않았습니다.\n적용을 누르지 않고 이동하면 수정 사항이 손실됩니다.\n정말 선택한 학급으로 이동하여 조회하시겠습니까?')) {
            return;
          }
        }
        const classSelect = document.getElementById('gen-class-list-select');
        if (classSelect && classSelect.value) {
          genCurrentClassId = classSelect.value;
        }
        if (window.loadClassHours && genCurrentClassId) {
          window.loadClassHours(genCurrentClassId);
        }
        buildPreviewChips(window.activeGenClassIds || []);
        const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
        renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
      };

      window.saveGeneratorRowsState = function() {
        window.markGenTableDirty();
      };

      window.addGenRow = function(defaultSubjectId = '', defaultTeacherId = '', defaultHours = '') {
        const tr = document.createElement('tr');
        tr.className = 'gen-row';
        
        let valHours = defaultHours;

        const subjectOptions = (generatorData.subjects || []).map(s => {
          const isSelected = (String(s.id) === String(defaultSubjectId)) ? 'selected' : '';
          return `<option value="${s.id}" ${isSelected}>${s.name}</option>`;
        }).join('');
        
        const teacherOptions = (generatorData.teachers || []).map(t => {
          const isSelected = (String(t.id) === String(defaultTeacherId)) ? 'selected' : '';
          return `<option value="${t.id}" ${isSelected}>${t.name} 선생님 (${t.subject_name || t.subjectName || ''})</option>`;
        }).join('');

        tr.innerHTML = `
          <td>
            <select class="form-select gen-subject-select" style="padding:0.35rem 0.5rem; font-size:0.88rem; background-color:#f1f3f5;" disabled>
              <option value="">-- 선택 --</option>
              ${subjectOptions}
            </select>
          </td>
          <td>
            <select class="form-select gen-teacher-select" style="padding:0.35rem 0.5rem; font-size:0.88rem; background-color:#f1f3f5;" disabled>
              <option value="">-- 선택 --</option>
              ${teacherOptions}
            </select>
          </td>
          <td>
            <input type="number" class="form-input gen-hours-input" min="0" max="10" value="${valHours}" placeholder="시수 입력" style="width:70px; padding:0.35rem; font-size:0.9rem; text-align:center;"> 시간/주
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn btn-sm btn-outline btn-row-delete" style="color:var(--danger-color); border-color:var(--danger-color); padding:0.25rem 0.5rem; font-size:0.8rem;">삭제</button>
          </td>
        `;
        
        const subjSelect = tr.querySelector('.gen-subject-select');
        const teachSelect = tr.querySelector('.gen-teacher-select');
        const hoursInput = tr.querySelector('.gen-hours-input');
        const delBtn = tr.querySelector('.btn-row-delete');

        subjSelect.addEventListener('change', (e) => {
          const selectedSubjId = e.target.value;
          const sub = (generatorData.subjects || []).find(s => s.id === selectedSubjId);
          if (sub) {
            const matchingTeacher = (generatorData.teachers || []).find(t => (t.subject_name || t.subjectName || '') === sub.name);
            if (matchingTeacher) {
              teachSelect.value = matchingTeacher.id;
            }
          }
          window.saveGeneratorRowsState();
        });

        teachSelect.addEventListener('change', (e) => {
          const selectedTeacherId = e.target.value;
          const teacher = (generatorData.teachers || []).find(t => t.id === selectedTeacherId);
          if (teacher) {
            const subName = teacher.subject_name || teacher.subjectName;
            const sub = (generatorData.subjects || []).find(s => s.name === subName);
            if (sub) {
              subjSelect.value = sub.id;
            }
          }
          window.saveGeneratorRowsState();
        });
        hoursInput.addEventListener('input', window.saveGeneratorRowsState);
        
        delBtn.addEventListener('click', () => {
          tr.remove();
          window.saveGeneratorRowsState();
        });

        subjectBody.appendChild(tr);
      };

      function loadDefaultRows() {
        const body = document.getElementById('gen-subject-body');
        if (body) body.innerHTML = '';
        const allTeachers = generatorData.teachers || [];
        if (allTeachers.length > 0) {
          allTeachers.forEach(t => {
            const subName = t.subject_name || t.subjectName;
            const sub = (generatorData.subjects || []).find(s => s.name === subName);
            window.addGenRow(sub ? sub.id : '', t.id, '');
          });
        }
      }

      window.syncGeneratorRows = function() {
        if (!generatorData || !generatorData.teachers) return;
        const currentTeacherIds = new Set();
        document.querySelectorAll('.gen-row').forEach(row => {
          const tVal = row.querySelector('.gen-teacher-select')?.value;
          if (tVal) currentTeacherIds.add(tVal);
        });

        let addedCount = 0;
        generatorData.teachers.forEach(t => {
          if (!currentTeacherIds.has(t.id)) {
            const subName = t.subject_name || t.subjectName;
            const sub = (generatorData.subjects || []).find(s => s.name === subName);
            window.addGenRow(sub ? sub.id : '', t.id, '');
            addedCount++;
          }
        });
        if (addedCount > 0) {
          window.saveGeneratorRowsState();
        }
      };

      const btnAddRow = document.getElementById('btn-gen-add-row');
      if (btnAddRow) {
        const newBtn = btnAddRow.cloneNode(true);
        btnAddRow.parentNode.replaceChild(newBtn, btnAddRow);
        newBtn.addEventListener('click', (e) => {
          e.preventDefault();
          window.addGenRow();
          window.saveGeneratorRowsState();
        });
      }

      // 학급별 독립 시수 저장소
      window.genClassHoursMap = window.genClassHoursMap || {};

      window.saveCurrentClassHours = function(classId) {
        if (!classId) return;
        const rows = [];
        document.querySelectorAll('.gen-row').forEach(row => {
          const subjectId = row.querySelector('.gen-subject-select')?.value || '';
          const teacherId = row.querySelector('.gen-teacher-select')?.value || '';
          const hours = row.querySelector('.gen-hours-input')?.value || '';
          if (subjectId || teacherId || hours) {
            rows.push({ subjectId, teacherId, hours });
          }
        });
        window.genClassHoursMap[classId] = rows;
        localStorage.setItem('gen_class_hours_' + currentUser.schoolId, JSON.stringify(window.genClassHoursMap));
      };

      window.loadClassHours = function(classId) {
        if (!classId) return;
        const savedMapStr = localStorage.getItem('gen_class_hours_' + currentUser.schoolId);
        if (savedMapStr) {
          try { window.genClassHoursMap = JSON.parse(savedMapStr); } catch(e){}
        }

        const body = document.getElementById('gen-subject-body');
        if (!body) return;
        body.innerHTML = '';

        const classRows = window.genClassHoursMap[classId];
        if (classRows && classRows.length > 0) {
          classRows.forEach(r => window.addGenRow(r.subjectId, r.teacherId, r.hours));
        } else {
          // 손도 대지 않은 미설정 학급인 경우 아무것도 자동 생성하지 않고 빈 상태를 유지합니다.
        }
        window.isGenTableDirty = false;
        if (window.renderGenSubjectFilter) window.renderGenSubjectFilter();
        if (window.updateTotalGenHours) window.updateTotalGenHours();
      };


    }
    
    // 로컬 스토리지에서 이전 상태 복원
    const savedClassIds = localStorage.getItem('genSelectedClassIds');
    const savedClassMap = localStorage.getItem('genClassMap');
    const savedResult = localStorage.getItem('genResult');
    if (savedClassIds && savedClassMap && savedResult) {
      try {
        const parsedIds = JSON.parse(savedClassIds);
        genClassMap = JSON.parse(savedClassMap);
        generatedResult = JSON.parse(savedResult);
        
        // 미리보기 칩 및 표 렌더링
        if (parsedIds.length > 0) {
          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];
          buildPreviewChips(parsedIds);
          // [조회] 버튼을 누르기 전까지 2번 과목 설정표는 비워둡니다.
          const body = document.getElementById('gen-subject-body');
          if (body) body.innerHTML = '';
          if (window.renderGenSubjectFilter) window.renderGenSubjectFilter();
          renderGenGrid(genCurrentClassId, defaultMaxPeriods);
        }
      } catch (e) {
        console.error('Failed to parse generator state from localStorage', e);
      }
    }

  } catch (err) {
    console.error('Init generator tab error:', err);
  }
}

// (전체 선택/해제 기능 제거됨)

// ────────────────────────────────────────────────────────────────────────────
// AI 자동 생성 시작
// ────────────────────────────────────────────────────────────────────────────
document.getElementById('btn-generate')?.addEventListener('click', async () => {
  const selectedClassIds = window.activeGenClassIds && window.activeGenClassIds.length > 0 ? window.activeGenClassIds : [];
  if (selectedClassIds.length === 0) {
    alert('시간표를 적용할 학급을 최소 1개 이상 생성해주세요!');
    return;
  }

  const targetSubjectIds = Array.from(document.querySelectorAll('.gen-subject-chk:checked')).map(c => c.value);
  if (targetSubjectIds.length === 0) {
    alert('자동 생성 대상 과목을 최소 1개 이상 선택해 주세요.');
    return;
  }

  const subjectsList = [];
  document.querySelectorAll('.gen-row').forEach(row => {
    const subjectSel = row.querySelector('.gen-subject-select');
    const teacherSel = row.querySelector('.gen-teacher-select');
    const hoursInput = row.querySelector('.gen-hours-input');
    
    if (subjectSel && teacherSel && hoursInput) {
      const subjectId = subjectSel.value;
      const teacherId = teacherSel.value;
      const weeklyHours = parseInt(hoursInput.value) || 0;
      if (weeklyHours > 0 && subjectId && teacherId) {
        subjectsList.push({ subjectId, teacherId, weeklyHours });
      }
    }
  });

  if (subjectsList.length === 0) {
    alert('주간 시수가 1시간 이상인 과목이 없습니다. 시수를 입력해주세요.');
    return;
  }

  const assignments = selectedClassIds.map(gcId => ({ gradeClassId: gcId, subjects: subjectsList }));

  // 기존 수동 작성된 셀 고정 목록 추출
  const fixedSlots = [];
  if (genClassMap) {
    Object.keys(genClassMap).forEach(gcId => {
      Object.keys(genClassMap[gcId] || {}).forEach(d => {
        Object.keys(genClassMap[gcId][d] || {}).forEach(p => {
          const slot = genClassMap[gcId][d][p];
          if (slot && slot.subjectId && slot.teacherId) {
            fixedSlots.push({
              gradeClassId: gcId,
              dayOfWeek: parseInt(d),
              period: parseInt(p),
              subjectId: slot.subjectId,
              teacherId: slot.teacherId
            });
          }
        });
      });
    });
  }

  const btnGen = document.getElementById('btn-generate');
  const maxPeriodSelect = document.getElementById('gen-max-period-select');
  const maxPeriodsPerDay = maxPeriodSelect ? parseInt(maxPeriodSelect.value) : 10;
  
  const executeGenerator = async (allowOverlap = false) => {
    try {
      if (btnGen) { btnGen.textContent = '⏳ 시간표 배정 작업 중...'; btnGen.disabled = true; }

      const res = await fetch(`${API_BASE}/generator/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: currentUser.schoolId,
          assignments,
          maxPeriodsPerDay,
          fixedSlots,
          targetSubjectIds,
          allowOverlap
        })
      });

      if (btnGen) { btnGen.textContent = '🤖 시간표 자동 생성 시작'; btnGen.disabled = false; }

      if (!res.ok) { alert('자동 생성 실패'); return; }

      const data = await res.json();

      if (!allowOverlap && data.unassigned && data.unassigned.length > 0) {
        const wantsOverlap = confirm('동아리, 자율 활동 등 공통 교과로 인해 교사 배정이 겹쳐 생성되지 못한 시간이 있습니다.\n교사 중첩을 허용하여 강제로 배정하시겠습니까?');
        if (wantsOverlap) {
          return await executeGenerator(true);
        }
      }

      if (!generatedResult) generatedResult = [];
      const newlyGeneratedClasses = [...new Set(data.timetable.map(t => t.gradeClassId))];
      generatedResult = generatedResult.filter(r => !newlyGeneratedClasses.includes(r.gradeClassId));
      generatedResult.push(...data.timetable);

      // 기존 수동 배치 유지하며 AI 생성 결과 융합 (classMap 업데이트)
      if (!genClassMap) genClassMap = {};
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

      // 자동 생성 결과 서버 DB에 자동 반영 (학기 기본 시간표로 저장)
      if (generatedResult && generatedResult.length > 0) {
        const batchRes = await fetch(`${API_BASE}/admin/base-timetable-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId: currentUser.schoolId, timetable: generatedResult })
        });
        if (!batchRes.ok) {
          throw new Error('Failed to save batch timetable');
        }
      }

      alert(`🎉 시간표 자동 생성이 성공적으로 완료되어 데이터베이스에 반영되었습니다!\n상단 [📅 일자별 수업 시간표] 및 [👩‍🏫 교사 시간표] 탭에서 완성된 시간표를 확인하실 수 있습니다.`);
      switchTab('DAILY');

    } catch (err) {
      if (btnGen) { btnGen.textContent = '🤖 시간표 자동 생성 시작'; btnGen.disabled = false; }
      console.error('Generate error:', err);
      alert('생성 중 오류가 발생했습니다.');
    }
  };

  await executeGenerator(false);
});

// 다시 생성
document.getElementById('btn-regen')?.addEventListener('click', () => {
  document.getElementById('btn-generate')?.click();
});

// 해당 학급 초기화
document.getElementById('btn-reset-current-class')?.addEventListener('click', () => {
  if (!genCurrentClassId) {
    alert('초기화할 학급이 선택되지 않았습니다.');
    return;
  }
  const gc = (generatorData?.classes || currentSchoolMeta?.gradeClasses || []).find(c => c.id === genCurrentClassId);
  const gcName = gc ? `${gc.grade}학년 ${gc.class_number || gc.classNumber}반` : '선택된 학급';

  if (!confirm(`⚠️ [${gcName}] 의 시간표 생성(미리보기) 데이터를 초기화하시겠습니까?\n\n(※ 학기 기본 시간표 및 일자별 시간표에는 전혀 영향을 주지 않습니다)`)) return;

  if (genClassMap && genClassMap[genCurrentClassId]) {
    delete genClassMap[genCurrentClassId];
  }
  if (generatedResult) {
    generatedResult = generatedResult.filter(r => r.gradeClassId !== genCurrentClassId);
  }

  localStorage.setItem('genClassMap', JSON.stringify(genClassMap));
  localStorage.setItem('genResult', JSON.stringify(generatedResult));

  const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
  renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
  alert(`🗑️ [${gcName}] 의 시간표 생성 데이터가 초기화되었습니다. (학기 기본 시간표 및 일자별 시간표는 그대로 유지됩니다)`);
});

// 전체 학년/반 초기화
document.getElementById('btn-reset-all-classes')?.addEventListener('click', () => {
  if (!confirm('⚠️ 시간표 생성 탭의 전체 학년/반 생성(미리보기) 데이터를 초기화하시겠습니까?\n\n(※ 학기 기본 시간표 및 일자별 시간표에는 전혀 영향을 주지 않습니다)')) return;

  genClassMap = {};
  generatedResult = [];

  localStorage.removeItem('genSelectedClassIds');
  localStorage.removeItem('genClassMap');
  localStorage.removeItem('genResult');

  const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
  renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
  alert('🗑️ 시간표 생성 탭의 전체 생성 데이터가 초기화되었습니다. (학기 기본 시간표 및 일자별 시간표는 그대로 유지됩니다)');
});

// 버튼 클릭시 칩 변경 로직은 buildPreviewChips 내부에 포함됨
document.addEventListener('change', (e) => {
  if (e.target?.id === 'gen-max-period-select') {
    const maxPeriodsPerDay = parseInt(e.target.value) || 10;
    renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
  }
});

function buildPreviewChips(classIds) {
  const targetDropdown = document.getElementById('gen-target-class-dropdown');

  if (targetDropdown) {
    if (!classIds || classIds.length === 0) {
      targetDropdown.innerHTML = '<option value="">-- 학급 선택 --</option>';
    } else {
      targetDropdown.innerHTML = classIds.map(gcId => {
        const gc = (generatorData?.classes || currentSchoolMeta?.gradeClasses || []).find(c => c.id === gcId);
        const gcName = gc ? `${gc.grade}학년 ${gc.class_number || gc.classNumber || ''}반` : gcId;
        return `<option value="${gcId}" ${gcId === genCurrentClassId ? 'selected' : ''}>${gcName}</option>`;
      }).join('');
    }

    if (!targetDropdown.dataset.bound) {
      targetDropdown.dataset.bound = 'true';
      const btnView = document.getElementById('btn-gen-target-class-view');
      const attachTarget = btnView || targetDropdown;
      const eventName = btnView ? 'click' : 'change';
      attachTarget.addEventListener(eventName, async (e) => {
        const selectedGcId = targetDropdown.value;
        if (!selectedGcId) return;

        if (window.isGenTableDirty) {
          if (!confirm('설정하신 시수 및 교사 작업이 적용(저장)되지 않았습니다.\n이대로 이동하면 설정이 유실됩니다.\n다른 학급으로 이동하여 조회하시겠습니까?')) {
            targetDropdown.value = genCurrentClassId;
            return;
          }
        }

        genCurrentClassId = selectedGcId;
        
        // If no local data exists for this class, fetch from DB
        if (!genClassMap[selectedGcId] || Object.keys(genClassMap[selectedGcId]).length === 0) {
          try {
            const btRes = await fetch(API_BASE + '/admin/base-timetable-all?schoolId=' + currentUser.schoolId);
            if (btRes.ok) {
              const btData = await btRes.json();
              const classData = btData.filter(item => item.gradeClassId === selectedGcId);
              if (classData.length > 0) {
                if (!genClassMap[selectedGcId]) genClassMap[selectedGcId] = {};
                classData.forEach(item => {
                  if (!genClassMap[item.gradeClassId][item.dayOfWeek]) genClassMap[item.gradeClassId][item.dayOfWeek] = {};
                  genClassMap[item.gradeClassId][item.dayOfWeek][item.period] = item;
                });
                if (!generatedResult) generatedResult = [];
                generatedResult = generatedResult.filter(r => r.gradeClassId !== selectedGcId);
                generatedResult.push(...classData);
                localStorage.setItem('genClassMap', JSON.stringify(genClassMap));
                localStorage.setItem('genResult', JSON.stringify(generatedResult));
              }
            }
          } catch (e) {
            console.error('Failed to load class from DB', e);
          }
        }

        if (window.loadClassHours) {
          window.loadClassHours(selectedGcId);
        }
        const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
        renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
      });
    }
  }
}

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

  // 시수 검증 알림바 렌더링
  let hoursStatusContainer = document.getElementById('gen-hours-status-container');
  if (!hoursStatusContainer) {
    hoursStatusContainer = document.createElement('div');
    hoursStatusContainer.id = 'gen-hours-status-container';
    hoursStatusContainer.style.margin = '0.75rem 0';
    hoursStatusContainer.style.fontSize = '0.85rem';
    tbody.parentNode.parentNode.insertBefore(hoursStatusContainer, tbody.parentNode);
  }

  if (gradeClassId && window.genClassHoursMap?.[gradeClassId]) {
    const targetHours = window.genClassHoursMap[gradeClassId];
    const placedCounts = {};
    if (classMap) {
      Object.keys(classMap).forEach(d => {
        Object.keys(classMap[d] || {}).forEach(p => {
          const slot = classMap[d][p];
          if (slot && slot.subjectId) {
            placedCounts[slot.subjectId] = (placedCounts[slot.subjectId] || 0) + 1;
          }
        });
      });
    }

    const totalPlacedCount = Object.values(placedCounts).reduce((a, b) => a + b, 0);
    const gcName = gc ? `${gc.grade}학년 ${gc.class_number || gc.classNumber}반` : gradeClassId;

    if (totalPlacedCount === 0) {
      hoursStatusContainer.innerHTML = `
        <div style="background:var(--bg-surface); padding:0.6rem 0.85rem; border-radius:8px; border:1px solid var(--border-color); display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
          <span style="font-weight:700; color:var(--primary-color);">📊 [${gcName} 시수 충족 현황]:</span>
          <span style="color:var(--text-sub); font-size:0.85rem; font-weight:600;">시간표 배치 전(초기화 상태)입니다. [시간표 자동 생성] 또는 셀을 눌러 수동 배치하세요.</span>
        </div>
      `;
    } else {
      const statusBadges = targetHours.map(th => {
        if (!th.subjectId || !th.hours) return '';
        const target = parseInt(th.hours) || 0;
        const placed = placedCounts[th.subjectId] || 0;
        const subName = (generatorData?.subjects || []).find(s => s.id === th.subjectId)?.name || '과목';

        if (placed === target) {
          return `<span style="background:rgba(16, 185, 129, 0.12); color:#059669; padding:0.25rem 0.55rem; border-radius:12px; font-weight:600;">✅ ${subName}: ${placed}/${target}시간 (완료)</span>`;
        } else if (placed < target) {
          return `<span style="background:rgba(239, 68, 68, 0.12); color:#dc2626; padding:0.25rem 0.55rem; border-radius:12px; font-weight:600;">⚠️ ${subName}: ${placed}/${target}시간 (${target - placed}시간 부족)</span>`;
        } else {
          return `<span style="background:rgba(245, 158, 11, 0.12); color:#d97706; padding:0.25rem 0.55rem; border-radius:12px; font-weight:600;">⚠️ ${subName}: ${placed}/${target}시간 (${placed - target}시간 초과)</span>`;
        }
      }).filter(Boolean);

      hoursStatusContainer.innerHTML = `
        <div style="background:var(--bg-surface); padding:0.6rem 0.85rem; border-radius:8px; border:1px solid var(--border-color); display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
          <span style="font-weight:700; color:var(--primary-color);">📊 [${gcName} 시수 충족 현황]:</span>
          ${statusBadges.join(' ')}
        </div>
      `;
    }
  } else {
    hoursStatusContainer.innerHTML = '';
  }

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
          alert('먼저 학급을 선택해주세요.');
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
    const curAssign = (slot && (slot.subjectName || slot.teacherName))
      ? `${slot.subjectName || ''} (${slot.teacherName || ''} 선생님)`
      : '배정 없음';

    slotInfoSummary.innerHTML = `
      <strong>[수업 생성 수정]</strong> ${gcName} ${dayName}요일 ${period}교시<br>
      <strong>[현재 배정]</strong> ${curAssign}
    `;
  }
  if (conflictAlert) conflictAlert.classList.add('hidden');
  pendingForcePayload = null;

  // 과목/교사 셀렉트 채우기
  populateModalDropdowns(slot);

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
      alert(`🎉 시간표 적용 완료!\n총 ${data.applied}개 수업이 기본 시간표에 저장되었습니다.\n이제 [일자별 수업 시간표] 및 [교사 시간표] 탭에서 완성된 시간표를 확인할 수 있습니다.`);
      loadTimetable();

    } else {
      alert(data.error || '시간표 적용 실패');
    }
  } catch (err) {
    console.error('Apply timetable error:', err);
    alert('적용 처리 중 오류가 발생했습니다.');
  }
});

// 📅 일자별 시간표 조정 내역 초기화 (학기 기본 시간표 원본 상태로 복원)
document.getElementById('btn-reset-daily-changes')?.addEventListener('click', async () => {
  if (!currentUser || !currentUser.schoolId) return;
  if (!confirm('📅 [일자별 시간표] 의 변경 및 보강 내역을 초기화하시겠습니까?\n\n초기화 시 일자별 수동 조정 내역만 제거되고 [학기 기본 시간표] 상태로 되돌아갑니다.\n(※ 학기 기본 시간표 및 시간표 생성 데이터는 전혀 삭제되지 않습니다)')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/reset-daily-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: currentUser.schoolId })
    });
    const data = await res.json();
    if (res.ok) {
      alert('🎉 일자별 시간표의 모든 변경 내역이 초기화되었으며, 학기 기본 시간표 원본으로 되돌려졌습니다.');
      window.sandboxChanges = [];
      loadTimetable();
    } else {
      alert(data.error || '초기화 실패');
    }
  } catch (err) {
    console.error('Reset daily changes error:', err);
    alert('서버 통신 오류가 발생했습니다.');
  }
});

// 🏫 학기 기본 시간표 초기화 (시간표 생성 원본 상태로 복원)
document.getElementById('btn-reset-base-timetable')?.addEventListener('click', async () => {
  if (!currentUser || !currentUser.schoolId) return;
  if (!confirm('🏫 [학기 기본 시간표] 를 초기화하시겠습니까?\n\n초기화 시 학기 기본 시간표 설정이 초기화되어 [시간표 생성] 원본 상태로 되돌아갑니다.\n(※ 일자별 시간표 및 시간표 생성 데이터는 전혀 삭제되지 않습니다)')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/reset-base-timetable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: currentUser.schoolId })
    });
    const data = await res.json();
    if (res.ok) {
      alert('🎉 학기 기본 시간표가 초기화되었으며, 시간표 생성 초기 상태로 되돌려졌습니다.');
      loadTimetable();
    } else {
      alert(data.error || '초기화 실패');
    }
  } catch (err) {
    console.error('Reset base timetable error:', err);
    alert('서버 통신 오류가 발생했습니다.');
  }
});

window.openStudentMgmtOverlay = () => {
  window.open('popup-students.html?v=' + Date.now(), 'student_mgmt', 'width=1000,height=650,scrollbars=yes,resizable=yes');
};
window.closeStudentMgmtOverlay = () => {
  const el = document.getElementById('overlay-student-mgmt');
  if (el) el.classList.add('hidden');
};
window.openTeacherMgmtOverlay = () => {
  window.open('popup-teachers.html?v=' + Date.now(), 'teacher_mgmt', 'width=1200,height=700,scrollbars=yes,resizable=yes');
};
window.closeTeacherMgmtOverlay = () => {
  const el = document.getElementById('overlay-teacher-mgmt');
  if (el) el.classList.add('hidden');
};
window.openPendingApprovalsOverlay = () => {
  window.open('popup-pending.html?v=' + Date.now(), 'pending_approvals', 'width=1000,height=650,scrollbars=yes,resizable=yes');
};
window.closePendingApprovalsOverlay = () => {
  const el = document.getElementById('overlay-pending-approvals');
  if (el) el.classList.add('hidden');
};


// 🗑️ Delete button in Modal
document.getElementById('btn-modal-delete')?.addEventListener('click', () => {
  if (confirm('정말로 해당 교시를 삭제(빈 시간)하시겠습니까?')) {
    const subjSelect = document.getElementById('change-subject-select');
    const teacherSelect = document.getElementById('change-teacher-select');
    
    if (subjSelect) {
      let opt = Array.from(subjSelect.options).find(o => o.value === 'DELETE');
      if (!opt) {
        opt = document.createElement('option');
        opt.value = 'DELETE';
        subjSelect.appendChild(opt);
      }
      subjSelect.value = 'DELETE';
    }
    if (teacherSelect) {
      let opt = Array.from(teacherSelect.options).find(o => o.value === '');
      if (!opt) {
        opt = document.createElement('option');
        opt.value = '';
        teacherSelect.appendChild(opt);
      }
      teacherSelect.value = '';
    }
    
    handleApplyChange({ preventDefault: () => {} });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 💾 시간표 저장 / 내보내기 (Excel / HWP / PDF)
// ────────────────────────────────────────────────────────────────────────────
window.toggleExportMenu = function(btn, event) {
  if (event) event.stopPropagation();
  const dropdown = btn.nextElementSibling;
  document.querySelectorAll('.export-menu').forEach(m => {
    if (m !== dropdown) m.classList.add('hidden');
  });
  if (dropdown) dropdown.classList.toggle('hidden');
};

document.addEventListener('click', () => {
  document.querySelectorAll('.export-menu').forEach(m => m.classList.add('hidden'));
});

window.exportCurrentTimetable = function(type) {
  let titleStr = '';
  let gridTable = null;

  if (activeTab === 'TEACHER') {
    const tSelect = document.getElementById('teacher-title-select');
    const tName = (tSelect && tSelect.selectedIndex > 0) ? tSelect.options[tSelect.selectedIndex].text : '전체교사';
    const modeLabel = teacherSubtab === 'BASE' ? '학기(기초) 시간표' : '일자별 시간표';
    titleStr = tName + ' ' + modeLabel;
    gridTable = document.querySelector('#tab-content-teacher .timetable-grid');
  } else {
    const grade = filterGradeSelect ? filterGradeSelect.value : '1';
    const classNum = filterClassSelect ? filterClassSelect.value : '1';
    const dateStr = weekDateSubtext ? weekDateSubtext.textContent.replace('기준주간 시작: ', '') : '';
    titleStr = `${grade}학년 ${classNum}반 일자별 수업 시간표 (${dateStr})`;
    gridTable = document.querySelector('#tab-content-daily .timetable-grid');
  }

  if (!gridTable) {
    alert('저장할 시간표가 존재하지 않습니다.');
    return;
  }

  const sanitizedTitle = titleStr.replace(/[/\\?%*:|"<>]/g, '_').trim();

  if (type === 'EXCEL') {
    exportToExcel(sanitizedTitle, gridTable);
  } else if (type === 'HWP') {
    exportToHwp(sanitizedTitle, gridTable);
  } else if (type === 'PDF') {
    exportToPdf(sanitizedTitle, gridTable);
  }
};

function exportToExcel(title, table) {
  try {
    if (typeof XLSX === 'undefined') {
      alert('Excel 라이브러리를 로딩 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const wb = XLSX.utils.book_new();
    const wsData = [];

    wsData.push([title]);
    wsData.push([]); // blank row

    // Headers
    const headers = [];
    table.querySelectorAll('thead th').forEach(th => {
      headers.push(th.innerText.replace(/\n/g, ' '));
    });
    wsData.push(headers);

    // Rows
    table.querySelectorAll('tbody tr').forEach(tr => {
      const rowData = [];
      tr.querySelectorAll('th, td').forEach(cell => {
        rowData.push(cell.innerText.replace(/\n/g, ' '));
      });
      wsData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, "시간표");

    XLSX.writeFile(wb, `${title}.xlsx`);
  } catch (err) {
    console.error('Excel export error:', err);
    alert('Excel 저장 중 오류가 발생했습니다.');
  }
}

function exportToHwp(title, table) {
  try {
    let rowsHtml = '';

    // Headers
    const headThs = table.querySelectorAll('thead th');
    let headCells = '';
    headThs.forEach(th => {
      headCells += `<th style="background-color:#eff6ff; border:1px solid #94a3b8; padding:8px; font-size:12pt; text-align:center; font-weight:bold;">${th.innerText.replace(/\n/g, '<br>')}</th>`;
    });
    rowsHtml += `<tr>${headCells}</tr>`;

    // Rows
    table.querySelectorAll('tbody tr').forEach(tr => {
      let rowCells = '';
      tr.querySelectorAll('th, td').forEach(cell => {
        const isTh = cell.tagName === 'TH';
        const bg = isTh ? 'background-color:#f8fafc; font-weight:bold;' : '';
        const txt = cell.innerText.replace(/\n/g, '<br>');
        rowCells += `<td style="${bg} border:1px solid #cbd5e1; padding:10px; font-size:11pt; text-align:center; vertical-align:middle;">${txt}</td>`;
      });
      rowsHtml += `<tr>${rowCells}</tr>`;
    });

    const hwpHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: "Malgun Gothic", "한컴바탕", sans-serif; margin: 25px; }
    h2 { text-align: center; font-size: 18pt; margin-bottom: 20px; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <table>
    ${rowsHtml}
  </table>
</body>
</html>`;

    const blob = new Blob([hwpHtml], { type: 'application/x-hwp;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.hwp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('HWP export error:', err);
    alert('한글(.hwp) 저장 중 오류가 발생했습니다.');
  }
}

function exportToPdf(title, table) {
  try {
    if (typeof html2pdf === 'undefined') {
      alert('PDF 라이브러리를 로딩 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.background = '#ffffff';

    const h2 = document.createElement('h2');
    h2.innerText = title;
    h2.style.textAlign = 'center';
    h2.style.fontSize = '18px';
    h2.style.marginBottom = '15px';
    h2.style.color = '#1e293b';

    const cloneTable = table.cloneNode(true);
    cloneTable.style.width = '100%';
    cloneTable.style.borderCollapse = 'collapse';
    cloneTable.querySelectorAll('th, td').forEach(c => {
      c.style.border = '1px solid #cbd5e1';
      c.style.padding = '8px';
      c.style.textAlign = 'center';
      c.style.fontSize = '11px';
    });

    element.appendChild(h2);
    element.appendChild(cloneTable);

    const opt = {
      margin:       10,
      filename:     `${title}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
  } catch (err) {
    console.error('PDF export error:', err);
    alert('PDF 저장 중 오류가 발생했습니다.');
  }
}

// (btn-load-base-timetable removed to enforce strict top-down cascade)
