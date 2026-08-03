const isNativeApp = !!window.Capacitor || (window.location.hostname === 'localhost' && !window.location.port);
const defaultBase = isNativeApp ? 'http://10.0.2.2:3000' : '';
const savedServer = localStorage.getItem('api_server_url') || defaultBase;
const API_BASE = `${savedServer}/api`;

let token = localStorage.getItem('master_token');

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const btnLogout = document.getElementById('btn-logout');
const schoolsListUi = document.getElementById('schools-list-ui');

document.addEventListener('DOMContentLoaded', () => {
  // Show advanced server URL settings box if running on mobile device
  if (isNativeApp) {
    const configSec = document.getElementById('api-config-section');
    if (configSec) {
      configSec.classList.remove('hidden');
      document.getElementById('api-server-url').value = localStorage.getItem('api_server_url') || defaultBase;
    }
  }

  if (token) {
    showDashboard();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Save custom server URL if on mobile
    if (isNativeApp) {
      const customUrl = document.getElementById('api-server-url').value.trim();
      if (customUrl) {
        const prevUrl = localStorage.getItem('api_server_url') || defaultBase;
        localStorage.setItem('api_server_url', customUrl);
        if (customUrl !== prevUrl) {
          window.location.reload();
          return;
        }
      }
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.user.role === 'MASTER_ADMIN') {
        localStorage.setItem('master_token', data.token);
        localStorage.setItem('master_userId', data.user.id);
        token = data.token;
        showDashboard();
      } else {
        alert(data.error || '마스터 관리자만 로그인할 수 있습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  });

  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('master_token');
    localStorage.removeItem('master_userId');
    token = null;
    dashboardScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  });

  const credentialsForm = document.getElementById('master-credentials-form');
  credentialsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = localStorage.getItem('master_userId') || 'u-master';
    const newUsername = document.getElementById('new-master-username').value;
    const newPassword = document.getElementById('new-master-password').value;

    try {
      const res = await fetch(`${API_BASE}/master/change-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, newUsername, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        alert('마스터 로그인 정보가 성공적으로 변경되었습니다. 다시 로그인해주세요.');
        localStorage.removeItem('master_token');
        localStorage.removeItem('master_userId');
        token = null;
        dashboardScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        credentialsForm.reset();
      } else {
        alert(data.error || '정보 변경 실패');
      }
    } catch (err) {
      console.error(err);
      alert('통신 중 오류가 발생했습니다.');
    }
  });
});

function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  loadSchools();
}

async function loadSchools() {
  try {
    const res = await fetch(`${API_BASE}/master/schools`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('master_token');
      localStorage.removeItem('master_userId');
      token = null;
      dashboardScreen.classList.add('hidden');
      loginScreen.classList.remove('hidden');
      return;
    }
    const schools = await res.json();

    schoolsListUi.innerHTML = '';
    if (schools.length === 0) {
      schoolsListUi.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-sub);">등록 신청된 학교가 없습니다.</td></tr>';
      return;
    }

    schools.forEach(s => {
      const tr = document.createElement('tr');
      const statusBadge = s.status === 'APPROVED' 
        ? '<span class="badge badge-approved">승인 완료</span>' 
        : '<span class="badge badge-pending">대기 중</span>';

      const updateBtn = `<button class="btn btn-primary btn-sm" onclick="updateSchoolAdmin('${s.id}')">수정</button>`;

      const actions = s.status === 'APPROVED'
        ? `<button class="btn btn-danger btn-sm" onclick="approveSchool('${s.id}', 'REJECTED')">비활성화</button>`
        : `<button class="btn btn-success btn-sm" onclick="approveSchool('${s.id}', 'APPROVED')">승인</button>`;

      const deleteBtn = `<button class="btn btn-outline btn-sm" style="border:1px solid var(--danger-color); color:var(--danger-color); padding: 0.4rem 0.8rem; border-radius: 6px; background: transparent; cursor: pointer;" onclick="deleteSchool('${s.id}')">삭제</button>`;

      tr.innerHTML = `
        <td style="text-align: center;"><input type="checkbox" class="school-cb" value="${s.id}"></td>
        <td>${s.id}</td>
        <td><code>${s.code}</code></td>
        <td><strong>${s.name}</strong> <span style="font-size: 0.8em; color: var(--text-sub);">${s.school_type || ''}</span></td>
        <td><input type="text" class="form-input" id="admin-username-${s.id}" value="${s.admin_username || ''}" style="padding: 4px; font-size: 0.85em; width: 140px; background: rgba(0,0,0,0.3); border:1px solid var(--border-color); color:var(--text-color); border-radius: 4px;"></td>
        <td><input type="text" class="form-input" id="admin-password-${s.id}" value="${s.admin_password || ''}" style="padding: 4px; font-size: 0.85em; width: 100px; background: rgba(0,0,0,0.3); border:1px solid var(--border-color); color:var(--text-color); border-radius: 4px;"></td>
        <td>${statusBadge}</td>
        <td class="action-cell">${updateBtn} ${actions} ${deleteBtn}</td>
      `;
      schoolsListUi.appendChild(tr);
    });
  } catch (err) {
    console.error('Load schools error:', err);
  }
}

window.approveSchool = async function(schoolId, status) {
  const actionText = status === 'APPROVED' ? '승인' : '비활성화';
  if (!confirm(`해당 학교를 ${actionText} 처리하시겠습니까?`)) return;

  try {
    const res = await fetch(`${API_BASE}/master/schools/approve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ schoolId, status })
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      loadSchools();
    } else {
      alert(data.error || '처리 실패');
    }
  } catch (err) {
    console.error(err);
  }
};

