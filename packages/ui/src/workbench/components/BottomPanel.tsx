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
import { hostBridge, type ListedTestRun } from '@openheaders/core/bridge';
import { App, Button, Empty, Segmented, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

// ── Deep Network Inspection placeholder (desktop-only feature preview) ─────────

const LAYER_COLORS: Record<string, string> = {
  L2: 'magenta',
  L3: 'purple',
  L4: 'geekblue',
  TLS: 'gold',
  L7: 'green',
};

interface PacketLine {
  layer: keyof typeof LAYER_COLORS;
  text: string;
}

const PACKET_LINES: PacketLine[] = [
  { layer: 'L2', text: 'Ethernet frame, ~1500 bytes' },
  { layer: 'L3', text: 'IPv4 192.168.1.5 → 93.184.216.34, TTL 64' },
  { layer: 'L4', text: 'TCP seq 1245, port 51234 → 443, window 65535, ACK' },
  { layer: 'TLS', text: 'TLSv1.3 application_data, encrypted (44 bytes payload)' },
];

const HTTP2_LINES: string[] = [
  ':method = GET',
  ':path = /api/users',
  ':authority = api.example.com',
  '(+ decoded HPACK contents shown)',
];

const STATS: { label: string; value: string; tone: 'ok' | 'info' | 'warn' }[] = [
  { label: 'TCP retransmissions', value: '0', tone: 'ok' },
  { label: 'Round-trip time', value: '47 ms', tone: 'info' },
  { label: 'TLS handshake', value: '124 ms', tone: 'info' },
  { label: 'Waiting for response', value: '89 ms', tone: 'info' },
  { label: 'Receiving body', value: '12 ms', tone: 'info' },
];

interface TierSpec {
  num: 1 | 2 | 3;
  title: string;
  color: string;
  accentToken: 'colorInfo' | 'colorPrimary' | 'colorWarning';
  solves: string;
  trust: string;
  power: string;
  friction: string;
  wall?: string[];
}

const TIERS: TierSpec[] = [
  {
    num: 1,
    title: 'Browser extension (instant install)',
    color: 'blue',
    accentToken: 'colorInfo',
    solves: '"I want to see and modify some HTTP requests from this page right now."',
    trust: '"Allow this extension on this site"',
    power: 'Medium (URLs, headers, cookies, redirects, request/response shaping via the full rule-action set)',
    friction: 'One click — install from the browser store and it is live',
    wall: [
      '"I need to capture traffic from a native app, CLI tool, or mobile simulator"',
      '"I need to inspect or rewrite streaming response bodies (SSE, chunked, gRPC)"',
      '"I need to replay and mock requests offline, not just modify them in-flight"',
      '"I need to see traffic the browser hides from extensions (service workers, prefetch, etc.)"',
    ],
  },
  {
    num: 2,
    title: 'Desktop app — HTTPS Inspection (MITM proxy)',
    color: 'geekblue',
    accentToken: 'colorPrimary',
    solves: '"I want to see and modify any HTTPS traffic from my browser, with full body access."',
    trust: 'Install CA cert + admin permission',
    power: 'High (full L7 visibility, modification, replay, mock)',
    friction: 'One click — app installs the CA and wires the proxy for you',
    wall: [
      '"Why is this connection slow?"',
      '"What\'s the TCP-level behavior here?"',
      '"What about traffic from apps that pin certs?"',
      '"I need to see DNS, QUIC, raw TCP."',
    ],
  },
  {
    num: 3,
    title: 'Desktop app — Network Capture (packet capture)',
    color: 'volcano',
    accentToken: 'colorWarning',
    solves: '"I want to see ALL network activity on my machine at every layer."',
    trust: 'Admin/sudo + Npcap on Windows',
    power: 'Highest (L2–L7, including non-HTTP, encrypted streams, network anomalies)',
    friction: 'One click — app fetches Npcap/drivers and prompts for the elevation it actually needs',
  },
];

type TrafficView = 'packet' | 'tiers';

function DeepNetworkInspectionPlaceholder() {
  const { token } = theme.useToken();
  const [view, setView] = useState<TrafficView>('packet');
  const toneColor = (tone: 'ok' | 'info' | 'warn'): string =>
    tone === 'ok' ? token.colorSuccess : tone === 'warn' ? token.colorWarning : token.colorInfo;

  const layerBadge = (layer: keyof typeof LAYER_COLORS): React.ReactNode => (
    <Tag color={LAYER_COLORS[layer]} style={{ marginInlineEnd: 8, minWidth: 42, textAlign: 'center', fontWeight: 600 }}>
      {layer}
    </Tag>
  );

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        style={{
          flex: '0 0 auto',
          padding: '10px 14px',
          background: token.colorFillQuaternary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Space size={8} align="center" wrap>
          <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>
            EXAMPLE PREVIEW
          </Tag>
          <Tag color="orange" style={{ margin: 0, fontWeight: 600 }}>
            COMING SOON — DESKTOP APP
          </Tag>
          <Text strong style={{ fontSize: 13 }}>
            MITM Proxy (L7) + Packet Capture (L2–L4)
          </Text>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Unified view of the entire network stack — easy to inspect and modify. Not yet live; sample data shown below.
          </Text>
        </div>
        <div style={{ marginTop: 10 }}>
          <Segmented<TrafficView>
            size="small"
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { label: 'Packet view', value: 'packet' },
              { label: 'Tier roadmap', value: 'tiers' },
            ]}
          />
        </div>
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          padding: '14px 16px',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: 12.5,
          lineHeight: 1.7,
        }}
      >
        {view === 'packet' && <PacketView token={token} layerBadge={layerBadge} toneColor={toneColor} />}
        {view === 'tiers' && <TierRoadmapView token={token} />}
      </div>
    </div>
  );
}

