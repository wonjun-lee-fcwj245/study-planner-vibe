/**
 * Study Planner — v0.2 작업 중 (FR-01, 02, 03, 04, 07 + FR-06)
 *
 * Day 12 추가: FR-06 (과목 필터링)
 *   - currentFilter 상태 변수
 *   - renderFilterChips() 함수
 *   - renderTaskList() 필터 적용 로직
 *   - 이벤트 위임으로 필터 칩 처리
 *
 * 참조: SRS 0.3 UC-02, FR-06; 03-wireframes 4.2 영역 C; ADR-002.
 */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const STORAGE_KEY = 'study-planner:tasks';
const REQUIRED_FIELDS = ['id', 'title', 'subject', 'completed', 'createdAt', 'completedAt'];
const FILTER_ALL = 'all';   // FR-06: "전체" 필터의 식별자

// ─────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────

/** @type {Array<Task>} */
let tasks = [];

/** @type {string} 현재 활성 필터 — 'all' 또는 과목명 (FR-06, Day 12 추가) */
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
const filterAreaEl = document.getElementById('filter-area');   // Day 12 추가

// ─────────────────────────────────────────────
// FR-04: localStorage 영속성
// ─────────────────────────────────────────────

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('저장 실패 — 데이터가 영속되지 않습니다:', e.message);
  }
}

function loadTasks() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('localStorage 접근 불가 — 메모리 모드로 동작:', e.message);
    return [];
  }

  if (raw === null) return [];

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

  const valid = parsed.filter(item => {
    const ok = item && typeof item === 'object' &&
               REQUIRED_FIELDS.every(field => field in item);
    if (!ok) console.warn('필수 필드 누락 항목 무시:', item);
    return ok;
  });
  return valid;
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
  renderAll();    // Day 12: renderTaskList → renderAll로 변경 (필터 칩도 갱신)
  titleInput.focus();
}

function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// FR-02: 완료 토글 (기존 — 무변경)
// ─────────────────────────────────────────────

function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasks();
  renderTaskList();   // 필터 칩은 변하지 않으므로 목록만 다시
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

  // Day 12 추가: 삭제한 항목의 과목이 현재 필터였고 더 이상 그 과목 항목이 없으면 'all'로
  const subjects = new Set(tasks.map(t => t.subject));
  if (currentFilter !== FILTER_ALL && !subjects.has(currentFilter)) {
    currentFilter = FILTER_ALL;
  }

  saveTasks();
  renderAll();    // 필터 칩도 갱신해야 하므로 renderAll
}

// ─────────────────────────────────────────────
// FR-06: 필터 (Day 12 추가)
// ─────────────────────────────────────────────

/**
 * 현재 tasks에서 과목 목록을 동적으로 추출한다.
 * @returns {Array<string>} 정렬된 과목 목록
 */
function getSubjectList() {
  const subjects = new Set(tasks.map(t => t.subject));
  return Array.from(subjects).sort();
}

/**
 * 필터 칩을 렌더링한다. ("전체" + 각 과목)
 * 현재 활성 필터는 .filter-chip--active 클래스로 강조.
 */
function renderFilterChips() {
  const subjects = getSubjectList();

  // 항목이 없으면 필터 영역 자체를 숨김
  if (tasks.length === 0) {
    filterAreaEl.innerHTML = '';
    return;
  }

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

/**
 * 현재 필터에 맞는 tasks를 반환한다.
 * tasks 배열 자체는 변형하지 않음 (UI 상태 패턴).
 * @returns {Array<Task>}
 */
function getFilteredTasks() {
  if (currentFilter === FILTER_ALL) return tasks;
  return tasks.filter(t => t.subject === currentFilter);
}

/**
 * 필터를 변경하고 화면을 갱신한다.
 * @param {string} filter 'all' 또는 과목명
 */
function setFilter(filter) {
  currentFilter = filter;
  renderAll();
}

// ─────────────────────────────────────────────
// 렌더링 (Day 12: renderTaskList에 필터 적용)
// ─────────────────────────────────────────────

/**
 * 필터 칩 + 항목 목록을 모두 다시 그린다.
 * 항목 추가/삭제 시 사용 (과목 목록이 바뀌므로).
 */
function renderAll() {
  renderFilterChips();
  renderTaskList();
}

function renderTaskList() {
  const filtered = getFilteredTasks();   // FR-06 적용

  // 빈 상태 처리 — 필터에 따라 메시지 분기
  if (filtered.length === 0) {
    emptyStateEl.hidden = false;
    if (tasks.length === 0) {
      emptyStateEl.textContent = '오늘 학습할 내용을 추가해보세요';
    } else {
      // FR-06 검증 기준 6: 필터로 인한 빈 결과
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
// 이벤트 바인딩
// ─────────────────────────────────────────────

// FR-01
titleInput.addEventListener('input', updateAddButtonState);
addButton.addEventListener('click', addTask);
titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !addButton.disabled) addTask(); });
subjectInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !addButton.disabled) addTask(); });

// FR-02: 체크박스 (이벤트 위임)
taskListEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('task-item-checkbox')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) toggleTaskCompletion(taskItem.dataset.taskId);
});

// FR-03: 삭제 버튼 (이벤트 위임)
taskListEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('task-item-delete')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) deleteTask(taskItem.dataset.taskId);
});

// FR-06: 필터 칩 (이벤트 위임 — Day 12 추가)
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
renderAll();   // Day 12: renderTaskList → renderAll

console.log('Study Planner v0.2 (with FR-06 filter) —', tasks.length, 'tasks loaded');
