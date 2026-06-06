/**
 * Study Planner — v4.1
 *
 * v1.0 기능: FR-01~FR-11 (FR-05는 FR-01에 포함)
 * v2.0 추가: 월간 캘린더, 날짜별 태스크, 요일별 시간표 자동생성, 30일 차트
 * v3.0 추가: 탭 네비게이션, 설정 페이지, 샘플 데이터 시드
 * v4.0 추가: 우선순위, 메모, D-day 트래커, 타이머, 목표 확장
 * v4.1 추가: 타이머 시간 설정, 에브리타임 스타일 시간표
 * v4.2 추가: 서브태스크
 */

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** localStorage 키 */
const STORAGE_KEY = 'study-planner:tasks';
const SCHEDULE_KEY = 'study-planner:schedule';
const TIMETABLE_KEY = 'study-planner:timetable';
const GENERATED_KEY = 'study-planner:generated';
const GOAL_KEY = 'study-planner:goal';
const PAGE_KEY = 'study-planner:page';
const SEEDED_KEY = 'study-planner:seeded';
const DDAY_KEY = 'study-planner:ddays';
const SESSIONS_KEY = 'study-planner:sessions';

/** Task 필수 필드 — 하위 호환 (date 제외) */
const REQUIRED_FIELDS = ['id', 'title', 'subject', 'completed', 'createdAt', 'completedAt'];

const FILTER_ALL = 'all';
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
const TIMETABLE_DAYS = ['월', '화', '수', '목', '금'];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABELS = { high: '높음', medium: '보통', low: '낮음' };
const PRIORITY_CYCLE = { high: 'medium', medium: 'low', low: 'high' };

/** 시간표 시간 범위 */
const TT_START_HOUR = 8;
const TT_END_HOUR = 22;
const TT_HOUR_HEIGHT = 50; // px per hour

/** 시간표 블록 색상 팔레트 */
const BLOCK_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#DDA0DD', '#F4A460', '#87CEEB', '#98D8C8',
  '#FFB347', '#77DD77', '#AEC6CF', '#FDFD96'
];

// ─────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────

/** @type {Array<Object>} */
let tasks = [];
let currentFilter = FILTER_ALL;
/** @type {string|null} */
let editingTaskId = null;
/** @type {string|null} */
let editingMemoTaskId = null;

/** 완료율 통계 탭 ('weekday' | 'weekly' | 'monthly') */
let completionStatsMode = 'weekday';

/** 선택된 날짜 (YYYY-MM-DD) */
let selectedDate = toDateString(new Date());
/** 캘린더 표시 연도 */
let calendarYear = new Date().getFullYear();
/** 캘린더 표시 월 (0-11) */
let calendarMonth = new Date().getMonth();

/** 현재 페이지 */
let currentPage = 'home';

/** 타이머 상태 */
let timerState = {
  isRunning: false,
  isBreak: false,
  focusMinutes: 25,
  breakMinutes: 5,
  timeLeft: 25 * 60,
  subject: '',
  intervalId: null,
  sessionsToday: 0
};

/** 시간표 편집 중인 블록 ID (null이면 새 블록 추가 모드) */
let editingBlockId = null;

/** 시간표 드래그 상태 */
let dragState = {
  active: false,
  blockId: null,
  startMouseY: 0,
  startMouseX: 0,
  originalTop: 0,
  originalDay: 0,
  blockDuration: 0, // 분 단위
  ghostEl: null,
  moved: false       // 실제로 이동했는지 (클릭 vs 드래그 구분)
};

// ─────────────────────────────────────────────
// DOM 참조
// ─────────────────────────────────────────────

const titleInput = document.getElementById('task-title-input');
const subjectInput = document.getElementById('task-subject-input');
const priorityInput = document.getElementById('task-priority-input');
const memoInput = document.getElementById('task-memo-input');
const addButton = document.getElementById('add-task-button');
const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const todayDateEl = document.getElementById('today-date');
const filterAreaEl = document.getElementById('filter-area');
const progressCardEl = document.getElementById('progress-card');
const monthlyChartEl = document.getElementById('monthly-chart');
const completionStatsEl = document.getElementById('completion-stats');
const subjectStatsEl = document.getElementById('subject-stats');
const statsSummaryCardEl = document.getElementById('stats-summary-card');
const studyTimeChartEl = document.getElementById('study-time-chart');

const streakCardEl = document.getElementById('streak-card');
const ddaySectionEl = document.getElementById('dday-section');
const pomodoroSectionEl = document.getElementById('pomodoro-section');

const calGridEl = document.getElementById('cal-grid');
const calMonthLabel = document.getElementById('cal-month-label');
const calPrevBtn = document.getElementById('cal-prev');
const calNextBtn = document.getElementById('cal-next');
const selectedDateLabelEl = document.getElementById('selected-date-label');

const tabNavEl = document.getElementById('tab-nav');

// 시간표 DOM
const timetableGridWrapper = document.getElementById('timetable-grid-wrapper');
const timetableForm = document.getElementById('timetable-form');
const timetableAddBtn = document.getElementById('timetable-add-btn');
const ttSubjectInput = document.getElementById('tt-subject');
const ttDaySelect = document.getElementById('tt-day');
const ttStartInput = document.getElementById('tt-start');
const ttEndInput = document.getElementById('tt-end');
const ttSaveBtn = document.getElementById('tt-save');
const ttCancelBtn = document.getElementById('tt-cancel');
const ttDeleteBtn = document.getElementById('tt-delete');

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isSameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function seededRandom(seed) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function formatSeconds(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 과목명 → 색상 (해시 기반) */
function subjectToColor(subject) {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length];
}

/** "HH:MM" → 분 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** 분 → "HH:MM" */
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// localStorage 영속성
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
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('localStorage 접근 불가:', e.message);
    return [];
  }

  if (raw === null) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn('파싱 실패:', e.message);
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.warn('배열이 아님');
    return [];
  }

  const valid = parsed.filter(item => {
    const ok = item && typeof item === 'object' &&
               REQUIRED_FIELDS.every(field => field in item);
    if (!ok) console.warn('필수 필드 누락 항목 무시:', item);
    return ok;
  });

  let migrated = false;
  valid.forEach(task => {
    if (!task.date) {
      task.date = toDateString(new Date(task.createdAt));
      migrated = true;
    }
    if (!task.priority) {
      task.priority = 'medium';
      migrated = true;
    }
    if (task.memo === undefined || task.memo === null) {
      task.memo = '';
      migrated = true;
    }
    if (!Array.isArray(task.subtasks)) {
      task.subtasks = [];
      migrated = true;
    }
  });

  if (migrated) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    } catch (e) {
      console.warn('마이그레이션 저장 실패:', e.message);
    }
  }

  return valid;
}

// ─────────────────────────────────────────────
// 시간표 데이터 (에브리타임 스타일)
// ─────────────────────────────────────────────

/**
 * 시간표 블록 로드
 * @returns {Array<{id, subject, day, startHour, startMin, endHour, endMin, color}>}
 */
function loadTimetable() {
  try {
    const raw = localStorage.getItem(TIMETABLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('시간표 로드 실패:', e.message);
  }
  return [];
}

function saveTimetable(blocks) {
  try {
    localStorage.setItem(TIMETABLE_KEY, JSON.stringify(blocks));
  } catch (e) {
    console.warn('시간표 저장 실패:', e.message);
  }
}

function addTimetableBlock(subject, day, startHour, startMin, endHour, endMin) {
  const blocks = loadTimetable();
  blocks.push({
    id: crypto.randomUUID(),
    subject: subject.trim(),
    day,
    startHour, startMin,
    endHour, endMin,
    color: subjectToColor(subject.trim())
  });
  saveTimetable(blocks);
}

function updateTimetableBlock(id, subject, day, startHour, startMin, endHour, endMin) {
  const blocks = loadTimetable();
  const block = blocks.find(b => b.id === id);
  if (!block) return;
  block.subject = subject.trim();
  block.day = day;
  block.startHour = startHour;
  block.startMin = startMin;
  block.endHour = endHour;
  block.endMin = endMin;
  block.color = subjectToColor(subject.trim());
  saveTimetable(blocks);
}

function deleteTimetableBlock(id) {
  const blocks = loadTimetable().filter(b => b.id !== id);
  saveTimetable(blocks);
}

/**
 * 특정 요일의 과목 목록 (자동생성용)
 * @param {number} dayIndex - 0=일, 1=월, ..., 6=토
 * @returns {string[]}
 */
function getTimetableSubjectsForDay(dayIndex) {
  // timetable의 day: 1=월, 2=화, ..., 5=금
  // dayIndex (JS getDay()): 0=일, 1=월, ..., 6=토
  const blocks = loadTimetable();
  const ttDay = dayIndex; // 1=월 matches both
  return [...new Set(blocks.filter(b => b.day === ttDay).map(b => b.subject))];
}

// ─────────────────────────────────────────────
// D-day 데이터
// ─────────────────────────────────────────────

function loadDdays() {
  try {
    const raw = localStorage.getItem(DDAY_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('D-day 로드 실패:', e.message);
  }
  return [];
}

function saveDdays(ddays) {
  try {
    localStorage.setItem(DDAY_KEY, JSON.stringify(ddays));
  } catch (e) {
    console.warn('D-day 저장 실패:', e.message);
  }
}

function addDday(title, date) {
  if (!title.trim() || !date) return;
  const ddays = loadDdays();
  ddays.push({ id: crypto.randomUUID(), title: title.trim(), date });
  saveDdays(ddays);
}

function deleteDday(id) {
  const ddays = loadDdays().filter(d => d.id !== id);
  saveDdays(ddays);
}

// ─────────────────────────────────────────────
// 공부 세션 데이터 (타이머)
// ─────────────────────────────────────────────

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('세션 로드 실패:', e.message);
  }
  return [];
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('세션 저장 실패:', e.message);
  }
}

