/**
 * Console level-filter model — the browser's "Default levels ▾" menu as a
 * pure derivation. Four independent level switches (Verbose / Info /
 * Warnings / Errors) replace the old severity-threshold pills; the trigger
 * label collapses the mask exactly the way the browser does: all four on →
 * "All levels", the default mask (Verbose off) → "Default levels", exactly
 * one on → "{Level} only", none → "Hide all", anything else → "Custom
 * levels" — and the trigger warns whenever the mask is neither all nor
 * default (the "you're filtering" cue).
 *
 * Wire-level mapping: Verbose ⇐ `debug`, Info ⇐ `log` + `info`,
 * Warnings ⇐ `warning`, Errors ⇐ `error`.
 */

import type { ConsoleLevel } from '@openheaders/core/console-stream';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

export interface ConsoleLevelsMask {
  readonly verbose: boolean;
  readonly info: boolean;
  readonly warnings: boolean;
  readonly errors: boolean;
}

export type ConsoleLevelKey = keyof ConsoleLevelsMask;

export const ALL_LEVELS: ConsoleLevelsMask = { verbose: true, info: true, warnings: true, errors: true };
export const DEFAULT_LEVELS: ConsoleLevelsMask = { verbose: false, info: true, warnings: true, errors: true };

/** Menu rows in the browser's order. */
export const LEVEL_MENU_ITEMS: ReadonlyArray<{ key: ConsoleLevelKey; labelKey: MessageKey }> = [
  { key: 'verbose', labelKey: 'panel.console.levels.verbose' },
  { key: 'info', labelKey: 'panel.console.levels.info' },
  { key: 'warnings', labelKey: 'panel.console.levels.warnings' },
  { key: 'errors', labelKey: 'panel.console.levels.errors' },
];

export function isAllLevels(mask: ConsoleLevelsMask): boolean {
  return LEVEL_MENU_ITEMS.every(({ key }) => mask[key]);
}

export function isDefaultLevels(mask: ConsoleLevelsMask): boolean {
  return LEVEL_MENU_ITEMS.every(({ key }) => mask[key] === DEFAULT_LEVELS[key]);
}

/** The trigger label for the current mask. */
export function levelMenuLabel(t: Translate, mask: ConsoleLevelsMask): string {
  if (isAllLevels(mask)) return t('panel.console.levels.all');
  if (isDefaultLevels(mask)) return t('panel.console.levels.defaultLevels');
  const on = LEVEL_MENU_ITEMS.filter(({ key }) => mask[key]);
  if (on.length === 0) return t('panel.console.levels.hideAll');
  if (on.length === 1) return t('panel.console.levels.only', { level: t(on[0].labelKey) });
  return t('panel.console.levels.custom');
}

/** The trigger warns when the mask is neither all nor default. */
export function isCustomLevels(mask: ConsoleLevelsMask): boolean {
  return !isAllLevels(mask) && !isDefaultLevels(mask);
}

export function passesLevelMask(level: ConsoleLevel, mask: ConsoleLevelsMask): boolean {
  switch (level) {
    case 'debug':
      return mask.verbose;
    case 'log':
    case 'info':
      return mask.info;
    case 'warning':
      return mask.warnings;
    case 'error':
      return mask.errors;
  }
}
