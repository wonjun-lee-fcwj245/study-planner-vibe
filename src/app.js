/**
 * Study Planner — v1.0 (Day 17 NFR 보강 후)
 *
 * 구현 기능: FR-01, FR-02, FR-03, FR-04, FR-06, FR-07, FR-08, FR-09, FR-10, FR-11
 * (FR-05는 사실상 FR-01에 포함 — SRS 0.3.1 변경 이력 참조)
 * (FR-12 다크모드, FR-13 데이터 내보내기는 Won't)
 *
 * 보강 NFR:
 *  - NFR-04: 키보드 접근성 (tabindex, role, aria-label, Space/Enter/Esc 키)
 *  - NFR-05: 브라우저 호환성 — Chrome 90+, Firefox 88+, Edge 90+ 검증 대상
 *      특수 API 사용: crypto.randomUUID() (Chrome 92+), Set, Object.entries
 *      모두 대상 브라우저 안정판에서 동작
 *  - NFR-07: 모든 주요 함수에 JSDoc 주석
 *
 * 참조: SRS 0.3, 04-data-model, ADR-002 (Vanilla JS), ADR-003 (차트 라이브러리 거절)
 */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** localStorage 키 (04-data-model 4.2) */
const STORAGE_KEY = 'study-planner:tasks';

/** Task 객체의 필수 필드 (04-data-model 3.1) — 로딩 시 무결성 검증용 */
const REQUIRED_FIELDS = ['id', 'title', 'subject', 'completed', 'createdAt', 'completedAt'];

/** "전체" 필터의 식별자 (FR-06) */
const FILTER_ALL = 'all';

/** 요일 라벨 (일~토). FR-09 주간 차트에서 사용 */
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

// ─────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────

/** @type {Array<Task>} 학습 항목 배열. localStorage에서 로드되고 변경 시 저장됨 */
let tasks = [];

/** @type {string} 현재 활성 필터 — 'all' 또는 과목명 (FR-06) */
let currentFilter = FILTER_ALL;

/** @type {string|null} 현재 수정 중인 항목의 id (FR-11) */
let editingTaskId = null;

// ─────────────────────────────────────────────
// DOM 참조 — 모듈 로드 시점에 한 번만 조회
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
// FR-04: localStorage 영속성
// ─────────────────────────────────────────────

/**
 * tasks 배열을 localStorage에 직렬화하여 저장한다.
 * 시크릿 모드 등 localStorage 접근 불가 환경에서도 앱이 죽지 않도록 try-catch.
 * 외부 서버로의 전송은 없음 (NFR-06).
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.warn('저장 실패 — 데이터가 영속되지 않습니다:', e.message);
  }
}

/**
 * localStorage에서 tasks 배열을 불러와 검증한다.
 * 04-data-model 7.1 데이터 무결성 시나리오 전부 처리:
 *   - 키 없음 → 빈 배열
 *   - getItem 자체 실패 (시크릿 모드 SecurityError 등) → 빈 배열
 *   - JSON 파싱 실패 → 빈 배열
 *   - 배열이 아님 → 빈 배열
 *   - 필수 필드 누락 항목 → 해당 항목 제외
 *
 * @returns {Array<Task>} 검증된 학습 항목 배열
 */
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

  return parsed.filter(item => {
    const ok = item && typeof item === 'object' &&
               REQUIRED_FIELDS.every(field => field in item);
    if (!ok) console.warn('필수 필드 누락 항목 무시:', item);
    return ok;
  });
}

// ─────────────────────────────────────────────
// FR-01: 학습 항목 추가 (UC-01)
// ─────────────────────────────────────────────

/**
 * 오늘 날짜를 헤더에 한국어 형식으로 표시한다.
 * (와이어프레임 03-wireframes 4.2 영역 A)
 */
function renderTodayDate() {
  const today = new Date();
  todayDateEl.textContent = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
}

