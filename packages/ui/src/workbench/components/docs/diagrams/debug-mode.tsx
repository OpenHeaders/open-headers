/**
 * Debug mode — diagrams.
 *
 *   • DebugModeSurfaceDiagram — where the control lives: an inline
 *     switch in the footer pill, plus the popover for scope / pin /
 *     roster.
 *   • DebugModeScopeDiagram — the attach derivation:
 *     `( scope ∪ pins ) ∩ master switch` → the attached-tab set.
 *   • DebugModeReachDiagram — what standard mode can touch vs what an
 *     attached tab adds (navigations, workers, cross-origin frames,
 *     tab environment).
 *   • DebugModeStatesDiagram — the dot's four states.
 *
 * Theme tokens follow the same `var(--ant-color-*)` convention as the
 * other diagram files so light / dark re-theme for free.
 */

import type React from 'react';
import { ArrowDefs, BrowserWindow, STROKE, TEXT, TEXT_DIM } from './_shared';

const SUCCESS = 'var(--ant-color-success)';
const WARNING = 'var(--ant-color-warning)';
const ERROR = 'var(--ant-color-error)';
const SUCCESS_BG = 'var(--ant-color-success-bg)';
const WARNING_BG = 'var(--ant-color-warning-bg)';
const ERROR_BG = 'var(--ant-color-error-bg)';
const GREY = 'var(--ant-color-text-tertiary)';
const GREY_BG = 'var(--ant-color-fill-quaternary)';
const BORDER = 'var(--ant-color-border)';
const FILL_SECONDARY = 'var(--ant-color-fill-secondary)';
const BG_CONTAINER = 'var(--ant-color-bg-container)';
const PRIMARY_BG = 'var(--ant-color-primary-bg)';
const PRIMARY_BORDER = 'var(--ant-color-primary-border)';

type Level = 'green' | 'yellow' | 'red' | 'grey';
const dotColor = (lvl: Level): string =>
  lvl === 'red' ? ERROR : lvl === 'yellow' ? WARNING : lvl === 'green' ? SUCCESS : GREY;
const levelBg = (lvl: Level): string =>
  lvl === 'red' ? ERROR_BG : lvl === 'yellow' ? WARNING_BG : lvl === 'green' ? SUCCESS_BG : GREY_BG;

/** Tiny pill-switch glyph. `on` paints the track success + knob right. */
const SwitchGlyph: React.FC<{ x: number; y: number; on: boolean; w?: number }> = ({ x, y, on, w = 18 }) => {
  const h = w * 0.6;
  const r = h / 2 - 1.4;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={on ? SUCCESS : GREY_BG} stroke={on ? SUCCESS : BORDER} />
      <circle cx={on ? x + w - h / 2 : x + h / 2} cy={y + h / 2} r={r} fill={on ? '#fff' : GREY} />
    </g>
  );
};

// ─── Surface — where the control lives ────────────────────────────

