/**
 * Open Headers — top-level group diagrams.
 *
 * "What do we do (differently)" page:
 *   ParadigmShiftDiagram         — two-column us-vs-them comparison
 *                                   (first sub-section).
 *   ParadigmConvergenceDiagram   — three legacy tool categories collapsing
 *                                   into one extension.
 *   ParadigmRuleEngineDiagram    — DNR + Script engine columns, rule
 *                                   types grouped, conditions + scopes.
 *   ParadigmApiCatalogDiagram    — request-editor mockup + protocol
 *                                   chips + capability strip.
 *   ParadigmLocalFirstDiagram    — your device at the center; cloud /
 *                                   telemetry / account explicitly rejected.
 *   ParadigmFieldSyncDiagram     — per-field sync: two surfaces edit
 *                                   the same rule, different fields,
 *                                   both edits land.
 *
 * Comparison page:
 *   ComparisonMatrixDiagram      — three product categories vs us.
 *
 * Roadmap page:
 *   RoadmapMilestonesDiagram     — ordered milestone cards.
 */

import type React from 'react';
import { ArrowDefs, FILL_BLUE, FILL_PURPLE, STROKE_BLUE, STROKE_GREEN, STROKE_PURPLE, TEXT, TEXT_DIM } from './_shared';

// Local saturated-green palette. We deliberately avoid `_shared`
// FILL_GREEN / STROKE_GREEN — they map to Ant's `success-bg` /
// `success-border` which render as a washed-out lime on light
// themes. These use the vibrant `success` token + a low-alpha tint
// for fill so the green still reads on a white panel.
const OH_GREEN = 'var(--ant-color-success)';
const OH_GREEN_TINT = 'rgba(82, 196, 26, 0.12)';

/**
 * Mini Open Headers logo, scaled into a small box. Mirrors the
 * pixel-art mark from `apps/extension/src/assets/images/logo-pixel.svg`
 * so the visual identity matches the actual extension.
 */
const OhLogoSmall: React.FC<{ x: number; y: number; size: number; idSuffix: string }> = ({ x, y, size, idSuffix }) => {
  const scale = size / 512;
  const gradId = `oh-${idSuffix}`;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5890FF" />
          <stop offset="100%" stopColor="#4A7FE8" />
        </linearGradient>
      </defs>
      <rect width={512} height={512} rx={80} fill={`url(#${gradId})`} />
      <g transform="translate(32 32) scale(0.875)">
        <g fill="white" shapeRendering="crispEdges">
          <rect x={80} y={112} width={128} height={32} />
          <rect x={48} y={144} width={64} height={160} />
          <rect x={176} y={144} width={64} height={160} />
          <rect x={80} y={304} width={128} height={32} />
          <rect x={272} y={112} width={64} height={224} />
          <rect x={400} y={112} width={64} height={224} />
          <rect x={272} y={208} width={192} height={32} />
        </g>
        <rect x={112} y={144} width={64} height={160} fill="#FF4444" shapeRendering="crispEdges" />
        <path
          d="M 80 388 C 180 448, 332 448, 432 388"
          stroke="white"
          strokeWidth={28}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
};

/**
 * Comparison matrix — four stacked category cards. The first three are
 * the product categories Open Headers competes with; the fourth is us,
 * accented with the brand blue. Each card carries 3–4 attribute rows
 * with ✓ / ✗ glyphs so the trade-off reads at a glance.
 */
