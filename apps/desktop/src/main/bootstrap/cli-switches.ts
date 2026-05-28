/**
 * Chromium command-line switches applied before `app` is ready.
 *
 * `--use-system-ca-store` tells Chromium's network stack to consult the
 * OS trust store (macOS Keychain / Windows certificate store / Linux
 * NSS via `update-ca-certificates`) for trust decisions, on top of
 * Chromium's built-in root store. Corp environments often install
 * custom root CAs in the OS store for MITM-style outbound proxies;
 * without this switch every outbound request from the app (auto-updater,
 * sync, telemetry) fails cert validation behind such proxies.
 *
 * Must run before `app` finishes initializing — Chromium reads these
 * switches once at network-stack construction. We call this first in
 * `main.ts`, ahead of even the logger, because nothing here can throw
 * usefully into a log file anyway.
 */

import { app } from 'electron';

export function installChromiumSwitches(): void {
  app.commandLine.appendSwitch('use-system-ca-store');
}
