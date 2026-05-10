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
 * Request Tracking — phases overview.
 *
 * Pairs with the section's intro paragraph. Beginners think of "a
 * request" as a single event; the docs claim tracking spans both
 * REQUEST and RESPONSE phases. This diagram makes that explicit as a
 * compact 2-participant sequence: Page sends a request to Server,
 * Server sends a response back to the same Page. A small "tracked"
 * tag below each arrow names exactly what gets recorded in that
 * direction.
 */
export const RequestTrackingPhasesDiagram: React.FC = () => {
  const ID = 'rt-ph';
  // Participants centered at x = 80 (Page) and x = 240 (Server)
  const PAGE_X = 80;
  const SERVER_X = 240;
  return (
    <svg
      viewBox="0 0 320 215"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Request tracking covers both the outgoing request phase and the incoming response phase"
    >
      <SeqArrowDefs id={ID} />
      <SeqParticipant x={PAGE_X} label="Page" sub="your browser tab" />
      <SeqParticipant x={SERVER_X} label="Network" sub="the remote URL" />
      <SeqLifeline x={PAGE_X} y1={38} y2={208} />
      <SeqLifeline x={SERVER_X} y1={38} y2={208} />

      {/* Phase 1 — outgoing request */}
      <SeqMessage fromX={PAGE_X} toX={SERVER_X} y={70} label="Phase 1 — request" marker={ID} />
      <TrackedTag y={88} />
      <text x={160} y={102} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        headers · body · destination
      </text>

      {/* Phase 2 — incoming response */}
      <SeqMessage fromX={SERVER_X} toX={PAGE_X} y={140} label="Phase 2 — response" marker={ID} />
      <TrackedTag y={158} />
      <text x={160} y={172} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        status code · headers · body
      </text>

      <text x={160} y={200} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Both phases feed the badge count.
      </text>
    </svg>
  );
};

/** Small "✓ tracked" pill, centered at x=160. Used between the two
 *  phase arrows to mark each one as captured. Green palette since
 *  this represents "captured by tracking" — keeps the locked tag
 *  contract (blue=DNR, purple=script) untouched. */
function TrackedTag({ y }: { y: number }) {
  return (
    <g>
      <rect x={128} y={y - 8} width={64} height={14} rx={7} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={160} y={y + 2} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        ✓ tracked
      </text>
    </g>
  );
}

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
