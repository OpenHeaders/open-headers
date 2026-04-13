/**
 * BottomPanel — bottom dock with context-aware tabs.
 *
 * Three "always-on" tabs (Traffic / Console / Terminal) are placeholders for
 * desktop-only features. The fourth tab — Test Runs — is **contextual**:
 * it only shows when the active main-panel tab has a test-run owner
 * (collection, folder, rule, or the workspace). This mirrors IDE-style
 * tool windows that appear and disappear depending on what the editor pane
 * is showing.
 *
 * When visible, Test Runs lists every persisted run for the current owner
 * (newest first), with a stale badge for runs whose owning rules have
 * changed since the run executed. Clicking a row opens the report in the
 * main editor area; the trash icon deletes the row in place. If the active
 * main-panel tab is itself a Run Report, the corresponding row is
 * highlighted so the user can see which run they're looking at.
 */

import { DeleteOutlined, ExperimentOutlined, WarningOutlined } from '@ant-design/icons';
import { runtime } from '@utils/browser-api';
import { App, Button, Empty, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const { Text } = Typography;

// ── Types (mirror background test-run-store) ────────────────────────

export type TestRunOwnerType = 'rule' | 'folder' | 'collection' | 'workspace';

export interface TestRunOwner {
  type: TestRunOwnerType;
  id: string;
}

interface ListedRun {
  id: string;
  ownerType: TestRunOwnerType;
  ownerId: string;
  ownerNameAtRun: string;
  url: string;
  startedAt: number;
  endedAt: number;
  waitSeconds: number;
  fires: { ruleUid: string }[];
  ruleStatuses: Record<string, 'executed' | 'no-fire' | 'skipped'>;
  isStale: boolean;
}

// ── Tab definitions ─────────────────────────────────────────────────

interface BottomTab {
  key: string;
  label: string;
}

const STATIC_TABS: BottomTab[] = [
  { key: 'traffic', label: 'Traffic' },
  { key: 'console', label: 'Console' },
  { key: 'terminal', label: 'Terminal' },
];

// ── Component ───────────────────────────────────────────────────────

interface BottomPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  /**
   * Owner of the currently active main-panel tab. Drives whether the
   * Test Runs tab is visible and which bucket it loads.
   */
  contextOwner: TestRunOwner | null;
  /**
   * Open a stored test run in the main panel. The host (App.tsx) routes
   * this to its `openTestRun` handler, which stamps the owner onto the
   * new tab so the breadcrumb resolves and uses `ownerName` to build
   * the tab label `Test Run · <name>`.
   */
  onOpenTestRun: (runId: string, owner: TestRunOwner, ownerName: string) => void;
  /**
   * id of the run currently displayed in the active main-panel tab, if
   * that tab is a Run Report. The matching row in the table is
   * highlighted so the user can see which run they're looking at.
   */
  activeRunId?: string | null;
}

