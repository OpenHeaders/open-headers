/**
 * Multi-tab Behavior — diagrams.
 *
 *   • MultiTabSyncDiagram (overview) — sequence-style. Tab A writes to
 *     chrome.storage, the SW broadcasts, Tab B re-hydrates. Layout/dock
 *     state lives in each tab's box, off the storage lifeline, to make
 *     "syncs vs per-tab" visible at a glance.
 *
 *   • MultiTabNavigationDiagram — same-window-first routing. Two
 *     scenarios share the same intent ("edit rule from popup") to make
 *     the only-thing-that-changes-is-window-membership clear.
 *
 *   • MultiTabNumberingDiagram — four frames of a timeline showing how
 *     ordinals stay stable across closes. Anchored to the
 *     `nextAvailableOrdinal(inUse) = max(inUse) + 1` rule from the
 *     workspace-tab-registry: closing #1 while #2/#3 survive does NOT
 *     renumber; the next tab gets #4.
 *
 *   • MultiTabSyncMatrixDiagram — what syncs vs what's tab-local, in
 *     a two-column reach visualization (mirror of the DNR / Script
 *     reach pair).
 */

import type React from 'react';
import {
  ArrowDefs,
  FILL_BLUE,
  FILL_GREEN,
  FILL_ORANGE,
  STROKE,
  STROKE_BLUE,
  STROKE_GREEN,
  STROKE_ORANGE,
  TEXT,
  TEXT_DIM,
} from './_shared';

// ─── Overview: two tab mockups side-by-side ───────────────────────

/**
 * Two browser-tab mockups showing the practical end-user payoff:
 * work two contexts in parallel without losing your place. Left tab
 * is a different workspace ("Production"); right tab is the same
 * workspace with a different layout (Environments expanded instead
 * of Rules). The point is concrete: each tab has its own focus, and
 * shared data (rule names) appears in both because storage syncs.
 */