export const DebugModeSurfaceDiagram: React.FC = () => {
  const FOOTER_Y = 152;
  const FOOTER_H = 22;
  const midY = FOOTER_Y + FOOTER_H / 2;
  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Debug mode lives in the footer — an inline switch toggles it; the dot and label open a popover with scope, the per-tab pin, and the attached-tabs list."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        Debug mode lives in the footer
      </text>

      <BrowserWindow
        x={8}
        y={26}
        w={304}
        h={150}
        title="example.com"
        caption="Switch toggles it · dot + label open the popover."
      >
        {/* dimmed page body */}
        <g opacity={0.32}>
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={20}
              y={54 + i * 12}
              width={280 - i * 34}
              height={6}
              rx={2}
              fill="var(--ant-color-fill-tertiary)"
            />
          ))}
        </g>

        {/* footer strip — the focal point */}
        <rect x={12} y={FOOTER_Y} width={296} height={FOOTER_H} fill={FILL_SECONDARY} stroke={SUCCESS} strokeWidth={1.5} />
        <circle cx={22} cy={midY} r={3.5} fill={SUCCESS} />
        <text x={29} y={midY + 3} fontSize={9} fontWeight={700} fill={TEXT}>
          Debug mode
        </text>
        <SwitchGlyph x={92} y={midY - 5.5} on />
        <circle cx={132} cy={midY} r={3} fill={GREY} />
        <text x={139} y={midY + 3} fontSize={9} fill={TEXT_DIM}>
          System status
        </text>

        {/* popover anchored to the pill */}
        <path d="M 34 146 L 46 146 L 40 154 Z" fill={BG_CONTAINER} stroke={BORDER} />
        <rect x={20} y={54} width={196} height={92} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
        <text x={30} y={69} fontSize={9} fontWeight={700} fill={TEXT}>
          Debug mode
        </text>
        <SwitchGlyph x={186} y={62} on />
        <line x1={30} y1={75} x2={206} y2={75} stroke={BORDER} strokeDasharray="2 2" />
        <text x={30} y={89} fontSize={8.5} fill={TEXT}>
          Inspect
        </text>
        <rect x={150} y={81} width={56} height={13} rx={3} fill={FILL_SECONDARY} stroke={BORDER} />
        <text x={178} y={90} textAnchor="middle" fontSize={8} fill={TEXT}>
          Both ▾
        </text>
        <text x={30} y={107} fontSize={8.5} fill={TEXT}>
          Include this tab
        </text>
        <SwitchGlyph x={188} y={101} on={false} w={16} />
        <text x={30} y={122} fontSize={8} fill={TEXT_DIM}>
          Attached tabs (1)
        </text>
        <rect x={28} y={127} width={180} height={14} rx={3} fill={PRIMARY_BG} />
        <text x={34} y={137} fontSize={8} fill={TEXT}>
          Tab #11 · example.com
        </text>
      </BrowserWindow>
    </svg>
  );
};

// ─── Scope — the attach derivation ────────────────────────────────

export const DebugModeScopeDiagram: React.FC = () => {
  const ID = 'dbg-scope';
  return (
    <svg
      viewBox="0 0 320 188"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="The attached set is derived: the chosen scope unioned with pinned tabs, intersected with the master switch. With debug mode off, nothing attaches."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        What gets attached
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        ( scope ∪ pins ) ∩ master switch
      </text>

      {/* scope input */}
      <rect x={10} y={46} width={120} height={42} rx={4} fill={PRIMARY_BG} stroke={PRIMARY_BORDER} />
      <text x={70} y={64} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Inspect: Both
      </text>
      <text x={70} y={78} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        DevTools ∪ focused tab
      </text>

      {/* pins input */}
      <rect x={10} y={98} width={120} height={34} rx={4} fill={FILL_SECONDARY} stroke={BORDER} />
      <text x={70} y={119} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Pinned: Tab #11
      </text>

      {/* union node */}
      <rect x={148} y={64} width={56} height={52} rx={6} fill={BG_CONTAINER} stroke={BORDER} />
      <text x={176} y={92} textAnchor="middle" fontSize={20} fontWeight={700} fill={TEXT}>
        ∪
      </text>
      <text x={176} y={108} textAnchor="middle" fontSize={7} fill={TEXT_DIM}>
        candidates
      </text>
      <line x1={130} y1={67} x2={146} y2={80} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />
      <line x1={130} y1={115} x2={146} y2={100} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />

      {/* gate → output */}
      <text x={222} y={82} textAnchor="middle" fontSize={7.5} fontStyle="italic" fill={TEXT_DIM}>
        ∩ Debug ON
      </text>
      <line x1={204} y1={90} x2={238} y2={90} stroke={STROKE} strokeWidth={1.3} markerEnd={`url(#${ID})`} />

      <rect x={240} y={62} width={72} height={56} rx={4} fill={SUCCESS_BG} stroke={SUCCESS} />
      <text x={276} y={78} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Attached
      </text>
      <text x={276} y={94} textAnchor="middle" fontSize={8} fill={TEXT}>
        Tab #7
      </text>
      <text x={276} y={106} textAnchor="middle" fontSize={8} fill={TEXT}>
        Tab #11
      </text>

      <text x={160} y={158} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Debug OFF → nothing attaches, whatever the scope.
      </text>
      <text x={160} y={174} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Re-attach replays from this — never a stored snapshot.
      </text>
    </svg>
  );
};

