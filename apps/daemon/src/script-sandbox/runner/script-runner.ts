/**
 * Safe-mode script runner — the daemon's isolated script process,
 * forked by `fork-transport.ts` under Node's permission model
 * (`--permission`: filesystem, child processes, worker threads and
 * native addons all refuse with ERR_ACCESS_DENIED) with a scrubbed
 * environment. Built as its own SELF-CONTAINED entry
 * (`dist/script-runner.js`, `vite.config.runner.ts`) so the permission
 * grant covers exactly one file and no shared chunk can drag
 * `better-sqlite3` (a denied native addon) into this process.
 *
 * Everything matches the desktop runtimes exactly: the same shared
 * runtime loop and runner core, the same envelopes (here riding the
 * fork IPC channel — `process.on('message')` receives the data
 * directly and `process.send` posts up), and every side-effecting
 * `oh.*` call crossing to the daemon's broker — the workspace-state
 * posture does not relax with the transport. No `scopeExtras`: Safe
 * mode's scope is `oh` + `console`, nothing else.
 */

import { createScriptRuntime } from '@openheaders/core/scripts/runtime';

const runtime = createScriptRuntime((message) => {
  process.send?.(message);
});

process.on('message', (data: unknown) => {
  runtime.handleMessage(data);
});

// A dropped IPC channel means the daemon is gone — exit instead of
// lingering as an orphan the idle close can no longer reach.
process.on('disconnect', () => {
  process.exit(0);
});

// Signal readiness so the broker can fan execute requests in.
runtime.announceReady();
