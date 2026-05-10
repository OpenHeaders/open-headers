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
  Box,
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

export const MultiTabNavigationDiagram: React.FC = () => {
  const ID = 'mt-nav';
  return (
    <svg
      viewBox="0 0 320 280"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Navigation reuse — same-window first. If a workspace tab exists in the caller's window, activate it; otherwise open a new tab in the caller's window."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Same-window first
      </text>
      <text x={160} y={26} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        intent: "edit rule" from popup
      </text>

      {/* Vertical separator between scenarios */}
      <line x1={160} y1={36} x2={160} y2={252} stroke="var(--ant-color-border-secondary)" strokeDasharray="2 4" />

      {/* ── LEFT: warm path (same window) ─────────────────────── */}
      <text x={80} y={48} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>
        Warm
      </text>
      <text x={80} y={60} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        tab in caller window
      </text>

      {/* Window 1 frame */}
      <rect
        x={10}
        y={70}
        width={140}
        height={150}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
      />
      <text x={20} y={84} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Window 1
      </text>
      <Box x={20} y={92} w={56} h={26} fill={FILL_ORANGE} stroke={STROKE_ORANGE} label="popup" />
      <Box x={84} y={92} w={56} h={26} fill={FILL_GREEN} stroke={STROKE_GREEN} label="workspace" />
      {/* arrow popup → workspace */}
      <line x1={76} y1={105} x2={84} y2={105} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />

      {/* result */}
      <text x={80} y={146} textAnchor="middle" fontSize={9} fill={TEXT}>
        activate +
      </text>
      <text x={80} y={158} textAnchor="middle" fontSize={9} fill={TEXT}>
        sendMessage
      </text>
      <text x={80} y={180} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        no new tab opened
      </text>

      <rect x={30} y={196} width={100} height={18} rx={3} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={80} y={208} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        warm path
      </text>

      {/* ── RIGHT: cold path (cross-window) ────────────────────── */}
      <text x={240} y={48} textAnchor="middle" fontSize={11} fontWeight={600} fill={TEXT}>
        Cold
      </text>
      <text x={240} y={60} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        tab only in other window
      </text>

      {/* Window 1 (caller, no workspace) */}
      <rect
        x={170}
        y={70}
        width={140}
        height={70}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
      />
      <text x={180} y={84} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Window 1
      </text>
      <Box x={180} y={92} w={56} h={26} fill={FILL_ORANGE} stroke={STROKE_ORANGE} label="popup" />
      {/* New tab arrow into Window 1 */}
      <line x1={244} y1={105} x2={290} y2={105} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <rect x={244} y={94} width={50} height={22} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} strokeDasharray="2 2" />
      <text x={269} y={108} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        new tab
      </text>

      {/* Window 2 (has workspace, untouched) */}
      <rect
        x={170}
        y={148}
        width={140}
        height={50}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
      />
      <text x={180} y={162} fontSize={9} fontWeight={600} fill={TEXT_DIM}>
        Window 2
      </text>
      <Box x={180} y={168} w={70} h={22} fill={FILL_GREEN} stroke={STROKE_GREEN} label="workspace" />
      <text x={290} y={181} textAnchor="end" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        untouched
      </text>

      <rect x={190} y={206} width={100} height={18} rx={3} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={240} y={218} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        cold path
      </text>

      <text x={160} y={266} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Never yanks focus across Chrome windows.
      </text>
    </svg>
  );
};

// ─── Tab numbering: ordinals are stable within a tab's lifetime ───

export const MultiTabNumberingDiagram: React.FC = () => {
  type Frame = {
    label: string;
    titles: string[]; // empty string = closed slot for spacing alignment
  };
  const FRAMES: Frame[] = [
    { label: '1 tab', titles: ['Open Headers'] },
    { label: 'open 2nd', titles: ['#1 Open Headers', '#2 Open Headers'] },
    { label: 'open 3rd', titles: ['#1 Open Headers', '#2 Open Headers', '#3 Open Headers'] },
    { label: 'close #1', titles: ['', '#2 Open Headers', '#3 Open Headers'] },
    { label: 'open new', titles: ['', '#2 Open Headers', '#3 Open Headers', '#4 Open Headers'] },
  ];

  const FRAME_W = 60;
  const ROW_H = 16;

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

      {FRAMES.map((frame, fi) => {
        const x = 10 + fi * FRAME_W;
        return (
          <g key={frame.label}>
            <text x={x + FRAME_W / 2} y={32} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT_DIM}>
              {frame.label}
            </text>
            {frame.titles.map((title, ti) => {
              const y = 42 + ti * (ROW_H + 4);
              if (title === '') {
                // closed slot — show a faint X
                return (
                  <g key={`${frame.label}-${ti}`}>
                    <rect
                      x={x + 4}
                      y={y}
                      width={FRAME_W - 8}
                      height={ROW_H}
                      rx={2}
                      fill="transparent"
                      stroke="var(--ant-color-border-secondary)"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={x + FRAME_W / 2}
                      y={y + ROW_H - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--ant-color-text-quaternary)"
                    >
                      closed
                    </text>
                  </g>
                );
              }
              const isNew = fi === 4 && ti === 3;
              const isPrefixed = title.startsWith('#');
              return (
                <g key={`${frame.label}-${ti}`}>
                  <rect
                    x={x + 4}
                    y={y}
                    width={FRAME_W - 8}
                    height={ROW_H}
                    rx={2}
                    fill={isNew ? FILL_GREEN : isPrefixed ? FILL_BLUE : 'var(--ant-color-fill-secondary)'}
                    stroke={isNew ? STROKE_GREEN : isPrefixed ? STROKE_BLUE : STROKE}
                  />
                  <text
                    x={x + FRAME_W / 2}
                    y={y + ROW_H - 4}
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontSize={8}
                    fill={TEXT}
                  >
                    {title}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Annotation arrow under "close #1" frame */}
      <text x={200} y={150} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        survivors keep their numbers
      </text>
      <text x={250} y={170} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        next opens at #4, not #1
      </text>
      <text x={160} y={190} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
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
