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

const timetableTitle = null; // ??���??�적?�로 ?�용 (?�래 loadTimetable 참조)
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
        alert('기�? ?�자�?먼�? ?�택?�주?�요.');
        return;
      }
      window.open(`daily-all.html?schoolId=${currentUser.schoolId}&date=${selectedDate}`, '_blank');
    });
  }

teacherTitleSelect.addEventListener('change', () => {
  if (activeTab !== 'TEACHER') switchTab('TEACHER');
  loadTimetable();
});

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
      alert('??��???�생???�택?�주?�요.');
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
        alert('계정 ?�보가 ?�공?�으�?변경되?�습?�다. 보안???�해 ?�시 로그?�해주세??');
        handleLogout();
      } else {
        alert(data.error || '계정 ?�보 변�??�패');
      }
    } catch (err) {
      console.error(err);
      alert('?�류가 발생?�습?�다.');
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
        alert(data.error || '?�교 ?�록 ?�청 ?�패');
      }
    } catch (err) {
      console.error(err);
      alert('?�버 ?�신 ?�류가 발생?�습?�다.');
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
        alert('?�생??가???�청???�료?�었?�니?? 관리자 ?�인 ?��?중입?�다.');
        teacherSignupFormPublic.reset();
        teacherSignupFormPublic.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        alert(data.error || '가???�청 ?�패');
      }
    } catch (err) {
      console.error(err);
      alert('?�버 ?�신 ?�류가 발생?�습?�다.');
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
        alert('?�생 가???�청???�료?�었?�니?? 관리자 ?�인 ?�료 ??조회가 가?�합?�다.');
        studentSignupForm.reset();
        studentSignupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        alert(data.error || '가???�청 ?�패');
      }
    } catch (err) {
      console.error(err);
      alert('?�신 �??�류가 발생?�습?�다.');
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
    alert('?�이???�메???� 비�?번호�?모두 ?�력?�주?�요!');
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
      alert(data.error || '로그???�패: ?�이???�는 비�?번호�??�인?�주?�요.');
      return;
    }

    // 마스??계정??경우 마스???�이지�??�내
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
    alert('?�버 ?�신 ?�류가 발생?�습?�다.');
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

    if (navSchoolNameElem) {
      const schoolTitle = currentUser?.schoolName || '?�간??;
      const codeStr = currentUser?.schoolCode ? ` (?�교 코드 번호 ${currentUser.schoolCode})` : '';
      
      if (currentUser?.role === 'STUDENT') {
        navSchoolNameElem.textContent = `?�� ${schoolTitle} ?�생 ?�간??{codeStr}`;
      } else {
        navSchoolNameElem.textContent = `?�� ${schoolTitle} 관리자 ?�스??{codeStr}`;
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
        tabDaily.textContent = '?�� ?�급 ?�간??;
      }
      if (tabBase) tabBase.style.display = 'none';
      if (tabTeacher) {
        tabTeacher.style.display = 'inline-block';
        tabTeacher.textContent = '?��?��??�기 ?�업 ?�간??;
      }
      if (tabGen) tabGen.style.display = 'none';
      if (btnSettings) btnSettings.style.display = 'inline-block';
      btnMainResets.forEach(btn => btn.style.display = 'none');
      
      // Default to Teacher timetable or class timetable if active tab is restricted
      if (activeTab === 'BASE' || activeTab === 'GENERATOR') {
        switchTab('DAILY');
      }
    } else if (currentUser?.role === 'STUDENT') {
      if (tabDaily) {
        tabDaily.style.display = 'inline-block';
        tabDaily.textContent = '?�� ?�급 ?�간??;
      }
      if (tabBase) tabBase.style.display = 'none';
      if (tabTeacher) {
        tabTeacher.style.display = 'none';
      }
      if (tabGen) tabGen.style.display = 'none';
      if (btnSettings) btnSettings.style.display = 'none';
      btnMainResets.forEach(btn => btn.style.display = 'none');
      
      if (activeTab !== 'DAILY') {
        switchTab('DAILY');
      }
    } else {
      if (tabDaily) {
        tabDaily.style.display = 'inline-block';
        tabDaily.textContent = '?�� ?�자�??�간??;
      }
      if (tabBase) tabBase.style.display = 'inline-block';
      if (tabTeacher) {
        tabTeacher.style.display = 'inline-block';
        tabTeacher.textContent = '?��?��?교사 ?�간??;
      }
      if (tabGen) tabGen.style.display = 'inline-block';
      if (btnSettings) btnSettings.style.display = 'inline-block';
    }

    // 1~10교시 그리??즉시 ??�� ?�더�?
    renderGrid([], 'CLASS');

    await loadSchoolMetadata();
    await loadTimetable();
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
    cTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-sub); padding:1rem;">?�록???�년/?�급???�습?�다. ?�단 [?�급 ?�성/?�정 ?�???�서 ?�년�?반을 ?�록?�주?�요.</td></tr>`;
    return;
  }

  gradeClasses.forEach(c => {
    const tr = document.createElement('tr');
    
    let optionsHtml = '<option value="">?�임 미�???/option>';
    teachers.forEach(t => {
      const isSelected = t.id === c.homeroom_teacher_id ? 'selected' : '';
      optionsHtml += `<option value="${t.id}" ${isSelected}>${t.name} (${t.subject_name || '과목?�음'})</option>`;
    });

    tr.innerHTML = `
      <td><strong>${c.grade}?�년</strong></td>
      <td><strong>${c.class_number}�?/strong></td>
      <td>
        <select id="class-homeroom-${c.id}" class="form-select" style="padding: 4px 8px; font-size: 0.9em; height: auto;" onchange="updateClassHomeroom('${c.id}', ${c.grade}, ${c.class_number})">
          ${optionsHtml}
        </select>
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
          opt.textContent = `${gc.class_number}�?(${gc.homeroom_teacher_name ? gc.homeroom_teacher_name + ' ?�생?? : '공석'})`;
          filterClassSelect.appendChild(opt);
        });
      };
      
      // Update classes when grade changes
      filterGradeSelect.addEventListener('change', () => {
        updateClassOptions();
        loadTimetable();
      });
      // Optionally reload when class changes
      filterClassSelect.addEventListener('change', loadTimetable);
      
      // Initialize class options
      updateClassOptions();
    }

    // Populate Teacher Title Dropdown
    if (teacherTitleSelect) {
      teacherTitleSelect.innerHTML = '';
      const defTeacherOpt = document.createElement('option');
      defTeacherOpt.value = '';
      defTeacherOpt.textContent = '교사 ?�택';
      teacherTitleSelect.appendChild(defTeacherOpt);

      if (currentSchoolMeta.teachers) {
        currentSchoolMeta.teachers.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = `${t.name} (${t.subject_name || t.subjectName})`;
          teacherTitleSelect.appendChild(opt);
        });
      }

      if (currentUser?.role === 'TEACHER' && currentUser.teacherId) {
        teacherTitleSelect.value = currentUser.teacherId;
      }
    }

    if (classSetupHomeroom) {
      classSetupHomeroom.innerHTML = '';
      
      // Add default empty option for homeroom selection
      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '?�임 ?�음';
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
        tTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-sub); padding:1rem;">?�록??교사가 ?�습?�다.</td></tr>`;
      } else {
        currentSchoolMeta.teachers.forEach(t => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><input type="text" class="form-input" id="teacher-name-${t.id}" value="${t.name}" style="padding: 4px; font-size: 0.9em;"></td>
            <td><input type="text" class="form-input" id="teacher-subject-${t.id}" value="${t.subject_name || ''}" style="padding: 4px; font-size: 0.9em;" placeholder="과목 ?�력"></td>
            <td><input type="text" class="form-input" id="teacher-email-${t.id}" value="${t.email || ''}" style="padding: 4px; font-size: 0.9em;" placeholder="?�이???�성"></td>
            <td><input type="text" class="form-input" id="teacher-pwd-${t.id}" value="${t.password_hash || ''}" style="padding: 4px; font-size: 0.9em;" placeholder="비�?번호 ?�정"></td>
            <td style="text-align:center; white-space: nowrap;">
              <button class="btn btn-sm btn-outline" style="border-color:var(--primary-color); color:var(--primary-color); margin-right: 4px;" onclick="updateTeacherCredentials('${t.id}', '${t.code || ''}')">?�정</button>
              <button class="btn btn-sm btn-outline" style="border-color:var(--danger-color); color:var(--danger-color);" onclick="deleteTeacher('${t.id}')">??��</button>
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
  if (!confirm('?�당 ?�급????��?�시겠습?�까? 관???�간???�이?�도 ??��?????�습?�다.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/classes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('?�급????��?�었?�니??');
      await loadSchoolMetadata();
    } else {
      alert('?�급 ??�� ?�패');
    }
  } catch (err) {
    console.error(err);
  }
};

window.deleteTeacher = async function(id) {
  if (!confirm('?�말�???교사�???��?�시겠습?�까? 관???�간???�이?��? ?�실?�거??초기?�될 ???�습?�다.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/teachers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('?�공?�으�???��?�었?�니??');
      await loadSchoolMetadata();
    } else {
      alert('교사 ??�� ?�패');
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
    alert('교사명을 ?�력?�주?�요.');
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
      alert('?�공?�으�??�정?�었?�니??');
      await loadSchoolMetadata();
    } else {
      alert(data.error || '?�정 ?�패');
    }
  } catch (err) {
    console.error(err);
    alert('?�정 �??�류 발생');
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
      alert('?�임 교사가 ?�공?�으�??�정?�었?�니??');
      await loadSchoolMetadata();
    } else {
      alert('?�임 교사 ?�정 ?�패');
    }
  } catch (err) {
    console.error(err);
    alert('?�정 �??�류 발생');
  }
};


