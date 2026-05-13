import type React from 'react';
import { ArrowDefs, FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * vs Desktop proxies — request path + setup cost.
 *
 * Top row: App → :8080 → Proxy (CA cert) → Internet. Three ✗ setup
 * pills inside the same card, in a row below the flow.
 * Bottom row: Browser (DNR / Script) → Internet, two ✓ setup pills.
 * Both rows use the same template, with setup pills on their own line
 * so nothing overflows the card.
 */
export const ComparisonVsProxyDiagram: React.FC = () => {
  const ID = 'cmp-proxy';

  const W = 480;
  const CX = W / 2;
  const ROW_W = W - 24;
  const ROW_X = 12;
  const HEADER_H = 24;
  const FLOW_H = 60;
  const CHIPS_H = 26;
  const ROW_H = HEADER_H + FLOW_H + CHIPS_H + 14;

  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;
  const ROW1_Y = 60;
  const ROW2_Y = ROW1_Y + ROW_H + 14;
  const VERDICT_Y = ROW2_Y + ROW_H + 12;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;

  const ERR_RED = 'var(--ant-color-error)';
  const ERR_RED_BG = 'var(--ant-color-error-bg)';
  const ERR_RED_BORDER = 'var(--ant-color-error-border)';

  type Node = { label: string; sub?: string; flavor?: 'app' | 'port' | 'proxy' | 'web' | 'cloud' };
  type Chip = { label: string; tone: 'warn' | 'ok' };

  const nodeColors = (flavor: Node['flavor']): { fill: string; stroke: string } => {
    if (flavor === 'proxy') return { fill: FILL_PURPLE, stroke: STROKE_PURPLE };
    if (flavor === 'port') return { fill: 'var(--ant-color-fill-quaternary)', stroke: 'var(--ant-color-border)' };
    if (flavor === 'cloud') return { fill: 'var(--ant-color-fill-secondary)', stroke: 'var(--ant-color-border)' };
    return { fill: FILL_BLUE, stroke: STROKE_BLUE };
  };

  const renderRow = (
    y: number,
    title: string,
    accentColor: string,
    accentBorder: string,
    nodes: Node[],
    chips: Chip[],
  ) => {
    const flowY = y + HEADER_H;
    const cy = flowY + FLOW_H / 2;
    const chipsY = flowY + FLOW_H + 4;

    const NODE_W = 78;
    const NODE_H = 40;
    const NODE_GAP = 28;
    const nodesTotalW = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP;
    const nodesStartX = ROW_X + (ROW_W - nodesTotalW) / 2;

    return (
      <g>
        {/* Outer card — browser-window styling */}
        <rect
          x={ROW_X}
          y={y}
          width={ROW_W}
          height={ROW_H}
          rx={8}
          fill="var(--ant-color-bg-container)"
          stroke={accentBorder}
          strokeWidth={1.4}
        />
        {/* Chrome bar — neutral gray, traffic lights on left, title + tag */}
        <rect
          x={ROW_X}
          y={y}
          width={ROW_W}
          height={HEADER_H}
          rx={8}
          fill="var(--ant-color-fill-secondary)"
          stroke={accentBorder}
        />
        <circle cx={ROW_X + 12} cy={y + HEADER_H / 2} r={4} fill="#ff5f57" />
        <circle cx={ROW_X + 24} cy={y + HEADER_H / 2} r={4} fill="#febc2e" />
        <circle cx={ROW_X + 36} cy={y + HEADER_H / 2} r={4} fill="#28c840" />
        <text x={ROW_X + 50} y={y + HEADER_H / 2 + 4} fontSize={11} fontWeight={700} fill={accentColor}>
          {title}
        </text>
        <text
          x={ROW_X + ROW_W - 12}
          y={y + HEADER_H / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fontWeight={800}
          fill={accentColor}
          letterSpacing={0.6}
        >
          {nodes.length === 2 ? 'INLINE' : 'DETOUR'}
        </text>

        {/* Flow nodes */}
        {nodes.map((n, i) => {
          const x = nodesStartX + i * (NODE_W + NODE_GAP);
          const { fill, stroke } = nodeColors(n.flavor);
          return (
            <g key={`n-${i}`}>
              <rect
                x={x}
                y={cy - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                rx={5}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.2}
              />
              <text x={x + NODE_W / 2} y={cy - 2} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
                {n.label}
              </text>
              {n.sub && (
                <text
                  x={x + NODE_W / 2}
                  y={cy + 12}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontStyle="italic"
                  fill={TEXT_DIM}
                >
                  {n.sub}
                </text>
              )}
            </g>
          );
        })}

        {/* Arrows */}
        {nodes.slice(0, -1).map((_, i) => {
          const x1 = nodesStartX + i * (NODE_W + NODE_GAP) + NODE_W + 3;
          const x2 = nodesStartX + (i + 1) * (NODE_W + NODE_GAP) - 3;
          return (
            <line
              key={`a-${i}`}
              x1={x1}
              y1={cy}
              x2={x2}
              y2={cy}
              stroke={accentColor}
              strokeWidth={1.5}
              markerEnd={`url(#${ID})`}
            />
          );
        })}

        {/* Setup chips — full horizontal row, centered, with padding */}
        {(() => {
          const charW = 6.2;
          const padX = 12;
          const widths = chips.map((c) => Math.round((c.label.length + 2) * charW + padX * 2));
          const gap = 10;
          const totalW = widths.reduce((s, w) => s + w, 0) + (chips.length - 1) * gap;
          const innerStartX = ROW_X + (ROW_W - totalW) / 2;
          let cursor = innerStartX;
          return chips.map((c, i) => {
            const cw = widths[i];
            const cx = cursor;
            cursor += cw + gap;
            const isWarn = c.tone === 'warn';
            const fill = isWarn ? ERR_RED_BG : OH_GREEN_TINT;
            const stroke = isWarn ? ERR_RED : OH_GREEN;
            return (
              <g key={`c-${i}`}>
                <rect x={cx} y={chipsY} width={cw} height={20} rx={10} fill={fill} stroke={stroke} strokeWidth={1} />
                <text x={cx + cw / 2} y={chipsY + 14} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={stroke}>
                  {isWarn ? '✗' : '✓'} {c.label}
                </text>
              </g>
            );
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
      aria-label="vs desktop proxies. Proxies route traffic through a separate process behind a CA certificate. Open Headers applies rules inline through the browser's native APIs — no proxy port, no certificate."
    >
      <ArrowDefs id={ID} />

      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        How requests get shaped
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Inline rules in the browser — no proxy port, no CA certificate, no per-app config.
      </text>

      {renderRow(
        ROW1_Y,
        'Desktop proxy',
        ERR_RED,
        ERR_RED_BORDER,
        [
          { label: 'App', sub: 'configured', flavor: 'app' },
          { label: ':8080', sub: 'proxy port', flavor: 'port' },
          { label: 'Proxy', sub: 'CA cert', flavor: 'proxy' },
          { label: 'Internet', flavor: 'cloud' },
        ],
        [
          { label: 'install binary', tone: 'warn' },
          { label: 'install CA cert', tone: 'warn' },
          { label: 'per-app config', tone: 'warn' },
        ],
      )}

      {renderRow(
        ROW2_Y,
        'Open Headers',
        OH_GREEN,
        OH_GREEN,
        [
          { label: 'Browser', sub: 'DNR / Script', flavor: 'web' },
          { label: 'Internet', flavor: 'cloud' },
        ],
        [
          { label: 'install extension', tone: 'ok' },
          { label: "that's it", tone: 'ok' },
        ],
      )}

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
        One install · zero certificates · rules run with the page's own permissions
      </text>
    </svg>
  );
};
