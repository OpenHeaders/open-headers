# OpenHeaders-Installer

The file a person downloads to install OpenHeaders on Windows:
`OpenHeaders-Installer-x64.exe` and `OpenHeaders-Installer-arm64.exe`. A
small native program in front of the Windows package (MSIX). It

1. checks that this PC takes the package — Windows 10 2004 or later,
   not in S mode, no policy against app packages;
2. opens the app and ends when the package is installed already (the
   app updates itself);
3. reads the channel's package pointer
   (`desktop/<channel>/windows-package.json` on the update feed) and
   picks the package of the PC's own arch — and installs nothing where
   the pointer's `stop` is set: a release held back from the app's
   updates is held back from a first install too;
4. downloads it with a percentage, through Windows' own network stack
   — the system's proxy and certificates — asking only for the rest
   when a try breaks;
5. holds it to the pointer's SHA-256, to a signature Windows trusts,
   and to its own signer;
6. hands the file to Windows' package manager to install for this
   user, without elevation;
7. opens the app;
8. takes its download away, and ends. Windows' antivirus can hold that
   delete while it scans the package — about a minute and a half where
   it was measured — so this is the last act, after the dialog is gone
   and the app is open; a silent run ends when it is done.

Its channel is the one of the release it was built for: a beta's
installer installs betas.

## The window

A window of its own, with no title bar, moved by its body: the app's
mark, its name as the product writes it ("Open Headers" in the
wordmark face, kept as the face's own dots — no font is carried), one
line — "Downloading Open Headers… 39% (98 of 240
MB)", megabytes as Windows counts them — and a thin bar, which runs
where there is nothing to count. It has no button: Esc, or closing it
from the taskbar, cancels the run for as long as a cancel is taken —
not once Windows has the package. A neutral grey ground, light or dark
as the PC is set, and the person's own colours where they asked for
contrast. When a run stops, Windows' own dialog comes in front of it
with the run's sentence, Try again where another try can end
otherwise, Show log, and Close.

The mark is the desktop's icon picture and the program's icon the
desktop's icon file, both read where they live
(`apps/desktop/build/icon.png`, `icon.ico`).

Every sentence a person reads writes the product's name in two words,
"Open Headers", as the name under the mark does; the file's own name
stays `OpenHeaders-Installer-<arch>.exe`.

## What Windows shows for the file

The program carries a version (`resources.rs`, written by `build.rs`
beside the manifest and the icon): "Open Headers Installer" by BITHUB
TEAM SRL, the release it was built for (`2026.11.3-beta.6`), and that
release as the Windows package's own four numbers (`2026.11.3.6`; a
stable ends in `1000`).

## Switches

| Switch | |
| --- | --- |
| `--silent` | no window; the log and the exit code say how it went |
| `--channel <stable\|beta>` | in place of the build's own channel |
| `--package <file>` | install this package file — nothing is read from the feed; its signature and signer are held as a download's are |
| `--no-launch` | do not open the app afterwards |
| `--log <file>` | write the log there, in place of `%TEMP%\OpenHeaders-Installer.log` |

## Exit codes

| Code | |
| --- | --- |
| 0 | installed, or installed already |
| 1 | unexpected |
| 2 | bad switches |
| 10 | Windows too old |
| 11 | Windows in S mode |
| 12 | a policy blocks app packages |
| 20 | the pointer could not be read, names no package for this PC, or says stop |
| 21 | the download failed |
| 22 | the download's hash is not the pointer's |
| 23 | the package's signature or signer |
| 30 | Windows refused the install |
| 31 | installed, and the app could not be opened |
| 40 | cancelled |

## Layout

What the installer decides runs anywhere and is tested with
`cargo test` on any machine: the switches (`args.rs`), the pointer
(`pointer.rs`), the download's tries (`transfer.rs`), the order of a
run and every way it stops (`flow.rs`), what the window shows for a
run's state and where each part lies (`view.rs`). What it asks of
Windows is in `src/win/` and compiles on Windows targets only: the
window (`window.rs`), how it is drawn (`paint.rs`), the dialog of a
stop (`dialog.rs`).

## Build

Not part of the pnpm/turbo pipeline — cargo is invoked explicitly:

```bash
cargo test                                   # the tests, on any machine
node ../../scripts/build-windows-installer.mjs   # build + stage dist/<target>/ for both arches
```

The crate's version is the release's base and is bumped with the apps'
versions; the build script hands over the whole version from the
desktop's `package.json`.