window.deleteSchool = async function(schoolId) {
  if (!confirm('정말로 이 학교를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며 학교와 연관된 모든 데이터가 영구적으로 삭제됩니다.')) return;

  try {
    const res = await fetch(`${API_BASE}/master/schools/${schoolId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      loadSchools();
      updateBatchDeleteBtn();
    } else {
      alert(data.error || '삭제 실패');
    }
  } catch (err) {
    console.error(err);
  }
};

document.addEventListener('change', (e) => {
  if (e.target.id === 'check-all-schools') {
    const isChecked = e.target.checked;
    document.querySelectorAll('.school-cb').forEach(cb => cb.checked = isChecked);
    updateBatchDeleteBtn();
  } else if (e.target.classList.contains('school-cb')) {
    updateBatchDeleteBtn();
  }
});

function updateBatchDeleteBtn() {
  const checked = document.querySelectorAll('.school-cb:checked');
  const btnSelected = document.getElementById('btn-delete-selected');
  if (!btnSelected) return;
  
  if (checked.length > 0) {
    btnSelected.textContent = `선택 삭제 (${checked.length})`;
  } else {
    btnSelected.textContent = `선택 삭제`;
  }
  
  const allCb = document.querySelectorAll('.school-cb');
  const mainCb = document.getElementById('check-all-schools');
  if (mainCb && allCb.length > 0) {
    mainCb.checked = checked.length === allCb.length;
  }
}

document.addEventListener('click', async (e) => {
  if (e.target.id === 'btn-delete-selected') {
    const checked = document.querySelectorAll('.school-cb:checked');
    if (checked.length === 0) {
      alert('삭제할 학교를 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${checked.length}개의 학교를 삭제하시겠습니까? 모든 정보가 영구 삭제됩니다.`)) return;

    const schoolIds = Array.from(checked).map(cb => cb.value);

    try {
      const res = await fetch(`${API_BASE}/master/schools/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('master_token')}` },
        body: JSON.stringify({ schoolIds })
      });
      if (res.ok) {
        alert('선택한 학교가 삭제되었습니다.');
        loadSchools();
      } else {
        const data = await res.json();
        alert(data.error || '삭제 실패');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  }
  
  if (e.target.id === 'btn-delete-all') {
    const allCb = document.querySelectorAll('.school-cb');
    if (allCb.length === 0) {
      alert('삭제할 학교가 없습니다.');
      return;
    }

    if (!confirm(`정말 모든 학교(${allCb.length}개)를 삭제하시겠습니까? 모든 정보가 영구 삭제됩니다.`)) return;

    const schoolIds = Array.from(allCb).map(cb => cb.value);

    try {
      const res = await fetch(`${API_BASE}/master/schools/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('master_token')}` },
        body: JSON.stringify({ schoolIds })
      });
      if (res.ok) {
        alert('모든 학교가 삭제되었습니다.');
        loadSchools();
      } else {
        const data = await res.json();
        alert(data.error || '삭제 실패');
      }
    } catch (err) {
      console.error(err);
      alert('오류가 발생했습니다.');
    }
  }
});

window.updateSchoolAdmin = async function(schoolId) {
  const adminUsername = document.getElementById(`admin-username-${schoolId}`).value.trim();
  const adminPassword = document.getElementById(`admin-password-${schoolId}`).value.trim();

  if (!adminUsername || !adminPassword) {
    alert('관리자 ID와 비밀번호를 모두 입력해주세요.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/master/schools/update-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ schoolId, adminUsername, adminPassword })
    });
    const data = await res.json();
    if (res.ok) {
      alert('🎉 관리자 계정 정보가 성공적으로 변경되었습니다!');
      loadSchools();
    } else {
      alert(data.error || '정보 수정 실패');
    }
  } catch (err) {
    console.error(err);
    alert('서버 통신 중 오류가 발생했습니다.');
  }
};
