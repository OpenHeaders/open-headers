# Windows Process Reader

What a process costs, read from the system by its pid with no process started for the read. The Windows half of the app's in-house process reader; the macOS half is `native/process-reader`, and Linux needs no addon (it reads `/proc` in plain JS).

## What it reads — and what it never reads

For one process: when it started, its CPU time, its memory (the working set and, where this Windows counts it, the private working set — the figure the system's own monitor shows) and the **base name** of its executable.

A process is opened with the limited query right and nothing more — never the right to read its memory. It never reads a command line or an environment, and an executable's path never leaves the native code — only its last part.

A pid no live process holds reads `null`; so does a process the system refuses even the limited query for.

The private working set comes from the newer, larger memory counters (Windows 10 22H2 and Windows 11 22H2, each with the September 2023 update, or later). On an older Windows it reads `null` and the working set is the only memory figure.

## Installing

Vendored into the monorepo as a local package. It is Windows-only (`os: ["win32"]`); on other platforms the install is skipped. On Windows `pnpm install` compiles it from source via `node-gyp-build` — you need the standard `node-gyp` toolchain (Python + Visual Studio Build Tools with the "Desktop development with C++" workload and the Spectre-mitigated libraries). It is written against the stable native API, so one build serves Electron and plain Node alike.

## API

```javascript
const binding = require('@openheaders/windows-process-reader').load(); // null off Windows, or with no build

binding.read(pid); // { createdFileTime, cpuTime, workingSetBytes, privateWorkingSetBytes, executableName }
                   //   | null when no live process holds the pid, or the system refuses the read
```

`createdFileTime` is the system's file time as a `bigint` (100 ns units since 1601-01-01 UTC) and `cpuTime` is in 100 ns units; the conversions are the caller's, where they are pinned.

## Developing

```sh
node-gyp rebuild
npm test
```

## License

Apache-2.0 (see the repository root [LICENSE](../../LICENSE)).
