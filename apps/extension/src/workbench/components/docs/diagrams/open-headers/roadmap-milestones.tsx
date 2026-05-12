import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';

/**
 * Roadmap milestones — ordered cards. Same vertical-card pattern as
 * ParadigmScenariosDiagram so the visual language stays consistent
 * across the Open Headers group. Numbered badges signal sequence.
 */
export const RoadmapMilestonesDiagram: React.FC = () => {
  type Milestone = { title: string; tag: string; description: string };

  const MILESTONES: Milestone[] = [
    {
      title: 'Team workspaces via Git',
      tag: 'next',
      description: 'YAML in a Git repo you control — pull syncs, push shares, conflicts merge through Git.',
    },
    {
      title: 'Desktop app',
      tag: 'next',
      description: "Native binary running the same store — for surfaces an extension can't reach.",
    },
    {
      title: 'Local / LAN daemon',
      tag: 'soon',
      description: 'Run a sync daemon on your machine or network; extension + desktop + CLI become clients.',
    },
    {
      title: 'CLI',
      tag: 'soon',
      description: 'Headless scripting and CI — list rules, toggle environments, send requests from the shell.',
    },
    {
      title: 'Self-hosted web app',
      tag: 'later',
      description: "Same UI as a web bundle for locked-down browsers where extensions aren't an option.",
    },
    {
      title: 'More importers',
      tag: 'later',
      description: 'Beyond Postman: Insomnia collections, OpenAPI specs, full HAR request imports.',
    },
  ];

  const CARD_X = 14;
  const CARD_W = 292;
  const CARD_H = 56;
  const CARD_GAP = 6;
  const CARD_Y_START = 32;

  return (
    <svg
      viewBox="0 0 320 412"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Six roadmap milestone cards in sequence — Git workspaces, desktop app, local daemon, CLI, self-hosted web app, and additional importers."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHAT'S NEXT
      </text>

      {MILESTONES.map((m, i) => {
        const y = CARD_Y_START + i * (CARD_H + CARD_GAP);
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
            <rect x={CARD_X} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={STROKE_BLUE} />
            <circle cx={CARD_X + 22} cy={y + 22} r={11} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeWidth={1.5} />
            <text x={CARD_X + 22} y={y + 26} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
              {i + 1}
            </text>
            <text x={CARD_X + 40} y={y + 22} fontSize={11} fontWeight={700} fill={TEXT}>
              {m.title}
            </text>
            <rect
              x={CARD_X + CARD_W - 50}
              y={y + 12}
              width={40}
              height={14}
              rx={7}
              fill="var(--ant-color-fill-quaternary)"
              stroke="var(--ant-color-border)"
            />
            <text x={CARD_X + CARD_W - 30} y={y + 22} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
              {m.tag}
            </text>
            <text x={CARD_X + 40} y={y + 42} fontSize={9} fill={TEXT_DIM}>
              {m.description}
            </text>
          </g>
        );
      })}

      <text x={160} y={406} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Sequence, not dates — local-only is the product; cross-user cloud sync is not on the path.
      </text>
    </svg>
  );
};
