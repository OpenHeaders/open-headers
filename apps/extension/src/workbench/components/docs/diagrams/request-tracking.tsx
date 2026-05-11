/**
 * Request Tracking — sequence diagram.
 *
 * Three participants (Browser, Extension, Popup), time flows top to
 * bottom. Activation bars on the Extension lifeline mark when the
 * service worker is matching/recording. The "later" gap separator
 * shows the popup-read happens after tracking already wrote the data
 * — there's no live pipeline from request → popup, just a written
 * record the popup reads back when opened.
 */

import type React from 'react';
import {
  SEQ_DIM,
  SEQ_TEXT,
  SeqActivation,
  SeqArrowDefs,
  SeqLaterGap,
  SeqLifeline,
  SeqMessage,
  SeqParticipant,
} from './_sequence';
import { FILL_BLUE, FILL_GREEN, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from './_shared';

/**
 * Phases overview — the section's hero diagram. Two colored lanes
 * between a Page card on the left and a Network card on the right.
 * Top lane: REQUEST going out, with the data the tracker captures.
 * Bottom lane: RESPONSE coming back, with its captured fields.
 * Below the lanes, a compact badge visual ties both phases to the
 * single `+1` that lands in the popup's "This Page" tab. Locked
 * color contract preserved (blue palette for request, green for
 * captured/tracked outcome).
 */
export const RequestTrackingPhasesDiagram: React.FC = () => {
  const ID = 'rt-ph';

  // Endpoints
  const PAGE_X = 10;
  const PAGE_W = 70;
  const PAGE_Y = 38;
  const PAGE_H = 110;
  const NET_X = 240;
  const NET_W = 70;
  const NET_H = PAGE_H;
  const NET_Y = PAGE_Y;

  // Lane geometry — the two horizontal phase tracks between page and network
  const LANE_X1 = PAGE_X + PAGE_W;
  const LANE_X2 = NET_X;
  const LANE_W = LANE_X2 - LANE_X1;
  const LANE_REQ_Y = 50;
  const LANE_RES_Y = 110;
  const LANE_H = 36;

  // Colors for arrow markers — green for response keeps the locked
  // "captured by tracking" semantic; blue for the outbound request.
  const blueAccent = STROKE_BLUE;
  const greenAccent = STROKE_GREEN;

  return (
    <svg
      viewBox="0 0 320 230"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Tracking captures both the outgoing request and the incoming response — both phases combine into one match in the popup's This Page tab."
    >
      <defs>
        <marker id={`${ID}-blue`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={blueAccent} />
        </marker>
        <marker id={`${ID}-green`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={greenAccent} />
        </marker>
      </defs>

      {/* ── Page card (left) ── */}
      <rect x={PAGE_X} y={PAGE_Y} width={PAGE_W} height={PAGE_H} rx={6} fill="var(--ant-color-bg-container)" stroke="var(--ant-color-border)" />
      {/* mini browser-tab strip on top */}
      <rect x={PAGE_X} y={PAGE_Y} width={PAGE_W} height={14} rx={6} fill="var(--ant-color-fill-secondary)" stroke="var(--ant-color-border)" />
      <circle cx={PAGE_X + 6} cy={PAGE_Y + 7} r={1.8} fill="var(--ant-color-text-quaternary)" />
      <circle cx={PAGE_X + 11} cy={PAGE_Y + 7} r={1.8} fill="var(--ant-color-text-quaternary)" />
      <circle cx={PAGE_X + 16} cy={PAGE_Y + 7} r={1.8} fill="var(--ant-color-text-quaternary)" />
      {/* page content — fake address pill + a few rows */}
      <rect x={PAGE_X + 6} y={PAGE_Y + 22} width={PAGE_W - 12} height={9} rx={2} fill="var(--ant-color-fill-tertiary)" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={PAGE_X + 6}
          y={PAGE_Y + 38 + i * 12}
          width={PAGE_W - 12 - (i === 3 ? 14 : 0)}
          height={5}
          rx={2}
          fill="var(--ant-color-fill-tertiary)"
        />
      ))}
      <text x={PAGE_X + PAGE_W / 2} y={PAGE_Y + PAGE_H - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Page
      </text>

      {/* ── Network card (right) ── */}
      <rect x={NET_X} y={NET_Y} width={NET_W} height={NET_H} rx={6} fill="var(--ant-color-bg-container)" stroke="var(--ant-color-border)" />
      {/* Server stack icon — three stacked units with status LED + label slot */}
      <g transform={`translate(${NET_X + 18}, ${NET_Y + 22})`}>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={0} y={i * 13} width={34} height={9} rx={2} fill={FILL_BLUE} stroke={blueAccent} />
            <circle cx={4} cy={i * 13 + 4.5} r={1.4} fill={greenAccent} />
            <rect x={9} y={i * 13 + 3} width={22} height={3} rx={1.5} fill="var(--ant-color-fill-tertiary)" />
          </g>
        ))}
      </g>
      <text x={NET_X + NET_W / 2} y={NET_Y + 84} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        api.openheaders.io
      </text>
      <text x={NET_X + NET_W / 2} y={NET_Y + PAGE_H - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Network
      </text>

      {/* ── REQUEST lane (top) ── */}
      <rect x={LANE_X1} y={LANE_REQ_Y} width={LANE_W} height={LANE_H} rx={6} fill={FILL_BLUE} stroke={blueAccent} />
      <text x={LANE_X1 + 8} y={LANE_REQ_Y + 13} fontSize={9} fontWeight={700} fill={blueAccent} letterSpacing={0.5}>
        REQUEST
      </text>
      <text x={LANE_X1 + 8} y={LANE_REQ_Y + 25} fontSize={8} fill={TEXT}>
        URL · method · headers
      </text>
      <text x={LANE_X1 + 8} y={LANE_REQ_Y + 34} fontSize={8} fill={TEXT}>
        body · resource type
      </text>
      {/* Arrow head on the network side of the request lane */}
      <line
        x1={LANE_X1 + LANE_W - 18}
        y1={LANE_REQ_Y + LANE_H / 2}
        x2={LANE_X2 - 2}
        y2={LANE_REQ_Y + LANE_H / 2}
        stroke={blueAccent}
        strokeWidth={2}
        markerEnd={`url(#${ID}-blue)`}
      />

      {/* ── RESPONSE lane (bottom) ── */}
      <rect x={LANE_X1} y={LANE_RES_Y} width={LANE_W} height={LANE_H} rx={6} fill={FILL_GREEN} stroke={greenAccent} />
      <text x={LANE_X1 + LANE_W - 8} y={LANE_RES_Y + 13} textAnchor="end" fontSize={9} fontWeight={700} fill={greenAccent} letterSpacing={0.5}>
        RESPONSE
      </text>
      <text x={LANE_X1 + LANE_W - 8} y={LANE_RES_Y + 25} textAnchor="end" fontSize={8} fill={TEXT}>
        status code · headers
      </text>
      <text x={LANE_X1 + LANE_W - 8} y={LANE_RES_Y + 34} textAnchor="end" fontSize={8} fill={TEXT}>
        body · timings
      </text>
      {/* Arrow head on the page side of the response lane */}
      <line
        x1={LANE_X2 - 2}
        y1={LANE_RES_Y + LANE_H / 2}
        x2={LANE_X1 + 18}
        y2={LANE_RES_Y + LANE_H / 2}
        stroke={greenAccent}
        strokeWidth={2}
        markerEnd={`url(#${ID}-green)`}
      />

      {/* ── Outcome strip below — "both phases → 1 popup match" ── */}
      <g transform="translate(0, 158)">
        <rect x={20} y={6} width={280} height={42} rx={6} fill="var(--ant-color-fill-secondary)" stroke="var(--ant-color-border)" />
        <text x={36} y={22} fontSize={9} fontWeight={700} fill={TEXT}>
          This Page · popup
        </text>
        {/* Mock rule row with badge */}
        <rect x={36} y={26} width={158} height={16} rx={3} fill="var(--ant-color-bg-container)" stroke="var(--ant-color-border)" />
        <text x={42} y={37} fontSize={9} fontWeight={600} fill={TEXT}>
          Auth header
        </text>
        <rect x={172} y={29} width={18} height={10} rx={5} fill="var(--ant-color-primary)" />
        <text x={181} y={37} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
          +1
        </text>
        {/* Right-side caption */}
        <text x={208} y={22} fontSize={8} fill={TEXT_DIM}>
          Both phases →
        </text>
        <text x={208} y={34} fontSize={9} fontWeight={600} fill={TEXT}>
          one tracked match
        </text>
      </g>

      <text x={160} y={222} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Every connection contributes data from both directions to the count.
      </text>
    </svg>
  );
};

