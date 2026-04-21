/**
 * Non-React settings bootstrap.
 *
 * The settings store is a plain module — it works in every extension
 * context (background service worker, workbench renderer, popup renderer).
 * This file is the one entry point that imports the schema barrel and
 * kicks off store init, plus wires non-React consumers (the logger).
 *
 * The SettingsProvider in the renderer contexts also invokes this so
 * that every context — React or not — converges on the same store.
 */

import { isValidLogLevel, logger } from './logger';
import '@/workbench/settings/schema';
import { get as getSetting, initSettingsStore, subscribeKey } from '@/workbench/settings/store';

let bootstrapPromise: Promise<void> | null = null;
let loggerWired = false;

export function bootstrapSettings(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    await initSettingsStore();
    wireLoggerToSettings();
  })();
  return bootstrapPromise;
}

function wireLoggerToSettings(): void {
  if (loggerWired) return;
  loggerWired = true;

  const apply = (): void => {
    try {
      const level = getSetting('data.logLevel');
      if (isValidLogLevel(level)) logger.setLevel(level);
    } catch {
      // Setting not registered yet — the schema barrel import above
      // should prevent this, but stay defensive.
    }
  };

  apply();
  subscribeKey('data.logLevel', apply);
}
