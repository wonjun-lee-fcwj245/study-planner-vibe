# 데이터 모델 설계 (Data Model)

> **버전**: 0.1
> **작성일**: 2026-05-24
> **참조 문서**: SRS 0.3, ADR-001 (localStorage 채택), 03-wireframes 0.1

## 1. 문서 목적

본 문서는 학습 플래너가 다루는 모든 데이터의 구조와 저장 전략을 정의한다.
와이어프레임에서 화면을 설계했다면, 본 문서는 그 화면 뒤에 흐르는 데이터를 설계한다.

데이터 모델은 다음 두 가지 요구를 동시에 만족해야 한다.
- **이터레이션 1 요구** (메인 보드): 학습 항목의 CRUD와 영속성
- **이터레이션 2 요구** (통계 화면): 7일간 일별 집계, 과목별 완료율

후자를 지금 고려해두지 않으면, 이터레이션 2 진입 시 큰 리팩토링이 필요해진다.
이는 와이어프레임에서 통계 화면을 미리 설계한 이유와 같은 맥락이다.

## 2. 핵심 엔티티

본 버전의 데이터는 **단일 엔티티 Task** 만으로 충분하다.

자동 분배 기능을 거절한(Day 5, FWC-001) 결과, 다음 엔티티들이 데이터 모델에서 제외됐다.
- `Schedule` (고정 일정)
- `TimeBlock` (시간 블록)
- `Allocation` (분배 결과)

이로 인해 데이터 모델이 단일 엔티티 + 단일 컬렉션으로 단순화됐다.
**Day 5의 거절 결정이 Day 6의 작업량을 약 1/3로 줄였다는 점이 측정 가능한 효과다.**

## 3. Task 객체 구조

### 3.1 필드 정의

```javascript
{
  id:           string,    // 고유 식별자, crypto.randomUUID() 또는 timestamp+random
  title:        string,    // 학습 항목 제목 (예: "Quartz Scheduler 학습")
  subject:      string,    // 과목명 (예: "AI Agent"), 빈 값이면 "(미분류)"
  completed:    boolean,   // 완료 여부 (기본값 false)
  createdAt:    string,    // ISO 8601 형식 생성 시각 (예: "2026-05-24T09:14:23.000Z")
  completedAt:  string|null // 완료 시각 (미완료면 null)
}
```

### 3.2 각 필드의 도출 근거

| 필드 | 도출 근거 | 관련 FR/UC |
|------|----------|-----------|
| `id` | 삭제·완료 토글 시 식별 필요 | FR-02, FR-03 |
| `title` | 사용자 입력의 핵심 | FR-01, UC-01 |
| `subject` | 과목 분류 및 통계 | FR-05, FR-06, FR-10 |
| `completed` | 완료 상태 토글 | FR-02, UC-03 |
| `createdAt` | 일별 집계의 키 | FR-09 (일별 차트), UC-05 |
| `completedAt` | 완료율 통계의 분자 | FR-08, FR-10 |

### 3.3 의도적으로 포함하지 않은 필드

