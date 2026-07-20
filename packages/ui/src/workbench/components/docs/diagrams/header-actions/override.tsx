import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_BLUE, FILL_GREEN, STROKE_BLUE, STROKE_GREEN, TEXT, TEXT_DIM } from '../_shared';

/**
 * Add / Replace ("Override") — scenarios diagram. Shows the rule
 * applied to two starting states (header present vs. absent) and
 * how both converge to the same outcome. Generous vertical spacing
 * — labels never overlap the rule banner or the colored cards.
 */
export const OverrideDiagram: React.FC = () => {
  const t = useT();
  const ID = 'ov';

  const TILE_W = 138;
  const TILE_LEFT_X = 14;
  const TILE_RIGHT_X = 168;

  const STATE_H = 50;
  const RULE_Y = 22;
  const RULE_H = 22;
  const SCENARIO_LABEL_Y = 64;
  const SCENARIO_SUB_Y = 78;
  const BEFORE_Y = 92;
  const ARROW_LABEL_Y = BEFORE_Y + STATE_H + 16;
  const AFTER_Y = ARROW_LABEL_Y + 10;
  const STAMP_Y = AFTER_Y + STATE_H + 22;

  const renderTile = (
    xOff: number,
    label: string,
    sub: string,
    before: { line: string; matched: boolean }[],
    after: { line: string; highlight: boolean }[],
    arrowLabel: string,
    extraBeforeLine?: string,
  ) => (
    <g>
      <text
        x={xOff + TILE_W / 2}
        y={SCENARIO_LABEL_Y}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={STROKE_BLUE}
      >
        {label}
      </text>
      <text
        x={xOff + TILE_W / 2}
        y={SCENARIO_SUB_Y}
        textAnchor="middle"
        fontSize={9}
        fontStyle="italic"
        fill={TEXT_DIM}
      >
        {sub}
      </text>

      <rect
        x={xOff}
        y={BEFORE_Y}
        width={TILE_W}
        height={STATE_H}
        rx={5}
        fill="var(--ant-color-fill-secondary)"
        stroke="var(--ant-color-border)"
      />
      <text x={xOff + 6} y={BEFORE_Y + 12} fontSize={8} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.beforeKicker')}
      </text>
      {before.map((h, i) => (
        <text
          key={`b-${i}`}
          x={xOff + 8}
          y={BEFORE_Y + 26 + i * 12}
          fontFamily="monospace"
          fontSize={9}
          fill={h.matched ? STROKE_BLUE : TEXT}
          fontWeight={h.matched ? 700 : 400}
        >
          {h.line}
        </text>
      ))}
      {extraBeforeLine && (
        <text
          x={xOff + 8}
          y={BEFORE_Y + 26 + before.length * 12}
          fontFamily="monospace"
          fontSize={9}
          fontStyle="italic"
          fill={TEXT_DIM}
        >
          {extraBeforeLine}
        </text>
      )}

      <line
        x1={xOff + TILE_W / 2}
        y1={BEFORE_Y + STATE_H + 2}
        x2={xOff + TILE_W / 2}
        y2={AFTER_Y - 2}
        stroke={STROKE_BLUE}
        strokeWidth={1.5}
        markerEnd={`url(#${ID})`}
      />
      <text x={xOff + TILE_W / 2 + 8} y={ARROW_LABEL_Y - 2} fontSize={8} fontStyle="italic" fill={STROKE_BLUE}>
        {arrowLabel}
      </text>

      <rect x={xOff} y={AFTER_Y} width={TILE_W} height={STATE_H} rx={5} fill={FILL_GREEN} stroke={STROKE_GREEN} />
      <text x={xOff + 6} y={AFTER_Y + 12} fontSize={8} fontWeight={700} fill={STROKE_GREEN} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.afterKicker')}
      </text>
      {after.map((h, i) => (
        <text
          key={`a-${i}`}
          x={xOff + 8}
          y={AFTER_Y + 26 + i * 12}
          fontFamily="monospace"
          fontSize={9}
          fontWeight={h.highlight ? 700 : 400}
          fill={h.highlight ? STROKE_GREEN : TEXT}
        >
          {h.line}
        </text>
      ))}
    </g>
  );

  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.headerActions.override.aria')}
    >
      <ArrowDefs id={ID} />

      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.ruleKicker')}
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
        {t('workbench.docs.diagrams.headerActions.override.rule')}
      </text>

      {renderTile(
        TILE_LEFT_X,
        t('workbench.docs.diagrams.headerActions.override.replaceLabel'),
        t('workbench.docs.diagrams.headerActions.override.replaceSub'),
        [
          { line: t('workbench.docs.diagrams.headerActions.override.beforeOld'), matched: true },
          { line: t('workbench.docs.diagrams.headerActions.override.lineContentType'), matched: false },
        ],
        [
          { line: t('workbench.docs.diagrams.headerActions.override.afterNew'), highlight: true },
          { line: t('workbench.docs.diagrams.headerActions.override.lineContentType'), highlight: false },
        ],
        t('workbench.docs.diagrams.headerActions.override.arrowReplaced'),
      )}
      {renderTile(
        TILE_RIGHT_X,
        t('workbench.docs.diagrams.headerActions.override.addLabel'),
        t('workbench.docs.diagrams.headerActions.override.addSub'),
        [{ line: t('workbench.docs.diagrams.headerActions.override.lineContentType'), matched: false }],
        [
          { line: t('workbench.docs.diagrams.headerActions.override.afterNew'), highlight: true },
          { line: t('workbench.docs.diagrams.headerActions.override.lineContentType'), highlight: false },
        ],
        t('workbench.docs.diagrams.headerActions.override.arrowAdded'),
        t('workbench.docs.diagrams.headerActions.override.noHeaderNote'),
      )}

      <line
        x1={160}
        y1={SCENARIO_LABEL_Y - 8}
        x2={160}
        y2={AFTER_Y + STATE_H + 4}
        stroke="var(--ant-color-border-secondary)"
        strokeDasharray="2 4"
      />

      <text x={160} y={STAMP_Y} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.override.stamp')}
      </text>
    </svg>
  );
};

/**
 * Add / Replace — the "won't apply" gotcha as its own focused
 * diagram. Conditions gate every rule; if they don't match, the
 * action silently no-ops. Designed to sit just under the scenarios
 * diagram so the gotcha gets its own breathing room.
 */
export const OverrideWontApplyDiagram: React.FC = () => {
  const t = useT();
  const errColor = 'var(--ant-color-error)';
  const errBorder = 'var(--ant-color-error-border)';
  return (
    <svg
      viewBox="0 0 320 120"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.headerActions.override.wontAria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM} letterSpacing={0.5}>
        {t('workbench.docs.diagrams.headerActions.shared.wontFireKicker')}
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

      {/* ✗ row */}
      <text x={28} y={48} fontSize={14} fontWeight={700} fill={errColor}>
        ✗
      </text>
      <text x={48} y={48} fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.override.wontTitle')}
      </text>
      <text x={48} y={62} fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.headerActions.override.wontDetail')}
      </text>

      {/* → suggestion row */}
      <text x={28} y={88} fontSize={12} fontWeight={700} fill={STROKE_BLUE}>
        →
      </text>
      <text x={48} y={88} fontSize={10} fontWeight={700} fill={STROKE_BLUE}>
        {t('workbench.docs.diagrams.headerActions.shared.suggestion')}
      </text>
      <text x={48} y={100} fontSize={9} fill={TEXT}>
        {t('workbench.docs.diagrams.headerActions.override.wontSuggestion')}
      </text>
    </svg>
  );
};
