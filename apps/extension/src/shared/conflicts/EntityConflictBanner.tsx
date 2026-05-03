/**
 * Entity-level aggregator that mounts above an editor body when 2+ fields
 * have unresolved external changes.
 *
 * Pure presentational + entity-agnostic — caller computes `count` from
 * its own tracker (`getAllConflicts(form).size`) and wires the three
 * actions into the same `acceptTheirs` / `dismiss` paths the per-field
 * chips already use.
 *
 * Hidden when count < 2 (1 conflict reads the inline chip — banner
 * overhead not worth it; 0 means nothing to show).
 */

import { ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

export interface EntityConflictBannerProps {
  count: number;
  onReview: () => void;
  onKeepAllMine: () => void;
  onUseAllSaved: () => void;
  /** Override the default copy noun ("fields"). e.g. "headers", "params". */
  fieldNoun?: string;
  style?: React.CSSProperties;
}

const EntityConflictBanner: React.FC<EntityConflictBannerProps> = ({
  count,
  onReview,
  onKeepAllMine,
  onUseAllSaved,
  fieldNoun = 'fields',
  style,
}) => {
  if (count < 2) return null;
  const message = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: 13 }}>
        <strong>{count}</strong> {fieldNoun} changed externally while you were editing.
      </Text>
      <Space size={6} wrap>
        <Button size="small" onClick={onReview}>
          Review changes
        </Button>
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