/**
 * 새 Task 객체를 생성한다.
 * 04-data-model 3.1의 6개 필드를 모두 채운다.
 * id는 crypto.randomUUID() 사용 — Chrome 92+, Firefox 95+, Edge 92+에서 지원 (NFR-05).
 *
 * @param {string} title - 학습 항목 제목 (공백 trim)
 * @param {string} subject - 과목명 (빈 값이면 "(미분류)" 자동 처리, UC-01 대체 흐름 3a)
 * @returns {Task} 6개 필드 모두 채워진 Task 객체
 */
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

/**
 * 입력 필드의 값을 사용해 새 학습 항목을 추가한다. (UC-01 기본 흐름 5~7)
 * 최상단(unshift)에 삽입되어 가장 최근 항목이 먼저 표시된다.
 * 추가 후 localStorage에 저장하고 전체 화면을 갱신한다.
 */
function addTask() {
  const title = titleInput.value;
  if (!title.trim()) return;  // UC-01 대체 흐름 4a 이중 가드

  tasks.unshift(createTask(title, subjectInput.value));
  titleInput.value = '';
  subjectInput.value = '';
  updateAddButtonState();

  saveTasks();
  renderAll();
  titleInput.focus();  // 연속 입력 편의 (NFR-04 키보드 접근성)
}

/**
 * 제목 입력 필드의 값에 따라 "추가" 버튼의 활성화 상태를 갱신한다.
 * UC-01 대체 흐름 4a: 빈 제목이면 추가 불가.
 */
function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// FR-02: 완료 상태 토글 (UC-03)
// ─────────────────────────────────────────────

/**
 * 학습 항목의 완료 상태를 토글한다. (UC-03 기본 흐름 1~5)
 * 대체 흐름 1a: 이미 완료된 항목을 다시 토글하면 미완료로 복귀 (completedAt → null).
 * 수정 중인 항목은 토글 무시 (FR-11과의 충돌 보호, Day 16 결정).
 *
 * @param {string} taskId - 토글할 항목의 id
 */
