---
name: "source-command-archived-stitch"
description: "Stitch Web Page Factory (Legacy workflow)"
---

# source-command-archived-stitch

Use this skill when the user asks to run the migrated source command `archived-stitch`.

## Command Template

# 🧵 Stitch (Web Page Factory v6.0)

> [!WARNING]
> Legacy workflow. Use only for intentional design-to-code experiments. Default product work should use `/plan` and `/develop`.

Prompt → Design → Code → Video. **완전 자동화 웹 페이지 생성 공장.**

## 0. [AGENT] Orchestrator: Intelligence Setup
- [ ] **Model Router**: Stitch Factory is `[HEAVY]` → Recommend Pro/Sonnet.
- [ ] **Learnings Preload**: If `.agent/memory/learnings.md` exists → read it.
- [ ] **Environment Scan**: Run `bash .agent/scripts/audit-status.sh`.
- [ ] **Skill Discovery**: Load Stitch skills:
    - `enhance-prompt`, `stitch-ui-design`, `ui-ux-pro-max`
    - `design-md`, `stitch-loop`, `react-components`
    - `shadcn-ui`, `remotion`
- [ ] **Board Init**: Update `.agent/memory/task_board.md`.

## 1. [AGENT] Prompt Architect: 프롬프트 설계
- [ ] **Input**: 유저의 요구사항(한줄 아이디어도 OK).
- [ ] **Enhance**: 모호한 아이디어를 Stitch 전문 프롬프트로 확장.
    - Screen Type, Key Features, Visual Style, Platform 명시.

> [!TIP]
> 유저가 **"깔끔한 SaaS 랜딩"**이라고만 해도, **"Minimalist SaaS landing with hero, pricing table, testimonials..."**로 확장됩니다.

## 2. [AGENT] Designer: Stitch 화면 생성
- [ ] **Generate**: `mcp_stitch_generate_screen_from_text` 도구로 화면 생성.
- [ ] **Multi-Screen**: `stitch-loop` 패턴으로 멀티 페이지 자동 생성.
- [ ] **Variants**: `mcp_stitch_generate_variants` 도구로 3개 변형 생성 후 최적 디자인 선택.
- [ ] **Iterate**: `mcp_stitch_edit_screens` 도구로 유저 피드백 기반 편집/재생성.

## 3. [AGENT] Documentor: 디자인 문서화
- [ ] **DESIGN.md**: 생성된 화면에서 디자인 시스템 추출.
    - 색상 토큰, 타이포그래피, 간격, 컴포넌트 패턴 문서화.
- [ ] **Output**: `docs/DESIGN.md` 생성.

## 4. [AGENT] Engineer: 코드 변환
- [ ] **React**: Stitch 화면 → React 컴포넌트 자동 변환.
- [ ] **shadcn/ui**: UI 라이브러리 통합.
- [ ] **Validate**: `npm run build` 빌드 확인.
- [ ] **Output**: `/src/components/` 에 프로덕션 레디 코드 생성.

## 5. [AGENT] Critic Gate — Build & Design Quality ♻️
- [ ] **Evaluate**: 빌드 성공? 디자인이 원본 프롬프트와 일치?
- [ ] **PASS** → Proceed.
- [ ] **FAIL** → 코드 수정 후 재빌드. Max 2 retries.

## 6. [AGENT] Producer: 홍보 영상 (Optional)
- [ ] **Remotion**: 화면들을 엮어 홍보 영상 렌더링.
- [ ] **Output**: `output/walkthrough.mp4` 생성.

## 7. [AGENT] Workflow Transition
- [ ] **Present**: Use `notify_user` with `BlockedOnUser: true` and `PathsToReview`:
    - 📄 `docs/DESIGN.md`
    - ⚛️ `/src/components/`
    - 🎬 `output/walkthrough.mp4` (optional)
- [ ] **Next**: 프로젝트 통합 필요 시 → `/develop`.

---
> [!IMPORTANT]
> **이 워크플로우의 핵심**: 유저는 **아이디어 한 줄**만 주면 됩니다.

## [AGENT] Secretary: Daily Log
- [ ] **Log**: Run `bash .agent/scripts/logger.sh ".agent/memory/daily/$(date +%Y-%m-%d).md" "STITCH" "[Summary]"`
