/**
 * Right pane of the diff workspace — entity header + the rich diff
 * editor (or empty-state preview for new entities). The header carries
 * the entity title, kind tag, state tags, and the segmented strategy
 * control with a one-sentence "what does this mean" subtitle so the
 * user never has to memorise the matrix. The IDE-style diff toolbar
 * lives directly above the editor, inside `RichDiffEditor`.
 */

import { SettingOutlined } from '@ant-design/icons';
import type { CollisionStrategy } from '@openheaders/core/workspace-export';
import { Button, Segmented, Tag, Typography, theme } from 'antd';
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
  /** When the parent renders an Advanced column, surface a button in
   *  this pane's header so the user can open/close it from here. */
  advancedTrigger: { open: boolean; onToggle: () => void; activeCount: number } | null;
}

const DiffPane: React.FC<DiffPaneProps> = ({ row, yaml, currentStrategy, onChangeStrategy, advancedTrigger }) => {
  const { token } = theme.useToken();
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
  const showsDiff = !isNew && yaml && yaml.targetYaml !== '';

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
        {advancedTrigger && !advancedTrigger.open && (
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={advancedTrigger.onToggle}
            type={advancedTrigger.activeCount > 0 ? 'primary' : 'default'}
            ghost={advancedTrigger.activeCount > 0}
          >
            Advanced{advancedTrigger.activeCount > 0 ? ` · ${advancedTrigger.activeCount}` : ''}
          </Button>
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

  if (!showsDiff) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
        <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>{headerContent}</div>
        <div
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 12,
            color: token.colorTextTertiary,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isNew
              ? 'This entity is new — nothing on the target side to compare against.'
              : 'Nothing to diff — both sides are empty.'}
          </Text>
          {row.entity && yaml?.incomingYaml ? (
            <pre
              style={{
                margin: 0,
                padding: 12,
                width: '100%',
                maxHeight: 320,
                overflow: 'auto',
                background: token.colorBgLayout,
                borderRadius: 6,
                fontSize: 11,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                color: token.colorText,
              }}
            >
              {yaml.incomingYaml}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }

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
