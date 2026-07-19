import type React from 'react';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT, OhLogoSmall } from './_shared';

/**
 * Paradigm-shift landing diagram — grouped us-vs-them rows, uniform
 * primary/sub two-line layout so labels never truncate and each row
 * breathes. Wide viewBox (480) gives each column real width; matching
 * maxWidth caps upscale in wide docs panels so text doesn't render
 * comically large.
 */
export const ParadigmShiftDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';

  type Side = { primary: string; sub?: string; tagline?: string };
  /** Small rubber-stamp overlay pinned to the cell's bottom-right corner
   *  (tier / uniqueness marker — e.g. UNIQUE, ENTERPRISE). */
  type Row = { us: Side; them: Side; usCornerStamp?: string };
  type Group = { name: string; rows: Row[] };

  const GROUPS: Group[] = [
    {
      name: 'Architecture & Reach',
      rows: [
        {
          us: { primary: 'Everything inside the browser', sub: 'back-end + front-end', tagline: '- in the extension' },
          them: { primary: 'Back-end outside the browser', sub: 'desktop app / cloud, internet required' },
          usCornerStamp: 'UNIQUE',
        },
        {
          us: { primary: 'Self-host the back-end', sub: 'browser · desktop app · daemon · VM' },
          them: { primary: 'Their cloud only', sub: 'no choice in where your data lives' },
        },
        {
          us: { primary: 'Front-end works native offline', sub: 'extension · desktop · CLI · web' },
          them: { primary: 'Cloud-only front-end (Online)', sub: 'needs internet for back-end access' },
        },
      ],
    },
    {
      name: 'Privacy & Ownership',
      rows: [
        {
          us: { primary: 'No account', sub: 'no sign-in, no login wall' },
          them: { primary: 'Sign in required', sub: 'to use your own data' },
        },
        {
          us: { primary: 'Local-only', sub: 'no cloud relay' },
          them: { primary: 'Cloud-relayed', sub: 'your traffic goes through them' },
        },
        {
          us: { primary: 'No tracking', sub: 'anonymous counters · one-switch off' },
          them: { primary: 'Tracked by default', sub: 'usage data sent home' },
        },
      ],
    },
    {
      name: 'Capability',
      rows: [
        {
          us: { primary: 'Rule Engine', sub: 'intercept & modify requests' },
          them: { primary: 'No in-browser engine', sub: 'separate proxy or app required' },
          usCornerStamp: 'BEST-IN-CLASS',
        },
        {
          us: { primary: 'API Requests Catalog', sub: 'HTTP, WS, GraphQL — all in-browser' },
          them: { primary: 'Sign in to a platform', sub: 'and install their app' },
        },
        {
          us: { primary: 'Automate your workspace', sub: 'your AI agent, local or remote', tagline: '- you decide' },
          them: { primary: 'Private or their cloud AI only', sub: 'no open or programmatic access' },
          usCornerStamp: 'USER-CONTROLLED',
        },
      ],
    },
    {
      name: 'Sync & Resilience',
      rows: [
        {
          us: { primary: 'Real-time Sync Engine', sub: 'multi-device, browser, surface' },
          them: { primary: 'Last-write-wins', sub: 'or no sync at all' },
        },
        {
          us: { primary: 'Conflict-free concurrent Save', sub: 'field-level, all changes committed' },
          them: { primary: 'Entity-level overwrite', sub: 'saves can wipe each other' },
        },
        {
          us: { primary: 'Works offline, fully editable', sub: "syncs automatically when you're back" },
          them: { primary: 'Needs online connection', sub: 'or no access at all' },
        },
      ],
    },
    {
      name: 'Pricing & Trust',
      rows: [
        {
          us: { primary: 'Everything today, on every tier', sub: 'free ≤ 3 users · paid = team seats' },
          them: { primary: 'Feature-gated tiers', sub: 'core capabilities behind upsells' },
          usCornerStamp: 'NO FEATURE GATES',
        },
        {
          us: { primary: 'SSO & security always free', sub: 'SSO/OIDC · RBAC · audit · SIEM' },
          them: { primary: 'The SSO tax', sub: 'security sold as enterprise add-on' },
        },
        {
          us: { primary: 'A lapse never locks you out', sub: 'grace, then free tier — data yours' },
          them: { primary: 'Stop paying, lose access', sub: 'paywall over your own data' },
        },
      ],
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
  // TEXT_H is the vertical space the primary + sub copy occupies.
  // Rows that carry a corner stamp get extra height (STAMP_EXTRA) so
  // the stamp sits in its own band below the copy instead of behind it.
  const TEXT_H = 50;
  const STAMP_EXTRA = 22;
  const ROW_GAP = 6;
  // Group header band — small label above each group's rows.
  const GROUP_HEADER_H = 22;
  const GROUP_GAP_BEFORE_HEADER = 12; // breathing room above each group header
  const GROUP_GAP_AFTER_HEADER = 8; // space between header and first row
  const rowCardH = (row: Row) => (row.usCornerStamp ? TEXT_H + STAMP_EXTRA : TEXT_H);

  // Compute Y positions for both group headers and individual rows, so
  // the render pass can look them up by group/row index.
  type GroupLayout = { headerY: number; rowYs: number[] };
  const groupLayouts: GroupLayout[] = [];
  {
    let cursor = 0;
    GROUPS.forEach((group, gi) => {
      // First group has no extra spacing above its header (it sits
      // flush after the column headers).
      if (gi > 0) cursor += GROUP_GAP_BEFORE_HEADER;
      const headerY = cursor;
      cursor += GROUP_HEADER_H + GROUP_GAP_AFTER_HEADER;
      const rowYs: number[] = [];
      group.rows.forEach((row, ri) => {
        rowYs.push(cursor);
        cursor += rowCardH(row);
        if (ri < group.rows.length - 1) cursor += ROW_GAP;
      });
      groupLayouts.push({ headerY, rowYs });
    });
  }
  const totalRowH = groupLayouts.length
    ? groupLayouts[groupLayouts.length - 1].rowYs[groupLayouts[groupLayouts.length - 1].rowYs.length - 1] +
      rowCardH(GROUPS[GROUPS.length - 1].rows[GROUPS[GROUPS.length - 1].rows.length - 1])
    : 0;
  const FOOTER_Y = ROW_Y0 + totalRowH + 24;
  const H = FOOTER_Y + 18;

  /**
   * Corner rubber-stamp — double-border, letter-spaced caps, un-rotated,
   * pinned to the cell's top-right corner. Width auto-sizes to fit
   * longer labels (ENTERPRISE,
   * etc.). Reads as a tier marker without taking the rotated "look at
   * me" energy of the centered UNIQUE stamp.
   */
  const renderCornerStamp = (cellX: number, y: number, cardH: number, label: string) => {
    const charW = 6;
    const padX = 8;
    // Minimum 24 so very short labels ('#1') render as a near-square chip
    // rather than getting padded out to a wide pill.
    const stampW = Math.max(24, label.length * charW + padX * 2);
    const stampH = 20;
    // Pinned bottom-right of the cell so the primary/sub copy on the
    // left has the full top half of the row to itself.
    const x = cellX + COL_W - 6 - stampW;
    const yTop = y + cardH - stampH - 4;
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
          fontSize={8}
          fontWeight={900}
          fill={TEXT}
          letterSpacing={0.8}
        >
          {label}
        </text>
      </g>
    );
  };

  const renderSide = (side: Side, x: number, y: number, cardH: number, accent: 'good' | 'bad') => {
    // Primary + sub copy are always anchored to the top TEXT_H of the
    // card. Tall (stamped) cards keep the copy in the same visual
    // place; the extra STAMP_EXTRA space lives below for the stamp.
    const badgeCx = x + 18;
    const badgeCy = y + TEXT_H / 2;
    const textX = x + 38;
    const primaryY = y + TEXT_H / 2 - 4;
    const subY = y + TEXT_H / 2 + 12;
    const fillBg = accent === 'good' ? OH_GREEN_TINT : errBg;
    const strokeColor = accent === 'good' ? OH_GREEN : errBorder;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={COL_W}
          height={cardH}
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
        {side.tagline && (
          <text x={textX} y={subY + 14} fontSize={10} fontWeight={700} fill={TEXT_DIM} fontStyle="italic">
            {side.tagline}
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
      aria-label="The paradigm shift — grouped contrasts between Open Headers and every other tool in the space. Everything in one browser extension, no account, local-only, no tracking, one engine for nine rule types, field-level sync, a full-featured free tier with no feature gates, seat-based pricing, and no lockout on lapse — versus the rest of the market."
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

      {GROUPS.map((group, gi) => {
        const layout = groupLayouts[gi];
        const headerY = ROW_Y0 + layout.headerY;
        // Group header band — spans the full content width across both
        // columns so the section heading visually owns the rows below.
        const bandX = LEFT_X;
        const bandW = RIGHT_X + COL_W - LEFT_X;
        return (
          <g key={`group-${gi}`}>
            <rect
              x={bandX}
              y={headerY}
              width={bandW}
              height={GROUP_HEADER_H}
              rx={4}
              fill="var(--ant-color-fill-secondary)"
              stroke="var(--ant-color-border-secondary)"
              strokeWidth={1}
            />
            <text
              x={CENTER_X}
              y={headerY + GROUP_HEADER_H / 2 + 4}
              textAnchor="middle"
              fontSize={10}
              fontWeight={800}
              fill={TEXT_DIM}
              letterSpacing={1}
            >
              {group.name.toUpperCase()}
            </text>
            {group.rows.map((row, ri) => {
              const y = ROW_Y0 + layout.rowYs[ri];
              const cardH = rowCardH(row);
              return (
                <g key={`row-${gi}-${ri}`}>
                  {renderSide(row.us, LEFT_X, y, cardH, 'good')}
                  {row.usCornerStamp && renderCornerStamp(LEFT_X, y, cardH, row.usCornerStamp)}
                  {renderSide(row.them, RIGHT_X, y, cardH, 'bad')}
                </g>
              );
            })}
          </g>
        );
      })}

      <text x={CENTER_X} y={FOOTER_Y} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
        Local-first. By design. Not as an afterthought.
      </text>
    </svg>
  );
};
