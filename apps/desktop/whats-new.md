<!--
  What's New notes shown by the desktop workbench's What's New tab.
  Authored by hand before tagging a release (like
  .github/release-severity.json) and BUNDLED into the renderer at build
  time via a raw import — never fetched at runtime
  (docs/UPDATES_PLAN.md). Write for end users: highlights, not a
  commit log. The tab prepends the running version as its title, so
  start straight with sections.
-->

## New ways to install

- **Standalone CLI and daemon binaries** — `oh` and `ohd` now ship as
  single-file executables for macOS, Linux, and Windows. No Node.js
  required.
- **One-line install scripts** — `install-oh.sh` (macOS/Linux) and
  `install-oh.ps1` (Windows) download the right binary, verify its
  checksum, and put it on your PATH.
- **Docker image for the daemon** — `docker run ghcr.io/openheaders/ohd`
  starts a ready-to-pair daemon with a persistent `/data` volume.
- **Managed deployment packages** — MSI (Windows) and PKG (macOS)
  installers for MDM / GPO rollouts join the existing installers.

## Updates, on your terms

- The desktop app now checks for updates once a day and shows a quiet
  notification when one is available. Nothing downloads or installs
  without your explicit click — ever.
- Releases carry a published severity: when a security fix applies to
  the version you are running, the app says so clearly instead of
  quietly.
- A new **"Security fixes only"** update tier keeps notifications
  silent unless a release fixes a security issue that affects you.
- This What's New tab — release highlights bundled with the app, shown
  once per feature release. Turn it off in Settings → About.