window.deleteSubject = async function(id) {
  if (!confirm('?�말�???과목????��?�시겠습?�까? 관???�간???�이?��? ?�실?�거??초기?�될 ???�습?�다.')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/subjects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      alert('?�공?�으�???��?�었?�니??');
      await loadSchoolMetadata();
    } else {
      alert('과목 ??�� ?�패');
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
    btnSettingsToggle.textContent = '?�� ?�간??보기';
    
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
    btnSettingsToggle.textContent = '?�️ ?�교/교사 ?�정';
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
      studentsList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-sub);">?��?중인 ?�인 ?�청???�습?�다.</td></tr>`;
    } else {
      students.forEach(u => {
        const match = u.name.match(/^(.*?)\s*\((\d+)?�년\s*(\d+)�?s*?�생\)$/);
        const name = match ? match[1] : u.name;
        const grade = match ? match[2] + '?�년' : '-';
        const classNum = match ? match[3] + '�? : '-';

        const tr = document.createElement('tr');
        tr.dataset.id = u.id;
        tr.innerHTML = `
          <td style="text-align:center;"><input type="checkbox" class="chk-pending-student"></td>
          <td>${grade}</td>
          <td>${classNum}</td>
          <td>${name}</td>
          <td><input type="text" class="form-input pending-email" value="${u.email}" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
          <td><input type="text" class="form-input pending-password" placeholder="변�????�력" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
        `;
        studentsList.appendChild(tr);
      });
    }

    if (teachers.length === 0) {
      teachersList.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-sub);">?��?중인 ?�인 ?�청???�습?�다.</td></tr>`;
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
          <td><input type="text" class="form-input pending-password" placeholder="변�????�력" style="width:100%; padding:0.3rem 0.5rem; font-size:0.9rem;"></td>
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
    alert('?�택???�용?��? ?�습?�다.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/users/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, status, updates })
    });
    if (res.ok) {
      alert(`?�공?�으�?처리?�었?�니??(${status})`);
      loadPendingUsers();
      if (status === 'APPROVED') {
        if (role === 'STUDENT') loadApprovedStudents();
        else loadTeachers();
      }
    } else {
      alert('?�청 처리???�패?�습?�다.');
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
      listUI.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-sub);">가?�된 ?�생???�습?�다.</td></tr>`;
      return;
    }

    students.forEach(s => {
      const nameMatch = s.name.match(/^(.*?)\s*\((\d+)?�년\s*(\d+)�?s*?�생\)$/);
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
          <button class="btn btn-sm btn-outline" style="border-color:var(--primary-color); color:var(--primary-color); margin-right: 4px;" onclick="updateStudent('${s.id}')">?�정</button>
          <button class="btn btn-sm btn-outline" style="border-color:var(--danger-color); color:var(--danger-color);" onclick="deleteStudents(['${s.id}'])">??��</button>
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
    alert('?�이?��? 비�?번호�?모두 ?�력?�주?�요.');
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
      alert('?�공?�으�??�정?�었?�니??');
      loadApprovedStudents();
    } else {
      alert(data.error || '?�정 �??�류가 발생?�습?�다.');
    }
  } catch (err) {
    console.error('Update student error:', err);
    alert('?�정 �??�류가 발생?�습?�다.');
  }
};

