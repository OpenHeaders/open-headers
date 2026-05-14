/**
 * Inline diff chip for one field with an external concurrent edit.
 *
 * Pure UI primitive — entity-agnostic. The popover surfaces three
 * values in plain language:
 *
 *   - "Saved value" — what another surface committed (with attribution
 *     via `<SurfaceChip>` when awareness can identify the peer).
 *   - "Your edit"   — what the user is currently typing locally.
 *   - "Last synced value" (collapsed) — the value the form was
 *     originally seeded with; kept for the curious, hidden by default.
 *
 * Buttons name the outcome: "Keep mine" (dismiss) and "Use saved"
 * (overwrite the local field with the saved value). Save semantics
 * still apply regardless of dismissal — a later HLC wins on save —
 * but that's a sync-engine detail; the user's mental model is "the
 * other surface saved this value, what do I want my field to be?".
 */

import { ThunderboltOutlined } from '@ant-design/icons';
import { Button, Popover, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { ConflictRemoteInfo } from '../conflicts/types';
import SurfaceChip from './SurfaceChip';

const { Text } = Typography;

export interface ConflictDiffChipProps {
  /** The committed value from another surface. Replaces local on Use saved. */
  theirs: string;
  /** Snapshot the form was seeded with (last init / last accepted). */
  base: string;
  /** Local form value the user is typing right now. Surfaced explicitly
   *  so all three values in the conflict are visible side-by-side. */
  local: string;
  /** Optional attribution. Omitted when no peer can be identified;
   *  chip then drops the dot+kind line and shows just the values. */
  remote?: ConflictRemoteInfo;
  onTakeTheirs: () => void;
  onKeepMine: () => void;
  style?: React.CSSProperties;
}

const monoBlock: React.CSSProperties = {
  background: 'var(--ant-color-fill-quaternary)',
  padding: 6,
  borderRadius: 4,
  fontFamily: 'monospace',
  fontSize: 11,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
};

const ConflictDiffChip: React.FC<ConflictDiffChipProps> = ({
  theirs,
  base,
  local,
  remote,
  onTakeTheirs,
  onKeepMine,
  style,
}) => {
  const [showBase, setShowBase] = useState(false);

  const content = (
    <div style={{ minWidth: 260, maxWidth: 360, fontSize: 12 }}>
      <Text strong style={{ display: 'block', marginBottom: remote ? 4 : 8 }}>
        External change
      </Text>
      {remote && (
        <div style={{ marginBottom: 8 }}>
          <SurfaceChip
            kind={remote.surfaceKind}
            label={remote.surfaceLabel}
            agoMs={remote.agoMs}
            size="small"
          />
        </div>
      )}
      <div style={{ marginBottom: 6 }}>
        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
          Saved value
        </Text>
        <div style={monoBlock}>{theirs || '(empty)'}</div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
          Your edit
        </Text>
        <div style={monoBlock}>{local || '(empty)'}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
        <Button size="small" onClick={onKeepMine}>
          Keep mine
        </Button>
        <Button size="small" type="primary" onClick={onTakeTheirs}>
          Use saved
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setShowBase((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          color: 'var(--ant-color-text-tertiary)',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {showBase ? '▾' : '▸'} Last synced value
      </button>
      {showBase && <div style={{ ...monoBlock, marginTop: 4, opacity: 0.85 }}>{base || '(empty)'}</div>}
    </div>
  );

  return (
    // zIndex 1100 lifts the resolve popover above any host surface that
    // mounts inside a stacking context (devpanel rule-hover popover at
    // 1080, with its inner antd dropdowns at 1090).
    <Popover content={content} trigger="click" placement="topRight" zIndex={1100}>
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
          flexShrink: 0,
          ...style,
        }}
      >
        <ThunderboltOutlined style={{ fontSize: 10 }} />
      </span>
    </Popover>
  );
};

export default ConflictDiffChip;
