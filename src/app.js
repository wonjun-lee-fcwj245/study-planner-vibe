/**
 * Study Planner — v0.2→v1.0 작업 중
 *
 * Day 16 추가: FR-11 (학습 항목 제목 수정)
 *   - startEditingTask, saveEditingTask, cancelEditingTask 함수
 *   - 수정 모드 상태 추적 (editingTaskId)
 *   - 이벤트 위임으로 제목 클릭 / Enter / Esc / blur 처리
 *
 * 참조: SRS 0.3 FR-11; 03-wireframes 4.2; ADR-002.
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

/** @type {string|null} 현재 수정 중인 항목의 id (Day 16 추가) */
let editingTaskId = null;

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
const weeklyChartEl = document.getElementById('weekly-chart');
const subjectStatsEl = document.getElementById('subject-stats');

// ─────────────────────────────────────────────
// FR-04: localStorage
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

  saveTasks();
  renderAll();
  titleInput.focus();
}

function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// FR-02: 토글 (Day 16: 수정 중일 때 동작 조정)
// ─────────────────────────────────────────────

function toggleTaskCompletion(taskId) {
  // 의도적 모호함 6에 대한 결정: 수정 중인 항목은 토글 무시 (사용자 의도 보호)
  if (editingTaskId === taskId) return;

  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-03: 삭제
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

  // 삭제한 항목이 수정 중이었으면 수정 모드 해제
  if (editingTaskId === taskId) editingTaskId = null;

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-06: 필터
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
  // 의도적 모호함 5에 대한 결정: 필터 변경 시 수정 중이면 저장 후 변경
  if (editingTaskId !== null) {
    saveEditingTask();
  }
  currentFilter = filter;
  renderAll();
}

// ─────────────────────────────────────────────
// FR-08: 진도 카드
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
// FR-09: 주간 차트
// ─────────────────────────────────────────────

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

