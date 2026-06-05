---
name: "source-command-archived-retro"
description: "Engineering Retrospective — Automated Analysis (Orchestrator 5.3)"
---

# source-command-archived-retro

Use this skill when the user asks to run the migrated source command `archived-retro`.

## Command Template

> Legacy workflow. Prefer lightweight reflection in `status`, `review`, or `ship` unless a full retrospective is explicitly requested.

# 📊 Retro (Engineering Retrospective v5.3)

> **gstack 영감**: Git 히스토리 자동 분석 → 정량적 메트릭 → 구조화된 회고.
> `learnings.md` 수동 기록을 넘어, 데이터 기반 엔지니어링 회고를 자동 생성한다.

## Arguments
- `/retro` — 기본: 최근 7일
- `/retro 24h` — 최근 24시간
- `/retro 14d` — 최근 14일
- `/retro 30d` — 최근 30일
- `/retro compare` — 현재 기간 vs 이전 동일 기간 비교

---

## Step 1: 데이터 수집

### 1.1 Git 데이터 (병렬 실행)
```bash
# 1. 커밋 이력 (해시, 작성자, 날짜, 제목, 변경 통계)
git log --since="<window>" --format="%H|%aN|%ae|%ai|%s" --shortstat

# 2. 커밋별 파일 변경 상세 (테스트 vs 프로덕션 분리)
git log --since="<window>" --format="COMMIT:%H|%aN" --numstat

# 3. 커밋 타임스탬프 (세션 감지용)
git log --since="<window>" --format="%at|%aN|%ai|%s" | sort -n

# 4. 핫스팟 분석 (가장 자주 변경된 파일)
git log --since="<window>" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn | head -15

# 5. 작성자별 커밋 수
git shortlog --since="<window>" -sn --no-merges

# 6. 연속 커밋 일수 (스트릭)
git log --format="%ad" --date=format:"%Y-%m-%d" | sort -u
```

### 1.2 프로젝트 데이터
```bash
# task_board 상태
cat .agent/memory/task_board.md 2>/dev/null || true

# learnings 이력
cat .agent/memory/learnings.md 2>/dev/null || true

# 테스트 파일 수
find . -name '*.test.*' -o -name '*.spec.*' | grep -v node_modules | wc -l
```

---

## Step 2: 메트릭 계산

| 메트릭 | 값 |
|--------|---|
| 커밋 수 | N |
| 기여자 수 | N |
| 총 추가 라인 | N |
| 총 삭제 라인 | N |
| 순 LOC 추가 | N |
| 테스트 LOC | N |
| 테스트 비율 | N% |
| 활동일 수 | N |
| 감지된 세션 수 | N |
| 평균 세션 길이 | N분 |
| LOC/세션-시간 | N |
| Fix 비율 | N% (fix 커밋 / 전체 커밋) |

---

## Step 3: 시간 분석

### 3.1 시간대별 히스토그램
```
Hour  Commits  ████████████████
 00:    4      ████
 09:    8      ████████
 14:   12      ████████████
 22:    6      ██████
```

- 피크 시간대 식별
- 심야 코딩 클러스터 (22시 이후) 감지 → 지속 가능성 경고

### 3.2 세션 감지
- **45분 갭** 기준으로 세션 감지
- 분류:
  - **Deep sessions** (50+ min) — 집중 작업
  - **Medium sessions** (20-50 min) — 일반 작업
  - **Micro sessions** (<20 min) — 퀵 수정

---

## Step 4: 커밋 분석

### 4.1 유형별 분류
```
feat:     20  (40%)  ████████████████████
fix:      27  (54%)  ███████████████████████████
refactor:  2  ( 4%)  ██
chore:     1  ( 2%)  █
```

> ⚠️ **Fix 비율이 50%를 초과하면**: "빠르게 만들고 빠르게 고치기" 패턴 경고. 리뷰 프로세스에 갭이 있을 수 있다.

### 4.2 핫스팟 분석
- Top 10 가장 자주 변경된 파일
- 5회 이상 변경된 파일 → **Churn 핫스팟** 표시
- 테스트 파일 vs 프로덕션 파일 비율

---

## Step 5: 스트릭 추적

연속 커밋 일수를 오늘부터 거슬러 올라가며 계산:
```
🔥 개발 스트릭: 14 연속일
```

---

## Step 6: 이전 회고 비교

```bash
ls -t .agent/memory/retros/*.json 2>/dev/null
```

