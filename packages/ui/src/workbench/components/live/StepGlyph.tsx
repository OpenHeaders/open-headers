/**
 * A step's state glyph (the workflows redesign, Step states): a ring
 * with a shape of its own per state, so a state never reads by colour
 * alone. The colours are the workflow view's tokens.
 */

import type React from 'react';
import type { StepMarkKind } from './step-mark';

interface GlyphShape {
  ring: React.CSSProperties;
  /** The shape inside the ring — none for an empty ring. */
  path?: { d: string; style: React.CSSProperties };
  /** The shape turns while the step is going. */
  turns?: true;
}

const filled = (color: string): React.CSSProperties => ({ fill: color, stroke: color });
const stroked = (stroke: string): React.CSSProperties => ({ fill: 'none', stroke });

const ACCENT = 'var(--oh-wf-accent)';
const QUIET = 'var(--oh-wf-quiet)';
const ON_FILL = 'var(--oh-wf-on-fill)';
const DASH = 'M5.8 9 h6.4';

const SHAPES: Record<StepMarkKind, GlyphShape> = {
  idle: { ring: stroked('var(--oh-wf-idle)') },
  waiting: { ring: { ...stroked(QUIET), strokeDasharray: '2.2 2.4' } },
  running: {
    ring: stroked('var(--oh-wf-track)'),
    path: { d: 'M9 1.75 A7.25 7.25 0 0 1 16.25 9', style: stroked(ACCENT) },
    turns: true,
  },
  retrying: {
    ring: stroked('var(--oh-wf-track)'),
    path: { d: 'M12.6 9 A3.6 3.6 0 1 1 10.8 5.88 M10.8 3.4 V5.9 H13.3', style: stroked(ACCENT) },
  },
  held: { ring: stroked(ACCENT), path: { d: 'M7.3 6.4 V11.6 M10.7 6.4 V11.6', style: stroked(ACCENT) } },
  open: {
    ring: stroked('var(--oh-wf-open)'),
    path: { d: 'M9 6 a3 3 0 1 0 0.01 0 Z', style: { fill: 'var(--oh-wf-open)', stroke: 'none' } },
  },
  passed: { ring: filled('var(--oh-wf-success)'), path: { d: 'M5.6 9.3 l2.3 2.3 l4.5 -5', style: stroked(ON_FILL) } },
  failed: {
    ring: filled('var(--oh-wf-failure)'),
    path: { d: 'M6.3 6.3 l5.4 5.4 M11.7 6.3 l-5.4 5.4', style: stroked(ON_FILL) },
  },
  'timed-out': { ring: filled('var(--oh-wf-timeout)'), path: { d: 'M9 5.2 V9 l2.6 1.7', style: stroked(ON_FILL) } },
  skipped: { ring: filled(QUIET), path: { d: DASH, style: stroked(ON_FILL) } },
  'not-run': { ring: stroked(QUIET), path: { d: DASH, style: stroked(QUIET) } },
  'cannot-run': {
    ring: filled('var(--oh-wf-blocked)'),
    path: { d: 'M9 5 V9.8 M9 12.5 v0.01', style: stroked(ON_FILL) },
  },
};

/** The colour a state's words wear beside its glyph; a state that says nothing happened stays grey. */
export const STEP_MARK_INK: Record<StepMarkKind, string> = {
  idle: 'var(--oh-wf-text-secondary)',
  waiting: 'var(--oh-wf-text-secondary)',
  running: ACCENT,
  retrying: ACCENT,
  held: ACCENT,
  open: 'var(--oh-wf-open)',
  passed: 'var(--oh-wf-success)',
  failed: 'var(--oh-wf-failure)',
  'timed-out': 'var(--oh-wf-timeout)',
  skipped: 'var(--oh-wf-text-secondary)',
  'not-run': 'var(--oh-wf-text-secondary)',
  'cannot-run': 'var(--oh-wf-blocked)',
};

/** The colour a state gives a mark too small for its shape — its glyph's own. */
export const STEP_MARK_FILL: Record<StepMarkKind, string> = {
  idle: 'var(--oh-wf-idle)',
  waiting: QUIET,
  running: ACCENT,
  retrying: ACCENT,
  held: ACCENT,
  open: 'var(--oh-wf-open)',
  passed: 'var(--oh-wf-success)',
  failed: 'var(--oh-wf-failure)',
  'timed-out': 'var(--oh-wf-timeout)',
  skipped: QUIET,
  'not-run': QUIET,
  'cannot-run': 'var(--oh-wf-blocked)',
};

const StepGlyph: React.FC<{ kind: StepMarkKind; label: string; size?: number }> = ({ kind, label, size = 18 }) => {
  const shape = SHAPES[kind];
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 18 18" style={{ flex: 'none' }}>
      <circle cx="9" cy="9" r="7.25" style={{ strokeWidth: 1.5, ...shape.ring }} />
      {shape.path !== undefined && (
        <path
          className={shape.turns ? 'oh-workflow-glyph-turning' : undefined}
          d={shape.path.d}
          style={{ strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', ...shape.path.style }}
        />
      )}
    </svg>
  );
};

export default StepGlyph;
