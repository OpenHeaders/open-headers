/**
 * Copy resolution for the dock-layout registries. Tool-window defs are
 * raw-or-key (see `ToolWindowDef`), so every render site funnels
 * through these resolvers instead of reading `def.label` directly.
 * Dock-slot display names resolve through `DOCK_LABEL_KEYS`.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { BottomPanelSplit, DockSlot, ToolWindowDef } from './types';

export const DOCK_LABEL_KEYS: Record<DockSlot, MessageKey> = {
  'left-top': 'shared.dock.slot.leftTop',
  'left-bottom': 'shared.dock.slot.leftBottom',
  'right-top': 'shared.dock.slot.rightTop',
  'right-bottom': 'shared.dock.slot.rightBottom',
  'bottom-left': 'shared.dock.slot.bottomLeft',
  'bottom-right': 'shared.dock.slot.bottomRight',
};

/**
 * Split-aware slot label — in stacked (`rows`) mode the bottom docks
 * read "Bottom Top" / "Bottom Bottom" instead of left/right, matching
 * where they actually render.
 */
export function dockSlotLabelKey(slot: DockSlot, bottomSplit: BottomPanelSplit = 'columns'): MessageKey {
  if (bottomSplit === 'rows') {
    if (slot === 'bottom-left') return 'shared.dock.slot.bottomTop';
    if (slot === 'bottom-right') return 'shared.dock.slot.bottomBottom';
  }
  return DOCK_LABEL_KEYS[slot];
}

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
