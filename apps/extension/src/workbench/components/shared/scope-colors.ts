import { createElement } from 'react';

export interface ScopeColorDef {
  /** Dark foreground color — used for the letter and for scope Tags. */
  color: string;
  /** Light tinted background — used inside the badge. */
  bg: string;
  letter: string;
  /** Human-readable scope label (used in tooltips, suggestion rows). */
  label: string;
}

/** Canonical scope palette — every variable scope the resolver knows
 *  about lives here. Adding a scope is a single edit + matching CSS
 *  variables in `dock-layout.css` and `rules.less`. */
export const SCOPE_COLORS = {
  vault: { color: '#cf1322', bg: '#ffd8d5', letter: 'V', label: 'Vault secret' },
  environment: { color: '#007F31', bg: '#E5FFF1', letter: 'E', label: 'Environment variable' },
  collection: { color: '#AD7A03', bg: '#FFF4BE', letter: 'C', label: 'Collection variable' },
  workspace: { color: '#0053B8', bg: '#E7F0FF', letter: 'W', label: 'Workspace variable' },
  live: { color: '#531dab', bg: '#f5f0ff', letter: '↻', label: 'Live variable (workflow-backed)' },
  step: { color: '#0F766E', bg: '#CCFBF1', letter: 'S', label: 'Workflow step capture' },
  file: { color: '#475569', bg: '#E2E8F0', letter: 'F', label: 'File reference' },
  dynamic: { color: '#737373', bg: '#F5F5F4', letter: '$', label: 'Dynamic generator' },
} as const satisfies Record<string, ScopeColorDef>;

export type ScopeKey = keyof typeof SCOPE_COLORS;

/** Map a `VariableNamespace` / `SuggestionScope` (which uses `'env'`)
 *  to the canonical `ScopeKey` (which uses `'environment'`). All other
 *  keys are identical. */
export function namespaceToScopeKey(ns: string): ScopeKey | null {
  if (ns === 'env') return 'environment';
  if (ns in SCOPE_COLORS) return ns as ScopeKey;
  return null;
}

/** Colored letter badge — light tinted background with dark foreground letter.
 *  Colors are driven by CSS variables so light/dark theme switches automatically. */
export function scopeBadge(scope: ScopeKey, size = 14): React.ReactNode {
  const { letter } = SCOPE_COLORS[scope];
  return createElement(
    'span',
    {
      style: {
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.65,
        fontWeight: 700,
        color: `var(--scope-${scope}-color)`,
        background: `var(--scope-${scope}-bg)`,
        flexShrink: 0,
        lineHeight: 1,
      },
    },
    letter,
  );
}
