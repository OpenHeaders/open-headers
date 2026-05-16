/**
 * Sensitive-path predicates used by the Activity Feed classifier
 * (F2.c) to decide when an inbound mutation rotates a secret.
 *
 * Two-axis policy:
 *
 *   1. **Path-only sensitive** — vault secret values, vault TOTP seeds,
 *      OAuth bundle access/refresh tokens. The path alone fully
 *      determines sensitivity; no sibling-field inspection needed.
 *   2. **Context-dependent sensitive** — rule header-mod values
 *      (only sensitive when the mod's `headerName` is an auth /
 *      cookie / API-key header) and environment / collection variable
 *      values (only when `type === 'secret'`). These need the
 *      enclosing record for context, so we expose a separate item-aware
 *      predicate.
 *
 * Conservative-false-positive design — the badge surfaces a yellow
 * "rotated" highlight, so a false positive is mildly noisy and a false
 * negative silently undersells the change. Both fail gracefully: the
 * underlying `edit-entity` row is always produced by the structural
 * classifier, so missing a highlight just downgrades a row from
 * highlighted to plain.
 */

import { COLLECTION_ENTITY_TYPE, COLLECTION_VARS_PATH } from '../mutators/collection/types';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE } from '../mutators/environment/types';
import { OAUTH_BUNDLE_ENTITY_TYPE } from '../mutators/oauth-bundle/types';
import { RULE_ENTITY_TYPE } from '../mutators/rule/types';
import { VAULT_ENTITY_TYPE } from '../mutators/vault/types';
import { WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_PATH } from '../mutators/workspace-variables/types';

/** Header names whose values count as secrets. Case-insensitive match. */
const SENSITIVE_HEADER_NAMES = new Set<string>([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
]);

/** True iff `name` (case-insensitive) is a known auth / cookie / API-key header. */
export function isSensitiveHeaderName(name: string | undefined | null): boolean {
  if (typeof name !== 'string') return false;
  return SENSITIVE_HEADER_NAMES.has(name.trim().toLowerCase());
}

/**
 * Path-only sensitive predicate — true iff the leaf path on the given
 * entity type unconditionally holds secret material. Used by the
 * classifier to scan a materialized entity for sensitive leaves
 * without needing sibling-record context.
 */
export function isSensitiveLeafPath(entityType: string, leafPath: string): boolean {
  if (entityType === VAULT_ENTITY_TYPE) {
    // vault.secrets.<uid>.value  (string secret)
    // vault.secrets.<uid>.seed   (TOTP seed)
    return /^secrets\.[^.]+\.(value|seed)$/.test(leafPath);
  }
  if (entityType === OAUTH_BUNDLE_ENTITY_TYPE) {
    // oauth-bundle.tokens.<configId>.<field> — access + refresh tokens
    return /^tokens\.[^.]+\.(accessToken|refreshToken|idToken)$/.test(leafPath);
  }
  return false;
}

/**
 * Item-aware sensitive predicate for set members where sensitivity is
 * contextual (rule header-mods, env-secret variables).
 *
 * `setPath` is the parent set path (`action.requestHeaders`,
 * `action.responseHeaders`, `variables`). `item` is the materialized
 * set member.
 */