| 미포함 필드 | 사유 |
|-----------|------|
| `priority` | FR에 우선순위 개념 없음 (분배 기능과 함께 Won't) |
| `dueDate` | 본 버전은 "오늘"과 "이번 주" 만 다룸. 마감일 개념 없음 |
| `estimatedMinutes` | 자동 분배(FWC-001) 거절로 불필요 |
| `description` / `notes` | "단순함" 가치 위배. 제목 한 줄로 충분 |
| `tags` (복수 태그) | `subject` 단일 필드로 충분. 다중 분류는 v2.0 후보 |
| `recurring` (반복) | 본 버전은 1회성 항목만. 반복은 v2.0 후보 |

이 미포함 결정들도 Day 5에서 학습한 **"의도적으로 배제한 항목 명시"** 원칙을 따른다.

### 3.4 예시 데이터

```javascript
{
  id: "task_1748073263000_a7f3",
  title: "Quartz Scheduler 학습 — 기본 트리거 동작 정리",
  subject: "AI Agent",
  completed: false,
  createdAt: "2026-05-24T09:14:23.000Z",
  completedAt: null
}

{
  id: "task_1748073380000_b2c1",
  title: "유스케이스 5건 작성",
  subject: "소프트웨어공학",
  completed: true,
  createdAt: "2026-05-19T10:00:00.000Z",
  completedAt: "2026-05-19T10:45:00.000Z"
}
```

## 4. localStorage 저장 전략

localStorage는 문자열만 저장 가능하므로, 모든 객체는 `JSON.stringify` / `JSON.parse` 로 직렬화한다.

### 4.1 검토한 키 전략

#### 전략 A: 단일 키 + 전체 배열 (Single Key)
```javascript
localStorage.setItem('tasks', JSON.stringify([task1, task2, task3, ...]));
```

**장점**:
- 구현이 가장 단순
- 읽기·쓰기 코드가 일관됨
- 전체 데이터 한 번에 직렬화/역직렬화

**단점**:
- 항목 하나 수정해도 전체 배열 재직렬화
- 데이터 규모 커지면 비효율 (수천 건 이상에서 체감)

#### 전략 B: 항목별 키 (Per-item Key)
```javascript
localStorage.setItem(`task:${id}`, JSON.stringify(task));
```

**장점**:
- 개별 항목 갱신이 효율적
- 부분 손실 시 다른 항목 보호

**단점**:
- 전체 목록을 얻으려면 모든 키를 스캔해야 함 (`Object.keys(localStorage).filter(...)`)
- 키 관리가 복잡함

#### 전략 C: 날짜별 키 (Date-bucketed)
```javascript
localStorage.setItem(`tasks:2026-05-24`, JSON.stringify([...]));
```

**장점**:
- 일별 통계 집계에 유리 (해당 날짜 키만 읽으면 됨)

**단점**:
- 항목이 어느 날짜 버킷에 있는지 ID만으로는 알 수 없음
- 날짜를 가로지르는 작업(과목별 필터 등)이 복잡함

### 4.2 채택 결정: 전략 A (단일 키)

**채택**: `localStorage.setItem('study-planner:tasks', JSON.stringify(tasksArray))`

**근거**:
1. **YAGNI 원칙**: 본 버전은 단일 사용자, 예상 항목 수 수백 건. 전략 A의 단점이 발현되지 않는다.
2. **ADR-002의 단순성 원칙**: 가장 단순한 도구가 가장 좋은 도구.
3. **통계 집계 효율성**: 전체 배열을 한 번 읽어 `filter().reduce()` 로 집계하는 것이 7일 분량
   기준 1ms 미만이다. 전략 C의 이점이 실제로는 필요 없다.
4. **본인 이해 가능성 (MNFR-02)**: 단일 키 전략은 본인이 100% 이해할 수 있는 코드를 만든다.

**키 네이밍**: `study-planner:tasks` (앱 prefix를 붙여 다른 localStorage와 충돌 방지)

### 4.3 키 네임스페이스 예약

향후를 위해 다음 prefix를 본 앱이 사용한다.

| 키 패턴 | 용도 | 사용 시점 |
|--------|------|----------|
| `study-planner:tasks` | 학습 항목 배열 (현재 유일 사용) | 이터레이션 1 |
| `study-planner:settings` | 사용자 설정 (예약) | 미사용 (v2.0 후보) |
| `study-planner:version` | 스키마 버전 (예약) | 미사용 (마이그레이션 필요 시) |

## 5. 통계 집계 알고리즘

이터레이션 2(FR-08, 09, 10)를 위한 집계 로직을 미리 정의한다.
실제 구현은 Day 12~ 에 진행한다.

### 5.1 오늘의 진도율 (FR-08)

```
todayTasks = tasks.filter(t => isSameDay(t.createdAt, today))
progressRate = (todayTasks.filter(t => t.completed).length / todayTasks.length) * 100
```

엣지 케이스: `todayTasks.length === 0` 이면 진도율은 0% (또는 "오늘 학습 없음" 표시).

### 5.2 7일간 일별 완료 항목 수 (FR-09)

```
for each of past 7 days:
  dayTasks = tasks.filter(t => isSameDay(t.completedAt, day))
  result[day] = dayTasks.length
```

집계 기준은 `completedAt` 이지 `createdAt` 이 아니다.
"언제 완료했는가"가 진도 측정의 의미 있는 시점이다.

### 5.3 과목별 완료율 (FR-10)

```
groupedBySubject = groupBy(tasks, 'subject')
for each subject:
  total = groupedBySubject[subject].length
  completed = groupedBySubject[subject].filter(t => t.completed).length
  rate = (completed / total) * 100
```

## 6. 데이터 흐름

```
[사용자 입력]
     ↓
[Task 객체 생성] (id, createdAt 자동 부여)
     ↓
[메모리 내 tasks 배열에 push]
     ↓
[localStorage 직렬화 저장]
     ↓
[UI 재렌더링]
```

상태 토글/삭제도 동일한 패턴: 메모리 → 저장 → 재렌더링.

**중요**: 본 버전은 메모리 내 상태와 localStorage가 항상 동기화된다.
페이지가 열려있는 동안 localStorage를 다른 탭에서 변경하는 시나리오는 다루지 않는다 (단일 탭 가정).

## 7. 데이터 무결성

### 7.1 가능한 손상 시나리오와 대응

| 시나리오 | 대응 |
|---------|------|
| localStorage가 비어있음 (첫 사용) | 빈 배열 `[]` 로 초기화 |
| localStorage에 잘못된 JSON | try-catch로 잡고 빈 배열로 초기화 + 콘솔 경고 |
| 필수 필드 누락된 객체 | 로딩 시 검증하여 무시 또는 기본값 보정 |
| localStorage 용량 초과 | 본 버전에서 도달 불가능 — 무시 |

### 7.2 마이그레이션

향후 스키마 변경 시를 위해 마이그레이션 패턴을 예약해둔다 (지금 구현 X, 설계만).

```javascript
// 향후 구현 예시 (현재는 미구현)
const SCHEMA_VERSION = 1;
function migrate(rawData, fromVersion, toVersion) { ... }
```

## 8. 데이터 모델과 와이어프레임의 매핑

각 UI 요소가 어떤 필드를 표시하는지 명시한다.

### 메인 보드

| UI 요소 | 사용 필드 |
|--------|----------|
| 항목 제목 | `title` |
| 항목 과목 메타 | `subject` |
| 항목 시각 메타 | `createdAt` (포맷: "HH:mm") |
| 완료 체크박스 | `completed` |
| 완료 항목의 "완료 HH:mm" | `completedAt` |
| 헤더 진도 카드 | `tasks.filter(완료).length / tasks.length` |
| 필터 칩 | `Set(tasks.map(t => t.subject))` 으로 동적 생성 |

### 통계 화면

| UI 요소 | 집계 알고리즘 |
|--------|-------------|
| 요약 카드 (전체/완료/평균) | 5.1 + 단순 카운트 |
| 일별 차트 | 5.2 알고리즘 결과 |
| 과목별 바 | 5.3 알고리즘 결과 |


