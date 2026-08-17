# Open Headers

![Open Headers Logo](./apps/desktop/build/icon128.png)

[![CI](https://github.com/OpenHeaders/open-headers-app/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenHeaders/open-headers-app/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/OpenHeaders/open-headers)](https://github.com/OpenHeaders/open-headers/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/OpenHeaders/open-headers/total)](https://github.com/OpenHeaders/open-headers/releases)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)]()

Your existing Web DevToolkit inside a browser extension — modify live
browser requests, manage API collections, collaborate with your team.

Local-first: no account, no cloud, your data stays on your machine.

**Website**: [openheaders.io](https://openheaders.io)

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

## Quick start

1. Install the extension from your browser's store:
   [Chrome](https://chromewebstore.google.com/detail/ablaikadpbfblkmhpmbbnbbfjoibeejb) ·
   [Edge](https://microsoftedge.microsoft.com/addons/detail/open-headers/gnbibobkkddlflknjkgcmokdlpddegpo) ·
   [Firefox](https://addons.mozilla.org/en-US/firefox/addon/open-headers/)
2. Optional: grab the desktop app, `oh`, or `ohd` from the
   [Releases](https://github.com/OpenHeaders/open-headers/releases) page,
   or `curl -fsSL https://updates.openheaders.io/install.sh | sh`

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

## Documentation

- [Developer Guide](docs/DEVELOPER.md) — Architecture, setup, tech stack
- [Contributing](docs/CONTRIBUTING.md) — How to report bugs and request features
- [Releases](docs/RELEASES.md) — Release process and versioning
- [Privacy Policy](docs/PRIVACY.md) — Data practices and permissions

## License

Open Headers is open source under the [Apache License 2.0](LICENSE).
Official branded binaries and store builds are distributed under the
[End User License Agreement](legal/EULA.md). Every feature is included
in the free tier — the software is identical on every plan, and paid
plans exist only to add team seats.
