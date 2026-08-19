/**
 * Resource Types — diagrams.
 *
 *   • ResourceTypesAnatomyDiagram — a stylised page mockup with
 *     coloured callouts pointing to each kind of resource that
 *     contributes a Chrome ResourceType value (Page, Frame, Script,
 *     CSS, Image, Font, Media, Fetch/XHR, WebSocket, Ping, Other).
 *     Serves as the visual key the table below dives into.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

// ── Per-type mini icons ─────────────────────────────────────────
//
// Small 40×40 glyphs used next to each row in the table. Each one
// uses its locked accent color so the visual key matches the
// anatomy diagram above.

const ICON_BLUE = 'var(--ant-color-primary)';
const ICON_CYAN = '#08979c';
const ICON_GREEN = 'var(--ant-color-success)';
const ICON_ORANGE = '#fa8c16';
const ICON_PURPLE = '#722ed1';
const ICON_MAGENTA = '#c41d7f';
const ICON_VOLCANO = '#d4380d';
const ICON_GOLD = '#d48806';
const ICON_LIME = '#7cb305';
const ICON_GEEK = '#1d39c4';
const ICON_GREY = 'var(--ant-color-text-tertiary)';

const ICON_BG = 'var(--ant-color-fill-quaternary)';

interface IconProps {
  size?: number;
}

const IconFrame: React.FC<{ accent: string; children: React.ReactNode; size?: number }> = ({
  accent,
  children,
  size = 40,
}) => (
  <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-hidden="true">
    <rect x={1} y={1} width={38} height={38} rx={6} fill={ICON_BG} stroke={accent} strokeWidth={1.2} />
    {children}
  </svg>
);

export const PageIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_BLUE} size={size}>
    <rect x={7} y={9} width={26} height={4} rx={1} fill={ICON_BLUE} />
    <rect x={7} y={16} width={26} height={16} rx={1.5} fill="var(--ant-color-bg-container)" stroke={ICON_BLUE} />
    <rect x={10} y={19} width={14} height={2} fill={ICON_BLUE} opacity={0.6} />
    <rect x={10} y={23} width={20} height={2} fill={ICON_BLUE} opacity={0.4} />
    <rect x={10} y={27} width={16} height={2} fill={ICON_BLUE} opacity={0.4} />
  </IconFrame>
);

export const FrameIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_CYAN} size={size}>
    {/* Outer page */}
    <rect x={6} y={6} width={28} height={28} rx={2} fill="none" stroke={ICON_CYAN} strokeWidth={1.2} />
    {/* Inner iframe — dashed */}
    <rect
      x={14}
      y={14}
      width={18}
      height={14}
      rx={1.5}
      fill={ICON_CYAN}
      fillOpacity={0.18}
      stroke={ICON_CYAN}
      strokeWidth={1.2}
      strokeDasharray="2 2"
    />
  </IconFrame>
);

export const FetchIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_GREEN} size={size}>
    {/* { } JSON braces */}
    <text x={20} y={26} textAnchor="middle" fontFamily="monospace" fontSize={18} fontWeight={700} fill={ICON_GREEN}>
      {'{ }'}
    </text>
  </IconFrame>
);

export const ScriptIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_ORANGE} size={size}>
    {/* < / > */}
    <text x={20} y={26} textAnchor="middle" fontFamily="monospace" fontSize={14} fontWeight={700} fill={ICON_ORANGE}>
      {'</>'}
    </text>
  </IconFrame>
);

export const CssIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_PURPLE} size={size}>
    {/* Hash + dots — like a CSS selector */}
    <text x={20} y={26} textAnchor="middle" fontFamily="monospace" fontSize={16} fontWeight={700} fill={ICON_PURPLE}>
      #·.
    </text>
  </IconFrame>
);

export const ImageIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_MAGENTA} size={size}>
    {/* Mountains + sun */}
    <circle cx={28} cy={14} r={3} fill={ICON_MAGENTA} opacity={0.7} />
    <path
      d="M 8 30 L 16 18 L 22 24 L 26 20 L 32 30 Z"
      fill={ICON_MAGENTA}
      fillOpacity={0.3}
      stroke={ICON_MAGENTA}
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  </IconFrame>
);

export const FontIcon: React.FC<IconProps> = ({ size }) => {
  const t = useT();
  return (
    <IconFrame accent={ICON_VOLCANO} size={size}>
      {/* Stylised 'Aa' */}
      <text
        x={20}
        y={28}
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize={20}
        fontWeight={700}
        fill={ICON_VOLCANO}
      >
        {t('workbench.docs.diagrams.resourceTypes.wireAa')}
      </text>
    </IconFrame>
  );
};

export const MediaIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_GOLD} size={size}>
    {/* Play triangle inside circle */}
    <circle cx={20} cy={20} r={11} fill="none" stroke={ICON_GOLD} strokeWidth={1.4} />
    <path d="M 17 14 L 17 26 L 27 20 Z" fill={ICON_GOLD} />
  </IconFrame>
);

