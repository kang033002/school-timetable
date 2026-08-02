const fs = require('fs');
const filePath = 'C:/Users/kang0/.gemini/antigravity/scratch/school-timetable-app/backend/public/admin/index.html';
const html = fs.readFileSync(filePath, 'utf8');

const startMarker = '<!-- School Settings View Panel -->';
const endMarker = '<!-- Timetable Grid Display -->';

const startIndex = html.indexOf(startMarker);
const endIndex = html.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('ERROR: Markers not found!', { startIndex, endIndex });
  process.exit(1);
}

const replacementText = `<!-- School Settings View Panel -->
        <div id="settings-panel" class="settings-container hidden">
          <div class="settings-header">
            <h3>⚙️ 학교 및 교사 행정 설정</h3>
            <span class="subtext">기초 정보 구축 및 가입 승인 처리</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <!-- Row 1: 3 Shortcuts (Left) + Class Setup Form (Right) -->
            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.5rem;">
              <!-- Left Column: Shortcuts -->
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- 1. Pending Approvals Shortcut -->
                <div class="settings-card" style="cursor:pointer; margin:0;" onclick="openPendingApprovalsOverlay()">
                  <h4 style="margin-bottom:0.5rem; color:var(--primary-color);">👥 가입 승인 대기 목록</h4>
                  <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.8rem;">신규 학생 및 교사의 가입 신청을 조회하여 일괄 승인 또는 반려 처리를 새 창으로 엽니다.</p>
                  <button type="button" class="btn btn-outline btn-block" style="padding:0.4rem;">관리 창 열기</button>
                </div>
                
                <!-- 2. Approved Students Shortcut -->
                <div class="settings-card" style="cursor:pointer; margin:0;" onclick="openStudentMgmtOverlay()">
                  <h4 style="margin-bottom:0.5rem; color:var(--primary-color);">🎓 가입 완료 학생 관리</h4>
                  <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.8rem;">가입 완료된 학생들의 학년/반 조회, 패스워드 확인, 개별/선택 일괄 삭제를 새 창으로 엽니다.</p>
                  <button type="button" class="btn btn-outline btn-block" style="padding:0.4rem;">관리 창 열기</button>
                </div>
                
                <!-- 3. Teacher Management Shortcut -->
                <div class="settings-card" style="cursor:pointer; margin:0;" onclick="openTeacherMgmtOverlay()">
                  <h4 style="margin-bottom:0.5rem; color:var(--primary-color);">👩‍🏫 교사 등록 및 관리</h4>
                  <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:0.8rem;">신규 교사 등록, 담당 과목 변경, 계정 및 비밀번호 설정, 교사 목록 조회를 새 창으로 엽니다.</p>
                  <button type="button" class="btn btn-outline btn-block" style="padding:0.4rem;">관리 창 열기</button>
                </div>
              </div>

              <!-- Right Column: Class Setup Form -->
              <div class="settings-card" id="card-class-setup" style="margin:0; display:flex; flex-direction:column; justify-content:center;">
                <h4>🏫 학년/학급 생성 및 담임 지정</h4>
                <form id="class-setup-form" style="margin-top:0.5rem;">
                  <div class="form-group">
                    <label>학년</label>
                    <input type="number" id="class-setup-grade" class="form-input" min="1" max="6" required placeholder="예: 1">
                  </div>
                  <div class="form-group">
                    <label>반</label>
                    <input type="number" id="class-setup-number" class="form-input" min="1" max="20" required placeholder="예: 1">
                  </div>
                  <div class="form-group">
                    <label>담임 교사 지정</label>
                    <select id="class-setup-homeroom" class="form-select"></select>
                  </div>
                  <button type="submit" class="btn btn-primary btn-block" style="margin-top:1rem; padding:0.6rem;">학급 생성/수정 저장</button>
                </form>
              </div>
            </div>

            <!-- Row 2: Class Management (Full Width) -->
            <div class="settings-card" id="card-class-management" style="margin:0; width:100%;">
              <h4 style="margin-bottom: 1rem;">🏫 학년/학급 생성 및 담임 관리</h4>
              <div class="table-responsive">
                <table class="logs-table">
                  <thead>
                    <tr>
                      <th>학년</th>
                      <th>학급</th>
                      <th>담임</th>
                      <th style="text-align: center;">작업</th>
                    </tr>
                  </thead>
                  <tbody id="admin-classes-table-body">
                    <!-- Dynamic -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Row 3: Account Credentials (Left) & Holiday Settings (Right) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
              <!-- Left: Credentials Form -->
              <div class="settings-card" id="card-account-settings" style="margin:0;">
                <h4>🔐 담당자 계정 정보 변경</h4>
                <form id="admin-credentials-form" style="margin-top:0.5rem;">
                  <div class="form-group">
                    <label>로그인 이메일 (아이디)</label>
                    <input type="email" id="admin-setup-email" class="form-input" required placeholder="admin@seoul.hs.kr">
                  </div>
                  <div class="form-group">
                    <label>새 비밀번호</label>
                    <input type="password" id="admin-setup-password" class="form-input" required placeholder="새 비밀번호 입력">
                  </div>
                  <button type="submit" class="btn btn-primary btn-block" style="margin-top:1rem; padding:0.6rem;">계정 정보 변경 적용</button>
                </form>
              </div>

              <!-- Right: Holiday settings -->
              <div class="settings-card" id="card-holidays-manager" style="margin:0;">
                <h4>📅 학업 휴일 설정 및 등록 (휴업일)</h4>
                <form id="holiday-setup-form" style="margin-top:0.5rem;">
                  <div class="form-group" style="margin-bottom:0.75rem;">
                    <label>날짜</label>
                    <input type="date" id="holiday-setup-date" class="form-input" required>
                  </div>
                  <div class="form-group" style="margin-bottom:0.75rem;">
                    <label>휴일 명칭</label>
                    <input type="text" id="holiday-setup-name" class="form-input" placeholder="예: 한글날, 개교기념일" required>
                  </div>
                  <div class="form-check" style="margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem;">
                    <input type="checkbox" id="chk-is-holiday" checked style="width:auto;">
                    <label for="chk-is-holiday" style="margin:0; font-size:0.85rem;">휴업일 지정 (체크 시 시간표 등록 및 표시 제한)</label>
                  </div>
                  <button type="submit" class="btn btn-primary btn-block" style="padding:0.6rem;">휴일 등록하기</button>
                </form>
                <div class="settings-list-container" id="admin-holidays-list-ui" style="margin-top:1rem; max-height: 120px; overflow-y:auto;"></div>
              </div>
            </div>
          </div>
        </div>
        
        `;

const before = html.substring(0, startIndex);
const after = html.substring(endIndex);

fs.writeFileSync(filePath, before + replacementText + after, 'utf8');
console.log('SUCCESS: replaced settings panel with index search.');
