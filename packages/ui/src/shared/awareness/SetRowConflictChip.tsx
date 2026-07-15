/**
 * Inline chip for a row that was removed externally while you still
 * have it locally. Same lightning-bolt placement as
 * {@link ConflictDiffChip}, but the popover speaks to the structural
 * change (row removal) rather than a per-leaf value disagreement.
 *
 * Affordances:
 *   - "Use saved (remove)" — drop the row from your form to match saved.
 *   - "Keep mine"          — keep the row; the chip dismisses. (Save
 *                             will re-create the row in canonical state
 *                             via the existing LWW pipeline.)
 */

import { MinusCircleFilled } from '@ant-design/icons';
import { Button, Popover, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { ConflictRemoteInfo } from '../conflicts/types';
import SurfaceChip from './SurfaceChip';

const { Text } = Typography;

export interface SetRowConflictChipProps {
  /** Last-known summary of the row (e.g. "X-Auth: Bearer ..."). */
  baseSummary: string;
  remote?: ConflictRemoteInfo;
  onUseSaved: () => void;
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

const SetRowConflictChip: React.FC<SetRowConflictChipProps> = ({
  baseSummary,
  remote,
  onUseSaved,
  onKeepMine,
  style,
}) => {
  const t = useT();
  const content = (
    <div style={{ minWidth: 260, maxWidth: 360, fontSize: 12 }}>
      <Text strong style={{ display: 'block', marginBottom: remote ? 4 : 8 }}>
        {t('shared.conflicts.rowChip.removedExternally')}
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
      <div style={{ marginBottom: 10 }}>
        <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
          {t('shared.conflicts.rowChip.lastSyncedRow')}
        </Text>
        <div style={monoBlock}>{baseSummary || t('shared.conflicts.chip.empty')}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button size="small" onClick={onKeepMine}>
          {t('shared.conflicts.chip.keepMine')}
        </Button>
        <Button size="small" type="primary" danger onClick={onUseSaved}>
          {t('shared.conflicts.rowChip.useSavedRemove')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="topRight" zIndex={1100}>
      <span
        role="button"
        tabIndex={0}
        title={t('shared.conflicts.rowChip.trigger')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'var(--ant-color-error)',
          color: '#fff',
          fontSize: 10,
          cursor: 'pointer',
          flexShrink: 0,
          ...style,
        }}
      >
        <MinusCircleFilled style={{ fontSize: 10 }} />
      </span>
    </Popover>
  );
};

export default SetRowConflictChip;
