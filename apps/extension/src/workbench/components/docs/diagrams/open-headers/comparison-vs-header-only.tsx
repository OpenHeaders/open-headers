import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * vs Header-only extensions — capability surface.
 *
 * Two 3×3 grids side by side. Left grid: only `Headers` is lit; the
 * other eight render dim with an ✗ glyph. Right grid: all nine lit.
 * Wider canvas + larger tiles + shortened labels so nothing overflows.
 */
export const ComparisonVsHeaderOnlyDiagram: React.FC = () => {
  const W = 540;
  const CX = W / 2;

  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const GRID_Y = 60;
  const PANEL_W = (W - 36) / 2;
  const PANEL_LEFT_X = 12;
  const PANEL_RIGHT_X = W - PANEL_W - 12;
  const PANEL_HEADER_H = 24;

  const COLS = 3;
  const ROWS = 3;
  const TILE_GAP = 6;
  const SIDE_PAD = 12;
  const TILE_W = Math.floor((PANEL_W - SIDE_PAD * 2 - (COLS - 1) * TILE_GAP) / COLS);
  const TILE_H = 42;
  const GRID_INNER_H = ROWS * TILE_H + (ROWS - 1) * TILE_GAP;
  const PANEL_H = PANEL_HEADER_H + 8 + GRID_INNER_H + 28;

  const VERDICT_Y = GRID_Y + PANEL_H + 12;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;

  const ERR_RED = 'var(--ant-color-error)';
  const ERR_RED_BORDER = 'var(--ant-color-error-border)';

  // Labels deliberately shortened to fit ~70px tiles at fontSize 9.5.
  // Sub-labels render on a second line in dim text.
  const RULES: { label: string; sub?: string }[] = [
    { label: 'Headers', sub: 'override' },
    { label: 'Block', sub: 'cancel' },
    { label: 'Redirect', sub: 'static / regex' },
    { label: 'Query', sub: 'add · remove' },
    { label: 'Merge', sub: 'headers ⊕' },
    { label: 'Inject', sub: 'JS / CSS' },
    { label: 'Delay', sub: 'nav / fetch' },
    { label: 'Req Body', sub: 'static · dyn' },
    { label: 'Res Body', sub: 'body / status' },
  ];

  const renderGrid = (panelX: number, lit: 'one' | 'all') => {
    const innerX = panelX + SIDE_PAD;
    const innerY = GRID_Y + PANEL_HEADER_H + 8;
    return RULES.map((rule, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const x = innerX + c * (TILE_W + TILE_GAP);
      const y = innerY + r * (TILE_H + TILE_GAP);
      const isLit = lit === 'all' || (lit === 'one' && i === 0);
      const fill = isLit ? OH_GREEN_TINT : 'var(--ant-color-fill-quaternary)';
      const stroke = isLit ? OH_GREEN : 'var(--ant-color-border)';
      const labelColor = isLit ? TEXT : TEXT_DIM;
      const subColor = isLit ? OH_GREEN : TEXT_DIM;
      const glyph = isLit ? '✓' : '✗';
      const glyphColor = isLit ? OH_GREEN : ERR_RED;
      return (
        <g key={`${lit}-${i}`}>
          <rect x={x} y={y} width={TILE_W} height={TILE_H} rx={4} fill={fill} stroke={stroke} strokeWidth={1.2} />
          <text x={x + 6} y={y + 13} fontSize={10} fontWeight={800} fill={glyphColor}>
            {glyph}
          </text>
          <text
            x={x + TILE_W / 2}
            y={y + TILE_H / 2 + 1}
            textAnchor="middle"
            fontSize={10}
            fontWeight={700}
            fill={labelColor}
          >
            {rule.label}
          </text>
          {rule.sub && (
            <text
              x={x + TILE_W / 2}
              y={y + TILE_H - 6}
              textAnchor="middle"
              fontSize={7.5}
              fontStyle="italic"
              fill={subColor}
              opacity={isLit ? 0.9 : 0.7}
            >
              {rule.sub}
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 600 }}
      role="img"
      aria-label="vs header-only extensions. Header-only extensions handle one rule type. Open Headers handles nine — headers, block, redirect, query params, headers merge, inject, delay, request body, response body."
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        How many rule types
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        One tool that does one thing — or one tool that does nine.
      </text>

      {/* LEFT — header-only, browser-window styling */}
      <rect
        x={PANEL_LEFT_X}
        y={GRID_Y}
        width={PANEL_W}
        height={PANEL_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={ERR_RED_BORDER}
        strokeWidth={1.4}
      />
      <rect
        x={PANEL_LEFT_X}
        y={GRID_Y}
        width={PANEL_W}
        height={PANEL_HEADER_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={ERR_RED_BORDER}
      />
      <circle cx={PANEL_LEFT_X + 12} cy={GRID_Y + PANEL_HEADER_H / 2} r={4} fill="#ff5f57" />
      <circle cx={PANEL_LEFT_X + 24} cy={GRID_Y + PANEL_HEADER_H / 2} r={4} fill="#febc2e" />
      <circle cx={PANEL_LEFT_X + 36} cy={GRID_Y + PANEL_HEADER_H / 2} r={4} fill="#28c840" />
      <text x={PANEL_LEFT_X + 50} y={GRID_Y + PANEL_HEADER_H / 2 + 4} fontSize={11} fontWeight={700} fill={ERR_RED}>
        Header-only extension
      </text>
      <text
        x={PANEL_LEFT_X + PANEL_W - 12}
        y={GRID_Y + PANEL_HEADER_H / 2 + 4}
        textAnchor="end"
        fontSize={10}
        fontWeight={800}
        fill={ERR_RED}
        letterSpacing={0.4}
      >
        1 / 9
      </text>
      {renderGrid(PANEL_LEFT_X, 'one')}
      <text
        x={PANEL_LEFT_X + PANEL_W / 2}
        y={GRID_Y + PANEL_HEADER_H + 8 + GRID_INNER_H + 18}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={ERR_RED}
      >
        Need any of the other 8? — install another extension
      </text>

      {/* RIGHT — Open Headers, browser-window styling */}
      <rect
        x={PANEL_RIGHT_X}
        y={GRID_Y}
        width={PANEL_W}
        height={PANEL_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={OH_GREEN}
        strokeWidth={2}
      />
      <rect
        x={PANEL_RIGHT_X}
        y={GRID_Y}
        width={PANEL_W}
        height={PANEL_HEADER_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={OH_GREEN}
      />
      <circle cx={PANEL_RIGHT_X + 12} cy={GRID_Y + PANEL_HEADER_H / 2} r={4} fill="#ff5f57" />
      <circle cx={PANEL_RIGHT_X + 24} cy={GRID_Y + PANEL_HEADER_H / 2} r={4} fill="#febc2e" />
      <circle cx={PANEL_RIGHT_X + 36} cy={GRID_Y + PANEL_HEADER_H / 2} r={4} fill="#28c840" />
      <text x={PANEL_RIGHT_X + 50} y={GRID_Y + PANEL_HEADER_H / 2 + 4} fontSize={11} fontWeight={700} fill={OH_GREEN}>
        Open Headers
      </text>
      <text
        x={PANEL_RIGHT_X + PANEL_W - 12}
        y={GRID_Y + PANEL_HEADER_H / 2 + 4}
        textAnchor="end"
        fontSize={10}
        fontWeight={800}
        fill={OH_GREEN}
        letterSpacing={0.4}
      >
        9 / 9
      </text>
      {renderGrid(PANEL_RIGHT_X, 'all')}
      <text
        x={PANEL_RIGHT_X + PANEL_W / 2}
        y={GRID_Y + PANEL_HEADER_H + 8 + GRID_INNER_H + 18}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={OH_GREEN}
      >
        Same conditions, same surface, one workspace
      </text>

      {/* Verdict */}
      <rect
        x={12}
        y={VERDICT_Y}
        width={W - 24}
        height={VERDICT_H}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text x={CX} y={VERDICT_Y + VERDICT_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        Nine rule types, one condition language, one observable surface
      </text>
    </svg>
  );
};
