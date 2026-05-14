/**
 * Source attribution — minimal header line for the import preview.
 * Just the workspace label and the entity-counts summary; app version
 * / platform / export timestamp aren't actionable for the recipient,
 * so they live behind the optional `notes` field if the sender chose
 * to attach one.
 */

import type { WorkspaceExport } from '@openheaders/core/workspace-export';
import { Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

function summarizeCounts(counts: WorkspaceExport['meta']['counts']): string {
  const parts: string[] = [];
  const push = (n: number, singular: string, plural: string): void => {
    if (n > 0) parts.push(`${n} ${n === 1 ? singular : plural}`);
  };
  push(counts.rules, 'rule', 'rules');
  push(counts.requests, 'request', 'requests');
  push(counts.environments, 'env', 'envs');
  push(counts.templates, 'template', 'templates');
  push(counts.liveWorkflows, 'workflow', 'workflows');
  push(counts.liveVariables, 'live var', 'live vars');
  push(counts.secrets, 'secret', 'secrets');
  return parts.join(', ');
}

const SourceAttribution: React.FC<{ envelope: WorkspaceExport }> = ({ envelope }) => {
  const counts = envelope.meta.counts;
  const sourceName = envelope.source.workspaceLabel ?? envelope.workspace.name;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
      <Text strong style={{ fontSize: 14 }}>
        {sourceName}
      </Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {summarizeCounts(counts) || 'no entities'}
      </Text>
      {envelope.notes && (
        <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
          · {envelope.notes}
        </Text>
      )}
    </div>
  );
};

export default SourceAttribution;
