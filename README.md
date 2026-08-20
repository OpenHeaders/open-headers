# Open Headers

![Open Headers Logo](./apps/desktop/build/icon128.png)

[![CI](https://github.com/OpenHeaders/open-headers/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenHeaders/open-headers/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/OpenHeaders/open-headers)](https://github.com/OpenHeaders/open-headers/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/OpenHeaders/open-headers/total)](https://github.com/OpenHeaders/open-headers/releases)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)]()

Open Source DevToolkit inside a browser extension — modify live
browser requests, manage API collections, collaborate with your team.

Local-first: no account, no cloud, your data stays on your machine.

**Website**: [openheaders.com](https://openheaders.com)

<!-- screenshot: hero — the workbench with the rules list and the
     network panel side by side. Drop the asset at
     docs/assets/readme-hero.png and replace this comment with:
     ![Open Headers workbench](docs/assets/readme-hero.png) -->

## What it does

The browser extension is the product; three companion surfaces extend it
beyond the browser:

- **Browser extension** (Chrome, Firefox, Edge) — the full toolkit:
  nine rule types over live browser traffic, a DevTools-grade network
  panel, a full API client (HTTP, GraphQL, gRPC, WebSocket, OAuth 2.0,
  scripts), workflows with chained & scheduled requests, an encrypted
  vault for secrets, multi-workspace team collaboration, and an MCP
  server for AI tooling — all working offline, no account.
- **Desktop app** — background companion in the system tray: native
  messaging + WebSocket bridge for the extension, git-backed workspace
  sync, dynamic value sources, local proxy.
- **`oh`** — standalone CLI & TUI.
- **`ohd`** — team server daemon with SSO/OIDC, RBAC, and audit log
  (also on Docker: `ghcr.io/openheaders/ohd`).

<!-- gif: 20–30s loop — create a header rule, watch it fire in the
     network panel, send a request from the API client. Drop the asset
     at docs/assets/readme-demo.gif and replace this comment with:
     ![Open Headers in action](docs/assets/readme-demo.gif) -->

## Install

1. Install the extension from your browser's store:
   [Chrome](https://chromewebstore.google.com/detail/ablaikadpbfblkmhpmbbnbbfjoibeejb) ·
   [Edge](https://microsoftedge.microsoft.com/addons/detail/open-headers/gnbibobkkddlflknjkgcmokdlpddegpo) ·
   [Firefox](https://addons.mozilla.org/en-US/firefox/addon/open-headers/)
2. Optional companions — the desktop app from the
   [Releases](https://github.com/OpenHeaders/open-headers/releases) page,
   and `oh` / `ohd` as self-contained binaries (no Node.js required):

   ```sh
   curl -fsSL https://updates.openheaders.com/install.sh | sh
   ```

   ```powershell
   irm https://updates.openheaders.com/install.ps1 | iex
   ```

   The script verifies SHA-256 checksums and installs to `~/.local/bin`
   (`%LOCALAPPDATA%\OpenHeaders\bin` on Windows); pass `--with-daemon`
   to also install `ohd`. The daemon also ships as a container image:

   ```sh
   docker run -d -p 8137:8137 -v oh-data:/data ghcr.io/openheaders/ohd:latest
   ```

Every surface works without the others; the extension alone is a
complete tool.

## Build from source

Anyone can build every app in this repository from a fresh clone and
run their own builds in production. Prerequisites: [Node.js](https://nodejs.org/) 22+,
[pnpm](https://pnpm.io/) 10+ (`corepack enable`).

```sh
git clone https://github.com/OpenHeaders/open-headers.git
cd open-headers
pnpm install
pnpm turbo build          # builds every package and app
```

Per app:

```sh
# Extension → apps/extension/dist/<browser>/ (load as an unpacked extension)
pnpm --filter @openheaders/extension build:chrome    # or build:firefox / build:edge / build:safari

# Desktop → apps/desktop/dist/ (unsigned local build)
pnpm --filter @openheaders/desktop dist:mac:unsigned # or dist:win:unsigned / dist:linux

# Daemon (ohd) → apps/daemon/dist-package/ (npm-layout bundle) or a single binary
pnpm --filter @openheaders/daemon pack
pnpm --filter @openheaders/daemon pack:sea           # self-contained executable

# CLI (oh) → apps/cli/dist-package/ or a single binary
pnpm --filter @openheaders/cli pack
pnpm --filter @openheaders/cli pack:sea
```

The full build, test, and architecture reference is in
[docs/DEVELOPER.md](docs/DEVELOPER.md).

## Telemetry

The apps count which features get used — never what you use them on —
and the design makes that verifiable rather than a promise:

- **A typed event vocabulary, compiled in.** Every telemetry field is a
  closed union, boolean, or number
  ([`packages/core/src/telemetry/`](packages/core/src/telemetry/)); a
  guard test bans free-form strings, so URLs, headers, request/response
  data, rule contents, and file paths are inexpressible.
- **Inspectable byte for byte.** Settings → General → "View telemetry
  events" shows every event of the current session exactly as sent — or
  as suppressed, when the channel is off.
- **Off with one switch.** Settings → General in the extension and
  desktop app, `OH_TELEMETRY=0` for the CLI. Off means off, and it also
  deletes the random install identifier. The daemon, the web app it
  serves, and the MCP server never send telemetry at all.
- **Specified on the wire.** Every network call the software can make —
  telemetry included — is documented byte for byte in
  [docs/WIRE_TRANSPARENCY.md](docs/WIRE_TRANSPARENCY.md). A request not
  listed there is a bug we treat as a vulnerability.

Telemetry is on by default; the toggle is one switch away and every
feature works identically with it off.

## Security & trust

- [Security policy](SECURITY.md) — how to report vulnerabilities,
  response expectations, safe harbor for good-faith research
- [Security whitepaper](docs/SECURITY_WHITEPAPER.md) — the architecture
  behind the guarantees: local-first storage, offline license
  verification, static bundling
- [Wire transparency](docs/WIRE_TRANSPARENCY.md) — every outbound call,
  byte for byte
- [Privacy policy](docs/PRIVACY.md) — data practices
- [Extension permissions](apps/extension/PERMISSIONS.md) — why each
  browser permission is requested

## Documentation

- [Architecture overview](docs/ARCHITECTURE.md) — the system map
- [Developer guide](docs/DEVELOPER.md) — setup, builds, tests, CI
- [Contributing](docs/CONTRIBUTING.md) — bug reports, DCO sign-off,
  feature policy

## Monorepo layout

| Path | What |
| --- | --- |
| `apps/extension` | Browser extension (Chrome / Firefox / Edge / Safari) |
| `apps/desktop` | Electron desktop companion |
| `apps/cli` | `oh` CLI & TUI |
| `apps/daemon` | `ohd` team server daemon |
| `apps/nm-host` | Native messaging host binary |
| `apps/web` | Web app embedded by the daemon |
| `packages/core` | Shared domain model, protocol, schemas |
| `packages/*` | Rule engine, oracle, UI, i18n, host adapters |

## License

Open Headers is open source under the [Apache License 2.0](LICENSE).
Official branded binaries and store builds are distributed under the
[End User License Agreement](legal/EULA.md). Every feature is included
in the free tier — the software is identical on every plan, and paid
plans exist only to add team seats beyond the free tier's six active
users.
