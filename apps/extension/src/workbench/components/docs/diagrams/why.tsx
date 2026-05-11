/**
 * Why OpenHeaders — landing-page diagrams.
 *
 *   • WhyProblemDiagram      — "you can't touch what's on the wire"
 *   • WhyWhereItFitsDiagram  — extension vs proxy vs code-fork
 *                              tradeoff matrix
 *   • WhyStrengthsDiagram    — 4 strength tiles (local · fast ·
 *                              scriptable · cross-browser)
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

/**
 * The problem: a developer wants to change something on the wire
 * (a header, a response shape, a redirect) but the page is built
 * by someone else and the server is out of reach. OpenHeaders
 * slots into the gap as a local interceptor.
 */
export const WhyProblemDiagram: React.FC = () => {
  const ID = 'why-prob';
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';

  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Without OpenHeaders you can't reach the wire — the page is built by someone else and the server is out of reach. With OpenHeaders, the extension slots in between as a local interceptor."
    >
      <ArrowDefs id={ID} />

      {/* ── Without OpenHeaders ── */}
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={errColor}>
        Without OpenHeaders
      </text>

      {/* Page + Server */}
      <rect x={14} y={28} width={90} height={42} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE} />
      <text x={59} y={46} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Page
      </text>
      <text x={59} y={60} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        someone else's
      </text>

      <rect x={216} y={28} width={90} height={42} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE} />
      <text x={261} y={46} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Server
      </text>
      <text x={261} y={60} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        not your code
      </text>

      <line x1={104} y1={49} x2={216} y2={49} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* You — stuck outside */}
      <rect
        x={130}
        y={86}
        width={60}
        height={28}
        rx={5}
        fill={errBg}
        stroke={errBorder}
        strokeDasharray="3 2"
      />
      <text x={160} y={104} textAnchor="middle" fontSize={10} fontWeight={700} fill={errColor}>
        You
      </text>
      <text x={160} y={130} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Can't change either side · headers, responses, redirects
      </text>
      <text x={160} y={142} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        are out of reach.
      </text>

      {/* Divider */}
      <line x1={20} y1={160} x2={300} y2={160} stroke="var(--ant-color-border-secondary)" strokeDasharray="2 4" />

      {/* ── With OpenHeaders ── */}
      <text x={160} y={178} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_GREEN}>
        With OpenHeaders
      </text>

      {/* Page + interceptor + Server */}
      <rect x={14} y={192} width={70} height={42} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE} />
      <text x={49} y={210} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Page
      </text>

      <rect x={104} y={192} width={112} height={42} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} strokeWidth={1.5} />
      <text x={160} y={210} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_GREEN}>
        OpenHeaders
      </text>
      <text x={160} y={224} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        slotted into the wire
      </text>

      <rect x={236} y={192} width={70} height={42} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE} />
      <text x={271} y={210} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Server
      </text>

      <line x1={84} y1={213} x2={104} y2={213} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line x1={216} y1={213} x2={236} y2={213} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <text x={160} y={252} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Now headers, redirects, and responses are yours to shape.
      </text>
    </svg>
  );
};

/**
 * Where it fits — comparison table. Three approaches, four axes.
 * Visual rule of thumb: extensions are zero-setup and stay private;
 * proxies have full reach but need OS-level setup; code forks are
 * the strongest reach but require you to own the codebase.
 */
