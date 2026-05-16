import type React from 'react';
import {
  FILL_BLUE,
  FILL_PURPLE,
  STROKE_BLUE,
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

type TierDef = {
  title: string;
  sub: string;
  badge: 'TODAY' | 'ROADMAP';
  icon: Icon;
  inheritsFrom?: string;
  bullets: Bullet[];
  platforms: PlatformGroup[];
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
      { text: 'Localhost-only', status: 'new' },
      { text: 'browser.storage.local', status: 'new' },
    ],
    platforms: [
      { items: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari', note: 'soon' }] },
    ],
  },
  'desktop-app': {
    title: 'Desktop app',
    sub: 'embedded back-end',
    badge: 'TODAY',
    icon: 'desktop',
    inheritsFrom: 'In-browser',
    bullets: [
      { text: 'zero setup', status: 'carried' },
      { text: 'single device', status: 'carried' },
      { text: 'multi-surface concurrent editing', status: 'carried' },
      { text: 'multi-window concurrent editing', status: 'carried' },
      { text: 'Localhost-only', status: 'carried' },
      { text: 'multi-browser instances', status: 'new' },
      { text: 'per-app instance', status: 'new' },
      { text: 'native filesystem', status: 'new' },
      { text: 'YAML on disk', status: 'new' },
      { text: 'git integration (local/remote)', status: 'new' },
    ],
    platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
  },
  'local-self-hosted': {
    title: 'Local daemon',
    sub: 'standalone process',
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
      { text: 'minimal setup', status: 'new' },
      { text: 'LAN-reachable', status: 'new' },
      { text: 'multi-app instances', status: 'new' },
      { text: 'multiple devices', status: 'new' },
      { text: 'browser ext · desktop app · CLI', status: 'new' },
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
  },
  'remote-self-hosted': {
    title: 'Your VM',
    sub: 'host it anywhere',
    badge: 'ROADMAP',
    icon: 'vm',
    inheritsFrom: 'Local daemon',
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
  },
};

interface Props {
  mode: BackendMode;
}

const VB_W = 600;
// Two heights matching the right-side topology SVG per mode:
//   - in-browser / desktop-app diagrams use viewBox 600×270 (single monitor)
//   - local-self-hosted / remote-self-hosted use 600×330 (2×2 device grid)
// The card rectangle aligns with the right diagram's main content bounds.
const VB_H_SHORT = 310;
const VB_H_TALL = 370;
const RECT_X = 30;
const RECT_Y = 18;
const RECT_W = 540;
const RECT_H_SHORT = 220;
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

  const tall = mode === 'local-self-hosted' || mode === 'remote-self-hosted';
  const VB_H = tall ? VB_H_TALL : VB_H_SHORT;
  const RECT_H = tall ? RECT_H_TALL : RECT_H_SHORT;

  const isToday = tier.badge === 'TODAY';
  const accent = isToday ? STROKE_BLUE : 'var(--ant-color-border)';
  const badgeStroke = isToday ? OH_GREEN : 'rgba(212, 145, 0, 1)';
  const badgeBg = isToday ? OH_GREEN_TINT : 'rgba(250, 173, 20, 0.18)';

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
        strokeWidth={isToday ? 2 : 1.2}
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
        fill={badgeStroke}
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
