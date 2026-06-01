/**
 * Study Planner — v0.2 작업 중 (이터1 + FR-06 + FR-08 + FR-09)
 *
 * Day 14 추가: FR-09 (7일 일별 완료 항목 차트)
 *   - getWeeklyData() 헬퍼
 *   - renderWeeklyChart() CSS 막대 직접 구현 (ADR-003)
 *   - renderAll()이 차트도 갱신
 *
 * 참조: SRS 0.3 FR-09, UC-05; 03-wireframes 5.2 영역 C; 04-data-model 5.2;
 *      ADR-002 (Vanilla JS), **ADR-003 (차트 라이브러리 거절)**.
 */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const STORAGE_KEY = 'study-planner:tasks';
const REQUIRED_FIELDS = ['id', 'title', 'subject', 'completed', 'createdAt', 'completedAt'];
const FILTER_ALL = 'all';

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

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
const progressCardEl = document.getElementById('progress-card');
const weeklyChartEl = document.getElementById('weekly-chart');   // Day 14 추가

// ─────────────────────────────────────────────
// FR-04: localStorage (기존)
// ─────────────────────────────────────────────

function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch (e) { console.warn('저장 실패:', e.message); }
}

function loadTasks() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch (e) { console.warn('접근 불가:', e.message); return []; }
  if (raw === null) return [];

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { console.warn('파싱 실패:', e.message); return []; }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(item => {
    const ok = item && typeof item === 'object' &&
               REQUIRED_FIELDS.every(field => field in item);
    if (!ok) console.warn('필수 필드 누락 항목 무시:', item);
    return ok;
  });
}

// ─────────────────────────────────────────────
// FR-01: 추가 (기존)
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
// FR-02: 완료 토글 (기존)
// ─────────────────────────────────────────────

function toggleTaskCompletion(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-03: 삭제 (기존)
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
// FR-06: 필터 (기존)
// ─────────────────────────────────────────────

function getSubjectList() {
  return Array.from(new Set(tasks.map(t => t.subject))).sort();
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
// FR-08: 진도 카드 (기존)
// ─────────────────────────────────────────────

function isSameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function renderProgressCard() {
  const today = new Date();
  const todayTasks = tasks.filter(t => isSameDay(t.createdAt, today));

  if (todayTasks.length === 0) {
    progressCardEl.innerHTML = `
      <div class="progress-card-label">오늘 진도</div>
      <div class="progress-card-empty">학습 없음</div>
    `;
    return;
  }

  const completed = todayTasks.filter(t => t.completed).length;
  const rate = Math.round((completed / todayTasks.length) * 100);

  progressCardEl.innerHTML = `
    <div class="progress-card-label">오늘 진도</div>
    <div class="progress-card-value">${rate}%</div>
    <div class="progress-card-detail">${completed} / ${todayTasks.length}</div>
  `;
}

// ─────────────────────────────────────────────
// FR-09: 주간 차트 (Day 14 추가)
// ─────────────────────────────────────────────

/**
 * 지난 7일간 일별 완료 항목 수를 계산한다.
 * 04-data-model 5.2 알고리즘 적용 (completedAt 기준).
 * 필터(currentFilter)와 무관 — 항상 전체 데이터 기준 (검증 기준 8).
 *
 * @returns {Array<{date: Date, count: number, isToday: boolean, label: string}>}
 *          오래된 날짜부터 오늘까지 7개 (검증 기준 1, 2, 3 모두 대응)
 */
function getWeeklyData() {
  const today = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);

    const count = tasks.filter(t =>
      t.completed && t.completedAt && isSameDay(t.completedAt, day)
    ).length;

    result.push({
      date: day,
      count,
      isToday: i === 0,
      label: WEEKDAY_KO[day.getDay()]
    });
  }

  return result;
}

/**
 * 주간 차트를 렌더링한다. ADR-003에 따라 CSS 막대로 직접 구현.
 * height는 그 주의 최대값 대비 비율로 결정 — 모든 막대가 0이면 모두 0% (검증 기준 2, 3, 4).
 */
function renderWeeklyChart() {
  const data = getWeeklyData();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  // 검증 기준 2: 데이터 0건일 때 안내 메시지
  if (total === 0) {
    weeklyChartEl.innerHTML = `
      <div class="weekly-chart-title">최근 7일 완료 항목</div>
      <div class="weekly-chart-empty">완료된 항목이 아직 없습니다</div>
    `;
    return;
  }

  // 검증 기준 4: 최대값 기준으로 비율 계산 → 막대가 영역을 벗어나지 않음
  const maxCount = Math.max(...data.map(d => d.count));

  const bars = data.map(d => {
    // 막대 높이 % — maxCount가 1이면 그 날만 100%, 다른 날은 0%
    const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
    // 검증 기준 5: 0인 날은 카운트 숨김, 그 외 표시
    const countLabel = d.count > 0 ? `<span class="weekly-chart-count">${d.count}</span>` : '';
    // 검증 기준 6: 오늘 막대는 강조 클래스 추가
    const todayClass = d.isToday ? ' weekly-chart-bar-wrapper--today' : '';

    return `
      <div class="weekly-chart-bar-wrapper${todayClass}">
        ${countLabel}
        <div class="weekly-chart-bar" style="height: ${heightPct}%"></div>
        <div class="weekly-chart-label">${d.label}</div>
      </div>
    `;
  }).join('');

  weeklyChartEl.innerHTML = `
    <div class="weekly-chart-title">최근 7일 완료 항목</div>
    <div class="weekly-chart-bars">${bars}</div>
  `;
}

// ─────────────────────────────────────────────
// 렌더링 (Day 14: renderAll에 차트 추가)
// ─────────────────────────────────────────────

function renderAll() {
  renderProgressCard();
  renderFilterChips();
  renderTaskList();
  renderWeeklyChart();   // Day 14 추가
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

console.log('Study Planner v0.2 (with FR-09 chart) —', tasks.length, 'tasks loaded');
