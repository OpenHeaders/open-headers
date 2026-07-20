import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs,FILL_BLUE,STROKE,STROKE_BLUE,TEXT,TEXT_DIM } from '../_shared';
import { SUCCESS_BG,WARNING_BG,ERROR_BG,BORDER,BG_CONTAINER,Level,dotColor } from './_shared';

/**
 * Pipeline: how a user rule turns into a live DNR entry. Four
 * stages — compile, resolve variables, cap check, Chrome apply —
 * each annotated with which Status state it can emit if it goes
 * sideways.
 */
export const RulesPipelineDiagram: React.FC = () => {
  const t = useT();
  const ID = 'rules-pipe';

  type Stage = { name: string; sub: string; outcome?: { label: string; level: Exclude<Level, 'grey'> } };
  const STAGES: Stage[] = [
    {
      name: t('workbench.docs.diagrams.systemStatus.rulesPipeline.stageYourRule'),
      sub: 'Auth: Bearer {{TOKEN}}',
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.rulesPipeline.stageCompile'),
      sub: t('workbench.docs.diagrams.systemStatus.rulesPipeline.subToDnrJson'),
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.rulesPipeline.stageResolve'),
      sub: t('workbench.docs.diagrams.systemStatus.rulesPipeline.subResolveScopes'),
      outcome: {
        label: t('workbench.docs.diagrams.systemStatus.rulesPipeline.outUnresolved'),
        level: 'yellow',
      },
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.rulesPipeline.stageCapCheck'),
      sub: 'maxActiveRules',
      outcome: {
        label: t('workbench.docs.diagrams.systemStatus.rulesPipeline.outOverCap'),
        level: 'yellow',
      },
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.rulesPipeline.stageChromeApply'),
      sub: 'updateDynamicRules',
      outcome: {
        label: t('workbench.docs.diagrams.systemStatus.rulesPipeline.outRejected'),
        level: 'red',
      },
    },
    {
      name: t('workbench.docs.diagrams.systemStatus.rulesPipeline.stageLiveRule'),
      sub: t('workbench.docs.diagrams.systemStatus.rulesPipeline.subMatches'),
      outcome: {
        label: t('workbench.docs.diagrams.systemStatus.rulesPipeline.outActive'),
        level: 'green',
      },
    },
  ];

  const ROW_X = 30;
  const ROW_W = 260;
  const ROW_H = 26;
  const ROW_GAP = 8;
  const ROW_Y0 = 36;

  return (
    <svg
      viewBox="0 0 320 260"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.rulesPipeline.aria')}
    >
      <ArrowDefs id={ID} />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.rulesPipeline.title')}
      </text>

      {STAGES.map((stage, i) => {
        const y = ROW_Y0 + i * (ROW_H + ROW_GAP);
        const isLive = i === STAGES.length - 1;
        const fill = isLive ? SUCCESS_BG : BG_CONTAINER;
        const stroke = isLive ? dotColor('green') : BORDER;
        return (
          <g key={stage.name}>
            <rect x={ROW_X} y={y} width={ROW_W} height={ROW_H} rx={4} fill={fill} stroke={stroke} />
            {/* Stage number badge */}
            <circle cx={ROW_X + 14} cy={y + ROW_H / 2} r={8} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={ROW_X + 14} y={y + ROW_H / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
              {i + 1}
            </text>
            {/* Stage label */}
            <text x={ROW_X + 30} y={y + 12} fontSize={10} fontWeight={700} fill={TEXT}>
              {stage.name}
            </text>
            <text x={ROW_X + 30} y={y + 23} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {stage.sub}
            </text>
            {/* Outcome badge (right side) */}
            {stage.outcome && (
              <g>
                <rect
                  x={ROW_X + ROW_W - 110}
                  y={y + 5}
                  width={104}
                  height={ROW_H - 10}
                  rx={3}
                  fill={
                    stage.outcome.level === 'red'
                      ? ERROR_BG
                      : stage.outcome.level === 'yellow'
                        ? WARNING_BG
                        : SUCCESS_BG
                  }
                  stroke={dotColor(stage.outcome.level)}
                />
                <circle cx={ROW_X + ROW_W - 104} cy={y + ROW_H / 2} r={2.5} fill={dotColor(stage.outcome.level)} />
                <text x={ROW_X + ROW_W - 96} y={y + ROW_H / 2 + 3} fontSize={8} fontWeight={600} fill={TEXT}>
                  {stage.outcome.label}
                </text>
              </g>
            )}
            {/* Connector to next */}
            {i < STAGES.length - 1 && (
              <line
                x1={ROW_X + 14}
                y1={y + ROW_H}
                x2={ROW_X + 14}
                y2={y + ROW_H + ROW_GAP}
                stroke={STROKE}
                strokeWidth={1.5}
                markerEnd={`url(#${ID})`}
              />
            )}
          </g>
        );
      })}

      <text x={160} y={244} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.rulesPipeline.footerRebuild')}
      </text>
      <text x={160} y={256} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.rulesPipeline.footerPaused')}
      </text>
    </svg>
  );
};

/**
 * Capacity bar — three zones mapped to the meaningful 0…1.2× cap
 * range. Showing all the way to Chrome's 30k ceiling would crush
 * the warn/cap region into a sliver, since the cap default is
 * 5000. The 30k figure is a footer note, not bar geometry.
 */
export const RulesCapacityDiagram: React.FC = () => {
  const t = useT();
  // Stylised defaults — the real values come from settings.
  const CAP = 5000; // rulesEngine.maxActiveRules
  const WARN = 4000; // rulesEngine.largeRuleSetThreshold
  const DISPLAY_MAX = 6000; // 1.2× CAP — focuses on the meaningful range

  const BAR_X = 20;
  const BAR_Y = 78;
  const BAR_W = 280;
  const BAR_H = 28;

  const warnX = BAR_X + BAR_W * (WARN / DISPLAY_MAX);
  const capX = BAR_X + BAR_W * (CAP / DISPLAY_MAX);
  const endX = BAR_X + BAR_W;

  // Three example markers (rule counts), spaced so their badges
  // don't collide.
  const HEALTHY = 1200;
  const APPROACHING = 4500;
  const OVER = 5600;
  const x = (count: number) => BAR_X + BAR_W * Math.min(count / DISPLAY_MAX, 1);

  return (
    <svg
      viewBox="0 0 320 230"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.systemStatus.rulesCapacity.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.title')}
      </text>

      {/* Zone labels above the bar */}
      <text x={(BAR_X + warnX) / 2} y={34} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('green')}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.zoneHealthy')}
      </text>
      <text
        x={(warnX + capX) / 2 - 10}
        y={34}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={dotColor('yellow')}
      >
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.zoneApproach')}
      </text>
      <text x={(capX + endX) / 2} y={34} textAnchor="middle" fontSize={9} fontWeight={700} fill={dotColor('red')}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.zoneTruncated')}
      </text>

      {/* Example count needles above the bar */}
      {[
        {
          count: HEALTHY,
          label: t('workbench.docs.diagrams.systemStatus.rulesCapacity.countHealthy'),
          level: 'green' as const,
        },
        {
          count: APPROACHING,
          label: t('workbench.docs.diagrams.systemStatus.rulesCapacity.countApproaching'),
          level: 'yellow' as const,
        },
        {
          count: OVER,
          label: t('workbench.docs.diagrams.systemStatus.rulesCapacity.countOver'),
          level: 'red' as const,
        },
      ].map((m) => (
        <g key={m.count}>
          <rect
            x={x(m.count) - 22}
            y={48}
            width={44}
            height={16}
            rx={3}
            fill={m.level === 'red' ? ERROR_BG : m.level === 'yellow' ? WARNING_BG : SUCCESS_BG}
            stroke={dotColor(m.level)}
          />
          <text x={x(m.count)} y={59} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
            {m.label}
          </text>
          <line x1={x(m.count)} y1={64} x2={x(m.count)} y2={BAR_Y} stroke={dotColor(m.level)} strokeWidth={1.5} />
        </g>
      ))}

      {/* Bar — three colored segments */}
      <rect x={BAR_X} y={BAR_Y} width={warnX - BAR_X} height={BAR_H} fill={SUCCESS_BG} stroke={dotColor('green')} />
      <rect x={warnX} y={BAR_Y} width={capX - warnX} height={BAR_H} fill={WARNING_BG} stroke={dotColor('yellow')} />
      <rect
        x={capX}
        y={BAR_Y}
        width={endX - capX}
        height={BAR_H}
        fill={ERROR_BG}
        stroke={dotColor('red')}
        strokeDasharray="3 2"
      />

      {/* Threshold markers below the bar */}
      <line
        x1={warnX}
        y1={BAR_Y + BAR_H}
        x2={warnX}
        y2={BAR_Y + BAR_H + 6}
        stroke={dotColor('yellow')}
        strokeWidth={1.5}
      />
      <text x={warnX} y={BAR_Y + BAR_H + 18} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel')}
      </text>
      <text x={warnX} y={BAR_Y + BAR_H + 29} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.warnValue')}
      </text>

      <line x1={capX} y1={BAR_Y + BAR_H} x2={capX} y2={BAR_Y + BAR_H + 6} stroke={dotColor('red')} strokeWidth={1.5} />
      <text x={capX} y={BAR_Y + BAR_H + 18} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel')}
      </text>
      <text x={capX} y={BAR_Y + BAR_H + 29} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.capValue')}
      </text>

      {/* Legend / footer notes */}
      <text x={20} y={172} fontSize={8} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.warnLabel')}
      </text>
      <text x={48} y={172} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        rulesEngine.largeRuleSetThreshold
      </text>

      <text x={20} y={186} fontSize={8} fontWeight={700} fill={TEXT}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.capLabel')}
      </text>
      <text x={48} y={186} fontFamily="monospace" fontSize={8} fill={TEXT_DIM}>
        rulesEngine.maxActiveRules
      </text>

      <text x={160} y={208} textAnchor="middle" fontSize={9} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.footerDrop')}
      </text>
      <text x={160} y={222} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.systemStatus.rulesCapacity.footerCeiling')}
      </text>
    </svg>
  );
};

// ─── Requests subsystem — outcomes + scope ────────────────────────

