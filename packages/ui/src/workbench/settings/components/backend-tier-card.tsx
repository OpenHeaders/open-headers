import { Tooltip } from 'antd';
import type React from 'react';
import {
  FILL_BLUE,
  FILL_GREEN,
  FILL_PURPLE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from '../../components/docs/diagrams/_shared';
import { OH_GREEN, OH_GREEN_TINT } from '../../components/docs/diagrams/open-headers/_shared';
import type { BackendMode } from '../schema/backend';

type Icon = 'browser' | 'desktop' | 'daemon' | 'vm';
type Bullet = { text: string; status: 'carried' | 'new' };
type PlatformItem = { label: string; note?: string };
type PlatformGroup = { label?: string; items: PlatformItem[] };

type FooterCategory = { label: string; items: { range: string; note?: string }[] };
type FooterInfo = {
  kind: 'cloud' | 'local';
  label: string;
  url: string;
  categories?: FooterCategory[];
};

type TierDef = {
  title: string;
  sub: string;
  badge: 'TODAY' | 'ROADMAP';
  icon: Icon;
  inheritsFrom?: string;
  bullets: Bullet[];
  platforms: PlatformGroup[];
  footer?: FooterInfo;
};

const TIERS: Partial<Record<BackendMode, TierDef>> = {
  'in-browser': {
    title: 'In-browser',
    sub: 'extension service worker',
    badge: 'TODAY',
    icon: 'browser',
    bullets: [
      { text: 'zero setup', status: 'new' },
      { text: 'single device', status: 'new' },
      { text: 'per-browser instance', status: 'new' },
      { text: 'multi-surface concurrent editing', status: 'new' },
      { text: 'multi-window concurrent editing', status: 'new' },
    ],
    platforms: [
      { items: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari', note: 'soon' }] },
    ],
    footer: {
      kind: 'cloud',
      label: 'N/A',
      url: '(in-process — no clients)',
      categories: [
        {
          label: 'Why no wire?',
          items: [
            {
              range: 'The back-end IS the browser service worker',
              note: 'no port to listen on, no IPC surface exposed to other devices',
            },
          ],
        },
        {
          label: 'Same-browser surfaces',
          items: [
            {
              range: 'browser.runtime messaging',
              note: 'popup / workbench / DevTools / side-panel talk to the SW in-process',
            },
          ],
        },
        {
          label: 'Per-browser instance',
          items: [
            {
              range: 'browser.storage.local',
              note: 'Chrome ≠ Firefox ≠ Edge — separate data per browser, no cross-device, no cross-browser',
            },
          ],
        },
      ],
    },
  },
  'desktop-app': {
    title: 'Desktop app',
    sub: 'embedded server',
    badge: 'TODAY',
    icon: 'desktop',
    inheritsFrom: 'In-browser',
    bullets: [
      { text: 'zero setup', status: 'carried' },
      { text: 'single device', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'Localhost-only', status: 'new' },
      { text: 'multi-browser instances', status: 'new' },
      { text: 'per-app instance', status: 'new' },
      { text: 'native filesystem', status: 'new' },
      { text: 'YAML on disk', status: 'new' },
      { text: 'git integration (local/remote)', status: 'new' },
      { text: 'browser ext · desktop app · CLI', status: 'new' },
    ],
    platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    footer: {
      kind: 'cloud',
      label: 'Localhost',
      url: 'ws://localhost:<port>',
      categories: [
        {
          label: 'IPv4 loopback',
          items: [{ range: '127.0.0.0/8', note: 'typically 127.0.0.1' }],
        },
        {
          label: 'IPv6 loopback',
          items: [{ range: '::1/128' }],
        },
        {
          label: 'Default port',
          items: [{ range: '8137', note: 'override in Backend → Connection' }],
        },
      ],
    },
  },
  'local-self-hosted': {
    title: 'Local server',
    sub: 'on your LAN',
    badge: 'ROADMAP',
    icon: 'daemon',
    inheritsFrom: 'Desktop app',
    bullets: [
      { text: 'multi-browser instances', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'native filesystem', status: 'carried' },
      { text: 'YAML on disk', status: 'carried' },
      { text: 'git integration (local/remote)', status: 'carried' },
      { text: 'browser ext · desktop app · CLI', status: 'carried' },
      { text: 'minimal setup', status: 'new' },
      { text: 'Localhost-supported', status: 'new' },
      { text: 'LAN-reachable', status: 'new' },
      { text: 'multi-app instances', status: 'new' },
      { text: 'multiple devices', status: 'new' },
      { text: 'headless by default · website opt-in', status: 'new' },
    ],
    platforms: [
      { label: 'All OS', items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] },
      {
        label: 'Embedded',
        items: [
          { label: 'Raspberry Pi' },
          { label: 'NAS' },
          { label: 'Mini PC' },
          { label: 'Home server' },
          { label: 'Old laptop' },
        ],
      },
    ],
    footer: {
      kind: 'cloud',
      label: 'Localhost/LAN',
      url: 'ws://<lan-host>:<port>',
      categories: [
        {
          label: 'Localhost / loopback',
          items: [
            { range: '127.0.0.0/8', note: 'IPv4 — daemon on your own box (Docker, sidecar)' },
            { range: '::1/128', note: 'IPv6' },
          ],
        },
        {
          label: 'RFC1918 private IPv4',
          items: [
            { range: '10.0.0.0/8' },
            { range: '172.16.0.0/12' },
            { range: '192.168.0.0/16' },
          ],
        },
        {
          label: 'IPv6 ULA',
          items: [{ range: 'fc00::/7', note: 'practically fd00::/8 — IPv6 private allocation' }],
        },
        {
          label: 'CGNAT / overlay',
          items: [{ range: '100.64.0.0/10', note: 'Tailscale, etc.' }],
        },
        {
          label: 'Zero-config / no-DHCP fallback',
          items: [
            { range: '169.254.0.0/16', note: 'IPv4 link-local (APIPA)' },
            { range: 'fe80::/10', note: 'IPv6 link-local — every interface auto-assigns one' },
          ],
        },
        {
          label: 'mDNS hostnames',
          items: [{ range: '*.local', note: 'Bonjour / Avahi' }],
        },
      ],
    },
  },
  'remote-self-hosted': {
    title: 'Remote server',
    sub: 'on the WAN',
    badge: 'ROADMAP',
    icon: 'vm',
    inheritsFrom: 'Local server',
    bullets: [
      { text: 'multiple devices', status: 'carried' },
      { text: 'multi-browser instances', status: 'carried' },
      { text: 'multi-app instances', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'native filesystem', status: 'carried' },
      { text: 'YAML on disk', status: 'carried' },
      { text: 'git integration (local/remote)', status: 'carried' },
      { text: 'browser ext · desktop app · CLI', status: 'carried' },
      { text: 'Localhost-supported', status: 'carried' },
      { text: 'LAN-reachable', status: 'carried' },
      { text: 'headless by default · website opt-in', status: 'carried' },
      { text: 'standard setup', status: 'new' },
      { text: 'WAN/Internet-reachable', status: 'new' },
      { text: 'team-ready', status: 'new' },
      { text: 'SSO Auth', status: 'new' },
      { text: 'RBAC user management', status: 'new' },
      { text: 'audit logs & reports', status: 'new' },
    ],
    platforms: [
      { label: 'Hyperscalers', items: [{ label: 'AWS' }, { label: 'Azure' }, { label: 'Google Cloud' }] },
      {
        label: 'EU-native',
        items: [{ label: 'Scaleway' }, { label: 'OVHcloud' }, { label: 'Hetzner' }, { label: 'IONOS' }],
      },
      { label: 'Other', items: [{ label: 'DigitalOcean' }, { label: 'Heroku' }] },
      { label: 'Enterprise', items: [{ label: 'Your cloud' }, { label: 'On-prem' }] },
    ],
    footer: {
      kind: 'cloud',
      label: 'Internet/WAN',
      url: 'wss://<your-host>',
      categories: [
        {
          label: 'Public DNS hostname',
          items: [{ range: 'oh.example.com', note: 'recommended — TLS cert' }],
        },
        {
          label: 'Public IPv4',
          items: [{ range: 'a.b.c.d', note: 'anything outside RFC1918 / 100.64/10' }],
        },
        {
          label: 'Public IPv6',
          items: [{ range: '2000::/3', note: 'globally routable' }],
        },
        {
          label: 'Transport',
          items: [{ range: 'wss:// (TLS)', note: 'required — clients refuse ws:// to a non-loopback host' }],
        },
      ],
    },
  },
};

interface Props {
  mode: BackendMode;
}

const VB_W = 600;
// Shared card geometry across all tiers — constant height keeps the
// left column from jumping when the user previews different modes.
const VB_H_TALL = 370;
const RECT_X = 30;
const RECT_Y = 18;
const RECT_W = 540;
const RECT_H_TALL = 280;

const HEADER_COL_W = 140;
const PLATFORM_COL_W = 95;
const COL_GAP = 8;

const HEADER_X = RECT_X + 10;
const SEPARATOR_1_X = HEADER_X + HEADER_COL_W;
const BULLETS_X = SEPARATOR_1_X + COL_GAP;
const PLATFORM_X = RECT_X + RECT_W - PLATFORM_COL_W - 10;
const SEPARATOR_2_X = PLATFORM_X - COL_GAP;

const BULLET_X = BULLETS_X + 16;
const BULLET_H = 14;
const BULLET_H_TIGHT = 12;
const BULLET_H_DENSE = 11;
const PLATFORM_CHIP_H = 16;
const PLATFORM_CHIP_H_DENSE = 13;
const PLATFORM_CHIP_GAP = 5;
const PLATFORM_CHIP_GAP_DENSE = 3;
const PLATFORM_GROUP_LABEL_H = 12;
const PLATFORM_GROUP_GAP = 5;

const MUTED = 'var(--ant-color-text-tertiary)';
const MUTED_DOT = 'var(--ant-color-text-quaternary)';

const FooterDetails: React.FC<{ categories: FooterCategory[] }> = ({ categories }) => (
  <div style={{ fontSize: 12, lineHeight: 1.55 }}>
    {categories.map((cat, ci) => (
      <div
        key={cat.label}
        style={{
          marginBottom: ci === categories.length - 1 ? 0 : 10,
          paddingBottom: ci === categories.length - 1 ? 0 : 8,
          borderBottom: ci === categories.length - 1 ? 'none' : '1px solid var(--ant-color-border-secondary)',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 10.5,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: 'var(--ant-color-primary)',
            marginBottom: 4,
          }}
        >
          {cat.label}
        </div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {cat.items.map((it) => (
            <li key={it.range} style={{ marginBottom: 2, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: 'var(--ant-color-primary)', flex: 'none' }}>•</span>
              <code
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 11.5,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: 'var(--ant-color-fill-tertiary)',
                  color: 'var(--ant-color-text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.range}
              </code>
              {it.note && (
                <span style={{ color: 'var(--ant-color-text-secondary)', marginLeft: 6 }}>— {it.note}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

const CloudGlyph: React.FC<{ cx: number; cy: number; scale?: number; label?: string }> = ({
  cx,
  cy,
  scale = 0.6,
  label,
}) => {
  const s = scale;
  const d = `
    M ${cx - 28 * s} ${cy + 6 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${4 * s} ${-18 * s}
    a ${12 * s} ${12 * s} 0 0 1 ${22 * s} ${-4 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${20 * s} ${4 * s}
    a ${10 * s} ${10 * s} 0 0 1 ${4 * s} ${20 * s}
    h ${-50 * s}
    a ${8 * s} ${8 * s} 0 0 1 0 ${-2 * s}
    z
  `;
  return (
    <g>
      <path d={d} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeWidth={1} strokeDasharray="3 2" />
      {label && (
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
          {label}
        </text>
      )}
    </g>
  );
};

const IconArt: React.FC<{ kind: Icon; cx: number; cy: number }> = ({ kind, cx, cy }) => {
  switch (kind) {
    case 'browser':
      return (
        <g>
          <rect
            x={cx - 22}
            y={cy - 14}
            width={44}
            height={28}
            rx={3}
            fill="var(--ant-color-bg-container)"
            stroke={STROKE_BLUE}
          />
          <rect x={cx - 22} y={cy - 14} width={44} height={7} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
          <circle cx={cx - 18} cy={cy - 10.5} r={1.2} fill={STROKE_BLUE} />
          <circle cx={cx - 14} cy={cy - 10.5} r={1.2} fill={STROKE_BLUE} />
          <circle cx={cx - 10} cy={cy - 10.5} r={1.2} fill={STROKE_BLUE} />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={cx - 18}
              y={cy - 4 + i * 5}
              width={36 - i * 8}
              height={2}
              rx={1}
              fill="var(--ant-color-fill-tertiary)"
            />
          ))}
        </g>
      );
    case 'desktop':
      return (
        <g>
          <rect
            x={cx - 22}
            y={cy - 16}
            width={44}
            height={26}
            rx={2}
            fill="var(--ant-color-bg-container)"
            stroke={STROKE_BLUE}
          />
          <rect x={cx - 19} y={cy - 13} width={38} height={20} fill={FILL_BLUE} stroke={STROKE_BLUE} />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={cx - 16}
              y={cy - 10 + i * 4}
              width={32 - i * 6}
              height={1.8}
              rx={0.8}
              fill="var(--ant-color-bg-container)"
              opacity={0.7}
            />
          ))}
          <rect x={cx - 4} y={cy + 10} width={8} height={4} fill={STROKE_BLUE} />
          <rect x={cx - 10} y={cy + 14} width={20} height={2} rx={1} fill={STROKE_BLUE} />
        </g>
      );
    case 'daemon':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect
                x={cx - 22}
                y={cy - 16 + i * 11}
                width={44}
                height={9}
                rx={2}
                fill={FILL_PURPLE}
                stroke={STROKE_PURPLE}
              />
              <circle cx={cx - 17} cy={cy - 11.5 + i * 11} r={1.8} fill={OH_GREEN} />
            </g>
          ))}
        </g>
      );
    case 'vm':
      return (
        <g>
          <path
            d={`M ${cx - 18} ${cy + 6}
                c -8 0 -8 -10 0 -10
                c 0 -8 12 -8 14 -2
                c 2 -6 14 -4 14 4
                c 6 0 6 8 0 8 Z`}
            fill="var(--ant-color-bg-container)"
            stroke={STROKE_BLUE}
            strokeWidth={1.5}
          />
          <rect x={cx - 4} y={cy - 2} width={8} height={6} rx={1} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        </g>
      );
  }
};