export function isSensitiveSetMember(entityType: string, setPath: string, item: unknown): boolean {
  if (!isPlainObject(item)) return false;

  if (entityType === RULE_ENTITY_TYPE && (setPath === 'action.requestHeaders' || setPath === 'action.responseHeaders')) {
    const name = (item as { headerName?: unknown }).headerName;
    return isSensitiveHeaderName(typeof name === 'string' ? name : undefined);
  }

  const isVariableSetPath =
    (entityType === ENVIRONMENT_ENTITY_TYPE && setPath === ENV_VARS_PATH) ||
    (entityType === WORKSPACE_VARIABLES_ENTITY_TYPE && setPath === WORKSPACE_VARIABLES_PATH) ||
    (entityType === COLLECTION_ENTITY_TYPE && setPath === COLLECTION_VARS_PATH);
  if (isVariableSetPath) {
    return (item as { type?: unknown }).type === 'secret';
  }

  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Schema of one sensitive set path on an entity. Driven by data so we
 * can add entity types without branching control flow.
 *
 * - `setPath` — the parent path the items live at on the materialized
 *   data.
 * - `sensitiveFields` — which leaf field names on each item count as
 *   secret material.
 * - `gate?` — optional per-item predicate. When omitted, every item at
 *   `setPath` is treated as sensitive (vault, oauth-bundle). When
 *   present, the item must pass the gate (rule headers gate on
 *   `headerName`; variables gate on `type === 'secret'`).
 */
interface SensitiveSetPath {
  setPath: string;
  sensitiveFields: readonly string[];
  gate?: (item: Record<string, unknown>) => boolean;
}

const SENSITIVE_PATHS_BY_ENTITY: Record<string, readonly SensitiveSetPath[]> = {
  [VAULT_ENTITY_TYPE]: [{ setPath: 'secrets', sensitiveFields: ['value', 'seed'] }],
  [OAUTH_BUNDLE_ENTITY_TYPE]: [{ setPath: 'tokens', sensitiveFields: ['accessToken', 'refreshToken', 'idToken'] }],
  [RULE_ENTITY_TYPE]: [
    {
      setPath: 'action.requestHeaders',
      sensitiveFields: ['value'],
      gate: (item) => isSensitiveHeaderName(typeof item.headerName === 'string' ? item.headerName : undefined),
    },
    {
      setPath: 'action.responseHeaders',
      sensitiveFields: ['value'],
      gate: (item) => isSensitiveHeaderName(typeof item.headerName === 'string' ? item.headerName : undefined),
    },
  ],
  [ENVIRONMENT_ENTITY_TYPE]: [
    { setPath: ENV_VARS_PATH, sensitiveFields: ['value'], gate: (item) => item.type === 'secret' },
  ],
  [WORKSPACE_VARIABLES_ENTITY_TYPE]: [
    { setPath: WORKSPACE_VARIABLES_PATH, sensitiveFields: ['value'], gate: (item) => item.type === 'secret' },
  ],
  [COLLECTION_ENTITY_TYPE]: [
    { setPath: COLLECTION_VARS_PATH, sensitiveFields: ['value'], gate: (item) => item.type === 'secret' },
  ],
};

/**
 * Detect a sensitive-field rotation between `prior` and `next` data
 * for `entityType`. Returns `true` when at least one sensitive field
 * changed value (and prior held a non-empty value) on any item that
 * passes the gate.
 *
 * Items are matched by `uid` — the canonical set-member identity
 * across the codebase. Items present only on one side don't count
 * (those are creates / removes, which the structural classifier
 * already covers; rotation specifically means "same row, value
 * replaced").
 */
export function detectSensitiveRotation(
  entityType: string,
  prior: unknown,
  next: unknown,
): boolean {
  const specs = SENSITIVE_PATHS_BY_ENTITY[entityType];
  if (!specs) return false;
  if (!isPlainObject(prior) || !isPlainObject(next)) return false;

  for (const spec of specs) {
    const priorItems = readSetItems(prior, spec.setPath);
    const nextItems = readSetItems(next, spec.setPath);
    if (priorItems.length === 0) continue;

    const nextByUid = new Map<string, Record<string, unknown>>();
    for (const it of nextItems) {
      const uid = typeof it.uid === 'string' ? it.uid : null;
      if (uid !== null) nextByUid.set(uid, it);
    }

    for (const priorItem of priorItems) {
      const uid = typeof priorItem.uid === 'string' ? priorItem.uid : null;
      if (uid === null) continue;
      const nextItem = nextByUid.get(uid);
      if (!nextItem) continue;
      if (spec.gate && !spec.gate(priorItem) && !spec.gate(nextItem)) continue;
      for (const field of spec.sensitiveFields) {
        const priorVal = priorItem[field];
        const nextVal = nextItem[field];
        if (!isNonEmptySecret(priorVal)) continue;
        if (priorVal !== nextVal) return true;
      }
    }
  }
  return false;
}

function readSetItems(data: Record<string, unknown>, setPath: string): Record<string, unknown>[] {
  const segments = setPath.split('.');
  let cursor: unknown = data;
  for (const seg of segments) {
    if (!isPlainObject(cursor)) return [];
    cursor = cursor[seg];
  }
  if (!Array.isArray(cursor)) return [];
  return cursor.filter(isPlainObject);
}

function isNonEmptySecret(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}