function addSession(subject, minutes) {
  const sessions = loadSessions();
  sessions.push({
    date: toDateString(new Date()),
    subject,
    minutes,
    completedAt: new Date().toISOString()
  });
  saveSessions(sessions);
}

function getTodaySessions() {
  const todayStr = toDateString(new Date());
  return loadSessions().filter(s => s.date === todayStr);
}

// ─────────────────────────────────────────────
// 페이지 전환
// ─────────────────────────────────────────────

function switchPage(pageName) {
  currentPage = pageName;

  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('page--active', el.dataset.page === pageName);
  });

  tabNavEl.querySelectorAll('.tab-nav-btn').forEach(btn => {
    btn.classList.toggle('tab-nav-btn--active', btn.dataset.page === pageName);
  });

  try {
    localStorage.setItem(PAGE_KEY, pageName);
  } catch (e) { /* ignore */ }

  renderCurrentPage();
}

function renderCurrentPage() {
  switch (currentPage) {
    case 'home':
      renderStreakCard();
      renderDdaySection();
      renderTimer();
      renderCalendar();
      renderSelectedDateLabel();
      renderProgressCard();
      renderFilterChips();
      renderTaskList();
      break;
    case 'stats':
      renderStatsSummary();
      renderStudyTimeChart();
      renderMonthlyChart();
      renderCompletionStats();
      renderSubjectStats();
      break;
    case 'schedule':
      renderTimetable();
      break;
    case 'settings':
      renderSettingsPage();
      renderDdaySettings();
      break;
  }
}

// ─────────────────────────────────────────────
// 목표 + 스트릭
// ─────────────────────────────────────────────

function loadGoal() {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.dailyTarget === 'number' && parsed.dailyTarget >= 1) {
        return {
          dailyTarget: parsed.dailyTarget || 1,
          weeklyTarget: parsed.weeklyTarget || 15,
          dailyStudyMinutes: parsed.dailyStudyMinutes || 120
        };
      }
    }
  } catch (e) {
    console.warn('목표 로드 실패:', e.message);
  }
  return { dailyTarget: 1, weeklyTarget: 15, dailyStudyMinutes: 120 };
}

function saveGoal(goal) {
  try {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  } catch (e) {
    console.warn('목표 저장 실패:', e.message);
  }
}

function isDayAchieved(dateStr) {
  const todayStr = toDateString(new Date());
  if (dateStr > todayStr) return null;

  const dateTasks = getTasksForDate(dateStr);
  if (dateTasks.length === 0) return null;

  const completed = dateTasks.filter(t => t.completed).length;
  const goal = loadGoal();
  return completed >= goal.dailyTarget;
}

function calcStreak() {
  const today = new Date();
  let streak = 0;
  let d = new Date(today);

  for (let i = 0; i < 365; i++) {
    const ds = toDateString(d);
    const result = isDayAchieved(ds);

    if (result === true) {
      streak++;
    } else if (result === false) {
      break;
    }

    d.setDate(d.getDate() - 1);
  }

  return streak;
}

