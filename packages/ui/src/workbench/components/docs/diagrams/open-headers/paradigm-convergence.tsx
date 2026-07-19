import type React from 'react';
import { ArrowDefs, FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT, OhLogoSmall } from './_shared';

/**
 * Convergence diagram — paradigm-shift claim made visible as an actual
 * browser window. Top: three dim "old-world" tool categories. Bottom:
 * a tall Chromium-style browser frame with the workbench extension URL
 * in its address bar, and every capability that USED to require those
 * three tools rendered as pills INSIDE the page body — as if the
 * extension's workbench surface is itself displaying them.
 *
 * Visual hook: the convergence is literal — three boxes feed arrows
 * into a single browser tab, and inside that tab you can see all the
 * capabilities co-existing.
 */
export const ParadigmConvergenceDiagram: React.FC = () => {
  const ID = 'pg-converge';

  type LegacyCategory = { name: string; sub: string };
  const LEGACY: LegacyCategory[] = [
    { name: 'Desktop proxies', sub: 'HTTP interception · CA cert · separate binary' },
    { name: 'API platforms', sub: 'requests + collections · cloud-hosted · account' },
    { name: 'Header extensions', sub: 'one rule type · no scripts · no auth' },
  ];

  /** Pills mirror the eight green claims from the paradigm-shift comparison
   *  so the browser body literally shows what the comparison promises.
   *  `capability` (blue) = features you USE; `posture` (purple) = the way
   *  the product behaves. `badge` is an inline marker (e.g. "#1"). */
  type Pill = { label: string; tone: 'capability' | 'posture'; badge?: string };
  const PILLS: Pill[] = [
    { label: 'Rule Engine', tone: 'capability' },
    { label: 'API Requests Catalog', tone: 'capability' },
    { label: 'Real-time Sync Engine', tone: 'capability' },
    { label: 'Conflict-free Save', tone: 'capability' },
    { label: 'No account · no sign-in', tone: 'posture' },
    { label: 'Local-only · no cloud relay', tone: 'posture' },
    { label: 'No tracking · no personal data', tone: 'posture' },
    { label: 'Multi-surface UI', tone: 'posture' },
  ];

  // Canvas
  const W = 480;

  // Legacy category row
  const CARD_W = 148;
  const CARD_GAP = 8;
  const CARD_Y = 38;
  const CARD_H = 60;
  const totalLegacyW = CARD_W * 3 + CARD_GAP * 2;
  const LEGACY_X0 = (W - totalLegacyW) / 2;

  // Browser window — generously tall
  const BR_X = 10;
  const BR_W = W - 20;
  const BR_Y = 154;
  /** Combined title + tab strip — Chromium-style top row that holds the
   *  traffic-light buttons on the left AND the active tab inline. */
  const BR_TOP_H = 32;
  const BR_ADDR_H = 30;
  const BR_BODY_PAD = 14;

  // Body inside browser — workbench-style content
  const BODY_HEADER_H = 32;
  const PILL_COLS = 2;
  const PILL_GAP_X = 10;
  const PILL_GAP_Y = 8;
  const PILL_H = 26;
  const PILL_AREA_PAD = 12;
  const pillRows = Math.ceil(PILLS.length / PILL_COLS);
  const pillBlockH = pillRows * (PILL_H + PILL_GAP_Y) - PILL_GAP_Y;
  const FOOTER_STRIP_H = 26;
  const BODY_H = BODY_HEADER_H + 10 + pillBlockH + 12 + FOOTER_STRIP_H + 4;
  const BR_H = BR_TOP_H + BR_ADDR_H + BR_BODY_PAD * 2 + BODY_H;

  const BR_BODY_X = BR_X + BR_BODY_PAD;
  const BR_BODY_Y = BR_Y + BR_TOP_H + BR_ADDR_H + BR_BODY_PAD;
  const BR_BODY_W = BR_W - BR_BODY_PAD * 2;
  const PILL_AREA_X = BR_BODY_X + PILL_AREA_PAD;
  const PILL_AREA_Y = BR_BODY_Y + BODY_HEADER_H + 10;
  const PILL_W = (BR_BODY_W - PILL_AREA_PAD * 2 - PILL_GAP_X * (PILL_COLS - 1)) / PILL_COLS;

  const H = BR_Y + BR_H + 28;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Three legacy product categories — desktop proxies, cloud API platforms, header-only extensions — converge into one Open Headers browser extension. A stylized Chromium browser shows the extension's workbench page open, and every capability the three legacy categories used to provide lives inside that single tab."
    >
      <ArrowDefs id={ID} />

      <text x={W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Three tool categories. One extension.
      </text>
      <text x={W / 2} y={30} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        What used to take three separate installs now lives in one browser tab.
      </text>

      {/* Legacy category cards */}
      {LEGACY.map((cat, i) => {
        const x = LEGACY_X0 + i * (CARD_W + CARD_GAP);
        return (
          <g key={cat.name}>
            <rect
              x={x}
              y={CARD_Y}
              width={CARD_W}
              height={CARD_H}
              rx={5}
              fill="var(--ant-color-fill-quaternary)"
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 2"
            />
            <text x={x + CARD_W / 2} y={CARD_Y + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT_DIM}>
              {cat.name}
            </text>
            {cat.sub.split(' · ').map((bit, j) => (
              <text key={j} x={x + 8} y={CARD_Y + 32 + j * 10} fontSize={8} fill={TEXT_DIM}>
                {bit}
              </text>
            ))}
            {/* Converging arrow into the browser tab center */}
            <line
              x1={x + CARD_W / 2}
              y1={CARD_Y + CARD_H + 2}
              x2={W / 2}
              y2={BR_Y - 4}
              stroke={STROKE_BLUE}
              strokeWidth={1.25}
              strokeDasharray="3 2"
              markerEnd={`url(#${ID})`}
            />
          </g>
        );
      })}

      <text
        x={W / 2}
        y={CARD_Y + CARD_H + 30}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={STROKE_BLUE}
        letterSpacing={0.5}
      >
        ▼ ALL OPEN IN ONE TAB
      </text>

      {/* ── Browser window ─────────────────────────────────────── */}
      <rect
        x={BR_X}
        y={BR_Y}
        width={BR_W}
        height={BR_H}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.8}
      />

      {/* Combined title + tab strip — traffic lights and the active tab share one row */}
      <rect
        x={BR_X}
        y={BR_Y}
        width={BR_W}
        height={BR_TOP_H}
        rx={8}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE_BLUE}
      />
      {/* Traffic-light buttons on the far left */}
      <circle cx={BR_X + 12} cy={BR_Y + BR_TOP_H / 2} r={5} fill="#ff5f57" />
      <circle cx={BR_X + 28} cy={BR_Y + BR_TOP_H / 2} r={5} fill="#febc2e" />
      <circle cx={BR_X + 44} cy={BR_Y + BR_TOP_H / 2} r={5} fill="#28c840" />
      {/* Active tab — starts after the traffic lights, vertically centered in the row */}
      {(() => {
        const TAB_X = BR_X + 62;
        const TAB_W = 188;
        const TAB_H = BR_TOP_H - 8;
        const TAB_Y = BR_Y + 4;
        return (
          <g>
            <rect
              x={TAB_X}
              y={TAB_Y}
              width={TAB_W}
              height={TAB_H}
              rx={5}
              fill="var(--ant-color-bg-container)"
              stroke={STROKE_BLUE}
              strokeWidth={1.2}
            />
            <OhLogoSmall x={TAB_X + 8} y={TAB_Y + (TAB_H - 14) / 2} size={14} idSuffix="converge-tab" />
            <text x={TAB_X + 28} y={TAB_Y + TAB_H / 2 + 3} fontSize={10} fontWeight={700} fill={TEXT}>
              #1 Open Headers
            </text>
            <text x={TAB_X + TAB_W - 10} y={TAB_Y + TAB_H / 2 + 3} textAnchor="end" fontSize={11} fill={TEXT_DIM}>
              ×
            </text>
            {/* New-tab button immediately after the tab */}
            <text x={TAB_X + TAB_W + 10} y={TAB_Y + TAB_H / 2 + 4} fontSize={14} fill={TEXT_DIM}>
              +
            </text>
          </g>
        );
      })()}

      {/* Address bar */}
      {(() => {
        const addrY = BR_Y + BR_TOP_H;
        return (
          <g>
            <rect
              x={BR_X}
              y={addrY}
              width={BR_W}
              height={BR_ADDR_H}
              fill="var(--ant-color-bg-container)"
              stroke={STROKE_BLUE}
            />
            {/* Back / forward / reload glyphs */}
            <text x={BR_X + 12} y={addrY + BR_ADDR_H / 2 + 4} fontSize={12} fill={TEXT_DIM}>
              ‹
            </text>
            <text x={BR_X + 26} y={addrY + BR_ADDR_H / 2 + 4} fontSize={12} fill={TEXT_DIM}>
              ›
            </text>
            <text x={BR_X + 40} y={addrY + BR_ADDR_H / 2 + 4} fontSize={11} fill={TEXT_DIM}>
              ↻
            </text>
            {/* URL pill */}
            <rect
              x={BR_X + 56}
              y={addrY + 6}
              width={BR_W - 96}
              height={BR_ADDR_H - 12}
              rx={(BR_ADDR_H - 12) / 2}
              fill="var(--ant-color-fill-quaternary)"
              stroke="var(--ant-color-border)"
            />
            <text x={BR_X + 66} y={addrY + BR_ADDR_H / 2 + 4} fontFamily="monospace" fontSize={9} fill={TEXT}>
              chrome-extension://ablaikadp...joibeejb/workbench.html
            </text>
            {/* Toolbar icon slot */}
            <rect
              x={BR_X + BR_W - 28}
              y={addrY + 5}
              width={18}
              height={BR_ADDR_H - 10}
              rx={4}
              fill="var(--ant-color-fill-secondary)"
              stroke={STROKE_BLUE}
            />
            <OhLogoSmall x={BR_X + BR_W - 26} y={addrY + 7} size={14} idSuffix="converge-icon" />
          </g>
        );
      })()}

      {/* ── Page body (the workbench surface) ─────────────────── */}
      {/* Workbench header band inside the page */}
      <rect
        x={BR_BODY_X}
        y={BR_BODY_Y}
        width={BR_BODY_W}
        height={BODY_HEADER_H}
        rx={6}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
      />
      <OhLogoSmall x={BR_BODY_X + 10} y={BR_BODY_Y + 7} size={18} idSuffix="converge-body" />
      <text x={BR_BODY_X + 34} y={BR_BODY_Y + 14} fontSize={11} fontWeight={700} fill={TEXT}>
        Open Headers
      </text>
      <text x={BR_BODY_X + 34} y={BR_BODY_Y + 26} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        the workbench surface
      </text>
      {/* MV3 chip on the right of the band */}
      <rect
        x={BR_BODY_X + BR_BODY_W - 84}
        y={BR_BODY_Y + 8}
        width={76}
        height={16}
        rx={8}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
      />
      <text
        x={BR_BODY_X + BR_BODY_W - 46}
        y={BR_BODY_Y + 19}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={OH_GREEN}
      >
        MV3 native
      </text>

      {/* Capability + posture pills — mirror the eight green claims from
       *  the paradigm-shift comparison directly inside the page body. */}
      {PILLS.map((p, i) => {
        const col = i % PILL_COLS;
        const row = Math.floor(i / PILL_COLS);
        const x = PILL_AREA_X + col * (PILL_W + PILL_GAP_X);
        const y = PILL_AREA_Y + row * (PILL_H + PILL_GAP_Y);
        const isPosture = p.tone === 'posture';
        const fill = isPosture ? FILL_PURPLE : FILL_BLUE;
        const stroke = isPosture ? STROKE_PURPLE : STROKE_BLUE;
        return (
          <g key={p.label}>
            <rect x={x} y={y} width={PILL_W} height={PILL_H} rx={PILL_H / 2} fill={fill} stroke={stroke} />
            <circle cx={x + 12} cy={y + PILL_H / 2} r={4} fill={stroke} />
            <text x={x + 22} y={y + PILL_H / 2 + 4} fontSize={10} fontWeight={600} fill={TEXT}>
              {p.label}
            </text>
            {p.badge && (
              <g>
                <rect
                  x={x + PILL_W - 28}
                  y={y + (PILL_H - 16) / 2}
                  width={20}
                  height={16}
                  rx={3}
                  fill="var(--ant-color-bg-container)"
                  stroke={stroke}
                  strokeWidth={1.2}
                />
                <text
                  x={x + PILL_W - 18}
                  y={y + PILL_H / 2 + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={900}
                  fill={TEXT}
                >
                  {p.badge}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Footer strip inside the page */}
      <rect
        x={BR_BODY_X + 12}
        y={PILL_AREA_Y + pillBlockH + 12}
        width={BR_BODY_W - 24}
        height={FOOTER_STRIP_H}
        rx={5}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text
        x={BR_BODY_X + BR_BODY_W / 2}
        y={PILL_AREA_Y + pillBlockH + 12 + FOOTER_STRIP_H / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        Multi-surface · cross-device sync · local-only by design
      </text>

      {/* Caption below the browser */}
      <text x={W / 2} y={H - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Blue = capabilities · purple = posture · all eight live inside one tab
      </text>
    </svg>
  );
};
