import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

// CJK glyphs render close to the full em box, not the ~0.55em a Latin
// glyph averages — weigh them accordingly when sizing text-driven pills.
const unitLen = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.85 : 1), 0);

/**
 * Roadmap milestones — six ordered cards, all wrapped in a single
 * browser-window frame so the page reads as a unified "What's next"
 * surface. Each card carries a numbered badge, a tier pill, a short
 * description and a left-edge accent stripe.
 */
export const RoadmapMilestonesDiagram: React.FC = () => {
  const t = useT();
  type Milestone = { title: string; badge?: string; description: string };

  const tagLive = t('workbench.docs.diagrams.openHeaders.milestones.tagLive');

  const MILESTONES: Milestone[] = [
    {
      title: t('workbench.docs.diagrams.openHeaders.milestones.msGit'),
      description: t('workbench.docs.diagrams.openHeaders.milestones.descGit'),
    },
    {
      title: t('workbench.docs.diagrams.openHeaders.shared.desktopApp'),
      description: t('workbench.docs.diagrams.openHeaders.milestones.descDesktop'),
    },
    {
      title: t('workbench.docs.diagrams.openHeaders.milestones.msMcp'),
      badge: t('workbench.docs.diagrams.openHeaders.milestones.badgeUserControlled'),
      description: t('workbench.docs.diagrams.openHeaders.milestones.descMcp'),
    },
    {
      title: t('workbench.docs.diagrams.openHeaders.milestones.msServer'),
      description: t('workbench.docs.diagrams.openHeaders.milestones.descServer'),
    },
    {
      title: 'CLI',
      description: t('workbench.docs.diagrams.openHeaders.milestones.descCli'),
    },
    {
      title: t('workbench.docs.diagrams.openHeaders.milestones.msVm'),
      description: t('workbench.docs.diagrams.openHeaders.milestones.descVm'),
    },
    {
      title: t('workbench.docs.diagrams.openHeaders.milestones.msImporters'),
      description: t('workbench.docs.diagrams.openHeaders.milestones.descImporters'),
    },
  ];

  const W = 480;
  const FRAME_X = 12;
  const FRAME_W = W - 24;
  const CHROME_H = 26;
  const ADDR_H = 22;

  const CARD_X = FRAME_X + 12;
  const CARD_W = FRAME_W - 24;
  const CARD_H = 58;
  const CARD_GAP = 6;
  const CARDS_TOP = CHROME_H + ADDR_H + 14;
  const totalCardsH = MILESTONES.length * CARD_H + (MILESTONES.length - 1) * CARD_GAP;

  const FRAME_Y = 22;
  // Top: chrome + address strip + 14px gap above first card.
  // Bottom: 22px below last card before the frame border ends.
  const FRAME_H = CARDS_TOP + totalCardsH + 22;

  const FOOTER_Y = FRAME_Y + FRAME_H + 18;
  const H = FOOTER_Y + 14;
  const CX = W / 2;

  const tagColors = () => ({ fill: OH_GREEN_TINT, stroke: OH_GREEN });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.openHeaders.milestones.aria')}
    >
      {/* Outer browser-window frame */}
      <rect
        x={FRAME_X}
        y={FRAME_Y}
        width={FRAME_W}
        height={FRAME_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.6}
      />
      {/* Chrome bar */}
      <rect
        x={FRAME_X}
        y={FRAME_Y}
        width={FRAME_W}
        height={CHROME_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      <circle cx={FRAME_X + 12} cy={FRAME_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
      <circle cx={FRAME_X + 24} cy={FRAME_Y + CHROME_H / 2} r={4} fill="#febc2e" />
      <circle cx={FRAME_X + 36} cy={FRAME_Y + CHROME_H / 2} r={4} fill="#28c840" />
      <text
        x={FRAME_X + FRAME_W / 2}
        y={FRAME_Y + CHROME_H / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        {t('workbench.docs.diagrams.openHeaders.milestones.chromeTitle')}
      </text>
      {/* Address-style strip — section subtitle in place of a URL */}
      <rect
        x={FRAME_X}
        y={FRAME_Y + CHROME_H}
        width={FRAME_W}
        height={ADDR_H}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
      />
      <text
        x={FRAME_X + FRAME_W / 2}
        y={FRAME_Y + CHROME_H + ADDR_H / 2 + 4}
        textAnchor="middle"
        fontSize={9.5}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {t('workbench.docs.diagrams.openHeaders.milestones.addrSubtitle')}
      </text>

      {/* Milestone cards */}
      {MILESTONES.map((m, i) => {
        const y = FRAME_Y + CARDS_TOP + i * (CARD_H + CARD_GAP);
        const tc = tagColors();
        const tagW = Math.max(44, Math.round(unitLen(tagLive) * 5.4) + 14);
        const tagX = CARD_X + CARD_W - 8 - tagW;
        const badgeW = m.badge ? Math.round(unitLen(m.badge) * 6.5) + 16 : 0;
        const badgeX = tagX - 6 - badgeW;
        return (
          <g key={m.title}>
            <rect
              x={CARD_X}
              y={y}
              width={CARD_W}
              height={CARD_H}
              rx={6}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            {/* Left accent stripe */}
            <rect x={CARD_X} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_BLUE} />
            {/* Sequence badge */}
            <circle
              cx={CARD_X + 24}
              cy={y + CARD_H / 2}
              r={12}
              fill={FILL_BLUE}
              stroke={STROKE_BLUE}
              strokeWidth={1.5}
            />
            <text x={CARD_X + 24} y={y + CARD_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill={TEXT}>
              {i + 1}
            </text>
            {/* Title */}
            <text x={CARD_X + 46} y={y + 22} fontSize={11} fontWeight={700} fill={TEXT}>
              {m.title}
            </text>
            {/* Tag pill */}
            <rect x={tagX} y={y + 12} width={tagW} height={16} rx={8} fill={tc.fill} stroke={tc.stroke} strokeWidth={1} />
            <text
              x={tagX + tagW / 2}
              y={y + 23}
              textAnchor="middle"
              fontSize={8.5}
              fontWeight={800}
              fill={tc.stroke}
              letterSpacing={0.6}
            >
              {tagLive}
            </text>
            {/* Optional extra badge — sits to the LEFT of the tag pill */}
            {m.badge && (
              <g>
                <rect
                  x={badgeX}
                  y={y + 12}
                  width={badgeW}
                  height={16}
                  rx={8}
                  fill={FILL_BLUE}
                  stroke={STROKE_BLUE}
                  strokeWidth={1}
                />
                <text
                  x={badgeX + badgeW / 2}
                  y={y + 23}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={800}
                  fill={TEXT}
                  letterSpacing={0.6}
                >
                  {m.badge}
                </text>
              </g>
            )}
            {/* Description */}
            <text x={CARD_X + 46} y={y + 42} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
              {m.description}
            </text>
          </g>
        );
      })}

      <text x={CX} y={FOOTER_Y} textAnchor="middle" fontSize={9.5} fontStyle="italic" fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.openHeaders.milestones.footer')}
      </text>
    </svg>
  );
};
