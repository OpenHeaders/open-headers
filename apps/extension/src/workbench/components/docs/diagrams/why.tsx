/**
 * Why OpenHeaders — landing-page diagrams.
 *
 *   • WhyHeroDiagram          — request-flow hero. Concrete example
 *                                of a request being transformed by
 *                                the extension before it leaves the
 *                                browser. First thing a new user
 *                                sees on docs panel open.
 *   • WhyCapabilitiesDiagram  — 9-tile capabilities grid grouped by
 *                                category (Modify requests, Modify
 *                                responses, Run code, Observe).
 *   • WhyScenariosDiagram     — 3 concrete real-world scenarios
 *                                with the rule that solves each.
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_ORANGE,
  FILL_PURPLE,
  STROKE,
  STROKE_BLUE,
  STROKE_ORANGE,
  STROKE_PURPLE,
  TEXT,
  TEXT_DIM,
} from './_shared';

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
const OhLogoSmall: React.FC<{ x: number; y: number; size: number; idSuffix: string }> = ({
  x,
  y,
  size,
  idSuffix,
}) => {
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
        <path d="M 80 388 C 180 448, 332 448, 432 388" stroke="white" strokeWidth={28} fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
};

/**
 * Hero diagram. Tells the value proposition in one glance:
 * a page makes a request → the extension transforms it locally →
 * the transformed request flows to the network. The transform card
 * shows real diff highlights so the user immediately understands
 * what "shaping traffic" means in concrete terms.
 */
export const WhyHeroDiagram: React.FC = () => {
  const ID = 'why-hero';

  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Hero diagram — a page makes a fetch; OpenHeaders intercepts and rewrites the headers locally; the modified request reaches the network."
    >
      <ArrowDefs id={ID} />

      {/* Page card (left) */}
      <rect x={10} y={70} width={88} height={120} rx={6} fill="var(--ant-color-bg-container)" stroke="var(--ant-color-border)" />
      <rect x={10} y={70} width={88} height={14} rx={6} fill="var(--ant-color-fill-secondary)" stroke="var(--ant-color-border)" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={18 + i * 6} cy={77} r={1.8} fill="var(--ant-color-text-quaternary)" />
      ))}
      <text x={54} y={104} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Page
      </text>
      <text x={54} y={118} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        fetch()
      </text>
      <rect x={18} y={130} width={72} height={14} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={54} y={140} textAnchor="middle" fontFamily="monospace" fontSize={8} fontWeight={700} fill={TEXT}>
        /api/users
      </text>
      <text x={54} y={158} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        sends raw req
      </text>
      <rect x={18} y={166} width={72} height={4} rx={2} fill="var(--ant-color-fill-tertiary)" />
      <rect x={18} y={174} width={48} height={4} rx={2} fill="var(--ant-color-fill-tertiary)" />
      <rect x={18} y={182} width={60} height={4} rx={2} fill="var(--ant-color-fill-tertiary)" />

      {/* Arrow into OH */}
      <line x1={98} y1={130} x2={114} y2={130} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* OpenHeaders transform card (center) — uses the brand blue,
       *  not green, so the OH card carries its own identity. */}
      <rect
        x={116}
        y={50}
        width={106}
        height={170}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke={STROKE_BLUE}
        strokeWidth={1.8}
      />
      <rect x={116} y={50} width={106} height={28} rx={8} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <OhLogoSmall x={124} y={56} size={16} idSuffix="hero" />
      <text x={144} y={68} fontSize={10} fontWeight={700} fill={TEXT}>
        Open Headers
      </text>

      <text x={169} y={90} textAnchor="middle" fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        TRANSFORM
      </text>

      {/* Diff lines — what's being changed */}
      <rect x={122} y={96} width={94} height={20} rx={2} fill="var(--ant-color-error-bg)" stroke="var(--ant-color-error-border)" strokeDasharray="2 2" />
      <text x={126} y={108} fontFamily="monospace" fontSize={7} fill="var(--ant-color-error)" textDecoration="line-through">
        Auth: prod-token
      </text>
      <rect x={122} y={120} width={94} height={20} rx={2} fill={OH_GREEN_TINT} stroke={OH_GREEN} />
      <text x={126} y={132} fontFamily="monospace" fontSize={7} fontWeight={700} fill={OH_GREEN}>
        Auth: dev-token
      </text>

      <rect x={122} y={146} width={94} height={20} rx={2} fill={OH_GREEN_TINT} stroke={OH_GREEN} />
      <text x={126} y={158} fontFamily="monospace" fontSize={7} fontWeight={700} fill={OH_GREEN}>
        +X-Debug: true
      </text>

      <rect x={122} y={172} width={94} height={20} rx={2} fill="var(--ant-color-error-bg)" stroke="var(--ant-color-error-border)" strokeDasharray="2 2" />
      <text x={126} y={184} fontFamily="monospace" fontSize={7} fill="var(--ant-color-error)" textDecoration="line-through">
        Cookie: tracker=…
      </text>

      <text x={169} y={206} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        local only · no server change
      </text>

      {/* Arrow out to Network */}
      <line x1={222} y1={130} x2={238} y2={130} stroke={OH_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Network card (right) */}
      <rect x={240} y={70} width={70} height={120} rx={6} fill="var(--ant-color-bg-container)" stroke="var(--ant-color-border)" />
      <text x={275} y={92} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Network
      </text>
      {/* Mini server-stack icon */}
      <g transform="translate(252, 100)">
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={0} y={i * 13} width={46} height={9} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <circle cx={5} cy={i * 13 + 4.5} r={1.5} fill={OH_GREEN} />
            <rect x={11} y={i * 13 + 3} width={28} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
          </g>
        ))}
      </g>
      <text x={275} y={158} textAnchor="middle" fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
        api.openheaders.io
      </text>
      <text x={275} y={176} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        sees the new
      </text>
      <text x={275} y={186} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        request
      </text>

      {/* Title + tagline */}
      <text x={160} y={26} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT}>
        Shape network traffic from your browser
      </text>
      <text x={160} y={44} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Add, replace, remove, redirect, mock — without touching server or app code.
      </text>

      {/* Bottom tagline */}
      <text x={160} y={244} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Page sends one request — Network sees a different one.
      </text>
      <text x={160} y={258} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        All transformations stay on your machine.
      </text>
    </svg>
  );
};