window.deleteStudents = async function(ids) {
  if (!confirm(`?�택??${ids.length}명의 ?�생????��?�시겠습?�까?`)) return;
  try {
    const res = await fetch(`${API_BASE}/admin/users?ids=${ids.join(',')}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      alert('?�공?�으�???��?�었?�니??');
      loadApprovedStudents();
    } else {
      alert('??�� 처리 �??�패?�습?�다.');
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
      alert('?�생???�보가 ?�상?�으�??�?�되?�습?�다.');
      teacherSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      alert(data.error || '?�생???�록 ?�패');
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
      alert('?�� ?�급 ?�정???�공?�으�??�?�되?�습?�다.');
      classSetupForm.reset();
      await loadSchoolMetadata();
    } else {
      let errorMsg = data.error || '?�급 ?�성/?�정 ?�패';
      if (typeof errorMsg === 'string' && errorMsg.includes('already exists')) {
        errorMsg = '?�️ ?��? 개설???�년/반입?�다. ?�래 [?�� ?�년/?�급 ?�성 �??�임 관�? 목록?�서 ?�인 �??�정??가?�합?�다.';
      }
      alert(errorMsg);
    }
  } catch (err) {
    console.error(err);
    alert('?�버 ?�신 ?�류가 발생?�습?�다.');
  }
}

function updateFiltersForTab(tabName) {
  if (tabName === 'TEACHER' || tabName === 'GENERATOR') {
    classFilterGroup.classList.add('hidden');
  } else {
    classFilterGroup.classList.remove('hidden');
  }
}

// Load Timetable Grid
async function loadTimetable() {
  if (!currentSchoolMeta) return;

  const dateVal = datePicker.value;
  const baseParam = (activeTab === 'BASE' || activeTab === 'TEACHER') ? '&baseOnly=true' : '';


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
        weekDateSubtext.textContent = `기�?주간 ?�작: -`;
        renderGrid([], mode);
        return;
      }
      const teacherObj = currentSchoolMeta.teachers.find(t => String(t.id) === String(teacherId));
      url = `${API_BASE}/timetable/teacher?schoolId=${currentUser.schoolId}&teacherId=${teacherId}&date=${dateVal}${baseParam}`;
    } else {
      mode = 'CLASS';
      if (!filterGradeSelect.value || !filterClassSelect.value) {
        weekDateSubtext.textContent = `기�?주간 ?�작: -`;
        renderGrid([], mode);
        return;
      }
      const grade = filterGradeSelect.value;
      const classNum = filterClassSelect.value;
      url = `${API_BASE}/timetable/class?schoolId=${currentUser.schoolId}&grade=${grade}&classNumber=${classNum}&date=${dateVal}${baseParam}`;
      if (activeTab === 'BASE') {
        if (titleElemBase) titleElemBase.textContent = `?�� ${grade}?�년 ${classNum}�?기본 ?�간???�본 ?�정`;
      } else {
        if (titleElemDaily) titleElemDaily.textContent = `?�� ${grade}?�년 ${classNum}�??�자�??�간??;
      }
    }

    const res = await fetch(url);
    const data = await res.json();

    // Patch data.timetable with window.sandboxChanges
    if (window.sandboxChanges && window.sandboxChanges.length > 0) {
      data.timetable = data.timetable.map(slot => {
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
      });
    }

    weekDateSubtext.textContent = `기�?주간 ?�작: ${data.mondayDate}`;
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
  
  // Update table headers with dates
  const theadThs = targetBody.parentElement.querySelectorAll('thead th');
  if (theadThs.length === 6) {
    for (let d = 0; d < 5; d++) {
      if (weeklyData && weeklyData[d] && weeklyData[d].date) {
        const parts = weeklyData[d].date.split('-');
        const dateStr = `${parts[0]}??${parseInt(parts[1], 10)}??${parseInt(parts[2], 10)}??;
        theadThs[d + 1].innerHTML = `${['?�요??, '?�요??, '?�요??, '목요??, '금요??][d]}<br><span style="font-size:0.85em;font-weight:normal;">(${dateStr})</span>`;
      } else {
        theadThs[d + 1].textContent = ['??, '??, '??, '�?, '�?][d];
      }
    }
  }

  const maxPeriods = 10; // 고등?�교 ?��? 10교시 고정 ?�출

    for (let p = 1; p <= maxPeriods; p++) {
      const tr = document.createElement('tr');

      // Period Header
      const th = document.createElement('th');
      th.textContent = `${p}교시`;
      tr.appendChild(th);

      // Days 1 to 5 (??�?
      for (let d = 0; d < 5; d++) {
        const dayOfWeek = d + 1;
        const dayData = (weeklyData && Array.isArray(weeklyData) && weeklyData.length > d) ? weeklyData[d] : null;
        const slot = (dayData && dayData.slots && Array.isArray(dayData.slots) && dayData.slots.length >= p) ? dayData.slots[p - 1] : null;

        const td = document.createElement('td');
        td.className = 'timetable-cell';

        if (slot && slot.isChanged) {
          td.classList.add('is-changed');
          if (currentUser?.role !== 'STUDENT') {
            const badge = document.createElement('span');
            badge.className = 'change-badge';
            badge.textContent = slot.changeType === 'SUBSTITUTE' ? '변?? : '결강';
            td.appendChild(badge);
          }
        }

        // ?�업 ?�용???�거??subjectName/gradeName), 변�?보강 ?�력???�으�??�시
        const hasContent = slot && (slot.subjectName || slot.gradeName || slot.teacherName);
        const hasChange = slot && slot.isChanged;

        if (hasContent || hasChange) {
          const subDiv = document.createElement('div');
          subDiv.className = 'cell-subject';
          if (mode === 'CLASS') {
            subDiv.textContent = slot.subjectName || (slot.changeType === 'CANCEL' ? '결강' : slot.changeType === 'SUBSTITUTE' ? '보강' : '?�업?�음');
          } else {
            subDiv.textContent = slot.gradeName || slot.subjectName || (hasChange ? '변경됨' : '빈교??);
          }
          td.appendChild(subDiv);

          const infoDiv = document.createElement('div');
          infoDiv.className = 'cell-subinfo';
          if (mode === 'CLASS') {
            infoDiv.textContent = slot.teacherName || (hasChange ? '변�? : '');
          } else {
            infoDiv.textContent = slot.subjectName || '';
          }
          td.appendChild(infoDiv);

          if (slot.roomName && slot.roomName !== '?�반교실') {
            const roomDiv = document.createElement('div');
            roomDiv.className = 'cell-room';
            roomDiv.textContent = `?�� ${slot.roomName}`;
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

// Open Change Modal (?�자�?기본 ?�간??교시 ?� ?�동 ?�릭 ?�정)
function populateModalDropdowns(slot) {
  const subs = (currentSchoolMeta?.subjects?.length ? currentSchoolMeta.subjects : generatorData?.subjects) || [];
  const tchs = (currentSchoolMeta?.teachers?.length ? currentSchoolMeta.teachers : generatorData?.teachers) || [];

  if (changeSubjectSelect) {
    changeSubjectSelect.innerHTML = '<option value="">-- 변경할 과목 ?�택 --</option>';
    changeSubjectSelect.innerHTML += '<option value="DELETE" style="color:red; font-weight:bold;">-- ?���??�당 교시 ??�� (�??�간?�로 만들�? --</option>';
    changeSubjectSelect.innerHTML += subs.map(s => `<option value="${s.id}" ${slot?.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
  }
  if (changeTeacherSelect) {
    changeTeacherSelect.innerHTML = '<option value="">-- 교사 ?�택 --</option>' +
      tchs.map(t => `<option value="${t.id}" ${slot?.teacherId === t.id ? 'selected' : ''}>${t.name} ?�생??(${t.subject_name || t.subjectName || ''})</option>`).join('');
  }
}

// 모달 ?�롭?�운 ?�방???�동 ?�결
if (changeSubjectSelect && changeTeacherSelect) {
  changeSubjectSelect.addEventListener('change', (e) => {
    const selectedSubjId = e.target.value;
    const subs = (currentSchoolMeta?.subjects?.length ? currentSchoolMeta.subjects : generatorData?.subjects) || [];
    const tchs = (currentSchoolMeta?.teachers?.length ? currentSchoolMeta.teachers : generatorData?.teachers) || [];
    const sub = subs.find(s => s.id === selectedSubjId);
    if (sub) {
      const match = tchs.find(t => (t.subject_name || t.subjectName || '') === sub.name);
      if (match) changeTeacherSelect.value = match.id;
    }
  });

  changeTeacherSelect.addEventListener('change', (e) => {
    const selectedTchId = e.target.value;
    const subs = (currentSchoolMeta?.subjects?.length ? currentSchoolMeta.subjects : generatorData?.subjects) || [];
    const tchs = (currentSchoolMeta?.teachers?.length ? currentSchoolMeta.teachers : generatorData?.teachers) || [];
    const tch = tchs.find(t => t.id === selectedTchId);
    if (tch) {
      const subName = tch.subject_name || tch.subjectName;
      const sub = subs.find(s => s.name === subName);
      if (sub) changeSubjectSelect.value = sub.id;
    }
  });
}

function openChangeModal(targetDate, dayOfWeek, period, slot, mode) {
  if (currentUser?.role === 'STUDENT') {
    return;
  }
  if (activeTab === 'TEACHER') {
    alert('?��?��?교사 ?�간????? 조회 ?�용?�니?? ?�간??변경�? [?�자�??�간?? ?�는 [?�기 기본 ?�간?? ??��??진행?�주?�요.');
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

  const daysKor = ['??, '??, '??, '??, '�?, '�?, '??];
  const dayName = daysKor[dayOfWeek] || '??;
  const headerStr = activeTab === 'BASE' 
    ? `?�기 기본 ?�간???�본 ?�정 (${dayName}?�일 ${period}교시)` 
    : `?�자�??�업 조정 (${targetDate || '기본주간'} ${period}교시)`;

  if (slotInfoSummary) {
    slotInfoSummary.innerHTML = `
      <strong>[?�택 교시]</strong> ${headerStr} - ${gradeStr}?�년 ${classNumStr}�?br>
      <strong>[?�재 배정 ?�업]</strong> ${slot && slot.subjectName ? `${slot.subjectName} (${slot.teacherName || '교사미정'} ?�생??` : '배정 ?�음'}
    `;
  }

  // Reset form
  if (conflictAlert) conflictAlert.classList.add('hidden');
  pendingForcePayload = null;

  // 과목/교사 ?�롭?�운 채우�?
  populateModalDropdowns(slot);

  // Show Modal
  if (changeModal) changeModal.classList.remove('hidden');

  const btnSave = document.getElementById('btn-modal-save');
  if (btnSave) {
    if (slot && slot.changeType === 'HOLIDAY') {
      if (conflictList) conflictList.innerHTML = '<li>?�당 ?�자??지?�된 ?�업???�일)?��?�??�간???�정??불�??�합?�다.</li>';
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
    alert('?�택???�급 ?�보가 ?�바르�? ?�습?�다. ?�급???�택?????�시 ?�도??주세??');
    return;
  }

  const changedSubjectId = changeSubjectSelect ? changeSubjectSelect.value : null;
  const changedTeacherId = changeTeacherSelect ? changeTeacherSelect.value : null;

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
      // 1. 교사 ?�른 ?�년/�?중복 배정 검??(모든 ?�년/�?검??
      let teacherConflict = null;
      Object.keys(genClassMap).forEach(gcId => {
        if (gcId !== gradeClassId && genClassMap[gcId]?.[dayOfWeek]?.[period]) {
          const otherSlot = genClassMap[gcId][dayOfWeek][period];
          if (otherSlot.teacherId === changedTeacherId) {
            const otherGc = (generatorData?.classes || currentSchoolMeta?.gradeClasses || []).find(c => c.id === gcId);
            const otherGcName = otherGc ? `${otherGc.grade}?�년 ${otherGc.class_number || otherGc.classNumber}�? : gcId;
            const tchName = otherSlot.teacherName || teacherName || '?�당 교사';
            const daysKor = ['??, '??, '??, '??, '�?, '�?, '??];
            teacherConflict = `??[교사 중복 배정 ?�류] ${tchName} ?�생?��? ${daysKor[dayOfWeek]}?�일 ${period}교시???��? [${otherGcName}] ?�업??배정?�어 ?�습?�다!`;
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

      // 2. ?�일 과목 ?�루 중복 ?�속배정 경고
      let sameSubjToday = 0;
      if (genClassMap[gradeClassId]?.[dayOfWeek]) {
        Object.keys(genClassMap[gradeClassId][dayOfWeek]).forEach(p => {
          if (parseInt(p) !== parseInt(period) && genClassMap[gradeClassId][dayOfWeek][p]?.subjectId === changedSubjectId) {
            sameSubjToday++;
          }
        });
      }
      if (sameSubjToday >= 2) {
        const warnMsg = `?�️ [?�일 과목 중복 경고] ?�루??[${subjectName}] 과목???��? 2?�간 ?�상 배정?�어 ?�습?�다. 추�? 배치?�시겠습?�까?`;
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
        // 충돌 감�? ??버튼 ?�시
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
        alert('?�� ?�기 기본 ?�간???�업 ?�정???�공?�으�??�?�되?�습?�다!');
        if (changeModal) changeModal.classList.add('hidden');
        loadTimetable();

      } else {
        alert(data.error || '기본 ?�간???�???�패');
      }
    } catch (err) {
      console.error(err);
      alert('?�류가 발생?�습?�다.');
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
    reason: isTeacher ? '[교사 ?�스?? ?�간??' + (isDelete ? '?�당 교시 ??��' : '모의 ?�업 교체') : '?�과�??�간??' + (isDelete ? '?�당 교시 ??��' : '조정'),
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
        alert('?�� [?��??�이??모드] ?�간??변경이 ?�시 ?�용?�었?�니?? (?�버 ?�이?�에???�향???�으�? 로그?�웃 ?�는 ?�로고침 ???�래?��??�아갑니??');
      } else {
        alert('?�� ?�업 변�?보강???�공?�으�??�??�??�용?�었?�니??');
      }
      if (changeModal) changeModal.classList.add('hidden');
      loadTimetable();
    } else {
      alert(data.error || '?�업 변�??�???�패');
    }
  } catch (err) {
    console.error(err);
    alert('?�??처리 �??�류가 발생?�습?�다.');
  }
}

// ?�?� 충돌 발생 ??OK/취소 버튼 처리 ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
document.getElementById('btn-force-ok').addEventListener('click', async () => {
  if (!pendingForcePayload) return;
  const payload = pendingForcePayload;
  pendingForcePayload = null;
  conflictAlert.classList.add('hidden');

  // ?�떤 API ?�드?�인?�로 보낼지 결정
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
        alert('?�� [?��??�이??모드] 충돌??무시?�고 ?�시 강제 ?�용?�었?�니?? (?�버 ?�이?�에???�향???�으�? 로그?�웃 ?�는 ?�로고침 ???�래?��??�아갑니??');
      } else {
        alert(isBase ? '기본 ?�간?��? ?�?�되?�습?�다.' : '?�간??변경이 ?�용?�었?�니??');
      }
      changeModal.classList.add('hidden');
      loadTimetable();
    } else {
      const d = await res.json();
      alert(d.error || '?�???�패');
    }
  } catch (err) {
    console.error('Force save error:', err);
    alert('?�버 ?�류가 발생?�습?�다.');
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
        <td>${log.grade}?�년 ${log.class_number}�?/td>
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
      alert('?�업?�이 ?�공?�으�??�록?�었?�니??');
      holidaySetupForm.reset();
      loadHolidays();
      loadTimetable();
    } else {
      alert('?�일 ?�록 ?�패');
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
      adminHolidaysListUi.innerHTML = '<p class="text-center text-muted">?�록???�일???�습?�다.</p>';
      return;
    }

    list.forEach(h => {
      const div = document.createElement('div');
      div.className = 'flex justify-between items-center py-2 border-b';
      div.innerHTML = `
        <span>?�� <strong>${h.target_date}</strong>: ${h.name}</span>
        <button class="btn btn-danger btn-xs" onclick="deleteHoliday('${h.id}')" style="background-color: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px;">??��</button>
      `;
      adminHolidaysListUi.appendChild(div);
    });
  } catch (err) {
    console.error('loadHolidays error:', err);
  }
}

window.deleteHoliday = async function(id) {
  if (!confirm('?�당 ?�일????��?�시겠습?�까?')) return;
  try {
    const res = await fetch(`${API_BASE}/admin/holidays/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      alert('?�일????��?�었?�니??');
      loadHolidays();
      loadTimetable();
    } else {
      alert('?�일 ??�� ?�패');
    }
  } catch (err) {
    console.error(err);
  }
};

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�� ?�간???�동 ?�성�????�론?�엔???�동 Logic
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
let generatorData = null;
let generatedResult = null;
let genClassMap = {};       // { gradeClassId: { day: { period: slot } } }
let genCurrentClassId = null; // 미리보기?�서 ?�재 ?�택???�급

async function initGeneratorTab() {
  if (!currentUser || !currentUser.schoolId) return;
  try {
    // 기본 �?그리???�출 (?�택??최�? 교시 기�?)
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

    // 모든 ?�록??교사??과목명이 과목 ?�택 목록(subjects)??100% ?�락 ?�이 ?�어가?�록 ?�동 ?�합 (sports ?�외)
    if (generatorData && generatorData.teachers && generatorData.subjects) {
      generatorData.subjects = generatorData.subjects.filter(s => (s.name || '').toLowerCase() !== 'sports');
      const existingSubNames = new Set(generatorData.subjects.map(s => s.name));
      generatorData.teachers.forEach(t => {
        const subName = (t.subject_name || t.subjectName || '').trim();
        if (subName && subName !== '미�??? && subName.toLowerCase() !== 'sports' && !existingSubNames.has(subName)) {
          const newSub = { id: `sub-gen-${t.id}`, name: subName };
          generatorData.subjects.push(newSub);
          existingSubNames.add(subName);
        }
      });
      // 과목�????�렬
      generatorData.subjects.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }

    // 과목 ?�터 체크박스 ?�더�?
    window.renderGenSubjectFilter = function() {
      const container = document.getElementById('gen-subject-filter-container');
      if (!container) return;
      
      const subs = generatorData?.subjects || [];
      if (subs.length === 0) {
        container.innerHTML = '<span style="color:var(--text-sub);">?�록??과목???�습?�다.</span>';
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
          <label style="display:inline-flex; align-items:center; gap:0.35rem; background:var(--bg-card); padding:0.3rem 0.6rem; border-radius:6px; border:1px solid var(--border-color); cursor:pointer; user-select:none;">
            <input type="checkbox" class="gen-subject-chk" value="${s.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer;" onchange="saveGenSubjectFilters()">
            <span style="font-weight:600;">${s.name}</span>
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

    // ???�성???�급 박스 ?�더�?�??�태 관�?
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
        box.innerHTML = '<span style="font-size:0.88rem; color:var(--text-sub);">?�록???�급???�습?�다. ?�단?�서 ?�년�?반을 ?�택 ??[?�성] 버튼???�러주세??</span>';
        return;
      }

      box.innerHTML = window.activeGenClassIds.map(gcId => {
        const gc = classesList.find(c => c.id === gcId);
        const gcName = gc ? `${gc.grade}?�년 ${gc.class_number || gc.classNumber}�? : gcId;
        const isSelected = gcId === genCurrentClassId;
        return `
          <span class="gen-class-badge" style="display:inline-flex; align-items:center; gap:0.4rem; background:${isSelected ? 'var(--primary-color)' : 'var(--bg-card)'}; color:${isSelected ? '#ffffff' : 'var(--text-main)'}; padding:0.35rem 0.75rem; border-radius:20px; border:1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}; font-weight:700; font-size:0.88rem; cursor:pointer; user-select:none; transition:all 0.2s;">
            <span onclick="window.selectActiveGenClass('${gcId}')">${gcName}</span>
            <span onclick="event.stopPropagation(); window.removeActiveGenClass('${gcId}')" style="font-size:0.9rem; opacity:0.8; margin-left:0.2rem; cursor:pointer;" title="목록?�서 ??��">&times;</span>
          </span>
        `;
      }).join('');
    };

    window.selectActiveGenClass = function(gcId) {
      if (window.saveCurrentClassHours && genCurrentClassId) {
        window.saveCurrentClassHours(genCurrentClassId);
      }
      genCurrentClassId = gcId;
      if (window.loadClassHours) {
        window.loadClassHours(gcId);
      }
      window.renderCreatedClassBadges();
      buildPreviewChips(window.activeGenClassIds);
      const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
      renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
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
          alert(`${grade}?�년 ${classNum}반�? ?�교 ?�정???�록?�어 ?��? ?�습?�다. [?�️ ?�교/교사 ?�정] ??��??먼�? 반을 ?�록?�주?�요.`);
          return;
        }

        if (!window.activeGenClassIds.includes(classObj.id)) {
          window.activeGenClassIds.push(classObj.id);
          localStorage.setItem('genSelectedClassIds', JSON.stringify(window.activeGenClassIds));
        }

        window.selectActiveGenClass(classObj.id);
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

    // ??과목/교사/?�수 ?�력???�성
    const subjectBody = document.getElementById('gen-subject-body');
    if (subjectBody) {
      subjectBody.innerHTML = '';
      
      window.saveGeneratorRowsState = function() {
        const rows = [];
        document.querySelectorAll('.gen-row').forEach(row => {
          const subjectId = row.querySelector('.gen-subject-select')?.value || '';
          const teacherId = row.querySelector('.gen-teacher-select')?.value || '';
          const hours = row.querySelector('.gen-hours-input')?.value || '';
          rows.push({ subjectId, teacherId, hours });
        });
        localStorage.setItem('generator_rows_' + currentUser.schoolId, JSON.stringify(rows));
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
          return `<option value="${t.id}" ${isSelected}>${t.name} ?�생??(${t.subject_name || t.subjectName || ''})</option>`;
        }).join('');

        tr.innerHTML = `
          <td>
            <select class="form-select gen-subject-select" style="padding:0.35rem 0.5rem; font-size:0.88rem;">
              <option value="">-- ?�택 --</option>
              ${subjectOptions}
            </select>
          </td>
          <td>
            <select class="form-select gen-teacher-select" style="padding:0.35rem 0.5rem; font-size:0.88rem;">
              <option value="">-- ?�택 --</option>
              ${teacherOptions}
            </select>
          </td>
          <td>
            <input type="number" class="form-input gen-hours-input" min="0" max="10" value="${valHours}" placeholder="?�수 ?�력" style="width:70px; padding:0.35rem; font-size:0.9rem; text-align:center;"> ?�간/�?
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn btn-sm btn-outline btn-row-delete" style="color:var(--danger-color); border-color:var(--danger-color); padding:0.25rem 0.5rem; font-size:0.8rem;">??��</button>
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
        const subjectBody = document.getElementById('gen-subject-body');
        if (subjectBody) subjectBody.innerHTML = '';
        const allTeachers = generatorData.teachers || [];
        if (allTeachers.length === 0) {
          window.addGenRow();
        } else {
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
          if (window.saveGeneratorRowsState) window.saveGeneratorRowsState();
        });
      }

      // Load rows state from localStorage
      const savedRowsStr = localStorage.getItem('generator_rows_' + currentUser.schoolId);
      if (savedRowsStr) {
        try {
          const savedRows = JSON.parse(savedRowsStr);
          savedRows.forEach(r => {
            window.addGenRow(r.subjectId, r.teacherId, r.hours);
          });
        } catch (err) {
          console.error(err);
          loadDefaultRows();
        }
      } else {
        loadDefaultRows();
      }

      // ?�급�??�립 ?�수 ?�?�소
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

        const subjectBody = document.getElementById('gen-subject-body');
        if (!subjectBody) return;
        subjectBody.innerHTML = '';

        const classRows = window.genClassHoursMap[classId];
        if (classRows && classRows.length > 0) {
          classRows.forEach(r => window.addGenRow(r.subjectId, r.teacherId, r.hours));
        } else {
          loadDefaultRows();
        }
      };

      window.saveGeneratorRowsState = function() {
        if (genCurrentClassId) {
          window.saveCurrentClassHours(genCurrentClassId);
        }
      };
    }
    
    // 로컬 ?�토리�??�서 ?�전 ?�태 복원
    const savedClassIds = localStorage.getItem('genSelectedClassIds');
    const savedClassMap = localStorage.getItem('genClassMap');
    const savedResult = localStorage.getItem('genResult');
    if (savedClassIds && savedClassMap && savedResult) {
      try {
        const parsedIds = JSON.parse(savedClassIds);
        genClassMap = JSON.parse(savedClassMap);
        generatedResult = JSON.parse(savedResult);
        
        // 미리보기 �?�????�더�?
        if (parsedIds.length > 0) {
          if (!genCurrentClassId) genCurrentClassId = parsedIds[0];
          buildPreviewChips(parsedIds);
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

// (?�체 ?�택/?�제 기능 ?�거??

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// AI ?�동 ?�성 ?�작
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
document.getElementById('btn-generate')?.addEventListener('click', async () => {
  const selectedClassIds = window.activeGenClassIds && window.activeGenClassIds.length > 0 ? window.activeGenClassIds : [];
  if (selectedClassIds.length === 0) {
    alert('?�간?��? ?�용???�급??최소 1�??�상 ?�성?�주?�요!');
    return;
  }

  const targetSubjectIds = Array.from(document.querySelectorAll('.gen-subject-chk:checked')).map(c => c.value);
  if (targetSubjectIds.length === 0) {
    alert('?�동 ?�성 ?�??과목??최소 1�??�상 ?�택??주세??');
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
    alert('주간 ?�수가 1?�간 ?�상??과목???�습?�다. ?�수�??�력?�주?�요.');
    return;
  }

  const assignments = selectedClassIds.map(gcId => ({ gradeClassId: gcId, subjects: subjectsList }));

  // 기존 ?�동 ?�성???� 고정 목록 추출
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
      if (btnGen) { btnGen.textContent = '???�간??배정 ?�업 �?..'; btnGen.disabled = true; }

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

      if (btnGen) { btnGen.textContent = '?�� ?�간???�동 ?�성 ?�작'; btnGen.disabled = false; }

      if (!res.ok) { alert('?�동 ?�성 ?�패'); return; }

      const data = await res.json();

      if (!allowOverlap && data.unassigned && data.unassigned.length > 0) {
        const wantsOverlap = confirm('?�아�? ?�율 ?�동 ??공통 교과�??�해 교사 배정??겹쳐 ?�성?��? 못한 ?�간???�습?�다.\n교사 중첩???�용?�여 강제�?배정?�시겠습?�까?');
        if (wantsOverlap) {
          return await executeGenerator(true);
        }
      }

      if (!generatedResult) generatedResult = [];
      const newlyGeneratedClasses = [...new Set(data.timetable.map(t => t.gradeClassId))];
      generatedResult = generatedResult.filter(r => !newlyGeneratedClasses.includes(r.gradeClassId));
      generatedResult.push(...data.timetable);

      // 기존 ?�동 배치 ?��??�며 AI ?�성 결과 ?�합 (classMap ?�데?�트)
      if (!genClassMap) genClassMap = {};
      (data.timetable || []).forEach(t => {
        if (!genClassMap[t.gradeClassId]) genClassMap[t.gradeClassId] = {};
        if (!genClassMap[t.gradeClassId][t.dayOfWeek]) genClassMap[t.gradeClassId][t.dayOfWeek] = {};
        genClassMap[t.gradeClassId][t.dayOfWeek][t.period] = t;
      });

      // 미배???�림
      const unassignedAlert = document.getElementById('gen-unassigned-alert');
      const unassignedList = document.getElementById('gen-unassigned-list');
      if (data.unassigned && data.unassigned.length > 0) {
        if (unassignedAlert) unassignedAlert.classList.remove('hidden');
        if (unassignedList) {
          unassignedList.innerHTML = '';
          data.unassigned.forEach(u => {
            const gc = (generatorData?.classes || []).find(c => c.id === u.gradeClassId);
            const li = document.createElement('li');
            li.textContent = `${gc ? `${gc.grade}?�년 ${gc.class_number}�? : ''} - ${u.subjectName} (${u.teacherName} ?�생??`;
            unassignedList.appendChild(li);
          });
        }
      } else {
        if (unassignedAlert) unassignedAlert.classList.add('hidden');
      }

      // ?�급 �?채우�?�?로컬 ?�토리�? ?�??
      localStorage.setItem('genSelectedClassIds', JSON.stringify(selectedClassIds));
      localStorage.setItem('genClassMap', JSON.stringify(genClassMap));
      localStorage.setItem('genResult', JSON.stringify(generatedResult));

      buildPreviewChips(selectedClassIds);
      if (selectedClassIds.length > 0) {
        genCurrentClassId = selectedClassIds[0];
        const maxPeriodSelect = document.getElementById('gen-max-period-select');
        const maxPeriodsPerDay = maxPeriodSelect ? parseInt(maxPeriodSelect.value) : 10;
        renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
      }

      alert(`?�� AI ?�간???�동 ?�성 ?�료!\n${selectedClassIds.length}�??�급 × ${subjectsList.length}�?과목\n?�래 미리보기�??�인 ???�정?�세??`);

    } catch (err) {
      if (btnGen) { btnGen.textContent = '?�� AI ?�간???�동 ?�성 ?�작'; btnGen.disabled = false; }
      console.error('Generate error:', err);
      alert('?�성 �??�류가 발생?�습?�다.');
    }
  };

  await executeGenerator(false);
});

