/**
 * BottomPanel — bottom dock with two data modes for the Test Runs tab.
 *
 * Three "always-on" tabs (Traffic / Console / Terminal) are placeholders
 * for desktop-only features. The fourth tab — Test Runs — operates in one
 * of two modes:
 *
 *   1. **Contextual mode** — the active main-panel tab has a test-run
 *      owner stamp (rule / folder / collection / workspace). The tab
 *      shows that owner's bucket, exactly as before. This is the path
 *      exercised when the user clicks a row inside an entity overview
 *      or opens a run-report tab directly.
 *
 *   2. **Global mode** — no contextual owner, but the user has opened
 *      Test Runs from the left ActivityBar launcher. The tab shows
 *      every persisted run across every owner, newest-first, with an
 *      extra "Owner" column so rows from different buckets are
 *      distinguishable. Backed by `listAllTestRuns` on the store.
 *
 * The tab is always visible now (previously it was hidden when no owner
 * existed). Mode selection is implicit: contextOwner === null → global.
 */

import { DeleteOutlined, ExperimentOutlined, FundViewOutlined, WarningOutlined } from '@ant-design/icons';
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
  // Page Traffic — desktop-only placeholder for the live request feed.
  // The left-bottom activity-bar "Page Traffic" launcher routes here.
  { key: 'traffic', label: 'Page Traffic' },
  // Test Runs — always present. Contextual mode filters to the active
  // entity's bucket; global mode lists every persisted run.
  { key: 'test-runs', label: 'Test Runs' },
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

  // Test Runs tab is always visible now; no need to force-swap when the
  // owner disappears — we transparently swap from contextual to global
  // mode and refresh.

  const tabs = useMemo<BottomTab[]>(() => STATIC_TABS, []);

  const isGlobalMode = contextOwner === null;

  // ── Test Runs loader ──────────────────────────────────────────────

  const [runs, setRuns] = useState<ListedRun[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRuns = useCallback(() => {
    setLoading(true);
    const msg = contextOwner
      ? { type: 'listTestRunsForOwner', ownerType: contextOwner.type, ownerId: contextOwner.id }
      : { type: 'listAllTestRuns' };
    runtime.sendMessage(msg, (response: unknown) => {
      const data = response as { success?: boolean; runs?: ListedRun[] } | null;
      setRuns(data?.success && data.runs ? data.runs : []);
      setLoading(false);
    });
  }, [contextOwner]);

  useEffect(() => {
    if (activeTab === 'test-runs') loadRuns();
  }, [activeTab, loadRuns]);

  // Refresh on background-side mutations. In contextual mode we only
  // care about the matching owner; in global mode every finish/delete
  // is relevant.
  useEffect(() => {
    type RefreshMsg = {
      type?: string;
      ownerType?: TestRunOwnerType;
      ownerId?: string;
    };
    const listener = (msg: unknown): void => {
      const m = msg as RefreshMsg;
      if (!m?.type) return;
      if (m.type === 'testRunFinished') {
        if (!contextOwner) {
          loadRuns();
        } else if (m.ownerType === contextOwner.type && m.ownerId === contextOwner.id) {
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
      // Owner column only in global mode — in contextual mode the user
      // already knows which entity they are looking at, so repeating it
      // on every row is just noise.
      ...(isGlobalMode
        ? [
            {
              title: 'Owner',
              key: 'owner',
              width: 200,
              render: (_: unknown, row: ListedRun) => (
                <Space size={4}>
                  <Tag style={{ margin: 0, fontSize: 10, textTransform: 'capitalize' }}>{row.ownerType}</Tag>
                  <Text style={{ fontSize: 11 }} ellipsis>
                    {row.ownerNameAtRun}
                  </Text>
                </Space>
              ),
            },
          ]
        : []),
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
    [handleDelete, isGlobalMode],
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
            {tab.key === 'traffic' && <FundViewOutlined style={{ marginRight: 4, fontSize: 11 }} />}
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
        {activeTab === 'traffic' && (
          <Text type="secondary">Page traffic monitoring available in desktop app.</Text>
        )}
        {activeTab === 'test-runs' && (
          <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {runs.length === 0 && !loading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {isGlobalMode
                      ? 'No test runs have been captured yet. Run a test from any collection, folder, rule, or extension popup to populate this panel.'
                      : contextOwner?.type === 'workspace'
                        ? "No workspace-wide runs yet. Use the popup's Test button on the All Rules tab to capture one."
                        : `No runs yet for this ${contextOwner?.type ?? 'item'}. Run a test from the toolbar above to capture one.`}
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