/**
 * Capabilities grid — what OpenHeaders can do, organized into four
 * groups in a 3-row layout. Each tile carries a typographic glyph
 * (no emoji — keeps the design system consistent) and the action's
 * accent color so the user can see which actions belong together.
 */
export const WhyCapabilitiesDiagram: React.FC = () => {
  type Tile = {
    title: string;
    glyph: React.ReactNode;
    accent: string;
    accentBg: string;
  };

  const ENGINE_BLUE = { accent: STROKE_BLUE, accentBg: FILL_BLUE };
  const ENGINE_PURPLE = { accent: STROKE_PURPLE, accentBg: FILL_PURPLE };

  type Group = { label: string; tiles: Tile[] };

  const GROUPS: Group[] = [
    {
      label: 'MODIFY REQUESTS',
      tiles: [
        {
          title: 'Headers',
          ...ENGINE_BLUE,
          glyph: (
            <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={STROKE_BLUE}>
              H:
            </text>
          ),
        },
        {
          title: 'Block',
          ...ENGINE_BLUE,
          glyph: (
            <g>
              <circle cx={0} cy={0} r={5.5} fill="none" stroke={STROKE_BLUE} strokeWidth={1.5} />
              <line x1={-4} y1={-4} x2={4} y2={4} stroke={STROKE_BLUE} strokeWidth={1.5} />
            </g>
          ),
        },
        {
          title: 'Redirect',
          ...ENGINE_BLUE,
          glyph: (
            <g>
              <path d="M -5 -2 L 3 -2 L 3 -5 L 7 0 L 3 5 L 3 2 L -5 2 Z" fill={STROKE_BLUE} />
            </g>
          ),
        },
        {
          title: 'Query',
          ...ENGINE_BLUE,
          glyph: (
            <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={11} fontWeight={700} fill={STROKE_BLUE}>
              ?
            </text>
          ),
        },
        {
          title: 'Body',
          ...ENGINE_PURPLE,
          glyph: (
            <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={STROKE_PURPLE}>
              {'{}'}
            </text>
          ),
        },
      ],
    },
    {
      label: 'MODIFY RESPONSES',
      tiles: [
        {
          title: 'Response',
          ...ENGINE_PURPLE,
          glyph: (
            <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={9} fontWeight={700} fill={STROKE_PURPLE}>
              200
            </text>
          ),
        },
      ],
    },
    {
      label: 'RUN CODE',
      tiles: [
        {
          title: 'Inject',
          ...ENGINE_PURPLE,
          glyph: (
            <text x={0} y={3} textAnchor="middle" fontFamily="monospace" fontSize={10} fontWeight={700} fill={STROKE_PURPLE}>
              {'</>'}
            </text>
          ),
        },
        {
          title: 'Delay',
          ...ENGINE_PURPLE,
          glyph: (
            <g>
              <circle cx={0} cy={0} r={5.5} fill="none" stroke={STROKE_PURPLE} strokeWidth={1.5} />
              <line x1={0} y1={0} x2={0} y2={-3.5} stroke={STROKE_PURPLE} strokeWidth={1.5} strokeLinecap="round" />
              <line x1={0} y1={0} x2={3} y2={0} stroke={STROKE_PURPLE} strokeWidth={1.5} strokeLinecap="round" />
            </g>
          ),
        },
      ],
    },
    {
      label: 'OBSERVE',
      tiles: [
        {
          title: 'Track',
          accent: OH_GREEN,
          accentBg: OH_GREEN_TINT,
          glyph: (
            <g>
              <circle cx={0} cy={0} r={3} fill={OH_GREEN} />
              <circle cx={0} cy={0} r={6} fill="none" stroke={OH_GREEN} strokeWidth={1.2} opacity={0.6} />
            </g>
          ),
        },
      ],
    },
  ];

  // Layout: each group has a header and its tiles wrap in a row.
  const TILE_W = 54;
  const TILE_H = 50;
  const TILE_GAP = 6;
  const GROUP_GAP = 10;
  const SECTION_X = 14;

  let cursorY = 30;

  return (
    <svg
      viewBox="0 0 320 350"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="OpenHeaders capabilities — Headers, Block, Redirect, Query, Body for requests; Response for responses; Inject and Delay for code; Track for observation."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHAT YOU CAN DO
      </text>

      {GROUPS.map((group) => {
        const groupY = cursorY;
        const tileY = groupY + 14;
        const result = (
          <g key={group.label}>
            <text x={SECTION_X} y={groupY + 6} fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.6}>
              {group.label}
            </text>
            {group.tiles.map((tile, i) => {
              const x = SECTION_X + i * (TILE_W + TILE_GAP);
              return (
                <g key={tile.title}>
                  <rect
                    x={x}
                    y={tileY}
                    width={TILE_W}
                    height={TILE_H}
                    rx={6}
                    fill={tile.accentBg}
                    stroke={tile.accent}
                  />
                  <g transform={`translate(${x + TILE_W / 2}, ${tileY + 22})`}>{tile.glyph}</g>
                  <text x={x + TILE_W / 2} y={tileY + TILE_H - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
                    {tile.title}
                  </text>
                </g>
              );
            })}
          </g>
        );
        cursorY = tileY + TILE_H + GROUP_GAP;
        return result;
      })}

      <text x={160} y={cursorY + 12} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Blue = Chrome's DNR engine · purple = script-based.
      </text>
    </svg>
  );
};

