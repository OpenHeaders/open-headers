import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap — MCP Server (tools catalog).
 *
 * 3×2 grid of domain cards. Each card lists the concrete tool names
 * the MCP server exposes to an AI agent, so the reader sees that this
 * is the full surface — not a thin shim. Numbers in the card header
 * give a quick "how big" signal.
 */
export const RoadmapMcpToolsDiagram: React.FC = () => {
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const COLS = 3;
  const ROWS = 2;
  const PAD = 12;
  const GAP = 8;
  const CARD_W = (W - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const CARD_H = 104;
  const GRID_Y = 64;

  type Domain = { name: string; sub: string; tools: string[] };
  const DOMAINS: Domain[] = [
    { name: 'Rules', sub: 'header · block · redirect · mock', tools: ['list', 'create', 'update', 'toggle', 'delete'] },
    { name: 'Requests', sub: 'API Catalog', tools: ['list', 'send', 'save', 'import'] },
    { name: 'Environments', sub: 'per workspace', tools: ['list', 'switch', 'create', 'edit'] },
    { name: 'Variables', sub: 'env · workspace · vault', tools: ['list', 'set', 'read', 'reveal-secret'] },
    { name: 'Workflows', sub: 'chained API calls', tools: ['list', 'run', 'save', 'history'] },
    { name: 'Workspaces', sub: 'multi-workspace', tools: ['list', 'switch', 'create', 'diff'] },
  ];

  const TOTAL_TOOLS = DOMAINS.reduce((s, d) => s + d.tools.length, 0);

  const VERDICT_Y = GRID_Y + ROWS * CARD_H + (ROWS - 1) * GAP + 18;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  const renderCard = (d: Domain, col: number, row: number) => {
    const x = PAD + col * (CARD_W + GAP);
    const y = GRID_Y + row * (CARD_H + GAP);
    const HEAD_H = 30;
    return (
      <g key={d.name}>
        <rect
          x={x}
          y={y}
          width={CARD_W}
          height={CARD_H}
          rx={6}
          fill="var(--ant-color-bg-container)"
          stroke={STROKE_BLUE}
          strokeWidth={1.2}
        />
        {/* Domain header band */}
        <rect x={x} y={y} width={CARD_W} height={HEAD_H} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={x + 10} y={y + 14} fontSize={11} fontWeight={700} fill={TEXT}>
          {d.name}
        </text>
        <text
          x={x + CARD_W - 10}
          y={y + 14}
          textAnchor="end"
          fontSize={9}
          fontWeight={800}
          fill={OH_GREEN}
          letterSpacing={0.4}
        >
          {d.tools.length} TOOLS
        </text>
        <text x={x + 10} y={y + 24} fontSize={8.5} fontStyle="italic" fill={TEXT_DIM}>
          {d.sub}
        </text>
        {/* Tool list — short tools share a row (2 columns); tools
         *  longer than ~8 chars take a full row so nothing overflows. */}
        {(() => {
          let row = 0;
          let col = 0;
          return d.tools.map((tool) => {
            const isWide = tool.length > 8;
            // Wide tool: force its own full-width row.
            if (isWide && col !== 0) {
              row += 1;
              col = 0;
            }
            const tx = x + 12 + col * (CARD_W / 2 - 6);
            const ty = y + HEAD_H + 16 + row * 14;
            const node = (
              <g key={tool}>
                <text x={tx} y={ty} fontFamily="monospace" fontSize={9.5} fontWeight={700} fill={OH_GREEN}>
                  ›
                </text>
                <text x={tx + 10} y={ty} fontFamily="monospace" fontSize={9.5} fontWeight={600} fill={TEXT}>
                  {tool}
                </text>
              </g>
            );
            if (isWide) {
              row += 1;
              col = 0;
            } else {
              col += 1;
              if (col >= 2) {
                col = 0;
                row += 1;
              }
            }
            return node;
          });
        })()}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label={`Roadmap milestone — MCP Server tools catalog. Six domain cards exposing ${TOTAL_TOOLS} tools total: rules, requests, environments, variables, workflows, workspaces.`}
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        What the AI agent can do
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Six domains — full CRUD where it makes sense, scoped read-only where it doesn't.
      </text>

      {DOMAINS.map((d, i) => renderCard(d, i % COLS, Math.floor(i / COLS)))}

      {/* Verdict */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={OH_GREEN}>
        {TOTAL_TOOLS} tools · six domains · the full Open Headers surface
      </text>
    </svg>
  );
};
