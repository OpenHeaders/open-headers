# @openheaders/daemon

Standalone Open Headers daemon — the self-hosted back-end tier of
[Open Headers](https://openheaders.io). It runs the same sync engine as the
desktop app, headless: workspaces, rules, and live values served to the browser
extension, desktop app, and CLI over one WebSocket/HTTP bind.

Your machine, your LAN, a Raspberry Pi/NAS, or a VM you rent. No account, no
cloud relay, no telemetry, no phone-home — the daemon makes zero outbound
connections except ones you configure (an OIDC identity provider for SSO
login, if you set one up).

## Requirements

- Node.js 22 or newer
- macOS or Linux for the service lifecycle (`oh daemon install/start/stop`);
  any platform can run `node dist/main.js` directly

## Install

```sh
npm install -g @openheaders/daemon
```

The native SQLite module is built for your machine's Node at install time
(prebuilt bindings for common platforms; a compiler toolchain only if none
matches).

## Quick start

```sh
oh daemon install                 # write the user service unit (launchd/systemd)
oh daemon show-token              # mint the first client token (shown once)
oh daemon start
oh daemon status                  # probes /healthz
```

`show-token` prints the join URLs and a one-time secret. Add the daemon as a
backend in a client (Settings → Backends) with that token.

The daemon binds `127.0.0.1:8137` by default — loopback only. To make it
LAN-reachable:

```sh
oh daemon install --bind-address 0.0.0.0
```

Tokens are required on every non-loopback connection; pairing and token
administration beyond the first token happen from a connected client.

On Linux, `install` also enables the unit for boot and turns on user
lingering (`systemctl --user enable oh-daemon.service`,
`loginctl enable-linger`) so the daemon survives reboots and outlives the
SSH session that installed it; if either command needs privileges, the exact
manual command is printed instead. On macOS the LaunchAgent starts at login.

## Configuration

Precedence, highest first: argv → env → `daemon.json` → defaults.

| Flag | Env | `daemon.json` | Default |
| --- | --- | --- | --- |
| `--data-dir` | `OH_DAEMON_DATA_DIR` | `dataDir` | platform state dir |
| `--bind-address` | `OH_DAEMON_BIND_ADDRESS` | `bindAddress` | `127.0.0.1` |
| `--bind-port` | `OH_DAEMON_BIND_PORT` | `bindPort` | `8137` |
| `--log-level` | `OH_DAEMON_LOG_LEVEL` | `logLevel` | `info` |
| `--trusted-proxy` | `OH_DAEMON_TRUSTED_PROXY` | `trustedProxy` | `false` |
| `--allowed-host` (repeatable) | `OH_DAEMON_ALLOWED_HOSTS` (comma-separated) | `allowedHosts` | none |
| `--web-root` | `OH_DAEMON_WEB_ROOT` | `webRoot` | `web/` beside the daemon bundle |
| `--config` | `OH_DAEMON_CONFIG` | — | `<data dir>/daemon.json` |
| — | `OH_DAEMON_OIDC_CLIENT_SECRET` | `oidc` (object, see below) | SSO off |
| — | `OH_DAEMON_AUDIT_RETENTION_DAYS` | `auditRetentionDays` | `90` |

Everything the daemon persists (`storage.json`, `oracle.db`, blobs) lives under
the data dir.

## Settings

Runtime settings live in `storage.json` (not `daemon.json`). The CLI exposes
the MCP switches, all off by default:

```sh
oh daemon config set mcp.enabled true   # requires the daemon to be stopped
oh daemon config get mcp.enabled
oh daemon config list
```

Settable keys: `mcp.enabled`, `mcp.allowWrite`, `mcp.allowExecute`,
`mcp.allowSecrets`. `config set` refuses while the daemon runs —
`storage.json` is single-writer, like `show-token`; a running daemon takes
settings changes from a connected admin surface instead. Reads work anytime.

## Web app

The daemon serves the Open Headers web app — the same Workbench UI the
desktop app and extension run — as static files on its bind: open
`http://<daemon-host>:8137/` in a browser. Distributions built with the web
bundle serve it out of the box; point `--web-root` at a different built bundle
to serve that instead. An explicitly configured web root must contain an
`index.html`, or the daemon refuses to boot; without any web root the daemon
runs headless-only and `/` answers 400 as before.

## SSO login (OIDC)

Team deployments can let users sign in to the served web app through an
OpenID Connect provider instead of pasting a pairing token. Configure the
provider in `daemon.json`:

```json
{
  "oidc": {
    "issuer": "https://sso.example.com",
    "clientId": "openheaders-daemon",
    "redirectOrigin": "https://oh.example.com",
    "autoProvision": false,
    "sessionTtlDays": 30,
    "providerLabel": "Example SSO"
  }
}
```

Register `<redirectOrigin>/auth/oidc/callback` as the client's redirect URI
with the provider. For confidential clients, put the client secret in
`daemon.json` as `oidc.clientSecret` or (better) in the service environment as
`OH_DAEMON_OIDC_CLIENT_SECRET`; public clients need no secret — the flow
always runs PKCE. `redirectOrigin` may be omitted for single-hostname
deployments; the daemon then derives it from the request.

A successful login maps the provider's verified email onto a daemon user
(`oh daemon user add <name> --email <email>`) and mints a session token bound
to that user, expiring after `sessionTtlDays` (default 30). Unknown emails are
refused unless `autoProvision` is `true`, which creates the user with zero
workspace grants — grant access with `oh daemon user grant`. Daemon-local
users, pairing, and operator-minted tokens keep working unchanged; SSO is
additive.

## Admission and rate limits

Every route on the bind enforces its own Origin/Host posture: `/mcp` refuses
any browser-originated request outright; the WebSocket sync route accepts
browser-extension origins and the daemon's own served origin; the pairing
pages accept only same-origin form posts; the web app pages accept top-level
navigations and same-origin fetches; the SSO login routes (`/auth/oidc/*`,
active only when configured) accept top-level navigations and same-origin
fetches, and claim-code guesses feed the failure budget; `/healthz` stays
open. Requests
addressed by a hostname the daemon doesn't answer as are refused on the
browser-facing routes — IP addresses, `localhost`, and mDNS `*.local` names
always work; anything else (a reverse-proxy domain, an intranet name) must be
declared with `--allowed-host`.

Failed token attempts — pairing-code guesses, WebSocket auth rejections, and
`/mcp` bearer failures — feed one per-peer budget. A peer that crosses it is
blocked for a cool-down (HTTP 429 with `Retry-After`; upgrades refused), and
the daemon logs a single `peer throttled: … (peer=<addr>)` line at the
transition.

## Behind a reverse proxy (TLS)

TLS is reverse-proxy-first: terminate `wss://` at nginx or Caddy and forward
plain `ws://` to the daemon on loopback. The daemon can stay bound to
`127.0.0.1` when the proxy runs on the same machine — only the proxy is
reachable from outside.

```sh
oh daemon install --trusted-proxy --allowed-host oh.example.com
```

`--trusted-proxy` makes auth logs and rate limits use the client address the
proxy appends to `X-Forwarded-For` instead of the proxy's own; never set it
without a proxy in front, since clients could then spoof the header.
`--allowed-host` admits the proxy's domain on the browser-facing routes.

Caddy (automatic certificates, WebSocket upgrades and `X-Forwarded-For` are
handled by default):

```caddyfile
oh.example.com {
    reverse_proxy 127.0.0.1:8137
}
```

nginx:

```nginx
server {
    listen 443 ssl;
    server_name oh.example.com;
    ssl_certificate     /etc/ssl/oh.example.com.crt;
    ssl_certificate_key /etc/ssl/oh.example.com.key;

    location / {
        proxy_pass http://127.0.0.1:8137;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
```

Clients then dial `wss://oh.example.com` with a paired token, exactly like a
LAN join.

## Audit log

Every permission decision — allowed or denied, over WebSocket sync or MCP —
is recorded durably in `oracle.db` with the acting user, capability,
workspace, decision and timestamp. Entries are kept for `auditRetentionDays`
(default 90; raise it for compliance retention — there is no upper cap) and
pruned hourly.

```sh
oh daemon audit list                             # newest first, 50 rows
oh daemon audit list --decision deny --since 7d
oh daemon audit list --actor alice@openheaders.io --workspace <id>
oh daemon audit export --since 2026-07-01 > audit.jsonl
```

`list` resolves actor names through the current user directory at view time;
`export` emits the raw rows as JSONL, oldest first. Both work while the
daemon runs — reads are lock-free. `--since`/`--until` take ISO date-times or
relative forms (`30m`, `24h`, `7d`).

## Logs

One line per event: `<ISO timestamp> <LEVEL> [scope] message`. Authentication
rejections include the peer address and reason on a single line, so log
scanners can match them directly.

## License

MIT
