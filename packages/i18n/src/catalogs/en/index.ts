/**
 * English — the source catalog. Every other locale translates exactly
 * this key set (enforced by the catalog-parity test), and `MessageKey`
 * derives from it so a typo'd key is a compile error at every `t()`
 * call site.
 */

import type { Catalog } from '../../types';
import { panel } from './panel';
import { popup } from './popup';
import { shared } from './shared';
import { sharedAwareness } from './shared-awareness';
import { sharedComponents } from './shared-components';
import { sharedConflicts } from './shared-conflicts';
import { sharedInfoCookies } from './shared-info-cookies';
import { sharedInfoHeaders } from './shared-info-headers';
import { sharedInfoStatus } from './shared-info-status';
import { sharedMergeEditor } from './shared-merge-editor';
import { sharedNotifications } from './shared-notifications';
import { sharedResolutionHints } from './shared-resolution-hints';
import { sharedWorkspace } from './shared-workspace';
import { workbench } from './workbench';
import { workbenchChrome } from './workbench-chrome';
import { workbenchDocs } from './workbench-docs';
import { workbenchEditors } from './workbench-editors';
import { workbenchLive } from './workbench-live';
import { workbenchSettings } from './workbench-settings';
import { workbenchVariables } from './workbench-variables';

export const en = {
  ...shared,
  ...sharedAwareness,
  ...sharedComponents,
  ...sharedConflicts,
  ...sharedInfoCookies,
  ...sharedInfoHeaders,
  ...sharedInfoStatus,
  ...sharedMergeEditor,
  ...sharedNotifications,
  ...sharedResolutionHints,
  ...sharedWorkspace,
  ...panel,
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
