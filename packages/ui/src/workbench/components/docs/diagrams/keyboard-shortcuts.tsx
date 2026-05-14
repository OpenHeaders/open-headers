/**
 * Keyboard Shortcuts — diagrams.
 *
 * Hero diagram for the Keyboard Shortcuts reference page. Shows the
 * four shell regions (left sidebar, editor, right sidebar, bottom
 * panel) as a small workbench mockup with the focus-region chord
 * pinned to each region. Reads as a visual map for "where does
 * Alt+N take me?"
 */

import type React from 'react';
import { shortcutLabel } from '../../../hooks/useWorkspaceShortcuts';
import { FILL_BLUE, STROKE, STROKE_BLUE, TEXT, TEXT_DIM } from './_shared';

/**
 * Renders a chord chip with the kbd-key class so it visually
 * matches the keyboard hints used everywhere else (tour, footer,
 * docs pager). Falls back to a placeholder when no chord is bound.
 */
const ChordChip: React.FC<{ chord: string; x: number; y: number }> = ({ chord, x, y }) => {
  const text = chord && chord.length > 0 ? chord : '—';
  // Width scales with chord length; tabular-nums keeps it stable
  // for multi-char chords like ⌥1 vs Alt+1.
  const w = Math.max(28, text.length * 8 + 10);
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - 8}
        width={w}
        height={16}
        rx={3}
        fill="var(--ant-color-bg-container)"
        stroke="var(--ant-color-border)"
      />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontFamily="-apple-system, 'Segoe UI', monospace"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        {text}
      </text>
    </g>
  );
};

export const KeyboardRegionsDiagram: React.FC = () => {
  // Chord labels resolve from settings at render time so a rebound
  // shortcut updates the diagram automatically.
  const leftChord = shortcutLabel('focus-left-sidebar');
  const editorChord = shortcutLabel('focus-editor');
  const rightChord = shortcutLabel('focus-right-sidebar');
  const bottomChord = shortcutLabel('focus-bottom-panel');

  // Workbench mockup geometry
  const WB_X = 10;
  const WB_Y = 30;
  const WB_W = 300;
  const WB_H = 180;

  const TITLE_H = 16;
  const LEFT_W = 70;
  const RIGHT_W = 70;
  const BOTTOM_H = 40;

  const editorX = WB_X + LEFT_W + 1;
  const editorY = WB_Y + TITLE_H;
  const editorW = WB_W - LEFT_W - RIGHT_W - 2;
  const editorH = WB_H - TITLE_H - BOTTOM_H;

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Workbench focus regions — left sidebar, editor, right sidebar, and bottom panel — each labeled with its focus-shortcut chord."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Focus chords land you in one of four regions
      </text>

      {/* Workbench frame */}
      <rect x={WB_X} y={WB_Y} width={WB_W} height={WB_H} rx={6} fill="var(--ant-color-bg-container)" stroke={STROKE} />

      {/* Title bar */}
      <rect
        x={WB_X}
        y={WB_Y}
        width={WB_W}
        height={TITLE_H}
        rx={6}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE}
      />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={WB_X + 8 + i * 7} cy={WB_Y + TITLE_H / 2} r={2.5} fill={TEXT_DIM} />
      ))}
      <text
        x={WB_X + WB_W / 2}
        y={WB_Y + TITLE_H / 2 + 3}
        textAnchor="middle"
        fontSize={8}
        fontWeight={600}
        fill={TEXT_DIM}
      >
        Open Headers — Workbench
      </text>

      {/* Left sidebar */}
      <rect
        x={WB_X}
        y={WB_Y + TITLE_H}
        width={LEFT_W}
        height={WB_H - TITLE_H}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
      />
      <text x={WB_X + LEFT_W / 2} y={WB_Y + TITLE_H + 14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Left sidebar
      </text>
      <ChordChip chord={leftChord} x={WB_X + LEFT_W / 2} y={WB_Y + 56} />

      {/* Editor */}
      <rect x={editorX} y={editorY} width={editorW} height={editorH} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={editorX + editorW / 2} y={editorY + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        Editor
      </text>
      <ChordChip chord={editorChord} x={editorX + editorW / 2} y={editorY + 56} />

      {/* Right pane */}
      <rect
        x={editorX + editorW + 1}
        y={WB_Y + TITLE_H}
        width={RIGHT_W}
        height={WB_H - TITLE_H}
        fill="var(--ant-color-fill-quaternary)"
        stroke={STROKE}
      />
      <text
        x={editorX + editorW + 1 + RIGHT_W / 2}
        y={WB_Y + TITLE_H + 14}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        Right sidebar
      </text>
      <ChordChip chord={rightChord} x={editorX + editorW + 1 + RIGHT_W / 2} y={WB_Y + 56} />

      {/* Bottom panel */}
      <rect
        x={WB_X}
        y={WB_Y + WB_H - BOTTOM_H}
        width={WB_W}
        height={BOTTOM_H}
        fill="var(--ant-color-fill-secondary)"
        stroke={STROKE}
      />
      <text
        x={WB_X + WB_W / 2}
        y={WB_Y + WB_H - BOTTOM_H + 12}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={TEXT}
      >
        Bottom panel
      </text>
      <ChordChip chord={bottomChord} x={WB_X + WB_W / 2} y={WB_Y + WB_H - BOTTOM_H + 28} />

      <text x={160} y={232} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Rebind any chord in Settings → Keyboard.
      </text>
    </svg>
  );
};
