/**
 * Entity-level aggregator that mounts above an editor body when fields
 * have unresolved external changes.
 *
 * Pure presentational + entity-agnostic — caller computes `count` from
 * its own tracker (`getAllConflicts(form).size`) and wires the three
 * actions into the same `acceptTheirs` / `dismiss` paths the per-field
 * chips already use.
 *
 * Visibility:
 *   - Hidden at count 0 (nothing to show).
 *   - Hidden at count 1 ONLY when an inline surface can resolve it
 *     (a leaf chip / set-row chip handles the case alone). For
 *     dialog-only conflicts (set-reorder, set-add, union-swap) the
 *     banner is the only review affordance — caller passes
 *     `forceVisible` whenever at least one such conflict is present.
 *   - Always shown at count ≥ 2.
 */

import { ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Typography } from 'antd';
import type React from 'react';
import type { PathConflict } from './types';

const { Text } = Typography;

/** True when the conflict map contains any kind that has no inline
 *  affordance (set-reorder, set-add, union-swap). Editors pass the
 *  result as `forceVisible` to keep the banner visible at count 1
 *  whenever a dialog-only conflict is the lone surface. */
export function hasDialogOnlyConflict(conflicts: ReadonlyMap<string, PathConflict>): boolean {
  for (const conflict of conflicts.values()) {
    const kind = conflict.kind ?? 'leaf';
    if (kind === 'set-reorder' || kind === 'set-add' || kind === 'union-swap') return true;
  }
  return false;
}

export interface EntityConflictBannerProps {
  count: number;
  /** Opens the entity-level review surface (diff dialog / merge
   *  editor). Optional — editors without one (the storage documents
   *  until their review tier lands) drop the Review button and keep
   *  the two whole-form resolutions. */
  onReview?: () => void;
  onKeepAllMine: () => void;
  onUseAllSaved: () => void;
  /** Override the default copy noun ("fields"). e.g. "headers", "params". */
  fieldNoun?: string;
  /** When true, the banner stays visible at count 1 — used when at
   *  least one conflict is dialog-only (no inline chip can surface
   *  it on its own). Caller derives this from the conflict map. */
  forceVisible?: boolean;
  style?: React.CSSProperties;
}

const EntityConflictBanner: React.FC<EntityConflictBannerProps> = ({
  count,
  onReview,
  onKeepAllMine,
  onUseAllSaved,
  fieldNoun = 'fields',
  forceVisible = false,
  style,
}) => {
  if (count === 0) return null;
  if (count < 2 && !forceVisible) return null;
  const message = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: 13 }}>
        <strong>{count}</strong> {fieldNoun} changed externally while you were editing.
      </Text>
      <Space size={6} wrap>
        {onReview && (
          <Button size="small" onClick={onReview}>
            Review changes
          </Button>
        )}
        <Button size="small" onClick={onKeepAllMine}>
          Keep all mine
        </Button>
        <Button size="small" type="primary" onClick={onUseAllSaved}>
          Use all saved
        </Button>
      </Space>
    </div>
  );
  return (
    <Alert
      icon={<ThunderboltOutlined />}
      type="warning"
      showIcon
      banner
      message={message}
      style={{ marginBottom: 8, ...style }}
    />
  );
};

export default EntityConflictBanner;