export const BackendTierCard: React.FC<Props> = ({ mode }) => {
  const tier = TIERS[mode];
  if (!tier) return null;

  // All tiers share the taller card geometry so the left rectangle is
  // a consistent height across modes. The right-side topology still
  // varies (single-monitor vs 2x2 device grid) — only the card is fixed.
  const VB_H = VB_H_TALL;
  const RECT_H = RECT_H_TALL;

  const isToday = tier.badge === 'TODAY';
  // Card border is always a neutral grey — the TODAY / ROADMAP signal
  // lives in the header badge, not the frame, so all four cards read as
  // siblings rather than the first two grabbing attention with a blue
  // outline.
  const accent = 'var(--ant-color-border)';
  const badgeStroke = isToday ? STROKE_BLUE : 'rgba(212, 145, 0, 1)';
  const badgeBg = isToday ? FILL_BLUE : 'rgba(250, 173, 20, 0.18)';

  const headerCX = HEADER_X + HEADER_COL_W / 2;
  const iconCY = RECT_Y + 38;
  const titleY = RECT_Y + 78;
  const subY = RECT_Y + 92;
  const badgeY = RECT_Y + 104;

  const carried = tier.bullets.filter((b) => b.status === 'carried');
  const newOnes = tier.bullets.filter((b) => b.status === 'new');

  const dense = tier.bullets.length > 10;
  const lineH = dense ? BULLET_H_DENSE : BULLET_H_TIGHT;
  const hasGroupLabels = tier.platforms.some((g) => g.label);
  const chipH = dense || hasGroupLabels ? PLATFORM_CHIP_H_DENSE : PLATFORM_CHIP_H;
  const chipGap = dense || hasGroupLabels ? PLATFORM_CHIP_GAP_DENSE : PLATFORM_CHIP_GAP;

  const platformsStartY = RECT_Y + 14;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label={`${tier.title} tier card`}>
      <rect
        x={RECT_X}
        y={RECT_Y}
        width={RECT_W}
        height={RECT_H}
        rx={10}
        fill="var(--ant-color-bg-container)"
        stroke={accent}
        strokeWidth={1.2}
      />

      <line
        x1={SEPARATOR_1_X}
        y1={RECT_Y + 14}
        x2={SEPARATOR_1_X}
        y2={RECT_Y + RECT_H - 14}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 3"
      />
      <line
        x1={SEPARATOR_2_X}
        y1={RECT_Y + 14}
        x2={SEPARATOR_2_X}
        y2={RECT_Y + RECT_H - 14}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 3"
      />

      <IconArt kind={tier.icon} cx={headerCX} cy={iconCY} />
      <text x={headerCX} y={titleY} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
        {tier.title}
      </text>
      <text x={headerCX} y={subY} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {tier.sub}
      </text>
      <rect
        x={headerCX - 36}
        y={badgeY}
        width={72}
        height={18}
        rx={9}
        fill={badgeBg}
        stroke={badgeStroke}
        strokeWidth={1.2}
      />
      <text
        x={headerCX}
        y={badgeY + 12}
        textAnchor="middle"
        fontSize={9}
        fontWeight={800}
        fill={isToday ? TEXT : badgeStroke}
        letterSpacing={1}
      >
        {tier.badge}
      </text>

      {!tier.inheritsFrom ? (
        (() => {
          const startY = RECT_Y + 24;
          return (
            <g>
              {tier.bullets.map((b, j) => (
                <g key={`b-${j}`}>
                  <circle cx={BULLET_X} cy={startY + j * BULLET_H} r={2} fill={STROKE_BLUE} />
                  <text x={BULLET_X + 8} y={startY + 3 + j * BULLET_H} fontSize={10} fill={TEXT}>
                    {b.text}
                  </text>
                </g>
              ))}
            </g>
          );
        })()
      ) : (
        (() => {
          const captionY = RECT_Y + 18;
          const carriedStartY = captionY + 20;
          const carriedEndY = carriedStartY + carried.length * lineH;
          const dottedY = carriedEndY + 2;
          const dottedX = BULLETS_X + 8;
          const dottedW = SEPARATOR_2_X - BULLETS_X - 16;
          const newCaptionY = dottedY + 12;
          const newStartY = newCaptionY + 8;
          const dottedH = newOnes.length * lineH + 18;
          return (
            <g>
              <text
                x={BULLET_X - 4}
                y={captionY}
                fontSize={9}
                fontWeight={700}
                fill={MUTED}
                letterSpacing={0.5}
              >
                INHERITS FROM {tier.inheritsFrom.toUpperCase()}
              </text>
              {carried.map((b, j) => (
                <g key={`c-${j}`}>
                  <circle cx={BULLET_X} cy={carriedStartY + j * lineH} r={1.6} fill={MUTED_DOT} />
                  <text x={BULLET_X + 8} y={carriedStartY + 3 + j * lineH} fontSize={9} fill={MUTED}>
                    {b.text}
                  </text>
                </g>
              ))}
              <rect
                x={dottedX}
                y={dottedY}
                width={dottedW}
                height={dottedH}
                rx={6}
                fill={OH_GREEN_TINT}
                stroke={OH_GREEN}
                strokeWidth={1.3}
                strokeDasharray="4 3"
              />
              <text
                x={BULLET_X - 2}
                y={newCaptionY}
                fontSize={9}
                fontWeight={800}
                fill={OH_GREEN}
                letterSpacing={0.6}
              >
                + NEW IN THIS TIER
              </text>
              {newOnes.map((b, j) => (
                <g key={`n-${j}`}>
                  <circle cx={BULLET_X} cy={newStartY + j * lineH} r={2} fill={STROKE_BLUE} />
                  <text
                    x={BULLET_X + 8}
                    y={newStartY + 3 + j * lineH}
                    fontSize={dense ? 9.5 : 10}
                    fontWeight={600}
                    fill={TEXT}
                  >
                    {b.text}
                  </text>
                </g>
              ))}
            </g>
          );
        })()
      )}

      {tier.footer && (() => {
        const footer = tier.footer;
        const cx = HEADER_X + HEADER_COL_W / 2;
        const cy = RECT_Y + RECT_H - 32;
        const glyph =
          footer.kind === 'cloud' ? (
            <CloudGlyph cx={cx} cy={cy} scale={1.3} label={footer.label} />
          ) : (
            <g>
              <rect
                x={cx - 44}
                y={cy - 9}
                width={88}
                height={18}
                rx={9}
                fill={FILL_GREEN}
                stroke={STROKE_GREEN}
                strokeWidth={1}
              />
              <text x={cx} y={cy + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
                {footer.label}
              </text>
            </g>
          );
        const urlY = cy + 22;
        // Estimate URL text width to position the (i) icon right after.
        // Monospace at fontSize=10 ≈ 6px/char; centered text, so info
        // icon sits a half-width + 8px to the right of cx.
        const urlHalfW = (footer.url.length * 6) / 2;
        const infoCx = cx + urlHalfW + 10;
        const infoCy = urlY - 4;
        return (
          <g>
            {glyph}
            <text
              x={cx}
              y={urlY}
              textAnchor="middle"
              fontSize={10}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={TEXT}
            >
              {footer.url}
            </text>
            {footer.categories && (
              <Tooltip
                title={<FooterDetails categories={footer.categories} />}
                placement="top"
                color="var(--ant-color-bg-elevated)"
                overlayStyle={{ maxWidth: 560 }}
                overlayInnerStyle={{
                  backgroundColor: 'var(--ant-color-bg-elevated)',
                  color: 'var(--ant-color-text)',
                  boxShadow: 'var(--ant-box-shadow-secondary)',
                  border: '1px solid var(--ant-color-border-secondary)',
                }}
                styles={{ root: { maxWidth: 560 } }}
              >
                <g style={{ cursor: 'help' }}>
                  <circle
                    cx={infoCx}
                    cy={infoCy}
                    r={6}
                    fill="var(--ant-color-fill-tertiary)"
                    stroke="var(--ant-color-border)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={infoCx}
                    y={infoCy + 3}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={700}
                    fontStyle="italic"
                    fill={TEXT_DIM}
                  >
                    i
                  </text>
                </g>
              </Tooltip>
            )}
          </g>
        );
      })()}

      <text x={PLATFORM_X} y={platformsStartY + 8} fontSize={9} fontWeight={800} fill={MUTED} letterSpacing={0.6}>
        SUPPORTS
      </text>
      {(() => {
        const els: React.ReactNode[] = [];
        let cursorY = platformsStartY + 22;
        tier.platforms.forEach((group, gi) => {
          if (group.label) {
            els.push(
              <text
                key={`gl-${gi}`}
                x={PLATFORM_X}
                y={cursorY + 9}
                fontSize={8}
                fontWeight={700}
                fill={MUTED}
                letterSpacing={0.4}
              >
                {group.label.toUpperCase()}
              </text>,
            );
            cursorY += PLATFORM_GROUP_LABEL_H;
          }
          group.items.forEach((p, pi) => {
            const chipY = cursorY;
            els.push(
              <g key={`p-${gi}-${pi}`}>
                <rect
                  x={PLATFORM_X}
                  y={chipY}
                  width={PLATFORM_COL_W}
                  height={chipH}
                  rx={3}
                  fill={FILL_BLUE}
                  stroke={STROKE_BLUE}
                  strokeWidth={0.8}
                />
                <text x={PLATFORM_X + 6} y={chipY + chipH - 4} fontSize={chipH <= 13 ? 8.5 : 9} fontWeight={700} fill={TEXT}>
                  {p.label}
                </text>
                {p.note && (
                  <text
                    x={PLATFORM_X + PLATFORM_COL_W - 6}
                    y={chipY + chipH - 4}
                    textAnchor="end"
                    fontSize={7}
                    fontStyle="italic"
                    fill={MUTED}
                  >
                    {p.note}
                  </text>
                )}
              </g>,
            );
            cursorY += chipH + chipGap;
          });
          if (gi < tier.platforms.length - 1) cursorY += PLATFORM_GROUP_GAP;
        });
        return els;
      })()}
    </svg>
  );
};
