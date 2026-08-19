# Developer Documentation

Technical reference for building, testing, and contributing to Open
Headers. For the system map — what each app and package is and how they
talk — start with [ARCHITECTURE.md](ARCHITECTURE.md).

## Monorepo Overview

Open Headers is a pnpm + Turborepo monorepo: seven shared packages under
`packages/`, six shipping apps under `apps/`, and one native helper
crate.

| Workspace | Path | Description |
|-----------|------|-------------|
| `@openheaders/core` | `packages/core/` | Domain model: types, wire protocol, valibot schemas, shared utilities. Zero platform deps. |
| `@openheaders/rule-engine` | `packages/rule-engine/` | `declarativeNetRequest` compile pipeline, content-script generation, scripting injection |
| `@openheaders/oracle` | `packages/oracle/` | Entity-agnostic sync engine: workspace state, batching, conflict resolution |
| `@openheaders/oracle-host-node` | `packages/oracle-host-node/` | Node host adapter — SQLite persistence, WebSocket server (desktop, daemon) |
| `@openheaders/oracle-host-browser` | `packages/oracle-host-browser/` | Browser host adapter — IndexedDB persistence (extension, web) |
| `@openheaders/ui` | `packages/ui/` | Shared React UI: workbench, DevTools panel, popup primitives |
| `@openheaders/i18n` | `packages/i18n/` | Locale registry, message catalogs, translation runtime |
| `@openheaders/extension` | `apps/extension/` | Browser extension (Chrome, Firefox, Edge, Safari) |
| `@openheaders/desktop` | `apps/desktop/` | Electron desktop companion (macOS, Windows, Linux) |
| `@openheaders/daemon` | `apps/daemon/` | `ohd` — standalone headless team server |
| `@openheaders/cli` | `apps/cli/` | `oh` — CLI & TUI client |
| `@openheaders/web` | `apps/web/` | Workbench in a browser tab, served by the daemon |
| `@openheaders/nm-host` | `apps/nm-host/` | Native-messaging bootstrap host |

`native/h3-helper` is a Rust helper crate the daemon uses for HTTP/3
requests; it builds independently of the pnpm workspace.

Dependency direction is strictly `packages ← apps` — never the reverse,
and desktop and extension never depend on each other. Apps import core
via subpath exports (`@openheaders/core/types`,
`@openheaders/core/protocol`, …).

