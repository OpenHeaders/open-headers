import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, FILL_BLUE, STROKE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';

// ─── Consumers: rules, requests, workflows share one definition ────

/**
 * One templated string feeding all three consumer surfaces. The point
 * is reuse: define once, reference everywhere, resolve at use time.
 */
export const VariablesConsumersDiagram: React.FC = () => {
  const t = useT();
  const consumers = [
    {
      label: t('workbench.docs.diagrams.variables.consumers.rules'),
      lines: [
        t('workbench.docs.diagrams.variables.consumers.rulesLine1'),
        t('workbench.docs.diagrams.variables.consumers.rulesLine2'),
      ],
      when: t('workbench.docs.diagrams.variables.consumers.rulesWhen'),
    },
    {
      label: t('workbench.docs.diagrams.variables.consumers.requests'),
      lines: [
        t('workbench.docs.diagrams.variables.consumers.requestsLine1'),
        t('workbench.docs.diagrams.variables.consumers.requestsLine2'),
      ],
      when: t('workbench.docs.diagrams.variables.consumers.requestsWhen'),
    },
    {
      label: t('workbench.docs.diagrams.variables.consumers.workflows'),
      lines: [
        t('workbench.docs.diagrams.variables.consumers.workflowsLine1'),
        t('workbench.docs.diagrams.variables.consumers.workflowsLine2'),
      ],
      when: t('workbench.docs.diagrams.variables.consumers.workflowsWhen'),
    },
  ];
  return (
    <svg
      viewBox="0 0 320 186"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.variables.consumers.aria')}
    >
      <ArrowDefs id="var-consumers-arrow" />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.variables.consumers.title')}
      </text>

      <rect x={40} y={24} width={240} height={22} rx={4} fill="var(--ant-color-fill-tertiary)" stroke={STROKE} />
      <text x={160} y={39} textAnchor="middle" fontFamily="monospace" fontSize={9.5} fill={TEXT}>
        {t('workbench.docs.diagrams.variables.consumers.template')}
      </text>

      {consumers.map((c, i) => {
        const cx = 60 + i * 100;
        const boxX = cx - 44;
        return (
          <g key={c.label}>
            <line x1={cx} y1={46} x2={cx} y2={72} stroke={STROKE} markerEnd="url(#var-consumers-arrow)" />
            <rect x={boxX} y={76} width={88} height={46} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
            <text x={cx} y={92} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
              {c.label}
            </text>
            {c.lines.map((line, j) => (
              <text key={line} x={cx} y={103 + j * 10} textAnchor="middle" fontSize={7.5} fill={TEXT_DIM}>
                {line}
              </text>
            ))}
            <text x={cx} y={136} textAnchor="middle" fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
              {c.when}
            </text>
          </g>
        );
      })}

      <text x={160} y={166} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.consumers.footer1')}
      </text>
      <text x={160} y={178} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.consumers.footer2')}
      </text>
    </svg>
  );
};
