# Open Headers

![Open Headers Logo](./apps/desktop/build/icon128.png)

[![CI](https://github.com/OpenHeaders/open-headers/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenHeaders/open-headers/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/OpenHeaders/open-headers)](https://github.com/OpenHeaders/open-headers/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/OpenHeaders/open-headers/total)](https://github.com/OpenHeaders/open-headers/releases)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)]()

The Enterprise API Client - Open-source DevToolkit inside a browser
extension.

Local-first: no account, no cloud, your data stays on your machine.

**Website**: [openheaders.com](https://openheaders.com) ·
**Docs**: [docs.openheaders.com](https://docs.openheaders.com)

<!-- screenshot: hero — the workbench with the rules list and the
     network panel side by side. Drop the asset at
     docs/assets/readme-hero.png and replace this comment with:
     ![Open Headers workbench](docs/assets/readme-hero.png) -->

## What it does

### API Client — manage and execute requests

- **Requests**: HTTP, GraphQL, gRPC, MQTT, WebSocket, Socket.IO, SSE
- **Structure**: Collections > Folders > Requests
- **Scripting**: pre- and post-response scripts and assertions, with a
  package library
- **Settings**: execution and limits, connection, TLS and trust,
  redirects, cookies, session, session resilience
- **Authorization**: inherited through the structure, overridable per
  request: API Key, Basic Auth, Bearer Token, Digest Auth, Hawk, HTTP
  Message Signature, JWT Bearer, OAuth 1.0, OAuth 2.0, AWS Signature v4,
  Akamai EdgeGrid, ASAP (Atlassian)
- **Specs**: OpenAPI 3.1 (HTTP), Protobuf 3 (gRPC), AsyncAPI 3.0
  (WebSocket, MQTT), GraphQL schema (GraphQL)
- **Delegation**: send from the browser extension, or run/delegate the
  request on the desktop app or the server
- **Workflows**: schedule multiple linked requests with AND/OR
  conditions and auto-refresh, then extract live variable values from
  the responses
- **Variables**: Workspace (global), Collection, Environment, Vault
  (secret), Live

### Browser Interceptor — modify live browser traffic

- **Rules**: API HTTP request and response, headers, query params,
  JS/CSS, WebSocket, SSE, block, redirect, delay, auth challenge
- **Structure**: Collections > Folders > Rules
- **Modify API HTTP responses**: mock, or rewrite the server's; body as
  static data or dynamic JavaScript; optionally modify headers and
  override the status code
- **Modify API HTTP requests**: REST or GraphQL; body as static data or
  dynamic JavaScript
- **Modify WebSocket messages and SSE events**
- **Modify headers, query params and URLs**
- **Inject JS and CSS**
- **Block and redirect requests**
- **Respond to auth challenges**
- **Variables**: every rule reads the same variable scopes; Live
  variables filled by API Client workflows make prod-like scenarios
  possible
- **DevTools panel**: a custom Open Headers panel in the browser's
  DevTools, with enterprise design and features

### Team Collaboration — manage shared workspaces

- **Multi-workspace**: your personal workspaces and the team's shared
  workspaces, side by side
- **Backup and sync**: through a local server you self-host or a remote
  server you join
- **Server features**: SSO, RBAC user management, audit logs
- **Git integration**: durable workspace history, embedded version
  control tools
- **Concurrent multi-user editing**: CRDT-flavoured writes for the
  workspace data
- **Work offline**: auto-sync when back online

### Enterprise Platform — free, like it should be

- **Tools**: every major feature is embedded in its own Tool panel
- **Modern UI**: minimalist workbench canvas with two active sidebars
  and six dock regions
- **Modern UX**: drag and drop the Tools across the dock regions to
  group them
- **One user interface**: desktop app, web app and browser extension
  (workbench and browser DevTools panel)
- **Embedded documentation**: info popovers and a Docs Tool with
  diagrams and text, usable offline
- **Git**: version control and commit changes directly inside the
  desktop app
- **Traffic**: route the browser traffic to the desktop app and modify
  it there
- **AI integration**: use your existing subscriptions with the MCP
  server and automate interaction with your workspace data and Tools

<!-- gif: 20–30s loop — create a header rule, watch it fire in the
     network panel, send a request from the API client. Drop the asset
     at docs/assets/readme-demo.gif and replace this comment with:
     ![Open Headers in action](docs/assets/readme-demo.gif) -->

## Get started

Install the extension:

- ![](docs/assets/chrome.svg) [Chrome Web Store](https://chromewebstore.google.com/detail/ablaikadpbfblkmhpmbbnbbfjoibeejb)
- ![](docs/assets/edge.svg) [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/open-headers/gnbibobkkddlflknjkgcmokdlpddegpo)
- ![](docs/assets/firefox.svg) [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/open-headers/)

Install the desktop app:

- ![](docs/assets/macos.svg) [macOS](https://docs.openheaders.com/quickstart/desktop#macos)
- ![](docs/assets/windows.svg) [Windows](https://docs.openheaders.com/quickstart/desktop#windows)
- ![](docs/assets/linux.svg) [Linux](https://docs.openheaders.com/quickstart/desktop#linux)

Self-host your own server:

- ![](docs/assets/macos.svg) [macOS](https://docs.openheaders.com/quickstart/server#macos)
- ![](docs/assets/linux.svg) [Linux](https://docs.openheaders.com/quickstart/server#linux)
- ![](docs/assets/docker.svg) [Docker](https://docs.openheaders.com/quickstart/server#docker)

To build any app from a fresh clone, see
[Building each app](docs/DEVELOPER.md#building-each-app) in the
developer guide.

## Security & trust

- [Security policy](SECURITY.md) — how to report vulnerabilities, safe
  harbor for good-faith research
- [Security whitepaper](docs/SECURITY_WHITEPAPER.md) — the architecture
  behind the guarantees
- [Wire transparency](docs/WIRE_TRANSPARENCY.md) — every outbound call,
  byte for byte
- [Privacy policy](docs/PRIVACY.md) — data practices
- [Extension permissions](apps/extension/PERMISSIONS.md) — why each
  browser permission is requested

## Documentation

- [docs.openheaders.com](https://docs.openheaders.com) — quick starts,
  guides, the server book, command reference
- [Architecture overview](docs/ARCHITECTURE.md) — the system map
- [Developer guide](docs/DEVELOPER.md) — setup, builds, tests, CI
- [Contributing](docs/CONTRIBUTING.md) — bug reports, DCO sign-off,
  feature policy

## License

Open Headers is open source under the [Apache License 2.0](LICENSE).
Official branded binaries and store builds are distributed under the
[End User License Agreement](legal/EULA.md). Every feature is included
in the free tier — the software is identical on every plan, and paid
plans exist only to add team seats beyond the free tier's six active
users.
