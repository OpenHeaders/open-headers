/**
 * Right pane of the diff workspace — entity header + the rich diff
 * editor. The header carries the entity title, kind tag, state tags,
 * and the segmented strategy control with a one-sentence "what does
 * this mean" subtitle so the user never has to memorise the matrix.
 * The IDE-style diff toolbar lives directly above the editor, inside
 * `RichDiffEditor`.
 *
 * New-entity rows also flow through `RichDiffEditor` (with `original=''`)
 * so the user gets the same Monaco surface — line numbers, scrolling,
 * search, the toolbar — instead of a stripped-down `<pre>` block. The
 * diff renders as one inline "all added" pane, which is exactly the
 * IDE convention for "this file did not exist before".
 */

import type { CollisionStrategy } from '@openheaders/core/workspace-export';
import { Segmented, Tag, Typography } from 'antd';
import type React from 'react';
import { RichDiffEditor } from '@/workbench/components/diff-viewer';
import RequestSummary from '../RequestSummary';
import RuleSummary from '../RuleSummary';
import type { MaterialisedRow } from './diff-sections';
import { STRATEGY_META } from './strategy-meta';
import { useImportPreviewDiffOptions } from './useImportPreviewDiffOptions';

const { Text } = Typography;

interface DiffPaneProps {
  row: MaterialisedRow | null;
  yaml: { targetYaml: string; incomingYaml: string } | undefined;
  currentStrategy: CollisionStrategy;
  onChangeStrategy: (s: CollisionStrategy) => void;
}

const DiffPane: React.FC<DiffPaneProps> = ({ row, yaml, currentStrategy, onChangeStrategy }) => {
  const [diffOptions, setDiffOptions] = useImportPreviewDiffOptions();

  if (!row) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text type="secondary">Select an entity from the list to see what's changing.</Text>
      </div>
    );
  }

  const meta = STRATEGY_META[currentStrategy];
  const segmentedOptions = row.allowedStrategies.map((s) => ({
    label: STRATEGY_META[s].label,
    value: s,
  }));

  const isNew = row.state === 'no-collision';

  const headerContent = (
    <div
      style={{
        padding: '14px 20px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Text strong style={{ fontSize: 15, flex: 1, minWidth: 0 }}>
          {row.name}
        </Text>
        <Tag style={{ fontSize: 10, margin: 0, fontWeight: 500 }}>{row.section.label}</Tag>
        {isNew && (
          <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
            new on the target
          </Tag>
        )}
        {row.divergedFromExport && (
          <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>
            edited locally since export
          </Tag>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Segmented
          size="small"
          value={currentStrategy}
          onChange={(v) => onChangeStrategy(v as CollisionStrategy)}
          options={segmentedOptions}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {meta.description}
        </Text>
      </div>
      {row.entityKind === 'rule' && row.entity ? (
        <div style={{ marginTop: 2 }}>
          <RuleSummary rule={row.entity as never} />
        </div>
      ) : row.entityKind === 'request' && row.entity ? (
        <div style={{ marginTop: 2 }}>
          <RequestSummary request={row.entity as never} />
        </div>
      ) : null}
    </div>
  );

  return (
    <RichDiffEditor
      original={yaml?.targetYaml ?? ''}
      modified={yaml?.incomingYaml ?? ''}
      language="yaml"
      options={diffOptions}
      onOptionsChange={setDiffOptions}
      header={headerContent}
    />
  );
};

export default DiffPane;
