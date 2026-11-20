# Process Reader

What a process costs and what runs beneath it, read from the system's own process table with no process started for the read. The macOS half of the app's in-house process reader; Linux needs no addon (it reads `/proc` in plain JS), and the Windows half is not written yet.

## What it reads — and what it never reads

For one process: its parent, when it started, its controlling terminal, the **base name** of its executable, its CPU time (its own, and that of its children that exited) and its memory (footprint and resident size). For a pid: the pids of its children. For a terminal: the pids on it.

It never reads a command line or an environment, and an executable's path never leaves the native code — only its last part.

A process of another user is still listed, with its parent, its start and its name; its cost is refused by the kernel and comes back as `null`.

## Installing

Vendored into the monorepo as a local package. It is macOS-only (`os: ["darwin"]`); on other platforms the install is skipped. On macOS `pnpm install` compiles it from source via `node-gyp-build` — you need the Xcode command line tools (the standard `node-gyp` toolchain). It is written against the stable native API, so one build serves Electron and plain Node alike.

## API

```javascript
const binding = require('@openheaders/process-reader').load(); // null off macOS, or with no build

binding.timebase();            // { numer, denom } — a count of kernel time units × numer / denom is nanoseconds
binding.info(pid);             // { parentPid, startedAtMs, executableName, terminal } | null when no process holds the pid
binding.usage(pid);            // { userTime, systemTime, exitedChildrenUserTime, exitedChildrenSystemTime,
                               //   footprintBytes, residentBytes } | null when the kernel refuses
binding.childPids(pid);        // number[]
binding.terminalPids(terminal); // number[] — by the terminal's device number, as `info` gives it
```

Times are in the kernel's own units; the conversion to seconds is the caller's, where it is pinned.

## Developing

```sh
node-gyp rebuild   # always `rebuild`: a binary rewritten in place after a runtime has mapped it is killed by the kernel
npm test
```

## License

Apache-2.0 (see the repository root [LICENSE](../../LICENSE)).
