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
 * Phases overview — the section's hero diagram. Two clean side-by-
 * side panels, one per phase. Each panel has a numbered badge, a
 * directional mini-flow (Page → Network / Network → Page), and the
 * list of fields captured in that direction. Plenty of whitespace
 * inside each panel so nothing crowds the eye. Bottom strip ties
 * them together: "both captured per connection." The popup outcome
 * lives in the next two diagrams in the section — this one focuses
 * solely on the two-phase concept.
 */
export const RequestTrackingPhasesDiagram: React.FC = () => {
  // Panel geometry — two equal-width panels with a clear gap.
  const PANEL_W = 142;
  const PANEL_H = 168;
  const PANEL_Y = 30;
  const LEFT_X = 10;
  const RIGHT_X = 168;

  type PhaseDef = {
    n: number;
    name: 'REQUEST' | 'RESPONSE';
    direction: 'out' | 'in';
    captured: string[];
    accentFill: string;
    accentStroke: string;
  };

  const PHASES: PhaseDef[] = [
    {
      n: 1,
      name: 'REQUEST',
      direction: 'out',
      captured: ['URL', 'Method', 'Headers', 'Body'],
      accentFill: FILL_BLUE,
      accentStroke: STROKE_BLUE,
    },
    {
      n: 2,
      name: 'RESPONSE',
      direction: 'in',
      captured: ['Status code', 'Headers', 'Body', 'Timings'],
      accentFill: FILL_GREEN,
      accentStroke: STROKE_GREEN,
    },
  ];

  const renderPanel = (xOff: number, phase: PhaseDef) => {
    const accentColor = phase.accentStroke;
    const HEADER_H = 38;
    return (
      <g>
        {/* Panel frame */}
        <rect
          x={xOff}
          y={PANEL_Y}
          width={PANEL_W}
          height={PANEL_H}
          rx={6}
          fill="var(--ant-color-bg-container)"
          stroke="var(--ant-color-border)"
        />

        {/* Header band — phase name + colored stripe */}
        <rect
          x={xOff}
          y={PANEL_Y}
          width={PANEL_W}
          height={HEADER_H}
          rx={6}
          fill={phase.accentFill}
          stroke={phase.accentStroke}
        />
        {/* Numbered circle on the left */}
        <circle cx={xOff + 18} cy={PANEL_Y + HEADER_H / 2} r={11} fill="var(--ant-color-bg-container)" stroke={accentColor} strokeWidth={1.5} />
        <text x={xOff + 18} y={PANEL_Y + HEADER_H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={accentColor}>
          {phase.n}
        </text>
        {/* Phase name to the right of the number */}
        <text x={xOff + 36} y={PANEL_Y + HEADER_H / 2 + 4} fontSize={11} fontWeight={700} fill={accentColor} letterSpacing={0.6}>
          {phase.name}
        </text>

        {/* Direction arrow row — Page → Network or Network → Page */}
        <g transform={`translate(${xOff + 10}, ${PANEL_Y + HEADER_H + 12})`}>
          <rect x={0} y={0} width={40} height={20} rx={3} fill="var(--ant-color-fill-secondary)" stroke="var(--ant-color-border)" />
          <text x={20} y={13} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
            {phase.direction === 'out' ? 'Page' : 'Network'}
          </text>
          {/* Arrow */}
          <line
            x1={44}
            y1={10}
            x2={82}
            y2={10}
            stroke={accentColor}
            strokeWidth={2}
            markerEnd={`url(#rt-ph-${phase.n}-arrow)`}
          />
          <rect x={82} y={0} width={40} height={20} rx={3} fill="var(--ant-color-fill-secondary)" stroke="var(--ant-color-border)" />
          <text x={102} y={13} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
            {phase.direction === 'out' ? 'Network' : 'Page'}
          </text>
        </g>

        {/* Divider */}
        <line
          x1={xOff + 12}
          y1={PANEL_Y + HEADER_H + 44}
          x2={xOff + PANEL_W - 12}
          y2={PANEL_Y + HEADER_H + 44}
          stroke="var(--ant-color-border-secondary)"
        />

        {/* "Captured:" header */}
        <text x={xOff + 12} y={PANEL_Y + HEADER_H + 58} fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.4}>
          CAPTURED
        </text>

        {/* Bullet list of captured fields */}
        {phase.captured.map((item, i) => {
          const itemY = PANEL_Y + HEADER_H + 70 + i * 16;
          return (
            <g key={item}>
              {/* Check icon */}
              <circle cx={xOff + 16} cy={itemY - 4} r={4} fill={phase.accentFill} stroke={accentColor} />
              <path
                d={`M ${xOff + 13} ${itemY - 4} L ${xOff + 15} ${itemY - 2} L ${xOff + 19} ${itemY - 6}`}
                stroke={accentColor}
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
              />
              <text x={xOff + 26} y={itemY} fontSize={10} fill={TEXT}>
                {item}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 230"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Two phases are captured per connection — REQUEST captures URL, method, headers, body; RESPONSE captures status code, headers, body, timings."
    >
      <defs>
        {PHASES.map((p) => (
          <marker
            key={p.n}
            id={`rt-ph-${p.n}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={p.accentStroke} />
          </marker>
        ))}
      </defs>

      <text x={160} y={18} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        Every connection has two phases
      </text>

      {renderPanel(LEFT_X, PHASES[0])}
      {renderPanel(RIGHT_X, PHASES[1])}

      {/* Bottom unifying caption */}
      <text x={160} y={216} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Both phases contribute data to the badge count in This Page.
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