// ?�시 ?�성
document.getElementById('btn-regen')?.addEventListener('click', () => {
  document.getElementById('btn-generate')?.click();
});

// ?�당 ?�급 초기??
document.getElementById('btn-reset-current-class')?.addEventListener('click', () => {
  if (!genCurrentClassId) {
    alert('초기?�할 ?�급???�택?��? ?�았?�니??');
    return;
  }
  const gc = (generatorData?.classes || currentSchoolMeta?.gradeClasses || []).find(c => c.id === genCurrentClassId);
  const gcName = gc ? `${gc.grade}?�년 ${gc.class_number || gc.classNumber}�? : '?�택???�급';

  if (!confirm(`?�️ [${gcName}] ???�간???�이?��? 초기?�하?�겠?�니�?\n?�른 ?�급???�간?�는 ?��??�고 ?�재 ?�택???�급�?초기?�됩?�다.`)) return;

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
  alert(`?���?[${gcName}] ?�간?��? 초기?�되?�습?�다.`);
});

// ?�체 ?�년/�?초기??
document.getElementById('btn-reset-all-classes')?.addEventListener('click', () => {
  if (!confirm('?�️ 경고: ?�체 ?�년 �??�급??미리보기 ?�간???�이?��? 모두 초기?�하?�겠?�니�?\n???�업?� ?�돌�????�습?�다.')) return;

  genClassMap = {};
  generatedResult = [];

  localStorage.removeItem('genSelectedClassIds');
  localStorage.removeItem('genClassMap');
  localStorage.removeItem('genResult');

  const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
  renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
  alert('?���??�체 ?�년/반의 ?�간???�이?��? ?�전??초기?�되?�습?�다.');
});

// 버튼 ?�릭??�?변�?로직?� buildPreviewChips ?��????�함??
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
      targetDropdown.innerHTML = '<option value="">-- ?�급 ?�택 --</option>';
    } else {
      targetDropdown.innerHTML = classIds.map(gcId => {
        const gc = (generatorData?.classes || currentSchoolMeta?.gradeClasses || []).find(c => c.id === gcId);
        const gcName = gc ? `${gc.grade}?�년 ${gc.class_number || gc.classNumber || ''}�? : gcId;
        return `<option value="${gcId}" ${gcId === genCurrentClassId ? 'selected' : ''}>${gcName}</option>`;
      }).join('');
    }

    if (!targetDropdown.dataset.bound) {
      targetDropdown.dataset.bound = 'true';
      targetDropdown.addEventListener('change', (e) => {
        const selectedGcId = e.target.value;
        if (!selectedGcId) return;
        if (window.saveCurrentClassHours && genCurrentClassId) {
          window.saveCurrentClassHours(genCurrentClassId);
        }
        genCurrentClassId = selectedGcId;
        if (window.loadClassHours) {
          window.loadClassHours(selectedGcId);
        }
        const maxPeriodsPerDay = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10;
        renderGenGrid(genCurrentClassId, maxPeriodsPerDay);
      });
    }
  }
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�동 ?�성 ??미리보기 그리???�더�?(timetable-body-gen ?�용)
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
function renderGenGrid(gradeClassId, maxPeriods) {
  const tbody = document.getElementById('timetable-body-gen');
  if (!tbody) return;
  tbody.innerHTML = '';
  const periods = maxPeriods || 10;
  const classMap = gradeClassId ? genClassMap[gradeClassId] : null;
  const gc = gradeClassId ? (generatorData?.classes || []).find(c => c.id === gradeClassId) : null;

  // ?�수 검�??�림�??�더�?
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
    const gcName = gc ? `${gc.grade}?�년 ${gc.class_number || gc.classNumber}�? : gradeClassId;

    if (totalPlacedCount === 0) {
      hoursStatusContainer.innerHTML = `
        <div style="background:var(--bg-surface); padding:0.6rem 0.85rem; border-radius:8px; border:1px solid var(--border-color); display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
          <span style="font-weight:700; color:var(--primary-color);">?�� [${gcName} ?�수 충족 ?�황]:</span>
          <span style="color:var(--text-sub); font-size:0.85rem; font-weight:600;">?�간??배치 ??초기???�태)?�니?? [?�간???�동 ?�성] ?�는 ?�???�러 ?�동 배치?�세??</span>
        </div>
      `;
    } else {
      const statusBadges = targetHours.map(th => {
        if (!th.subjectId || !th.hours) return '';
        const target = parseInt(th.hours) || 0;
        const placed = placedCounts[th.subjectId] || 0;
        const subName = (generatorData?.subjects || []).find(s => s.id === th.subjectId)?.name || '과목';

        if (placed === target) {
          return `<span style="background:rgba(16, 185, 129, 0.12); color:#059669; padding:0.25rem 0.55rem; border-radius:12px; font-weight:600;">??${subName}: ${placed}/${target}?�간 (?�료)</span>`;
        } else if (placed < target) {
          return `<span style="background:rgba(239, 68, 68, 0.12); color:#dc2626; padding:0.25rem 0.55rem; border-radius:12px; font-weight:600;">?�️ ${subName}: ${placed}/${target}?�간 (${target - placed}?�간 부�?</span>`;
        } else {
          return `<span style="background:rgba(245, 158, 11, 0.12); color:#d97706; padding:0.25rem 0.55rem; border-radius:12px; font-weight:600;">?�️ ${subName}: ${placed}/${target}?�간 (${placed - target}?�간 초과)</span>`;
        }
      }).filter(Boolean);

      hoursStatusContainer.innerHTML = `
        <div style="background:var(--bg-surface); padding:0.6rem 0.85rem; border-radius:8px; border:1px solid var(--border-color); display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center;">
          <span style="font-weight:700; color:var(--primary-color);">?�� [${gcName} ?�수 충족 ?�황]:</span>
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
        emptyDiv.textContent = gradeClassId ? '-' : '?�성 ??;
        td.appendChild(emptyDiv);
      }

      // ?�릭 ???�동 ?�정 모달 ?�기 (BASE ??�� ?�일??모달 ?�사??
      td.addEventListener('click', () => {
        if (!gradeClassId) {
          alert('먼�? ?�급???�택?�주?�요.');
          return;
        }
        openGenCellModal(gradeClassId, d, p, slot, gc);
      });

      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�동?�성 ???� ?�동 ?�정 모달 (기존 changeModal ?�사??
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
function openGenCellModal(gradeClassId, dayOfWeek, period, slot, gc) {
  const daysKor = ['??, '??, '??, '??, '�?, '�?, '??];
  const dayName = daysKor[dayOfWeek] || '?';
  const gcName = gc ? `${gc.grade}?�년 ${gc.class_number}�? : '';

  if (slotInfoSummary) {
    slotInfoSummary.innerHTML = `
      <strong>[?�동?�성 ?�정]</strong> ${gcName} ${dayName}?�일 ${period}교시<br>
      <strong>[?�재 배정]</strong> ${slot ? `${slot.subjectName} (${slot.teacherName} ?�생??` : '배정 ?�음'}
    `;
  }
  if (conflictAlert) conflictAlert.classList.add('hidden');
  pendingForcePayload = null;

  // 과목/교사 ?�?�트 채우�?
  populateModalDropdowns(slot);

  // selectedSlotData �?activeTab 바인??
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

// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
// ?�체 ?�년/�?기본 ?�간?�로 최종 ?�용
// ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
document.getElementById('btn-apply-timetable')?.addEventListener('click', async () => {
  if (!generatedResult || generatedResult.length === 0) {
    alert('?�용???�간???�이?��? ?�습?�다. AI ?�동 ?�성 ?�는 ?�동 ?�력 ???�도?�주?�요.');
    return;
  }
  if (!confirm(`?�성???�간?��? ???�년/�?기본 ?�간?�로 최종 ?�?�할까요?\n�?${generatedResult.length}�??�업 ?�롯???�?�됩?�다.\n\n?�️ 기존 기본 ?�간?�는 ??��?�워집니??`)) return;

  try {
    const res = await fetch(`${API_BASE}/generator/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: currentUser.schoolId, timetable: generatedResult })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`?�� ?�간???�용 ?�료!\n�?${data.applied}�??�업??기본 ?�간?�에 ?�?�되?�습?�다.\n?�제 [?�기 기본 ?�간?? ??��???�인?????�습?�다.`);
      // ?�기 기본 ?�간????���??�동 + ?�로고침
      switchTab('BASE');
      loadTimetable();

    } else {
      alert(data.error || '?�간???�용 ?�패');
    }
  } catch (err) {
    console.error('Apply timetable error:', err);
    alert('?�용 처리 �??�류가 발생?�습?�다.');
  }
});