export const RequestTrackingDiagram: React.FC = () => {
  const ID = 'rt-msg';
  // Three participants centered at x = 60, 160, 260
  return (
    <svg
      viewBox="0 0 320 290"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Sequence diagram: request observed, matched, recorded, then read by the popup"
    >
      <SeqArrowDefs id={ID} />
      <SeqParticipant x={60} label="Browser" sub="network stack" />
      <SeqParticipant x={160} label="Extension" sub="service worker" />
      <SeqParticipant x={260} label="Popup" sub="This Page tab" />
      <SeqLifeline x={60} y1={38} y2={282} />
      <SeqLifeline x={160} y1={38} y2={282} />
      <SeqLifeline x={260} y1={38} y2={282} />

      {/* Phase 1 — request observed + matched + recorded */}
      <SeqMessage fromX={60} toX={160} y={64} label="webRequest (request)" marker={ID} />
      <SeqActivation x={160} y={64} height={52} />
      <text x={172} y={78} fontSize={9} fill={SEQ_TEXT}>
        match against rules
      </text>
      <text x={172} y={91} fontSize={9} fill={SEQ_TEXT}>
        record (rule + URL +
      </text>
      <text x={172} y={102} fontSize={9} fill={SEQ_TEXT}>
        resource type)
      </text>

      {/* Phase 2 — response phase recorded too */}
      <SeqMessage fromX={60} toX={160} y={140} label="webRequest (response)" marker={ID} />
      <SeqActivation x={160} y={140} height={28} />
      <text x={172} y={154} fontSize={9} fill={SEQ_TEXT}>
        record response phase
      </text>

      {/* Time gap */}
      <SeqLaterGap y={195} />

      {/* Phase 3 — popup reads recorded data on open */}
      <SeqMessage fromX={260} toX={160} y={222} label="user opens popup" marker={ID} />
      <SeqActivation x={160} y={222} height={20} />
      <SeqMessage fromX={160} toX={260} y={252} label="matched rules + badges" dashed marker={ID} />

      <text x={160} y={278} textAnchor="middle" fontSize={9} fontStyle="italic" fill={SEQ_DIM}>
        Recording happens live; the popup just reads it back.
      </text>
    </svg>
  );
};

