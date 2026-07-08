/**
 * Boot-time wiring: register the console logger from
 * `@openheaders/core/utils` as the global host-logger implementation.
 * The web tab logs to its own DevTools console — no platform sink of
 * its own; same contract as every other host's install module.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { logger } from '@openheaders/core/utils';

setHostLogger(logger);
