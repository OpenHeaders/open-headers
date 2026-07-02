import type React from 'react';
import { ArrowDefs, FILL_BLUE, FILL_GREEN, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';

/**
 * Append — visualises the duplicate-header outcome. Beginners often
 * read "Append" as "concatenate the value." It's actually adding a
 * SECOND header line with the same name — both lines are delivered.
 * The diagram makes the duplication visible: BEFORE has one row,
 * AFTER has two rows with the new one highlighted.
 */
export const AppendDiagram: React.FC = () => {
  const ID = 'ap';
  const RULE_Y = 22;
  const RULE_H = 22;
  const STATE_X = 50;
  const STATE_W = 220;

  const BEFORE_Y = 70;
  const BEFORE_H = 38;
  const ARROW_Y_START = BEFORE_Y + BEFORE_H + 4;
  const ARROW_Y_END = ARROW_Y_START + 22;
  const AFTER_Y = ARROW_Y_END + 4;
  const AFTER_H = 56;
  const STAMP_Y = AFTER_Y + AFTER_H + 22;

  return (
    <svg
      viewBox="0 0 320 240"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Append adds a second header row with the same name — both delivered. BEFORE has one Set-Cookie row; AFTER has two, the new one highlighted."
    >
      <ArrowDefs id={ID} />

      {/* Rule banner */}
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
        Append Set-Cookie: tracking=xyz
      </text>

      {/* BEFORE — full width row */}
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
      <text x={STATE_X + 10} y={BEFORE_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        Set-Cookie: session=abc
      </text>

      {/* Vertical arrow with label aside */}
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
        +1 duplicate row
      </text>

      {/* AFTER — full width, two rows clearly visible */}
      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={AFTER_H} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        AFTER
      </text>
      <text x={STATE_X + 10} y={AFTER_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        Set-Cookie: session=abc
      </text>
      <text x={STATE_X + 10} y={AFTER_Y + 46} fontFamily="monospace" fontSize={10} fontWeight={700} fill={STROKE_GREEN}>
        Set-Cookie: tracking=xyz
      </text>

      {/* Outcome stamps */}
      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        Two Set-Cookie rows — both delivered.
      </text>
      <text x={160} y={STAMP_Y + 14} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        Use for Set-Cookie, Link, Via — headers that allow duplicates.
      </text>
    </svg>
  );
};

/**
 * Append — the duplicate-unfriendly gotcha. Many headers (e.g.
 * Authorization, Host, Content-Type) are spec'd or browser-treated
 * as single-valued, so appending a second row gets coalesced. Two
 * routes out: Override to replace, or Merge to concatenate.
 */
export const AppendWontApplyDiagram: React.FC = () => {
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 140"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="Append won't apply cleanly to headers that don't support duplicates — the browser keeps only one. Use Override to replace or Merge to concatenate."
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        WHEN IT DOESN'T FIRE
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={100}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        Headers that don't allow duplicates
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        e.g. Authorization, Host, Content-Type — browser keeps only one.
      </text>

      <text x={28} y={88} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={88} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        Suggestion
      </text>
      <text x={48} y={102} fontSize={9} fill={TEXT}>
        Use Override to replace the value.
      </text>
      <text x={48} y={116} fontSize={9} fill={TEXT}>
        Use Merge to append to the existing value.
      </text>
    </svg>
  );
};
