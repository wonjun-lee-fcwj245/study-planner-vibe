/**
 * Study Planner — v0.1 (FR-01 + FR-02 + FR-07)
 *
 * 본 파일은 다음 기능을 구현한다:
 * - FR-01: 학습 항목 추가
 * - FR-02: 완료 상태 토글 (Day 9 추가)
 * - FR-07: 완료/미완료 시각 구분 (Day 9 추가)
 *
 * 데이터는 메모리에만 보관한다 — localStorage 영속성은 FR-04에서 별도 추가.
 *
 * 참조 문서:
 * - SRS 0.3: UC-01, UC-03, FR-01, FR-02, FR-07
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
// 함수 정의 — FR-01 (기존)
// ─────────────────────────────────────────────

function renderTodayDate() {
  const today = new Date();
  const formatted = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
  todayDateEl.textContent = formatted;
}

function createTask(title, subject) {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    subject: subject.trim() || '(미분류)',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

function addTask() {
  const title = titleInput.value;
  if (!title.trim()) return;

  const task = createTask(title, subjectInput.value);
  tasks.unshift(task);

  titleInput.value = '';
  subjectInput.value = '';
  updateAddButtonState();

  renderTaskList();
  titleInput.focus();

  console.log('Task added:', task);
}

function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// 함수 정의 — FR-02 (Day 9 추가)
// ─────────────────────────────────────────────

/**
 * 학습 항목의 완료 상태를 토글한다. (UC-03 기본 흐름 1~5)
 * 대체 흐름 1a: 이미 완료된 항목을 다시 클릭하면 미완료로 복귀.
 *
 * @param {string} taskId - 토글할 항목의 id
 */
function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;

  // UC-03 기본 흐름 3: 완료 시각 기록.
  // 대체 흐름 1a: 미완료 복귀 시 completedAt을 null로 되돌림 (실수 복구의 의미 보존).
  task.completedAt = task.completed ? new Date().toISOString() : null;

  renderTaskList();
  console.log('Task toggled:', task);
}

// ─────────────────────────────────────────────
// 렌더링 함수 (Day 9에 FR-02, FR-07 적용)
// ─────────────────────────────────────────────

function renderTaskList() {
  if (tasks.length === 0) {
    emptyStateEl.hidden = false;
    taskListEl.innerHTML = '';
    return;
  }
  emptyStateEl.hidden = true;

  taskListEl.innerHTML = tasks.map(task => {
    // FR-07: 완료 항목에 수정자 클래스 부여
    const modifierClass = task.completed ? ' task-item--completed' : '';
    // FR-02: 완료 시각 메타 표시
    const completedMeta = task.completed && task.completedAt
      ? ` <span class="task-item-completed-time">→ 완료 ${formatTime(task.completedAt)}</span>`
      : '';

    return `
      <li class="task-item${modifierClass}" data-task-id="${task.id}">
        <input
          type="checkbox"
          class="task-item-checkbox"
          ${task.completed ? 'checked' : ''}
          aria-label="${escapeHtml(task.title)} 완료 토글"
        >
        <div class="task-item-body">
          <div class="task-item-title">${escapeHtml(task.title)}</div>
          <div class="task-item-meta">
            ${escapeHtml(task.subject)} · ${formatTime(task.createdAt)}${completedMeta}
          </div>
        </div>
      </li>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// 유틸리티 함수 (기존)
// ─────────────────────────────────────────────

function formatTime(isoString) {
  const d = new Date(isoString);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// 이벤트 바인딩
// ─────────────────────────────────────────────

// FR-01 이벤트 (기존)
titleInput.addEventListener('input', updateAddButtonState);
addButton.addEventListener('click', addTask);
titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});
subjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});

// FR-02 이벤트 (Day 9 추가) — 이벤트 위임 사용
// ul#task-list에 한 번만 부착하여 모든 체크박스 처리.
// 항목 추가 시마다 새 리스너 부착 불필요 → 메모리/성능 측면에서 효율적.
taskListEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('task-item-checkbox')) return;

  const taskItem = e.target.closest('.task-item');
  if (!taskItem) return;

  const taskId = taskItem.dataset.taskId;
  toggleTaskCompletion(taskId);
});

// ─────────────────────────────────────────────
// 초기 실행
// ─────────────────────────────────────────────

renderTodayDate();
renderTaskList();

console.log('Study Planner v0.1 (FR-01 + FR-02 + FR-07) — initialized');
