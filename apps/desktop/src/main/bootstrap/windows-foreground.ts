/**
 * Guarded loader for `@openheaders/windows-foreground` — the native
 * SetForegroundWindow helper (mocked keystroke +
 * AllowSetForegroundWindow + SetForegroundWindow, with a taskbar-flash
 * fallback inside the module itself). Windows-only by construction:
 * pnpm materializes the package only on win32, so a static import
 * would fail module resolution on every other platform. This adapter
 * owns the single platform-guarded require; callers import it
 * statically and it no-ops everywhere the native module can't exist.
 */

import { createRequire } from 'node:module';

type WindowsForegroundModule = {
  forceForegroundWindow(pid: number): boolean;
};

/** `undefined` = not yet attempted; `null` = attempted and unavailable. */
let cached: WindowsForegroundModule | null | undefined;

export function forceForegroundWindow(pid: number): boolean {
  if (process.platform !== 'win32') return false;
  if (cached === undefined) {
    try {
      cached = createRequire(__filename)('@openheaders/windows-foreground') as WindowsForegroundModule;
    } catch {
      cached = null;
    }
  }
  return cached ? cached.forceForegroundWindow(pid) : false;
}
