/**
 * DeepNetworkInspectionPanel — bottom-dock placeholder for the
 * desktop-only live request feed (connection + HTTP inspection).
 * Sample data only; the real feed ships with the desktop proxy tier.
 */

import { Segmented, Space, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

const LAYER_COLORS: Record<string, string> = {
  L4: 'geekblue',
  TLS: 'gold',
  L7: 'green',
};

interface ConnectionLine {
  layer: keyof typeof LAYER_COLORS;
  text: string;
}

// L4 + L7 only — the connection and application layers users actually
// act on. Raw L2/L3 packet capture is deliberately out of scope.
const CONNECTION_LINES: ConnectionLine[] = [
  { layer: 'L4', text: 'TCP 51234 → 443, window 65535, RTT 47 ms, 0 retransmissions' },
  { layer: 'TLS', text: 'TLSv1.3 application_data, handshake 124 ms, encrypted (44 bytes payload)' },
];

const HTTP2_LINES: string[] = [
  ':method = GET',
  ':path = /api/users',
  ':authority = api.example.com',
  '(+ decoded HPACK contents shown)',
];

// Sample-feed annotation fragments — illustration data like the lines
// above, split so the stream number can carry its own accent color.
const CORRELATION_NOTE = "│  correlated with proxy's record ↓";
const STREAM_LINE = { prefix: 'HTTP/2 stream', num: '5', suffix: 'HEADERS frame' } as const;

const STATS: { label: string; value: string; tone: 'ok' | 'info' | 'warn' }[] = [
  { label: 'TCP retransmissions', value: '0', tone: 'ok' },
  { label: 'Round-trip time', value: '47 ms', tone: 'info' },
  { label: 'TLS handshake', value: '124 ms', tone: 'info' },
  { label: 'Waiting for response', value: '89 ms', tone: 'info' },
  { label: 'Receiving body', value: '12 ms', tone: 'info' },
];

interface TierSpec {
  num: 1 | 2;
  title: string;
  color: string;
  accentToken: 'colorInfo' | 'colorPrimary';
  solves: string;
  trust: string;
  power: string;
  friction: string;
  wall?: string[];
}

const TIERS: TierSpec[] = [
  {
    num: 1,
    title: 'Browser extension',
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
      '"I need to see why a connection is slow — RTT, retransmissions, TLS handshake"',
    ],
  },
  {
    num: 2,
    title: 'Desktop app — Connection + HTTP inspection (L4 + L7)',
    color: 'geekblue',
    accentToken: 'colorPrimary',
    solves:
      '"I want connection health and full HTTP for any traffic from my machine — and the ability to modify, replay, or mock it."',
    trust: 'Install CA cert + admin permission',
    power:
      'High — L4 connection metrics (RTT, retransmissions, TLS handshake) alongside full L7 HTTP visibility, modification, replay, and mock',
    friction: 'One click — app installs the CA and wires the proxy for you',
  },
];

type TrafficView = 'connection' | 'tiers';

function DeepNetworkInspectionPlaceholder() {
  const t = useT();
  const { token } = theme.useToken();
  const [view, setView] = useState<TrafficView>('tiers');
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
          <Tag color="orange" style={{ margin: 0, fontWeight: 600 }}>
            {t('workbench.deepNetwork.comingSoon')}
          </Tag>
          <Text strong style={{ fontSize: 13 }}>
            {t('workbench.deepNetwork.heading')}
          </Text>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('workbench.deepNetwork.description')}
          </Text>
        </div>
        <div style={{ marginTop: 10 }}>
          <Segmented<TrafficView>
            size="small"
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { label: t('workbench.deepNetwork.viewTiers'), value: 'tiers' },
              { label: t('workbench.deepNetwork.viewConnection'), value: 'connection' },
            ]}
          />
        </div>
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto', overscrollBehavior: 'none',
          padding: '14px 16px',
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          fontSize: 12.5,
          lineHeight: 1.7,
        }}
      >
        {view === 'connection' && <ConnectionView token={token} layerBadge={layerBadge} toneColor={toneColor} />}
        {view === 'tiers' && <TierRoadmapView token={token} />}
      </div>
    </div>
  );
}

interface ConnectionViewProps {
  token: ReturnType<typeof theme.useToken>['token'];
  layerBadge: (layer: keyof typeof LAYER_COLORS) => React.ReactNode;
  toneColor: (tone: 'ok' | 'info' | 'warn') => string;
}

function ConnectionView({ token, layerBadge, toneColor }: ConnectionViewProps) {
  const t = useT();
  return (
    <>
        {CONNECTION_LINES.map((line) => (
          <div key={line.layer} style={{ display: 'flex', alignItems: 'baseline' }}>
            {layerBadge(line.layer)}
            <span style={{ color: token.colorText }}>{line.text}</span>
          </div>
        ))}

        <div style={{ margin: '8px 0 4px 54px', color: token.colorTextTertiary }}>│</div>
        <div style={{ margin: '0 0 4px 54px', color: token.colorTextTertiary, fontStyle: 'italic' }}>
          {CORRELATION_NOTE}
        </div>
        <div style={{ margin: '0 0 8px 54px', color: token.colorTextTertiary }}>│</div>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          {layerBadge('L7')}
          <span style={{ color: token.colorText }}>
            {STREAM_LINE.prefix} <span style={{ color: token.colorPrimary, fontWeight: 600 }}>{STREAM_LINE.num}</span>{' '}
            {STREAM_LINE.suffix}
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
            {t('workbench.deepNetwork.stats')}
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
  const t = useT();
  const accent = (key: TierSpec['accentToken']): string =>
    key === 'colorInfo' ? token.colorInfo : token.colorPrimary;

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
                {t('workbench.deepNetwork.rowSolves')}
              </Text>
              <span style={{ fontStyle: 'italic', color: token.colorText }}>{tier.solves}</span>

              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.deepNetwork.rowTrust')}
              </Text>
              <span style={{ color: token.colorText }}>{tier.trust}</span>

              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.deepNetwork.rowPower')}
              </Text>
              <span style={{ color: token.colorText }}>{tier.power}</span>

              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.deepNetwork.rowFriction')}
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
                {t('workbench.deepNetwork.wall')}
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

interface DeepNetworkInspectionPanelProps {
  /** Title-bar `(i)` popover copy for the tool window. */
  info: InfoPopoverContent;
  /** Hide handler — wired to the shared PanelHeader's − button. */
  onHide: () => void;
}

const DeepNetworkInspectionPanel: React.FC<DeepNetworkInspectionPanelProps> = ({ info, onHide }) => {
  const t = useT();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const { token } = theme.useToken();

  return (
    <div className="rules-bottom-panel">
      <PanelHeader
        wiring={headerWiring}
        title={<strong>{t('workbench.toolWindows.deepNetworkInspection')}</strong>}
        info={info}
      />
      <div className="rules-bottom-content is-fill" style={{ color: token.colorTextTertiary }}>
        <DeepNetworkInspectionPlaceholder />
      </div>
    </div>
  );
};

export default DeepNetworkInspectionPanel;
