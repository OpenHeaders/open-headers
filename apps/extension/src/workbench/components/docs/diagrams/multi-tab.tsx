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
 *   • MultiTabSyncedDiagram + MultiTabLocalDiagram — paired view
 *     of "what syncs" (storage pool with both tabs reading from it)
 *     vs "what stays" (two visibly-different tab states with a wall
 *     between them).
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

// ─── What syncs across tabs (shared storage pool) ────────────────

/**
 * "Shared pool" metaphor: chrome.storage at the top holds every
 * persisted entity as a pill. Both tabs sit below and read/write
 * through bidirectional arrows. Visual hook: there's ONE pool, every
 * tab is a window into it. Save in any tab → ripples to all.
 */
export const MultiTabSyncedDiagram: React.FC = () => {
  const ID = 'mt-synced';
  // Three rows of pills, sized to fit the storage pool.
  const ROW1 = ['rules', 'collections', 'folders'];
  const ROW2 = ['environments', 'variables', 'vault'];
  const ROW3 = ['requests', 'templates'];
  const PILL_H = 18;
  const PILL_GAP = 6;
  const PILL_PAD = 9;
  const charW = 5.5;
  const widthOf = (s: string) => Math.ceil(s.length * charW) + PILL_PAD * 2;

  const rowWidth = (row: string[]) =>
    row.reduce((sum, s) => sum + widthOf(s), 0) + PILL_GAP * (row.length - 1);

  const renderRow = (row: string[], y: number) => {
    const total = rowWidth(row);
    let x = 160 - total / 2;
    return row.map((s) => {
      const w = widthOf(s);
      const node = (
        <g key={`${y}-${s}`}>
          <rect x={x} y={y} width={w} height={PILL_H} rx={9} fill={FILL_GREEN} stroke={STROKE_GREEN} />
          <text x={x + w / 2} y={y + PILL_H / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
            {s}
          </text>
        </g>
      );
      x += w + PILL_GAP;
      return node;
    });
  };

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="What syncs across tabs — chrome.storage holds rules, collections, folders, environments, variables, vault, requests, templates. Both tabs read and write through it."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill={STROKE_GREEN}>
        ✓ Syncs across tabs
      </text>
      <text x={160} y={28} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        every tab reads and writes the same chrome.storage
      </text>

      {/* Storage pool */}
      <rect
        x={20}
        y={36}
        width={280}
        height={108}
        rx={6}
        fill="var(--ant-color-success-bg)"
        stroke={STROKE_GREEN}
      />
      <text x={32} y={51} fontSize={9} fontWeight={700} fill={STROKE_GREEN}>
        chrome.storage.local
      </text>
      <text x={300} y={51} textAnchor="end" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        single source of truth
      </text>

      {renderRow(ROW1, 60)}
      {renderRow(ROW2, 60 + PILL_H + PILL_GAP)}
      {renderRow(ROW3, 60 + (PILL_H + PILL_GAP) * 2)}

      {/* Two tabs below — both pulling from the pool */}
      <rect x={40} y={170} width={100} height={42} rx={4} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} />
      <rect x={40} y={170} width={100} height={14} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={48} y={180} fontSize={9} fontWeight={700} fill={TEXT}>
        Tab #1
      </text>
      <text x={90} y={201} textAnchor="middle" fontSize={9} fill={TEXT}>
        live data
      </text>

      <rect x={180} y={170} width={100} height={42} rx={4} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} />
      <rect x={180} y={170} width={100} height={14} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={188} y={180} fontSize={9} fontWeight={700} fill={TEXT}>
        Tab #2
      </text>
      <text x={230} y={201} textAnchor="middle" fontSize={9} fill={TEXT}>
        live data
      </text>

      {/* Bidirectional arrows from each tab to the pool */}
      <line x1={70} y1={170} x2={70} y2={146} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line x1={110} y1={146} x2={110} y2={170} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <line x1={210} y1={170} x2={210} y2={146} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <line x1={250} y1={146} x2={250} y2={170} stroke={STROKE_GREEN} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      <text x={160} y={228} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Save in either tab — the other re-hydrates instantly.
      </text>
    </svg>
  );
};

// ─── What stays in each tab (private to that tab) ────────────────

/**
 * Two tab cards side-by-side with visibly DIFFERENT internal states:
 * different sidebar widths and different draft contents. A single
 * dashed wall with one ✗ badge sits between them. The whole point is
 * "look how different these two tabs are right now — and that's
 * fine, because each keeps its own UI state."
 */
