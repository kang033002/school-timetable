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
      schoolsListUi.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-sub);">등록 신청된 학교가 없습니다.</td></tr>';
      return;
    }

    schools.forEach(s => {
      const tr = document.createElement('tr');
      const statusBadge = s.status === 'APPROVED' 
        ? '<span class="badge badge-approved">승인 완료</span>' 
        : '<span class="badge badge-pending">대기 중</span>';

      const actions = s.status === 'APPROVED'
        ? `<button class="btn btn-danger btn-sm" onclick="approveSchool('${s.id}', 'REJECTED')">비활성화</button>`
        : `<button class="btn btn-success btn-sm" onclick="approveSchool('${s.id}', 'APPROVED')">승인</button>`;

      tr.innerHTML = `
        <td>${s.id}</td>
        <td><code>${s.code}</code></td>
        <td><strong>${s.name}</strong></td>
        <td><code style="color:var(--primary-color);">${s.admin_username || '-'}</code></td>
        <td><code>${s.admin_password || '-'}</code></td>
        <td>${statusBadge}</td>
        <td class="action-cell">${actions}</td>
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
