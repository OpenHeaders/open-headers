/**
 * Soft-dedup banner + the "show what changed since last import" panel.
 * Mounts only when the SW dedup walker (`workspace-import-dedup.ts`)
 * returns at least one match arm — the precedence is `exportId` in same
 * target → `exportId` in other target → `workspace.uid` match (design
 * §5.2). Only the same-target arm exposes a meaningful diff (it's the
 * only one that carries the prior `perEntityStrategies`).
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import {
  diffIncomingAgainstPriorImport,
  type ImportSinceLastDiff,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import { Alert, Button, Modal, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { DedupMatchesResult } from '@/background/modules/workspace-import-dedup';

const { Text } = Typography;

const ENTITY_TYPE_LABELS: Record<ImportSinceLastDiff['sections'][number]['type'], string> = {
  rules: 'Rules',
  requests: 'Requests',
  templates: 'Templates',
  environments: 'Environments',
  liveWorkflows: 'Live workflows',
  liveVariables: 'Live variables',
  collections: 'Collections',
  folders: 'Folders',
};

const ImportSinceLastDiffPanel: React.FC<{ diff: ImportSinceLastDiff }> = ({ diff }) => {
  const interesting = diff.sections.filter((s) => s.prior > 0 || s.incoming > 0);
  if (interesting.length === 0) {
    return <Text type="secondary">No entities in either import.</Text>;
  }
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Text type="secondary">
        Then: {diff.totals.prior} entities · Now: {diff.totals.incoming} ·{' '}
        <Text strong style={{ color: '#1677ff' }}>
          {diff.totals.new} new
        </Text>{' '}
        · {diff.totals.kept} kept · {diff.totals.removed} no longer in export
      </Text>
      {interesting.map((s) => (
        <div key={s.type} style={{ borderLeft: '2px solid #f0f0f0', paddingLeft: 12 }}>
          <Text strong>{ENTITY_TYPE_LABELS[s.type]}</Text>{' '}
          <Text type="secondary">
            ({s.prior} → {s.incoming})
          </Text>
          {s.newUids.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
              {s.newUids.slice(0, 6).map((x) => (
                <li key={x.uid} style={{ fontSize: 12 }}>
                  <Tag color="blue">new</Tag>
                  <Text>{x.name}</Text>
                </li>
              ))}
              {s.newUids.length > 6 && (
                <li style={{ fontSize: 12 }}>
                  <Text type="secondary">…and {s.newUids.length - 6} more</Text>
                </li>
              )}
            </ul>
          )}
          {s.removedUids.length > 0 && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {s.removedUids.length} no longer in this export
            </Text>
          )}
        </div>
      ))}
    </Space>
  );
};

const DedupBanner: React.FC<{
  dedup: DedupMatchesResult;
  envelope: WorkspaceExport | null;
  onDismiss: () => void;
}> = ({ dedup, envelope, onDismiss }) => {
  const [showDiff, setShowDiff] = useState(false);

  if (dedup.exportIdSameTarget.length > 0) {
    const m = dedup.exportIdSameTarget[0];
    if (!m) return null;
    const canDiff = !!(envelope && m.perEntityStrategies);
    const diff: ImportSinceLastDiff | null =
      canDiff && envelope && m.perEntityStrategies
        ? diffIncomingAgainstPriorImport(envelope, m.perEntityStrategies)
        : null;
    return (
      <>
        <Alert
          type="info"
          showIcon
          closable
          onClose={onDismiss}
          icon={<InfoCircleOutlined />}
          title={`You imported export ${m.exportId} here on ${new Date(m.importedAt).toLocaleDateString()}`}
          description={
            <span>
              Re-importing it will apply your current per-entity strategy choices.
              {canDiff && (
                <>
                  {' '}
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setShowDiff(true)}>
                    Show what changed since last import
                  </Button>
                </>
              )}
            </span>
          }
        />
        {diff && (
          <Modal
            open={showDiff}
            onCancel={() => setShowDiff(false)}
            onOk={() => setShowDiff(false)}
            cancelButtonProps={{ style: { display: 'none' } }}
            okText="Close"
            title={`Changes since ${new Date(m.importedAt).toLocaleDateString()}`}
            width={560}
          >
            <ImportSinceLastDiffPanel diff={diff} />
          </Modal>
        )}
      </>
    );
  }
  if (dedup.exportIdOtherTargets.length > 0) {
    const m = dedup.exportIdOtherTargets[0];
    if (!m) return null;
    return (
      <Alert
        type="info"
        showIcon
        closable
        onClose={onDismiss}
        title={`You also imported export ${m.exportId} into "${m.workspaceName}"`}
        description="That workspace is unaffected by this import."
      />
    );
  }
  if (dedup.workspaceUidMatches.length > 0) {
    const m = dedup.workspaceUidMatches[0];
    if (!m) return null;
    return (
      <Alert
        type="info"
        showIcon
        closable
        onClose={onDismiss}
        title={`A workspace from this source already exists ("${m.workspaceName}")`}
        description="Switch the target above to refresh it, or import as a new copy."
      />
    );
  }
  return null;
};

export default DedupBanner;
