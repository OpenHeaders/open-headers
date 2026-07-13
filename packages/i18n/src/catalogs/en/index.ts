/**
 * English — the source catalog. Every other locale translates exactly
 * this key set (enforced by the catalog-parity test), and `MessageKey`
 * derives from it so a typo'd key is a compile error at every `t()`
 * call site.
 */

import type { Catalog } from '../../types';
import { popup } from './popup';
import { shared } from './shared';
import { workbench } from './workbench';
import { workbenchEditors } from './workbench-editors';
import { workbenchSettings } from './workbench-settings';

export const en = {
  ...shared,
  ...popup,
  ...workbench,
  ...workbenchEditors,
  ...workbenchSettings,
} as const satisfies Catalog;

export type MessageKey = keyof typeof en;