export const WebSocketIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_LIME} size={size}>
    {/* Bidirectional arrows */}
    <path d="M 10 16 L 30 16" stroke={ICON_LIME} strokeWidth={1.5} fill="none" />
    <path
      d="M 28 13 L 31 16 L 28 19"
      stroke={ICON_LIME}
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M 30 24 L 10 24" stroke={ICON_LIME} strokeWidth={1.5} fill="none" />
    <path
      d="M 12 21 L 9 24 L 12 27"
      stroke={ICON_LIME}
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </IconFrame>
);

export const PingIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_GEEK} size={size}>
    {/* Radiating signal */}
    <circle cx={20} cy={26} r={2} fill={ICON_GEEK} />
    <path d="M 14 22 A 8 8 0 0 1 26 22" stroke={ICON_GEEK} strokeWidth={1.5} fill="none" />
    <path d="M 10 18 A 14 14 0 0 1 30 18" stroke={ICON_GEEK} strokeWidth={1.5} fill="none" strokeOpacity={0.65} />
    <path d="M 6 14 A 20 20 0 0 1 34 14" stroke={ICON_GEEK} strokeWidth={1.5} fill="none" strokeOpacity={0.35} />
  </IconFrame>
);

export const OtherIcon: React.FC<IconProps> = ({ size }) => (
  <IconFrame accent={ICON_GREY} size={size}>
    <text x={20} y={28} textAnchor="middle" fontFamily="Georgia, serif" fontSize={20} fontWeight={700} fill={ICON_GREY}>
      ?
    </text>
  </IconFrame>
);

/** Lookup by ResourceType code so the table can render the right icon. */
export const RESOURCE_TYPE_ICONS: Record<string, React.FC<IconProps>> = {
  main_frame: PageIcon,
  sub_frame: FrameIcon,
  xmlhttprequest: FetchIcon,
  script: ScriptIcon,
  stylesheet: CssIcon,
  image: ImageIcon,
  font: FontIcon,
  media: MediaIcon,
  websocket: WebSocketIcon,
  ping: PingIcon,
  other: OtherIcon,
};