export const MultiTabSyncDiagram: React.FC = () => {
  const tabBg = 'var(--ant-color-bg-container)';
  const tabBorder = 'var(--ant-color-border)';
  const headerBg = 'var(--ant-color-fill-secondary)';
  const sidebarBg = 'var(--ant-color-fill-quaternary)';
  const rowBg = 'var(--ant-color-fill-tertiary)';
  const activeFill = FILL_BLUE;
  const activeStroke = STROKE_BLUE;

  const renderTab = (xOffset: number, ordinal: string, workspace: string, mode: 'rules' | 'env') => {
    const x = xOffset;
    return (
      <g key={ordinal}>
        {/* Tab strip + title */}
        <rect x={x} y={26} width={146} height={18} rx={3} fill={headerBg} stroke={tabBorder} />
        <text x={x + 8} y={38} fontSize={9} fontWeight={600} fill={TEXT}>
          {ordinal} Open Headers
        </text>
        <circle cx={x + 138} cy={35} r={3} fill="var(--ant-color-text-quaternary)" />

        {/* App body */}
        <rect x={x} y={44} width={146} height={120} fill={tabBg} stroke={tabBorder} />

        {/* Top bar with workspace name */}
        <rect x={x} y={44} width={146} height={16} fill={headerBg} stroke="none" />
        <text x={x + 8} y={56} fontSize={9} fontWeight={600} fill={TEXT}>
          {workspace}
        </text>
        <circle cx={x + 132} cy={52} r={3} fill={STROKE_GREEN} />

        {/* Sidebar */}
        <rect x={x} y={60} width={44} height={104} fill={sidebarBg} stroke="none" />
        {/* Sidebar items */}
        {(['Rules', 'Requests', 'Env'] as const).map((label, i) => {
          const itemY = 68 + i * 18;
          const isActiveSidebar =
            (mode === 'rules' && label === 'Rules') || (mode === 'env' && label === 'Env');
          return (
            <g key={label}>
              {isActiveSidebar && (
                <rect x={x + 2} y={itemY - 6} width={40} height={14} rx={2} fill={activeFill} stroke={activeStroke} />
              )}
              <text x={x + 6} y={itemY + 3} fontSize={8} fontWeight={isActiveSidebar ? 600 : 400} fill={TEXT}>
                {label}
              </text>
            </g>
          );
        })}

        {/* Main content rows */}
        {mode === 'rules' &&
          ['Auth header', 'CORS bypass', 'Block ads'].map((row, i) => {
            const ry = 68 + i * 22;
            return (
              <g key={row}>
                <rect x={x + 50} y={ry - 6} width={92} height={16} rx={2} fill={rowBg} stroke={tabBorder} />
                <circle cx={x + 56} cy={ry + 1} r={2.5} fill={STROKE_GREEN} />
                <text x={x + 62} y={ry + 4} fontSize={8} fill={TEXT}>
                  {row}
                </text>
              </g>
            );
          })}
        {mode === 'env' && (
          <g>
            <text x={x + 50} y={68} fontSize={8} fontWeight={600} fill={TEXT}>
              staging
            </text>
            {['API_HOST', 'API_KEY', 'DEBUG'].map((k, i) => {
              const ry = 84 + i * 16;
              return (
                <g key={k}>
                  <rect x={x + 50} y={ry - 6} width={42} height={12} rx={2} fill={rowBg} stroke={tabBorder} />
                  <text x={x + 53} y={ry + 2} fontFamily="monospace" fontSize={7} fill={TEXT}>
                    {k}
                  </text>
                  <text x={x + 96} y={ry + 2} fontFamily="monospace" fontSize={7} fill={TEXT_DIM}>
                    ●●●●
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Pinned label under tab */}
        <text x={x + 73} y={180} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
          {mode === 'rules' ? 'Rules editor' : 'Env editor'}
        </text>
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Two workspace tabs open side by side — different workspaces or different layouts, working in parallel"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Two tabs, two contexts — at the same time
      </text>

      {renderTab(8, '#1', 'Production', 'rules')}
      {renderTab(166, '#2', 'Staging', 'env')}

      {/* Sync hint between the two tabs */}
      <line
        x1={154}
        y1={104}
        x2={166}
        y2={104}
        stroke={STROKE_GREEN}
        strokeWidth={1}
        strokeDasharray="2 2"
      />

      <text x={160} y={200} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Rules + collections sync through storage.
      </text>
      <text x={160} y={213} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Each tab keeps its own workspace + layout.
      </text>
    </svg>
  );
};

// ─── Navigation reuse: same-window first ──────────────────────────

/**
 * Two stacked browser-window mockups. Top: one window with the popup
 * over an existing workspace tab → click activates that tab. Bottom:
 * caller window has no workspace tab; another window does. New tab
 * opens in the caller's window; the other window is dimmed to make
 * "we never yank focus across windows" visually unambiguous.
 */
export const MultiTabNavigationDiagram: React.FC = () => {
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
        <circle key={i} cx={x + 8 + i * 7} cy={y + 7} r={2.5} fill={dimmed ? dimText : 'var(--ant-color-text-quaternary)'} />
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
      aria-label="Navigation reuse — same-window first. Top: same window has a workspace tab, click activates it. Bottom: only another window has a workspace tab, a new one opens in the caller's window."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Click "edit rule" in the popup —
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        the popup looks for a workspace tab in YOUR window first
      </text>

      {/* ── TOP scenario: warm (same window) ─────────────────── */}
      <text x={26} y={48} fontSize={10} fontWeight={600} fill={TEXT}>
        Same window
      </text>
      <text x={108} y={48} fontSize={9} fill={TEXT_DIM}>
        — already has a workspace tab
      </text>

      <Window x={10} y={54} w={300} h={64} label="Window 1" />
      {/* tab strip area */}
      <rect x={10} y={68} width={300} height={18} fill={tabStripBg} stroke={winBorder} />
      {/* Existing workspace tab — highlighted as the activation target */}
      <rect x={14} y={70} width={120} height={14} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={20} y={80} fontSize={8} fontWeight={600} fill={TEXT}>
        #1 Open Headers
      </text>
      {/* "your other tabs" */}
      <rect x={138} y={70} width={64} height={14} rx={2} fill={dimBg} stroke={dimStroke} />
      <text x={170} y={80} textAnchor="middle" fontSize={8} fill={dimText}>
        gmail
      </text>

      {/* Popup card overlapping the toolbar */}
      <rect x={216} y={72} width={84} height={36} rx={3} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={258} y={84} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT}>
        popup
      </text>
      <text x={258} y={96} textAnchor="middle" fontSize={8} fill={TEXT}>
        edit rule ▸
      </text>

      {/* arrow from popup to existing tab */}
      <path
        d={`M 220 90 Q 160 110 134 84`}
        fill="none"
        stroke={STROKE_GREEN}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />

      <rect x={86} y={124} width={148} height={18} rx={3} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={160} y={136} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        existing tab activates · no new tab
      </text>

      {/* ── BOTTOM scenario: cold (cross-window) ────────────── */}
      <text x={26} y={166} fontSize={10} fontWeight={600} fill={TEXT}>
        Other window
      </text>
      <text x={108} y={166} fontSize={9} fill={TEXT_DIM}>
        — your window has none
      </text>

      {/* Caller window (left) */}
      <Window x={10} y={172} w={146} h={64} label="Window 1 (caller)" />
      <rect x={10} y={186} width={146} height={18} fill={tabStripBg} stroke={winBorder} />
      {/* Caller's existing tab */}
      <rect x={14} y={188} width={64} height={14} rx={2} fill={dimBg} stroke={dimStroke} />
      <text x={46} y={198} textAnchor="middle" fontSize={8} fill={dimText}>
        gmail
      </text>
      {/* NEW tab appears here */}
      <rect x={82} y={188} width={68} height={14} rx={2} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeDasharray="2 2" />
      <text x={116} y={198} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT}>
        + new tab
      </text>
      {/* tiny popup glyph above */}
      <rect x={20} y={210} width={56} height={20} rx={2} fill={FILL_ORANGE} stroke={STROKE_ORANGE} />
      <text x={48} y={222} textAnchor="middle" fontSize={8} fontWeight={600} fill={TEXT}>
        popup
      </text>
      <line x1={76} y1={220} x2={114} y2={204} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* Other window (right, dimmed) */}
      <Window x={164} y={172} w={146} h={64} label="Window 2" dimmed />
      <rect x={164} y={186} width={146} height={18} fill={dimBg} stroke={dimStroke} strokeDasharray="2 2" />
      <rect x={168} y={188} width={120} height={14} rx={2} fill={dimBg} stroke={dimStroke} strokeDasharray="2 2" />
      <text x={228} y={198} textAnchor="middle" fontSize={8} fill={dimText}>
        #1 Open Headers
      </text>
      <text x={237} y={222} textAnchor="middle" fontSize={9} fontStyle="italic" fill={dimText}>
        untouched · no focus steal
      </text>

      <text x={160} y={258} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Same as how Chrome's own DevTools docks per window —
      </text>
      <text x={160} y={271} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        you stay in the window you were already in.
      </text>
    </svg>
  );
};

// ─── Tab numbering: ordinals are stable within a tab's lifetime ───

/**
 * Five Chrome-style tab-strip mockups stacked vertically, each
 * showing the same window after one user action. The point is
 * concrete, not abstract: open three tabs, close the first, open
 * one more — the new one is #4, not #1, because survivors never
 * renumber. Highlight ribbons on the right call out the moment
 * each rule kicks in (prefix appears, prefix sheds, ordinal stays).
 */
export const MultiTabNumberingDiagram: React.FC = () => {
  type Tab = { title: string; closed?: boolean; isNew?: boolean; w?: number };
  type Step = { action: string; tabs: Tab[]; note?: string };
  const STEPS: Step[] = [
    {
      action: '1 tab open',
      tabs: [{ title: 'Open Headers', isNew: true, w: 96 }],
      note: 'no prefix',
    },
    {
      action: 'open another',
      tabs: [{ title: '#1' }, { title: '#2', isNew: true }],
      note: 'prefixes appear',
    },
    {
      action: 'open a third',
      tabs: [{ title: '#1' }, { title: '#2' }, { title: '#3', isNew: true }],
    },
    {
      action: 'close #1',
      tabs: [{ title: '#1', closed: true }, { title: '#2' }, { title: '#3' }],
      note: '#2 #3 unchanged',
    },
    {
      action: 'open one more',
      tabs: [{ title: '#2' }, { title: '#3' }, { title: '#4', isNew: true }],
      note: 'next is #4',
    },
  ];

  const ROW_Y = 30;
  const ROW_H = 22;
  const ROW_GAP = 8;
  const STRIP_X = 78;
  const STRIP_W = 160;
  const TAB_W = 48;
  const TAB_GAP = 4;

  return (
    <svg
      viewBox="0 0 320 200"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Tab numbering timeline — ordinals are stable within a tab's lifetime; closing #1 does not renumber, next tab gets #4"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Ordinals stay stable within a tab's lifetime
      </text>

      {STEPS.map((step, si) => {
        const y = ROW_Y + si * (ROW_H + ROW_GAP);
        return (
          <g key={step.action}>
            {/* Action label (left) */}
            <text x={70} y={y + 14} textAnchor="end" fontSize={9} fontWeight={600} fill={TEXT}>
              {step.action}
            </text>

            {/* Tab strip background */}
            <rect
              x={STRIP_X}
              y={y}
              width={STRIP_W}
              height={ROW_H}
              fill="var(--ant-color-fill-secondary)"
              stroke="var(--ant-color-border)"
            />

            {/* Tabs */}
            {(() => {
              let cursor = STRIP_X + 4;
              return step.tabs.map((tab, ti) => {
                const tw = tab.w ?? TAB_W;
                const tx = cursor;
                cursor += tw + TAB_GAP;
                if (tab.closed) {
                  return (
                    <g key={`${step.action}-${ti}`}>
                      <rect
                        x={tx}
                        y={y + 2}
                        width={tw}
                        height={ROW_H - 4}
                        rx={3}
                        fill="transparent"
                        stroke="var(--ant-color-border-secondary)"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1={tx + 6}
                        y1={y + 6}
                        x2={tx + tw - 6}
                        y2={y + ROW_H - 6}
                        stroke="var(--ant-color-error)"
                        strokeWidth={1.5}
                      />
                      <line
                        x1={tx + tw - 6}
                        y1={y + 6}
                        x2={tx + 6}
                        y2={y + ROW_H - 6}
                        stroke="var(--ant-color-error)"
                        strokeWidth={1.5}
                      />
                    </g>
                  );
                }
                return (
                  <g key={`${step.action}-${ti}`}>
                    <rect
                      x={tx}
                      y={y + 2}
                      width={tw}
                      height={ROW_H - 4}
                      rx={3}
                      fill={tab.isNew ? FILL_GREEN : FILL_BLUE}
                      stroke={tab.isNew ? STROKE_GREEN : STROKE_BLUE}
                    />
                    <text
                      x={tx + tw / 2}
                      y={y + ROW_H / 2 + 3}
                      textAnchor="middle"
                      fontFamily="monospace"
                      fontSize={9}
                      fontWeight={600}
                      fill={TEXT}
                    >
                      {tab.title}
                    </text>
                  </g>
                );
              });
            })()}

            {/* Right-side note */}
            {step.note && (
              <text x={244} y={y + 14} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
                {step.note}
              </text>
            )}
          </g>
        );
      })}

      <text x={160} y={195} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Numbering resets to #1 only after every workspace tab has closed.
      </text>
    </svg>
  );
};

// ─── What syncs vs what's tab-local ───────────────────────────────

export const MultiTabSyncMatrixDiagram: React.FC = () => {
  const dimBg = 'var(--ant-color-fill-quaternary)';
  const dimStroke = STROKE;
  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="What syncs across tabs versus what stays tab-local"
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Syncs across tabs vs. tab-local
      </text>

      {/* LEFT — syncs */}
      <rect x={10} y={26} width={145} height={170} rx={4} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={82} y={44} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_GREEN}>
        ✓ syncs
      </text>
      <text x={82} y={58} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        chrome.storage.local
      </text>
      <line x1={20} y1={68} x2={145} y2={68} stroke={STROKE_GREEN} />
      {[
        'rules',
        'collections',
        'folders',
        'environments',
        'workspace vars',
        'vault',
        'requests',
        'templates',
        'workspace switch',
      ].map((label, i) => (
        <text key={label} x={20} y={86 + i * 13} fontSize={10} fill={TEXT}>
          • {label}
        </text>
      ))}

      {/* RIGHT — tab-local */}
      <rect x={165} y={26} width={145} height={170} rx={4} fill={dimBg} stroke={dimStroke} strokeDasharray="3 2" />
      <text x={237} y={44} textAnchor="middle" fontSize={11} fontWeight={700} fill={TEXT}>
        ✗ tab-local
      </text>
      <text x={237} y={58} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        each tab's own memory
      </text>
      <line x1={175} y1={68} x2={300} y2={68} stroke={dimStroke} />
      <text x={175} y={86} fontSize={10} fontWeight={600} fill={TEXT}>
        Layout / dock state
      </text>
      <text x={175} y={99} fontSize={9} fill={TEXT_DIM}>
        per-workspace, but
      </text>
      <text x={175} y={112} fontSize={9} fill={TEXT_DIM}>
        not live across tabs
      </text>

      <text x={175} y={138} fontSize={10} fontWeight={600} fill={TEXT}>
        Unsaved drafts
      </text>
      <text x={175} y={151} fontSize={9} fill={TEXT_DIM}>
        live in their tab —
      </text>
      <text x={175} y={164} fontSize={9} fill={TEXT_DIM}>
        last-saver wins on
      </text>
      <text x={175} y={177} fontSize={9} fill={TEXT_DIM}>
        the storage write
      </text>

      <text x={160} y={212} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Persisted entities sync; ephemeral UI state stays put.
      </text>
    </svg>
  );
};
