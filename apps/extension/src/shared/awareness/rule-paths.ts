/**
 * Canonical rule field paths for awareness publishing.
 *
 * Surfaces (workbench, devpanel, popup) publish `fieldFocus.path` strings
 * the awareness mirror compares verbatim. This module is the single
 * source of truth for the path strings so two surfaces that focus the
 * "same" field agree on its name.
 *
 * Path shape mirrors the mutation field paths used by the rule mutators
 * (`apps/extension/src/shared/sync/rule-mutations.ts`) — scalar field
 * names at the top level, dotted indices for set members. Indexing by
 * **set position** (not itemId) matches what an editing surface knows:
 * the form binds row N to a list index, not to the synthetic itemId the
 * oracle assigns. Two surfaces editing the same row will publish the
 * same `headerMods.0.value` even though the underlying itemId is opaque
 * to them.
 */

export const RULE_FIELD = {
  name: 'name',
  enabled: 'enabled',
  conditions: 'conditions',
  /** Header mods. `direction` is `'request'` or `'response'`. */
  headerMod(direction: 'request' | 'response', index: number, leaf: 'headerName' | 'value' | 'operation'): string {
    const set = direction === 'request' ? 'action.requestHeaders' : 'action.responseHeaders';
    return `${set}.${index}.${leaf}`;
  },
  condition(index: number, leaf: 'value' | 'op' | 'field'): string {
    return `conditions.${index}.${leaf}`;
  },
} as const;