function renderStreakCard() {
  const streak = calcStreak();
  const goal = loadGoal();

  const streakText = streak > 0
    ? `\uD83D\uDD25 연속 ${streak}일 달성!`
    : '오늘부터 시작해보세요!';

  const todayStr = toDateString(new Date());
  const todayTasks = getTasksForDate(todayStr);
  const todayCompleted = todayTasks.filter(t => t.completed).length;
  const dailyPct = Math.min(100, Math.round((todayCompleted / goal.dailyTarget) * 100));

  const today = new Date();
  const todayDow = today.getDay();
  const mondayOffset = todayDow === 0 ? 6 : todayDow - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);
  const weekStartStr = toDateString(weekStart);
  const weekTasks = tasks.filter(t => t.date >= weekStartStr && t.date <= todayStr);
  const weekCompleted = weekTasks.filter(t => t.completed).length;
  const weeklyPct = Math.min(100, Math.round((weekCompleted / goal.weeklyTarget) * 100));

  const dailyFillClass = dailyPct >= 100 ? ' streak-progress-fill--achieved' : '';
  const weeklyFillClass = weeklyPct >= 100 ? ' streak-progress-fill--achieved' : '';

  streakCardEl.innerHTML = `
    <div class="streak-card-top">
      <div class="streak-card-left">${streakText}</div>
      <div class="streak-card-right">
        <span class="streak-card-goal-label">목표: 매일 <strong>${goal.dailyTarget}</strong>개</span>
        <button class="streak-card-change-btn" id="streak-goal-change-btn">변경</button>
      </div>
    </div>
    <div class="streak-progress-section">
      <div class="streak-progress-item">
        <div class="streak-progress-label">
          <span>오늘</span>
          <span>${todayCompleted}/${goal.dailyTarget}</span>
        </div>
        <div class="streak-progress-bar">
          <div class="streak-progress-fill${dailyFillClass}" style="width:${dailyPct}%"></div>
        </div>
      </div>
      <div class="streak-progress-item">
        <div class="streak-progress-label">
          <span>이번 주</span>
          <span>${weekCompleted}/${goal.weeklyTarget}</span>
        </div>
        <div class="streak-progress-bar">
          <div class="streak-progress-fill${weeklyFillClass}" style="width:${weeklyPct}%"></div>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// D-day 섹션 (홈)
// ─────────────────────────────────────────────

function renderDdaySection() {
  const ddays = loadDdays();
  if (ddays.length === 0) {
    ddaySectionEl.innerHTML = '';
    return;
  }

  const todayStr = toDateString(new Date());
  const today = new Date(todayStr + 'T00:00:00');

  const sorted = ddays.map(d => {
    const target = new Date(d.date + 'T00:00:00');
    const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
    return { ...d, diff };
  }).sort((a, b) => a.diff - b.diff);

  const cards = sorted.map(d => {
    let valueText, valueClass = '';
    if (d.diff === 0) {
      valueText = 'D-day';
      valueClass = ' dday-card-value--today';
    } else if (d.diff > 0) {
      valueText = `D-${d.diff}`;
    } else {
      valueText = `D+${Math.abs(d.diff)}`;
      valueClass = ' dday-card-value--past';
    }

    const dateLabel = `${new Date(d.date + 'T00:00:00').getMonth() + 1}/${new Date(d.date + 'T00:00:00').getDate()}`;

    return `
      <div class="dday-card">
        <div class="dday-card-title">${escapeHtml(d.title)}</div>
        <div class="dday-card-value${valueClass}">${valueText}</div>
        <div class="dday-card-date">${dateLabel}</div>
      </div>
    `;
  }).join('');

  ddaySectionEl.innerHTML = `<div class="dday-scroll">${cards}</div>`;
}

// ─────────────────────────────────────────────
// D-day 설정 (설정 페이지)
// ─────────────────────────────────────────────

function renderDdaySettings() {
  const ddays = loadDdays();
  const listEl = document.getElementById('dday-list');
  if (!listEl) return;

  if (ddays.length === 0) {
    listEl.innerHTML = '<li style="font-size:0.85rem;color:#8e8e93;padding:0.5rem 0">등록된 D-day가 없습니다</li>';
    return;
  }

  listEl.innerHTML = ddays.map(d => `
    <li class="dday-manage-item" data-dday-id="${d.id}">
      <span>
        <span class="dday-manage-info">${escapeHtml(d.title)}</span>
        <span class="dday-manage-date">${d.date}</span>
      </span>
      <button class="dday-manage-delete" data-dday-id="${d.id}">&times;</button>
    </li>
  `).join('');
}

// ─────────────────────────────────────────────
// 타이머
// ─────────────────────────────────────────────

function renderTimer() {
  const allSubjects = Array.from(new Set(tasks.map(t => t.subject))).sort();
  const todaySessions = getTodaySessions();
  timerState.sessionsToday = todaySessions.length;

  const options = allSubjects.map(s =>
    `<option value="${escapeHtml(s)}"${timerState.subject === s ? ' selected' : ''}>${escapeHtml(s)}</option>`
  ).join('');

  const timerClass = timerState.isBreak ? ' pomodoro-timer--break' : '';
  const modeLabel = timerState.isBreak ? '휴식 중' : '집중';

  const startPauseBtn = timerState.isRunning
    ? '<button class="pomodoro-btn" id="pomo-pause">일시정지</button>'
    : '<button class="pomodoro-btn pomodoro-btn--primary" id="pomo-start">시작</button>';

  const disabledAttr = timerState.isRunning ? ' disabled' : '';

  pomodoroSectionEl.innerHTML = `
    <div class="pomodoro-header">
      <span class="pomodoro-title">타이머 (${modeLabel})</span>
      <span class="pomodoro-sessions">오늘 ${timerState.sessionsToday}세션 완료</span>
    </div>
    <div class="pomodoro-body">
      <select class="pomodoro-select" id="pomo-subject"${timerState.isRunning ? ' disabled' : ''}>
        <option value="">과목 선택</option>
        ${options}
      </select>
      <div class="pomodoro-timer${timerClass}" id="pomo-timer">${formatSeconds(timerState.timeLeft)}</div>
      <div class="pomodoro-controls">
        ${startPauseBtn}
        <button class="pomodoro-btn pomodoro-btn--danger" id="pomo-reset">초기화</button>
      </div>
    </div>
    <div class="pomodoro-settings">
      <span class="pomodoro-settings-label">집중</span>
      <input type="number" class="pomodoro-duration-input" id="pomo-focus-min"
             value="${timerState.focusMinutes}" min="1" max="120"${disabledAttr}>
      <span class="pomodoro-settings-label">분 / 휴식</span>
      <input type="number" class="pomodoro-duration-input" id="pomo-break-min"
             value="${timerState.breakMinutes}" min="1" max="60"${disabledAttr}>
      <span class="pomodoro-settings-label">분</span>
    </div>
  `;
}

function startTimer() {
  const selectEl = document.getElementById('pomo-subject');
  if (!timerState.subject && selectEl) {
    timerState.subject = selectEl.value;
  }
  if (!timerState.subject) {
    alert('과목을 선택해주세요.');
    return;
  }

  timerState.isRunning = true;
  timerState.intervalId = setInterval(() => {
    timerState.timeLeft--;

    const timerEl = document.getElementById('pomo-timer');
    if (timerEl) {
      timerEl.textContent = formatSeconds(timerState.timeLeft);
    }

    if (timerState.timeLeft <= 0) {
      clearInterval(timerState.intervalId);
      timerState.intervalId = null;
      timerState.isRunning = false;

      if (!timerState.isBreak) {
        addSession(timerState.subject, timerState.focusMinutes);
        timerState.isBreak = true;
        timerState.timeLeft = timerState.breakMinutes * 60;
        alert(`${timerState.subject} ${timerState.focusMinutes}분 집중 완료! ${timerState.breakMinutes}분 휴식을 시작하세요.`);
      } else {
        timerState.isBreak = false;
        timerState.timeLeft = timerState.focusMinutes * 60;
        alert('휴식 완료! 다음 세션을 시작하세요.');
      }

      renderTimer();
    }
  }, 1000);

  renderTimer();
}

function pauseTimer() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.isRunning = false;
  renderTimer();
}

function resetTimer() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
  timerState.isRunning = false;
  timerState.isBreak = false;
  timerState.timeLeft = timerState.focusMinutes * 60;
  timerState.subject = '';
  renderTimer();
}

// ─────────────────────────────────────────────
// FR-01: 학습 항목 추가
// ─────────────────────────────────────────────

function renderTodayDate() {
  const today = new Date();
  todayDateEl.textContent = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  });
}

function createTask(title, subject, priority, memo) {
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    subject: subject.trim() || '(미분류)',
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    date: selectedDate,
    priority: priority || 'medium',
    memo: (memo || '').trim(),
    subtasks: []
  };
}

function addTask() {
  const title = titleInput.value;
  if (!title.trim()) return;

  const priority = priorityInput.value;
  const memo = memoInput.value;

  tasks.unshift(createTask(title, subjectInput.value, priority, memo));
  titleInput.value = '';
  subjectInput.value = '';
  priorityInput.value = 'medium';
  memoInput.value = '';
  updateAddButtonState();

  saveTasks();
  renderAll();
  titleInput.focus();
}

function updateAddButtonState() {
  addButton.disabled = titleInput.value.trim().length === 0;
}

// ─────────────────────────────────────────────
// FR-02: 완료 토글
// ─────────────────────────────────────────────

function toggleTaskCompletion(taskId) {
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

  if (editingTaskId === taskId) editingTaskId = null;
  if (editingMemoTaskId === taskId) editingMemoTaskId = null;

  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// 우선순위 순환 변경
// ─────────────────────────────────────────────

function cyclePriority(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.priority = PRIORITY_CYCLE[task.priority] || 'medium';
  saveTasks();
  renderAll();
}

// ─────────────────────────────────────────────
// FR-06: 과목 필터링
// ─────────────────────────────────────────────

function getSubjectList() {
  const dateTasks = getTasksForDate(selectedDate);
  return Array.from(new Set(dateTasks.map(t => t.subject))).sort();
}

function getTasksForDate(dateStr) {
  return tasks.filter(t => t.date === dateStr);
}

function renderFilterChips() {
  const dateTasks = getTasksForDate(selectedDate);
  const subjects = getSubjectList();

  if (dateTasks.length === 0) {
    filterAreaEl.innerHTML = '';
    return;
  }

  const allChip = `
    <button class="filter-chip${currentFilter === FILTER_ALL ? ' filter-chip--active' : ''}"
            data-filter="${FILTER_ALL}">
      전체 (${dateTasks.length})
    </button>
  `;

  const subjectChips = subjects.map(subject => {
    const count = dateTasks.filter(t => t.subject === subject).length;
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
  let dateTasks = getTasksForDate(selectedDate);
  if (currentFilter !== FILTER_ALL) {
    dateTasks = dateTasks.filter(t => t.subject === currentFilter);
  }
  return dateTasks.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    return pa - pb;
  });
}

function setFilter(filter) {
  if (editingTaskId !== null) saveEditingTask();
  currentFilter = filter;
  renderAll();
}

// ─────────────────────────────────────────────
// FR-08: 진도 카드
// ─────────────────────────────────────────────

function renderProgressCard() {
  const todayStr = toDateString(new Date());
  const dateTasks = getTasksForDate(selectedDate);
  const isToday = selectedDate === todayStr;

  const labelDate = isToday ? '오늘 진도' : formatDateLabel(selectedDate) + ' 진도';

  if (dateTasks.length === 0) {
    progressCardEl.innerHTML = `
      <div class="progress-card-label">${labelDate}</div>
      <div class="progress-card-empty">학습 없음</div>
    `;
    return;
  }

  const completed = dateTasks.filter(t => t.completed).length;
  const rate = Math.round((completed / dateTasks.length) * 100);

  progressCardEl.innerHTML = `
    <div class="progress-card-label">${labelDate}</div>
    <div class="progress-card-value">${rate}%</div>
    <div class="progress-card-detail">${completed} / ${dateTasks.length}</div>
  `;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─────────────────────────────────────────────
// 통계 요약 카드
// ─────────────────────────────────────────────

function renderStatsSummary() {
  const goal = loadGoal();

  if (tasks.length === 0) {
    statsSummaryCardEl.innerHTML = `
      <div class="stats-summary-grid">
        <div class="stats-summary-item">
          <div class="stats-summary-label">전체</div>
          <div class="progress-card-empty">데이터 없음</div>
        </div>
      </div>
    `;
    return;
  }

  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const rate = Math.round((completed / total) * 100);

  const today = new Date();
  const todayDow = today.getDay();
  const mondayOffset = todayDow === 0 ? 6 : todayDow - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - mondayOffset);
  const weekStartStr = toDateString(weekStart);
  const todayStr = toDateString(today);
  const weekTasks = tasks.filter(t => t.date >= weekStartStr && t.date <= todayStr);
  const weekTotal = weekTasks.length;
  const weekCompleted = weekTasks.filter(t => t.completed).length;
  const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthTasks = tasks.filter(t => t.date.startsWith(monthPrefix));
  const monthTotal = monthTasks.length;
  const monthCompleted = monthTasks.filter(t => t.completed).length;
  const monthRate = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;

  const todaySessions = getTodaySessions();
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const studyPct = Math.min(100, Math.round((todayMinutes / goal.dailyStudyMinutes) * 100));

  statsSummaryCardEl.innerHTML = `
    <div class="stats-summary-grid">
      <div class="stats-summary-item">
        <div class="stats-summary-label">전체</div>
        <div class="stats-summary-value">${rate}%</div>
        <div class="stats-summary-detail">${completed} / ${total}</div>
      </div>
      <div class="stats-summary-item">
        <div class="stats-summary-label">이번 주</div>
        <div class="stats-summary-value">${weekTotal > 0 ? weekRate + '%' : '-'}</div>
        <div class="stats-summary-detail">${weekCompleted} / ${weekTotal}</div>
      </div>
      <div class="stats-summary-item">
        <div class="stats-summary-label">이번 달</div>
        <div class="stats-summary-value">${monthTotal > 0 ? monthRate + '%' : '-'}</div>
        <div class="stats-summary-detail">${monthCompleted} / ${monthTotal}</div>
      </div>
    </div>
    <div class="stats-summary-grid" style="margin-top:0.5rem">
      <div class="stats-summary-item">
        <div class="stats-summary-label">오늘 공부시간</div>
        <div class="stats-summary-value">${todayMinutes}분</div>
        <div class="stats-summary-detail">목표 ${goal.dailyStudyMinutes}분 (${studyPct}%)</div>
      </div>
      <div class="stats-summary-item">
        <div class="stats-summary-label">주간 목표</div>
        <div class="stats-summary-value">${weekCompleted}/${goal.weeklyTarget}</div>
        <div class="stats-summary-detail">${Math.min(100, Math.round((weekCompleted / goal.weeklyTarget) * 100))}% 달성</div>
      </div>
      <div class="stats-summary-item">
        <div class="stats-summary-label">오늘 세션</div>
        <div class="stats-summary-value">${todaySessions.length}</div>
        <div class="stats-summary-detail">타이머</div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// 공부시간 차트 (14일)
// ─────────────────────────────────────────────

