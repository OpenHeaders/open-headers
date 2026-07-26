<!--
  What's New notes shown by the desktop workbench's What's New tab.
  Authored by hand before tagging a release (like
  .github/release-severity.json) and BUNDLED into the renderer at build
  time via a raw import — never fetched at runtime
  (docs/UPDATES_PLAN.md). Write for end users: highlights, not a
  commit log. The tab prepends the running version as its title, so
  start straight with sections.
-->

## Hand off from your browser

- **Open in the desktop app** — desktop-only features in the browser
  extension (terminal, git history, traffic monitor, MCP) now offer a
  one-click handoff when the desktop app is connected: the app comes
  forward with that feature already open. Only a browser on the same
  machine, paired with this app, can do this.

## Terminal

- **Split panes** — split the integrated terminal side-by-side or
  stacked, the same way you split editor tabs.
- **Fresh CLI installs work immediately** — the TUI tab and the CLI
  probe now find a just-installed `oh` binary without restarting the
  app, on Windows, macOS, and Linux. When the CLI is missing, a dialog
  shows the exact install command instead of failing quietly.

## Updates

- **Visible install progress on Windows** — clicking Update & Restart
  with the window open now shows the installer's progress instead of a
  silent wait; tray-hidden updates stay silent as before.

## Teams

- **Six free seats** — the free tier now includes 6 seats on a shared
  server, up from 3.
- **Clearer naming** — the machine that hosts shared workspaces is now
  called the server (OpenHeaders Server) everywhere; Team and
  Enterprise are the names of plans, not software.
