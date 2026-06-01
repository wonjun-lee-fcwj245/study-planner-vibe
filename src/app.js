/**
 * Study Planner — v0.2 작업 중 (이터1 + FR-06 + FR-08)
 *
 * Day 13 추가: FR-08 (오늘의 진도율 표시)
 *   - isSameDay 헬퍼 함수
 *   - renderProgressCard() 함수
 *   - renderAll()이 진도 카드도 갱신
 *
 * 참조: SRS 0.3 FR-08, UC-02; 03-wireframes 4.2 영역 A;
 *      04-data-model 5.1 (오늘의 진도율 알고리즘).
 */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const STORAGE_KEY = 'study-planner:tasks';
const REQUIRED_FIELDS = ['id', 'title', 'subject', 'completed', 'createdAt', 'completedAt'];
const FILTER_ALL = 'all';

// ─────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────

let tasks = [];
let currentFilter = FILTER_ALL;

// ─────────────────────────────────────────────
// DOM 참조
// ─────────────────────────────────────────────

const titleInput = document.getElementById('task-title-input');
const subjectInput = document.getElementById('task-subject-input');
const addButton = document.getElementById('add-task-button');
const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const todayDateEl = document.getElementById('today-date');
const filterAreaEl = document.getElementById('filter-area');
const progressCardEl = document.getElementById('progress-card');   // Day 13 추가

// ─────────────────────────────────────────────
// FR-04: localStorage 영속성 (기존 — 무변경)
// ─────────────────────────────────────────────

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('저장 실패:', e.message);
  }
}

function loadTasks() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch (e) { console.warn('localStorage 접근 불가:', e.message); return []; }
  if (raw === null) return [];

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { console.warn('파싱 실패:', e.message); return []; }
  if (!Array.isArray(parsed)) { console.warn('배열 아님'); return []; }

  return parsed.filter(item => {
    const ok = item && typeof item === 'object' &&
               REQUIRED_FIELDS.every(field => field in item);
    if (!ok) console.warn('필수 필드 누락 항목 무시:', item);
    return ok;
  });
}

// ─────────────────────────────────────────────
// FR-01: 추가 (기존 — 무변경)
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

  saveTasks();
  renderAll();
  titleInput.focus();
}

function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// FR-02: 완료 토글 (기존 + Day 13: 진도 카드도 갱신)
// ─────────────────────────────────────────────

function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasks();
  // Day 13: 토글이 진도율을 바꾸므로 renderAll로 변경
  renderAll();
}

// ─────────────────────────────────────────────
// FR-03: 삭제 (기존 — 무변경)
// ─────────────────────────────────────────────

function deleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const confirmed = window.confirm(`"${task.title}" 항목을 삭제할까요?`);
  if (!confirmed) return;

  tasks = tasks.filter(t => t.id !== taskId);

  const subjects = new Set(tasks.map(t => t.subject));
  if (currentFilter !== FILTER_ALL && !subjects.has(currentFilter)) {
    currentFilter = FILTER_ALL;
  }

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-06: 필터 (기존 — 무변경)
// ─────────────────────────────────────────────

function getSubjectList() {
  const subjects = new Set(tasks.map(t => t.subject));
  return Array.from(subjects).sort();
}

function renderFilterChips() {
  const subjects = getSubjectList();
  if (tasks.length === 0) { filterAreaEl.innerHTML = ''; return; }

  const allChip = `
    <button class="filter-chip${currentFilter === FILTER_ALL ? ' filter-chip--active' : ''}"
            data-filter="${FILTER_ALL}">
      전체 (${tasks.length})
    </button>
  `;

  const subjectChips = subjects.map(subject => {
    const count = tasks.filter(t => t.subject === subject).length;
    const isActive = currentFilter === subject;
    return `
      <button class="filter-chip${isActive ? ' filter-chip--active' : ''}"
              data-filter="${escapeHtml(subject)}">
        ${escapeHtml(subject)} (${count})
      </button>
    `;
  }).join('');

  filterAreaEl.innerHTML = allChip + subjectChips;
}

function getFilteredTasks() {
  if (currentFilter === FILTER_ALL) return tasks;
  return tasks.filter(t => t.subject === currentFilter);
}

function setFilter(filter) {
  currentFilter = filter;
  renderAll();
}

// ─────────────────────────────────────────────
// FR-08: 오늘의 진도율 (Day 13 추가)
// ─────────────────────────────────────────────

/**
 * 두 시각이 같은 날(YYYY-MM-DD)인지 검증.
 * 로컬 타임존 기준으로 비교 — 사용자가 보는 "오늘"과 일치.
 * @param {string|Date} a
 * @param {string|Date} b
 * @returns {boolean}
 */
function isSameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * 오늘 생성된 항목들의 진도율을 계산하여 헤더 카드에 표시한다.
 * 04-data-model 5.1 알고리즘 그대로 적용.
 * 필터(currentFilter)와 무관 — 항상 전체 오늘 항목 기준.
 */
function renderProgressCard() {
  const today = new Date();
  const todayTasks = tasks.filter(t => isSameDay(t.createdAt, today));

  // 엣지 케이스: 오늘 항목 0개
  if (todayTasks.length === 0) {
    progressCardEl.innerHTML = `
      <div class="progress-card-label">오늘 진도</div>
      <div class="progress-card-empty">학습 없음</div>
    `;
    return;
  }

  const completed = todayTasks.filter(t => t.completed).length;
  // Math.round로 반올림 — 33.33% → 33%, 33.5% → 34%
  const rate = Math.round((completed / todayTasks.length) * 100);

  progressCardEl.innerHTML = `
    <div class="progress-card-label">오늘 진도</div>
    <div class="progress-card-value">${rate}%</div>
    <div class="progress-card-detail">${completed} / ${todayTasks.length}</div>
  `;
}

// ─────────────────────────────────────────────
// 렌더링 (Day 13: renderAll이 진도 카드도 갱신)
// ─────────────────────────────────────────────

function renderAll() {
  renderProgressCard();   // Day 13 추가
  renderFilterChips();
  renderTaskList();
}

function renderTaskList() {
  const filtered = getFilteredTasks();

  if (filtered.length === 0) {
    emptyStateEl.hidden = false;
    if (tasks.length === 0) {
      emptyStateEl.textContent = '오늘 학습할 내용을 추가해보세요';
    } else {
      emptyStateEl.textContent = `"${currentFilter}" 과목에 항목이 없습니다`;
    }
    taskListEl.innerHTML = '';
    return;
  }
  emptyStateEl.hidden = true;

  taskListEl.innerHTML = filtered.map(task => {
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
// 유틸리티 (기존 — 무변경)
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
// 이벤트 바인딩 (기존 — 무변경)
// ─────────────────────────────────────────────

titleInput.addEventListener('input', updateAddButtonState);
addButton.addEventListener('click', addTask);
titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !addButton.disabled) addTask(); });
subjectInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !addButton.disabled) addTask(); });

taskListEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('task-item-checkbox')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) toggleTaskCompletion(taskItem.dataset.taskId);
});

taskListEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('task-item-delete')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) deleteTask(taskItem.dataset.taskId);
});

filterAreaEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-chip')) return;
  const filter = e.target.dataset.filter;
  if (filter) setFilter(filter);
});

// ─────────────────────────────────────────────
// 초기 실행
// ─────────────────────────────────────────────

tasks = loadTasks();
renderTodayDate();
renderAll();

console.log('Study Planner v0.2 (with FR-08 progress) —', tasks.length, 'tasks loaded');
