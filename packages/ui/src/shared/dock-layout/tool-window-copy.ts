/**
 * Copy resolution for the dock-layout registries. Tool-window defs are
 * raw-or-key (see `ToolWindowDef`), so every render site funnels
 * through these resolvers instead of reading `def.label` directly.
 * Dock-slot display names resolve through `DOCK_LABEL_KEYS`; the raw
 * `DOCK_LABELS` record in `constants.ts` stays exported for the
 * unconverted devtools-panel registry.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { DockSlot, ToolWindowDef } from './types';

export const DOCK_LABEL_KEYS: Record<DockSlot, MessageKey> = {
  'left-top': 'shared.dock.slot.leftTop',
  'left-bottom': 'shared.dock.slot.leftBottom',
  'right-top': 'shared.dock.slot.rightTop',
  'right-bottom': 'shared.dock.slot.rightBottom',
  'bottom-left': 'shared.dock.slot.bottomLeft',
  'bottom-right': 'shared.dock.slot.bottomRight',
};

/** Display label for a tool window — keyed defs translate, raw defs pass through. */
export function resolveToolWindowLabel<T extends string>(def: ToolWindowDef<T>, t: Translate): string {
  return def.labelKey ? t(def.labelKey) : (def.label ?? '');
}

/** Hover copy for a tool window tab — explicit tooltip wins, label otherwise. */
export function resolveToolWindowTooltip<T extends string>(def: ToolWindowDef<T>, t: Translate): string {
  if (def.tooltipKey) return t(def.tooltipKey);
  if (def.tooltip) return def.tooltip;
  return resolveToolWindowLabel(def, t);
}