The desktop app (or a daemon) runs a WebSocket server on
`127.0.0.1:8137`; the extension and CLI connect as clients. Every
message shape and constant lives in `@openheaders/core/protocol`, and
the protocol carries its own integer version
(`packages/core/src/protocol/version.ts`), independent of app versions.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+ (`corepack enable` activates it automatically)
- [Git](https://git-scm.com/)

### Setup

```bash
git clone https://github.com/OpenHeaders/open-headers.git
cd open-headers
pnpm install
```

### Common Commands

```bash
pnpm turbo typecheck                  # Typecheck all packages
pnpm turbo test                       # Run all tests (~14,000 across all packages)
pnpm turbo build                      # Build everything
pnpm biome check .                    # Lint + format check
pnpm lint:fix                         # Auto-fix lint + format

# Per-package
pnpm --filter @openheaders/desktop test
pnpm --filter @openheaders/extension test
pnpm --filter @openheaders/core test
pnpm --filter @openheaders/desktop dev            # Desktop dev with hot-reload
pnpm --filter @openheaders/extension dev          # Extension dev (Chrome watch)

# Single test file
pnpm --filter @openheaders/desktop exec vitest run path/to/test.test.ts

# Clean build artifacts
pnpm turbo clean
```

Turborepo caches task results — unchanged packages are skipped
automatically.

The desktop app has two tsconfigs; its `typecheck` runs both
(`tsc --noEmit && tsc -p src/renderer/tsconfig.json --noEmit`).

## Building Each App

### Extension

```bash
pnpm --filter @openheaders/extension build            # All browsers
pnpm --filter @openheaders/extension build:chrome     # One browser: chrome / firefox / edge / safari
pnpm --filter @openheaders/extension dev              # Chrome watch mode (also dev:firefox etc.)
```

Vite build with the `BROWSER` env var selecting the target; output lands
in `apps/extension/dist/<browser>/`, loadable as an unpacked extension.
Custom plugins handle store CSP compliance, asset copying, and content
script IIFE bundling.

Source manifests in `manifests/<browser>/manifest.json` carry
`"version": "0.0.0"` as a placeholder; the build injects the real
version from `apps/extension/package.json` into the output manifest.

### Desktop

```bash
pnpm --filter @openheaders/desktop dev                 # Dev with hot-reload
pnpm --filter @openheaders/desktop build               # Production build (no installer)
pnpm --filter @openheaders/desktop dist:mac            # macOS (signed + notarized)
pnpm --filter @openheaders/desktop dist:mac:unsigned   # macOS (no signing)
pnpm --filter @openheaders/desktop dist:win            # Windows (dist:win:unsigned without cert)
pnpm --filter @openheaders/desktop dist:linux          # Linux (AppImage + deb + RPM)
```

**electron-vite** builds three targets (main, preload, renderer);
electron-builder packages installers into `apps/desktop/dist/`. The
`dist:*` scripts run `predist` first, which also builds the web bundle
the app serves.

### Daemon & CLI

```bash
pnpm --filter @openheaders/daemon pack       # npm-layout bundle → dist-package/
pnpm --filter @openheaders/daemon pack:sea   # self-contained single executable → dist-sea/
pnpm --filter @openheaders/cli pack
pnpm --filter @openheaders/cli pack:sea
```

`pack:sea` uses Node's single-executable packaging — the bundled
runtime, the app, and (for the daemon) the web app and compiled SQLite
addon all live inside one binary. Build on the platform/arch you
target.

### Web & nm-host

```bash
pnpm --filter @openheaders/web build         # Static workbench bundle → apps/web/dist/
pnpm --filter @openheaders/nm-host pack:bun  # Native-messaging host binary
```

## Project Structure

```
open-headers/
├── packages/
│   ├── core/src/               Domain model: types/, protocol/, schemas/, telemetry/,
│   │                           licensing/, sync/, variables/, vault/, import/, …
│   ├── rule-engine/            Rule → DNR/content-script/scripting compile pipeline
│   ├── oracle/                 Sync engine (platform-neutral)
│   ├── oracle-host-node/       SQLite + WS server host; daemon boot spine
│   ├── oracle-host-browser/    IndexedDB host
│   ├── ui/src/                 workbench/, devtools panel, popup, shared components
│   └── i18n/                   Locales and translation runtime
│
├── apps/
│   ├── extension/src/          background/ (service worker), popup/, panel/ (DevTools),
│   │                           sidepanel/, workbench/, offscreen/, host/, utils/
│   │       manifests/          Per-browser manifest sources (chrome/firefox/edge/safari)
│   ├── desktop/src/            main.ts + main/ (host wiring, updater, telemetry,
│   │                           script-sandbox), preload.ts, renderer/ (workbench host)
│   ├── daemon/src/             Headless server + service lifecycle CLI
│   ├── cli/src/                oh command tree, TUI, self-update
│   ├── web/src/                Workbench entry served by the daemon
│   └── nm-host/src/            Native-messaging bootstrap
│
├── native/h3-helper/           HTTP/3 helper crate (Rust)
├── scripts/                    Repo-wide scripts (i18n scan, update feed, changelog)
├── docs/                       Public documentation
├── turbo.json                  Turborepo task pipeline
├── pnpm-workspace.yaml         Workspace definition
├── tsconfig.base.json          Shared TS config (strict, isolatedModules)
└── biome.json                  Linter + formatter
```

## Technology Stack

| Layer | Value |
|-------|-------|
| Language | TypeScript, strict mode, everywhere |
| UI | React 19 + Ant Design (shared components from `packages/ui`) |
| Desktop runtime | Electron (main / preload / renderer via electron-vite) |
| Extension runtime | MV3 service worker (background scripts on Firefox/Safari) |
| Build | Vite (extension, daemon, cli, web), electron-vite (desktop) |
| Validation | valibot schemas at every process/wire boundary |
| Tests | vitest (unit/integration), Playwright (E2E) |
| Lint/format | Biome |

## Testing

```bash
pnpm turbo test                                       # All packages
pnpm --filter @openheaders/desktop test               # One package
pnpm --filter @openheaders/desktop test:e2e           # Desktop e2e (requires build)
pnpm --filter @openheaders/extension test:e2e         # Extension e2e (requires Chrome build)
```

- **vitest** for unit/integration tests, **Playwright** for E2E
- Tests mirror `src/` structure under `tests/unit/`
- Factory functions (`makeSource()`, `makeWorkspace()`) with
  `Partial<T>` overrides
- Chrome API mock: `tests/__mocks__/chrome.ts` (extension); Electron
  mock: `tests/__mocks__/electron.ts` (desktop)
- Use `openheaders.io` domains (and variants) in test data, not
  made-up domains — test fixtures deliberately stay on `.io`; product
  URLs in `src/` use `openheaders.com`

## CI/CD

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on push to `main` and PRs:

1. `pnpm install --frozen-lockfile`
2. `pnpm biome check .` (non-blocking, warnings only)
3. `pnpm turbo typecheck`
4. i18n scans (hardcoded-string scan + locale-catalog lint)
5. Tests for core, extension, and desktop
6. `pnpm turbo build`
7. A desktop E2E smoke spec under xvfb

### Release Pipelines

- **Suite release**: a `v*` tag triggers `release.yml` — desktop for
  three platforms (signed), extension zips for four browsers, and the
  standalone `oh`/`ohd` binaries, published as one GitHub Release on
  [`OpenHeaders/open-headers`](https://github.com/OpenHeaders/open-headers)
  plus the update feed at `updates.openheaders.com`.
- **Stream lanes**: `v*-cli` and `v*-daemon` tags trigger
  `release-binaries.yml` — ship only `oh` or only `ohd` (+ its
  `ghcr.io/openheaders/ohd` image) without rebuilding the suite.
- `check-store-versions.yml` polls the browser stores' own update
  endpoints on a schedule and keeps the update feed's extension entry
  honest about what the stores actually serve.

### Versioning

Desktop and extension have **independent versions**: the desktop
version comes from the git tag on release, the extension version from
`apps/extension/package.json`. Apps and packages use CalVer
(`YYYY.M.PATCH`); the wire protocol versions separately as an integer
in `packages/core/src/protocol/version.ts`.

## Code Style

Enforced by **Biome** (not ESLint/Prettier):

- 2-space indentation, single quotes, trailing commas, semicolons
- 120 character line width
- No `any` types — use proper specific types
- `isolatedModules` enabled — use explicit `export type`

```bash
pnpm biome check .          # Check
pnpm lint:fix               # Auto-fix
```

## Security

- **Local-only bridge**: the WebSocket server binds to
  `127.0.0.1:8137` and never exposes itself to the network; the daemon
  requires tokens on every non-loopback connection
- **Validation**: data crossing a process or wire boundary is validated
  against valibot schemas from core; header names/values are validated
  against RFC 7230 and browser restrictions
- **Context isolation**: the Electron preload uses `contextBridge` with
  a strict API surface
- **Static bundling**: every dependency is packed at build time; no
  code is loaded at runtime from CDNs or any remote source
- **Documented wire surface**: every OpenHeaders-bound network call is
  specified byte for byte in
  [WIRE_TRANSPARENCY.md](WIRE_TRANSPARENCY.md); a request the software
  makes that is not documented there is treated as a vulnerability —
  see [SECURITY.md](../SECURITY.md)

### Software Bill of Materials

A CycloneDX SBOM for the whole monorepo — every npm workspace
dependency from `pnpm-lock.yaml` plus the `native/h3-helper` crates
from `Cargo.lock` — can be generated from a fresh clone with no build
step:

```bash
pnpm dlx @cyclonedx/cdxgen -t pnpm -t rust --no-install-deps -o sbom.cdx.json .
```

GitHub's dependency graph also offers a zero-tooling SPDX export of
the same dependency set:
`gh api repos/OpenHeaders/open-headers/dependency-graph/sbom`.

### Third-party license notices

Every shipped artifact carries an aggregated `THIRD-PARTY-NOTICES.txt`
with the license text of each bundled package (plus the vendored
Press Start 2P font's OFL text where the UI ships):
`scripts/generate-third-party-notices.mjs` walks the production
dependency closure of the artifact's app packages and runs in the
desktop `predist` step (into `resources/`), the extension release
zips, and the standalone-binaries release lane (as a release asset).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
