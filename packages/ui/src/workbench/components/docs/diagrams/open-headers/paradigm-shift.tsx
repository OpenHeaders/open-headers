import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { FILL_BLUE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { OH_GREEN, OH_GREEN_TINT, OhLogoSmall } from './_shared';

// CJK glyphs render close to the full em box, not the ~0.55em a Latin
// glyph averages — weigh them accordingly when sizing text-driven pills.
const unitLen = (s: string): number =>
  Array.from(s).reduce((n, ch) => n + ((ch.codePointAt(0) ?? 0) > 0x2e7f ? 1.85 : 1), 0);

/**
 * Paradigm-shift landing diagram — grouped us-vs-them rows, uniform
 * primary/sub two-line layout so labels never truncate and each row
 * breathes. Wide viewBox (480) gives each column real width; matching
 * maxWidth caps upscale in wide docs panels so text doesn't render
 * comically large.
 */
export const ParadigmShiftDiagram: React.FC = () => {
  const t = useT();
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
      name: t('workbench.docs.diagrams.openHeaders.shift.groupArchitecture'),
      rows: [
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usBrowserPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usBrowserSub'),
            tagline: t('workbench.docs.diagrams.openHeaders.shift.usBrowserTag'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themBrowserPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themBrowserSub'),
          },
          usCornerStamp: t('workbench.docs.diagrams.openHeaders.shift.stampUnique'),
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usSelfHostPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usSelfHostSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themSelfHostPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themSelfHostSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usOfflinePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usOfflineSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themOfflinePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themOfflineSub'),
          },
        },
      ],
    },
    {
      name: t('workbench.docs.diagrams.openHeaders.shift.groupPrivacy'),
      rows: [
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usAccountPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usAccountSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themAccountPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themAccountSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usLocalPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usLocalSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themLocalPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themLocalSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usTrackingPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usTrackingSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themTrackingPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themTrackingSub'),
          },
        },
      ],
    },
    {
      name: t('workbench.docs.diagrams.openHeaders.shift.groupCapability'),
      rows: [
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usEnginePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usEngineSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themEnginePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themEngineSub'),
          },
          usCornerStamp: t('workbench.docs.diagrams.openHeaders.shared.stampBestInClass'),
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usCatalogPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usCatalogSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themCatalogPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themCatalogSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usAutomatePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usAutomateSub'),
            tagline: t('workbench.docs.diagrams.openHeaders.shift.usAutomateTag'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themAutomatePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themAutomateSub'),
          },
          usCornerStamp: t('workbench.docs.diagrams.openHeaders.shift.stampUserControlled'),
        },
      ],
    },
    {
      name: t('workbench.docs.diagrams.openHeaders.shift.groupSync'),
      rows: [
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usSyncPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usSyncSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themSyncPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themSyncSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usSavePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usSaveSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themSavePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themSaveSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usOfflineEditPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usOfflineEditSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themOfflineEditPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themOfflineEditSub'),
          },
        },
      ],
    },
    {
      name: t('workbench.docs.diagrams.openHeaders.shift.groupPricing'),
      rows: [
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usTierPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usTierSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themTierPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themTierSub'),
          },
          usCornerStamp: t('workbench.docs.diagrams.openHeaders.shift.stampNoGates'),
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usSsoPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usSsoSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themSsoPrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themSsoSub'),
          },
        },
        {
          us: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.usLapsePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.usLapseSub'),
          },
          them: {
            primary: t('workbench.docs.diagrams.openHeaders.shift.themLapsePrimary'),
            sub: t('workbench.docs.diagrams.openHeaders.shift.themLapseSub'),
          },
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
    const stampW = Math.max(24, Math.round(unitLen(label) * charW) + padX * 2);
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
      aria-label={t('workbench.docs.diagrams.openHeaders.shift.aria')}
    >
      <text x={CENTER_X} y={TITLE_Y} textAnchor="middle" fontSize={13} fontWeight={700} fill={TEXT} letterSpacing={1}>
        {t('workbench.docs.diagrams.openHeaders.shift.title')}
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
        {t('workbench.docs.diagrams.openHeaders.shared.openHeaders')}
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
        {t('workbench.docs.diagrams.openHeaders.shift.everyoneElse')}
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
        {t('workbench.docs.diagrams.openHeaders.shift.footer')}
      </text>
    </svg>
  );
};
