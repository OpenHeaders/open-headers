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
import { useT } from '@openheaders/ui/context/LocaleContext';
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
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from './_shared';

/**
 * Phases overview — two stacked cards with a thin saturated accent
 * stripe on the left and clean white interiors. No washed-out fills.
 * Both phases use the locked DNR-blue palette in different weights
 * (light primary for request, deep blue-800 for response) — keeps the
 * "captured by tracking" semantic visually unified without leaning on
 * the pale success-green tint that doesn't survive a light theme.
 */
export const RequestTrackingPhasesDiagram: React.FC = () => {
  const t = useT();
  const CARD_X = 10;
  const CARD_W = 300;
  const CARD_H = 84;
  const CARD_Y0 = 30;
  const CARD_GAP = 22;
  const STRIPE_W = 6;

  // Hardcoded blue palette — `--ant-color-primary` is theme-stable
  // for the lighter shade; the deeper shade is from Ant's default
  // palette (blue-8) and reads correctly in both light + dark themes.
  const REQUEST_ACCENT = 'var(--ant-color-primary)';
  const RESPONSE_ACCENT = '#0958d9';

  type PhaseDef = {
    n: number;
    name: string;
    direction: string;
    sub: string;
    captured: string[];
    accent: string;
  };

  const PHASES: PhaseDef[] = [
    {
      n: 1,
      name: t('workbench.docs.diagrams.requestTracking.phaseRequest'),
      direction: t('workbench.docs.diagrams.requestTracking.phaseRequestDir'),
      sub: t('workbench.docs.diagrams.requestTracking.outbound'),
      captured: [
        'URL',
        t('workbench.docs.diagrams.requestTracking.capMethod'),
        t('workbench.docs.diagrams.requestTracking.capHeaders'),
        t('workbench.docs.diagrams.requestTracking.capBody'),
      ],
      accent: REQUEST_ACCENT,
    },
    {
      n: 2,
      name: t('workbench.docs.diagrams.requestTracking.phaseResponse'),
      direction: t('workbench.docs.diagrams.requestTracking.phaseResponseDir'),
      sub: t('workbench.docs.diagrams.requestTracking.inbound'),
      captured: [
        t('workbench.docs.diagrams.requestTracking.capStatus'),
        t('workbench.docs.diagrams.requestTracking.capHeaders'),
        t('workbench.docs.diagrams.requestTracking.capBody'),
        t('workbench.docs.diagrams.requestTracking.capTimings'),
      ],
      accent: RESPONSE_ACCENT,
    },
  ];

  const renderCard = (yOff: number, phase: PhaseDef) => {
    // Left column — number + name + direction
    const leftColX = CARD_X + STRIPE_W + 14;
    // Right column — captured grid
    const rightColX = CARD_X + 160;
    const rightColTwoX = rightColX + 80;

    return (
      <g>
        {/* Card frame */}
        <rect
          x={CARD_X}
          y={yOff}
          width={CARD_W}
          height={CARD_H}
          rx={8}
          fill="var(--ant-color-bg-container)"
          stroke="var(--ant-color-border)"
        />

        {/* Thin accent stripe on the left edge */}
        <rect x={CARD_X} y={yOff + 1} width={STRIPE_W} height={CARD_H - 2} rx={3} fill={phase.accent} />

        {/* Numbered badge */}
        <circle cx={leftColX + 8} cy={yOff + 22} r={12} fill={phase.accent} />
        <text
          x={leftColX + 8}
          y={yOff + 26}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="var(--ant-color-bg-container)"
        >
          {phase.n}
        </text>

        {/* Phase name */}
        <text x={leftColX + 26} y={yOff + 19} fontSize={13} fontWeight={700} fill={phase.accent} letterSpacing={0.6}>
          {phase.name}
        </text>
        <text x={leftColX + 26} y={yOff + 32} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
          {phase.sub}
        </text>

        {/* Direction flow */}
        <text x={leftColX} y={yOff + 56} fontFamily="monospace" fontSize={10} fontWeight={600} fill={TEXT}>
          {phase.direction}
        </text>
        <text x={leftColX} y={yOff + 72} fontSize={8} fill={TEXT_DIM}>
          {t('workbench.docs.diagrams.requestTracking.perRoundtrip')}
        </text>

        {/* Captured header */}
        <text x={rightColX} y={yOff + 16} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.6}>
          {t('workbench.docs.diagrams.requestTracking.capturedKicker')}
        </text>

        {/* Two-column captured list (2 columns × 2 rows) */}
        {phase.captured.map((item, i) => {
          const col = Math.floor(i / 2);
          const row = i % 2;
          const cx = col === 0 ? rightColX : rightColTwoX;
          const cy = yOff + 34 + row * 22;
          return (
            <g key={item}>
              <circle cx={cx + 5} cy={cy - 4} r={5} fill={phase.accent} />
              <path
                d={`M ${cx + 1} ${cy - 4} L ${cx + 4} ${cy - 1} L ${cx + 9} ${cy - 7}`}
                stroke="var(--ant-color-bg-container)"
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text x={cx + 16} y={cy} fontSize={10} fill={TEXT}>
                {item}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const card1Y = CARD_Y0;
  const card2Y = CARD_Y0 + CARD_H + CARD_GAP;
  const connectorY = card1Y + CARD_H;

  return (
    <svg
      viewBox="0 0 320 244"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.requestTracking.phasesAria')}
    >
      <text x={160} y={18} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.requestTracking.phasesTitle')}
      </text>

      {renderCard(card1Y, PHASES[0])}
      {renderCard(card2Y, PHASES[1])}

      {/* Connector between the two cards */}
      <line
        x1={160}
        y1={connectorY + 2}
        x2={160}
        y2={connectorY + CARD_GAP - 2}
        stroke="var(--ant-color-border)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
      <rect
        x={118}
        y={connectorY + CARD_GAP / 2 - 8}
        width={84}
        height={16}
        rx={8}
        fill="var(--ant-color-bg-container)"
        stroke="var(--ant-color-border)"
      />
      <text x={160} y={connectorY + CARD_GAP / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.sameConnection')}
      </text>

      <text x={160} y={236} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.phasesFooter')}
      </text>
    </svg>
  );
};

export const RequestTrackingDiagram: React.FC = () => {
  const t = useT();
  const ID = 'rt-msg';
  // Three participants centered at x = 60, 160, 260
  return (
    <svg
      viewBox="0 0 320 290"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.requestTracking.seqAria')}
    >
      <SeqArrowDefs id={ID} />
      <SeqParticipant
        x={60}
        label={t('workbench.docs.diagrams.requestTracking.pBrowser')}
        sub={t('workbench.docs.diagrams.requestTracking.pBrowserSub')}
      />
      <SeqParticipant
        x={160}
        label={t('workbench.docs.diagrams.requestTracking.pExtension')}
        sub={t('workbench.docs.diagrams.requestTracking.pExtensionSub')}
      />
      <SeqParticipant
        x={260}
        label={t('workbench.docs.diagrams.requestTracking.pPopup')}
        sub={t('workbench.docs.diagrams.requestTracking.pPopupSub')}
      />
      <SeqLifeline x={60} y1={38} y2={282} />
      <SeqLifeline x={160} y1={38} y2={282} />
      <SeqLifeline x={260} y1={38} y2={282} />

      {/* Phase 1 — request observed + matched + recorded */}
      <SeqMessage
        fromX={60}
        toX={160}
        y={64}
        label={t('workbench.docs.diagrams.requestTracking.msgRequest')}
        marker={ID}
      />
      <SeqActivation x={160} y={64} height={52} />
      <text x={172} y={78} fontSize={9} fill={SEQ_TEXT}>
        {t('workbench.docs.diagrams.requestTracking.noteMatch')}
      </text>
      <text x={172} y={91} fontSize={9} fill={SEQ_TEXT}>
        {t('workbench.docs.diagrams.requestTracking.noteRecord1')}
      </text>
      <text x={172} y={102} fontSize={9} fill={SEQ_TEXT}>
        {t('workbench.docs.diagrams.requestTracking.noteRecord2')}
      </text>

      {/* Phase 2 — response phase recorded too */}
      <SeqMessage
        fromX={60}
        toX={160}
        y={140}
        label={t('workbench.docs.diagrams.requestTracking.msgResponse')}
        marker={ID}
      />
      <SeqActivation x={160} y={140} height={28} />
      <text x={172} y={154} fontSize={9} fill={SEQ_TEXT}>
        {t('workbench.docs.diagrams.requestTracking.noteResponse')}
      </text>

      {/* Time gap */}
      <SeqLaterGap y={195} />

      {/* Phase 3 — popup reads recorded data on open */}
      <SeqMessage
        fromX={260}
        toX={160}
        y={222}
        label={t('workbench.docs.diagrams.requestTracking.msgOpenPopup')}
        marker={ID}
      />
      <SeqActivation x={160} y={222} height={20} />
      <SeqMessage
        fromX={160}
        toX={260}
        y={252}
        label={t('workbench.docs.diagrams.requestTracking.msgReadBack')}
        dashed
        marker={ID}
      />

      <text x={160} y={278} textAnchor="middle" fontSize={9} fontStyle="italic" fill={SEQ_DIM}>
        {t('workbench.docs.diagrams.requestTracking.seqFooter')}
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
  const t = useT();
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
      aria-label={t('workbench.docs.diagrams.requestTracking.uiAria')}
    >
      {/* Collapsed state */}
      <text x={160} y={12} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.uiTitle')}
      </text>
      <rect x={20} y={20} width={280} height={28} rx={4} fill={cardBg} stroke={cardStroke} />
      <text x={32} y={38} fontSize={11} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.requestTracking.uiRule')}
      </text>
      <Badge x={258} y={27} n="3" />
      <text x={282} y={37} fontSize={11} fill={TEXT_DIM}>
        ▾
      </text>

      {/* Click → expand affordance */}
      <line x1={160} y1={52} x2={160} y2={68} stroke={accent} strokeWidth={1.5} strokeDasharray="3 2" />
      <text x={166} y={64} fontSize={9} fill={accent}>
        {t('workbench.docs.diagrams.requestTracking.clickBadge')}
      </text>

      {/* Expanded state */}
      <rect x={20} y={72} width={280} height={166} rx={4} fill={cardBg} stroke={cardStroke} />
      {/* Header */}
      <text x={32} y={90} fontSize={11} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.requestTracking.uiRule')}
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
        ads.openheaders.com/track
      </text>
      <ResourceTag x={246} y={106} label={t('workbench.docs.diagrams.requestTracking.wireTagXhr')} />
      <text x={88} y={125} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.matchedPattern')}
      </text>
      <line x1={28} y1={132} x2={292} y2={132} stroke={rowDivider} strokeDasharray="2 3" />

      {/* Row 2 */}
      <text x={32} y={146} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        14:32:11
      </text>
      <text x={88} y={146} fontFamily="monospace" fontSize={9} fill={TEXT}>
        ads.openheaders.com/pixel
      </text>
      <ResourceTag x={246} y={138} label={t('workbench.docs.diagrams.requestTracking.wireTagImage')} />
      <text x={88} y={157} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.matchedPattern')}
      </text>
      <line x1={28} y1={164} x2={292} y2={164} stroke={rowDivider} strokeDasharray="2 3" />

      {/* Row 3 */}
      <text x={32} y={178} fontFamily="monospace" fontSize={9} fill={TEXT_DIM}>
        14:32:35
      </text>
      <text x={88} y={178} fontFamily="monospace" fontSize={9} fill={TEXT}>
        ads.openheaders.com/beacon
      </text>
      <ResourceTag x={246} y={170} label={t('workbench.docs.diagrams.requestTracking.wireTagPing')} />
      <text x={88} y={189} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.matchedPattern')}
      </text>

      {/* Annotation legend at bottom */}
      <rect x={28} y={206} width={264} height={26} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={160} y={217} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.requestTracking.legendFields')}
      </text>
      <text x={160} y={228} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.requestTracking.legendBadge')}
      </text>
    </svg>
  );
};
