/**
 * Right pane of the diff workspace — entity header + Monaco DiffEditor
 * (or empty-state preview for new entities). The header carries the
 * segmented strategy control and a one-sentence "what does this mean"
 * subtitle so the user never has to memorise the matrix.
 */

import { ColumnHeightOutlined, ColumnWidthOutlined, SettingOutlined } from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import type { CollisionStrategy } from '@openheaders/core/workspace-export';
import { Button, Segmented, Tag, Tooltip, Typography, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import RequestSummary from '../RequestSummary';
import RuleSummary from '../RuleSummary';
import type { MaterialisedRow } from './diff-sections';
import { STRATEGY_META } from './strategy-meta';

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

const DIFF_LAYOUT_KEY = 'oh.workspace-export.diff-layout';

const DiffPane: React.FC<DiffPaneProps> = ({ row, yaml, currentStrategy, onChangeStrategy, advancedTrigger }) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  // Diff-editor layout — defaults to side-by-side, persists across the
  // session so re-opening the modal keeps the user's choice.
  const [sideBySide, setSideBySide] = useState<boolean>(() => {
    try {
      const raw = window.sessionStorage.getItem(DIFF_LAYOUT_KEY);
      if (raw === 'inline') return false;
    } catch {
      // sessionStorage can throw under privacy modes — fall through to default
    }
    return true;
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(DIFF_LAYOUT_KEY, sideBySide ? 'side-by-side' : 'inline');
    } catch {
      // ignore — preference stays for this modal lifetime
    }
  }, [sideBySide]);

  const onMount = useCallback((editor: monaco.editor.IStandaloneDiffEditor, _m: Monaco) => {
    editorRef.current = editor;
  }, []);

  // Monaco's `options` prop only seeds construction — flipping
  // `renderSideBySide` live needs an explicit `updateOptions` call on
  // the captured editor instance. Without this the toggle visually
  // changes the button label but the editor stays on whatever mode
  // it mounted with.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ renderSideBySide: sideBySide });
    }
  }, [sideBySide]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div
        style={{
          padding: '14px 20px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
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
          {showsDiff && (
            <Tooltip title={sideBySide ? 'Switch to inline diff' : 'Switch to side-by-side diff'}>
              <Button
                size="small"
                icon={sideBySide ? <ColumnWidthOutlined /> : <ColumnHeightOutlined />}
                onClick={() => setSideBySide((v) => !v)}
              >
                {sideBySide ? 'Side by side' : 'Inline'}
              </Button>
            </Tooltip>
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
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {showsDiff ? (
          <DiffEditor
            original={yaml?.targetYaml ?? ''}
            modified={yaml?.incomingYaml ?? ''}
            language="yaml"
            theme={isDarkMode ? 'oh-dark' : 'oh-light'}
            onMount={onMount}
            options={{
              readOnly: true,
              renderSideBySide: sideBySide,
              minimap: { enabled: false },
              folding: false,
              lineNumbers: 'on',
              renderOverviewRuler: false,
              scrollbar: { useShadows: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
              fontSize: 12,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              renderLineHighlight: 'none',
              hideUnchangedRegions: { enabled: true, contextLineCount: 2 },
            }}
          />
        ) : (
          <div
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
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
        )}
      </div>
    </div>
  );
};

export default DiffPane;
