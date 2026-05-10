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

// ─── Overview: storage broadcast ──────────────────────────────────

export const MultiTabSyncDiagram: React.FC = () => {
  const ID = 'mt-sync';
  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Multi-tab data sync — Tab A saves to chrome.storage, the SW broadcasts, Tab B re-hydrates. Layout state stays per-tab."
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        Saves broadcast through chrome.storage
      </text>

      {/* Lifeline headers */}
      <Box x={10} y={26} w={80} h={28} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Tab A" sub="editor" />
      <Box x={120} y={26} w={80} h={28} fill={FILL_GREEN} stroke={STROKE_GREEN} label="chrome.storage" sub="local" />
      <Box x={230} y={26} w={80} h={28} fill={FILL_BLUE} stroke={STROKE_BLUE} label="Tab B" sub="editor" />

      {/* Lifelines */}
      <line x1={50} y1={54} x2={50} y2={210} stroke={STROKE} strokeDasharray="2 2" />
      <line x1={160} y1={54} x2={160} y2={210} stroke={STROKE} strokeDasharray="2 2" />
      <line x1={270} y1={54} x2={270} y2={210} stroke={STROKE} strokeDasharray="2 2" />

      {/* 1: save */}
      <line x1={50} y1={76} x2={158} y2={76} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={104} y={72} textAnchor="middle" fontSize={9} fill={TEXT}>
        save rule
      </text>

      {/* activation bar on storage */}
      <rect x={156} y={76} width={8} height={36} fill={FILL_GREEN} stroke={STROKE_GREEN} />

      {/* 2: ack */}
      <line
        x1={158}
        y1={104}
        x2={52}
        y2={104}
        stroke={STROKE}
        strokeWidth={1}
        strokeDasharray="3 2"
        markerEnd={`url(#${ID})`}
      />
      <text x={104} y={100} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        write OK
      </text>

      {/* 3: broadcast to Tab B */}
      <line x1={164} y1={138} x2={268} y2={138} stroke={STROKE} strokeWidth={1.5} markerEnd={`url(#${ID})`} />
      <text x={216} y={134} textAnchor="middle" fontSize={9} fill={TEXT}>
        broadcast
      </text>

      {/* activation bar on Tab B */}
      <rect x={266} y={138} width={8} height={36} fill={FILL_BLUE} stroke={STROKE_BLUE} />

      <text x={216} y={166} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        re-hydrate
      </text>

      {/* Per-tab layout boxes — off-lifeline, dashed */}
      <rect
        x={12}
        y={188}
        width={76}
        height={24}
        rx={3}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE}
        strokeDasharray="3 2"
      />
      <text x={50} y={203} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        layout (A)
      </text>

      <rect
        x={232}
        y={188}
        width={76}
        height={24}
        rx={3}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE}
        strokeDasharray="3 2"
      />
      <text x={270} y={203} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        layout (B)
      </text>

      <text x={160} y={232} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Entities sync through storage; layout stays
      </text>
      <text x={160} y={245} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        in each tab's memory.
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