function renderWeeklyChart() {
  const data = getWeeklyData();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    weeklyChartEl.innerHTML = `
      <div class="weekly-chart-title">최근 7일 완료 항목</div>
      <div class="weekly-chart-empty">완료된 항목이 아직 없습니다</div>
    `;
    return;
  }

  const maxCount = Math.max(...data.map(d => d.count));

  const bars = data.map(d => {
    const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
    const countLabel = d.count > 0 ? `<span class="weekly-chart-count">${d.count}</span>` : '';
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
// FR-10: 과목별 완료율
// ─────────────────────────────────────────────

function renderSubjectStats() {
  if (tasks.length === 0) { subjectStatsEl.innerHTML = ''; return; }

  const grouped = {};
  tasks.forEach(t => {
    if (!grouped[t.subject]) grouped[t.subject] = { total: 0, completed: 0 };
    grouped[t.subject].total += 1;
    if (t.completed) grouped[t.subject].completed += 1;
  });

  const items = Object.entries(grouped)
    .map(([subject, { total, completed }]) => ({
      subject, total, completed,
      rate: Math.round((completed / total) * 100)
    }))
    .sort((a, b) => b.rate - a.rate);

  const bars = items.map(item => `
    <div class="subject-stats-row">
      <div class="subject-stats-header">
        <span class="subject-stats-name">${escapeHtml(item.subject)}</span>
        <span class="subject-stats-meta">${item.completed} / ${item.total} (${item.rate}%)</span>
      </div>
      <div class="subject-stats-bar-track">
        <div class="subject-stats-bar-fill" style="width: ${item.rate}%"></div>
      </div>
    </div>
  `).join('');

  subjectStatsEl.innerHTML = `
    <div class="subject-stats-title">과목별 완료율</div>
    ${bars}
  `;
}

// ─────────────────────────────────────────────
// FR-11: 제목 수정 (Day 16 추가)
// ─────────────────────────────────────────────

/**
 * 수정 모드 진입. 해당 항목의 제목 영역을 input으로 교체.
 * @param {string} taskId
 */
function startEditingTask(taskId) {
  // 의도적 모호함 5에 대한 결정: 다른 항목 수정 중이었으면 그 항목부터 저장
  if (editingTaskId !== null && editingTaskId !== taskId) {
    saveEditingTask();
  }

  editingTaskId = taskId;
  renderTaskList();

  // 렌더링 후 input에 포커스 + 텍스트 전체 선택
  // setTimeout 0으로 다음 tick에서 실행 — DOM이 갱신된 후
  setTimeout(() => {
    const input = taskListEl.querySelector('.task-item-title-input');
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

/**
 * 현재 수정 중인 제목을 저장. Enter 또는 다른 곳 클릭 시 호출.
 * 의도적 모호함 4 대응: 빈 제목은 저장하지 않고 원래 값 유지.
 */
function saveEditingTask() {
  if (editingTaskId === null) return;

  const input = taskListEl.querySelector('.task-item-title-input');
  if (!input) {
    editingTaskId = null;
    return;
  }

  const newTitle = input.value.trim();
  const task = tasks.find(t => t.id === editingTaskId);

  if (task && newTitle && newTitle !== task.title) {
    // 의도적 모호함 4: 빈 제목은 저장 안 함, 변경 없으면 저장 안 함
    task.title = newTitle;
    saveTasks();
  }

  editingTaskId = null;
  renderAll();
}

/**
 * 수정 취소 — Esc 시 호출. 변경 사항 버림.
 */
function cancelEditingTask() {
  editingTaskId = null;
  renderAll();
}

// ─────────────────────────────────────────────
// 렌더링
// ─────────────────────────────────────────────

function renderAll() {
  renderProgressCard();
  renderFilterChips();
  renderTaskList();
  renderWeeklyChart();
  renderSubjectStats();
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
    const isEditing = editingTaskId === task.id;

    // FR-11: 수정 모드면 input, 아니면 일반 div
    const titleHtml = isEditing
      ? `<input type="text" class="task-item-title-input"
                value="${escapeHtml(task.title)}"
                aria-label="제목 수정">`
      : `<div class="task-item-title" tabindex="0"
              role="button" aria-label="${escapeHtml(task.title)} 수정">${escapeHtml(task.title)}</div>`;

    return `
      <li class="task-item${modifierClass}" data-task-id="${task.id}">
        <input type="checkbox" class="task-item-checkbox"
               ${task.completed ? 'checked' : ''}
               aria-label="${escapeHtml(task.title)} 완료 토글">
        <div class="task-item-body">
          ${titleHtml}
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

// FR-02: 체크박스
taskListEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('task-item-checkbox')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) toggleTaskCompletion(taskItem.dataset.taskId);
});

// FR-03 + FR-11: 클릭 — 삭제 또는 수정 모드 진입
taskListEl.addEventListener('click', (e) => {
  // 삭제 버튼
  if (e.target.classList.contains('task-item-delete')) {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) deleteTask(taskItem.dataset.taskId);
    return;
  }

  // FR-11: 제목 클릭 → 수정 모드 진입
  if (e.target.classList.contains('task-item-title')) {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) startEditingTask(taskItem.dataset.taskId);
    return;
  }
});

// FR-11: 수정 중 Enter/Esc 키 처리
taskListEl.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('task-item-title-input')) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    saveEditingTask();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelEditingTask();
  }
});

// FR-11 + NFR-04 키보드 접근성: 제목에 포커스 + Enter 시 수정 모드
taskListEl.addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('task-item-title')) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;

  e.preventDefault();
  const taskItem = e.target.closest('.task-item');
  if (taskItem) startEditingTask(taskItem.dataset.taskId);
});

// FR-11: 수정 input의 blur — 의도적 모호함 5에 대한 결정
// blur가 발생하면 (다른 곳 클릭, Tab 이탈 등) 저장 처리
taskListEl.addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('task-item-title-input')) return;
  // setTimeout 0으로 click 이벤트가 먼저 처리되게 함
  setTimeout(() => {
    if (editingTaskId !== null) saveEditingTask();
  }, 100);
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

console.log('Study Planner v0.2 (FR-11 edit) —', tasks.length, 'tasks loaded');