document.getElementById('btn-reset-timetable')?.addEventListener('click', async () => {
  if (!confirm('?�️ 경고: ?�간??초기?��? 진행?�시�?지금까지 ?�력 �??�성??모든 ?�급???�간???�이???�기 기본 ?�간??�??�자�??�간??변�??�역)가 ?�전????��?�니??\n\n???�업?� ?�돌�????�습?�다. ?�말�?초기?�하?�겠?�니�?')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/reset-timetable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: currentUser.schoolId })
    });
    const data = await res.json();
    if (res.ok) {
      alert('?�� ?�교??모든 ?�간???�이?��? ?�전??초기?�되?�습?�다.');
      window.sandboxChanges = [];
      loadTimetable();
      if (activeTab === 'GENERATOR') {
        initGeneratorTab();
      }
    } else {
      alert(data.error || '초기???�패');
    }
  } catch (err) {
    console.error(err);
    alert('?�버 ?�신 ?�류가 발생?�습?�다.');
  }
});

document.querySelectorAll('.btn-main-reset').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!confirm('?�️ 경고: ?�간??초기?��? 진행?�시�??�교??모든 ?�간???�이???�기 ?�간??�??�자�??�간??변�??�역)가 ?�전????��?�니??\n\n???�업?� ?�돌�????�습?�다. ?�말�?초기?�하?�겠?�니�?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/reset-timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: currentUser.schoolId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('?�� ?�교??모든 ?�간???�이?��? ?�전??초기?�되?�습?�다.');
        window.sandboxChanges = [];
        loadTimetable();
        if (activeTab === 'GENERATOR') {
          initGeneratorTab();
        }
      } else {
        alert(data.error || '초기???�패');
      }
    } catch (err) {
      console.error(err);
      alert('?�버 ?�신 ?�류가 발생?�습?�다.');
    }
  });
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