export const ResourceTypesAnatomyDiagram: React.FC = () => {
  const t = useT();
  // Locked color contract has fixed roles; for a reference like this
  // we tone them down by using both fill + accent text for each
  // resource type so the visual table stays readable even with the
  // overlapping color budget.
  const MAGENTA = '#c41d7f';
  const MAGENTA_BG = 'rgba(255, 22, 198, 0.10)';
  const VOLCANO = '#d4380d';
  const VOLCANO_BG = 'rgba(255, 85, 0, 0.10)';
  const GOLD = '#d48806';
  const GOLD_BG = 'rgba(250, 173, 20, 0.16)';
  const LIME = '#7cb305';
  const LIME_BG = 'rgba(160, 217, 17, 0.16)';
  const GEEK = '#1d39c4';
  const GEEK_BG = 'rgba(47, 84, 235, 0.10)';
  const CYAN = '#08979c';
  const CYAN_BG = 'rgba(19, 194, 194, 0.10)';

  // Page mockup geometry
  const PAGE_X = 14;
  const PAGE_Y = 28;
  const PAGE_W = 200;
  const PAGE_H = 290;

  return (
    <svg
      viewBox="0 0 320 340"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.resourceTypes.anatomyAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.resourceTypes.anatomyTitle')}
      </text>

      {/* Outer page card */}
      <rect
        x={PAGE_X}
        y={PAGE_Y}
        width={PAGE_W}
        height={PAGE_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />

      {/* Address bar — Page = main_frame */}
      <rect x={PAGE_X} y={PAGE_Y} width={PAGE_W} height={20} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={PAGE_X + 8} y={PAGE_Y + 14} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        https://openheaders.com
      </text>

      {/* Inside the page */}
      {/* Script tag */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 28} width={84} height={14} rx={2} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text
        x={PAGE_X + 50}
        y={PAGE_Y + 38}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fontWeight={700}
        fill={STROKE_ORANGE}
      >
        {t('workbench.docs.diagrams.resourceTypes.wireScriptTag')}
      </text>

      {/* Stylesheet */}
      <rect x={PAGE_X + 100} y={PAGE_Y + 28} width={92} height={14} rx={2} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text
        x={PAGE_X + 146}
        y={PAGE_Y + 38}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fontWeight={700}
        fill={STROKE_PURPLE}
      >
        {t('workbench.docs.diagrams.resourceTypes.wireLinkCss')}
      </text>

      {/* Image */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 50} width={56} height={40} rx={2} fill={MAGENTA_BG} stroke={MAGENTA} />
      <text x={PAGE_X + 36} y={PAGE_Y + 74} textAnchor="middle" fontSize={9} fontWeight={700} fill={MAGENTA}>
        {t('workbench.docs.diagrams.resourceTypes.wireImgTag')}
      </text>

      {/* Font (web font / @font-face) */}
      <rect x={PAGE_X + 72} y={PAGE_Y + 50} width={56} height={20} rx={2} fill={VOLCANO_BG} stroke={VOLCANO} />
      <text
        x={PAGE_X + 100}
        y={PAGE_Y + 64}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fontWeight={700}
        fill={VOLCANO}
      >
        @font-face
      </text>

      {/* Media (video/audio) */}
      <rect x={PAGE_X + 72} y={PAGE_Y + 74} width={56} height={16} rx={2} fill={GOLD_BG} stroke={GOLD} />
      <text
        x={PAGE_X + 100}
        y={PAGE_Y + 86}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fontWeight={700}
        fill={GOLD}
      >
        {t('workbench.docs.diagrams.resourceTypes.wireVideoTag')}
      </text>

      {/* Iframe (sub_frame) */}
      <rect
        x={PAGE_X + 136}
        y={PAGE_Y + 50}
        width={56}
        height={40}
        rx={2}
        fill={CYAN_BG}
        stroke={CYAN}
        strokeDasharray="3 2"
      />
      <text
        x={PAGE_X + 164}
        y={PAGE_Y + 68}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fontWeight={700}
        fill={CYAN}
      >
        {t('workbench.docs.diagrams.resourceTypes.wireIframeTag')}
      </text>
      <text x={PAGE_X + 164} y={PAGE_Y + 80} textAnchor="middle" fontSize={7} fontStyle="italic" fill={CYAN}>
        sub_frame
      </text>

      {/* Body content rows */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={PAGE_X + 8}
          y={PAGE_Y + 100 + i * 10}
          width={PAGE_W - 16 - i * 20}
          height={4}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}

      {/* Fetch / XHR + WebSocket + Ping rows — page-initiated requests */}
      <rect x={PAGE_X + 8} y={PAGE_Y + 140} width={184} height={18} rx={3} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={PAGE_X + 14} y={PAGE_Y + 153} fontFamily="monospace" fontSize={9} fontWeight={700} fill={STROKE_GREEN}>
        fetch('/api/users')
      </text>

      <rect x={PAGE_X + 8} y={PAGE_Y + 162} width={184} height={18} rx={3} fill={LIME_BG} stroke={LIME} />
      <text x={PAGE_X + 14} y={PAGE_Y + 175} fontFamily="monospace" fontSize={9} fontWeight={700} fill={LIME}>
        {t('workbench.docs.diagrams.resourceTypes.wireNewWebSocket')}
      </text>

      <rect x={PAGE_X + 8} y={PAGE_Y + 184} width={184} height={18} rx={3} fill={GEEK_BG} stroke={GEEK} />
      <text x={PAGE_X + 14} y={PAGE_Y + 197} fontFamily="monospace" fontSize={9} fontWeight={700} fill={GEEK}>
        navigator.sendBeacon(…)
      </text>

      {/* Manifest / favicon — Other */}
      <rect
        x={PAGE_X + 8}
        y={PAGE_Y + 206}
        width={184}
        height={18}
        rx={3}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={PAGE_X + 14} y={PAGE_Y + 219} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.resourceTypes.otherExamples')}
      </text>

      {/* Body page rows */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`bb-${i}`}
          x={PAGE_X + 8}
          y={PAGE_Y + 234 + i * 10}
          width={PAGE_W - 16 - i * 24}
          height={4}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}

      {/* Legend on the right side */}
      <text x={PAGE_X + PAGE_W + 16} y={PAGE_Y + 12} fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.resourceTypes.legendKicker')}
      </text>

      {[
        { stroke: STROKE_BLUE, fill: FILL_BLUE, label: 'Page' },
        { stroke: CYAN, fill: CYAN_BG, label: 'Frame' },
        { stroke: STROKE_GREEN, fill: FILL_GREEN, label: 'Fetch/XHR' },
        { stroke: STROKE_ORANGE, fill: FILL_ORANGE, label: 'Script' },
        { stroke: STROKE_PURPLE, fill: FILL_PURPLE, label: 'CSS' },
        { stroke: MAGENTA, fill: MAGENTA_BG, label: 'Image' },
        { stroke: VOLCANO, fill: VOLCANO_BG, label: 'Font' },
        { stroke: GOLD, fill: GOLD_BG, label: 'Media' },
        { stroke: LIME, fill: LIME_BG, label: 'WebSocket' },
        { stroke: GEEK, fill: GEEK_BG, label: 'Ping' },
        {
          stroke: 'var(--ant-color-text-tertiary)',
          fill: 'var(--ant-color-fill-secondary)',
          label: 'Other',
        },
      ].map((row, i) => {
        const y = PAGE_Y + 24 + i * 18;
        return (
          <g key={row.label}>
            {/* Swatch mirrors the anatomy element style: tinted fill + accent border */}
            <rect
              x={PAGE_X + PAGE_W + 16}
              y={y - 7}
              width={12}
              height={12}
              rx={2}
              fill={row.fill}
              stroke={row.stroke}
              strokeWidth={1.2}
            />
            <text x={PAGE_X + PAGE_W + 32} y={y + 1} fontSize={9} fill={TEXT}>
              {row.label}
            </text>
          </g>
        );
      })}

      <text x={160} y={332} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.resourceTypes.footer')}
      </text>
    </svg>
  );
};
