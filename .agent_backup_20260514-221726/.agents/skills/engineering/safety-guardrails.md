---
name: safety-guardrails
description: Destructive command detection, scope freezing, and investigation-first debugging. Inspired by gstack's /careful, /freeze, /guard patterns.
---

# 🛡️ Safety Guardrails — Destructive Command Prevention

> **Purpose**: AI 에이전트가 파괴적 명령어를 실행하거나, 디버깅 중 관련 없는 파일을 수정하는 것을 방지한다.
> **v5.3 NEW**: gstack의 `/careful`, `/freeze`, `/guard` 패턴을 Orchestrator에 통합.

---

## 1. Careful Mode (파괴적 명령어 감지)

### 위험 명령어 패턴

| 위험도 | 패턴 | 설명 |
|:------:|:-----|:-----|
| 🔴 Critical | `rm -rf`, `rm -r` | 재귀적 파일 삭제 |
| 🔴 Critical | `DROP TABLE`, `DROP DATABASE`, `TRUNCATE` | DB 데이터 영구 삭제 |
| 🔴 Critical | `git reset --hard` | 커밋되지 않은 변경 영구 손실 |
| 🔴 Critical | `git push --force`, `git push -f` | 원격 히스토리 덮어쓰기 |
| 🟡 High | `chmod 777`, `chmod -R` | 보안 위험한 권한 변경 |
| 🟡 High | `git clean -fd` | 추적되지 않는 파일 삭제 |
| 🟡 High | `DELETE FROM` (WHERE 절 없음) | 전체 테이블 데이터 삭제 |
| 🟡 High | `npx prisma migrate reset` | DB 완전 초기화 |
| 🟢 Medium | `git rebase -i` | 히스토리 재작성 (주의 필요) |
| 🟢 Medium | `.env` 파일 수정 | 환경 변수 변경 |

### 감지 시 행동

```
⚠️ CAREFUL MODE 경고
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
감지된 명령어: [command]
위험도: [CRITICAL / HIGH / MEDIUM]
영향: [설명]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ CRITICAL: 실행 전 반드시 사용자 승인 필요 (notify_user)
→ HIGH: 경고 후 대안 제시. 사용자 확인 권장.
→ MEDIUM: 경고 로그 남기고 계속 진행 가능.
```

---

## 2. Freeze Mode (디렉토리 잠금)

> 디버깅이나 특정 작업 중 관련 없는 파일 수정을 차단한다.

### 활성화

```bash
# 특정 디렉토리만 수정 허용
echo "src/services/" > .agent/memory/freeze-scope.txt

# 여러 디렉토리 허용
echo "src/services/" > .agent/memory/freeze-scope.txt
echo "src/lib/" >> .agent/memory/freeze-scope.txt
```

### 검증 프로토콜

파일 수정 전 자기 검증:

1. `.agent/memory/freeze-scope.txt` 존재 여부 확인
2. 존재하면 → 수정 대상 파일이 허용 디렉토리 안에 있는지 확인
3. **허용 범위 안** → 수정 진행
4. **범위 밖** → 경고:
   ```
   🧊 FREEZE 위반: [파일 경로]
   현재 잠금 범위: [freeze-scope.txt 내용]
   이 파일은 현재 수정이 제한됩니다.
   → 범위 확장이 필요하면 사용자에게 요청하세요.
   ```

### 해제

```bash
rm -f .agent/memory/freeze-scope.txt
```

---

## 3. Guard Mode (Careful + Freeze 동시 활성)

> 프로덕션 배포 직전이나 민감한 작업 시 최대 안전 수준.

### Guard 활성화 조건

- `/ship` 워크플로우 실행 중
- 프로덕션 DB 마이그레이션 수행 시
- 사용자가 명시적으로 `/guard` 요청 시

### Guard 모드 행동

1. **Careful Mode 활성화**: 모든 위험 명령어 감지
2. **Freeze Mode 활성화**: 명시된 범위 외 수정 차단
3. **추가 제한**:
   - 새 패키지 설치 금지 (사용자 승인 필요)
   - 설정 파일(`.env`, `next.config.*`, `tsconfig.*`) 수정 시 경고
   - `package.json` 의존성 변경 시 사용자 확인 필수

---

## 4. Investigation Lock (조사 모드)

> gstack `/investigate` 패턴: 원인 파악 전 코드 수정 금지.

### 활성화

`/fix` 워크플로우 Step 1 진입 시 자동 활성화.

### 규칙

- 코드 **읽기**: ✅ 허용
- 로그/어설션 **추가**: ✅ 허용 (진단 목적)
- 코드 **수정**: ❌ 금지 (근본 원인 가설 검증 전까지)
- 코드 **삭제**: ❌ 금지

### 해제 조건

- 근본 원인 가설이 문서화되고 증거로 뒷받침될 때
- `agent_debate.md`에 "Root cause hypothesis: [...]" 기록 후 해제

---

## Quick Reference

```
/careful → 파괴적 명령어 사전 경고 (항상 활성 권장)
/freeze  → 특정 디렉토리 외 수정 차단 (디버깅 시)
/guard   → careful + freeze + 추가 제한 (프로덕션 작업 시)
/investigate → 원인 파악 전 코드 수정 금지 (/fix 자동)
```
