import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../../components/docs/diagrams/_shared';
import { OH_GREEN, OH_GREEN_TINT } from '../../components/docs/diagrams/open-headers/_shared';
import type { BackendMode } from '../schema/backend';

type Bullet = { text: string };
type PlatformItem = { label: string; note?: string };

type TierDef = {
  title: string;
  sub: string;
  badge: 'TODAY' | 'ROADMAP';
  bullets: Bullet[];
  platforms: PlatformItem[];
};

const TIERS: Partial<Record<BackendMode, TierDef>> = {
  'in-browser': {
    title: 'In-browser',
    sub: 'extension service worker',
    badge: 'TODAY',
    bullets: [
      { text: 'zero setup' },
      { text: 'single device' },
      { text: 'per-browser instance' },
      { text: 'multi-surface concurrent editing' },
      { text: 'multi-window concurrent editing' },
      { text: 'Localhost-only' },
      { text: 'browser.storage.local' },
    ],
    platforms: [{ label: 'Chrome' }, { label: 'Firefox' }, { label: 'Edge' }, { label: 'Safari', note: 'soon' }],
  },
};

interface Props {
  mode: BackendMode;
}

// Viewbox matches the right-side topology SVG (0 0 600 270) so when both
// render at the same width inside the DetailFrame, the card rectangle
// aligns horizontally and vertically with the monitor body on the right.
const VB_W = 600;
const VB_H = 270;

// Rectangle coords mirror the DesktopContainer monitor body on the right
// (x=30, y=18, w=540, h=180).
const RECT_X = 30;
const RECT_Y = 18;
const RECT_W = 540;
const RECT_H = 180;

const HEADER_COL_W = 140;
const PLATFORM_COL_W = 95;
const COL_GAP = 8;

const HEADER_X = RECT_X + 10;
const SEPARATOR_1_X = HEADER_X + HEADER_COL_W;
const BULLETS_X = SEPARATOR_1_X + COL_GAP;
const PLATFORM_X = RECT_X + RECT_W - PLATFORM_COL_W - 10;
const SEPARATOR_2_X = PLATFORM_X - COL_GAP;

const BULLET_X = BULLETS_X + 6;
const BULLET_H = 14;
const PLATFORM_CHIP_H = 16;
const PLATFORM_CHIP_GAP = 4;

const MUTED = 'var(--ant-color-text-tertiary)';

const BrowserIcon: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
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

export const BackendTierCard: React.FC<Props> = ({ mode }) => {
  const tier = TIERS[mode];
  if (!tier) return null;

  const isToday = tier.badge === 'TODAY';
  const accent = isToday ? STROKE_BLUE : 'var(--ant-color-border)';
  const badgeStroke = isToday ? OH_GREEN : 'rgba(212, 145, 0, 1)';
  const badgeBg = isToday ? OH_GREEN_TINT : 'rgba(250, 173, 20, 0.18)';

  const headerCX = HEADER_X + HEADER_COL_W / 2;
  const iconCY = RECT_Y + 38;
  const titleY = RECT_Y + 78;
  const subY = RECT_Y + 92;
  const badgeY = RECT_Y + 104;

  // Vertically center bullets block inside the rectangle.
  const bulletsBlockH = tier.bullets.length * BULLET_H;
  const bulletsStartY = RECT_Y + (RECT_H - bulletsBlockH) / 2 + 6;

  // Vertically center the SUPPORTS column.
  const platformsBlockH = 14 + tier.platforms.length * (PLATFORM_CHIP_H + PLATFORM_CHIP_GAP) - PLATFORM_CHIP_GAP;
  const platformsStartY = RECT_Y + (RECT_H - platformsBlockH) / 2;

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

      <BrowserIcon cx={headerCX} cy={iconCY} />
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

      {tier.bullets.map((b, j) => (
        <g key={`b-${j}`}>
          <circle cx={BULLET_X} cy={bulletsStartY + j * BULLET_H} r={2} fill={STROKE_BLUE} />
          <text x={BULLET_X + 8} y={bulletsStartY + 3 + j * BULLET_H} fontSize={10} fill={TEXT}>
            {b.text}
          </text>
        </g>
      ))}

      <text x={PLATFORM_X} y={platformsStartY + 8} fontSize={9} fontWeight={800} fill={MUTED} letterSpacing={0.6}>
        SUPPORTS
      </text>
      {tier.platforms.map((p, i) => {
        const chipY = platformsStartY + 14 + i * (PLATFORM_CHIP_H + PLATFORM_CHIP_GAP);
        return (
          <g key={`p-${i}`}>
            <rect
              x={PLATFORM_X}
              y={chipY}
              width={PLATFORM_COL_W}
              height={PLATFORM_CHIP_H}
              rx={3}
              fill={FILL_BLUE}
              stroke={STROKE_BLUE}
              strokeWidth={0.8}
            />
            <text x={PLATFORM_X + 6} y={chipY + 11} fontSize={9} fontWeight={700} fill={TEXT}>
              {p.label}
            </text>
            {p.note && (
              <text
                x={PLATFORM_X + PLATFORM_COL_W - 6}
                y={chipY + 11}
                textAnchor="end"
                fontSize={7}
                fontStyle="italic"
                fill={MUTED}
              >
                {p.note}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
