import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  TEXT,
  TEXT_DIM,
} from '../_shared';

// ─── Navigation reuse: same-window first ──────────────────────────

/**
 * Two stacked browser-window mockups. Top: one window with the popup
 * over an existing workspace tab → click activates that tab. Bottom:
 * caller window has no workspace tab; another window does. New tab
 * opens in the caller's window; the other window is dimmed to make
 * "we never yank focus across windows" visually unambiguous.
 */
export const MultiTabNavigationDiagram: React.FC = () => {
  const t = useT();
  const ID = 'mt-nav';
  const winBg = 'var(--ant-color-bg-container)';
  const winBorder = 'var(--ant-color-border)';
  const tabStripBg = 'var(--ant-color-fill-secondary)';
  const dimBg = 'var(--ant-color-fill-quaternary)';
  const dimStroke = 'var(--ant-color-border-secondary)';
  const dimText = 'var(--ant-color-text-quaternary)';

  /** Tiny chrome-style window frame: traffic lights + tab strip. */
  const Window = ({
    x,
    y,
    w,
    h,
    label,
    dimmed = false,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    dimmed?: boolean;
  }) => (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        fill={dimmed ? dimBg : winBg}
        stroke={dimmed ? dimStroke : winBorder}
        strokeDasharray={dimmed ? '3 2' : undefined}
      />
      {/* title bar */}
      <rect
        x={x}
        y={y}
        width={w}
        height={14}
        fill={dimmed ? dimBg : tabStripBg}
        stroke={dimmed ? dimStroke : winBorder}
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          cx={x + 8 + i * 7}
          cy={y + 7}
          r={2.5}
          fill={dimmed ? dimText : 'var(--ant-color-text-quaternary)'}
        />
      ))}
      <text x={x + w - 8} y={y + 10} textAnchor="end" fontSize={8} fontWeight={600} fill={dimmed ? dimText : TEXT_DIM}>
        {label}
      </text>
    </g>
  );

  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.multiTab.navigation.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.title')}
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.navigation.subtitle')}
      </text>

      {/* ── TOP scenario: warm (same window) ─────────────────── */}
      <text x={26} y={48} fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.sameWindow')}
      </text>
      <text x={108} y={48} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.navigation.sameWindowHint')}
      </text>

      <Window x={10} y={54} w={300} h={64} label={t('workbench.docs.diagrams.multiTab.navigation.window1')} />
      {/* tab strip area */}
      <rect x={10} y={68} width={300} height={18} fill={tabStripBg} stroke={winBorder} />
      {/* Existing workspace tab — highlighted as the activation target */}
      <rect x={14} y={70} width={120} height={14} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={20} y={80} fontSize={8} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.workspaceTab')}
      </text>
      {/* "your other tabs" */}
      <rect x={138} y={70} width={64} height={14} rx={2} fill={dimBg} stroke={dimStroke} />
      <text x={170} y={80} textAnchor="middle" fontSize={8} fill={dimText}>
        {t('workbench.docs.diagrams.multiTab.navigation.otherTab')}
      </text>

      {/* Popup card overlapping the toolbar */}
      <rect x={216} y={72} width={84} height={36} rx={3} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={258} y={84} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.popup')}
      </text>
      <text x={258} y={96} textAnchor="middle" fontSize={8} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.editRule')}
      </text>

      {/* arrow from popup to existing tab */}
      <path
        d={'M 220 90 Q 160 110 134 84'}
        fill="none"
        stroke={STROKE_GREEN}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />

      <rect x={86} y={124} width={148} height={18} rx={3} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={160} y={136} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.activates')}
      </text>

      {/* ── BOTTOM scenario: cold (cross-window) ────────────── */}
      <text x={26} y={166} fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.otherWindow')}
      </text>
      <text x={108} y={166} fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.navigation.otherWindowHint')}
      </text>

      {/* Caller window (left) */}
      <Window x={10} y={172} w={146} h={64} label={t('workbench.docs.diagrams.multiTab.navigation.window1Caller')} />
      <rect x={10} y={186} width={146} height={18} fill={tabStripBg} stroke={winBorder} />
      {/* Caller's existing tab */}
      <rect x={14} y={188} width={64} height={14} rx={2} fill={dimBg} stroke={dimStroke} />
      <text x={46} y={198} textAnchor="middle" fontSize={8} fill={dimText}>
        {t('workbench.docs.diagrams.multiTab.navigation.otherTab')}
      </text>
      {/* NEW tab appears here */}
      <rect x={82} y={188} width={68} height={14} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeDasharray="2 2" />
      <text x={116} y={198} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.newTab')}
      </text>
      {/* tiny popup glyph above */}
      <rect x={20} y={210} width={56} height={20} rx={2} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={48} y={222} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.multiTab.navigation.popup')}
      </text>
      <line x1={76} y1={220} x2={114} y2={204} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Other window (right, dimmed) */}
      <Window x={164} y={172} w={146} h={64} label={t('workbench.docs.diagrams.multiTab.navigation.window2')} dimmed />
      <rect x={164} y={186} width={146} height={18} fill={dimBg} stroke={dimStroke} strokeDasharray="2 2" />
      <rect x={168} y={188} width={120} height={14} rx={2} fill={dimBg} stroke={dimStroke} strokeDasharray="2 2" />
      <text x={228} y={198} textAnchor="middle" fontSize={8} fill={dimText}>
        {t('workbench.docs.diagrams.multiTab.navigation.workspaceTab')}
      </text>
      <text x={237} y={222} textAnchor="middle" fontSize={9} fontStyle="italic" fill={dimText}>
        {t('workbench.docs.diagrams.multiTab.navigation.untouched')}
      </text>

      <text x={160} y={258} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.navigation.footer1')}
      </text>
      <text x={160} y={271} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.multiTab.navigation.footer2')}
      </text>
    </svg>
  );
};
