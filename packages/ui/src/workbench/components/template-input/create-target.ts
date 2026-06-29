/**
 * Create-action detection — when a scoped reference names a variable that
 * doesn't exist yet (`{{vault.okay}}` with no `vault.okay` defined), the
 * suggestion popover offers to create it in that scope instead of a
 * dead-end "No matches". Only the user-creatable namespaces qualify.
 */

import { parseReference } from '@openheaders/core/variables';

export interface CreateTarget {
  /** The full reference inside the braces, e.g. `vault.okay`. */
  reference: string;
  /** The variable name without its namespace prefix, e.g. `okay`. */
  name: string;
  /** Human label for the destination scope, e.g. `Vault`. */
  scopeLabel: string;
}

const CREATABLE_NS_LABEL: Record<string, string> = {
  vault: 'Vault',
  env: 'Environment',
  collection: 'Collection',
  workspace: 'Workspace',
};

/** Returns the create target for `query` when it's a scoped reference to a
 *  creatable namespace with a non-empty name, else null. Collection needs
 *  an active collection context to be creatable. */
export function detectCreateTarget(query: string, collectionId: string | undefined): CreateTarget | null {
  const parsed = parseReference(query);
  if (!parsed.ok) return null;
  const { namespace, name } = parsed.ref;
  if (!namespace || !name) return null;
  const scopeLabel = CREATABLE_NS_LABEL[namespace];
  if (!scopeLabel) return null;
  if (namespace === 'collection' && !collectionId) return null;
  return { reference: query, name, scopeLabel };
}
