/**
 * English — the source catalog. Every other locale translates exactly
 * this key set (enforced by the catalog-parity test), and `MessageKey`
 * derives from it so a typo'd key is a compile error at every `t()`
 * call site.
 */

import type { Catalog } from '../../types';
import { popup } from './popup';
import { shared } from './shared';
import { sharedComponents } from './shared-components';
import { workbench } from './workbench';
import { workbenchChrome } from './workbench-chrome';
import { workbenchDocs } from './workbench-docs';
import { workbenchEditors } from './workbench-editors';
import { workbenchLive } from './workbench-live';
import { workbenchSettings } from './workbench-settings';
import { workbenchVariables } from './workbench-variables';

export const en = {
  ...shared,
  ...sharedComponents,
  ...popup,
  ...workbench,
  ...workbenchChrome,
  ...workbenchDocs,
  ...workbenchEditors,
  ...workbenchLive,
  ...workbenchSettings,
  ...workbenchVariables,
} as const satisfies Catalog;

export type MessageKey = keyof typeof en;
