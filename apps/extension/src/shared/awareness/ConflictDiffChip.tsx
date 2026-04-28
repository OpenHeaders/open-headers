/**
 * Inline diff chip (Phase A A4).
 *
 * Renders next to a form field when an external commit has produced
 * a value at the same path that differs from both the user's current
 * uncommitted draft AND the value the form was last seeded with.
 *
 * Affordances:
 *   - Take Theirs   — overwrite the local field with the external value.
 *   - Keep Mine     — dismiss the chip; local edit stands. The §6.3 LWW
 *                     save still applies — the user's later HLC wins on
 *                     save regardless of the chip's state.
 *   - Show diff     — disclose `base → theirs` (where `base` is the value
 *                     the form was originally seeded with). The user's
 *                     local draft sits in the field itself; surfacing it
 *                     a third time would just clutter.
 *
 * Pure presentational — all rule-specific lookup happens in the caller's
 * tracker hook.
 */

import { ThunderboltOutlined } from '@ant-design/icons';
import { Button, Popover, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

export interface ConflictDiffChipProps {
  /** The committed value from another surface. Replaces local on Take Theirs. */
  theirs: string;
  /** Snapshot the form was seeded with (last init / last accepted Theirs). */
  base: string;
  onTakeTheirs: () => void;
  onKeepMine: () => void;
  style?: React.CSSProperties;
}

const ConflictDiffChip: React.FC<ConflictDiffChipProps> = ({ theirs, base, onTakeTheirs, onKeepMine, style }) => {
  const content = (
    <div style={{ minWidth: 240, maxWidth: 360, fontSize: 12 }}>
      <Text strong style={{ display: 'block', marginBottom: 6 }}>
        External change available
      </Text>
      <div style={{ marginBottom: 8, lineHeight: 1.5 }}>
        Another surface committed a value here while you were editing. Your local edit is preserved on save (§6.3 LWW),
        but you can switch to theirs explicitly.
      </div>
      <div
        style={{
          background: 'var(--ant-color-fill-quaternary)',
          padding: 6,
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 11,
          marginBottom: 8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        <div style={{ opacity: 0.7 }}>base: {base || '(empty)'}</div>
        <div>theirs: {theirs || '(empty)'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onKeepMine}>
          Keep Mine
        </Button>
        <Button size="small" type="primary" onClick={onTakeTheirs}>
          Take Theirs
        </Button>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="topRight">
      <span
        role="button"
        tabIndex={0}
        title="External change available — click to resolve"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--ant-color-warning)',
          color: '#fff',
          fontSize: 10,
          cursor: 'pointer',
          ...style,
        }}
      >
        <ThunderboltOutlined style={{ fontSize: 10 }} />
      </span>
    </Popover>
  );
};

export default ConflictDiffChip;
