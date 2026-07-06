/**
 * Scope color accessors for the Variables diagrams — resolve to the
 * same `--scope-*` CSS variables that drive the letter badges in the
 * Scope panel and template inputs, so the docs diagrams stay in sync
 * with the app's scope palette across theme switches.
 */

export type DiagramScope = 'vault' | 'environment' | 'collection' | 'workspace' | 'live' | 'step' | 'file' | 'dynamic';

export const scopeColor = (scope: DiagramScope) => `var(--scope-${scope}-color)`;
export const scopeBg = (scope: DiagramScope) => `var(--scope-${scope}-bg)`;
