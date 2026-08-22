# @openheaders/daemon

Standalone Open Headers daemon — the self-hosted back-end tier of
[Open Headers](https://openheaders.com). It runs the same sync engine as the
desktop app, headless: workspaces, rules, and live values served to the browser
extension, desktop app, and CLI over one WebSocket/HTTP bind.

Your machine, your LAN, a Raspberry Pi/NAS, or a VM you rent. No account, no
cloud relay, no telemetry, no phone-home — the daemon makes zero outbound
connections except ones you configure (an OIDC identity provider for SSO
login, if you set one up).

## Requirements

- macOS or Linux for the service lifecycle (`ohd install/start/stop`);
  any platform can run `ohd run` directly. No Node.js required —
  the binary is self-contained (Node 22+ only to build from source).

## Install

Each release ships `oh` as one self-contained executable per
platform/arch, built with Node's single-executable packaging
(`pnpm --filter @openheaders/daemon pack:sea` from a checkout, on the machine
you target). Everything is inside the binary — the bundled runtime, the CLI,
the daemon, the web app, and the compiled SQLite addon.

```sh
curl -fsSL https://updates.openheaders.com/install.sh | sh -s -- --with-daemon
```

The script verifies SHA-256 checksums and installs `oh` and `ohd` to
`~/.local/bin`; the same binaries are downloadable from the
[releases page](https://github.com/OpenHeaders/open-headers/releases).

On first use the binary unpacks the addon (and the web app) to
`<state dir>/sea/<build>/` — a native module can only load from disk — with
checksum-verified, crash-safe unpacking; set `OH_DAEMON_UNPACK_DIR` to move
that base. The service unit written by `ohd install` execs
`ohd run`, which also works standalone: it runs the daemon in the
foreground (Ctrl-C / SIGTERM shuts it down cleanly), which is handy under
container supervisors and for trying things out before installing a service
unit.

### Docker

Each release also publishes the daemon binary as a container image:

```sh
docker run -d -p 8137:8137 -v oh-data:/data ghcr.io/openheaders/ohd:latest
```

State lives in the `/data` volume; the daemon listens on `0.0.0.0:8137`
inside the container. Pin a version tag (they match the daemon's
`package.json` version) for reproducible deployments.

## Quick start

```sh
ohd install                 # write the user service unit (launchd/systemd)
ohd show-token              # mint the first client token (shown once)
ohd start
ohd status                  # probes /healthz
```

`show-token` prints the join URLs and a one-time secret. Add the daemon as a
backend in a client (Settings → Backends) with that token.

The daemon binds `127.0.0.1:8137` by default — loopback only. To make it
LAN-reachable you must also say how the connection is protected: either a
TLS-terminating reverse proxy in front (see below), or an explicit
acknowledgment that cleartext on a trusted network is acceptable:

```sh
ohd install --bind-address 0.0.0.0 --allow-insecure-lan
ohd restart        # a running daemon keeps its old bind until restarted
```

Without one of the two, a `0.0.0.0` bind refuses to boot rather than serve
auth tokens and pairing secrets unencrypted by accident. Run `ohd show-token`
(daemon stopped) to see the LAN join URLs; if clients still cannot connect,
check the host firewall (`ufw`/`firewalld`) admits port 8137.

Tokens are required on every non-loopback connection; pairing and token
administration beyond the first token happen from a connected client.

`install` persists the given flags into `daemon.json` and may be re-run at
any time to reconfigure — an omitted flag keeps its persisted value
(`--no-trusted-proxy` / `--no-allow-insecure-lan` clear the booleans), and
`ohd restart` applies the result. `ohd start` is a no-op while the service
already runs.

On Linux, `install` also enables the unit for boot and turns on user
lingering (`systemctl --user enable oh-daemon.service`,
`loginctl enable-linger`) so the daemon survives reboots and outlives the
SSH session that installed it; if either command needs privileges, the exact
manual command is printed instead. On macOS the LaunchAgent starts at login.

## Configuration

Precedence, highest first: argv → env → `daemon.json` → defaults.
`daemon.json` is the durable configuration — `ohd install` writes the flags
it is given into it, the service unit carries only `--config`, and every
`ohd` command (`status`, `show-token`, the daemon boot itself) reads the
same file.

| Flag | Env | `daemon.json` | Default |
| --- | --- | --- | --- |
| `--data-dir` | `OH_DAEMON_DATA_DIR` | `dataDir` | platform state dir |
| `--bind-address` | `OH_DAEMON_BIND_ADDRESS` | `bindAddress` | `127.0.0.1` |
| `--bind-port` | `OH_DAEMON_BIND_PORT` | `bindPort` | `8137` |
| `--log-level` | `OH_DAEMON_LOG_LEVEL` | `logLevel` | `info` |
| `--trusted-proxy` | `OH_DAEMON_TRUSTED_PROXY` | `trustedProxy` | `false` |
| `--allow-insecure-lan` | `OH_DAEMON_ALLOW_INSECURE_LAN` | `allowInsecureLan` | `false` |
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
ohd config set mcp.enabled true   # requires the daemon to be stopped
ohd config get mcp.enabled
ohd config list
```

Settable keys: `mcp.enabled`, `mcp.allowObserve`, `mcp.allowWrite`,
`mcp.allowExecute`, `mcp.allowSecrets`, `updates.autoUpdate`. Bind and
network options are not settings — they persist through the `ohd install`
flags above. `config set` refuses while the daemon runs —
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
(`ohd user add <name> --email <email>`) and mints a session token bound
to that user, expiring after `sessionTtlDays` (default 30). Unknown emails are
refused unless `autoProvision` is `true`, which creates the user with zero
workspace grants — grant access with `ohd user grant`. Daemon-local
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
ohd install --trusted-proxy --allowed-host oh.example.com
ohd restart
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
ohd audit list                             # newest first, 50 rows
ohd audit list --decision deny --since 7d
ohd audit list --actor alice@openheaders.com --workspace <id>
ohd audit export --since 2026-07-01 > audit.jsonl
```

`list` resolves actor names through the current user directory at view time;
`export` emits the raw rows as JSONL, oldest first. Both work while the
daemon runs — reads are lock-free. `--since`/`--until` take ISO date-times or
relative forms (`30m`, `24h`, `7d`).

## Metrics

`GET /metrics` on the daemon's bind returns a JSON snapshot of operational
state: version and uptime, bind lifecycle, connected peers (same-device vs
LAN), workspace count, per-subsystem status, stored mutations (total and
last 24h), audit decision counts, and the observability ring size. The
route is read-only and token-gated — every request presents a paired token,
loopback included, validated against the same ledger as WebSocket sync and
MCP.

```sh
ohd status                                  # liveness only (no token)
ohd status --verbose --token oh_…           # + /metrics, human-formatted
OH_DAEMON_TOKEN=oh_… ohd status --verbose   # token via environment

curl -H "Authorization: Bearer oh_…" http://127.0.0.1:8137/metrics
```

Browser-originated requests are refused outright (same posture as `/mcp`),
and a wrong token counts toward the per-peer rate limit.

## Backup and restore

A backup is a plain directory snapshot of the daemon's state —
`storage.json`, `oracle.db` (copied through SQLite's online backup API, so
the file is consistent even if a crash left an uncheckpointed WAL), and
`blobs/` — plus a `manifest.json` with sha256 checksums. Config
(`daemon.json`) and logs are not state and stay out of the snapshot.

```sh
ohd stop
ohd backup ~/backups/oh-2026-07-10     # defaults to ./openheaders-daemon-backup-<timestamp>
ohd start

ohd restore ~/backups/oh-2026-07-10    # verifies every checksum first
ohd restore ~/backups/oh-2026-07-10 --force   # replace existing state
```

Both commands require the daemon to be stopped — a snapshot copied under a
live daemon would tear across the three stores. Restore verifies the
manifest before touching anything, refuses over existing state without
`--force`, and replaces state wholesale (stale WAL sidecars and leftover
blobs are dropped — a restore is a rewind, not a merge).

## Logs

One line per event: `<ISO timestamp> <LEVEL> [scope] message`. Authentication
rejections include the peer address and reason on a single line, so log
scanners can match them directly.

## License

Apache License 2.0 — see `LICENSE` at the repository root. Official
binaries are distributed under the End User License Agreement
(`legal/EULA.md`); paid plans only add team seats above the free tier.
