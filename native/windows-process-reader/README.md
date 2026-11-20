# Windows Process Reader

What a process costs, and what runs beneath one the app started, read from the system with no process started for the read. The Windows half of the app's in-house process reader; the macOS half is `native/process-reader`, and Linux needs no addon (it reads `/proc` in plain JS).

## What it reads — and what it never reads

For one process: when it started, its CPU time, its memory (the working set and, where this Windows counts it, the private working set — the figure the system's own monitor shows) and the **base name** of its executable.

A process is opened with the limited query right and nothing more — never the right to read its memory. It never reads a command line or an environment, and an executable's path never leaves the native code — only its last part.

A pid no live process holds reads `null`; so does a process the system refuses even the limited query for.

The private working set comes from the newer, larger memory counters (Windows 10 22H2 and Windows 11 22H2, each with the September 2023 update, or later). On an older Windows it reads `null` and the working set is the only memory figure.

## What runs beneath a process — a job that watches

Windows has no call for a process's children short of listing the machine, and keeps no count of the time its exited children used. So the app closes a **job object** around each process it starts: the job's member list is what runs beneath that process (one whose starter has exited among them), and its accounting is the CPU time of everything that has run in it, what has ended included.

The job watches and never rules. Its one limit lets a program that asks to leave the job go, as it would in any other terminal; it is never kill-on-close, so closing it ends nothing. Putting a process in a job asks the system for the two rights that call needs (set-quota and terminate) and uses neither for anything else.

What a process had started before the job closed around it is not in the job. The documented snapshot of the process table (pid, parent pid, base name — no process opened) finds it once, at that moment; it is never taken on a beat.

## Installing

Vendored into the monorepo as a local package. It is Windows-only (`os: ["win32"]`); on other platforms the install is skipped. On Windows `pnpm install` compiles it from source via `node-gyp-build` — you need the standard `node-gyp` toolchain (Python + Visual Studio Build Tools with the "Desktop development with C++" workload and the Spectre-mitigated libraries). It is written against the stable native API, so one build serves Electron and plain Node alike.

## API

```javascript
const binding = require('@openheaders/windows-process-reader').load(); // null off Windows, or with no build

binding.read(pid); // { createdFileTime, cpuTime, workingSetBytes, privateWorkingSetBytes, executableName }
                   //   | null when no live process holds the pid, or the system refuses the read

binding.snapshot(); // [{ pid, parentPid, name }] — every process on the machine

const job = binding.createJob(); // a job | null
binding.assignToJob(job, pid);   // true once the process is in it — what it starts from then on is in it too
binding.jobPids(job);            // the pids alive in it | null
binding.jobCpuTime(job);         // 100 ns units, ended processes included | null
binding.closeJob(job);           // ends nothing
```

`createdFileTime` is the system's file time as a `bigint` (100 ns units since 1601-01-01 UTC) and `cpuTime` is in 100 ns units; the conversions are the caller's, where they are pinned.

## Developing

```sh
node-gyp rebuild
npm test
```

## License

Apache-2.0 (see the repository root [LICENSE](../../LICENSE)).
