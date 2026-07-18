/**
 * TUI translation surface — the shared catalog architecture's `tui.*`
 * namespace (TUI_DESIGN.md §6.3), compiled into the binary. v1 ships
 * English only; locale resolution still reads the environment
 * (LC_ALL → LC_MESSAGES → LANG, terminal convention) so locale waves
 * reach the TUI without touching call sites. Keys are typed against
 * the namespace object — a typo'd key is a compile error.
 */

import { tui } from '@openheaders/i18n/catalogs/en/tui';
import { createTranslator } from '@openheaders/i18n/runtime';
import type { MessageArgs } from '@openheaders/i18n/types';
import type { EnvLike } from './capability';

export type TuiMessageKey = keyof typeof tui;

export interface TuiTranslator {
  (key: TuiMessageKey, args?: MessageArgs): string;
  readonly locale: string;
}

/** POSIX message-locale precedence; an empty value counts as unset. */
export function resolveTuiLocale(env: EnvLike): string {
  const raw = env.LC_ALL || env.LC_MESSAGES || env.LANG || 'en';
  const base = raw.split(/[._@-]/, 1)[0].toLowerCase();
  return base === '' ? 'en' : base;
}

export function createTuiTranslator(env: EnvLike): TuiTranslator {
  // English is the only tui catalog in v1 — every locale renders it,
  // via the translator's per-key fallback, until locale waves land.
  const translator = createTranslator(resolveTuiLocale(env), tui, tui);
  return translator as TuiTranslator;
}