/**
 * Request Tracking — UI anatomy ("How it works").
 *
 * Two states of the same rule row in the popup: collapsed (just a
 * count badge) and expanded after click (full list of matched
 * requests with timestamp, URL, resource type, and the pattern that
 * matched). The user is reading "How it works" and the question is
 * "what does this look like?" — a UI mockup answers that, where the
 * sequence diagram answers "how does the data get there."
 */
export const RequestTrackingUiDiagram: React.FC = () => {
  const cardStroke = 'var(--ant-color-border)';
  const cardBg = 'var(--ant-color-bg-container)';
  const rowDivider = 'var(--ant-color-border-secondary)';
  const accent = 'var(--ant-color-primary)';
  const Badge = ({ x, y, n }: { x: number; y: number; n: string }) => (
    <g>
      <rect x={x} y={y} width={20} height={14} rx={7} fill={accent} />
      <text x={x + 10} y={y + 10} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
        {n}
      </text>
    </g>
  );
  const ResourceTag = ({ x, y, label }: { x: number; y: number; label: string }) => (
    <g>
      <rect
        x={x}
        y={y}
        width={32}
        height={11}
        rx={2}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border-secondary)"
      />
      <text x={x + 16} y={y + 8} textAnchor="middle" fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        {label}
      </text>
    </g>
  );
  return (
    <svg
      viewBox="0 0 320 250"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="UI anatomy — collapsed badge expands into a list of matched requests"
    >
      {/* Collapsed state */}
      <text x={160} y={12} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Rule row in the popup
      </text>
      <rect x={20} y={20} width={280} height={28} rx={4} fill={cardBg} stroke={cardStroke} />
      <text x={32} y={38} fontSize={11} fontWeight={600} fill={TEXT}>
        Block ads.openheaders.io
      </text>
      <Badge x={258} y={27} n="3" />
      <text x={282} y={37} fontSize={11} fill={TEXT_DIM}>
        ▾
      </text>

      {/* Click → expand affordance */}
      <line x1={160} y1={52} x2={160} y2={68} stroke={accent} strokeWidth={1.5} strokeDasharray="3 2" />
      <text x={166} y={64} fontSize={9} fill={accent}>
        click badge
      </text>

      {/* Expanded state */}
      <rect x={20} y={72} width={280} height={166} rx={4} fill={cardBg} stroke={cardStroke} />
      {/* Header */}
      <text x={32} y={90} fontSize={11} fontWeight={600} fill={TEXT}>
        Block ads.openheaders.io
      </text>
      <Badge x={258} y={79} n="3" />
      <text x={282} y={89} fontSize={11} fill={TEXT_DIM}>
        ▴
      </text>
      <line x1={20} y1={100} x2={300} y2={100} stroke={rowDivider} />

      {/* Matched-request rows */}
      {/* Row 1 */}
      <text x={32} y={114} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        14:32:08
      </text>
      <text x={88} y={114} fontFamily="monospace" fontSize={9} fill={TEXT}>
        ads.openheaders.io/track
      </text>
      <ResourceTag x={246} y={106} label="xhr" />
      <text x={88} y={125} fontSize={9} fill={TEXT_DIM}>
        matched: ads.openheaders.io
      </text>
      <line x1={28} y1={132} x2={292} y2={132} stroke={rowDivider} strokeDasharray="2 3" />

      {/* Row 2 */}
      <text x={32} y={146} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        14:32:11
      </text>
      <text x={88} y={146} fontFamily="monospace" fontSize={9} fill={TEXT}>
        ads.openheaders.io/pixel
      </text>
      <ResourceTag x={246} y={138} label="image" />
      <text x={88} y={157} fontSize={9} fill={TEXT_DIM}>
        matched: ads.openheaders.io
      </text>
      <line x1={28} y1={164} x2={292} y2={164} stroke={rowDivider} strokeDasharray="2 3" />

      {/* Row 3 */}
      <text x={32} y={178} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        14:32:35
      </text>
      <text x={88} y={178} fontFamily="monospace" fontSize={9} fill={TEXT}>
        ads.openheaders.io/beacon
      </text>
      <ResourceTag x={246} y={170} label="ping" />
      <text x={88} y={189} fontSize={9} fill={TEXT_DIM}>
        matched: ads.openheaders.io
      </text>

      {/* Annotation legend at bottom */}
      <rect x={28} y={206} width={264} height={26} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={217} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        timestamp · URL · resource type · matched pattern
      </text>
      <text x={160} y={228} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        badge count = number of rows
      </text>
    </svg>
  );
};