const BottomPanel: React.FC<BottomPanelProps> = ({
  activeTab,
  onTabChange,
  contextOwner,
  onOpenTestRun,
  activeRunId,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  // The Test Runs tab only renders when there's an owner context. If
  // the user navigated away from an owner-having tab while looking at
  // Test Runs, fall back to Traffic so we don't strand them on a
  // hidden tab. Done in an effect rather than render-time so the parent's
  // bottomPanelTab state stays consistent.
  useEffect(() => {
    if (!contextOwner && activeTab === 'test-runs') {
      onTabChange('traffic');
    }
  }, [contextOwner, activeTab, onTabChange]);

  const tabs = useMemo<BottomTab[]>(() => {
    if (!contextOwner) return STATIC_TABS;
    return [...STATIC_TABS, { key: 'test-runs', label: 'Test Runs' }];
  }, [contextOwner]);

  // ── Test Runs loader ──────────────────────────────────────────────

  const [runs, setRuns] = useState<ListedRun[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRuns = useCallback(() => {
    if (!contextOwner) {
      setRuns([]);
      return;
    }
    setLoading(true);
    runtime.sendMessage(
      {
        type: 'listTestRunsForOwner',
        ownerType: contextOwner.type,
        ownerId: contextOwner.id,
      },
      (response: unknown) => {
        const data = response as { success?: boolean; runs?: ListedRun[] } | null;
        setRuns(data?.success && data.runs ? data.runs : []);
        setLoading(false);
      },
    );
  }, [contextOwner]);

  useEffect(() => {
    if (activeTab === 'test-runs') loadRuns();
  }, [activeTab, loadRuns]);

  // Refresh whenever the background announces a new finish or a delete
  // for the owner we're currently looking at. Cheap to subscribe; the
  // background suppresses these broadcasts when no listeners exist.
  useEffect(() => {
    if (!contextOwner) return;
    type RefreshMsg = {
      type?: string;
      ownerType?: TestRunOwnerType;
      ownerId?: string;
    };
    const listener = (msg: unknown): void => {
      const m = msg as RefreshMsg;
      if (!m?.type) return;
      if (m.type === 'testRunFinished') {
        if (m.ownerType === contextOwner.type && m.ownerId === contextOwner.id) {
          loadRuns();
        }
      } else if (m.type === 'testRunDeleted' || m.type === 'testRunsClearedForOwner') {
        loadRuns();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [contextOwner, loadRuns]);

  const handleDelete = useCallback(
    (runId: string) => {
      runtime.sendMessage({ type: 'deleteTestRun', runId }, (response: unknown) => {
        const data = response as { success?: boolean } | null;
        if (data?.success) {
          message.success('Deleted');
          loadRuns();
        } else {
          message.error('Failed to delete');
        }
      });
    },
    [message, loadRuns],
  );

  // ── Test Runs table ──────────────────────────────────────────────

  const columns = useMemo<ColumnsType<ListedRun>>(
    () => [
      {
        title: 'When',
        key: 'when',
        width: 160,
        render: (_: unknown, row: ListedRun) => (
          <Text style={{ fontSize: 11 }}>{new Date(row.endedAt).toLocaleString()}</Text>
        ),
      },
      {
        title: 'URL',
        key: 'url',
        ellipsis: true,
        render: (_: unknown, row: ListedRun) => (
          <Text style={{ fontSize: 11 }} ellipsis>
            {row.url}
          </Text>
        ),
      },
      {
        title: 'Outcome',
        key: 'outcome',
        width: 220,
        render: (_: unknown, row: ListedRun) => {
          const statuses = Object.values(row.ruleStatuses);
          const executed = statuses.filter((s) => s === 'executed').length;
          const noFire = statuses.filter((s) => s === 'no-fire').length;
          const skipped = statuses.filter((s) => s === 'skipped').length;
          return (
            <Space size={4}>
              {executed > 0 && (
                <Tag color="success" style={{ margin: 0, fontSize: 10 }}>
                  {executed} executed
                </Tag>
              )}
              {row.fires.length > 0 && (
                <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                  {row.fires.length} fires
                </Tag>
              )}
              {noFire > 0 && <Tag style={{ margin: 0, fontSize: 10 }}>{noFire} no-fire</Tag>}
              {skipped > 0 && <Tag style={{ margin: 0, fontSize: 10 }}>{skipped} skipped</Tag>}
            </Space>
          );
        },
      },
      {
        title: '',
        key: 'stale',
        width: 70,
        render: (_: unknown, row: ListedRun) =>
          row.isStale ? (
            <Tooltip title="The owning rule, folder, or collection has changed since this test ran.">
              <Tag
                color="warning"
                style={{ margin: 0, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 2 }}
              >
                <WarningOutlined />
                Stale
              </Tag>
            </Tooltip>
          ) : null,
      },
      {
        title: '',
        key: 'actions',
        width: 36,
        render: (_: unknown, row: ListedRun) => (
          <Tooltip title="Delete this run">
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.id);
              }}
            />
          </Tooltip>
        ),
      },
    ],
    [handleDelete],
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="rules-bottom-panel" style={{ background: token.colorBgLayout }}>
      <div
        className="rules-bottom-tabs"
        style={{
          background: token.colorBgLayout,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {tabs.map((tab) => (
          <span
            key={tab.key}
            className={`rules-bottom-tab ${activeTab === tab.key ? 'active' : ''}`}
            style={
              activeTab === tab.key
                ? { color: token.colorText, borderBottomColor: token.colorPrimary }
                : { color: token.colorTextSecondary }
            }
            onClick={() => onTabChange(tab.key)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onTabChange(tab.key);
            }}
          >
            {tab.key === 'test-runs' && <ExperimentOutlined style={{ marginRight: 4, fontSize: 11 }} />}
            {tab.label}
            {tab.key === 'test-runs' && runs.length > 0 && (
              <Tag style={{ marginLeft: 6, fontSize: 9, padding: '0 4px', lineHeight: '14px' }}>{runs.length}</Tag>
            )}
          </span>
        ))}

        {activeTab === 'traffic' && (
          <span className="rules-live-indicator" style={{ color: token.colorTextSecondary }}>
            <span className="rules-dot rules-dot-blink" style={{ background: token.colorTextTertiary }} />
            Offline
          </span>
        )}
      </div>

      <div
        className={`rules-bottom-content${activeTab === 'test-runs' ? ' is-table' : ''}`}
        style={{ color: token.colorTextTertiary }}
      >
        {activeTab === 'traffic' && <Text type="secondary">Traffic monitoring available in desktop app.</Text>}
        {activeTab === 'console' && <Text type="secondary">Console available in desktop app.</Text>}
        {activeTab === 'terminal' && <Text type="secondary">Terminal available in desktop app.</Text>}
        {activeTab === 'test-runs' && contextOwner && (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {runs.length === 0 && !loading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {contextOwner.type === 'workspace'
                      ? "No workspace-wide runs yet. Use the popup's Test button on the All Rules tab to capture one."
                      : `No runs yet for this ${contextOwner.type}. Run a test from the toolbar above to capture one.`}
                  </Text>
                }
                style={{ marginTop: 24 }}
              />
            ) : (
              // Virtual table mirrors the popup's matched-requests inner
              // table — antd's built-in virtualization keeps scrolling
              // smooth even though the per-owner cap (20) means this is
              // rarely the hot path. Scroll y is required for `virtual`
              // to engage; set to the bottom-panel content height.
              <Table<ListedRun>
                dataSource={runs}
                columns={columns}
                rowKey="id"
                size="small"
                loading={loading}
                pagination={false}
                showHeader={false}
                virtual
                scroll={{ y: 180 }}
                onRow={(row) => ({
                  onClick: () => onOpenTestRun(row.id, { type: row.ownerType, id: row.ownerId }, row.ownerNameAtRun),
                  style: { cursor: 'pointer' },
                })}
                rowClassName={(row) => (row.id === activeRunId ? 'rules-bottom-row-active' : '')}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
