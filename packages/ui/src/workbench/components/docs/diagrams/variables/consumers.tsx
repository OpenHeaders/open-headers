import type React from 'react';
import { ArrowDefs, FILL_BLUE, STROKE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';

// ─── Consumers: rules, requests, workflows share one definition ────

const CONSUMERS = [
  { label: 'Rules', lines: ['headers, redirect,', 'bodies, inject'], when: 'when a rule applies' },
  { label: 'Requests', lines: ['URL, params,', 'headers, auth, body'], when: 'on Send' },
  { label: 'Workflows', lines: ['every step,', 'chained captures'], when: 'per run' },
] as const;

/**
 * One templated string feeding all three consumer surfaces. The point
 * is reuse: define once, reference everywhere, resolve at use time.
 */
export const VariablesConsumersDiagram: React.FC = () => (
  <svg
    viewBox="0 0 320 186"
    width="100%"
    style={{ maxWidth: 360 }}
    role="img"
    aria-label="One templated value — Authorization: Bearer token — consumed by rules, requests, and workflows"
  >
    <ArrowDefs id="var-consumers-arrow" />
    <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
      Define once, reference everywhere
    </text>

    <rect x={40} y={24} width={240} height={22} rx={4} fill="var(--ant-color-fill-tertiary)" stroke={STROKE} />
    <text x={160} y={39} textAnchor="middle" fontFamily="monospace" fontSize={9.5} fill={TEXT}>
      {'Authorization: Bearer {{token}}'}
    </text>

    {CONSUMERS.map((c, i) => {
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
      Values are substituted at use time — change the variable once,
    </text>
    <text x={160} y={178} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
      and every rule, request, and workflow picks it up.
    </text>
  </svg>
);
