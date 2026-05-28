/**
 * Study Planner — v0.1 (FR-01, 02, 03, 04, 07)
 *
 * 구현 기능:
 * - FR-01: 학습 항목 추가
 * - FR-02: 완료 상태 토글
 * - FR-03: 학습 항목 삭제 (Day 10 추가)
 * - FR-04: localStorage 영속성 (Day 10 추가)
 * - FR-07: 완료/미완료 시각 구분
 *
 * 참조: SRS 0.3, 04-data-model (3.1 필드, 4.2 키, 7장 무결성), ADR-001, ADR-002
 */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** localStorage 키 (04-data-model 4.2) */
const STORAGE_KEY = 'study-planner:tasks';

/** Task 객체의 필수 필드 (04-data-model 3.1) — 무결성 검증용 */
const REQUIRED_FIELDS = ['id', 'title', 'subject', 'completed', 'createdAt', 'completedAt'];

// ─────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────

/** @type {Array<Task>} */
let tasks = [];

// ─────────────────────────────────────────────
// DOM 참조
// ─────────────────────────────────────────────

const titleInput = document.getElementById('task-title-input');
const subjectInput = document.getElementById('task-subject-input');
const addButton = document.getElementById('add-task-button');
const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const todayDateEl = document.getElementById('today-date');

// ─────────────────────────────────────────────
// FR-04: localStorage 영속성 (Day 10 추가)
// ─────────────────────────────────────────────

/**
 * tasks 배열을 localStorage에 저장한다.
 * 04-data-model 7.1: localStorage 사용 불가 환경(시크릿 모드 등)에서도 앱이 죽지 않도록 try-catch.
 * NFR-06: 외부 서버 전송 없이 로컬에만 저장.
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    // QuotaExceededError, 시크릿 모드의 SecurityError 등
    console.warn('저장 실패 — 데이터가 영속되지 않습니다:', e.message);
  }
}

/**
 * localStorage에서 tasks 배열을 불러온다.
 * 04-data-model 7.1 무결성 시나리오 전부 처리:
 * - 키 없음(첫 사용) → 빈 배열
 * - JSON 파싱 실패 → 빈 배열 + 경고
 * - 배열이 아님 → 빈 배열 + 경고
 * - 필수 필드 누락 항목 → 해당 항목만 제외
 * @returns {Array<Task>}
 */
function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('localStorage 접근 불가 — 메모리 모드로 동작:', e.message);
    return [];
  }

  if (raw === null) return [];  // 첫 사용

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('저장 데이터 파싱 실패 — 빈 상태로 초기화:', e.message);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn('저장 데이터가 배열이 아님 — 빈 상태로 초기화');
    return [];
  }

  // 필수 필드 검증 — 누락된 항목은 제외 (04-data-model 7.1)
  const valid = parsed.filter(item => {
    const ok = item && typeof item === 'object' &&
               REQUIRED_FIELDS.every(field => field in item);
    if (!ok) console.warn('필수 필드 누락 항목 무시:', item);
    return ok;
  });

  return valid;
}

// ─────────────────────────────────────────────
// FR-01: 추가
// ─────────────────────────────────────────────

function renderTodayDate() {
  const today = new Date();
  todayDateEl.textContent = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
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

  tasks.unshift(createTask(title, subjectInput.value));
  titleInput.value = '';
  subjectInput.value = '';
  updateAddButtonState();

  saveTasks();        // FR-04: 변경 시점에 저장
  renderTaskList();
  titleInput.focus();
}

function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// FR-02: 완료 토글
// ─────────────────────────────────────────────

function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasks();        // FR-04: 변경 시점에 저장
  renderTaskList();
}

// ─────────────────────────────────────────────
// FR-03: 삭제 (Day 10 추가)
// ─────────────────────────────────────────────

/**
 * 학습 항목을 삭제한다. (UC-04 기본 흐름 1~4)
 * 대체 흐름 2a: 사용자가 확인창에서 취소하면 유지.
 * @param {string} taskId
 */
function deleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  // UC-04 기본 흐름 2: 삭제 확인
  const confirmed = window.confirm(`"${task.title}" 항목을 삭제할까요?`);
  if (!confirmed) return;  // 대체 흐름 2a

  tasks = tasks.filter(t => t.id !== taskId);
  saveTasks();        // FR-04: 변경 시점에 저장
  renderTaskList();
}

// ─────────────────────────────────────────────
// 렌더링 (FR-03 삭제 버튼 추가)
// ─────────────────────────────────────────────

function renderTaskList() {
  if (tasks.length === 0) {
    emptyStateEl.hidden = false;
    taskListEl.innerHTML = '';
    return;
  }
  emptyStateEl.hidden = true;

  taskListEl.innerHTML = tasks.map(task => {
    const modifierClass = task.completed ? ' task-item--completed' : '';
    const completedMeta = task.completed && task.completedAt
      ? ` <span class="task-item-completed-time">→ 완료 ${formatTime(task.completedAt)}</span>`
      : '';

    return `
      <li class="task-item${modifierClass}" data-task-id="${task.id}">
        <input type="checkbox" class="task-item-checkbox"
               ${task.completed ? 'checked' : ''}
               aria-label="${escapeHtml(task.title)} 완료 토글">
        <div class="task-item-body">
          <div class="task-item-title">${escapeHtml(task.title)}</div>
          <div class="task-item-meta">
            ${escapeHtml(task.subject)} · ${formatTime(task.createdAt)}${completedMeta}
          </div>
        </div>
        <button class="task-item-delete" aria-label="${escapeHtml(task.title)} 삭제">삭제</button>
      </li>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

function formatTime(isoString) {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// 이벤트 바인딩
// ─────────────────────────────────────────────

// FR-01
titleInput.addEventListener('input', updateAddButtonState);
addButton.addEventListener('click', addTask);
titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !addButton.disabled) addTask(); });
subjectInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !addButton.disabled) addTask(); });

// FR-02: 체크박스 change (이벤트 위임)
taskListEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('task-item-checkbox')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) toggleTaskCompletion(taskItem.dataset.taskId);
});

// FR-03: 삭제 버튼 click (이벤트 위임 — Day 10 추가)
taskListEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('task-item-delete')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) deleteTask(taskItem.dataset.taskId);
});

// ─────────────────────────────────────────────
// 초기 실행 (FR-04: 저장된 데이터 로딩)
// ─────────────────────────────────────────────

tasks = loadTasks();   // FR-04: 앱 시작 시 복원
renderTodayDate();
renderTaskList();

console.log('Study Planner v0.1 (FR-01,02,03,04,07) — initialized,', tasks.length, 'tasks loaded');
