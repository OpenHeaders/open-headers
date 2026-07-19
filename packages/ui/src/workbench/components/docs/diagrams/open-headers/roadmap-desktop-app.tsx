import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT } from './_shared';

/**
 * Roadmap — Desktop app.
 *
 * Two browser-window cards side by side, each split by a vertical
 * divider into FEATURES (left) and API CATALOG (right). Both cards
 * read the same Workbench surface and the same on-disk workspace
 * store. The Desktop card's right column carries an extra dotted-green
 * block (`DESKTOP-ONLY`) listing the protocols a browser extension
 * cannot host natively (AI · MCP · gRPC · MQTT).
 */
export const RoadmapDesktopAppDiagram: React.FC = () => {
  const W = 480;
  const TITLE_Y = 22;
  const SUBTITLE_Y = 40;

  const CARD_W = 220;
  const CARD_H = 250;
  const CARD_Y = 60;
  const CHROME_H = 24;
  const SURFACE_H = 18;
  const CARD_LEFT_X = 12;
  const CARD_RIGHT_X = W - CARD_W - 12;

  const STORE_Y = CARD_Y + CARD_H + 18;
  const STORE_W = 280;
  const STORE_H = 38;
  const STORE_X = (W - STORE_W) / 2;

  const VERDICT_Y = STORE_Y + STORE_H + 16;
  const VERDICT_H = 38;
  const H = VERDICT_Y + VERDICT_H + 12;
  const CX = W / 2;

  const FEATURES = ['HTTP Rules', 'Variables', 'Workflows', 'API Catalog'];
  const PROTOCOLS_BROWSER = ['HTTP', 'GraphQL', 'WebSocket', 'Socket.IO'];
  const PROTOCOLS_DESKTOP_ONLY: { label: string; note?: string }[] = [
    { label: 'LLM / AI', note: 'local / remote' },
    { label: 'MCP', note: 'local / remote' },
    { label: 'gRPC' },
    { label: 'MQTT' },
  ];

  const renderCard = (x: number, title: string, sideTag: string, extraProtocols: boolean) => {
    const COL_GAP = 1;
    const COL_W = (CARD_W - 14) / 2;
    const leftColX = x + 8;
    const dividerX = leftColX + COL_W + COL_GAP / 2;
    const rightColX = leftColX + COL_W + 4;

    const surfaceY = CARD_Y + CHROME_H;
    const divLineY = surfaceY + SURFACE_H + 2;
    const colTopY = divLineY + 10;
    // Two-column body holds 4 rows max (matched on both cards).
    const bodyEndY = colTopY + 16 + 4 * 16;
    const dottedBoxY = bodyEndY + 12;

    return (
      <g>
        <rect
          x={x}
          y={CARD_Y}
          width={CARD_W}
          height={CARD_H}
          rx={8}
          fill="var(--ant-color-bg-container)"
          stroke={STROKE_BLUE}
          strokeWidth={1.4}
        />
        {/* Chrome */}
        <rect
          x={x}
          y={CARD_Y}
          width={CARD_W}
          height={CHROME_H}
          rx={8}
          fill="var(--ant-color-fill-secondary)"
          stroke={STROKE_BLUE}
        />
        <circle cx={x + 12} cy={CARD_Y + CHROME_H / 2} r={4} fill="#ff5f57" />
        <circle cx={x + 24} cy={CARD_Y + CHROME_H / 2} r={4} fill="#febc2e" />
        <circle cx={x + 36} cy={CARD_Y + CHROME_H / 2} r={4} fill="#28c840" />
        <text x={x + 50} y={CARD_Y + CHROME_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
          {title}
        </text>
        <text
          x={x + CARD_W - 10}
          y={CARD_Y + CHROME_H / 2 + 4}
          textAnchor="end"
          fontSize={9}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {sideTag}
        </text>

        {/* Surface row */}
        <text
          x={x + 12}
          y={surfaceY + SURFACE_H / 2 + 4}
          fontSize={9}
          fontWeight={800}
          fill={TEXT_DIM}
          letterSpacing={0.4}
        >
          SURFACE
        </text>
        <text x={x + 72} y={surfaceY + SURFACE_H / 2 + 4} fontSize={10} fontWeight={700} fill={TEXT}>
          Workbench
        </text>

        {/* Horizontal divider under chrome + surface row */}
        <line x1={x + 6} y1={divLineY} x2={x + CARD_W - 6} y2={divLineY} stroke="var(--ant-color-border-secondary)" />

        {/* Vertical divider between columns — stops above the dotted box */}
        <line
          x1={dividerX}
          y1={divLineY + 4}
          x2={dividerX}
          y2={bodyEndY + 2}
          stroke="var(--ant-color-border-secondary)"
          strokeDasharray="3 3"
        />

        {/* LEFT column — FEATURES */}
        <text x={leftColX + 4} y={colTopY} fontSize={9} fontWeight={800} fill={TEXT_DIM} letterSpacing={0.4}>
          FEATURES
        </text>
        {FEATURES.map((f, i) => (
          <g key={f}>
            <circle cx={leftColX + 8} cy={colTopY + 16 + i * 16} r={2} fill={STROKE_BLUE} />
            <text x={leftColX + 16} y={colTopY + 19 + i * 16} fontSize={10} fontWeight={600} fill={TEXT}>
              {f}
            </text>
          </g>
        ))}

        {/* RIGHT column — API CATALOG (protocols) */}
        <text x={rightColX + 4} y={colTopY} fontSize={9} fontWeight={800} fill={TEXT_DIM} letterSpacing={0.4}>
          API CATALOG
        </text>
        {PROTOCOLS_BROWSER.map((p, i) => (
          <g key={p}>
            <circle cx={rightColX + 8} cy={colTopY + 16 + i * 16} r={2} fill={STROKE_BLUE} />
            <text x={rightColX + 16} y={colTopY + 19 + i * 16} fontSize={10} fontWeight={600} fill={TEXT}>
              {p}
            </text>
          </g>
        ))}

        {/* DESKTOP-ONLY dotted box — spans the full card width, sits
         *  centered below the two-column body. Protocols laid out 2×2
         *  so the box is wide and shallow instead of a tall right-edge
         *  column. */}
        {extraProtocols &&
          (() => {
            const boxX = x + 10;
            const boxW = CARD_W - 20;
            // 3 rows: AI (own row) · MCP (own row) · gRPC + MQTT split
            const ROWS = 3;
            const rowGap = 18;
            const boxH = 18 + ROWS * rowGap + 12;
            const rowStartY = dottedBoxY + 28;
            const halfColX = boxX + boxW / 2;
            const renderItem = (p: { label: string; note?: string }, cx: number, cy: number, center = false) => (
              <g key={p.label}>
                <circle cx={cx} cy={cy - 3} r={2} fill={OH_GREEN} />
                <text
                  x={cx + 8}
                  y={cy}
                  textAnchor={center ? 'start' : 'start'}
                  fontSize={9.5}
                  fontWeight={700}
                  fill={TEXT}
                >
                  {p.label}
                  {p.note && (
                    <tspan fontWeight={500} fontStyle="italic" fill={TEXT_DIM}>
                      {' · '}
                      {p.note}
                    </tspan>
                  )}
                </text>
              </g>
            );
            return (
              <g>
                <rect
                  x={boxX}
                  y={dottedBoxY}
                  width={boxW}
                  height={boxH}
                  rx={5}
                  fill={OH_GREEN_TINT}
                  stroke={OH_GREEN}
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                />
                <text
                  x={boxX + boxW / 2}
                  y={dottedBoxY + 13}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={800}
                  fill={OH_GREEN}
                  letterSpacing={0.6}
                >
                  + DESKTOP-ONLY
                </text>
                {/* Row 1: AI — own row */}
                {renderItem(PROTOCOLS_DESKTOP_ONLY[0], boxX + 14, rowStartY)}
                {/* Row 2: MCP — own row */}
                {renderItem(PROTOCOLS_DESKTOP_ONLY[1], boxX + 14, rowStartY + rowGap)}
                {/* Row 3: gRPC + MQTT — split */}
                {renderItem(PROTOCOLS_DESKTOP_ONLY[2], boxX + 14, rowStartY + 2 * rowGap)}
                {renderItem(PROTOCOLS_DESKTOP_ONLY[3], halfColX, rowStartY + 2 * rowGap)}
              </g>
            );
          })()}

        {/* Browser card footnote — uses the same vertical space the
         *  desktop card uses for its DESKTOP-ONLY block, so cards stay
         *  the same height. */}
        {!extraProtocols && (
          <text
            x={x + CARD_W / 2}
            y={dottedBoxY + 28}
            textAnchor="middle"
            fontSize={9}
            fontStyle="italic"
            fill={TEXT_DIM}
          >
            All four are browser-feasible.
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Roadmap milestone — Desktop app. Browser extension and native desktop app both expose the Workbench surface over the same on-disk store. The desktop app adds protocols a browser extension cannot host natively: AI, MCP, gRPC, MQTT."
    >
      <text x={CX} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Native window · same store · extra reach
      </text>
      <text x={CX} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Same Workbench, same workspace — desktop adds protocols a browser can't host.
      </text>

      {renderCard(CARD_LEFT_X, 'Browser extension', 'today', false)}
      {renderCard(CARD_RIGHT_X, 'Desktop app', 'today', true)}

      {/* Shared store pill */}
      <rect
        x={STORE_X}
        y={STORE_Y}
        width={STORE_W}
        height={STORE_H}
        rx={STORE_H / 2}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeWidth={1.5}
      />
      <text
        x={STORE_X + STORE_W / 2}
        y={STORE_Y + STORE_H / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={OH_GREEN}
      >
        same on-disk workspace store
      </text>
      <line
        x1={CARD_LEFT_X + CARD_W / 2}
        y1={CARD_Y + CARD_H + 2}
        x2={STORE_X + STORE_W * 0.25}
        y2={STORE_Y - 2}
        stroke={OH_GREEN}
        strokeWidth={1.4}
        strokeDasharray="3 2"
      />
      <line
        x1={CARD_RIGHT_X + CARD_W / 2}
        y1={CARD_Y + CARD_H + 2}
        x2={STORE_X + STORE_W * 0.75}
        y2={STORE_Y - 2}
        stroke={OH_GREEN}
        strokeWidth={1.4}
        strokeDasharray="3 2"
      />

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
        One workspace, two front-ends, the extra reach where the browser can't go
      </text>
    </svg>
  );
};
