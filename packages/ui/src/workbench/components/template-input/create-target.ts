/**
 * Create-action detection — when a reference names a variable that
 * doesn't exist yet, the suggestion popover offers to create it under
 * the "No matches" empty state instead of leaving a dead end. A scoped
 * reference (`{{vault.okay}}`) targets its namespace directly (only the
 * user-creatable namespaces qualify); a bare reference (`{{whatever}}`)
 * is creatable too — the create popover's "Add to" picker chooses the
 * destination scope.
 */

import { parseReference } from '@openheaders/core/variables';

export interface CreateTarget {
  /** The full reference inside the braces, e.g. `vault.okay`. */
  reference: string;
  /** The variable name without its namespace prefix, e.g. `okay`. */
  name: string;
  /** Human label for the destination scope, e.g. `Vault`. Null for a
   *  bare (un-namespaced) reference — the create popover's "Add to"
   *  picker chooses the scope. */
  scopeLabel: string | null;
}

const CREATABLE_NS_LABEL: Record<string, string> = {
  vault: 'Vault',
  env: 'Environment',
  collection: 'Collection',
  workspace: 'Workspace',
};

/** Returns the create target for `query` when it's a bare name or a
 *  scoped reference to a creatable namespace, else null. Collection
 *  needs an active collection context to be creatable. */
export function detectCreateTarget(query: string, collectionId: string | undefined): CreateTarget | null {
  const parsed = parseReference(query);
  if (!parsed.ok) return null;
  const { namespace, name } = parsed.ref;
  if (!name) return null;
  if (!namespace) return { reference: query, name, scopeLabel: null };
  const scopeLabel = CREATABLE_NS_LABEL[namespace];
  if (!scopeLabel) return null;
  if (namespace === 'collection' && !collectionId) return null;
  return { reference: query, name, scopeLabel };
}
