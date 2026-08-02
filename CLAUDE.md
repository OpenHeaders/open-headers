# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install                          # Install dependencies (requires pnpm 10+, Node 22+)
pnpm turbo test                       # Run all tests (~14000 across all packages)
pnpm turbo typecheck                  # Typecheck all packages
pnpm turbo build                      # Build everything
pnpm biome check .                    # Lint + format check
pnpm lint:fix                         # Auto-fix lint + format

# Per-package
pnpm --filter @openheaders/desktop test          # Desktop tests only
pnpm --filter @openheaders/extension test         # Extension tests only
pnpm --filter @openheaders/core test              # Core tests only
pnpm --filter @openheaders/desktop dev            # Desktop dev with hot-reload
pnpm --filter @openheaders/extension dev          # Extension dev (Chrome watch)

# Single test file
pnpm --filter @openheaders/desktop exec vitest run path/to/test.test.ts
pnpm --filter @openheaders/extension exec vitest run path/to/test.test.ts

# E2E (requires build first)
pnpm --filter @openheaders/desktop test:e2e
pnpm --filter @openheaders/extension test:e2e

# Typecheck desktop (has two tsconfigs)
pnpm --filter @openheaders/desktop typecheck      # runs: tsc --noEmit && tsc -p src/renderer/tsconfig.json --noEmit
```

## Architecture

**Monorepo** (pnpm workspaces + Turborepo) with three packages:

- `packages/core/` (`@openheaders/core`) — Domain model: types, protocol, utils, valibot schemas. Zero platform deps. Both apps import via subpath exports (`@openheaders/core/types`, `@openheaders/core/protocol`, etc.)
- `apps/desktop/` (`@openheaders/desktop`) — Electron app. electron-vite builds three targets: main, preload, renderer.
- `apps/extension/` (`@openheaders/extension`) — Browser extension (Chrome/Firefox/Edge/Safari). Vite build with `BROWSER` env var selecting target.

Dependency flow: `core ← desktop`, `core ← extension`. Desktop and extension never depend on each other.

### Desktop: Main vs Renderer Process

The app runs 99.99% in the background (system tray). All critical work runs in the **main process**, not the renderer:

- **Main process** (`src/main.ts`, `src/main/modules/`, `src/services/`): WebSocket server (port 8137), HTTP proxy, source refresh, workspace/git sync, video capture, CLI API, network monitoring
- **Renderer** (`src/renderer/`): React 19 + Ant Design UI. Communicates with main via IPC through a preload bridge (`src/preload.ts` with `contextBridge`)
- **Services** (`src/services/core/`): App state machine and service registry pattern

### Extension: Background + Popup

- **Background service worker** (`src/background/`): `declarativeNetRequest` rules, WebSocket client to desktop app, request tracking, badge state
- **Popup** (`src/popup/`): React 18 + Ant Design UI (800x600)
- Rule updates go through `scheduleUpdate(reason, options)` — debounced (150ms) and deduplicated by hash

### Communication

Desktop runs a WebSocket server on `127.0.0.1:8137`. Extension connects as a client. Protocol messages and constants defined in `@openheaders/core/protocol`.

## Code Style

Enforced by **Biome** (not ESLint/Prettier):
- 2-space indent, single quotes, trailing commas, semicolons
- 120 char line width
- No `any` types — use proper specific types
- `isolatedModules` enabled — use explicit `export type`

## Testing

- **vitest** for unit/integration tests (NOT jest)
- **Playwright** for E2E
- Tests mirror `src/` structure under `tests/unit/`
- Factory functions (`makeSource()`, `makeWorkspace()`) with `Partial<T>` overrides
- Chrome API mock: `tests/__mocks__/chrome.ts` (extension)
- Electron mock: `tests/__mocks__/electron.ts` (desktop)
- Use `openheaders.io` domain (and variants) in test data, not made-up domains

## Versioning

Desktop and extension have **independent versions**. Desktop version comes from git tag on release; extension version from `apps/extension/package.json`.

Apps and packages use **CalVer** (`YYYY.M.PATCH`); protocol is a separate integer in `packages/core/src/protocol/version.ts`. The full versioning model — five axes, public/private boundary, eventual package landscape — is documented in [`docs/architecture-roadmap.md`](./docs/architecture-roadmap.md). Per-release ledger: [`docs/compatibility.md`](./docs/compatibility.md). In-flight refactor progress: [`docs/refactor-status.md`](./docs/refactor-status.md).
