# claude-pilot

GitHub 이슈 기반 Claude Code 자동화 시스템

GitHub 이슈에 트리거 댓글을 달면, Claude Code CLI가 코드베이스를 분석하고 구현 계획을 세운 뒤, 승인 시 코드를 작성하고 PR을 생성합니다.

## 동작 흐름

```
이슈에 @claude 댓글
       ↓
  계획 생성 (sonnet)          ← 코드베이스를 읽기 전용으로 분석
       ↓
  이슈에 계획 댓글 게시
       ↓
  /approve 또는 /reject
       ↓
  코드 실행 (opus)            ← 브랜치 생성 → 코드 구현 → 커밋/푸시
       ↓
  PR 자동 생성
```

### 트리거 키워드

| 키워드 | 동작 |
|--------|------|
| `@claude` | 새 태스크 시작 — 이슈 분석 후 구현 계획 생성 |
| `/approve` | 계획 승인 — 코드 구현 실행 |
| `/reject [피드백]` | 계획 거절 — 피드백 반영하여 재계획 |
| `/abort` | 태스크 중단 |

### 태스크 상태 머신

```
IDLE → PLANNING → PLAN_PENDING → EXECUTING → PR_CREATED → COMPLETED
                       ↓
                    REJECTED → PLANNING (재계획)
```

## 사용 모델

Claude Code CLI의 `--model` 플래그를 통해 단계별로 다른 모델을 사용합니다.

| 단계 | 모델 | 허용 도구 | 타임아웃 | 설명 |
|------|------|-----------|---------|------|
| 계획 생성 | `sonnet` | Read, Glob, Grep, WebFetch, WebSearch | 10분 | 코드베이스를 읽기 전용으로 분석하여 구현 계획 수립 |
| 코드 실행 | `opus` | 전체 (파일 수정 포함) | 30분 | 실제 코드 구현, 커밋, 푸시까지 수행 |
| PR 리뷰 반영 | `sonnet` | (미구현) | - | Phase 2 예정 |

- **sonnet** — 빠른 분석과 계획 수립에 적합. 읽기 전용 도구만 허용하여 안전하게 코드베이스를 탐색합니다.
- **opus** — 복잡한 코드 구현에 적합. `--dangerously-skip-permissions` 플래그로 파일 시스템 전체 접근이 가능합니다.

모델명은 Claude Code CLI가 내부적으로 최신 버전으로 해석합니다 (예: `sonnet` → `claude-sonnet-4-6`).

## 프로젝트 구조

```
├── config.yaml                # 메인 설정 파일
├── scripts/setup.sh           # 초기 셋업 스크립트
├── data/                      # SQLite DB 저장 (gitignore)
└── src/
    ├── index.ts               # 진입점 — 메인 폴링 루프
    ├── config.ts              # config.yaml 파싱
    ├── types/                 # 타입 정의
    │   ├── config.ts          #   설정 타입
    │   ├── events.ts          #   이벤트 타입
    │   └── state.ts           #   태스크 상태 타입
    ├── poller/                # GitHub 이슈 댓글 폴링
    │   ├── poller.ts          #   폴링 루프
    │   ├── github-client.ts   #   GitHub CLI (gh) 래퍼
    │   └── event-parser.ts    #   댓글 → 이벤트 파싱
    ├── router/
    │   └── event-router.ts    # 이벤트별 핸들러 라우팅
    ├── claude/
    │   └── cli-runner.ts      # Claude Code CLI 실행 래퍼
    ├── git/
    │   └── git-operations.ts  # git 브랜치/커밋/푸시
    ├── handlers/              # 이벤트 핸들러
    │   ├── plan-generator.ts  #   계획 생성
    │   ├── code-executor.ts   #   코드 구현 + PR 생성
    │   └── pr-reviewer.ts     #   PR 리뷰 반영 (Phase 2)
    └── state/                 # 상태 관리 (SQLite)
        ├── database.ts        #   DB 초기화
        ├── task-repository.ts #   태스크 CRUD
        └── poll-state-repository.ts  # 폴링 시점 저장
```

## 설치

### 사전 요구사항

- [Node.js](https://nodejs.org/)
- [GitHub CLI (gh)](https://cli.github.com/) — `gh auth login`으로 인증 완료
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`

### 셋업

```bash
./scripts/setup.sh
```

또는 수동으로:

```bash
npm install
mkdir -p data
```

## 설정

`config.yaml`을 편집하여 대상 저장소와 옵션을 설정합니다.

```yaml
polling:
  interval_seconds: 30          # 폴링 간격 (초)

triggers:
  mention: "@claude"
  approve: "/approve"
  reject: "/reject"
  abort: "/abort"

repos:
  - name: "owner/repo"           # GitHub 저장소 (owner/repo)
    local_path: "/path/to/repo"  # 로컬 클론 경로
    base_branch: "main"          # 베이스 브랜치
    allowed_authors:              # 트리거 허용 사용자
      - "github-username"

claude:
  plan_model: "sonnet"           # 계획 생성 모델
  execute_model: "opus"          # 코드 실행 모델
  review_model: "sonnet"         # 리뷰 모델 (Phase 2)
```

## 실행

```bash
# 프로덕션
npm start

# 개발 (파일 변경 감지 자동 재시작)
npm run dev
```

## 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | Node.js + TypeScript |
| AI | Claude Code CLI (sonnet / opus) |
| GitHub 연동 | GitHub CLI (gh) |
| 상태 저장 | SQLite (better-sqlite3) |
| 설정 | YAML |
