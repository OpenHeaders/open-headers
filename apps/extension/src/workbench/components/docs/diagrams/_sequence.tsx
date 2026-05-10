/**
 * UML-style sequence diagram primitives. Used by any diagram that
 * needs to convey "actor A talks to actor B over time" — participant
 * boxes at the top, vertical dashed lifelines below, horizontal
 * messages between lanes, activation bars on busy lifelines, and a
 * "later" gap separator for time discontinuities.
 *
 * All colors resolve to Ant theme CSS variables, so the rendering
 * follows the active light / dark theme without duplication.
 */

import type React from 'react';

export const SEQ_TEXT = 'var(--ant-color-text)';
export const SEQ_DIM = 'var(--ant-color-text-tertiary)';
export const SEQ_LIFELINE = 'var(--ant-color-text-quaternary)';
export const SEQ_MSG = 'var(--ant-color-text-secondary)';
export const SEQ_PARTICIPANT_BG = 'var(--ant-color-fill-secondary)';
export const SEQ_PARTICIPANT_BORDER = 'var(--ant-color-border)';
export const SEQ_ACTIVATION_FILL = 'var(--ant-color-primary-bg)';
export const SEQ_ACTIVATION_STROKE = 'var(--ant-color-primary-border)';

export function SeqArrowDefs({ id }: { id: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={SEQ_MSG} />
      </marker>
    </defs>
  );
}

export function SeqParticipant({ x, label, sub }: { x: number; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x - 38} y={6} width={76} height={32} rx={4} fill={SEQ_PARTICIPANT_BG} stroke={SEQ_PARTICIPANT_BORDER} />
      <text x={x} y={20} textAnchor="middle" fontSize={11} fontWeight={600} fill={SEQ_TEXT}>
        {label}
      </text>
      {sub && (
        <text x={x} y={32} textAnchor="middle" fontSize={9} fill={SEQ_DIM}>
          {sub}
        </text>
      )}
    </g>
  );
}

export function SeqLifeline({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <line x1={x} y1={y1} x2={x} y2={y2} stroke={SEQ_LIFELINE} strokeWidth={1} strokeDasharray="3 3" />;
}

export function SeqMessage({
  fromX,
  toX,
  y,
  label,
  dashed,
  marker,
}: {
  fromX: number;
  toX: number;
  y: number;
  label: string;
  dashed?: boolean;
  marker: string;
}) {
  const cx = (fromX + toX) / 2;
  const startX = fromX < toX ? fromX + 4 : fromX - 4;
  const endX = fromX < toX ? toX - 4 : toX + 4;
  return (
    <g>
      <text x={cx} y={y - 4} textAnchor="middle" fontSize={9} fill={SEQ_MSG}>
        {label}
      </text>
      <line
        x1={startX}
        y1={y}
        x2={endX}
        y2={y}
        stroke={SEQ_MSG}
        strokeWidth={1.25}
        strokeDasharray={dashed ? '3 2' : undefined}
        markerEnd={`url(#${marker})`}
      />
    </g>
  );
}

export function SeqActivation({ x, y, height }: { x: number; y: number; height: number }) {
  return <rect x={x - 4} y={y} width={8} height={height} fill={SEQ_ACTIVATION_FILL} stroke={SEQ_ACTIVATION_STROKE} />;
}

export function SeqLaterGap({ y, label = 'later' }: { y: number; label?: string }) {
  return (
    <g>
      <line x1={20} y1={y} x2={300} y2={y} stroke={SEQ_LIFELINE} strokeDasharray="2 4" />
      <rect
        x={144}
        y={y - 7}
        width={32}
        height={14}
        rx={3}
        fill="var(--ant-color-bg-container)"
        stroke={SEQ_LIFELINE}
      />
      <text x={160} y={y + 3} textAnchor="middle" fontSize={9} fill={SEQ_DIM}>
        {label}
      </text>
    </g>
  );
}
