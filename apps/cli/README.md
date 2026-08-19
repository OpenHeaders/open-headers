# @openheaders/cli

`oh` — the [Open Headers](https://openheaders.com) command line: headless
scripting and CI integration against the same daemon the desktop app and
browser extension use. List rules, toggle them, switch environments and
workspaces, set variables, send saved requests, run workflows, diff
workspaces — straight from the shell, always in sync with what the UI shows.

## Requirements

- A running Open Headers desktop app (or standalone daemon) with the MCP
  surface enabled — Settings → MCP

## Install

Standalone `oh` binaries (macOS, Linux, Windows) ship with every release
at
[open-headers releases](https://github.com/OpenHeaders/open-headers/releases),
with SHA-256 checksums — no Node.js required. The macOS binary is signed
and notarized; the Windows binary is unsigned, so SmartScreen warns on
first run.

```sh
curl -fsSL https://updates.openheaders.com/install.sh | sh
```

```powershell
irm https://updates.openheaders.com/install.ps1 | iex
```

The script verifies checksums and installs to `~/.local/bin`
(`%LOCALAPPDATA%\OpenHeaders\bin` on Windows); pass `--with-daemon`
(`curl … | sh -s -- --with-daemon`) to also install `ohd`. Installed
binaries keep themselves current between invocations (`oh autoupdate
off` to stop). To build from source instead, see the repository's
[developer guide](../../docs/DEVELOPER.md).

## Quick start

Mint an access token in Open Headers → Settings → MCP, then pair once:

```sh
oh connect --daemon http://127.0.0.1:8137 --token <secret>
```

Later runs need no flags:

```sh
oh status
oh rules list
oh rules toggle <uid> off
oh env switch staging
oh request send login --env staging
oh workflow run health-probe
oh workspace diff <other-workspace>
```

Every command takes `--json` (the tool result's JSON payload, verbatim) and
`--workspace <id>`.

## CI

Skip the config file entirely: set `OH_DAEMON_URL` and `OH_TOKEN` in the
environment (a token minted in Settings → MCP, stored as a CI secret), and
script against `--json` — the payloads are the same stable contract the MCP
tools answer with:

```yaml
- run: oh env switch staging
- run: oh request send smoke-test --json | jq -e '.response.status == 200'
- run: oh workflow run health-probe
  env:
    OH_DAEMON_URL: http://127.0.0.1:8137
    OH_TOKEN: ${{ secrets.OH_TOKEN }}
```

A failed send or run still prints its `--json` payload on stdout before
exiting 1, so pipelines can capture the failure detail. The exit codes below
separate "the operation failed" from "the daemon was never reachable".

## Telemetry

The CLI collects anonymous usage counts (command names and versions — never
your data or targets) and says so once, on first run. Opt out anytime with
`export OH_TELEMETRY=0` or `"telemetry": false` in the config file
(`~/.config/openheaders/cli.json`). The exact wire format is documented in
the repository's [wire-transparency specification](../../docs/WIRE_TRANSPARENCY.md); details:
[openheaders.com/privacy](https://openheaders.com/privacy).

## Shell completions

```sh
# bash — add to ~/.bashrc
source <(oh completion bash)

# zsh — add to ~/.zshrc
source <(oh completion zsh)
```

Completions are generated from the shipped command tables: first word,
verbs per group, and each command's flags.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | operation failed (the daemon answered; the operation itself reports failure) |
| 2 | usage error |
| 3 | daemon unreachable, or its MCP surface is disabled |
| 4 | token rejected, or the tool's tier is disabled on the host |

`oh help` lists every command and option.
