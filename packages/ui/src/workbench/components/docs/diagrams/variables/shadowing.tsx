import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ArrowDefs, STROKE, TEXT, TEXT_DIM } from '../_shared';
import { scopeBg, scopeColor } from './_scope-palette';

// ─── Shadowing: the same name defined in two scopes ────────────────

/**
 * `api_host` defined in both the active environment and the workspace.
 * The bare reference lands on the environment value; the workspace
 * definition is shadowed but stays reachable through its namespace.
 */
export const VariablesShadowingDiagram: React.FC = () => {
  const t = useT();
  const envColor = scopeColor('environment');
  const wsColor = scopeColor('workspace');
  return (
    <svg
      viewBox="0 0 320 208"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.variables.shadowing.aria')}
    >
      <ArrowDefs id="var-shadow-arrow" />
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.variables.shadowing.title')}
      </text>

      {/* Bare reference */}
      <rect x={105} y={26} width={110} height={20} rx={4} fill="var(--ant-color-fill-tertiary)" stroke={STROKE} />
      <text x={160} y={40} textAnchor="middle" fontFamily="monospace" fontSize={10.5} fill={TEXT}>
        {'{{api_host}}'}
      </text>

      {/* Winner path */}
      <line x1={140} y1={46} x2={92} y2={74} stroke={envColor} strokeWidth={1.4} markerEnd="url(#var-shadow-arrow)" />
      <text x={95} y={58} textAnchor="end" fontSize={8} fontWeight={600} fill={envColor}>
        {t('workbench.docs.diagrams.variables.shadowing.wins')}
      </text>
      {/* Shadowed path */}
      <line x1={180} y1={46} x2={230} y2={74} stroke={TEXT_DIM} strokeDasharray="3 3" />
      <text x={228} y={58} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.shadowing.shadowed')}
      </text>

      {/* Environment definition */}
      <rect x={16} y={78} width={140} height={44} rx={4} fill={scopeBg('environment')} stroke={envColor} />
      <text x={24} y={92} fontSize={9} fontWeight={600} fill={envColor}>
        {t('workbench.docs.diagrams.variables.shadowing.envLabel')}
      </text>
      <text x={24} y={108} fontFamily="monospace" fontSize={7.5} fill={TEXT}>
        api_host=stg.openheaders.com
      </text>

      {/* Workspace definition */}
      <rect x={164} y={78} width={140} height={44} rx={4} fill={scopeBg('workspace')} stroke={wsColor} />
      <text x={172} y={92} fontSize={9} fontWeight={600} fill={wsColor}>
        {t('workbench.docs.diagrams.variables.shadowing.wsLabel')}
      </text>
      <text x={172} y={108} fontFamily="monospace" fontSize={7.5} fill={TEXT}>
        api_host=openheaders.com
      </text>

      {/* Namespaced escape hatch */}
      <rect x={85} y={152} width={150} height={20} rx={4} fill="var(--ant-color-fill-tertiary)" stroke={STROKE} />
      <text x={160} y={166} textAnchor="middle" fontFamily="monospace" fontSize={10} fill={TEXT}>
        {'{{workspace.api_host}}'}
      </text>
      <line x1={200} y1={150} x2={232} y2={126} stroke={wsColor} strokeWidth={1.4} markerEnd="url(#var-shadow-arrow)" />

      <text x={160} y={196} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.shadowing.footer')}
      </text>
    </svg>
  );
};
