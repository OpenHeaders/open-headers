import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap milestones — six ordered cards, all wrapped in a single
 * browser-window frame so the page reads as a unified "What's next"
 * surface. Each card carries a numbered badge, a tier pill, a short
 * description and a left-edge accent stripe.
 */
export const RoadmapMilestonesDiagram: React.FC = () => {
  type Milestone = { title: string; tag: 'soon'; badge?: string; description: string };

  const MILESTONES: Milestone[] = [
    {
      title: 'Workspace collaboration via Git (Team-ready)',
      tag: 'soon',
      description: 'YAML in a Git repo you control — pull, push, merge via Git.',
    },
    {
      title: 'Desktop app',
      tag: 'soon',
      description: "Native binary on the same store — reaches what an extension can't.",
    },
    {
      title: 'MCP Server (AI agent control)',
      tag: 'soon',
      badge: 'USER-CONTROLLED',
      description: 'Open Headers over MCP — let an AI agent drive your workspace.',
    },
    {
      title: 'Local / LAN daemon',
      tag: 'soon',
      description: 'Sync daemon on your machine or LAN — extension, desktop, CLI as clients.',
    },
    {
      title: 'CLI',
      tag: 'soon',
      description: 'Headless scripting and CI — list, toggle, send from the shell.',
    },
    {
      title: 'Self-hosted VM deployment + Web App',
      tag: 'soon',
      description: 'Web bundle on your VM — locked-down browsers or branded deploys.',
    },
    {
      title: 'More importers',
      tag: 'soon',
      description: 'Beyond Postman — Insomnia, OpenAPI specs, full HAR imports.',
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
      aria-label="Roadmap milestones — six ordered cards inside a browser-window frame: Git workspaces, desktop app, local daemon, CLI, self-hosted web app, more importers."
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
        What's next
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
        Sequence, not dates — local-only stays the product through every milestone.
      </text>

      {/* Milestone cards */}
      {MILESTONES.map((m, i) => {
        const y = FRAME_Y + CARDS_TOP + i * (CARD_H + CARD_GAP);
        const tc = tagColors();
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
            <rect
              x={CARD_X + CARD_W - 52}
              y={y + 12}
              width={44}
              height={16}
              rx={8}
              fill={tc.fill}
              stroke={tc.stroke}
              strokeWidth={1}
            />
            <text
              x={CARD_X + CARD_W - 30}
              y={y + 23}
              textAnchor="middle"
              fontSize={8.5}
              fontWeight={800}
              fill={tc.stroke}
              letterSpacing={0.6}
            >
              {m.tag.toUpperCase()}
            </text>
            {/* Optional extra badge — sits to the LEFT of the tag pill */}
            {m.badge && (
              <g>
                <rect
                  x={CARD_X + CARD_W - 52 - 120}
                  y={y + 12}
                  width={114}
                  height={16}
                  rx={8}
                  fill={FILL_BLUE}
                  stroke={STROKE_BLUE}
                  strokeWidth={1}
                />
                <text
                  x={CARD_X + CARD_W - 52 - 120 + 57}
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
        Cross-user sync ships through Git and self-hosted deployments — no vendor-hosted cloud.
      </text>
    </svg>
  );
};
