# Windows Package Update

A Windows package's own update, asked of Windows' package manager — with the percentage Windows reports heard on the way. The app installed as a Windows package (MSIX) updates through it.

## Why an addon

Windows updates a package itself: the app only tells it where the newer one is. The runtime's own package updater makes that ask too, but tells nobody how far the fetch is, and installs only what it staged itself. This addon makes the same two asks and hears Windows' progress.

## The two asks — and nothing else

**Stage.** The package at a link is added for this user, its registration left for later while the package is in use. Windows fetches what differs from the installed version and reports a whole-numbered percentage, 0 to 100, on the way. That figure is Windows' own: it moves in bursts with still stretches between, it does not follow the bytes, and Windows gives no byte count. It is handed on as it comes.

**Register.** The staged version of the package *this process runs in* is registered, and Windows starts the app again afterwards — after an update only, not after a crash, a hang or a restart of the machine. Windows closes the package's processes for it, so the app asks this last and ends itself.

The package's family name is read from the process's own identity and is never an argument: the addon registers the package it runs in, or nothing. It adds no other package option, removes nothing and cancels nothing — an operation asked of Windows is Windows' own to finish.

A refusal is told in Windows' own words: the operation's code, then the text of its result (`0x80073CF9 …`).

## Threads

Windows is asked on a thread of the addon's own, so the caller's thread is never held and nothing rests on how its host set that thread up. What Windows reports crosses to the script's thread through a thread-safe function.

## Installing

Vendored into the monorepo as a local package. It is Windows-only (`os: ["win32"]`); on other platforms the install is skipped. On Windows `pnpm install` compiles it from source via `node-gyp-build` — you need the standard `node-gyp` toolchain (Python + Visual Studio Build Tools with the "Desktop development with C++" workload and the Spectre-mitigated libraries) and a Windows SDK from 10.0.19041 on. It is written against the stable native API, so one build serves Electron and plain Node alike.

Adding a package from a link needs Windows 10, version 2004 (build 19041) or later; on an older Windows the stage is refused with words that say so.

## API

```javascript
const binding = require('@openheaders/windows-package-update').load(); // null off Windows, or with no build

await binding.stage('https://…/OpenHeaders-2026.11.3-x64.msix', (percent) => {
  // 0 to 100, as Windows reports it
});

await binding.register(); // rejects at once in a process with no package identity
```

Both hand back a promise that settles when Windows' operation is over: resolved when Windows completed it, rejected with Windows' words when it did not. In the app `register()` is never heard to resolve — the process is gone by then.

## Developing

```sh
node-gyp rebuild
npm test
```

The test asks Windows for nothing it would do: every ask in it is one that is turned down. Run it from outside a package.

## License

Apache-2.0 (see the repository root [LICENSE](../../LICENSE)).
