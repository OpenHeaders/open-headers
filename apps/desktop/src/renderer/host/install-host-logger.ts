/**
 * Boot-time wiring: register the console logger from
 * `@openheaders/core/utils` as the global host-logger implementation.
 *
 * Same shape as the browser-extension install module — the core console
 * logger has no platform coupling of its own, so it doubles as the
 * default adapter. A file-backed sink (electron-log) can replace it
 * later without touching any consumer of `hostLogger`.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { logger } from '@openheaders/core/utils';

setHostLogger(logger);
