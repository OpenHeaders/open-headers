/**
 * dock-move-to-menu — the `Move to ▸` submenu every tool window
 * offers, built once: one entry per dock slot with the slot glyph, a
 * check on the slot the window sits in now, and the region dividers
 * (left | right | bottom). The dock strip's tab context menu and a
 * panel's ⋯ Options menu both read it, so the vocabulary never forks.
 */

import type { ItemType } from 'antd/es/menu/interface';
import type { MessageKey } from '@openheaders/i18n';
import { ALL_DOCK_SLOTS } from './constants';
import DockSlotIcon from './DockSlotIcon';
import { dockSlotLabelKey } from './tool-window-copy';
import type { BottomPanelSplit, DockSlot } from './types';

export interface DockMoveToMenuInput {
  /** The slot the window occupies — rendered with the check. */
  current: DockSlot;
  bottomSplit: BottomPanelSplit;
  onMove: (target: DockSlot) => void;
  t: (key: MessageKey) => string;
}

/** The submenu's children — the caller wraps them in its own parent item. */
export function buildDockMoveToItems({ current, bottomSplit, onMove, t }: DockMoveToMenuInput): ItemType[] {
  return ALL_DOCK_SLOTS.flatMap((target, index) => {
    const entry: ItemType = {
      key: target,
      icon: (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 18 }}>
          <DockSlotIcon slot={target} size={20} bottomSplit={bottomSplit} />
        </span>
      ),
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', width: '100%', lineHeight: '20px' }}>
          <span style={{ flex: 1 }}>{t(dockSlotLabelKey(target, bottomSplit))}</span>
          {target === current && (
            <span style={{ marginLeft: 12, fontSize: 12, opacity: 0.75 }} title={t('shared.dock.currentSlot')}>
              {'✓'}
            </span>
          )}
        </span>
      ),
      onClick: () => onMove(target),
    };
    const needsDividerAfter = index === 1 || index === 3;
    return needsDividerAfter ? [entry, { type: 'divider' as const, key: `move-divider-${index}` }] : [entry];
  });
}