export const MultiTabLocalDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  const errBg = 'var(--ant-color-error-bg)';
  const winBorder = 'var(--ant-color-border)';
  const winBg = 'var(--ant-color-bg-container)';
  const sidebarFill = 'var(--ant-color-fill-quaternary)';
  const mainFill = 'var(--ant-color-fill-tertiary)';

  // Layout constants
  const TAB_Y = 44;
  const TAB_W = 132;
  const TAB_H = 158;
  const TITLE_H = 18;

  /** Section label (small text) above a sub-area inside the tab. */
  const SectionLabel = ({ x, y, text }: { x: number; y: number; text: string }) => (
    <text x={x} y={y} fontSize={8} fontWeight={600} fill={TEXT_DIM} letterSpacing={0.4}>
      {text.toUpperCase()}
    </text>
  );

  type Draft = { text: string; unsaved: boolean };
  const renderTab = (xOff: number, ordinal: string, sidebarRatio: number, draft: Draft) => {
    const innerX = xOff + 10;
    const innerW = TAB_W - 20;

    // Layout panel
    const layoutLabelY = TAB_Y + TITLE_H + 12;
    const layoutY = layoutLabelY + 4;
    const layoutH = 60;
    const sidebarW = Math.round(innerW * sidebarRatio);
    // Some fake "rows" inside main panel to imply content.
    const fakeRows = [0.55, 0.7, 0.4, 0.6];

    // Draft area
    const draftLabelY = layoutY + layoutH + 24;
    const draftY = draftLabelY + 4;
    const draftH = 28;

    return (
      <g>
        {/* tab card */}
        <rect x={xOff} y={TAB_Y} width={TAB_W} height={TAB_H} rx={4} fill={winBg} stroke={winBorder} />
        {/* title bar */}
        <rect x={xOff} y={TAB_Y} width={TAB_W} height={TITLE_H} fill={FILL_BLUE} stroke={STROKE_BLUE} />
        <circle cx={xOff + 8} cy={TAB_Y + 9} r={2.5} fill={STROKE_BLUE} />
        <text x={xOff + 18} y={TAB_Y + 12} fontSize={10} fontWeight={700} fill={TEXT}>
          Tab {ordinal}
        </text>

        {/* LAYOUT */}
        <SectionLabel x={innerX} y={layoutLabelY} text="layout" />
        <rect x={innerX} y={layoutY} width={sidebarW} height={layoutH} fill={sidebarFill} stroke={winBorder} />
        <rect
          x={innerX + sidebarW}
          y={layoutY}
          width={innerW - sidebarW}
          height={layoutH}
          fill={mainFill}
          stroke={winBorder}
        />
        {/* sidebar items (3 stripes) */}
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={innerX + 4}
            y={layoutY + 6 + i * 12}
            width={sidebarW - 8}
            height={6}
            rx={1}
            fill="var(--ant-color-fill-secondary)"
          />
        ))}
        {/* main content rows */}
        {fakeRows.map((ratio, i) => {
          const rowX = innerX + sidebarW + 4;
          const rowMaxW = innerW - sidebarW - 8;
          return (
            <rect
              key={i}
              x={rowX}
              y={layoutY + 6 + i * 12}
              width={Math.max(8, rowMaxW * ratio)}
              height={6}
              rx={1}
              fill="var(--ant-color-fill-secondary)"
            />
          );
        })}
        {/* splitter handle — orange tab in the middle */}
        <rect
          x={innerX + sidebarW - 1}
          y={layoutY + layoutH / 2 - 6}
          width={3}
          height={12}
          rx={1.5}
          fill={STROKE_ORANGE}
        />
        {/* small ratio label below the layout */}
        <text x={xOff + TAB_W / 2} y={layoutY + layoutH + 11} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
          {`${Math.round(sidebarRatio * 100)} / ${100 - Math.round(sidebarRatio * 100)}`}
        </text>

        {/* DRAFT */}
        <SectionLabel x={innerX} y={draftLabelY} text="unsaved draft" />
        <rect x={innerX} y={draftY} width={innerW} height={draftH} rx={3} fill={mainFill} stroke={winBorder} />
        {draft.unsaved ? (
          <>
            <text x={innerX + 6} y={draftY + 13} fontFamily="monospace" fontSize={9} fill={TEXT}>
              {draft.text}
            </text>
            <rect
              x={innerX + 6}
              y={draftY + draftH - 12}
              width={48}
              height={9}
              rx={4.5}
              fill={FILL_ORANGE}
              stroke={STROKE_ORANGE}
            />
            <text
              x={innerX + 30}
              y={draftY + draftH - 4}
              textAnchor="middle"
              fontSize={7}
              fontWeight={700}
              fill={STROKE_ORANGE}
            >
              ● unsaved
            </text>
          </>
        ) : (
          <text
            x={innerX + innerW / 2}
            y={draftY + draftH / 2 + 3}
            textAnchor="middle"
            fontSize={9}
            fontStyle="italic"
            fill={TEXT_DIM}
          >
            no unsaved changes
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="What stays in each tab — layout splitter ratio and unsaved drafts. Two tabs visibly differ: 25/75 vs 65/35 splits, one with a draft and one without."
    >
      {/* Header */}
      <text x={160} y={16} textAnchor="middle" fontSize={11} fontWeight={700} fill={errColor}>
        ✗ Stays in each tab
      </text>
      <text x={160} y={32} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        splitter ratio + unsaved typing — private to where you did them
      </text>

      {/* Tab cards */}
      {renderTab(10, '#1', 0.25, { text: 'X-Auth: foo|', unsaved: true })}
      {renderTab(178, '#2', 0.65, { text: '', unsaved: false })}

      {/* Wall between */}
      <line
        x1={160}
        y1={TAB_Y + 4}
        x2={160}
        y2={TAB_Y + TAB_H - 4}
        stroke={errBorder}
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <circle cx={160} cy={TAB_Y + TAB_H / 2} r={10} fill={errBg} stroke={errBorder} />
      <line
        x1={156}
        y1={TAB_Y + TAB_H / 2 - 4}
        x2={164}
        y2={TAB_Y + TAB_H / 2 + 4}
        stroke={errColor}
        strokeWidth={1.8}
      />
      <line
        x1={164}
        y1={TAB_Y + TAB_H / 2 - 4}
        x2={156}
        y2={TAB_Y + TAB_H / 2 + 4}
        stroke={errColor}
        strokeWidth={1.8}
      />

      <text x={160} y={216} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Each tab keeps its own splitter + draft.
      </text>
      <text x={160} y={228} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        A tab opened AFTER your drag inherits the new layout.
      </text>
    </svg>
  );
};
