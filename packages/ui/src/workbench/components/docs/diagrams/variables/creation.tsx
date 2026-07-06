import type React from 'react';
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

const ROWS: SidebarRow[] = [
  { y: 56, label: '▾ Collections', indent: 0, dim: true },
  { y: 72, label: '▾ Payments API', indent: 1 },
  { y: 88, label: 'Variables', indent: 2, scope: 'collection', ref: '{{collection.*}}' },
  { y: 108, label: '▾ Environments', indent: 0, dim: true },
  { y: 124, label: 'staging  ●', indent: 1, scope: 'environment', ref: '{{env.*}}' },
  { y: 140, label: 'production', indent: 1 },
  { y: 160, label: 'Vault', indent: 0, scope: 'vault', ref: '{{vault.*}}' },
  { y: 176, label: 'Workspace Variables', indent: 0, scope: 'workspace', ref: '{{workspace.*}}' },
  { y: 192, label: 'Live Variables', indent: 0, scope: 'live', ref: '{{live.*}}' },
];

/**
 * Sidebar mockup with every variable home highlighted in its scope
 * color, each annotated with the namespace it feeds. Collections carry
 * their own Variables page; the rest are top-level sidebar entries.
 */
export const VariablesCreationMapDiagram: React.FC = () => (
  <svg
    viewBox="0 0 320 236"
    width="100%"
    style={{ maxWidth: 360 }}
    role="img"
    aria-label="Sidebar map — collection variables live on the collection, environments under Environments, and Vault, Workspace Variables, and Live Variables are top-level sidebar entries"
  >
    <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
      Where each scope is created
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
      PAYMENTS TEAM
    </text>

    {ROWS.map((row) => {
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

    <text x={160} y={226} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
      Collections carry their own Variables page; the rest are sidebar entries.
    </text>
  </svg>
);
