/**
 * Header Actions — diagrams.
 *
 * Owns the hero overview (`HeaderOpsDiagram`) plus per-action focus
 * diagrams (`OverrideDiagram`, etc.). Per-action diagrams are
 * self-contained: each tells the story of one operation in detail
 * without repeating the hero's full comparison.
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

/**
 * Add / Replace ("Override") — self-contained explainer for the
 * Add/Replace subsection. Encapsulates everything the old prose
 * "Example" block used to carry:
 *   • the rule
 *   • before / after for both scenarios
 *   • a "won't apply" gotcha + suggestion
 * Pattern mirrors the Conditions sub-diagrams (rule banner → two
 * test cases → footer suggestion) so the visual language stays
 * consistent across the docs.
 */
export const OverrideDiagram: React.FC = () => {
  const ID = 'ov';
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';

  // ─ Two scenario tiles ─
  const TILE_W = 138;
  const TILE_GAP = 10;
  const TILE_LEFT_X = 14;
  const TILE_RIGHT_X = TILE_LEFT_X + TILE_W + TILE_GAP * 2;

  const STATE_H = 50;
  const SCENARIO_LABEL_Y = 50;
  const SCENARIO_SUB_Y = 62;
  const BEFORE_Y = 70;
  const ARROW_LABEL_Y = BEFORE_Y + STATE_H + 14;
  const AFTER_Y = ARROW_LABEL_Y + 10;
  const STAMP_Y = AFTER_Y + STATE_H + 18;

  const renderTile = (
    xOff: number,
    label: 'Replace' | 'Add',
    sub: string,
    before: { line: string; matched: boolean }[],
    after: { line: string; highlight: boolean }[],
    arrowLabel: string,
  ) => (
    <g>
      {/* Scenario header */}
      <text x={xOff + TILE_W / 2} y={SCENARIO_LABEL_Y} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_BLUE}>
        {label}
      </text>
      <text x={xOff + TILE_W / 2} y={SCENARIO_SUB_Y} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {sub}
      </text>

      {/* BEFORE */}
      <rect
        x={xOff}
        y={BEFORE_Y}
        width={TILE_W}
        height={STATE_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={xOff + 6} y={BEFORE_Y + 12} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        BEFORE
      </text>
      {before.map((h, i) => (
        <text
          key={`b-${i}`}
          x={xOff + 8}
          y={BEFORE_Y + 26 + i * 12}
          fontFamily="monospace"
          fontSize={9}
          fill={h.matched ? STROKE_BLUE : TEXT}
          fontWeight={h.matched ? 700 : 400}
        >
          {h.line}
        </text>
      ))}
      {before.length === 1 && (
        <text x={xOff + 8} y={BEFORE_Y + 38} fontFamily="monospace" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
          (no X-Auth)
        </text>
      )}

      {/* Arrow */}
      <line
        x1={xOff + TILE_W / 2}
        y1={BEFORE_Y + STATE_H}
        x2={xOff + TILE_W / 2}
        y2={AFTER_Y - 1}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text x={xOff + TILE_W / 2} y={ARROW_LABEL_Y} textAnchor="middle" fontSize={8} fontStyle="italic" fill={STROKE_BLUE}>
        {arrowLabel}
      </text>

      {/* AFTER */}
      <rect x={xOff} y={AFTER_Y} width={TILE_W} height={STATE_H} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={xOff + 6} y={AFTER_Y + 12} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        AFTER
      </text>
      {after.map((h, i) => (
        <text
          key={`a-${i}`}
          x={xOff + 8}
          y={AFTER_Y + 26 + i * 12}
          fontFamily="monospace"
          fontSize={9}
          fontWeight={h.highlight ? 700 : 400}
          fill={h.highlight ? STROKE_GREEN : TEXT}
        >
          {h.line}
        </text>
      ))}
    </g>
  );

  return (
    <svg
      viewBox="0 0 320 340"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Add / Replace — same rule covers both cases. Replaces an existing X-Auth header value, or adds the header when absent. Both arrive at the same outcome. If the rule's conditions don't match the request, it silently no-ops."
    >
      <ArrowDefs id={ID} />

      {/* Rule banner */}
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={20} width={280} height={22} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={35} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={TEXT}>
        Override X-Auth: Bearer token
      </text>

      {/* Two scenario tiles */}
      {renderTile(
        TILE_LEFT_X,
        'Replace',
        'header already present',
        [
          { line: 'X-Auth: old-value', matched: true },
          { line: 'Content-Type: html', matched: false },
        ],
        [
          { line: 'X-Auth: Bearer token', highlight: true },
          { line: 'Content-Type: html', highlight: false },
        ],
        'value replaced',
      )}
      {renderTile(
        TILE_RIGHT_X,
        'Add',
        'no X-Auth header yet',
        [{ line: 'Content-Type: html', matched: false }],
        [
          { line: 'X-Auth: Bearer token', highlight: true },
          { line: 'Content-Type: html', highlight: false },
        ],
        'header added',
      )}

      {/* Vertical separator */}
      <line
        x1={160}
        y1={BEFORE_Y - 2}
        x2={160}
        y2={AFTER_Y + STATE_H + 2}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="2 4"
      />

      {/* Outcome stamp */}
      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Either way → one X-Auth header with your value
      </text>

      {/* Won't apply / suggestion footer */}
      <rect
        x={14}
        y={STAMP_Y + 14}
        width={292}
        height={62}
        rx={4}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="2 3"
      />
      <text x={26} y={STAMP_Y + 30} fontSize={11} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={42} y={STAMP_Y + 30} fontSize={9} fontWeight={700} fill={TEXT}>
        Request to a non-matching domain
      </text>
      <text x={42} y={STAMP_Y + 42} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Conditions gate the action — no match, no-op.
      </text>
      <text x={26} y={STAMP_Y + 60} fontSize={9} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={42} y={STAMP_Y + 60} fontSize={9} fill={TEXT}>
        Check Request Domains or URL Pattern.
      </text>
    </svg>
  );
};

