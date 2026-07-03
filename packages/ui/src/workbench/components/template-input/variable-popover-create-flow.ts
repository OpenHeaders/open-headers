/**
 * Create flow for `VariableHoverPopover` — which "Add to" control to
 * show for an unresolved reference, the scope Save commits to, and any
 * unavailability hint, all derived together so they can't drift.
 */

import type { VariableLookupResult } from '@openheaders/ui/shared/hooks/variables/useVariableLookup';
import type { ScopeKey } from '../shared/scope-colors';

export type CreateScope = 'environment' | 'collection' | 'workspace' | 'vault';

/** Reference namespace → its create scope. Only the user-creatable
 *  namespaces map; reserved/runtime ones (live, step, file, dynamic)
 *  are absent, so a default falls through to Workspace. */
export const NAMESPACE_CREATE_SCOPE = {
  env: 'environment',
  vault: 'vault',
  collection: 'collection',
  workspace: 'workspace',
} as const;

export interface CreateOption {
  key: CreateScope;
  label: string;
  colorKey: ScopeKey;
  disabled?: boolean;
  hint?: string;
}

export function labelForCreateScope(s: CreateScope): string {
  switch (s) {
    case 'environment':
      return 'Environment';
    case 'collection':
      return 'Collection';
    case 'workspace':
      return 'Workspace';
    case 'vault':
      return 'Vault';
  }
}

export function createScopeToColorKey(s: CreateScope): ScopeKey {
  return s;
}

export function buildCreateOptions(
  lookup: VariableLookupResult,
  hasActiveEnv: boolean,
  hasCollection: boolean,
): CreateOption[] {
  // Reserved / runtime-only namespaces aren't creatable from the
  // popover — they need their dedicated editors (Live Variables, file
  // upload, workflow steps).
  if (
    lookup.namespace === 'live' ||
    lookup.namespace === 'step' ||
    lookup.namespace === 'file' ||
    lookup.namespace === 'dynamic'
  ) {
    return [];
  }
  // Show every creatable destination regardless of the reference's
  // explicit namespace. The user picks where the variable should
  // live; the namespace dictates where the resolver looks but doesn't
  // constrain where storage happens.
  const all: CreateScope[] = ['environment', 'collection', 'workspace', 'vault'];
  return all
    .map<CreateOption | null>((k) => {
      switch (k) {
        case 'environment':
          return {
            key: 'environment',
            label: 'Environment',
            colorKey: 'environment',
            disabled: !hasActiveEnv,
            hint: hasActiveEnv ? undefined : 'no active env',
          };
        case 'collection':
          return hasCollection ? { key: 'collection', label: 'Collection', colorKey: 'collection' } : null;
        case 'workspace':
          return { key: 'workspace', label: 'Workspace', colorKey: 'workspace' };
        case 'vault':
          return { key: 'vault', label: 'Vault', colorKey: 'vault' };
        default:
          return null;
      }
    })
    .filter((o): o is CreateOption => o !== null);
}

/** How "Add to" is presented: a fixed label (a namespaced ref locks the
 *  scope), a switchable dropdown (a bare ref), or none (a reserved
 *  namespace — nothing creatable). */
export type CreatePicker = 'fixed' | 'dropdown' | 'none';

export interface CreateFlow {
  picker: CreatePicker;
  /** Scope the Save commits to, or null when nothing is creatable here
   *  (Save stays disabled). */
  scope: CreateScope | null;
  /** Scope to label when `picker === 'fixed'`, even if it isn't creatable
   *  in this context. */
  fixedScope: CreateScope | null;
  /** Why a locked / offered scope isn't creatable here, for the hint. */
  unavailable: 'no-active-env' | 'no-collection' | null;
}

/** Single source of truth for the create flow — which "Add to" control to
 *  show, the scope it commits to, and any unavailability hint, all derived
 *  together so they can't drift. A namespaced reference (`{{vault.x}}`)
 *  LOCKS the scope to its prefix so the user can't create a variable the
 *  reference will never resolve; a bare reference is a free choice. */
export function resolveCreateFlow(
  namespaceScope: CreateScope | null,
  addTo: CreateScope | null,
  createOptions: CreateOption[],
): CreateFlow {
  const enabled = (key: CreateScope) => createOptions.some((o) => o.key === key && !o.disabled);

  if (namespaceScope) {
    const available = enabled(namespaceScope);
    const unavailable = available
      ? null
      : namespaceScope === 'environment'
        ? 'no-active-env'
        : namespaceScope === 'collection'
          ? 'no-collection'
          : null;
    return { picker: 'fixed', scope: available ? namespaceScope : null, fixedScope: namespaceScope, unavailable };
  }

  if (createOptions.length === 0) {
    return { picker: 'none', scope: null, fixedScope: null, unavailable: null };
  }

  // Bare ref → free choice. Default to Workspace (the broadest), else the
  // first enabled option. Surface the env hint when Environment is offered
  // but disabled (no active env).
  const scope =
    addTo && enabled(addTo)
      ? addTo
      : (createOptions.find((o) => o.key === 'workspace' && !o.disabled)?.key ??
        createOptions.find((o) => !o.disabled)?.key ??
        null);
  const unavailable = createOptions.some((o) => o.key === 'environment' && o.disabled) ? 'no-active-env' : null;
  return { picker: 'dropdown', scope, fixedScope: null, unavailable };
}
