import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_PURPLE, STROKE_BLUE, STROKE_PURPLE, TEXT, TEXT_DIM } from '../_shared';

/**
 * Merge — script-based concatenation. The existing value is kept
 * and the rule's value is appended after a separator (default `; `
 * for Cookie, `, ` otherwise). Purple palette since it runs through
 * the script engine, not DNR. The separator is highlighted between
 * the two values so the "concatenation" story is unambiguous.
 */
export const MergeDiagram: React.FC = () => {
  const t = useT();
  const ID = 'mg';
  const RULE_Y = 22;
  const RULE_H = 22;
  const STATE_X = 50;
  const STATE_W = 220;

  const BEFORE_Y = 70;
  const BEFORE_H = 38;
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
      aria-label={t('workbench.docs.diagrams.headerActions.merge.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.ruleKicker')}
      </text>
      <rect x={20} y={RULE_Y} width={280} height={RULE_H} rx={4} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text
        x={160}
        y={RULE_Y + 15}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={10}
        fontWeight={700}
        fill={TEXT}
      >
        {t('workbench.docs.diagrams.headerActions.merge.rule')}
      </text>

      {/* BEFORE */}
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
        {t('workbench.docs.diagrams.headerActions.shared.beforeKicker')}
      </text>
      <text x={STATE_X + 10} y={BEFORE_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.merge.lineSession')}
      </text>

      {/* Arrow */}
      <line
        x1={STATE_X + STATE_W / 2}
        y1={ARROW_Y_START}
        x2={STATE_X + STATE_W / 2}
        y2={ARROW_Y_END}
        stroke={STROKE_PURPLE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text
        x={STATE_X + STATE_W / 2 + 12}
        y={(ARROW_Y_START + ARROW_Y_END) / 2 + 3}
        fontSize={9}
        fontStyle="italic"
        fill={STROKE_PURPLE}
      >
        {t('workbench.docs.diagrams.headerActions.merge.arrowLabel')}
      </text>

      {/* AFTER — concatenated value with separator highlighted */}
      <rect x={STATE_X} y={AFTER_Y} width={STATE_W} height={AFTER_H} rx={5} fill={FILL_PURPLE} stroke={STROKE_PURPLE} />
      <text x={STATE_X + 8} y={AFTER_Y + 13} fontSize={8} fontWeight={700} fill={STROKE_PURPLE} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.afterKicker')}
      </text>
      <text x={STATE_X + 10} y={AFTER_Y + 30} fontFamily="monospace" fontSize={10} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.merge.lineSession')}
        <tspan fontWeight={700} fill={STROKE_PURPLE}>
          {'; '}
        </tspan>
        <tspan fontWeight={700} fill={STROKE_PURPLE}>
          {t('workbench.docs.diagrams.headerActions.merge.afterNew')}
        </tspan>
      </text>

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.merge.stamp1')}
      </text>
      <text x={160} y={STAMP_Y + 14} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.headerActions.merge.stamp2')}
      </text>
    </svg>
  );
};

/**
 * Merge — scope gotchas. Two reasons it can silently no-op (only
 * fetch/XHR are intercepted) plus the workarounds. Distinct enough
 * to deserve its own diagram instead of cramming with the
 * DevTools-visibility callout.
 */
export const MergeWontApplyDiagram: React.FC = () => {
  const t = useT();
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 156"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.headerActions.merge.wontAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.wontFireKicker')}
      </text>

      <rect
        x={14}
        y={26}
        width={292}
        height={116}
        rx={5}
        fill="var(--ant-color-error-bg)"
        stroke={errBorder}
        strokeDasharray="3 3"
      />

      {/* Row 1 */}
      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.merge.wontTitle1')}
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.headerActions.merge.wontDetail1')}
      </text>

      {/* Row 2 */}
      <text x={28} y={84} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={84} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.merge.wontTitle2')}
      </text>
      <text x={48} y={98} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.headerActions.merge.wontDetail2')}
      </text>

      {/* Suggestion */}
      <text x={28} y={124} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={124} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.headerActions.shared.suggestion')}
      </text>
      <text x={48} y={138} fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.merge.wontSuggestion')}
      </text>
    </svg>
  );
};