interface PacketViewProps {
  token: ReturnType<typeof theme.useToken>['token'];
  layerBadge: (layer: keyof typeof LAYER_COLORS) => React.ReactNode;
  toneColor: (tone: 'ok' | 'info' | 'warn') => string;
}

function PacketView({ token, layerBadge, toneColor }: PacketViewProps) {
  return (
    <>
        {PACKET_LINES.map((line) => (
          <div key={line.layer} style={{ display: 'flex', alignItems: 'baseline' }}>
            {layerBadge(line.layer)}
            <span style={{ color: token.colorText }}>{line.text}</span>
          </div>
        ))}

        <div style={{ margin: '8px 0 4px 54px', color: token.colorTextTertiary }}>│</div>
        <div style={{ margin: '0 0 4px 54px', color: token.colorTextTertiary, fontStyle: 'italic' }}>
          │  correlated with proxy's record ↓
        </div>
        <div style={{ margin: '0 0 8px 54px', color: token.colorTextTertiary }}>│</div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          {layerBadge('L7')}
          <span style={{ color: token.colorText }}>
            HTTP/2 stream <span style={{ color: token.colorPrimary, fontWeight: 600 }}>5</span> HEADERS frame
          </span>
        </div>
        <div
          style={{
            marginLeft: 54,
            marginTop: 4,
            padding: '8px 12px',
            background: token.colorFillQuaternary,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadius,
          }}
        >
          {HTTP2_LINES.map((line) => {
            const [key, ...rest] = line.split(' = ');
            const value = rest.join(' = ');
            if (!value) {
              return (
                <div key={line} style={{ color: token.colorTextTertiary, fontStyle: 'italic' }}>
                  {line}
                </div>
              );
            }
            return (
              <div key={line}>
                <span style={{ color: token.colorPrimary }}>{key}</span>
                <span style={{ color: token.colorTextTertiary }}> = </span>
                <span style={{ color: token.colorSuccess }}>{value}</span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 18 }}>
          <Text strong style={{ fontSize: 12 }}>
            Stats
          </Text>
          <div
            style={{
              marginTop: 6,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 8,
            }}
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: '8px 12px',
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                  borderLeft: `3px solid ${toneColor(s.tone)}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {s.label}
                </Text>
                <span style={{ fontWeight: 600, color: toneColor(s.tone), fontSize: 13 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
    </>
  );
}

interface TierRoadmapViewProps {
  token: ReturnType<typeof theme.useToken>['token'];
}

function TierRoadmapView({ token }: TierRoadmapViewProps) {
  const accent = (key: TierSpec['accentToken']): string =>
    key === 'colorInfo' ? token.colorInfo : key === 'colorPrimary' ? token.colorPrimary : token.colorWarning;

  return (
    <div style={{ fontFamily: token.fontFamily, fontSize: 13, lineHeight: 1.6 }}>
      {TIERS.map((tier, idx) => (
        <div key={tier.num}>
          <div
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderLeft: `4px solid ${accent(tier.accentToken)}`,
              borderRadius: token.borderRadius,
              padding: '12px 14px',
              background: token.colorBgContainer,
            }}
          >
            <Space size={8} align="center" wrap style={{ marginBottom: 8 }}>
              <Tag color={tier.color} style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>
                TIER {tier.num}
              </Tag>
              <Text strong style={{ fontSize: 13 }}>
                {tier.title}
              </Text>
            </Space>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 6, columnGap: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Solves
              </Text>
              <span style={{ fontStyle: 'italic', color: token.colorText }}>{tier.solves}</span>

              <Text type="secondary" style={{ fontSize: 12 }}>
                Trust required
              </Text>
              <span style={{ color: token.colorText }}>{tier.trust}</span>

              <Text type="secondary" style={{ fontSize: 12 }}>
                Power
              </Text>
              <span style={{ color: token.colorText }}>{tier.power}</span>

              <Text type="secondary" style={{ fontSize: 12 }}>
                Friction
              </Text>
              <span style={{ color: token.colorText }}>{tier.friction}</span>
            </div>
          </div>

          {tier.wall && idx < TIERS.length - 1 && (
            <div
              style={{
                margin: '10px 0 10px 20px',
                paddingLeft: 14,
                borderLeft: `2px dashed ${token.colorBorderSecondary}`,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                You hit a wall:
              </Text>
              <ul style={{ margin: '4px 0 6px 0', paddingLeft: 18 }}>
                {tier.wall.map((q) => (
                  <li key={q} style={{ color: token.colorTextSecondary, fontStyle: 'italic' }}>
                    {q}
                  </li>
                ))}
              </ul>
              <div style={{ color: token.colorTextTertiary, fontSize: 16, lineHeight: 1 }}>▼</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
  // Deep Network Inspection — desktop-only placeholder for the live request feed.
  // The left-bottom activity-bar "Deep Network Inspection" launcher routes here.
  { key: 'inspection', label: 'Deep Network Inspection' },
  // Test Runs — always present. Contextual mode filters to the active
  // entity's bucket; global mode lists every persisted run.
  { key: 'test-runs', label: 'Test Runs' },
];

// ── Component ───────────────────────────────────────────────────────

interface BottomPanelProps {
  /** Title-bar `(i)` popover copy for the active tab's tool window. */
  info: InfoPopoverContent;
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
  /** Hide handler — wired to the shared PanelHeader's − button. */
  onHide: () => void;
}

const BottomPanel: React.FC<BottomPanelProps> = ({
  info,
  activeTab,
  onTabChange,
  contextOwner,
  onOpenTestRun,
  activeRunId,
  onHide,
}) => {
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
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
      ? hostBridge.call('listTestRunsForOwner', { ownerType: contextOwner.type, ownerId: contextOwner.id })
      : hostBridge.call('listAllTestRuns');
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
    const unsubFinished = hostBridge.subscribe('testRunFinished', (payload) => {
      if (!contextOwner) {
        loadRuns();
      } else if (payload.ownerType === contextOwner.type && payload.ownerId === contextOwner.id) {
        loadRuns();
      }
    });
    const unsubDeleted = hostBridge.subscribe('testRunDeleted', () => loadRuns());
    const unsubCleared = hostBridge.subscribe('testRunsClearedForOwner', () => loadRuns());
    return () => {
      unsubFinished();
      unsubDeleted();
      unsubCleared();
    };
  }, [contextOwner, loadRuns]);

  const handleDelete = useCallback(
    (runId: string) => {
      hostBridge.call('deleteTestRun', { runId })
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
        wiring={headerWiring}
        title={<strong>{activeTab === 'test-runs' ? 'Test Runs' : 'Deep Network Inspection'}</strong>}
        info={info}
      />
      <div
        className={`rules-bottom-content${activeTab === 'test-runs' ? ' is-table' : ''}${activeTab === 'inspection' ? ' is-fill' : ''}`}
        style={{ color: token.colorTextTertiary }}
      >
        {activeTab === 'inspection' && <DeepNetworkInspectionPlaceholder />}
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
