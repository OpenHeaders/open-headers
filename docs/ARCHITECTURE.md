# Open Headers — Architecture Overview

A high-level map of the system for contributors. The full technical
reference (build targets, test architecture, CI) is in
[DEVELOPER.md](DEVELOPER.md).

## The system at a glance

Open Headers is a browser development toolkit built as a pnpm + Turborepo
monorepo. Six apps ship from it, all built on a set of shared workspace
packages:

| App | What it is |
| --- | --- |
| `apps/extension` | Browser extension (Chrome, Firefox, Edge, Safari) — request/response rules, DevTools panel, popup workbench |
| `apps/desktop` | Electron companion app — runs in the system tray, hosts dynamic sources, workspace sync, and capture tooling |
| `apps/daemon` | Standalone headless server — the multi-user deployment of the same back-end spine the desktop app embeds |
| `apps/web` | The Workbench in a browser tab, served by a daemon |
| `apps/cli` | `oh` — command line client of the daemon's API surface |
| `apps/nm-host` | Native-messaging bootstrap host — token handoff between browser and local app, never bulk transport |

`native/h3-helper` is a small native helper the daemon uses for HTTP/3
requests.

## Shared packages

| Package | Responsibility |
| --- | --- |
| `packages/core` | The domain model: types, valibot schemas, wire protocol, shared utilities. Zero platform dependencies; everything imports it via subpath exports (`@openheaders/core/types`, `…/protocol`, …). |
| `packages/rule-engine` | Compiles user rules into `declarativeNetRequest` rules, generated content scripts, and scripting injections. |
| `packages/oracle` | Entity-agnostic sync engine: workspace state, batching, conflict resolution. Platform-neutral. |
| `packages/oracle-host-node` | Node host adapter for oracle — SQLite persistence, WebSocket server (used by desktop and daemon). |
| `packages/oracle-host-browser` | Browser host adapter for oracle — IndexedDB persistence, platform-native transports (used by the extension and web app). |
| `packages/ui` | Shared React UI: the workbench, the DevTools panel, popup primitives, design-system components. |
| `packages/i18n` | Locale registry, message catalogs, and the translation runtime. |

Dependency direction is strictly `packages ← apps`. Desktop and
extension never depend on each other; they interoperate only over the
wire protocol.

## How the pieces talk

- The desktop app (or a daemon) runs a **WebSocket server on
  `127.0.0.1:8137`**. The extension connects as a client. Every message
  shape and constant lives in `@openheaders/core/protocol`, and the
  exact payloads of every network call the software can make are
  documented in [WIRE_TRANSPARENCY.md](WIRE_TRANSPARENCY.md).
- The protocol carries its own integer version
  (`packages/core/src/protocol/version.ts`), independent of app
  versions, so mixed-version app pairs can negotiate compatibility.
- Workspace data replicates through the oracle sync engine: each app
  embeds oracle with its platform host adapter, and changes flow as
  batches with hybrid-logical-clock ordering and deterministic conflict
  resolution.

## Extension architecture

- **Background service worker** (`src/background/`) is the authority:
  it owns `declarativeNetRequest` rule installation, the WebSocket
  client to the desktop app, request tracking, and badge state.
  Persistent state lives in `chrome.storage`; the service worker is a
  reactor over it, so it can die and restart at any time without losing
  truth.
- Rule updates funnel through a single `scheduleUpdate(reason, options)`
  path — debounced and deduplicated by content hash — so every source of
  rule changes converges on one installation pipeline.
- **Popup and DevTools panel** are React UIs built from `packages/ui`.
  The extension works standalone (static rules) and gains dynamic
  sources and team features when a desktop app or server is reachable.

## Desktop architecture

The app runs almost entirely in the background (system tray). All
critical work happens in the **main process** — WebSocket server, source
refresh, workspace/git sync, capture, CLI API — never in the renderer:

- **Main process**: `src/main.ts`, `src/main/modules/`, `src/services/`
  (service registry + app state machine under `src/services/core/`).
- **Renderer**: `src/renderer/` — React UI that talks to main over IPC
  through a `contextBridge` preload (`src/preload.ts`). The renderer is
  a thin subscriber; closing every window leaves the product fully
  functional.

## Server / daemon

The daemon is the same back-end spine as the desktop main process,
packaged headless for multi-user deployments: SQLite-backed workspaces,
user directory and seat management, the web Workbench, and the API the
CLI and MCP clients consume. The desktop app is effectively a
single-user daemon plus a tray UI.

## Cross-cutting invariants

- **Local-first**: user data lives on the user's machines; the only
  outbound calls are the documented ones in
  [WIRE_TRANSPARENCY.md](WIRE_TRANSPARENCY.md) plus
  user-configured destinations.
- **Schema-validated boundaries**: data crossing a process or wire
  boundary is validated against valibot schemas from `core`.
- **Strict typing**: no `any`; Biome-enforced style across the repo.
- **Versioning**: apps and packages use CalVer (`YYYY.M.PATCH`) with
  independent per-app versions; the wire protocol versions separately as
  an integer.