function renderStudyTimeChart() {
  const sessions = loadSessions();
  const goal = loadGoal();
  const today = new Date();
  const data = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = toDateString(d);
    const dayMinutes = sessions
      .filter(s => s.date === ds)
      .reduce((sum, s) => sum + s.minutes, 0);

    data.push({
      date: ds,
      minutes: dayMinutes,
      isToday: i === 0,
      label: String(d.getDate())
    });
  }

  const totalMinutes = data.reduce((sum, d) => sum + d.minutes, 0);

  if (totalMinutes === 0) {
    studyTimeChartEl.innerHTML = `
      <div class="study-time-chart-title">최근 14일 공부시간</div>
      <div class="study-time-chart-empty">공부 세션 기록이 없습니다</div>
    `;
    return;
  }

  const maxMinutes = Math.max(...data.map(d => d.minutes));

  const bars = data.map(d => {
    const heightPct = maxMinutes > 0 ? (d.minutes / maxMinutes) * 100 : 0;
    const countLabel = d.minutes > 0 ? `<span class="study-time-bar-count">${d.minutes}</span>` : '';
    const todayClass = d.isToday ? ' study-time-bar-wrapper--today' : '';

    return `
      <div class="study-time-bar-wrapper${todayClass}">
        ${countLabel}
        <div class="study-time-bar" style="height: ${heightPct}%"></div>
        <div class="study-time-bar-label">${d.label}</div>
      </div>
    `;
  }).join('');

  studyTimeChartEl.innerHTML = `
    <div class="study-time-chart-title">최근 14일 공부시간</div>
    <div class="study-time-chart-scroll">
      <div class="study-time-chart-bars">${bars}</div>
    </div>
    <div class="study-time-chart-goal">일일 목표: ${goal.dailyStudyMinutes}분</div>
  `;
}

// ─────────────────────────────────────────────
// 월간 캘린더
// ─────────────────────────────────────────────

