/**
 * Study Planner — v0.1 (FR-01 only)
 *
 * 본 파일은 FR-01(학습 항목 추가) 단일 기능을 구현한다.
 * 데이터는 메모리에만 보관한다 — localStorage 영속성은 FR-04에서 별도 추가.
 *
 * 참조 문서:
 * - SRS 0.3: UC-01, FR-01
 * - 04-data-model 3.1: Task 객체 6개 필드
 * - 03-wireframes 4.2: 메인 보드 영역 구성
 * - ADR-002: 순수 Vanilla JS (외부 라이브러리 금지)
 */

// ─────────────────────────────────────────────
// 상태 (메모리 내 tasks 배열)
// ─────────────────────────────────────────────

/** @type {Array<Task>} 학습 항목 배열. 본 이터레이션에서는 메모리에만 존재. */
let tasks = [];

// ─────────────────────────────────────────────
// DOM 요소 참조 (한 번만 조회)
// ─────────────────────────────────────────────

const titleInput = document.getElementById('task-title-input');
const subjectInput = document.getElementById('task-subject-input');
const addButton = document.getElementById('add-task-button');
const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const todayDateEl = document.getElementById('today-date');

// ─────────────────────────────────────────────
// 함수 정의
// ─────────────────────────────────────────────

/**
 * 오늘 날짜를 헤더에 표시한다. (와이어프레임 영역 A)
 */
function renderTodayDate() {
  const today = new Date();
  const formatted = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  todayDateEl.textContent = formatted;
}

/**
 * 새 Task 객체를 생성한다.
 * 04-data-model 3.1의 6개 필드를 모두 채운다.
 * @param {string} title - 학습 항목 제목
 * @param {string} subject - 과목명 (빈 값이면 "(미분류)")
 * @returns {Task}
 */
function createTask(title, subject) {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    subject: subject.trim() || '(미분류)',  // UC-01 대체 흐름 3a
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

/**
 * 학습 항목 하나를 추가한다. (UC-01 기본 흐름 5~7)
 * 메모리 tasks 배열의 최상단(unshift)에 넣는다.
 * 추가 후 입력 필드를 초기화하고 화면을 다시 그린다.
 */
function addTask() {
  const title = titleInput.value;
  if (!title.trim()) return;  // UC-01 대체 흐름 4a 방어 (이중 안전장치)

  const task = createTask(title, subjectInput.value);
  tasks.unshift(task);

  // 입력 필드 초기화 (UC-01 기본 흐름 7)
  titleInput.value = '';
  subjectInput.value = '';
  updateAddButtonState();

  renderTaskList();
  titleInput.focus();  // 연속 입력 편의

  // 콘솔 확인용 (개발 중에만 의미 있음, v0.1 출시 시 제거 검토)
  console.log('Task added:', task);
}

/**
 * 학습 항목 목록을 화면에 다시 그린다.
 * 와이어프레임 영역 D 구조: 체크박스 + 제목/메타 + (삭제 버튼은 FR-03에서 추가)
 */
function renderTaskList() {
  // 빈 상태 처리
  if (tasks.length === 0) {
    emptyStateEl.hidden = false;
    taskListEl.innerHTML = '';
    return;
  }
  emptyStateEl.hidden = true;

  // 항목 렌더링 — 메모리 tasks 배열을 그대로 화면에 매핑
  taskListEl.innerHTML = tasks.map(task => `
    <li class="task-item" data-task-id="${task.id}">
      <input type="checkbox" disabled aria-label="완료 체크 (FR-02에서 활성화 예정)">
      <div class="task-item-body">
        <div class="task-item-title">${escapeHtml(task.title)}</div>
        <div class="task-item-meta">
          ${escapeHtml(task.subject)} · ${formatTime(task.createdAt)}
        </div>
      </div>
    </li>
  `).join('');
}

/**
 * 추가 버튼의 활성화/비활성화 상태를 갱신한다.
 * UC-01 대체 흐름 4a: 제목이 비어 있으면 버튼 disabled.
 */
function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

/**
 * ISO 8601 시각을 "HH:mm" 형식으로 변환한다. (와이어프레임 메타 표시용)
 * @param {string} isoString
 * @returns {string}
 */
function formatTime(isoString) {
  const d = new Date(isoString);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * HTML 인젝션 방어 — 사용자 입력은 항상 이스케이프한다.
 * 외부 라이브러리 금지(ADR-002)이므로 직접 구현.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// 이벤트 바인딩
// ─────────────────────────────────────────────

// 제목 입력의 모든 변경을 감지하여 버튼 상태 갱신
titleInput.addEventListener('input', updateAddButtonState);

// 추가 버튼 클릭 → 추가 (UC-01 기본 흐름 4)
addButton.addEventListener('click', addTask);

// Enter 키 → 추가 (UC-01 기본 흐름 4의 대체 입력)
titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) {
    addTask();
  }
});
subjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) {
    addTask();
  }
});

// ─────────────────────────────────────────────
// 초기 실행
// ─────────────────────────────────────────────

renderTodayDate();
renderTaskList();

console.log('Study Planner v0.1 (FR-01 only) — initialized');
