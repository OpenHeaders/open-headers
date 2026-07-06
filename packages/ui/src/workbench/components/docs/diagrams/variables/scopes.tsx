import type React from 'react';
import { ArrowDefs, STROKE, TEXT, TEXT_DIM } from '../_shared';
import { scopeBg, scopeColor } from './_scope-palette';

// ─── Resolution ladder: bare {{token}} walks the four scopes ───────

const LADDER = [
  { scope: 'vault', label: 'Vault', sub: 'secrets · this device only' },
  { scope: 'environment', label: 'Environment', sub: 'active, then default' },
  { scope: 'collection', label: 'Collection', sub: 'active collection only' },
  { scope: 'workspace', label: 'Workspace', sub: 'shared with everyone' },
] as const;

const NAMESPACED = [
  { scope: 'live', label: '{{live.*}}' },
  { scope: 'step', label: '{{step.*}}' },
  { scope: 'file', label: '{{file.*}}' },
  { scope: 'dynamic', label: '{{dynamic.*}}' },
] as const;

/**
 * The core mental model: a bare `{{token}}` walks the four real scopes
 * top-down and stops at the first hit. The namespace-only scopes sit
 * in a side rail — visibly outside the walk.
 */
export const VariablesResolutionLadderDiagram: React.FC = () => (
  <svg
    viewBox="0 0 320 252"
    width="100%"
    style={{ maxWidth: 360 }}
    role="img"
    aria-label="A bare variable reference resolves through vault, environment, collection, then workspace — first hit wins. Live, step, file, and dynamic are reachable only by namespace prefix."
  >
    <ArrowDefs id="var-ladder-arrow" />
    <text x={160} y={14} textAnchor="middle" fontSize={10} fontWeight={600} fill={TEXT}>
      Bare reference — the first scope that defines it wins
    </text>

    {/* The reference being resolved */}
    <rect x={60} y={24} width={110} height={20} rx={4} fill="var(--ant-color-fill-tertiary)" stroke={STROKE} />
    <text x={115} y={38} textAnchor="middle" fontFamily="monospace" fontSize={11} fill={TEXT}>
      {'{{token}}'}
    </text>
    <line x1={115} y1={44} x2={115} y2={58} stroke={STROKE} markerEnd="url(#var-ladder-arrow)" />

    {/* Ladder — priority order, highest first */}
    {LADDER.map((entry, i) => {
      const y = 62 + i * 42;
      return (
        <g key={entry.scope}>
          <text x={30} y={y + 19} textAnchor="middle" fontSize={9} fontWeight={700} fill={TEXT_DIM}>
            {i + 1}
          </text>
          <rect
            x={40}
            y={y}
            width={150}
            height={30}
            rx={4}
            fill={scopeBg(entry.scope)}
            stroke={scopeColor(entry.scope)}
          />
          <text x={48} y={y + 13} fontSize={10} fontWeight={600} fill={scopeColor(entry.scope)}>
            {entry.label}
          </text>
          <text x={48} y={y + 24} fontSize={7.5} fill={TEXT_DIM}>
            {entry.sub}
          </text>
          {i < LADDER.length - 1 && (
            <>
              <line x1={115} y1={y + 30} x2={115} y2={y + 41} stroke={STROKE} markerEnd="url(#var-ladder-arrow)" />
              <text x={122} y={y + 39} fontSize={8} fontStyle="italic" fill={TEXT_DIM}>
                miss
              </text>
            </>
          )}
        </g>
      );
    })}

    {/* Namespace-only rail */}
    <text x={258} y={58} textAnchor="middle" fontSize={8} fontWeight={600} letterSpacing={0.6} fill={TEXT_DIM}>
      NAMESPACE ONLY
    </text>
    {NAMESPACED.map((entry, i) => {
      const y = 66 + i * 27;
      return (
        <g key={entry.scope}>
          <rect
            x={210}
            y={y}
            width={96}
            height={20}
            rx={4}
            fill={scopeBg(entry.scope)}
            stroke={scopeColor(entry.scope)}
          />
          <text
            x={258}
            y={y + 13.5}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize={9}
            fill={scopeColor(entry.scope)}
          >
            {entry.label}
          </text>
        </g>
      );
    })}
    <text x={258} y={186} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
      reached only by prefix —
    </text>
    <text x={258} y={197} textAnchor="middle" fontSize={8} fill={TEXT_DIM}>
      never part of the bare walk
    </text>

    <text x={160} y={240} textAnchor="middle" fontSize={9} fill={TEXT_DIM}>
      {'{{vault.token}}, {{env.token}}, {{collection.token}}, {{workspace.token}} pin one scope.'}
    </text>
  </svg>
);