function renderCalendar() {
  const todayStr = toDateString(new Date());

  calMonthLabel.textContent = `${calendarYear}년 ${calendarMonth + 1}월`;

  let html = WEEKDAY_SHORT.map(d => `<div class="calendar-weekday">${d}</div>`).join('');

  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const prevLastDay = new Date(calendarYear, calendarMonth, 0);
  const prevDays = prevLastDay.getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const day = prevDays - i;
    const d = new Date(calendarYear, calendarMonth - 1, day);
    const ds = toDateString(d);
    const hasTasks = tasks.some(t => t.date === ds);
    html += `<div class="calendar-day calendar-day--other-month${hasTasks ? ' calendar-day--has-tasks' : ''}" data-date="${ds}">${day}</div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(calendarYear, calendarMonth, day);
    const ds = toDateString(d);
    const hasTasks = tasks.some(t => t.date === ds);
    let cls = 'calendar-day';
    if (ds === todayStr) cls += ' calendar-day--today';
    if (ds === selectedDate) cls += ' calendar-day--selected';
    if (hasTasks) cls += ' calendar-day--has-tasks';
    const achieved = isDayAchieved(ds);
    if (achieved === true) cls += ' calendar-day--achieved';
    else if (achieved === false) cls += ' calendar-day--missed';
    html += `<div class="${cls}" data-date="${ds}">${day}</div>`;
  }

  const totalCells = startDow + totalDays;
  const remaining = (Math.ceil(totalCells / 7) * 7) - totalCells;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(calendarYear, calendarMonth + 1, day);
    const ds = toDateString(d);
    const hasTasks = tasks.some(t => t.date === ds);
    html += `<div class="calendar-day calendar-day--other-month${hasTasks ? ' calendar-day--has-tasks' : ''}" data-date="${ds}">${day}</div>`;
  }

  calGridEl.innerHTML = html;
}

function renderSelectedDateLabel() {
  const d = new Date(selectedDate + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = WEEKDAY_KO[d.getDay()];
  selectedDateLabelEl.textContent = `${month}월 ${day}일 (${dow}) 학습 항목`;
}

// ─────────────────────────────────────────────
// 월간 차트 (30일)
// ─────────────────────────────────────────────

function getMonthlyData() {
  const today = new Date();
  const result = [];

  for (let i = 29; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);

    const count = tasks.filter(t =>
      t.completed && t.completedAt && isSameDay(t.completedAt, day)
    ).length;

    result.push({
      date: day,
      count,
      isToday: i === 0,
      label: String(day.getDate())
    });
  }
  return result;
}

function renderMonthlyChart() {
  const data = getMonthlyData();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    monthlyChartEl.innerHTML = `
      <div class="monthly-chart-title">최근 30일 완료 항목</div>
      <div class="monthly-chart-empty">완료된 항목이 아직 없습니다</div>
    `;
    return;
  }

  const maxCount = Math.max(...data.map(d => d.count));

  const bars = data.map(d => {
    const heightPct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
    const countLabel = d.count > 0 ? `<span class="monthly-chart-count">${d.count}</span>` : '';
    const todayClass = d.isToday ? ' monthly-chart-bar-wrapper--today' : '';

    return `
      <div class="monthly-chart-bar-wrapper${todayClass}">
        ${countLabel}
        <div class="monthly-chart-bar" style="height: ${heightPct}%"></div>
        <div class="monthly-chart-label">${d.label}</div>
      </div>
    `;
  }).join('');

  monthlyChartEl.innerHTML = `
    <div class="monthly-chart-title">최근 30일 완료 항목</div>
    <div class="monthly-chart-scroll">
      <div class="monthly-chart-bars">${bars}</div>
    </div>
  `;

  const scrollEl = monthlyChartEl.querySelector('.monthly-chart-scroll');
  if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
}

// ─────────────────────────────────────────────
// 완료율 통계 (요일별/주별/월별)
// ─────────────────────────────────────────────

function getWeekdayCompletionData() {
  const grouped = {};
  for (let i = 0; i < 7; i++) grouped[i] = { total: 0, completed: 0 };

  tasks.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const dow = d.getDay();
    grouped[dow].total++;
    if (t.completed) grouped[dow].completed++;
  });

  return [1, 2, 3, 4, 5, 6, 0].map(dow => {
    const { total, completed } = grouped[dow];
    return {
      label: WEEKDAY_KO[dow],
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  });
}

function getWeeklyCompletionData() {
  const today = new Date();
  const results = [];

  for (let w = 7; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - (w * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    const startStr = toDateString(weekStart);
    const endStr = toDateString(weekEnd);

    const weekTasks = tasks.filter(t => t.date >= startStr && t.date <= endStr);
    const total = weekTasks.length;
    const completed = weekTasks.filter(t => t.completed).length;

    const startLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const endLabel = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

    results.push({
      label: `${startLabel}~${endLabel}`,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    });
  }

  return results;
}

function getMonthlyCompletionData() {
  const today = new Date();
  const results = [];

  for (let m = 5; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    const monthTasks = tasks.filter(t => t.date.startsWith(prefix));
    const total = monthTasks.length;
    const completed = monthTasks.filter(t => t.completed).length;

    results.push({
      label: `${year}년 ${month + 1}월`,
      total,
      completed,
      rate: total > 0 ? Math.round((completed / total) * 100) : 0
    });
  }

  return results;
}

function renderCompletionStats() {
  if (tasks.length === 0) {
    completionStatsEl.innerHTML = '';
    return;
  }

  const tabs = [
    { key: 'weekday', label: '요일별' },
    { key: 'weekly', label: '주별' },
    { key: 'monthly', label: '월별' }
  ];

  const tabsHtml = tabs.map(t =>
    `<button class="completion-stats-tab${completionStatsMode === t.key ? ' completion-stats-tab--active' : ''}"
             data-mode="${t.key}">${t.label}</button>`
  ).join('');

  let data;
  if (completionStatsMode === 'weekday') data = getWeekdayCompletionData();
  else if (completionStatsMode === 'weekly') data = getWeeklyCompletionData();
  else data = getMonthlyCompletionData();

  const hasData = data.some(d => d.total > 0);

  let bodyHtml;
  if (!hasData) {
    bodyHtml = '<div class="completion-stats-empty">데이터가 없습니다</div>';
  } else {
    bodyHtml = data.filter(d => d.total > 0).map(d => {
      const colorClass = d.rate >= 70 ? 'completion-stats-bar-fill--high'
                       : d.rate >= 40 ? 'completion-stats-bar-fill--mid'
                       : 'completion-stats-bar-fill--low';
      return `
        <div class="completion-stats-row">
          <div class="completion-stats-row-header">
            <span class="completion-stats-row-label">${escapeHtml(d.label)}</span>
            <span class="completion-stats-row-meta">${d.completed} / ${d.total} (${d.rate}%)</span>
          </div>
          <div class="completion-stats-bar-track">
            <div class="completion-stats-bar-fill ${colorClass}" style="width: ${d.rate}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  completionStatsEl.innerHTML = `
    <div class="completion-stats-header">
      <span class="completion-stats-title">완료율 통계</span>
      <div class="completion-stats-tabs">${tabsHtml}</div>
    </div>
    ${bodyHtml}
  `;
}

// ─────────────────────────────────────────────
// FR-10: 과목별 완료율
// ─────────────────────────────────────────────

function renderSubjectStats() {
  if (tasks.length === 0) {
    subjectStatsEl.innerHTML = '';
    return;
  }

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
// FR-11: 제목 수정
// ─────────────────────────────────────────────

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

function cancelEditingTask() {
  editingTaskId = null;
  renderAll();
}

// ─────────────────────────────────────────────
// 메모 인라인 수정
// ─────────────────────────────────────────────

function startEditingMemo(taskId) {
  if (editingMemoTaskId !== null && editingMemoTaskId !== taskId) {
    saveEditingMemo();
  }

  editingMemoTaskId = taskId;
  renderTaskList();

  setTimeout(() => {
    const input = taskListEl.querySelector('.task-item-memo-input');
    if (input) {
      input.focus();
      input.select();
    }
  }, 0);
}

function saveEditingMemo() {
  if (editingMemoTaskId === null) return;

  const input = taskListEl.querySelector('.task-item-memo-input');
  if (!input) {
    editingMemoTaskId = null;
    return;
  }

  const newMemo = input.value.trim();
  const task = tasks.find(t => t.id === editingMemoTaskId);

  if (task) {
    task.memo = newMemo;
    saveTasks();
  }

  editingMemoTaskId = null;
  renderAll();
}

function cancelEditingMemo() {
  editingMemoTaskId = null;
  renderAll();
}

// ─────────────────────────────────────────────
// 서브태스크
// ─────────────────────────────────────────────

function addSubtask(taskId, title) {
  if (!title.trim()) return;
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  task.subtasks.push({
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false
  });
  saveTasks();
  renderTaskList();
}

function toggleSubtask(taskId, subtaskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.subtasks) return;
  const sub = task.subtasks.find(s => s.id === subtaskId);
  if (!sub) return;
  sub.completed = !sub.completed;
  saveTasks();
  renderTaskList();
}

function deleteSubtask(taskId, subtaskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.subtasks) return;
  task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
  saveTasks();
  renderTaskList();
}

// ─────────────────────────────────────────────
// 에브리타임 스타일 시간표
// ─────────────────────────────────────────────

function renderTimetable() {
  const blocks = loadTimetable();
  const totalHours = TT_END_HOUR - TT_START_HOUR;
  const gridHeight = totalHours * TT_HOUR_HEIGHT;

  // 시간 라벨 생성
  let timeLabels = '';
  for (let h = TT_START_HOUR; h <= TT_END_HOUR; h++) {
    const top = (h - TT_START_HOUR) * TT_HOUR_HEIGHT;
    timeLabels += `<div class="tt-time-label" style="top:${top}px">${h}</div>`;
  }

  // 요일별 열 생성
  const dayCols = TIMETABLE_DAYS.map((_, dayIdx) => {
    const day = dayIdx + 1; // 1=월, 2=화, ...

    // 시간 가이드 라인
    let lines = '';
    for (let h = TT_START_HOUR; h <= TT_END_HOUR; h++) {
      const top = (h - TT_START_HOUR) * TT_HOUR_HEIGHT;
      const cls = h === TT_START_HOUR || h === TT_END_HOUR ? 'tt-hour-line--full' : '';
      lines += `<div class="tt-hour-line ${cls}" style="top:${top}px"></div>`;
      // 30분 라인
      if (h < TT_END_HOUR) {
        lines += `<div class="tt-hour-line" style="top:${top + TT_HOUR_HEIGHT / 2}px"></div>`;
      }
    }

    // 블록 렌더링
    const dayBlocks = blocks.filter(b => b.day === day);
    const blocksHtml = dayBlocks.map(b => {
      const startOffset = (b.startHour - TT_START_HOUR) * TT_HOUR_HEIGHT + (b.startMin / 60) * TT_HOUR_HEIGHT;
      const endOffset = (b.endHour - TT_START_HOUR) * TT_HOUR_HEIGHT + (b.endMin / 60) * TT_HOUR_HEIGHT;
      const height = endOffset - startOffset;
      const selectedClass = editingBlockId === b.id ? ' tt-block--selected' : '';
      const startTime = `${String(b.startHour).padStart(2, '0')}:${String(b.startMin).padStart(2, '0')}`;
      const endTime = `${String(b.endHour).padStart(2, '0')}:${String(b.endMin).padStart(2, '0')}`;

      return `
        <div class="tt-block${selectedClass}" data-block-id="${b.id}"
             style="top:${startOffset}px;height:${height}px;background:${b.color}">
          <div class="tt-block-subject">${escapeHtml(b.subject)}</div>
          ${height >= 35 ? `<div class="tt-block-time">${startTime}-${endTime}</div>` : ''}
        </div>
      `;
    }).join('');

    return `<div class="tt-day-col" data-day="${day}" style="height:${gridHeight}px">${lines}${blocksHtml}</div>`;
  }).join('');

  // 헤더
  const dayHeaders = TIMETABLE_DAYS.map(d => `<div class="tt-day-header">${d}</div>`).join('');

  timetableGridWrapper.innerHTML = `
    <div class="timetable-grid">
      <div class="tt-corner"></div>
      ${dayHeaders}
      <div class="tt-time-col" style="height:${gridHeight}px">${timeLabels}</div>
      ${dayCols}
    </div>
  `;
}

function showTimetableForm(blockId) {
  editingBlockId = blockId || null;
  timetableForm.hidden = false;

  if (blockId) {
    // 수정 모드
    const blocks = loadTimetable();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    ttSubjectInput.value = block.subject;
    ttDaySelect.value = String(block.day);
    ttStartInput.value = `${String(block.startHour).padStart(2, '0')}:${String(block.startMin).padStart(2, '0')}`;
    ttEndInput.value = `${String(block.endHour).padStart(2, '0')}:${String(block.endMin).padStart(2, '0')}`;
    ttDeleteBtn.hidden = false;
  } else {
    // 추가 모드
    ttSubjectInput.value = '';
    ttDaySelect.value = '1';
    ttStartInput.value = '09:00';
    ttEndInput.value = '10:30';
    ttDeleteBtn.hidden = true;
  }

  ttSubjectInput.focus();
}

function hideTimetableForm() {
  timetableForm.hidden = true;
  editingBlockId = null;
  renderTimetable();
}

// ─────────────────────────────────────────────
// 시간표 드래그 앤 드롭
// ─────────────────────────────────────────────

function startDrag(blockId, clientX, clientY) {
  const blocks = loadTimetable();
  const block = blocks.find(b => b.id === blockId);
  if (!block) return;

  const blockEl = timetableGridWrapper.querySelector(`[data-block-id="${blockId}"]`);
  if (!blockEl) return;

  const dayCol = blockEl.closest('.tt-day-col');
  if (!dayCol) return;

  const gridRect = timetableGridWrapper.getBoundingClientRect();
  const blockRect = blockEl.getBoundingClientRect();

  const durationMins = (block.endHour * 60 + block.endMin) - (block.startHour * 60 + block.startMin);

  dragState = {
    active: true,
    blockId,
    startMouseY: clientY,
    startMouseX: clientX,
    originalTop: blockRect.top - dayCol.getBoundingClientRect().top,
    originalDay: block.day,
    blockDuration: durationMins,
    ghostEl: null,
    moved: false
  };

  // 고스트 요소 생성
  const ghost = blockEl.cloneNode(true);
  ghost.classList.add('tt-block--dragging');
  ghost.style.position = 'fixed';
  ghost.style.left = blockRect.left + 'px';
  ghost.style.top = blockRect.top + 'px';
  ghost.style.width = blockRect.width + 'px';
  ghost.style.height = blockRect.height + 'px';
  ghost.style.zIndex = '1000';
  ghost.style.pointerEvents = 'none';
  document.body.appendChild(ghost);
  dragState.ghostEl = ghost;

  // 원본 블록 반투명
  blockEl.style.opacity = '0.3';
}

function moveDrag(clientX, clientY) {
  if (!dragState.active || !dragState.ghostEl) return;

  const dx = clientX - dragState.startMouseX;
  const dy = clientY - dragState.startMouseY;

  if (!dragState.moved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    dragState.moved = true;
  }

  if (!dragState.moved) return;

  const ghost = dragState.ghostEl;
  const origRect = timetableGridWrapper.querySelector(`[data-block-id="${dragState.blockId}"]`);
  if (!origRect) return;

  const blockRect = origRect.getBoundingClientRect();
  ghost.style.left = (blockRect.left + dx) + 'px';
  ghost.style.top = (blockRect.top + dy) + 'px';
}

function endDrag(clientX, clientY) {
  if (!dragState.active) return;

  // 고스트 제거
  if (dragState.ghostEl) {
    dragState.ghostEl.remove();
    dragState.ghostEl = null;
  }

  // 원본 블록 복원
  const origBlock = timetableGridWrapper.querySelector(`[data-block-id="${dragState.blockId}"]`);
  if (origBlock) origBlock.style.opacity = '';

  if (!dragState.moved) {
    // 클릭으로 처리 (이동 안 함)
    const blockId = dragState.blockId;
    dragState.active = false;
    showTimetableForm(blockId);
    renderTimetable();
    return;
  }

  // 드롭 위치에서 새 요일과 시간 계산
  const dayColEls = timetableGridWrapper.querySelectorAll('.tt-day-col');
  let targetDay = dragState.originalDay;
  let targetTop = dragState.originalTop;

  // 각 요일 열의 위치를 확인하여 드롭된 열 결정
  dayColEls.forEach(col => {
    const rect = col.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right) {
      targetDay = parseInt(col.dataset.day, 10);
      // 열 내에서의 Y 좌표로 시간 계산
      targetTop = clientY - rect.top;
    }
  });

  // 30분 단위로 스냅
  const rawMinutes = (targetTop / TT_HOUR_HEIGHT) * 60 + TT_START_HOUR * 60;
  const snappedMinutes = Math.round(rawMinutes / 30) * 30;

  // 범위 제한
  const startMin = Math.max(TT_START_HOUR * 60, Math.min(snappedMinutes, TT_END_HOUR * 60 - dragState.blockDuration));
  const endMin = startMin + dragState.blockDuration;

  const newStartHour = Math.floor(startMin / 60);
  const newStartMin = startMin % 60;
  const newEndHour = Math.floor(endMin / 60);
  const newEndMin = endMin % 60;

  // 블록 업데이트
  const blocks = loadTimetable();
  const block = blocks.find(b => b.id === dragState.blockId);
  if (block) {
    updateTimetableBlock(
      dragState.blockId,
      block.subject,
      targetDay,
      newStartHour, newStartMin,
      newEndHour, newEndMin
    );
  }

  dragState.active = false;
  renderTimetable();
}

function cancelDrag() {
  if (!dragState.active) return;
  if (dragState.ghostEl) {
    dragState.ghostEl.remove();
    dragState.ghostEl = null;
  }
  const origBlock = timetableGridWrapper.querySelector(`[data-block-id="${dragState.blockId}"]`);
  if (origBlock) origBlock.style.opacity = '';
  dragState.active = false;
  renderTimetable();
}

function saveTimetableForm() {
  const subject = ttSubjectInput.value.trim();
  if (!subject) {
    alert('과목명을 입력해주세요.');
    return;
  }

  const day = parseInt(ttDaySelect.value, 10);
  const startMins = timeToMinutes(ttStartInput.value);
  const endMins = timeToMinutes(ttEndInput.value);

  if (endMins <= startMins) {
    alert('종료 시간이 시작 시간보다 늦어야 합니다.');
    return;
  }

  const startHour = Math.floor(startMins / 60);
  const startMin = startMins % 60;
  const endHour = Math.floor(endMins / 60);
  const endMin = endMins % 60;

  if (startHour < TT_START_HOUR || endHour > TT_END_HOUR) {
    alert(`시간은 ${TT_START_HOUR}시~${TT_END_HOUR}시 범위여야 합니다.`);
    return;
  }

  if (editingBlockId) {
    updateTimetableBlock(editingBlockId, subject, day, startHour, startMin, endHour, endMin);
  } else {
    addTimetableBlock(subject, day, startHour, startMin, endHour, endMin);
  }

  hideTimetableForm();
}

// ─────────────────────────────────────────────
// 설정 페이지
// ─────────────────────────────────────────────

function renderSettingsPage() {
  const goal = loadGoal();
  const goalInput = document.getElementById('settings-goal-input');
  const weeklyInput = document.getElementById('settings-weekly-goal-input');
  const studyMinutesInput = document.getElementById('settings-study-minutes-input');
  if (goalInput) goalInput.value = goal.dailyTarget;
  if (weeklyInput) weeklyInput.value = goal.weeklyTarget;
  if (studyMinutesInput) studyMinutesInput.value = goal.dailyStudyMinutes;
}

// ─────────────────────────────────────────────
// 자동 생성 로직
// ─────────────────────────────────────────────

function autoGenerateScheduledTasks() {
  const todayStr = toDateString(new Date());

  try {
    const lastGenerated = localStorage.getItem(GENERATED_KEY);
    if (lastGenerated === todayStr) return;
  } catch (e) {
    // ignore
  }

  // 시간표 블록에서 오늘 요일의 과목 가져오기
  const todayDow = new Date().getDay(); // 0=일, 1=월, ...
  const subjects = getTimetableSubjectsForDay(todayDow);

  if (subjects.length === 0) {
    try { localStorage.setItem(GENERATED_KEY, todayStr); } catch (e) { /* ignore */ }
    return;
  }

  const todayTasks = getTasksForDate(todayStr);
  let generated = false;

  subjects.forEach(subj => {
    const exists = todayTasks.some(t => t.subject === subj);
    if (exists) return;

    tasks.unshift({
      id: crypto.randomUUID(),
      title: `${subj} 학습`,
      subject: subj,
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      date: todayStr,
      priority: 'medium',
      memo: '',
      subtasks: []
    });
    generated = true;
  });

  if (generated) saveTasks();

  try {
    localStorage.setItem(GENERATED_KEY, todayStr);
  } catch (e) {
    // ignore
  }
}

// ─────────────────────────────────────────────
// 샘플 데이터 시드
// ─────────────────────────────────────────────

function seedSampleData() {
  try {
    if (localStorage.getItem(SEEDED_KEY) === 'true') return;
    if (tasks.length > 0) return;
  } catch (e) { /* ignore */ }

  const subjects = [
    '소프트웨어공학',
    'AI Agent 프로젝트',
    '하네스 엔지니어링',
    '코테 공부',
    '졸업 프로젝트',
    '포트폴리오 작성',
    '이력서 작성'
  ];

  const taskTitles = {
    '소프트웨어공학': ['요구사항 분석', '설계 패턴 정리', 'UML 다이어그램 작성', '테스트 케이스 작성'],
    'AI Agent 프로젝트': ['LLM API 연동', '프롬프트 엔지니어링', 'RAG 파이프라인 구현', '에이전트 루프 설계'],
    '하네스 엔지니어링': ['커넥터 사양 조사', '와이어링 다이어그램 분석', '하네스 설계 검토', 'BOM 작성'],
    '코테 공부': ['그래프 탐색 문제 풀기', 'DP 문제 풀기', '이진 탐색 문제 풀기', '문자열 문제 풀기'],
    '졸업 프로젝트': ['논문 조사', '시스템 아키텍처 설계', '프로토타입 구현', '발표 자료 준비'],
    '포트폴리오 작성': ['프로젝트 정리', 'README 작성', '스크린샷 준비', '배포 링크 확인'],
    '이력서 작성': ['경력 정리', '자기소개서 초안', '프로젝트 설명 작성', '최종 검토']
  };

  const memoOptions = [
    '교수님 피드백 반영', '참고자료 확인 필요', '팀원과 논의 예정',
    '마감 임박', '추가 조사 필요', '복습 중점', '실습 위주로',
    '발표 준비', '코드 리뷰 필요', ''
  ];

  const today = new Date();
  const seededTasks = [];

  const weekdaySubjects = {
    0: ['포트폴리오 작성', '이력서 작성', '코테 공부'],
    1: ['소프트웨어공학', 'AI Agent 프로젝트', '코테 공부'],
    2: ['하네스 엔지니어링', '졸업 프로젝트', '소프트웨어공학'],
    3: ['소프트웨어공학', '코테 공부', '포트폴리오 작성'],
    4: ['AI Agent 프로젝트', '졸업 프로젝트', '이력서 작성'],
    5: ['하네스 엔지니어링', '코테 공부', 'AI Agent 프로젝트'],
    6: ['포트폴리오 작성', '이력서 작성', '졸업 프로젝트']
  };

  for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const dateStr = toDateString(d);
    const dow = d.getDay();

    const daySubjects = weekdaySubjects[dow];

    daySubjects.forEach((subj, idx) => {
      const titles = taskTitles[subj];
      const titleIndex = (daysAgo + idx) % titles.length;
      const title = titles[titleIndex];

      const isCompleted = seededRandom(daysAgo * 17 + idx * 31 + dow * 5) < 0.65;

      const prioRand = seededRandom(daysAgo * 13 + idx * 29 + dow * 7);
      let priority;
      if (prioRand < 0.2) priority = 'high';
      else if (prioRand < 0.7) priority = 'medium';
      else priority = 'low';

      const memoRand = seededRandom(daysAgo * 19 + idx * 37 + dow * 3);
      const memo = memoRand < 0.5
        ? memoOptions[Math.floor(seededRandom(daysAgo * 23 + idx * 41) * (memoOptions.length - 1))]
        : '';

      const createdHour = 8 + Math.floor(seededRandom(daysAgo * 11 + idx * 7) * 4);
      const createdAt = new Date(d);
      createdAt.setHours(createdHour, Math.floor(seededRandom(daysAgo * 5 + idx * 3) * 60), 0, 0);

      let completedAt = null;
      if (isCompleted) {
        const completedHour = createdHour + 1 + Math.floor(seededRandom(daysAgo * 23 + idx * 19) * 6);
        completedAt = new Date(d);
        completedAt.setHours(completedHour, Math.floor(seededRandom(daysAgo * 29 + idx * 11) * 60), 0, 0);
      }

      // 서브태스크: 30% 확률로 2~3개 생성
      let subtasks = [];
      const subRand = seededRandom(daysAgo * 41 + idx * 53 + dow * 11);
      if (subRand < 0.3) {
        const subCount = 2 + Math.floor(seededRandom(daysAgo * 59 + idx * 17) * 2);
        const subTitles = ['자료 조사', '초안 작성', '검토 및 수정', '최종 제출'];
        for (let si = 0; si < subCount; si++) {
          subtasks.push({
            id: crypto.randomUUID(),
            title: subTitles[si % subTitles.length],
            completed: seededRandom(daysAgo * 67 + idx * 23 + si * 7) < (isCompleted ? 0.8 : 0.3)
          });
        }
      }

      seededTasks.push({
        id: crypto.randomUUID(),
        title,
        subject: subj,
        completed: isCompleted,
        createdAt: createdAt.toISOString(),
        completedAt: completedAt ? completedAt.toISOString() : null,
        date: dateStr,
        priority,
        memo,
        subtasks
      });
    });
  }

  tasks = seededTasks;
  saveTasks();

  // 에브리타임 스타일 시간표 시드
  const timetableBlocks = [
    // 월요일
    { subject: '소프트웨어공학', day: 1, startHour: 9, startMin: 0, endHour: 10, endMin: 30 },
    { subject: 'AI Agent 프로젝트', day: 1, startHour: 11, startMin: 0, endHour: 12, endMin: 30 },
    { subject: '코테 공부', day: 1, startHour: 14, startMin: 0, endHour: 15, endMin: 30 },
    // 화요일
    { subject: '하네스 엔지니어링', day: 2, startHour: 9, startMin: 0, endHour: 10, endMin: 30 },
    { subject: '졸업 프로젝트', day: 2, startHour: 11, startMin: 0, endHour: 12, endMin: 30 },
    { subject: '소프트웨어공학', day: 2, startHour: 14, startMin: 0, endHour: 15, endMin: 30 },
    // 수요일
    { subject: '소프트웨어공학', day: 3, startHour: 9, startMin: 0, endHour: 10, endMin: 30 },
    { subject: '코테 공부', day: 3, startHour: 11, startMin: 0, endHour: 12, endMin: 30 },
    { subject: '포트폴리오 작성', day: 3, startHour: 14, startMin: 0, endHour: 15, endMin: 30 },
    // 목요일
    { subject: 'AI Agent 프로젝트', day: 4, startHour: 9, startMin: 0, endHour: 10, endMin: 30 },
    { subject: '졸업 프로젝트', day: 4, startHour: 11, startMin: 0, endHour: 12, endMin: 30 },
    { subject: '이력서 작성', day: 4, startHour: 14, startMin: 0, endHour: 15, endMin: 30 },
    // 금요일
    { subject: '하네스 엔지니어링', day: 5, startHour: 9, startMin: 0, endHour: 10, endMin: 30 },
    { subject: '코테 공부', day: 5, startHour: 11, startMin: 0, endHour: 12, endMin: 30 },
    { subject: 'AI Agent 프로젝트', day: 5, startHour: 14, startMin: 0, endHour: 15, endMin: 30 },
  ].map(b => ({
    ...b,
    id: crypto.randomUUID(),
    color: subjectToColor(b.subject)
  }));
  saveTimetable(timetableBlocks);

  // 목표 설정
  saveGoal({ dailyTarget: 3, weeklyTarget: 15, dailyStudyMinutes: 120 });

  // D-day 시드
  const ddays = [
    { id: crypto.randomUUID(), title: '기말고사', date: toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12)) },
    { id: crypto.randomUUID(), title: '프로젝트 제출', date: toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5)) },
    { id: crypto.randomUUID(), title: '포트폴리오 마감', date: toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 20)) }
  ];
  saveDdays(ddays);

  // 공부 세션 시드
  const seededSessions = [];
  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const dateStr = toDateString(d);
    const dow = d.getDay();
    const daySubjects = weekdaySubjects[dow];

    const sessionCount = 1 + Math.floor(seededRandom(daysAgo * 43 + 7) * 3);
    for (let s = 0; s < sessionCount; s++) {
      const subjIndex = Math.floor(seededRandom(daysAgo * 47 + s * 13) * daySubjects.length);
      const sessionTime = new Date(d);
      sessionTime.setHours(9 + s * 2, Math.floor(seededRandom(daysAgo * 53 + s) * 60), 0, 0);

      seededSessions.push({
        date: dateStr,
        subject: daySubjects[subjIndex],
        minutes: 25,
        completedAt: sessionTime.toISOString()
      });
    }
  }
  saveSessions(seededSessions);

  try {
    localStorage.setItem(SEEDED_KEY, 'true');
  } catch (e) { /* ignore */ }
}

// ─────────────────────────────────────────────
// 렌더링 — 통합 갱신
// ─────────────────────────────────────────────

function renderAll() {
  renderProgressCard();
  renderCurrentPage();
}

function renderTaskList() {
  const filtered = getFilteredTasks();
  const dateTasks = getTasksForDate(selectedDate);

  if (filtered.length === 0) {
    emptyStateEl.hidden = false;
    if (dateTasks.length === 0) {
      emptyStateEl.textContent = '학습할 내용을 추가해보세요';
    } else {
      emptyStateEl.textContent = `"${currentFilter}" 과목에 항목이 없습니다`;
    }
    taskListEl.innerHTML = '';
    return;
  }
  emptyStateEl.hidden = true;

  taskListEl.innerHTML = filtered.map(task => {
    const priority = task.priority || 'medium';
    const modifierClass = task.completed ? ' task-item--completed' : '';
    const priorityClass = ` task-item--priority-${priority}`;
    const completedMeta = task.completed && task.completedAt
      ? ` <span class="task-item-completed-time">\u2192 완료 ${formatTime(task.completedAt)}</span>`
      : '';
    const isEditing = editingTaskId === task.id;
    const isEditingMemo = editingMemoTaskId === task.id;

    const titleHtml = isEditing
      ? `<input type="text" class="task-item-title-input"
                value="${escapeHtml(task.title)}"
                aria-label="제목 수정">`
      : `<div class="task-item-title" tabindex="0"
              role="button" aria-label="${escapeHtml(task.title)} 수정">${escapeHtml(task.title)}</div>`;

    const priorityLabel = `<span class="task-item-priority task-item-priority--${priority}"
                                  data-action="cycle-priority"
                                  title="클릭하여 우선순위 변경">${PRIORITY_LABELS[priority]}</span>`;

    let memoHtml = '';
    if (isEditingMemo) {
      memoHtml = `<input type="text" class="task-item-memo-input"
                         value="${escapeHtml(task.memo || '')}"
                         placeholder="메모 입력..."
                         aria-label="메모 수정">`;
    } else if (task.memo) {
      memoHtml = `<div class="task-item-memo" data-action="edit-memo">${escapeHtml(task.memo)}</div>`;
    }

    // 서브태스크
    const subs = task.subtasks || [];
    const subsDone = subs.filter(s => s.completed).length;
    const hasSubtasks = subs.length > 0;

    const subsListHtml = subs.map(s => `
      <li class="subtask-item${s.completed ? ' subtask-item--completed' : ''}" data-subtask-id="${s.id}">
        <input type="checkbox" class="subtask-checkbox" ${s.completed ? 'checked' : ''}>
        <span class="subtask-title">${escapeHtml(s.title)}</span>
        <button class="subtask-delete" data-action="delete-subtask">&times;</button>
      </li>
    `).join('');

    const subtaskProgress = hasSubtasks
      ? `<span class="subtask-progress">${subsDone}/${subs.length}</span>`
      : '';

    const subtaskSection = `
      <div class="subtask-section">
        ${hasSubtasks ? `<ul class="subtask-list">${subsListHtml}</ul>` : ''}
        <div class="subtask-add">
          <input type="text" class="subtask-add-input" placeholder="하위 항목 추가..." data-action="add-subtask-input">
          <button class="subtask-add-btn" data-action="add-subtask">+</button>
        </div>
      </div>
    `;

    return `
      <li class="task-item${modifierClass}${priorityClass}" data-task-id="${task.id}">
        <input type="checkbox" class="task-item-checkbox"
               ${task.completed ? 'checked' : ''}
               aria-label="${escapeHtml(task.title)} 완료 토글">
        <div class="task-item-body">
          ${titleHtml}
          <div class="task-item-meta">
            ${priorityLabel}
            ${escapeHtml(task.subject)} · ${formatTime(task.createdAt)}${completedMeta}
            ${subtaskProgress}
          </div>
          ${memoHtml}
          ${subtaskSection}
        </div>
        <button class="task-item-delete" aria-label="${escapeHtml(task.title)} 삭제">삭제</button>
      </li>
    `;
  }).join('');
}

// ─────────────────────────────────────────────
// 이벤트 바인딩
// ─────────────────────────────────────────────

// 탭 네비게이션
tabNavEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-nav-btn');
  if (!btn) return;
  const page = btn.dataset.page;
  if (page && page !== currentPage) {
    switchPage(page);
  }
});

// FR-01: 입력
titleInput.addEventListener('input', updateAddButtonState);
addButton.addEventListener('click', addTask);
titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});
subjectInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});
memoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !addButton.disabled) addTask();
});

// FR-02: 체크박스 (태스크 + 서브태스크)
taskListEl.addEventListener('change', (e) => {
  // 서브태스크 체크박스
  if (e.target.classList.contains('subtask-checkbox')) {
    const subtaskItem = e.target.closest('.subtask-item');
    const taskItem = e.target.closest('.task-item');
    if (subtaskItem && taskItem) {
      toggleSubtask(taskItem.dataset.taskId, subtaskItem.dataset.subtaskId);
    }
    return;
  }
  if (!e.target.classList.contains('task-item-checkbox')) return;
  const taskItem = e.target.closest('.task-item');
  if (taskItem) toggleTaskCompletion(taskItem.dataset.taskId);
});

// FR-03 + FR-11 + 우선순위 + 메모 + 서브태스크: 클릭
taskListEl.addEventListener('click', (e) => {
  // 서브태스크 삭제
  if (e.target.dataset.action === 'delete-subtask') {
    const subtaskItem = e.target.closest('.subtask-item');
    const taskItem = e.target.closest('.task-item');
    if (subtaskItem && taskItem) {
      deleteSubtask(taskItem.dataset.taskId, subtaskItem.dataset.subtaskId);
    }
    return;
  }

  // 서브태스크 추가 버튼
  if (e.target.dataset.action === 'add-subtask') {
    const taskItem = e.target.closest('.task-item');
    const input = taskItem ? taskItem.querySelector('.subtask-add-input') : null;
    if (taskItem && input && input.value.trim()) {
      addSubtask(taskItem.dataset.taskId, input.value);
    }
    return;
  }

  if (e.target.classList.contains('task-item-delete')) {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) deleteTask(taskItem.dataset.taskId);
    return;
  }

  if (e.target.dataset.action === 'cycle-priority') {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) cyclePriority(taskItem.dataset.taskId);
    return;
  }

  if (e.target.dataset.action === 'edit-memo') {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) startEditingMemo(taskItem.dataset.taskId);
    return;
  }

  if (e.target.classList.contains('task-item-title')) {
    const taskItem = e.target.closest('.task-item');
    if (taskItem) startEditingTask(taskItem.dataset.taskId);
    return;
  }
});

// FR-11 + NFR-04 + 서브태스크: 키보드
taskListEl.addEventListener('keydown', (e) => {
  // 서브태스크 추가 input에서 Enter
  if (e.target.classList.contains('subtask-add-input')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const taskItem = e.target.closest('.task-item');
      if (taskItem && e.target.value.trim()) {
        addSubtask(taskItem.dataset.taskId, e.target.value);
      }
    }
    return;
  }

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

  if (e.target.classList.contains('task-item-memo-input')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEditingMemo();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditingMemo();
    }
    return;
  }

  if (e.target.classList.contains('task-item-title')) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const taskItem = e.target.closest('.task-item');
      if (taskItem) startEditingTask(taskItem.dataset.taskId);
    }
  }
});

// FR-11 + 메모: blur
taskListEl.addEventListener('focusout', (e) => {
  if (e.target.classList.contains('task-item-title-input')) {
    setTimeout(() => {
      if (editingTaskId !== null) saveEditingTask();
    }, 100);
    return;
  }
  if (e.target.classList.contains('task-item-memo-input')) {
    setTimeout(() => {
      if (editingMemoTaskId !== null) saveEditingMemo();
    }, 100);
    return;
  }
});

// FR-06: 필터 칩
filterAreaEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-chip')) return;
  const filter = e.target.dataset.filter;
  if (filter) setFilter(filter);
});

// 캘린더 이벤트
calGridEl.addEventListener('click', (e) => {
  const dayEl = e.target.closest('.calendar-day');
  if (!dayEl) return;
  const date = dayEl.dataset.date;
  if (!date) return;

  selectedDate = date;
  const d = new Date(date + 'T00:00:00');
  calendarYear = d.getFullYear();
  calendarMonth = d.getMonth();

  currentFilter = FILTER_ALL;
  renderAll();
});

calPrevBtn.addEventListener('click', () => {
  calendarMonth--;
  if (calendarMonth < 0) {
    calendarMonth = 11;
    calendarYear--;
  }
  renderCalendar();
});

calNextBtn.addEventListener('click', () => {
  calendarMonth++;
  if (calendarMonth > 11) {
    calendarMonth = 0;
    calendarYear++;
  }
  renderCalendar();
});

calMonthLabel.addEventListener('click', () => {
  const today = new Date();
  selectedDate = toDateString(today);
  calendarYear = today.getFullYear();
  calendarMonth = today.getMonth();
  currentFilter = FILTER_ALL;
  renderAll();
});

// 완료율 통계 탭
completionStatsEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('completion-stats-tab')) return;
  const mode = e.target.dataset.mode;
  if (mode && mode !== completionStatsMode) {
    completionStatsMode = mode;
    renderCompletionStats();
  }
});

// 스트릭 목표 변경 → 설정 탭으로 이동
streakCardEl.addEventListener('click', (e) => {
  if (!e.target.classList.contains('streak-card-change-btn')) return;
  switchPage('settings');
});

// 타이머 이벤트
pomodoroSectionEl.addEventListener('click', (e) => {
  if (e.target.id === 'pomo-start') {
    startTimer();
    return;
  }
  if (e.target.id === 'pomo-pause') {
    pauseTimer();
    return;
  }
  if (e.target.id === 'pomo-reset') {
    resetTimer();
    return;
  }
});

pomodoroSectionEl.addEventListener('change', (e) => {
  if (e.target.id === 'pomo-subject') {
    timerState.subject = e.target.value;
  }
  if (e.target.id === 'pomo-focus-min') {
    const val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= 120) {
      timerState.focusMinutes = val;
      if (!timerState.isRunning && !timerState.isBreak) {
        timerState.timeLeft = val * 60;
        const timerEl = document.getElementById('pomo-timer');
        if (timerEl) timerEl.textContent = formatSeconds(timerState.timeLeft);
      }
    }
  }
  if (e.target.id === 'pomo-break-min') {
    const val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= 60) {
      timerState.breakMinutes = val;
      if (!timerState.isRunning && timerState.isBreak) {
        timerState.timeLeft = val * 60;
        const timerEl = document.getElementById('pomo-timer');
        if (timerEl) timerEl.textContent = formatSeconds(timerState.timeLeft);
      }
    }
  }
});

// 시간표 이벤트
timetableAddBtn.addEventListener('click', () => {
  showTimetableForm(null);
});

ttSaveBtn.addEventListener('click', saveTimetableForm);

ttCancelBtn.addEventListener('click', hideTimetableForm);

ttDeleteBtn.addEventListener('click', () => {
  if (!editingBlockId) return;
  const blocks = loadTimetable();
  const block = blocks.find(b => b.id === editingBlockId);
  if (block && window.confirm(`"${block.subject}" 블록을 삭제할까요?`)) {
    deleteTimetableBlock(editingBlockId);
    hideTimetableForm();
  }
});

// 시간표 블록 드래그 앤 드롭 + 클릭
timetableGridWrapper.addEventListener('mousedown', (e) => {
  const blockEl = e.target.closest('.tt-block');
  if (!blockEl) return;
  const blockId = blockEl.dataset.blockId;
  if (!blockId) return;
  e.preventDefault();
  startDrag(blockId, e.clientX, e.clientY);
});

document.addEventListener('mousemove', (e) => {
  if (!dragState.active) return;
  e.preventDefault();
  moveDrag(e.clientX, e.clientY);
});

document.addEventListener('mouseup', (e) => {
  if (!dragState.active) return;
  endDrag(e.clientX, e.clientY);
});

// 터치 지원
timetableGridWrapper.addEventListener('touchstart', (e) => {
  const blockEl = e.target.closest('.tt-block');
  if (!blockEl) return;
  const blockId = blockEl.dataset.blockId;
  if (!blockId) return;
  const touch = e.touches[0];
  startDrag(blockId, touch.clientX, touch.clientY);
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!dragState.active) return;
  if (dragState.moved) e.preventDefault();
  const touch = e.touches[0];
  moveDrag(touch.clientX, touch.clientY);
}, { passive: false });

document.addEventListener('touchend', (e) => {
  if (!dragState.active) return;
  const touch = e.changedTouches[0];
  endDrag(touch.clientX, touch.clientY);
});

// 시간표 폼 Enter
timetableForm.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveTimetableForm();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    hideTimetableForm();
  }
});

// 설정: 목표 저장
document.getElementById('settings-goal-save').addEventListener('click', () => {
  const dailyInput = document.getElementById('settings-goal-input');
  const weeklyInput = document.getElementById('settings-weekly-goal-input');
  const studyInput = document.getElementById('settings-study-minutes-input');

  const daily = parseInt(dailyInput.value, 10);
  const weekly = parseInt(weeklyInput.value, 10);
  const studyMin = parseInt(studyInput.value, 10);

  if (daily >= 1 && weekly >= 1 && studyMin >= 1) {
    saveGoal({ dailyTarget: daily, weeklyTarget: weekly, dailyStudyMinutes: studyMin });
    alert('목표가 저장되었습니다.');
  }
});

// D-day 추가
document.getElementById('dday-add-button').addEventListener('click', () => {
  const titleEl = document.getElementById('dday-title-input');
  const dateEl = document.getElementById('dday-date-input');
  if (!titleEl.value.trim() || !dateEl.value) {
    alert('일정 이름과 날짜를 입력해주세요.');
    return;
  }
  addDday(titleEl.value, dateEl.value);
  titleEl.value = '';
  dateEl.value = '';
  renderDdaySettings();
  if (currentPage === 'settings') renderDdaySection();
});

// D-day 삭제
document.getElementById('dday-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.dday-manage-delete');
  if (!btn) return;
  const id = btn.dataset.ddayId;
  if (id) {
    deleteDday(id);
    renderDdaySettings();
    renderDdaySection();
  }
});

// 설정: 데이터 초기화
document.getElementById('reset-data-button').addEventListener('click', () => {
  const confirmed = window.confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
  if (!confirmed) return;

  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCHEDULE_KEY);
    localStorage.removeItem(TIMETABLE_KEY);
    localStorage.removeItem(GENERATED_KEY);
    localStorage.removeItem(GOAL_KEY);
    localStorage.removeItem(PAGE_KEY);
    localStorage.removeItem(SEEDED_KEY);
    localStorage.removeItem(DDAY_KEY);
    localStorage.removeItem(SESSIONS_KEY);
  } catch (e) { /* ignore */ }

  location.reload();
});

// ─────────────────────────────────────────────
// 초기 실행
// ─────────────────────────────────────────────

tasks = loadTasks();
if (tasks.length === 0) {
  seedSampleData();
}

tasks = loadTasks();
autoGenerateScheduledTasks();
renderTodayDate();

try {
  const savedPage = localStorage.getItem(PAGE_KEY);
  if (savedPage && ['home', 'stats', 'schedule', 'settings'].includes(savedPage)) {
    currentPage = savedPage;
  }
} catch (e) { /* ignore */ }

switchPage(currentPage);

console.log('Study Planner v4.1 (타이머 + 에브리타임 시간표) —', tasks.length, 'tasks loaded');
