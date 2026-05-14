/**
 * Boot-time wiring: register the console logger from
 * `@openheaders/core/utils` as the global host-logger implementation.
 * Every entry point (background SW, popup, workbench, devtools panel,
 * side panel) imports this module once at startup so any UI code that
 * logs through `@openheaders/core/logger`'s `hostLogger` proxy lands on
 * a real sink.
 *
 * The console logger has no platform coupling of its own, so it doubles
 * as the default adapter — the browser extension installs it as-is.
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module that wires a different sink (a file log, a remote
 * collector) — the contract on the UI side is identical.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { logger } from '@openheaders/core/utils';

setHostLogger(logger);
