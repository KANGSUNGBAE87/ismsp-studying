# 2026-06-19 Claude Subagent Budget Cap

Actor: codex

## User Request

서브에이전트 호출 시 Claude CLI가 막힌 원인을 분석했고, 원인이 Claude CLI 자체 불능이 아니라 비대화형 호출에 붙은 너무 낮은 `--max-budget-usd 0.05` cap이라고 판단했다. 사용자는 해당 budget cap을 제거하는 방향으로 정리하라고 요청했다.

## Decisions

- Claude-routed subagent health check와 실제 Claude subagent 호출에는 `--max-budget-usd`를 붙이지 않는다.
- 낮은 USD cap으로 실패한 호출은 Claude unavailable로 보지 않는다.
- Claude는 uncapped `claude -p 'Reply with exactly: CLAUDE_AUTH_OK' --print` health check 또는 실제 uncapped subagent call이 실패할 때만 unavailable/degraded로 처리한다.
- Codex sandbox 내부에서는 네트워크 제한 때문에 `claude -p`가 `Not logged in`처럼 보일 수 있으므로, 실제 health check는 네트워크 가능한 실행 환경에서 검증한다.

## Files Changed

- `AGENTS.md`
  - Claude health check 및 Claude-routed subagent call에 `--max-budget-usd`를 붙이지 말라는 규칙을 추가했다.
- `CLAUDE.md`
  - Codex와 같은 규칙을 Claude-facing instructions에도 반영했다.
- `/Users/kangsungbae/.codex/agent-routing/subagent-backends.toml`
  - 전역 external backend routing의 `auth_check_rule`에 uncapped Claude health check 원칙을 추가했다.
  - `claude_health_check = "claude -p 'Reply with exactly: CLAUDE_AUTH_OK' --print"`를 추가했다.

## Verification

- `claude auth status`: logged in, first-party `claude.ai`, Pro account.
- `claude -p 'Reply with exactly: CLAUDE_AUTH_OK' --print --max-budget-usd 0.05`: failed with `Exceeded USD budget (0.05)`.
- `claude -p 'Reply with exactly: CLAUDE_AUTH_OK' --print` inside Codex sandbox: failed with `Not logged in` because the sandbox has `CODEX_SANDBOX_NETWORK_DISABLED=1`.
- `claude -p 'Reply with exactly: CLAUDE_AUTH_OK' --print` outside the sandbox: returned `CLAUDE_AUTH_OK`.
- `git diff --check -- AGENTS.md CLAUDE.md`: passed.

## Remaining Risks

- If an external wrapper outside these instruction files still hardcodes `--max-budget-usd 0.05`, it must be updated separately.
- Full Claude subagent prompts can still fail for real quota, timeout, auth, or service reasons; those should be reported as degraded mode and routed through Antigravity/Codex fallback.

## Knowledge Promotion

Candidate for global operational memory: Claude CLI health checks for subagent routing should be uncapped; low USD caps cause false unavailable results.