/**
 * Real-world scenarios. Three tall cards, each pairing a concrete
 * problem statement with the rule that solves it and the visible
 * outcome. Better than abstract benefit copy — users recognize
 * their own situation.
 */
export const WhyScenariosDiagram: React.FC = () => {
  type Scenario = {
    title: string;
    problem: string;
    rule: string;
    accent: string;
    accentBg: string;
  };

  const SCENARIOS: Scenario[] = [
    {
      title: 'Auth your staging API',
      problem: 'Add a dev auth header — just for you.',
      rule: 'Override Auth: dev-token',
      accent: STROKE_BLUE,
      accentBg: FILL_BLUE,
    },
    {
      title: 'Test the error path',
      problem: 'See how the UI handles a 500.',
      rule: 'Mock 500 · POST /api/save',
      accent: STROKE_PURPLE,
      accentBg: FILL_PURPLE,
    },
    {
      title: 'Clean screen recordings',
      problem: 'Hide trackers while you record.',
      rule: 'Block ads.example.com',
      accent: STROKE_ORANGE,
      accentBg: FILL_ORANGE,
    },
  ];

  const CARD_W = 292;
  const CARD_H = 78;
  const CARD_GAP = 10;
  const CARD_X = 14;
  const CARD_Y_START = 32;

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Three real scenarios: auth a staging API, test a 500 error response, clean up screen recordings by blocking trackers."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        REAL SCENARIOS
      </text>

      {SCENARIOS.map((s, i) => {
        const y = CARD_Y_START + i * (CARD_H + CARD_GAP);
        return (
          <g key={s.title}>
            {/* Numbered scenario card */}
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
            <rect x={CARD_X} y={y + 1} width={4} height={CARD_H - 2} rx={2} fill={s.accent} />
            {/* Number badge */}
            <circle cx={CARD_X + 22} cy={y + 22} r={11} fill={s.accentBg} stroke={s.accent} strokeWidth={1.5} />
            <text x={CARD_X + 22} y={y + 26} textAnchor="middle" fontSize={11} fontWeight={700} fill={s.accent}>
              {i + 1}
            </text>
            {/* Title */}
            <text x={CARD_X + 40} y={y + 22} fontSize={11} fontWeight={700} fill={TEXT}>
              {s.title}
            </text>
            {/* Problem */}
            <text x={CARD_X + 40} y={y + 38} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
              {s.problem}
            </text>
            {/* Rule preview */}
            <rect
              x={CARD_X + 40}
              y={y + 46}
              width={CARD_W - 56}
              height={22}
              rx={3}
              fill={s.accentBg}
              stroke={s.accent}
            />
            <text x={CARD_X + 50} y={y + 60} fontFamily="monospace" fontSize={10} fontWeight={700} fill={s.accent}>
              {s.rule}
            </text>
          </g>
        );
      })}

      <text x={160} y={302} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Every rule is a single saved entry — no command line, no proxy setup.
      </text>
    </svg>
  );
};