function toggleTaskCompletion(taskId) {
  // FR-11 충돌 보호: 수정 중인 항목은 토글 무시 (사용자 의도 보호)
  if (editingTaskId === taskId) return;

  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-03: 학습 항목 삭제 (UC-04)
// ─────────────────────────────────────────────

/**
 * 학습 항목을 삭제한다. (UC-04 기본 흐름 1~4)
 * 사용자 실수 방지를 위해 window.confirm으로 확인 (UC-04 기본 흐름 2).
 * 대체 흐름 2a: 취소 누르면 항목 유지.
 *
 * 삭제 후 필터 정합성 유지:
 *   현재 필터의 과목이 모두 삭제됐다면 '전체'로 복귀.
 *
 * @param {string} taskId - 삭제할 항목의 id
 */
function deleteTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const confirmed = window.confirm(`"${task.title}" 항목을 삭제할까요?`);
  if (!confirmed) return;  // UC-04 대체 흐름 2a

  tasks = tasks.filter(t => t.id !== taskId);

  // 필터 정합성: 현재 필터 과목의 마지막 항목이 삭제되면 '전체'로 자동 복귀 (UC-02 자연스러운 흐름)
  const subjects = new Set(tasks.map(t => t.subject));
  if (currentFilter !== FILTER_ALL && !subjects.has(currentFilter)) {
    currentFilter = FILTER_ALL;
  }

  // 삭제 항목이 수정 중이었으면 수정 모드 해제 (FR-11 충돌 보호)
  if (editingTaskId === taskId) editingTaskId = null;

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-06: 과목 필터링 (UC-02)
// ─────────────────────────────────────────────

/**
 * 현재 tasks에서 과목 목록을 동적으로 추출한다 (중복 제거 + 사전순 정렬).
 * 별도 캐시 없이 매 렌더링마다 재계산 — 데이터 모델 04-data-model 4.2의 단순성 원칙.
 *
 * @returns {Array<string>} 사전순 정렬된 과목 목록
 */
function getSubjectList() {
  return Array.from(new Set(tasks.map(t => t.subject))).sort();
}

/**
 * 필터 칩 영역(와이어프레임 영역 C)을 렌더링한다.
 * 항목이 0개면 영역을 비워 헤더-입력의 간격을 자연스럽게 한다.
 *
 * 각 칩에는 해당 과목의 항목 개수를 함께 표시 — 사용자가 클릭 전에 결과 규모를 예측 가능.
 */
function renderFilterChips() {
  const subjects = getSubjectList();
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
 * 현재 필터에 맞는 tasks 부분집합을 반환한다.
 * tasks 배열 자체는 변형하지 않음 — UI 상태 패턴 (04-data-model 6장).
 *
 * @returns {Array<Task>} 필터 적용 결과
 */
function getFilteredTasks() {
  if (currentFilter === FILTER_ALL) return tasks;
  return tasks.filter(t => t.subject === currentFilter);
}

/**
 * 필터를 변경하고 화면을 갱신한다.
 * 수정 중이면 먼저 저장 (FR-11 충돌 보호 — Day 16 자발 결정 적용).
 *
 * @param {string} filter - 'all' 또는 과목명
 */
function setFilter(filter) {
  if (editingTaskId !== null) saveEditingTask();
  currentFilter = filter;
  renderAll();
}

// ─────────────────────────────────────────────
// FR-08: 오늘의 진도율 (UC-02)
// ─────────────────────────────────────────────

/**
 * 두 시각이 같은 날(YYYY-MM-DD)인지 검증한다 — 로컬 타임존 기준.
 * FR-08(오늘 진도), FR-09(주간 차트)에서 공통 사용 (Day 13 분리 결정).
 *
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
 * 헤더 우측의 "오늘 진도" 카드를 렌더링한다 (와이어프레임 영역 A 우측).
 * 04-data-model 5.1 알고리즘 적용.
 * 필터(currentFilter)와 무관 — 항상 전체 오늘 항목 기준.
 * 오늘 항목 0개일 때는 "학습 없음"으로 0으로 나누기 회피.
 */
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
// FR-09: 주간 차트 (UC-05) — ADR-003 CSS 막대
// ─────────────────────────────────────────────

/**
 * 지난 7일간 일별 완료 항목 수를 계산한다 (오래된 날짜부터 오늘까지 7개).
 * 04-data-model 5.2 알고리즘 — completedAt 기준 (createdAt 아님).
 * 필터와 무관 — 항상 전체 데이터 기준.
 *
 * @returns {Array<{date: Date, count: number, isToday: boolean, label: string}>}
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
 * 주간 차트(영역 E)를 렌더링한다. ADR-003에 따라 CSS height %로 직접 구현.
 * 막대 높이는 그 주의 최댓값 대비 비율 — 추이를 명확히 시각화 (Day 14 결정).
 * 데이터 0건일 때는 메시지로 분기 (검증 기준 2).
 */
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
// FR-10: 과목별 완료율 (UC-05) — ADR-003 CSS width
// ─────────────────────────────────────────────

/**
 * 과목별 완료율 진행 바를 렌더링한다.
 * 04-data-model 5.3 알고리즘 + 완료율 내림차순 정렬.
 * 데이터 0건일 때는 영역 자체를 비움 (CSS :empty selector로 마진 제거).
 */
function renderSubjectStats() {
  if (tasks.length === 0) {
    subjectStatsEl.innerHTML = '';
    return;
  }

  // 과목별 그룹화
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
    .sort((a, b) => b.rate - a.rate);  // 완료율 내림차순

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
// FR-11: 학습 항목 제목 수정
// ─────────────────────────────────────────────

/**
 * 수정 모드 진입. 해당 항목의 제목 영역을 input으로 교체한다.
 * 다른 항목이 수정 중이면 먼저 저장 (Day 16 자발 결정: "데이터 손실 방지" 원칙).
 * setTimeout 0으로 DOM 갱신 후 포커스 + 텍스트 선택.
 *
 * @param {string} taskId - 수정할 항목의 id
 */
function startEditingTask(taskId) {
  if (editingTaskId !== null && editingTaskId !== taskId) {
    saveEditingTask();
  }

  editingTaskId = taskId;
  renderTaskList();

  setTimeout(() => {
    const input = taskListEl.querySelector('.task-item-title-input');
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

/**
 * 현재 수정 중인 제목을 저장한다.
 * Day 16 자발 결정에 따라:
 *   - 빈 제목 → 저장 안 함, 원래 값 유지
 *   - 변경 없음 → 저장 안 함 (불필요한 localStorage 쓰기 회피)
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
// 렌더링 — 통합 갱신
// ─────────────────────────────────────────────

/**
 * 모든 화면 영역을 다시 그린다.
 * 데이터 변경 시 부분 렌더가 아닌 전체 렌더로 일관성 보장 (Day 13 결정).
 * 성능 미세 최적화보다 일관성 우선 — Vanilla JS에서 함수형 패턴.
 */
function renderAll() {
  renderProgressCard();
  renderFilterChips();
  renderTaskList();
  renderWeeklyChart();
  renderSubjectStats();
}

/**
 * 항목 목록(영역 D)을 렌더링한다.
 * 필터 적용, 완료 시각 구분(FR-07), 수정 모드(FR-11), 빈 상태 처리 포함.
 */
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

    // 수정 모드면 input, 아니면 클릭 가능 div (NFR-04 키보드 접근성: tabindex + role + Enter/Space 키)
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

/**
 * ISO 8601 시각 문자열을 "HH:mm" 형식으로 변환한다.
 *
 * @param {string} isoString - 예: "2026-06-04T09:14:23.000Z"
 * @returns {string} 예: "09:14"
 */
function formatTime(isoString) {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * HTML 인젝션 방어 — 사용자 입력은 항상 이스케이프한다.
 * 외부 라이브러리 금지(ADR-002)이므로 textContent 트릭으로 직접 구현.
 *
 * @param {string} str - 이스케이프할 문자열
 * @returns {string} HTML 안전 문자열
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─────────────────────────────────────────────
// 이벤트 바인딩 — 이벤트 위임 패턴 일관 적용
// ─────────────────────────────────────────────

// FR-01: 입력 + 추가 버튼 + Enter
titleInput.addEventListener('input', updateAddButtonState);
addButton.addEventListener('click', addTask);
titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});
subjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});

// FR-02: 체크박스 변경 (이벤트 위임)
taskListEl.addEventListener('change', (e) => {
  if (!e.target.classList.contains('task-item-checkbox')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) toggleTaskCompletion(taskItem.dataset.taskId);
});

// FR-03 + FR-11: 클릭 — 삭제 또는 수정 모드 진입
taskListEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('task-item-delete')) {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) deleteTask(taskItem.dataset.taskId);
    return;
  }

  if (e.target.classList.contains('task-item-title')) {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) startEditingTask(taskItem.dataset.taskId);
    return;
  }
});

// FR-11 + NFR-04: 키보드 이벤트 통합 처리
taskListEl.addEventListener('keydown', (e) => {
  // 수정 input 안에서 Enter/Esc
  if (e.target.classList.contains('task-item-title-input')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditingTask();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingTask();
    }
    return;
  }

  // 일반 모드 제목에서 Enter/Space → 수정 모드 진입 (NFR-04 키보드 접근성)
  if (e.target.classList.contains('task-item-title')) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const taskItem = e.target.closest('.task-item');
      if (taskItem) startEditingTask(taskItem.dataset.taskId);
    }
  }
});

// FR-11: 수정 input의 blur — 100ms 지연 후 저장 (click 이벤트 우선 처리 위함)
taskListEl.addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('task-item-title-input')) return;
  setTimeout(() => {
    if (editingTaskId !== null) saveEditingTask();
  }, 100);
});

// FR-06: 필터 칩 클릭 (이벤트 위임)
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

console.log('Study Planner v1.0-rc1 (Day 17 NFR보강) —', tasks.length, 'tasks loaded');
