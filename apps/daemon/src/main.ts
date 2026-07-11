/**
 * Standalone daemon entry point — the plain-Node distribution's
 * service units exec this file directly (`node dist/main.js`). The
 * boot itself lives in `daemon-run.ts`, shared with `ohd run`.
 */

import { runDaemon } from './daemon-run';

void runDaemon(process.argv.slice(2));
