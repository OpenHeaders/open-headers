import type React from 'react';
import { ArrowDefs, FILL_BLUE, FILL_GREEN, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';

/**
 * Remove — visualises deletion. The targeted header is shown in
 * BEFORE with a strikethrough decoration and a red tint; AFTER
 * shows only the surviving header. Vertical layout so both cards
 * get full width and the height difference reads as "one fewer
 * row."
 */
export const RemoveDiagram: React.FC = () => {
  const ID = 'rm';
  const errColor = 'var(--ant-color-error)';
  const errBg = 'var(--ant-color-error-bg)';
  const RULE_Y = 22;
  const RULE_H = 22;
  const STATE_X = 50;
  const STATE_W = 220;

  const BEFORE_Y = 70;
  const BEFORE_H = 56;
  const ARROW_Y_START = BEFORE_Y + BEFORE_H + 4;
  const ARROW_Y_END = ARROW_Y_START + 22;
  const AFTER_Y = ARROW_Y_END + 4;
  const AFTER_H = 38;
  const STAMP_Y = AFTER_Y + AFTER_H + 22;

  return (
    <svg
      viewBox="0 0 320 220"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Remove deletes the targeted header. BEFORE shows X-Frame-Options struck through; AFTER shows only the surviving Content-Type header."
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        RULE
      </text>
      <rect x={20} y={RULE_Y} width={280} height={RULE_H} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text
        x={160}
        y={RULE_Y + 15}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        Remove X-Frame-Options
      </text>

      {/* BEFORE — two rows, target highlighted in red with strikethrough */}
      <rect
        x={STATE_X}
        y={BEFORE_Y}
        width={STATE_W}
        height={BEFORE_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={STATE_X + 8} y={BEFORE_Y + 13} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        BEFORE
      </text>
      {/* Targeted row */}
      <rect x={STATE_X + 4} y={BEFORE_Y + 18} width={STATE_W - 8} height={16} rx={2} fill={errBg} />
      <text
        x={STATE_X + 10}
        y={BEFORE_Y + 30}
        fontFamily="monospace"
        fontSize={10}
        fill={errColor}
        textDecoration="line-through"
      >
        X-Frame-Options: DENY
      </text>
      {/* Other row */}
      <text x={STATE_X + 10} y={BEFORE_Y + 48} fontFamily="monospace" fontSize={10} fill={TEXT}>
        Content-Type: text/html
      </text>

      {/* Arrow */}
      <line
        x1={STATE_X + STATE_W / 2}
        y1={ARROW_Y_START}
        x2={STATE_X + STATE_W / 2}
        y2={ARROW_Y_END}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={STATE_X + STATE_W / 2 + 12}
        y={(ARROW_Y_START + ARROW_Y_END) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_BLUE}
      >
        target removed
      </text>

      {/* AFTER — single row */}
      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={AFTER_H} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        AFTER
      </text>
      <text x={STATE_X + 10} y={AFTER_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        Content-Type: text/html
      </text>

      {/* Outcome stamps */}
      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        All instances of X-Frame-Options deleted.
      </text>
      <text x={160} y={STAMP_Y + 14} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Duplicate rows of the same header are all removed at once.
      </text>
    </svg>
  );
};

/**
 * Remove — the "header already absent" gotcha. Not an error, just a
 * no-op. If the user actually wanted to set a different value (and
 * remove implied "replace with empty"), Override is the right tool.
 */
export const RemoveWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 120"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Remove is a no-op when the targeted header isn't present — no error fires. Use Override if you wanted to set a different value instead."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHEN IT DOESN'T FIRE
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={80}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        Header already absent
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        No-op — no error, the request just goes through unchanged.
      </text>

      <text x={28} y={88} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={88} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={102} fontSize={9} fill={TEXT}>
        Use Override if you wanted to set the value, not remove it.
      </text>
    </svg>
  );
};
