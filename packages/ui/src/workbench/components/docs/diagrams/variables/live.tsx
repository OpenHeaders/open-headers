import type React from 'react';
import { ArrowDefs, FILL_BLUE, STROKE, STROKE_BLUE, TEXT, TEXT_DIM } from '../_shared';
import { scopeBg, scopeColor } from './_scope-palette';

// ─── Live variable lifecycle: run → publish → consume → refresh ────

/**
 * A Live Workflow runs, its exposed capture publishes as `{{live.token}}`,
 * and rules / requests consume the published value. The refresh schedule
 * re-runs the workflow to keep the value fresh.
 */
export const VariablesLiveLifecycleDiagram: React.FC = () => {
  const liveColor = scopeColor('live');
  return (
    <svg
      viewBox="0 0 320 210"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label="A live workflow runs its steps, publishes the exposed capture as a live variable, and rules and requests consume it; auto-refresh re-runs the workflow"
    >
      <ArrowDefs id="var-live-arrow" />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        A successful run publishes the value
      </text>

      {/* Workflow card */}
      <rect x={16} y={30} width={130} height={104} rx={5} fill="var(--ant-color-bg-container)" stroke={STROKE_BLUE} />
      <rect x={16} y={30} width={130} height={18} rx={5} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={81} y={43} textAnchor="middle" fontSize={9} fontWeight={600} fill={TEXT}>
        Live Workflow
      </text>
      {['Step 1 · sign in', 'Step 2 · fetch token'].map((step, i) => (
        <g key={step}>
          <rect
            x={26}
            y={56 + i * 24}
            width={110}
            height={16}
            rx={3}
            fill="var(--ant-color-fill-tertiary)"
            stroke="var(--ant-color-border)"
          />
          <text x={32} y={67 + i * 24} fontSize={8} fill={TEXT}>
            {step}
          </text>
        </g>
      ))}
      <rect x={26} y={106} width={110} height={16} rx={3} fill={scopeBg('step')} stroke={scopeColor('step')} />
      <text x={32} y={117} fontSize={8} fontWeight={600} fill={scopeColor('step')}>
        expose: token
      </text>

      {/* Publish arrow */}
      <line x1={146} y1={86} x2={194} y2={86} stroke={STROKE} markerEnd="url(#var-live-arrow)" />
      <text x={170} y={80} textAnchor="middle" fontSize={7.5} fill={TEXT_DIM}>
        run succeeds
      </text>
      <text x={170} y={98} textAnchor="middle" fontSize={7.5} fill={TEXT_DIM}>
        publishes
      </text>

      {/* Live variable chip */}
      <rect x={198} y={72} width={106} height={26} rx={4} fill={scopeBg('live')} stroke={liveColor} />
      <text x={251} y={89} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={liveColor}>
        {'{{live.token}}'}
      </text>

      {/* Consumers */}
      <line x1={228} y1={98} x2={220} y2={126} stroke={STROKE} markerEnd="url(#var-live-arrow)" />
      <line x1={274} y1={98} x2={282} y2={126} stroke={STROKE} markerEnd="url(#var-live-arrow)" />
      <rect x={196} y={130} width={48} height={20} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={220} y={143.5} textAnchor="middle" fontSize={9} fill={TEXT}>
        Rules
      </text>
      <rect x={252} y={130} width={56} height={20} rx={4} fill={FILL_BLUE} stroke={STROKE_BLUE} />
      <text x={280} y={143.5} textAnchor="middle" fontSize={9} fill={TEXT}>
        Requests
      </text>

      {/* Refresh loop back to the workflow */}
      <path
        d="M 251 70 C 251 46, 215 34, 152 38"
        fill="none"
        stroke={liveColor}
        strokeDasharray="3 3"
        markerEnd="url(#var-live-arrow)"
      />
      <text x={218} y={26} textAnchor="middle" fontSize={7.5} fontStyle="italic" fill={TEXT_DIM}>
        auto-refresh re-runs
      </text>

      <text x={160} y={176} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        Saving activates the workflow — the value appears only after
      </text>
      <text x={160} y={189} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        a run that succeeds, and refreshes on the workflow's schedule.
      </text>
    </svg>
  );
};