export const WhyWhereItFitsDiagram: React.FC = () => {
  type Col = {
    title: string;
    accent: string;
    fill: string;
    rows: string[];
  };

  const COLS: Col[] = [
    {
      title: 'Extension',
      accent: STROKE_GREEN,
      fill: FILL_GREEN,
      rows: ['Click-install', 'Local only', 'This browser', 'Per machine'],
    },
    {
      title: 'Local proxy',
      accent: STROKE_ORANGE,
      fill: FILL_ORANGE,
      rows: ['30 min setup', 'Routes traffic', 'System-wide', 'Per machine'],
    },
    {
      title: 'Code fork',
      accent: STROKE_PURPLE,
      fill: FILL_PURPLE,
      rows: ['Hours+', 'Needs source', 'Wherever shipped', 'Everyone'],
    },
  ];

  const AXES = ['Setup', 'Privacy', 'Reach', 'Scope'];

  const COL_W = 88;
  const COL_X = [20, 116, 212] as const;
  const AXIS_X = 4;
  const TITLE_Y = 36;
  const ROW_Y0 = 60;
  const ROW_H = 26;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Where OpenHeaders fits — compared to a local proxy or a code fork on setup time, privacy, reach, and scope."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHERE IT FITS
      </text>

      {/* Column headers */}
      {COLS.map((col, i) => {
        const x = COL_X[i];
        return (
          <g key={col.title}>
            <rect x={x} y={24} width={COL_W} height={22} rx={4} fill={col.fill} stroke={col.accent} />
            <text x={x + COL_W / 2} y={TITLE_Y + 2} textAnchor="middle" fontSize={10} fontWeight={700} fill={col.accent}>
              {col.title}
            </text>
          </g>
        );
      })}

      {/* Axis labels + cell values */}
      {AXES.map((axis, row) => {
        const y = ROW_Y0 + row * ROW_H;
        return (
          <g key={axis}>
            {/* Axis label on left edge */}
            <text x={AXIS_X + 8} y={y + 16} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
              {axis.toUpperCase()}
            </text>
            {/* Cells */}
            {COLS.map((col, i) => {
              const x = COL_X[i];
              const isExtension = i === 0;
              return (
                <g key={`${axis}-${col.title}`}>
                  <rect
                    x={x}
                    y={y + 4}
                    width={COL_W}
                    height={ROW_H - 6}
                    rx={3}
                    fill={isExtension ? col.fill : 'var(--ant-color-bg-container)'}
                    stroke={isExtension ? col.accent : 'var(--ant-color-border)'}
                  />
                  <text
                    x={x + COL_W / 2}
                    y={y + 19}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={isExtension ? 700 : 400}
                    fill={isExtension ? col.accent : TEXT}
                  >
                    {col.rows[row]}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      <text x={160} y={212} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Zero setup + private by default — the sweet spot for most workflows.
      </text>
    </svg>
  );
};

/**
 * Four strength tiles arranged in a 2×2 grid — the key reasons to
 * pick OpenHeaders summarized as one-line claims with concrete
 * proof points.
 */
export const WhyStrengthsDiagram: React.FC = () => {
  type Tile = {
    title: string;
    claim: string;
    glyph: React.ReactNode;
    accent: string;
    fill: string;
  };

  const TILES: Tile[] = [
    {
      title: 'Local-only',
      claim: 'Rules + secrets stay on your machine.',
      accent: STROKE_GREEN,
      fill: FILL_GREEN,
      glyph: (
        <text x={0} y={4} textAnchor="middle" fontSize={12} fontWeight={700} fill={STROKE_GREEN}>
          🔒
        </text>
      ),
    },
    {
      title: 'Native speed',
      claim: "Chrome's DNR engine — no proxy hop.",
      accent: STROKE_BLUE,
      fill: FILL_BLUE,
      glyph: (
        <text x={0} y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_BLUE}>
          ⚡
        </text>
      ),
    },
    {
      title: 'Scriptable',
      claim: 'Drop into JS for edge cases.',
      accent: STROKE_PURPLE,
      fill: FILL_PURPLE,
      glyph: (
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={11}
          fontWeight={700}
          fill={STROKE_PURPLE}
        >
          {'</>'}
        </text>
      ),
    },
    {
      title: 'Cross-browser',
      claim: 'Chrome · Firefox · Edge · Safari.',
      accent: STROKE_ORANGE,
      fill: FILL_ORANGE,
      glyph: (
        <text x={0} y={4} textAnchor="middle" fontSize={12} fontWeight={700} fill={STROKE_ORANGE}>
          ⌘
        </text>
      ),
    },
  ];

  const TILE_W = 142;
  const TILE_H = 68;
  const TILE_X = [14, 164] as const;
  const TILE_Y0 = 36;
  const TILE_GAP = 12;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Strengths: local-only, native DNR speed, scriptable for edge cases, cross-browser support."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHY OPENHEADERS
      </text>

      {TILES.map((tile, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = TILE_X[col];
        const y = TILE_Y0 + row * (TILE_H + TILE_GAP);
        return (
          <g key={tile.title}>
            <rect
              x={x}
              y={y}
              width={TILE_W}
              height={TILE_H}
              rx={6}
              fill={tile.fill}
              stroke={tile.accent}
            />
            {/* Glyph circle */}
            <circle cx={x + 18} cy={y + 20} r={11} fill="var(--ant-color-bg-container)" stroke={tile.accent} />
            <g transform={`translate(${x + 18}, ${y + 20})`}>{tile.glyph}</g>
            {/* Title */}
            <text x={x + 34} y={y + 24} fontSize={11} fontWeight={700} fill={tile.accent}>
              {tile.title}
            </text>
            {/* Claim — wraps if needed */}
            <text x={x + 10} y={y + 48} fontSize={9} fill={TEXT}>
              {tile.claim}
            </text>
          </g>
        );
      })}

      <text x={160} y={212} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Open source · MIT licensed · no telemetry.
      </text>
    </svg>
  );
};