export const ComparisonMatrixDiagram: React.FC = () => {
  type Row = { ok: boolean; text: string };
  type Card = { category: string; tag: string; rows: Row[]; us?: boolean };

  const CARDS: Card[] = [
    {
      category: 'SaaS API platforms',
      tag: 'cloud',
      rows: [
        { ok: false, text: 'Your data lives on their servers' },
        { ok: false, text: 'Account + login required' },
        { ok: true, text: 'Broad feature set' },
      ],
    },
    {
      category: 'Desktop proxies',
      tag: 'native',
      rows: [
        { ok: false, text: 'Separate binary to install + run' },
        { ok: false, text: 'CA cert + per-app proxy config' },
        { ok: true, text: 'Sees every kind of traffic' },
      ],
    },
    {
      category: 'Header-only extensions',
      tag: 'lite',
      rows: [
        { ok: true, text: 'In-browser, no setup' },
        { ok: false, text: 'One rule type — headers only' },
        { ok: false, text: 'No scripts, no auth, no body edits' },
      ],
    },
    {
      category: 'Open Headers',
      tag: 'us',
      us: true,
      rows: [
        { ok: true, text: 'In-browser · local-only · no account' },
        { ok: true, text: 'Nine rule types · one condition language' },
        { ok: true, text: 'Scripts + OAuth + files in the extension' },
        { ok: true, text: 'Four surfaces share one store' },
      ],
    },
  ];

  const CARD_X = 14;
  const CARD_W = 292;
  const CARD_GAP = 8;
  const CARD_Y_START = 32;
  const cardHeight = (rows: number) => 22 + rows * 14 + 12;

  let cursorY = CARD_Y_START;

  return (
    <svg
      viewBox="0 0 320 380"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Four category cards comparing SaaS API platforms, desktop proxies, and header-only extensions against Open Headers."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHERE OPEN HEADERS LANDS
      </text>

      {CARDS.map((card) => {
        const h = cardHeight(card.rows.length);
        const y = cursorY;
        cursorY = y + h + CARD_GAP;
        const accent = card.us ? STROKE_BLUE : 'var(--ant-color-border)';
        const accentBg = card.us ? FILL_BLUE : 'var(--ant-color-bg-container)';
        return (
          <g key={card.category}>
            <rect
              x={CARD_X}
              y={y}
              width={CARD_W}
              height={h}
              rx={6}
              fill={card.us ? accentBg : 'var(--ant-color-bg-container)'}
              stroke={accent}
              strokeWidth={card.us ? 1.5 : 1}
            />
            <rect x={CARD_X} y={y + 1} width={4} height={h - 2} rx={2} fill={accent} />

            <text x={CARD_X + 14} y={y + 16} fontSize={11} fontWeight={700} fill={TEXT}>
              {card.category}
            </text>
            <rect
              x={CARD_X + CARD_W - 56}
              y={y + 5}
              width={46}
              height={14}
              rx={7}
              fill={card.us ? accent : 'var(--ant-color-fill-quaternary)'}
              stroke={accent}
            />
            <text
              x={CARD_X + CARD_W - 33}
              y={y + 15}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={card.us ? 'var(--ant-color-bg-container)' : TEXT_DIM}
            >
              {card.tag}
            </text>

            {card.rows.map((row, i) => {
              const ry = y + 32 + i * 14;
              const glyphColor = row.ok ? STROKE_GREEN : 'var(--ant-color-error)';
              return (
                <g key={i}>
                  <text x={CARD_X + 16} y={ry} fontSize={11} fontWeight={700} fill={glyphColor}>
                    {row.ok ? '✓' : '✗'}
                  </text>
                  <text x={CARD_X + 30} y={ry} fontSize={10} fill={row.ok ? TEXT : TEXT_DIM}>
                    {row.text}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

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
    { label: 'Rule Engine', tone: 'capability', badge: '#1' },
    { label: 'API Requests Catalog', tone: 'capability' },
    { label: 'Real-time Sync Engine', tone: 'capability' },
    { label: 'Conflict-free Saves', tone: 'capability' },
    { label: 'No account · no sign-in', tone: 'posture' },
    { label: 'Local-only · no cloud relay', tone: 'posture' },
    { label: 'No telemetry · no tracking', tone: 'posture' },
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

/**
 * Local-first diagram — four hosting choices laid out as a vertical
 * stack with PROGRESSIVE DISCLOSURE. Each card has a fixed-width
 * header column on the left (icon + title + sub + tier badge); the
 * right column shows two zones — the bullets it INHERITS from the
 * previous tier (muted grey) and the bullets it ADDS in this tier
 * (highlighted inside a green dotted rectangle captioned "+ new in
 * this tier"). The first card has no inheritance so it renders its
 * bullets in the normal style without the dotted box.
 *
 * Visual story: capability grows additively as you move through the
 * tiers. The user sees what they keep AND what they gain at each step.
 *
 * Third column on the right of each card lists the platforms each
 * hosting tier supports (browsers / OSes / clouds), grouped where it
 * helps. This fills the right side of the card and answers "but where
 * can I actually run it?" without leaving the diagram.
 */
export const ParadigmLocalFirstDiagram: React.FC = () => {
  type Icon = 'browser' | 'desktop' | 'daemon' | 'vm';
  type Bullet = { text: string; status: 'carried' | 'new' };
  type PlatformItem = { label: string; note?: string };
  type PlatformGroup = { label?: string; items: PlatformItem[] };
  type Choice = {
    title: string;
    sub: string;
    badge: 'TODAY' | 'ROADMAP';
    icon: Icon;
    bullets: Bullet[];
    inheritsFrom?: string;
    platforms: PlatformGroup[];
  };

  const CHOICES: Choice[] = [
    {
      title: 'In-browser',
      sub: 'extension service worker',
      badge: 'TODAY',
      icon: 'browser',
      bullets: [
        { text: 'zero setup', status: 'new' },
        { text: 'single device', status: 'new' },
        { text: 'per-browser instance', status: 'new' },
        { text: 'multi-window editing', status: 'new' },
        { text: 'Localhost-only', status: 'new' },
        { text: 'browser.storage.local', status: 'new' },
      ],
      platforms: [
        {
          items: [
            { label: 'Chrome' },
            { label: 'Firefox' },
            { label: 'Edge' },
            { label: 'Safari', note: 'soon' },
          ],
        },
      ],
    },
    {
      title: 'Desktop app',
      sub: 'embedded back-end',
      badge: 'ROADMAP',
      icon: 'desktop',
      inheritsFrom: 'In-browser',
      bullets: [
        { text: 'zero setup', status: 'carried' },
        { text: 'single device', status: 'carried' },
        { text: 'multi-window editing', status: 'carried' },
        { text: 'Localhost-only', status: 'carried' },
        { text: 'multi-browser instances', status: 'new' },
        { text: 'native filesystem', status: 'new' },
        { text: 'YAML on disk', status: 'new' },
        { text: 'git integration (local/remote)', status: 'new' },
      ],
      platforms: [{ items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] }],
    },
    {
      title: 'Local daemon',
      sub: 'standalone process',
      badge: 'ROADMAP',
      icon: 'daemon',
      inheritsFrom: 'Desktop app',
      bullets: [
        { text: 'multi-browser instances', status: 'carried' },
        { text: 'multi-window editing', status: 'carried' },
        { text: 'native filesystem', status: 'carried' },
        { text: 'YAML on disk', status: 'carried' },
        { text: 'git integration (local/remote)', status: 'carried' },
        { text: 'minimal setup', status: 'new' },
        { text: 'multiple devices', status: 'new' },
        { text: 'browser ext · desktop app · CLI', status: 'new' },
        { text: 'LAN-reachable', status: 'new' },
      ],
      platforms: [
        { label: 'All OS', items: [{ label: 'macOS' }, { label: 'Windows' }, { label: 'Linux' }] },
        { label: 'Embedded', items: [{ label: 'Raspberry Pi' }, { label: 'NAS' }] },
      ],
    },
    {
      title: 'Your VM',
      sub: 'host it anywhere',
      badge: 'ROADMAP',
      icon: 'vm',
      inheritsFrom: 'Local daemon',
      bullets: [
        { text: 'multiple devices', status: 'carried' },
        { text: 'multi-browser instances', status: 'carried' },
        { text: 'multi-window editing', status: 'carried' },
        { text: 'native filesystem', status: 'carried' },
        { text: 'YAML on disk', status: 'carried' },
        { text: 'git integration (local/remote)', status: 'carried' },
        { text: 'browser ext · desktop app · CLI', status: 'carried' },
        { text: 'standard setup', status: 'new' },
        { text: 'WAN/Internet-reachable', status: 'new' },
        { text: 'team-ready', status: 'new' },
        { text: 'SSO Auth', status: 'new' },
        { text: 'RBAC user management', status: 'new' },
        { text: 'audit logs & reports', status: 'new' },
      ],
      platforms: [
        { label: 'Hyperscalers', items: [{ label: 'AWS' }, { label: 'Azure' }, { label: 'Google Cloud' }] },
        {
          label: 'EU-native',
          items: [{ label: 'Scaleway' }, { label: 'OVHcloud' }, { label: 'Hetzner' }, { label: 'IONOS' }],
        },
        { label: 'Other', items: [{ label: 'DigitalOcean' }, { label: 'Heroku' }] },
        { label: 'Enterprise', items: [{ label: 'Your cloud' }, { label: 'On-prem' }] },
      ],
    },
  ];

  // Canvas geometry — wider viewBox to fit the third column.
  const W = 540;
  const PAD = 12;
  const CARD_X = PAD;
  const CARD_W = W - PAD * 2;
  const CARD_GAP = 12;

  const INNER_PAD = 4;
  const HEADER_COL_W = 130;
  const BULLETS_COL_W = 240;
  const PLATFORM_COL_W = 110;
  const COL_GAP = 14;

  const HEADER_X = CARD_X + INNER_PAD;
  const SEPARATOR_1_X = HEADER_X + HEADER_COL_W;
  const BULLETS_X = SEPARATOR_1_X + COL_GAP;
  const SEPARATOR_2_X = BULLETS_X + BULLETS_COL_W;
  const PLATFORM_X = SEPARATOR_2_X + COL_GAP;

  const BULLET_X = BULLETS_X + 6;
  const BULLET_H = 14;
  const HEADER_MIN_H = 116;

  const PLATFORM_CHIP_H = 14;
  const PLATFORM_CHIP_GAP = 3;
  const PLATFORM_GROUP_LABEL_H = 14;
  const PLATFORM_GROUP_GAP = 6;
  const PLATFORM_SECTION_LABEL_H = 14;

  /** Compute card body height — accounts for the inherits caption,
   *  carried-bullets block, dotted-rectangle wrapping the new bullets,
   *  and the platform list height (we take the tallest of the three
   *  columns as the body height floor). */
  const cardBodyHeight = (c: Choice) => {
    const carried = c.bullets.filter((b) => b.status === 'carried');
    const newOnes = c.bullets.filter((b) => b.status === 'new');
    const bulletsCol = !c.inheritsFrom
      ? c.bullets.length * BULLET_H + 8
      : 14 + carried.length * BULLET_H + 10 + 18 + newOnes.length * BULLET_H + 12;

    const platformsCol = (() => {
      let h = PLATFORM_SECTION_LABEL_H;
      c.platforms.forEach((g) => {
        if (g.label) h += PLATFORM_GROUP_LABEL_H;
        h += g.items.length * (PLATFORM_CHIP_H + PLATFORM_CHIP_GAP);
        h += PLATFORM_GROUP_GAP;
      });
      return h;
    })();

    return Math.max(bulletsCol, platformsCol, HEADER_MIN_H);
  };
  const cardTotalHeight = (c: Choice) => 14 + cardBodyHeight(c) + 14;

  const TITLE_Y = 24;
  const SUBTITLE_Y = 44;
  const CARDS_Y0 = SUBTITLE_Y + 26;

  let cursor = CARDS_Y0;
  const cardLayout = CHOICES.map((c) => {
    const h = cardTotalHeight(c);
    const y = cursor;
    cursor += h + CARD_GAP;
    return { y, h };
  });

  const STRIP_Y = cursor + 4;
  const STRIP_H = 50;
  const FOOTER_Y = STRIP_Y + STRIP_H + 22;
  const H = FOOTER_Y + 14;

  const GOLD = 'rgba(212, 145, 0, 1)';
  const GOLD_BG = 'rgba(250, 173, 20, 0.18)';
  const MUTED = 'var(--ant-color-text-tertiary)';
  const MUTED_DOT = 'var(--ant-color-text-quaternary)';

  const renderIcon = (icon: Icon, cx: number, cy: number) => {
    const stroke = STROKE_BLUE;
    const fill = FILL_BLUE;
    switch (icon) {
      case 'browser':
        return (
          <g>
            <rect
              x={cx - 22}
              y={cy - 14}
              width={44}
              height={28}
              rx={3}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
            />
            <rect x={cx - 22} y={cy - 14} width={44} height={7} rx={3} fill={fill} stroke={stroke} />
            <circle cx={cx - 18} cy={cy - 10.5} r={1.2} fill={stroke} />
            <circle cx={cx - 14} cy={cy - 10.5} r={1.2} fill={stroke} />
            <circle cx={cx - 10} cy={cy - 10.5} r={1.2} fill={stroke} />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={cx - 18}
                y={cy - 4 + i * 5}
                width={36 - i * 8}
                height={2}
                rx={1}
                fill="var(--ant-color-fill-tertiary)"
              />
            ))}
          </g>
        );
      case 'desktop':
        return (
          <g>
            <rect
              x={cx - 22}
              y={cy - 16}
              width={44}
              height={26}
              rx={2}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
            />
            <rect x={cx - 19} y={cy - 13} width={38} height={20} fill={fill} stroke={stroke} />
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={cx - 16}
                y={cy - 10 + i * 4}
                width={32 - i * 6}
                height={1.8}
                rx={0.8}
                fill="var(--ant-color-bg-container)"
                opacity={0.7}
              />
            ))}
            <rect x={cx - 4} y={cy + 10} width={8} height={4} fill={stroke} />
            <rect x={cx - 10} y={cy + 14} width={20} height={2} rx={1} fill={stroke} />
          </g>
        );
      case 'daemon':
        return (
          <g>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect
                  x={cx - 22}
                  y={cy - 16 + i * 11}
                  width={44}
                  height={9}
                  rx={2}
                  fill={FILL_PURPLE}
                  stroke={STROKE_PURPLE}
                />
                <circle cx={cx - 17} cy={cy - 11.5 + i * 11} r={1.8} fill={OH_GREEN} />
                <rect
                  x={cx - 12}
                  y={cy - 13 + i * 11}
                  width={28}
                  height={2}
                  rx={1}
                  fill="var(--ant-color-fill-tertiary)"
                />
              </g>
            ))}
          </g>
        );
      case 'vm':
        return (
          <g>
            <path
              d={`M ${cx - 18} ${cy + 6}
                  c -8 0 -8 -10 0 -10
                  c 0 -8 12 -8 14 -2
                  c 2 -6 14 -4 14 4
                  c 6 0 6 8 0 8 Z`}
              fill="var(--ant-color-bg-container)"
              stroke={stroke}
              strokeWidth={1.5}
            />
            <rect x={cx - 4} y={cy - 2} width={8} height={6} rx={1} fill={fill} stroke={stroke} />
            <path d={`M ${cx - 3} ${cy - 2} v -2 a 3 3 0 0 1 6 0 v 2`} fill="none" stroke={stroke} strokeWidth={1.2} />
          </g>
        );
    }
  };

  /** Render the platforms column for a card, top-anchored at startY. */
  const renderPlatforms = (groups: PlatformGroup[], startY: number) => {
    const els: React.ReactNode[] = [];
    els.push(
      <text
        key="hdr"
        x={PLATFORM_X}
        y={startY}
        fontSize={9}
        fontWeight={800}
        fill={MUTED}
        letterSpacing={0.6}
      >
        SUPPORTS
      </text>,
    );
    let cursorY = startY + PLATFORM_SECTION_LABEL_H;
    groups.forEach((g, gi) => {
      if (g.label) {
        els.push(
          <text
            key={`gl-${gi}`}
            x={PLATFORM_X}
            y={cursorY + 9}
            fontSize={8}
            fontWeight={700}
            fill={MUTED}
            letterSpacing={0.4}
          >
            {g.label.toUpperCase()}
          </text>,
        );
        cursorY += PLATFORM_GROUP_LABEL_H;
      }
      g.items.forEach((p, pi) => {
        const chipY = cursorY;
        els.push(
          <g key={`p-${gi}-${pi}`}>
            <rect
              x={PLATFORM_X}
              y={chipY}
              width={PLATFORM_COL_W}
              height={PLATFORM_CHIP_H}
              rx={3}
              fill={FILL_BLUE}
              stroke={STROKE_BLUE}
              strokeWidth={0.8}
            />
            <text
              x={PLATFORM_X + 6}
              y={chipY + 10}
              fontSize={8.5}
              fontWeight={700}
              fill={TEXT}
            >
              {p.label}
            </text>
            {p.note && (
              <text
                x={PLATFORM_X + PLATFORM_COL_W - 6}
                y={chipY + 10}
                textAnchor="end"
                fontSize={7}
                fontStyle="italic"
                fill={MUTED}
              >
                {p.note}
              </text>
            )}
          </g>,
        );
        cursorY += PLATFORM_CHIP_H + PLATFORM_CHIP_GAP;
      });
      cursorY += PLATFORM_GROUP_GAP;
    });
    return els;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 600 }}
      role="img"
      aria-label="Where your data lives — pick your back-end. Four hosting options stacked vertically. Each tier inherits all capabilities from the previous tier and adds new ones, highlighted in a green dotted rectangle. A SUPPORTS column on the right lists the browsers, operating systems, and cloud providers each tier runs on. All four tiers local-only."
    >
      <text x={W / 2} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Where your data lives — pick your back-end
      </text>
      <text x={W / 2} y={SUBTITLE_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Each tier inherits the previous tier — green box shows what's new — right column shows where it runs.
      </text>

      {CHOICES.map((c, i) => {
        const { y, h } = cardLayout[i];
        const isToday = c.badge === 'TODAY';
        const accent = isToday ? STROKE_BLUE : 'var(--ant-color-border)';
        const badgeStroke = isToday ? OH_GREEN : GOLD;
        const badgeBg = isToday ? OH_GREEN_TINT : GOLD_BG;

        const headerCX = HEADER_X + HEADER_COL_W / 2;
        const iconCY = y + 34;
        const titleY = y + 68;
        const subY = y + 80;
        const badgeY = y + 92;

        const carried = c.bullets.filter((b) => b.status === 'carried');
        const newOnes = c.bullets.filter((b) => b.status === 'new');

        return (
          <g key={c.title}>
            {/* Card frame */}
            <rect
              x={CARD_X}
              y={y}
              width={CARD_W}
              height={h}
              rx={8}
              fill="var(--ant-color-bg-container)"
              stroke={accent}
              strokeWidth={isToday ? 2 : 1.2}
            />

            {/* Header / bullets separator */}
            <line
              x1={SEPARATOR_1_X}
              y1={y + 10}
              x2={SEPARATOR_1_X}
              y2={y + h - 10}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />
            {/* Bullets / platforms separator */}
            <line
              x1={SEPARATOR_2_X}
              y1={y + 10}
              x2={SEPARATOR_2_X}
              y2={y + h - 10}
              stroke="var(--ant-color-border-secondary)"
              strokeDasharray="3 3"
            />

            {/* Header column */}
            {renderIcon(c.icon, headerCX, iconCY)}
            <text x={headerCX} y={titleY} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
              {c.title}
            </text>
            <text x={headerCX} y={subY} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
              {c.sub}
            </text>
            <rect
              x={headerCX - 36}
              y={badgeY}
              width={72}
              height={18}
              rx={9}
              fill={badgeBg}
              stroke={badgeStroke}
              strokeWidth={1.2}
            />
            <text
              x={headerCX}
              y={badgeY + 12}
              textAnchor="middle"
              fontSize={9}
              fontWeight={800}
              fill={badgeStroke}
              letterSpacing={1}
            >
              {c.badge}
            </text>

            {/* Bullets column */}
            {!c.inheritsFrom ? (
              <g>
                {c.bullets.map((b, j) => (
                  <g key={`b-${j}`}>
                    <circle cx={BULLET_X} cy={y + 22 + j * BULLET_H} r={2} fill={STROKE_BLUE} />
                    <text x={BULLET_X + 8} y={y + 25 + j * BULLET_H} fontSize={10} fill={TEXT}>
                      {b.text}
                    </text>
                  </g>
                ))}
              </g>
            ) : (
              (() => {
                const captionY = y + 18;
                const carriedStartY = captionY + 14;
                const carriedEndY = carriedStartY + carried.length * BULLET_H;
                const dottedY = carriedEndY + 8;
                const dottedCaptionH = 18;
                const dottedPadding = 12;
                const dottedH = dottedCaptionH + newOnes.length * BULLET_H + dottedPadding;
                // Dotted box constrained to the bullets column only.
                const dottedX = BULLET_X - 6;
                const dottedW = BULLETS_COL_W - 10;

                return (
                  <g>
                    <text x={BULLET_X - 4} y={captionY} fontSize={9} fontWeight={700} fill={MUTED} letterSpacing={0.5}>
                      INHERITS FROM {c.inheritsFrom.toUpperCase()}
                    </text>
                    {carried.map((b, j) => (
                      <g key={`c-${j}`}>
                        <circle cx={BULLET_X} cy={carriedStartY + 4 + j * BULLET_H} r={1.6} fill={MUTED_DOT} />
                        <text x={BULLET_X + 8} y={carriedStartY + 7 + j * BULLET_H} fontSize={9} fill={MUTED}>
                          {b.text}
                        </text>
                      </g>
                    ))}

                    <rect
                      x={dottedX}
                      y={dottedY}
                      width={dottedW}
                      height={dottedH}
                      rx={6}
                      fill={OH_GREEN_TINT}
                      stroke={OH_GREEN}
                      strokeWidth={1.3}
                      strokeDasharray="4 3"
                    />
                    <text
                      x={BULLET_X - 2}
                      y={dottedY + 12}
                      fontSize={9}
                      fontWeight={800}
                      fill={OH_GREEN}
                      letterSpacing={0.6}
                    >
                      + NEW IN THIS TIER
                    </text>
                    {newOnes.map((b, j) => (
                      <g key={`n-${j}`}>
                        <circle
                          cx={BULLET_X}
                          cy={dottedY + dottedCaptionH + 4 + j * BULLET_H}
                          r={2}
                          fill={STROKE_BLUE}
                        />
                        <text
                          x={BULLET_X + 8}
                          y={dottedY + dottedCaptionH + 7 + j * BULLET_H}
                          fontSize={10}
                          fontWeight={600}
                          fill={TEXT}
                        >
                          {b.text}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()
            )}

            {/* Platforms column */}
            {renderPlatforms(c.platforms, y + 18)}
          </g>
        );
      })}

      {/* Bottom posture strip */}
      <rect
        x={PAD}
        y={STRIP_Y}
        width={W - PAD * 2}
        height={STRIP_H}
        rx={8}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeWidth={1.5}
      />
      <text
        x={W / 2}
        y={STRIP_Y + 18}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={OH_GREEN}
        letterSpacing={0.5}
      >
        WHATEVER YOU PICK — YOU OWN IT, END-TO-END
      </text>
      <text x={W / 2} y={STRIP_Y + 36} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        ✓ no account · ✓ no cloud relay · ✓ no telemetry · ✓ no phone-home
      </text>

      <text x={W / 2} y={FOOTER_Y} textAnchor="middle" fontSize={10} fontStyle="italic" fill={STROKE_BLUE}>
        Your data, your back-end, your choice — at every step.
      </text>
    </svg>
  );
};

/**
 * Field-level sync diagram — two surfaces (popup + workbench) edit the
 * SAME rule at the same time, each touching a DIFFERENT field. The
 * sync engine lets both land — no stale-draft banner, no overwrite,
 * no "someone changed this while you were editing" prompt.
 *
 * Layout: two surface cards on top showing each surface's edit. Both
 * arrows feed into the rule entity below, which renders the merged
 * snapshot with BOTH fields highlighted green. The implementation
 * mechanism is deliberately not surfaced — the diagram shows the
 * observable behavior, not the proprietary engine internals.
 */
export const ParadigmFieldSyncDiagram: React.FC = () => {
  const ID = 'pg-sync';

  const SURF_Y = 40;
  const SURF_H = 76;
  const SURF_LEFT_X = 10;
  const SURF_RIGHT_X = 170;
  const SURF_W = 140;

  const RULE_X = 30;
  const RULE_W = 260;
  const RULE_Y = 160;
  const RULE_H = 96;

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Two surfaces edit the same rule simultaneously. The popup toggles enabled to true. The workbench rewrites the header value. The sync engine lets both edits land without a stale-draft banner or overwrite — different fields, both surfaces, one entity, two successful saves."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        Two surfaces, same rule, both edits land
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Per-field sync — no banner, no overwrite, no lost work
      </text>

      {/* LEFT surface — popup toggles enabled */}
      <rect
        x={SURF_LEFT_X}
        y={SURF_Y}
        width={SURF_W}
        height={SURF_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
      />
      <rect x={SURF_LEFT_X} y={SURF_Y} width={SURF_W} height={18} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={SURF_LEFT_X + 8} y={SURF_Y + 13} fontSize={10} fontWeight={700} fill={TEXT}>
        Popup
      </text>
      <text
        x={SURF_LEFT_X + SURF_W - 8}
        y={SURF_Y + 13}
        textAnchor="end"
        fontSize={8}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        surface A
      </text>
      <text x={SURF_LEFT_X + 8} y={SURF_Y + 34} fontSize={9} fill={TEXT_DIM}>
        Rule X · toggle
      </text>
      <rect
        x={SURF_LEFT_X + 8}
        y={SURF_Y + 40}
        width={SURF_W - 16}
        height={26}
        rx={3}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
      />
      <text x={SURF_LEFT_X + 16} y={SURF_Y + 54} fontFamily="monospace" fontSize={9} fontWeight={700} fill={OH_GREEN}>
        enabled = true
      </text>
      <text x={SURF_LEFT_X + 16} y={SURF_Y + 64} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        save · t1
      </text>

      {/* RIGHT surface — workbench edits header value */}
      <rect
        x={SURF_RIGHT_X}
        y={SURF_Y}
        width={SURF_W}
        height={SURF_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
      />
      <rect x={SURF_RIGHT_X} y={SURF_Y} width={SURF_W} height={18} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={SURF_RIGHT_X + 8} y={SURF_Y + 13} fontSize={10} fontWeight={700} fill={TEXT}>
        Workbench
      </text>
      <text
        x={SURF_RIGHT_X + SURF_W - 8}
        y={SURF_Y + 13}
        textAnchor="end"
        fontSize={8}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        surface B
      </text>
      <text x={SURF_RIGHT_X + 8} y={SURF_Y + 34} fontSize={9} fill={TEXT_DIM}>
        Rule X · header[0]
      </text>
      <rect
        x={SURF_RIGHT_X + 8}
        y={SURF_Y + 40}
        width={SURF_W - 16}
        height={26}
        rx={3}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
      />
      <text x={SURF_RIGHT_X + 16} y={SURF_Y + 54} fontFamily="monospace" fontSize={9} fontWeight={700} fill={OH_GREEN}>
        value = "x-debug"
      </text>
      <text x={SURF_RIGHT_X + 16} y={SURF_Y + 64} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        save · t2
      </text>

      {/* Arrows down to the local oracle / rule snapshot */}
      <line
        x1={SURF_LEFT_X + SURF_W / 2}
        y1={SURF_Y + SURF_H + 2}
        x2={SURF_LEFT_X + SURF_W / 2}
        y2={RULE_Y - 12}
        stroke={OH_GREEN}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <line
        x1={SURF_RIGHT_X + SURF_W / 2}
        y1={SURF_Y + SURF_H + 2}
        x2={SURF_RIGHT_X + SURF_W / 2}
        y2={RULE_Y - 12}
        stroke={OH_GREEN}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />

      {/* Local oracle band */}
      <rect
        x={RULE_X - 4}
        y={RULE_Y - 12}
        width={RULE_W + 8}
        height={16}
        rx={3}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text
        x={160}
        y={RULE_Y - 1}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={TEXT_DIM}
        letterSpacing={0.4}
      >
        SYNC ENGINE · per-field merge · same rule, both edits land
      </text>

      {/* Merged rule snapshot */}
      <rect
        x={RULE_X}
        y={RULE_Y}
        width={RULE_W}
        height={RULE_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <rect x={RULE_X} y={RULE_Y} width={RULE_W} height={20} rx={6} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={RULE_X + 10} y={RULE_Y + 14} fontSize={10} fontWeight={700} fill={TEXT}>
        Rule X
      </text>
      <text x={RULE_X + RULE_W - 10} y={RULE_Y + 14} textAnchor="end" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        merged snapshot
      </text>

      {/* Field rows — both highlighted green to mean "both edits applied" */}
      <rect
        x={RULE_X + 8}
        y={RULE_Y + 26}
        width={RULE_W - 16}
        height={26}
        rx={3}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
      />
      <text x={RULE_X + 16} y={RULE_Y + 38} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        enabled:
      </text>
      <text x={RULE_X + 70} y={RULE_Y + 38} fontFamily="monospace" fontSize={9} fontWeight={700} fill={OH_GREEN}>
        true
      </text>
      <text x={RULE_X + 16} y={RULE_Y + 48} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        ← from popup
      </text>

      <rect
        x={RULE_X + 8}
        y={RULE_Y + 58}
        width={RULE_W - 16}
        height={30}
        rx={3}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
      />
      <text x={RULE_X + 16} y={RULE_Y + 72} fontFamily="monospace" fontSize={9} fontWeight={700} fill={TEXT}>
        headers[0].value:
      </text>
      <text x={RULE_X + 120} y={RULE_Y + 72} fontFamily="monospace" fontSize={9} fontWeight={700} fill={OH_GREEN}>
        "x-debug"
      </text>
      <text x={RULE_X + 16} y={RULE_Y + 84} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        ← from workbench
      </text>

      {/* Bottom verdict strip */}
      <rect x={14} y={RULE_Y + RULE_H + 12} width={292} height={36} rx={5} fill={OH_GREEN_TINT} stroke={OH_GREEN} />
      <text x={160} y={RULE_Y + RULE_H + 27} textAnchor="middle" fontSize={10} fontWeight={700} fill={OH_GREEN}>
        ✓ both edits applied — no banner, no conflict
      </text>
      <text x={160} y={RULE_Y + RULE_H + 41} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        Same path scales: popup ↔ workbench today → extension + desktop + CLI tomorrow.
      </text>
    </svg>
  );
};

/**
 * Paradigm-shift landing diagram — six us-vs-them rows, uniform
 * primary/sub two-line layout so labels never truncate and each row
 * breathes. Wide viewBox (480) gives each column real width; matching
 * maxWidth caps upscale in wide docs panels so text doesn't render
 * comically large.
 */
export const ParadigmShiftDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';

  type Side = { primary: string; sub?: string };
  /** Small rubber-stamp overlay pinned to the cell's top-right corner
   *  (tier / uniqueness marker — e.g. UNIQUE, ENTERPRISE). */
  type Row = { us: Side; them: Side; usCornerStamp?: string };

  const ROWS: Row[] = [
    {
      us: { primary: 'Everything in', sub: 'one browser extension' },
      them: { primary: 'Nobody else ships', sub: 'this combination' },
      usCornerStamp: 'UNIQUE',
    },
    {
      us: { primary: 'No account', sub: 'no sign-in, no login wall' },
      them: { primary: 'Sign in required', sub: 'to use your own data' },
    },
    {
      us: { primary: 'Local-only', sub: 'no cloud relay' },
      them: { primary: 'Cloud-relayed', sub: 'your traffic goes through them' },
    },
    {
      us: { primary: 'Self-host the back-end', sub: 'browser · desktop app · daemon · VM' },
      them: { primary: 'Their cloud only', sub: 'no choice in where your data lives' },
    },
    {
      us: { primary: 'No telemetry', sub: 'no tracking, no phone-home' },
      them: { primary: 'Tracked by default', sub: 'usage data sent home' },
    },
    {
      us: { primary: 'Rule Engine', sub: 'intercept & modify requests' },
      them: { primary: 'No in-browser engine', sub: 'separate proxy or app required' },
      usCornerStamp: '#1',
    },
    {
      us: { primary: 'API Requests Catalog', sub: 'HTTP, WS, GraphQL — all in-browser' },
      them: { primary: 'Sign in to a platform', sub: 'and install their app' },
    },
    {
      us: { primary: 'Real-time Sync Engine', sub: 'multi-device, browser, surface' },
      them: { primary: 'Last-write-wins', sub: 'or no sync at all' },
    },
    {
      us: { primary: 'Conflict-free Saves', sub: 'concurrent edits, both committed' },
      them: { primary: 'Whole-entity overwrite', sub: 'saves can wipe each other' },
    },
  ];

  // Layout — wide viewBox so labels never need to truncate.
  const W = 480;
  const OUTER_PAD = 10;
  const COL_GAP = 12;
  const COL_W = (W - OUTER_PAD * 2 - COL_GAP) / 2;
  const LEFT_X = OUTER_PAD;
  const RIGHT_X = LEFT_X + COL_W + COL_GAP;
  const CENTER_X = W / 2;

  const TITLE_Y = 22;
  const HEADER_Y = 38;
  const HEADER_H = 30;
  const ROW_Y0 = HEADER_Y + HEADER_H + 12;
  const ROW_H = 50;
  const ROW_GAP = 6;
  const totalRowH = ROWS.length * (ROW_H + ROW_GAP) - ROW_GAP;
  const FOOTER_Y = ROW_Y0 + totalRowH + 24;
  const H = FOOTER_Y + 18;

  /**
   * Corner rubber-stamp — double-border, letter-spaced caps, un-rotated,
   * pinned to the cell's top-right corner. Width auto-sizes to fit
   * longer labels (ENTERPRISE,
   * etc.). Reads as a tier marker without taking the rotated "look at
   * me" energy of the centered UNIQUE stamp.
   */
  const renderCornerStamp = (cellX: number, y: number, label: string) => {
    const charW = 6;
    const padX = 8;
    // Minimum 24 so very short labels ('#1') render as a near-square chip
    // rather than getting padded out to a wide pill.
    const stampW = Math.max(24, label.length * charW + padX * 2);
    const stampH = 20;
    const x = cellX + COL_W - 6 - stampW;
    const yTop = y + 5;
    const cy = yTop + stampH / 2;
    return (
      <g>
        <rect
          x={x}
          y={yTop}
          width={stampW}
          height={stampH}
          rx={3}
          fill="var(--ant-color-bg-container)"
          stroke={STROKE_BLUE}
          strokeWidth={2}
        />
        <rect
          x={x + 3}
          y={yTop + 3}
          width={stampW - 6}
          height={stampH - 6}
          rx={2}
          fill="none"
          stroke={STROKE_BLUE}
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        <text
          x={x + stampW / 2}
          y={cy + 3}
          textAnchor="middle"
          fontSize={9}
          fontWeight={900}
          fill={TEXT}
          letterSpacing={1}
        >
          {label}
        </text>
      </g>
    );
  };

  const renderSide = (side: Side, x: number, y: number, accent: 'good' | 'bad') => {
    const badgeCx = x + 18;
    const badgeCy = y + ROW_H / 2;
    const textX = x + 38;
    const primaryY = y + ROW_H / 2 - 4;
    const subY = y + ROW_H / 2 + 12;
    const fillBg = accent === 'good' ? OH_GREEN_TINT : errBg;
    const strokeColor = accent === 'good' ? OH_GREEN : errBorder;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={COL_W}
          height={ROW_H}
          rx={5}
          fill={fillBg}
          stroke={strokeColor}
          strokeOpacity={0.7}
          strokeDasharray={accent === 'good' ? undefined : '4 3'}
        />
        {accent === 'good' ? (
          <g>
            <circle cx={badgeCx} cy={badgeCy} r={10} fill={OH_GREEN} />
            <path
              d={`M ${badgeCx - 5} ${badgeCy} l 4 4 l 7 -7`}
              stroke="var(--ant-color-bg-container)"
              strokeWidth={2.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ) : (
          <g>
            <circle cx={badgeCx} cy={badgeCy} r={10} fill={errBg} stroke={errBorder} strokeWidth={1.8} />
            <line
              x1={badgeCx - 5}
              y1={badgeCy - 5}
              x2={badgeCx + 5}
              y2={badgeCy + 5}
              stroke={errColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <line
              x1={badgeCx + 5}
              y1={badgeCy - 5}
              x2={badgeCx - 5}
              y2={badgeCy + 5}
              stroke={errColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        )}
        <text
          x={textX}
          y={primaryY}
          fontSize={12}
          fontWeight={700}
          fill={TEXT}
          fontStyle={accent === 'bad' ? 'italic' : undefined}
        >
          {side.primary}
        </text>
        {side.sub && (
          <text x={textX} y={subY} fontSize={10} fill={TEXT_DIM} fontStyle="italic">
            {side.sub}
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
      aria-label="The paradigm shift — six rows of contrasts between Open Headers and every other tool in the space. Everything in one browser extension, no account, local-only, no telemetry, one engine for nine rule types, field-level sync — versus the rest of the market."
    >
      <text x={CENTER_X} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT} letterSpacing={1}>
        THE PARADIGM SHIFT
      </text>

      {/* Open Headers header (left) */}
      <rect
        x={LEFT_X}
        y={HEADER_Y}
        width={COL_W}
        height={HEADER_H}
        rx={6}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <OhLogoSmall x={LEFT_X + 10} y={HEADER_Y + 6} size={18} idSuffix="shift" />
      <text x={LEFT_X + 34} y={HEADER_Y + 19} fontSize={12} fontWeight={700} fill={TEXT}>
        Open Headers
      </text>

      {/* Everyone else header (right) */}
      <rect
        x={RIGHT_X}
        y={HEADER_Y}
        width={COL_W}
        height={HEADER_H}
        rx={6}
        fill={errBg}
        stroke={errBorder}
        strokeWidth={1.5}
        strokeDasharray="3 2"
      />
      <text
        x={RIGHT_X + COL_W / 2}
        y={HEADER_Y + 19}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill={errColor}
      >
        Everyone else
      </text>

      {/* Vertical divider */}
      <line
        x1={CENTER_X}
        y1={ROW_Y0 - 6}
        x2={CENTER_X}
        y2={ROW_Y0 + totalRowH + 6}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="3 5"
      />

      {ROWS.map((row, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        return (
          <g key={`row-${i}`}>
            {renderSide(row.us, LEFT_X, y, 'good')}
            {row.usCornerStamp && renderCornerStamp(LEFT_X, y, row.usCornerStamp)}
            {renderSide(row.them, RIGHT_X, y, 'bad')}
          </g>
        );
      })}

      <text x={CENTER_X} y={FOOTER_Y} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
        Local-first. By design. Not as an afterthought.
      </text>
    </svg>
  );
};

/**
 * Rule Engine deep-dive — unpacks the "Rule Engine · ENTERPRISE" row
 * of the paradigm-shift comparison. Two columns, one per execution
 * engine: DNR (native, Chrome's declarativeNetRequest) and Script
 * (extension-injected fetch/XHR monkey-patch). Each lists the rule
 * categories that compile to that engine. Below: a band naming the
 * shared condition language; under that, the variable scope chain.
 *
 * The argument the diagram makes: this isn't a header-only extension
 * with a single trick — it's a real engine with two execution paths,
 * a full condition language, and per-rule variable resolution.
 */
export const ParadigmRuleEngineDiagram: React.FC = () => {
  type Rule = { name: string; sub: string };

  const DNR_RULES: Rule[] = [
    { name: 'Headers', sub: 'Override · Append · Remove' },
    { name: 'Block', sub: 'cancel at network layer' },
    { name: 'Redirect', sub: 'static URL or regex' },
    { name: 'Query Params', sub: 'add · replace · remove · strip-all' },
  ];

  const SCRIPT_RULES: Rule[] = [
    { name: 'Headers (Merge)', sub: 'value concatenation' },
    { name: 'Inject', sub: 'JS or CSS, two timings' },
    { name: 'Delay', sub: 'navigation + fetch/XHR' },
    { name: 'Request Body', sub: 'static · dynamic · GraphQL filter' },
    { name: 'Response Body', sub: 'body + status + headers' },
  ];

  // Layout
  const W = 480;
  const OUTER_PAD = 10;
  const COL_GAP = 12;
  const COL_W = (W - OUTER_PAD * 2 - COL_GAP) / 2;
  const LEFT_X = OUTER_PAD;
  const RIGHT_X = LEFT_X + COL_W + COL_GAP;

  const TITLE_Y = 16;
  const SUBTITLE_Y = 30;
  const HEADER_BAND_Y = 44;
  const HEADER_BAND_H = 24;
  const RULE_LIST_Y = HEADER_BAND_Y + HEADER_BAND_H + 6;
  const RULE_H = 32;
  const RULE_GAP = 4;
  // Reserve enough vertical space for the taller column.
  const maxRules = Math.max(DNR_RULES.length, SCRIPT_RULES.length);
  const RULES_BLOCK_H = maxRules * (RULE_H + RULE_GAP) - RULE_GAP;
  const BAND_H = 36;
  const CONDITIONS_Y = RULE_LIST_Y + RULES_BLOCK_H + 40;
  const SCOPES_Y = CONDITIONS_Y + BAND_H + 14;
  const FOOTER_Y = SCOPES_Y + BAND_H + 22;
  const H = FOOTER_Y + 22;

  const renderRulePill = (rule: Rule, x: number, y: number, accent: 'dnr' | 'script') => {
    const fill = accent === 'dnr' ? FILL_BLUE : FILL_PURPLE;
    const stroke = accent === 'dnr' ? STROKE_BLUE : STROKE_PURPLE;
    return (
      <g>
        <rect x={x} y={y} width={COL_W} height={RULE_H} rx={4} fill={fill} stroke={stroke} strokeOpacity={0.6} />
        <text x={x + 10} y={y + RULE_H / 2 - 2} fontSize={11} fontWeight={700} fill={TEXT}>
          {rule.name}
        </text>
        <text x={x + 10} y={y + RULE_H / 2 + 11} fontSize={9} fill={TEXT_DIM} fontStyle="italic">
          {rule.sub}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="Open Headers rule engine — two execution paths (DNR-native and script-based intercept), nine rule type categories grouped by engine, plus the shared condition language and variable scope chain that every rule reads from."
    >
      {/* Title with #1 chip — small square */}
      <text x={LEFT_X} y={TITLE_Y} fontSize={13} fontWeight={700} fill={TEXT}>
        Rule Engine
      </text>
      <rect
        x={LEFT_X + 88}
        y={TITLE_Y - 13}
        width={18}
        height={18}
        rx={3}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text x={LEFT_X + 97} y={TITLE_Y + 1} textAnchor="middle" fontSize={11} fontWeight={900} fill={TEXT}>
        #1
      </text>
      <text x={LEFT_X} y={SUBTITLE_Y} fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        MV3 native · two engines · nine rule categories
      </text>

      {/* Engine column headers */}
      <rect
        x={LEFT_X}
        y={HEADER_BAND_Y}
        width={COL_W}
        height={HEADER_BAND_H}
        rx={5}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text
        x={LEFT_X + COL_W / 2}
        y={HEADER_BAND_Y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        DNR · native
      </text>

      <rect
        x={RIGHT_X}
        y={HEADER_BAND_Y}
        width={COL_W}
        height={HEADER_BAND_H}
        rx={5}
        fill={FILL_PURPLE}
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
      />
      <text
        x={RIGHT_X + COL_W / 2}
        y={HEADER_BAND_Y + 16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={TEXT}
      >
        Script · intercept
      </text>

      {/* Rule pills per engine */}
      {DNR_RULES.map((rule, i) => (
        <g key={`dnr-${rule.name}`}>{renderRulePill(rule, LEFT_X, RULE_LIST_Y + i * (RULE_H + RULE_GAP), 'dnr')}</g>
      ))}
      {SCRIPT_RULES.map((rule, i) => (
        <g key={`script-${rule.name}`}>
          {renderRulePill(rule, RIGHT_X, RULE_LIST_Y + i * (RULE_H + RULE_GAP), 'script')}
        </g>
      ))}

      {/* Reach captions — each anchored to its OWN column's last pill.
       *  DNR caption sits close (its column ends sooner); Script caption
       *  gets extra breathing room so it doesn't crowd Response Body. */}
      <text
        x={LEFT_X + COL_W / 2}
        y={RULE_LIST_Y + DNR_RULES.length * (RULE_H + RULE_GAP) - RULE_GAP + 14}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        catches every browser-issued request
      </text>
      <text
        x={RIGHT_X + COL_W / 2}
        y={RULE_LIST_Y + SCRIPT_RULES.length * (RULE_H + RULE_GAP) - RULE_GAP + 22}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        catches JS-initiated fetch / XHR
      </text>

      {/* Shared conditions band */}
      <rect
        x={LEFT_X}
        y={CONDITIONS_Y}
        width={W - OUTER_PAD * 2}
        height={BAND_H}
        rx={5}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text x={LEFT_X + 12} y={CONDITIONS_Y + 14} fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        ONE CONDITION LANGUAGE
      </text>
      <text x={LEFT_X + 12} y={CONDITIONS_Y + 28} fontSize={10} fill={TEXT}>
        Request Domains · URL Pattern · URL Regex · Methods · Resource · Initiator · Headers · Domain Type
      </text>

      {/* Variable scopes band */}
      <rect
        x={LEFT_X}
        y={SCOPES_Y}
        width={W - OUTER_PAD * 2}
        height={BAND_H}
        rx={5}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeOpacity={0.6}
      />
      <text x={LEFT_X + 12} y={SCOPES_Y + 14} fontSize={9} fontWeight={700} fill={OH_GREEN} letterSpacing={0.5}>
        FIVE VARIABLE SCOPES
      </text>
      <text x={LEFT_X + 12} y={SCOPES_Y + 28} fontSize={10} fill={TEXT}>
        <tspan fontFamily="monospace">{'{{vault.X}}'}</tspan> · <tspan fontFamily="monospace">{'{{env.X}}'}</tspan> ·{' '}
        <tspan fontFamily="monospace">{'{{collection.X}}'}</tspan> ·{' '}
        <tspan fontFamily="monospace">{'{{workspace.X}}'}</tspan> · <tspan fontFamily="monospace">{'{{file.X}}'}</tspan>
      </text>

      <text x={W / 2} y={FOOTER_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        One engine. Two execution paths. Full condition + variable language. Inside the extension.
      </text>
    </svg>
  );
};

/**
 * API Requests Catalog deep-dive — unpacks the "API Requests Catalog"
 * row of the paradigm-shift comparison. Stylized request-editor mockup
 * (method + URL + tabs + body) on top, feature-coverage strip below.
 *
 * Argument: every capability you'd expect from a desktop API client
 * — protocol breadth, auth methods, scripts, file uploads, variables,
 * collections — lives inside the browser extension.
 */
export const ParadigmApiCatalogDiagram: React.FC = () => {
  const W = 480;
  const H = 340;
  const OUTER_PAD = 10;

  // Mockup geometry
  const MOCK_X = OUTER_PAD;
  const MOCK_Y = 40;
  const MOCK_W = W - OUTER_PAD * 2;
  const MOCK_H = 168;

  // Bottom feature strip
  const STRIP_Y = MOCK_Y + MOCK_H + 14;
  const STRIP_H = 84;

  const PROTOCOLS = ['HTTP', 'WS', 'GraphQL'];

  const FEATURES: { label: string; sub: string }[] = [
    { label: 'Auth', sub: 'OAuth 2.0 · Basic · Bearer · API Key' },
    { label: 'Scripts', sub: 'pre-request + post-response' },
    { label: 'Variables', sub: '5 scopes · structured diagnostics' },
    { label: 'Files', sub: 'multipart · {{file.X}} resolution' },
    { label: 'Collections', sub: 'folders · environments · per-request' },
    { label: 'Cookies', sub: 'opt-in credentialsMode' },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ maxWidth: 540 }}
      role="img"
      aria-label="API Requests Catalog — a stylized request-editor mockup showing the method picker, URL bar, tab strip, and body preview, plus a feature strip covering protocols, auth, scripts, variables, files, collections, and cookies."
    >
      {/* Title — chips sit on the SAME row, right-aligned. Subtitle
       *  gets its own row below at full width so it can't overflow into
       *  the chip area. */}
      <text x={OUTER_PAD} y={20} fontSize={13} fontWeight={700} fill={TEXT}>
        API Requests Catalog
      </text>
      {PROTOCOLS.map((p, i) => {
        const chipW = 50;
        const chipH = 18;
        const gap = 6;
        const totalW = PROTOCOLS.length * chipW + (PROTOCOLS.length - 1) * gap;
        const x = W - OUTER_PAD - totalW + i * (chipW + gap);
        return (
          <g key={p}>
            <rect x={x} y={9} width={chipW} height={chipH} rx={chipH / 2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={x + chipW / 2} y={22} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
              {p}
            </text>
          </g>
        );
      })}
      <text x={OUTER_PAD} y={36} fontSize={10} fontStyle="italic" fill={TEXT_DIM}>
        Full request building, sending, and collection management — inside the extension.
      </text>

      {/* Request-editor mockup */}
      <rect
        x={MOCK_X}
        y={MOCK_Y}
        width={MOCK_W}
        height={MOCK_H}
        rx={6}
        fill="var(--ant-color-bg-container)"
        stroke="var(--ant-color-border)"
      />

      {/* Method + URL bar */}
      <rect
        x={MOCK_X + 8}
        y={MOCK_Y + 8}
        width={56}
        height={22}
        rx={3}
        fill={FILL_BLUE}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
      />
      <text
        x={MOCK_X + 36}
        y={MOCK_Y + 22}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fontFamily="monospace"
        fill={TEXT}
      >
        POST
      </text>
      <rect
        x={MOCK_X + 70}
        y={MOCK_Y + 8}
        width={MOCK_W - 158}
        height={22}
        rx={3}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text x={MOCK_X + 78} y={MOCK_Y + 22} fontSize={10} fontFamily="monospace" fill={TEXT}>
        https://api.openheaders.io/v2/items
      </text>
      <rect x={MOCK_X + MOCK_W - 80} y={MOCK_Y + 8} width={72} height={22} rx={3} fill={OH_GREEN} stroke={OH_GREEN} />
      <text
        x={MOCK_X + MOCK_W - 44}
        y={MOCK_Y + 22}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="var(--ant-color-bg-container)"
      >
        Send ▸
      </text>

      {/* Tab strip */}
      {(['Params', 'Auth', 'Headers', 'Body', 'Scripts', 'Settings'] as const).map((tab, i) => {
        const tabW = (MOCK_W - 16) / 6;
        const x = MOCK_X + 8 + i * tabW;
        const isActive = tab === 'Body';
        return (
          <g key={tab}>
            <line x1={x} y1={MOCK_Y + 48} x2={x + tabW} y2={MOCK_Y + 48} stroke="var(--ant-color-border)" />
            {isActive && (
              <line
                x1={x + 8}
                y1={MOCK_Y + 48}
                x2={x + tabW - 8}
                y2={MOCK_Y + 48}
                stroke={STROKE_BLUE}
                strokeWidth={2.5}
              />
            )}
            <text
              x={x + tabW / 2}
              y={MOCK_Y + 44}
              textAnchor="middle"
              fontSize={10}
              fontWeight={isActive ? 700 : 500}
              fill={isActive ? TEXT : TEXT_DIM}
            >
              {tab}
            </text>
          </g>
        );
      })}

      {/* Body preview (JSON-ish) */}
      <rect
        x={MOCK_X + 8}
        y={MOCK_Y + 56}
        width={MOCK_W - 16}
        height={MOCK_H - 64}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border-secondary)"
      />
      {[
        { line: '{', indent: 0 },
        { line: '"name": "{{env.PRODUCT_NAME}}",', indent: 2 },
        { line: '"region": "{{workspace.REGION}}",', indent: 2 },
        { line: '"token": "{{vault.API_TOKEN}}",', indent: 2 },
        { line: '"attachments": ["{{file.invoice}}"],', indent: 2 },
        { line: '"createdAt": 1715000000', indent: 2 },
        { line: '}', indent: 0 },
      ].map((row, i) => (
        <text
          key={i}
          x={MOCK_X + 16 + row.indent * 6}
          y={MOCK_Y + 74 + i * 14}
          fontFamily="monospace"
          fontSize={10}
          fill={TEXT}
        >
          {row.line}
        </text>
      ))}

      {/* Feature strip frame */}
      <rect
        x={OUTER_PAD}
        y={STRIP_Y}
        width={MOCK_W}
        height={STRIP_H}
        rx={6}
        fill={OH_GREEN_TINT}
        stroke={OH_GREEN}
        strokeOpacity={0.5}
      />
      <text x={OUTER_PAD + 10} y={STRIP_Y + 14} fontSize={9} fontWeight={700} fill={OH_GREEN} letterSpacing={0.5}>
        EVERYTHING A DESKTOP API CLIENT SHIPS — IN-EXTENSION
      </text>

      {/* Feature pills — 3 cols × 2 rows */}
      {FEATURES.map((f, i) => {
        const cols = 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellW = (MOCK_W - 20) / cols;
        const cellH = 26;
        const x = OUTER_PAD + 10 + col * cellW;
        const y = STRIP_Y + 22 + row * (cellH + 4);
        return (
          <g key={f.label}>
            <rect
              x={x}
              y={y}
              width={cellW - 6}
              height={cellH}
              rx={4}
              fill="var(--ant-color-bg-container)"
              stroke={OH_GREEN}
              strokeOpacity={0.4}
            />
            <text x={x + 8} y={y + 11} fontSize={10} fontWeight={700} fill={TEXT}>
              {f.label}
            </text>
            <text x={x + 8} y={y + 22} fontSize={8} fill={TEXT_DIM} fontStyle="italic">
              {f.sub}
            </text>
          </g>
        );
      })}

      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        A full API platform — without the platform.
      </text>
    </svg>
  );
};