// ?���?Delete button in Modal
document.getElementById('btn-modal-delete')?.addEventListener('click', () => {
  if (confirm('?�말�??�당 교시�???��(�??�간)?�시겠습?�까?')) {
    document.getElementById('modal-change-subject').value = 'DELETE';
    document.getElementById('modal-change-teacher').value = ''; // Teacher not needed for delete
    handleApplyChange();
  }
});

// ?�� Load Base Timetable button in Generator
document.getElementById('btn-load-base-timetable')?.addEventListener('click', async () => {
  if (!currentUser || !currentUser.schoolId) return;
  if (!confirm('기존 ?�성???�기 ?�간?��? 불러?�시겠습?�까? ?�재 ?�성 중인 ?�간?��? ??��?�니??')) return;
  try {
    const res = await fetch(API_BASE + '/admin/base-timetable-all?schoolId=' + currentUser.schoolId);
    if (!res.ok) throw new Error('Failed to load base timetable');
    const data = await res.json();
    
    // Format data into genClassMap
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

    if (typeof genCurrentClassId !== 'undefined' && genCurrentClassId) { const max = document.getElementById('gen-max-period-select') ? parseInt(document.getElementById('gen-max-period-select').value) : 10; renderGenGrid(genCurrentClassId, max); }
  } catch (err) {
    console.error(err);
    alert('기존 ?�간?��? 불러?�는 �??�류가 발생?�습?�다.');
  }
});