**이전 회고가 있으면**: 가장 최근 것을 로드하여 델타 계산:
```
                    지난번     현재       변화
테스트 비율:          22%   →   41%      ↑19pp
세션 수:              10   →   14       ↑4
LOC/시간:            200   →   350      ↑75%
Fix 비율:            54%   →   30%      ↓24pp (개선중)
```

**이전 회고가 없으면**: "첫 회고 기록 — 다음 주에 다시 실행하면 트렌드를 볼 수 있습니다."

---

## Step 7: 회고 저장

```bash
mkdir -p .agent/memory/retros
```

JSON 스냅샷 저장 (`.agent/memory/retros/YYYY-MM-DD.json`):
```json
{
  "date": "2026-03-20",
  "window": "7d",
  "metrics": {
    "commits": 47,
    "insertions": 3200,
    "deletions": 800,
    "net_loc": 2400,
    "test_ratio": 0.41,
    "active_days": 6,
    "sessions": 14,
    "deep_sessions": 5,
    "avg_session_minutes": 42,
    "loc_per_session_hour": 350,
    "feat_pct": 0.40,
    "fix_pct": 0.30,
    "peak_hour": 22
  },
  "streak_days": 14,
  "hotspots": ["src/services/auth.ts", "src/components/Dashboard.tsx"]
}
```

### 7.2 learnings.md 자동 연동 ⚡ (NEW)

JSON 저장 후, `learnings.md`에 1줄 요약을 자동 추가:
```bash
echo "" >> .agent/memory/learnings.md
echo "## [$(date +%Y-%m-%d)] Retro ${WINDOW}" >> .agent/memory/learnings.md
echo "- 커밋 ${COMMITS}, 테스트 비율 ${TEST_RATIO}%, Fix ${FIX_PCT}%, 스트릭 ${STREAK}일, 핫스팟: ${TOP_HOTSPOT}" >> .agent/memory/learnings.md
```

이렇게 하면 다음 워크플로우 실행 시 `bridge.sh`가 자동으로 최근 회고 데이터를 포함합니다.

---

## Step 8: 내러티브 출력

### 구조:

**1줄 요약** (맨 위):
```
Week of Mar 14: 47 commits, 3.2k LOC, 41% tests, peak: 10pm | 스트릭: 14d
```

### 📈 메트릭 요약 테이블
(Step 2에서 계산)

### 🔄 트렌드 vs 지난 회고
(Step 6에서 계산 — 첫 회고면 생략)

### ⏰ 시간 & 세션 패턴
- 피크 시간대와 그 의미
- 세션이 길어지고 있는지, 짧아지고 있는지
- 일일 활성 코딩 추정 시간

### 🚀 배포 속도
- 커밋 유형 믹스와 의미
- Fix 체인 감지 (같은 파일에 fix 커밋 연속)
- 핫스팟 분석

### ✅ 코드 품질 시그널
- 테스트 LOC 비율 트렌드
- 핫스팟 (같은 파일이 계속 변경되는가?)

### 🎯 Top 3 주간 성과
이번 기간의 가장 영향력 있는 3가지 작업.

### ⬆️ 3가지 개선 포인트
구체적, 행동 가능, 실제 커밋에 근거. "더 나아지려면..."

### 🏃 다음 주 3가지 습관
작고, 실용적이며, 현실적인 것. 각각 5분 이내로 채택 가능.

---

## Compare 모드

`/retro compare` 실행 시:
1. 현재 기간 메트릭 계산
2. 바로 이전 동일 기간 메트릭 계산
3. 나란히 비교 테이블 출력
4. 가장 큰 개선점과 후퇴점 내러티브

---

## 톤

- 격려적이되 솔직하게, 감싸주지 않기
- 구체적이고 실제 커밋에 근거
- 개선점은 비판이 아닌 "레벨업"으로 프레이밍
- 총 출력 2000-3000 단어
- 데이터는 마크다운 테이블/코드 블록, 해석은 산문으로

---

> [!IMPORTANT]
> **모든 내러티브 출력은 대화에 직접 출력.** 파일로 쓰지 않는다 (JSON 스냅샷만 예외).
> 커밋 0건이면: "이 기간에 커밋이 없습니다. 다른 기간을 시도하세요."
> Legacy workflow. Prefer lightweight reflection in `status`, `review`, or `ship` unless a full retrospective is explicitly requested.