// ─── Reach — standard vs debug ────────────────────────────────────

export const DebugModeReachDiagram: React.FC = () => {
  const ROWS: { label: string; standard: boolean }[] = [
    { label: 'Page fetch / XHR', standard: true },
    { label: 'Navigations', standard: false },
    { label: 'Workers', standard: false },
    { label: 'Cross-origin iframes', standard: false },
    { label: 'Tab environment', standard: false },
  ];
  const ROW_Y0 = 64;
  const ROW_STEP = 26;
  const mark = (ok: boolean) => (ok ? '✓' : '✗');

  return (
    <svg
      viewBox="0 0 320 216"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Standard mode reaches only page fetch and XHR. An attached debug-mode tab also reaches navigations, workers, cross-origin iframes, and the tab environment."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        What each mode can touch
      </text>

      <text x={84} y={36} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Standard mode
      </text>
      <rect x={12} y={42} width={144} height={150} rx={6} fill={FILL_SECONDARY} stroke={BORDER} />

      <text x={236} y={36} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Debug mode
      </text>
      <rect x={164} y={42} width={144} height={150} rx={6} fill={PRIMARY_BG} stroke={PRIMARY_BORDER} />

      {ROWS.map((row, i) => {
        const y = ROW_Y0 + i * ROW_STEP;
        return (
          <g key={row.label}>
            <text x={26} y={y} fontSize={11} fontWeight={700} fill={row.standard ? SUCCESS : GREY}>
              {mark(row.standard)}
            </text>
            <text x={40} y={y} fontSize={8.5} fill={row.standard ? TEXT : TEXT_DIM}>
              {row.label}
            </text>
            <text x={178} y={y} fontSize={11} fontWeight={700} fill={SUCCESS}>
              ✓
            </text>
            <text x={192} y={y} fontSize={8.5} fill={TEXT}>
              {row.label}
            </text>
          </g>
        );
      })}

      <text x={84} y={206} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        banner-free
      </text>
      <text x={236} y={206} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        shows the banner
      </text>
    </svg>
  );
};

// ─── States — the dot at a glance ─────────────────────────────────

export const DebugModeStatesDiagram: React.FC = () => {
  const ROWS: { level: Level; label: string; msg: string }[] = [
    { level: 'grey', label: 'Off', msg: 'debug mode disabled' },
    { level: 'green', label: 'On · 2 tabs', msg: 'attached & healthy' },
    { level: 'yellow', label: 'Fell back', msg: 'banner dismissed → heuristic' },
    { level: 'red', label: 'Attach failed', msg: "couldn't engage the protocol" },
  ];
  const X = 18;
  const W = 284;
  const ROW_H = 22;
  const STEP = 28;

  return (
    <svg
      viewBox="0 0 320 144"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="The dot has four states: grey off, green on and attached, yellow fell back to heuristic when the banner was dismissed, and red when a tab failed to attach."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        The dot at a glance
      </text>
      {ROWS.map((row, i) => {
        const y = 28 + i * STEP;
        return (
          <g key={row.label}>
            <rect x={X} y={y} width={W} height={ROW_H} rx={4} fill={levelBg(row.level)} stroke={dotColor(row.level)} />
            <circle cx={X + 12} cy={y + ROW_H / 2} r={4} fill={dotColor(row.level)} />
            <text x={X + 24} y={y + ROW_H / 2 + 3} fontSize={9} fontWeight={700} fill={TEXT}>
              {row.label}
            </text>
            <text x={X + W - 10} y={y + ROW_H / 2 + 3} textAnchor="end" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {row.msg}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
