/**
 * Source attribution — who shipped this export, when, and what it
 * carries. Renders the per-entity drops alongside (envelope-valid but
 * per-entity-invalid rows that the importer will skip).
 */

import { WarningOutlined } from '@ant-design/icons';
import type { ImportDrop, WorkspaceExport } from '@openheaders/core/workspace-export';
import { Alert, Typography } from 'antd';
import type React from 'react';

const { Text, Paragraph } = Typography;

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

const SourceAttribution: React.FC<{ envelope: WorkspaceExport; drops: ImportDrop[] }> = ({ envelope, drops }) => {
  const counts = envelope.meta.counts;
  return (
    <div>
      <Paragraph style={{ marginBottom: 4 }}>
        <Text strong>From: </Text>
        <Text>{envelope.source.workspaceLabel ?? envelope.workspace.name}</Text>
        <Text type="secondary"> · </Text>
        <Text type="secondary">
          {envelope.source.app} {envelope.source.appVersion} · {envelope.source.platform}
        </Text>
      </Paragraph>
      <Paragraph style={{ marginBottom: 4, fontSize: 12 }}>
        <Text type="secondary">Exported {new Date(envelope.exportedAt).toLocaleString()}</Text>
      </Paragraph>
      <Paragraph style={{ marginBottom: 0, fontSize: 12 }}>
        <Text type="secondary">{summarizeCounts(counts) || 'no entities'}</Text>
      </Paragraph>
      {envelope.notes && (
        <Paragraph style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          <Text type="secondary">Notes: </Text>
          <Text>{envelope.notes}</Text>
        </Paragraph>
      )}
      {drops.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${drops.length} entit${drops.length === 1 ? 'y' : 'ies'} couldn't be parsed and will be skipped`}
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {drops.slice(0, 5).map((d, idx) => (
                <li key={`${d.path}-${idx}`} style={{ fontSize: 11 }}>
                  <Text code>{d.path}</Text> — {d.reason}
                </li>
              ))}
              {drops.length > 5 && <li style={{ fontSize: 11 }}>…and {drops.length - 5} more</li>}
            </ul>
          }
          style={{ marginTop: 8 }}
        />
      )}
    </div>
  );
};

export default SourceAttribution;
