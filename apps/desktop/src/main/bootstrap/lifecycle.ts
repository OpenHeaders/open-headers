/**
 * App open/quit lifecycle — the single owner of quit.
 *
 * The app is tray-resident and historically had three independent
 * `before-quit` listeners (quitting flag, pty drain, engine-dispose
 * hold), each preventDefault-ing and re-quitting on its own schedule.
 * The final re-quit depended on every window cooperatively closing —
 * which a window mid-initial-load never completes — so a quit racing
 * the renderer's first load silently died and left a zombie: window
 * alive, engine dead, until a failsafe force-exited it.
 *
 * One state machine replaces that choreography:
 *
 *   booting → running                      (open side)
 *   any     → tearing-down → exiting       (quit side)
 *
 * Rules:
 *   - Internal quit paths (tray Quit, relaunch, updater install) call
 *     `requestQuit`; nothing else touches `app.quit()`. The single
 *     `before-quit` listener catches external quits (Cmd+Q, OS logout)
 *     and routes them into the same teardown. Requests while already
 *     tearing down are absorbed.
 *   - Teardown destroys every BrowserWindow FIRST — `win.destroy()`
 *     bypasses close-intercepts, beforeunload, and the mid-load close
 *     swallow. The renderer is a mirror; main owns all state, so
 *     nothing is lost.
 *   - A started engine boot is awaited before participants run, so a
 *     half-booted spine is never disposed and one that finishes
 *     booting mid-quit still gets its teardown.
 *   - Registered teardown participants (engine dispose, pty drain)
 *     run in parallel, each bounded by its own deadline, each staged
 *     in the log.
 *   - `exiting` runs the request's finisher — default `app.quit()`,
 *     which now completes deterministically (no windows, no holds)
 *     and still emits `will-quit`/`quit`, keeping the updater's
 *     install-on-quit leg intact.
 *
 * Last-resort rails, logged and never hit on the happy path: a global
 * teardown watchdog and a post-finisher grace, both `app.exit(0)` — a
 * tray-resident app must never wedge un-quittable.
 */

import { app, BrowserWindow } from 'electron';
import { createLogger } from './logger';

const logger = createLogger('lifecycle');

/** Upper bound on waiting for an in-flight engine boot to settle. */
const BOOT_SETTLE_DEADLINE_MS = 15_000;

/** Global ceiling on the whole teardown before force-exit. */
const TEARDOWN_WATCHDOG_MS = 20_000;

/** Grace for the finisher's exit to complete before force-exit. */
const EXIT_GRACE_MS = 2_000;

export type LifecyclePhase = 'booting' | 'running' | 'tearing-down' | 'exiting';

export interface QuitRequest {
  /** Log-trail label: 'tray-quit', 'external-quit', 'relaunch', … */
  reason: string;
  /** Exit finisher once teardown completes; defaults to `app.quit()`. */
  finish?: () => void;
}

interface TeardownParticipant {
  name: string;
  deadlineMs: number;
  run: () => void | Promise<void>;
}

let phase: LifecyclePhase = 'booting';
let participants: TeardownParticipant[] = [];
let engineBootStarted = false;
let engineBootSettled: Promise<void> = Promise.resolve();

export function lifecyclePhase(): LifecyclePhase {
  return phase;
}

export function isQuitting(): boolean {
  return phase === 'tearing-down' || phase === 'exiting';
}

/**
 * Add an async teardown step to run when quit commits. Participants
 * run in parallel; one overrunning its deadline is logged and skipped
 * past, never blocking the others or the exit.
 */
export function registerTeardown(name: string, deadlineMs: number, run: () => void | Promise<void>): void {
  participants.push({ name, deadlineMs, run });
}

/**
 * Hand the machine the engine-boot promise. Teardown serializes on it:
 * a quit requested during `booting` waits (bounded) for the boot to
 * settle, so participants registered by the boot are always seen.
 */
export function trackEngineBoot(boot: Promise<unknown>): void {
  engineBootStarted = true;
  engineBootSettled = boot.then(
    () => {
      if (phase === 'booting') phase = 'running';
    },
    () => {
      if (phase === 'booting') phase = 'running';
    },
  );
}

/** Install the single `before-quit` owner. Call once, before whenReady. */
export function installAppLifecycle(): void {
  app.on('before-quit', (event) => {
    if (phase === 'exiting') return;
    event.preventDefault();
    if (phase === 'tearing-down') return;
    beginTeardown({ reason: 'external-quit' });
  });
}

/** The one entry point every internal quit path goes through. */
export function requestQuit(request: QuitRequest): void {
  if (isQuitting()) return;
  beginTeardown(request);
}

function beginTeardown(request: QuitRequest): void {
  phase = 'tearing-down';
  logger.info(`quit requested (${request.reason}); tearing down`);

  const watchdog = setTimeout(() => {
    logger.warn(`teardown watchdog hit after ${TEARDOWN_WATCHDOG_MS}ms; force exit`);
    app.exit(0);
  }, TEARDOWN_WATCHDOG_MS);
  watchdog.unref();

  // Renderers go first: destroy() bypasses the hide-on-close intercept,
  // beforeunload, and Chromium's deferred close on a still-loading
  // window — the race class that used to swallow quits. Downstream
  // teardown (lifeline ports, per-renderer ptys) rides the ordinary
  // `webContents` destroyed events.
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.destroy();
  }

  void (async () => {
    if (engineBootStarted) {
      await Promise.race([engineBootSettled, delay(BOOT_SETTLE_DEADLINE_MS)]);
    }
    await Promise.all(participants.map((participant) => runParticipant(participant)));
    clearTimeout(watchdog);
    phase = 'exiting';
    logger.info(`teardown complete; exiting (${request.reason})`);
    (request.finish ?? (() => app.quit()))();
    setTimeout(() => {
      logger.warn('exit did not complete after teardown; force exit');
      app.exit(0);
    }, EXIT_GRACE_MS).unref();
  })();
}

async function runParticipant({ name, deadlineMs, run }: TeardownParticipant): Promise<void> {
  let timer: NodeJS.Timeout | null = null;
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), deadlineMs);
    timer.unref();
  });
  try {
    const outcome = await Promise.race([
      Promise.resolve()
        .then(run)
        .then(() => 'done' as const),
      deadline,
    ]);
    if (outcome === 'timeout') {
      logger.warn(`teardown '${name}' missed its ${deadlineMs}ms deadline; continuing`);
    } else {
      logger.info(`teardown '${name}' complete`);
    }
  } catch (err) {
    logger.warn(`teardown '${name}' failed`, err);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

/** Test seam: reset module state between unit-test runs. */
export function resetLifecycleForTests(): void {
  phase = 'booting';
  participants = [];
  engineBootStarted = false;
  engineBootSettled = Promise.resolve();
}
