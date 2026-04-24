/**
 * LiveVariablesEditor — tab body listing every live-variable binding
 * in the active workspace as a row.
 *
 * Matches the visual language of VariableTable (the shared editor used
 * by WorkspaceVariablesEditor / CollectionVariablesEditor / EnvironmentEditor)
 * so live variables read as "just another variable scope" to the user.
 * Each row is one binding: NAME | VALUE | WORKFLOW. Values are captured
 * at runtime by the backing Workflow, not entered here — the cell is
 * read-only and masked by default. The WORKFLOW column is a clickable
 * chip that opens the Workflow editor, answering the user's natural
 * question: *"where does this value come from?"*
 *
 * Name renames go through a context-menu entry ("Edit binding") on the
 * sidebar row — not inline in this table — because the binding has
 * other editable facets (workflow, step, capture, enabled flag, manual
 * override) that are better edited in a dedicated form.
 */

import {
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useAllLiveCaches } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { App, Button, Empty, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import EditorHeader from './EditorHeader';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;

interface LiveVariablesEditorProps {
  /** Open the Workflow editor for a specific workflow uid. */
  onOpenWorkflow?: (workflowUid: string, name: string) => void;
  /** Open the LiveVariableEditor (full binding editor) for one uid. */
  onEditBinding?: (uid: string, name: string) => void;
  /** Spawn a new live variable draft. */
  onCreateLiveVariable?: () => void;
}

const GRID_COLS = '1fr 1fr 200px 80px';

const LiveVariablesEditor: React.FC<LiveVariablesEditorProps> = ({
  onOpenWorkflow,
  onEditBinding,
  onCreateLiveVariable,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { variables: liveVariables, deleteVariable } = useLiveVariables();
  const { workflows: liveWorkflows, refreshNow } = useLiveWorkflows();
  const { activeEnvironmentId } = useEnvironments();

  const workflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(workflowUids);

  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const toggleReveal = useCallback((uid: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (uid: string, name: string) => {
      const ok = await deleteVariable(uid);
      if (!ok) message.error(`Failed to delete "${name}"`);
    },
    [deleteVariable, message],
  );

  const handleRefresh = useCallback(
    async (workflowUid: string) => {
      await refreshNow(workflowUid, activeEnvironmentId);
    },
    [refreshNow, activeEnvironmentId],
  );

  const headerTitle = (
    <>
      {scopeBadge('live', 20)}
      <Title level={5} style={{ margin: 0 }}>
        Live Variables
      </Title>
    </>
  );

  const headerActions = onCreateLiveVariable ? (
    <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => onCreateLiveVariable()}>
      New live variable
    </Button>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={headerTitle} actions={headerActions} />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Each binding maps a name to a capture from a Workflow (a scheduled request chain). Referenced in rules and
            requests as <code>{'{{live.NAME}}'}</code>.
          </Text>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
              VARIABLES ({liveVariables.length})
            </Text>
          </div>

        <div
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            overflow: 'hidden',
            background: token.colorBgContainer,
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID_COLS,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillQuaternary,
            }}
          >
            <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 600, color: token.colorTextSecondary }}>
              Name
            </div>
            <div
              style={{
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: token.colorTextSecondary,
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              Value
            </div>
            <div
              style={{
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 600,
                color: token.colorTextSecondary,
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              Workflow
            </div>
            <div style={{ padding: '6px 8px' }} />
          </div>

          {liveVariables.length === 0 ? (
            <div style={{ padding: 24 }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ fontSize: 12 }}>
                    No live variables yet. Create one to bind a name to a workflow's captured value.
                  </span>
                }
              />
            </div>
          ) : (
            liveVariables.map((lv, index) => {
              const workflow = liveWorkflows.find((w) => w.uid === lv.workflowUid) ?? null;
              const runs = liveCaches[lv.workflowUid] ?? [];
              const run =
                runs.find((r) => r.environmentId === activeEnvironmentId) ??
                runs.find((r) => r.environmentId === null) ??
                runs[0] ??
                null;
              // Manual override wins; otherwise the cached step-capture
              // for the active environment (null-env falls back).
              const overrideActive =
                lv.manualOverride && (lv.manualOverride.until === undefined || lv.manualOverride.until > Date.now());
              const rawValue = overrideActive
                ? lv.manualOverride?.value
                : run?.stepCaptures?.[lv.stepId]?.[lv.captureName];
              const hasValue = typeof rawValue === 'string' && rawValue.length > 0;
              const isRevealed = revealed.has(lv.uid);
              const displayValue = hasValue ? (isRevealed ? rawValue : '•'.repeat(Math.min(rawValue.length, 12))) : '';
              const isLast = index === liveVariables.length - 1;

              return (
                <div
                  key={lv.uid}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID_COLS,
                    borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`,
                    alignItems: 'center',
                  }}
                >
                  {/* Name cell */}
                  <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 12,
                        fontWeight: 500,
                        color: token.colorText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={lv.name}
                    >
                      {lv.name}
                    </span>
                    {!lv.enabled && <span style={{ fontSize: 9, color: token.colorTextTertiary }}>off</span>}
                    {overrideActive && <span style={{ fontSize: 9, color: token.colorWarning }}>override</span>}
                  </div>

                  {/* Value cell */}
                  <div
                    style={{
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      minWidth: 0,
                    }}
                  >
                    {hasValue ? (
                      <>
                        <span
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            fontSize: 12,
                            color: token.colorText,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0,
                          }}
                          title={isRevealed ? rawValue : 'Click eye to reveal'}
                        >
                          {displayValue}
                        </span>
                        <Tooltip title={isRevealed ? 'Hide value' : 'Show value'}>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleReveal(lv.uid)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') toggleReveal(lv.uid);
                            }}
                            style={{ cursor: 'pointer', fontSize: 12, color: token.colorTextTertiary }}
                          >
                            {isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                          </span>
                        </Tooltip>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: token.colorTextQuaternary, fontStyle: 'italic' }}>
                        not captured yet
                      </span>
                    )}
                  </div>

                  {/* Workflow cell — click opens the Workflow editor */}
                  <div
                    style={{
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      minWidth: 0,
                    }}
                  >
                    {workflow ? (
                      <Button
                        type="link"
                        size="small"
                        icon={<LinkOutlined />}
                        onClick={() => onOpenWorkflow?.(workflow.uid, workflow.name)}
                        style={{
                          padding: 0,
                          height: 'auto',
                          fontSize: 12,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {workflow.name}
                      </Button>
                    ) : (
                      <span style={{ fontSize: 11, color: token.colorTextQuaternary, fontStyle: 'italic' }}>
                        missing workflow
                      </span>
                    )}
                  </div>

                  {/* Actions cell */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Tooltip title="Refresh workflow now">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => void handleRefresh(lv.workflowUid)}
                        aria-label={`Refresh ${lv.name}`}
                      />
                    </Tooltip>
                    {onEditBinding && (
                      <Tooltip title="Edit binding (name / enabled / override)">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => onEditBinding(lv.uid, lv.name)}
                          aria-label={`Edit ${lv.name}`}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => void handleDelete(lv.uid, lv.name)}
                        aria-label={`Delete ${lv.name}`}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default LiveVariablesEditor;
