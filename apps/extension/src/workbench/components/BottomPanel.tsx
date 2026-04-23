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

import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { call, subscribe } from '@utils/bridge';
import type { ListedTestRun } from '@utils/bridge/contracts';
import { App, Button, Empty, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelHeader } from '@/shared/dock-layout';

const { Text } = Typography;

// ── Types (mirror background test-run-store) ────────────────────────

export type TestRunOwnerType = 'rule' | 'folder' | 'collection' | 'workspace';

export interface TestRunOwner {
  type: TestRunOwnerType;
  id: string;
}

type ListedRun = ListedTestRun;

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
  /** Optional hide handler — wired to the shared PanelHeader's − button. */
  onHide?: () => void;
}

const BottomPanel: React.FC<BottomPanelProps> = ({
  activeTab,
  onTabChange,
  contextOwner,
  onOpenTestRun,
  activeRunId,
  onHide,
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
    const request = contextOwner
      ? call('listTestRunsForOwner', { ownerType: contextOwner.type, ownerId: contextOwner.id })
      : call('listAllTestRuns');
    request
      .then((data) => {
        setRuns(data?.success && data.runs ? data.runs : []);
        setLoading(false);
      })
      .catch(() => {
        setRuns([]);
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
    const unsubFinished = subscribe('testRunFinished', (payload) => {
      if (!contextOwner) {
        loadRuns();
      } else if (payload.ownerType === contextOwner.type && payload.ownerId === contextOwner.id) {
        loadRuns();
      }
    });
    const unsubDeleted = subscribe('testRunDeleted', () => loadRuns());
    const unsubCleared = subscribe('testRunsClearedForOwner', () => loadRuns());
    return () => {
      unsubFinished();
      unsubDeleted();
      unsubCleared();
    };
  }, [contextOwner, loadRuns]);

  const handleDelete = useCallback(
    (runId: string) => {
      call('deleteTestRun', { runId })
        .then((data) => {
          if (data?.success) {
            message.success('Deleted');
            loadRuns();
          } else {
            message.error('Failed to delete');
          }
        })
        .catch(() => message.error('Failed to delete'));
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
  // The shell's dock tab strip now owns tab switching, so this component
  // is a pure content surface for the single selected tab. `tabs`,
  // `onTabChange`, and the legacy tab strip markup have been retired —
  // activeTab alone routes rendering.
  void tabs;
  void onTabChange;

  return (
    <div className="rules-bottom-panel">
      <PanelHeader
        title={<strong>{activeTab === 'test-runs' ? 'Test Runs' : 'Page Traffic'}</strong>}
        onHide={onHide}
      />
      <div
        className={`rules-bottom-content${activeTab === 'test-runs' ? ' is-table' : ''}`}
        style={{ color: token.colorTextTertiary }}
      >
        {activeTab === 'traffic' && <Text type="secondary">Page traffic monitoring available in desktop app.</Text>}
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
