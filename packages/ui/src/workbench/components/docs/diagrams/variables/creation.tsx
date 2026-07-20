import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { TEXT, TEXT_DIM } from '../_shared';
import { type DiagramScope, scopeBg, scopeColor } from './_scope-palette';

// ─── Creation map: where each scope lives in the sidebar ───────────

interface SidebarRow {
  y: number;
  label: string;
  indent: number;
  scope?: DiagramScope;
  ref?: string;
  dim?: boolean;
}

/**
 * Sidebar mockup with every variable home highlighted in its scope
 * color, each annotated with the namespace it feeds. Collections carry
 * their own Variables page; the rest are top-level sidebar entries.
 */
export const VariablesCreationMapDiagram: React.FC = () => {
  const t = useT();
  const rows: SidebarRow[] = [
    { y: 56, label: t('workbench.docs.diagrams.variables.creation.collections'), indent: 0, dim: true },
    { y: 72, label: t('workbench.docs.diagrams.variables.creation.collectionName'), indent: 1 },
    {
      y: 88,
      label: t('workbench.docs.diagrams.variables.creation.variables'),
      indent: 2,
      scope: 'collection',
      ref: '{{collection.*}}',
    },
    { y: 108, label: t('workbench.docs.diagrams.variables.creation.environments'), indent: 0, dim: true },
    {
      y: 124,
      label: t('workbench.docs.diagrams.variables.creation.envStaging'),
      indent: 1,
      scope: 'environment',
      ref: '{{env.*}}',
    },
    { y: 140, label: t('workbench.docs.diagrams.variables.creation.envProduction'), indent: 1 },
    {
      y: 160,
      label: t('workbench.docs.diagrams.variables.creation.vault'),
      indent: 0,
      scope: 'vault',
      ref: '{{vault.*}}',
    },
    {
      y: 176,
      label: t('workbench.docs.diagrams.variables.creation.workspaceVariables'),
      indent: 0,
      scope: 'workspace',
      ref: '{{workspace.*}}',
    },
    {
      y: 192,
      label: t('workbench.docs.diagrams.variables.creation.liveVariables'),
      indent: 0,
      scope: 'live',
      ref: '{{live.*}}',
    },
  ];
  return (
    <svg
      viewBox="0 0 320 246"
      width="100%"
      style={{ maxWidth: 360 }}
      role="img"
      aria-label={t('workbench.docs.diagrams.variables.creation.aria')}
    >
      <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
        {t('workbench.docs.diagrams.variables.creation.title')}
      </text>

      {/* Sidebar panel */}
      <rect
        x={16}
        y={26}
        width={150}
        height={184}
        rx={4}
        fill="var(--ant-color-fill-quaternary)"
        stroke="var(--ant-color-border)"
      />
      <text x={26} y={44} fontSize={8} fontWeight={600} letterSpacing={0.6} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.creation.workspaceName')}
      </text>

      {rows.map((row) => {
        const textX = 26 + row.indent * 10;
        const highlighted = row.scope !== undefined;
        return (
          <g key={row.label + row.y}>
            {highlighted && (
              <rect
                x={20}
                y={row.y - 10}
                width={142}
                height={14}
                rx={3}
                fill={scopeBg(row.scope as DiagramScope)}
                stroke={scopeColor(row.scope as DiagramScope)}
                strokeWidth={0.8}
              />
            )}
            <text
              x={textX}
              y={row.y}
              fontSize={8.5}
              fontWeight={highlighted ? 600 : 400}
              fill={row.dim ? TEXT_DIM : highlighted ? scopeColor(row.scope as DiagramScope) : TEXT}
            >
              {row.label}
            </text>
            {row.ref && (
              <>
                <line
                  x1={164}
                  y1={row.y - 3}
                  x2={182}
                  y2={row.y - 3}
                  stroke={scopeColor(row.scope as DiagramScope)}
                  strokeDasharray="2 2"
                />
                <text
                  x={186}
                  y={row.y}
                  fontFamily="monospace"
                  fontSize={9}
                  fontWeight={600}
                  fill={scopeColor(row.scope as DiagramScope)}
                >
                  {row.ref}
                </text>
              </>
            )}
          </g>
        );
      })}

      <text x={160} y={224} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.creation.footer1')}
      </text>
      <text x={160} y={237} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
        {t('workbench.docs.diagrams.variables.creation.footer2')}
      </text>
    </svg>
  );
};