// ── Header operations comparison (overview) ──────────────────────

/**
 * Hero diagram for the Header Actions section. Reads as a single
 * "story": one starting header, four operations, four different
 * outcomes. Each row pairs the operation name + engine pill with a
 * side-by-side before → after that highlights what changed.
 * Locked color contract preserved (blue=DNR, purple=Script).
 */
export const HeaderOpsDiagram: React.FC = () => {
  const ID = 'hop';
  const BEFORE = 'Cookie: a=1';

  type Op = {
    name: string;
    engine: 'DNR' | 'Script';
    after: React.ReactNode;
  };

  const OPS: Op[] = [
    {
      name: 'Override',
      engine: 'DNR',
      after: (
        <tspan>
          Cookie:{' '}
          <tspan fontWeight={700} fill={STROKE_BLUE}>
            Z
          </tspan>
        </tspan>
      ),
    },
    {
      name: 'Append',
      engine: 'DNR',
      after: (
        <tspan>
          a=1 ·{' '}
          <tspan fontWeight={700} fill={STROKE_BLUE}>
            +Cookie: Z
          </tspan>
        </tspan>
      ),
    },
    {
      name: 'Remove',
      engine: 'DNR',
      after: (
        <tspan fontStyle="italic" fill={TEXT_DIM}>
          (header gone)
        </tspan>
      ),
    },
    {
      name: 'Merge',
      engine: 'Script',
      after: (
        <tspan>
          Cookie: a=1
          <tspan fontWeight={700} fill={STROKE_PURPLE}>
            ; new=val
          </tspan>
        </tspan>
      ),
    },
  ];

  const HEADER_Y = 16;
  const BEFORE_BOX_X = 80;
  const BEFORE_BOX_Y = 26;
  const BEFORE_BOX_W = 160;
  const BEFORE_BOX_H = 28;

  const ROW_Y0 = 84;
  const ROW_H = 40;
  const ROW_GAP = 8;
  const ROW_X = 10;
  const ROW_W = 300;

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Four header operations applied to the same starting header — Override replaces, Append adds duplicate, Remove deletes, Merge concatenates."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={HEADER_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Same starting header → four outcomes
      </text>
      <rect
        x={BEFORE_BOX_X}
        y={BEFORE_BOX_Y}
        width={BEFORE_BOX_W}
        height={BEFORE_BOX_H}
        rx={4}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={BEFORE_BOX_X + BEFORE_BOX_W / 2} y={BEFORE_BOX_Y + 12} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        BEFORE
      </text>
      <text
        x={BEFORE_BOX_X + BEFORE_BOX_W / 2}
        y={BEFORE_BOX_Y + 24}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fill={TEXT}
      >
        {BEFORE}
      </text>

      <line
        x1={160}
        y1={BEFORE_BOX_Y + BEFORE_BOX_H}
        x2={160}
        y2={ROW_Y0 - 6}
        stroke={STROKE}
        strokeDasharray="2 3"
      />
      <line x1={160} y1={ROW_Y0 - 6} x2={160} y2={ROW_Y0 - 2} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {OPS.map((op, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const isScript = op.engine === 'Script';
        const accent = isScript ? STROKE_PURPLE : STROKE_BLUE;
        const accentFill = isScript ? FILL_PURPLE : FILL_BLUE;
        return (
          <g key={op.name}>
            <rect
              x={ROW_X}
              y={y}
              width={ROW_W}
              height={ROW_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke="var(--ant-color-border)"
            />
            <rect x={ROW_X} y={y} width={102} height={ROW_H} rx={5} fill={accentFill} stroke={accent} />
            <text x={ROW_X + 12} y={y + 17} fontSize={11} fontWeight={700} fill={TEXT}>
              {op.name}
            </text>
            <rect x={ROW_X + 12} y={y + 22} width={42} height={12} rx={3} fill="var(--ant-color-bg-container)" stroke={accent} />
            <text x={ROW_X + 33} y={y + 31} textAnchor="middle" fontSize={8} fontWeight={700} fill={accent}>
              {op.engine}
            </text>

            <line
              x1={ROW_X + 102 + 4}
              y1={y + ROW_H / 2}
              x2={ROW_X + 130}
              y2={y + ROW_H / 2}
              stroke={accent}
              strokeWidth={1.5}
              markerEnd={`url(#${ID})`}
            />

            <text
              x={ROW_X + 138}
              y={y + ROW_H / 2 + 4}
              fontFamily="monospace"
              fontSize={10}
              fill={TEXT}
            >
              {op.after}
            </text>
          </g>
        );
      })}

      <g transform={`translate(0, ${ROW_Y0 + 4 * (ROW_H + ROW_GAP) + 8})`}>
        <rect x={ROW_X} y={0} width={12} height={12} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <text x={ROW_X + 18} y={9} fontSize={9} fill={TEXT_DIM}>
          DNR — native, applied by Chrome
        </text>
        <rect x={ROW_X} y={16} width={12} height={12} rx={2} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
        <text x={ROW_X + 18} y={25} fontSize={9} fill={TEXT_DIM}>
          Script — patched fetch / XHR (Merge only)
        </text>
      </g>
    </svg>
  );
};
