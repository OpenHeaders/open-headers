/**
 * URL-hash codec for `WorkspaceIntent`.
 *
 * `intentToHash(intent)` produces a human-readable fragment that's
 * pasteable in the address bar and bookmarkable; `hashToIntent(hash)`
 * is the inverse. The format matches every route the workspace's
 * legacy `useInitialHashRoute` recognized, so migration is byte-compatible
 * with existing bookmarks and share links.
 *
 * Route table:
 *   #                        → open-workspace (no destination)
 *   #/docs/<section>         → open-docs
 *   #/edit/<uid>             → edit-rule
 *   #/create/<type>          → create-rule
 *   #/create/<type>/<tpl>    → create-rule with templateKey
 *   #/create/<type>/draft-<n>→ create-rule with draftNonce
 *   #/environment/<uid>      → edit-environment
 *   #/collection-vars/<uid>  → open-collection-vars
 *   #/request/<uid>          → open-request-editor
 *   #/settings               → open-settings (no target)
 *   #/settings/<key>         → open-settings with settingKey
 *   #/settings/category/<id> → open-settings with categoryId
 *   #/workspaces             → open-workspace-manager
 *   #/workspace-vars         → open-workspace-vars
 *   #/vault                  → open-vault
 *   #/test/<runId>           → open-run-report
 *   #/flow/<scope>           → open-rule-flow
 *   #/flow/<scope>/<...url>  → open-rule-flow with url
 *
 * Unknown hashes return `null`, not a throw — callers decide whether
 * to treat that as "nothing to dispatch" (valid on any page load) or
 * an error (rare, surfaced via observability).
 */

import * as v from 'valibot';
import { type WorkspaceIntent, WorkspaceIntentSchema } from './schema';

/**
 * Normalize a raw `window.location.hash` (or any fragment) to the path
 * segments after the `#/` prefix. Accepts `#/foo/bar`, `#foo/bar`,
 * `/foo/bar`, or `foo/bar` — all yield `['foo','bar']`. Empty input
 * returns `[]`.
 */
function parseHashSegments(rawHash: string): string[] {
  const stripped = rawHash.replace(/^#\/?/, '').replace(/^\/+/, '');
  if (stripped === '') return [];
  return stripped.split('/').map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      // Malformed percent-escape; keep the raw segment so validation can
      // reject it downstream instead of throwing here.
      return s;
    }
  });
}

/** Encode a segment for inclusion in the hash. Preserves URL-legal chars. */
function encodeSegment(s: string): string {
  return encodeURIComponent(s);
}

/**
 * Parse a URL hash into a `WorkspaceIntent`. Returns null if the hash
 * is empty, unrecognized, or fails schema validation. Side-effect free.
 */
export function hashToIntent(rawHash: string): WorkspaceIntent | null {
  const segments = parseHashSegments(rawHash);

  // Empty hash = "open workspace" with no specific destination.
  if (segments.length === 0) return buildIntent({ kind: 'open-workspace' });

  const [head, ...rest] = segments;

  switch (head) {
    case 'docs':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-docs', section: rest[0] });

    case 'edit':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'edit-rule', uid: rest[0] });

    case 'create': {
      const [type, third] = rest;
      if (!type) return null;
      if (third?.startsWith('draft-')) {
        return buildIntent({
          kind: 'create-rule',
          ruleType: type,
          draftNonce: third.slice('draft-'.length),
        });
      }
      if (third) {
        return buildIntent({ kind: 'create-rule', ruleType: type, templateKey: third });
      }
      return buildIntent({ kind: 'create-rule', ruleType: type });
    }

    case 'environment':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'edit-environment', uid: rest[0] });

    case 'collection-vars':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-collection-vars', uid: rest[0] });

    case 'request':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-request-editor', uid: rest[0] });

    case 'settings': {
      if (rest.length === 0) return buildIntent({ kind: 'open-settings' });
      if (rest[0] === 'category' && rest[1]) {
        return buildIntent({ kind: 'open-settings', target: { categoryId: rest[1] } });
      }
      return buildIntent({ kind: 'open-settings', target: { settingKey: rest[0] } });
    }

    case 'workspaces':
      return buildIntent({ kind: 'open-workspace-manager' });

    case 'workspace-vars':
      return buildIntent({ kind: 'open-workspace-vars' });

    case 'vault':
      return buildIntent({ kind: 'open-vault' });

    case 'test':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-run-report', runId: rest[0] });

    case 'flow': {
      const [scope, ...trailingParts] = rest;
      if (!scope) return null;
      const base: Record<string, unknown> = { kind: 'open-rule-flow', scope };
      if (trailingParts.length > 0) {
        // `this-page` trailing segments are a full URL (may contain
        // `/`). Other scopes encode a single entity uid.
        if (scope === 'this-page') base.url = trailingParts.join('/');
        else base.entityId = trailingParts[0];
      }
      return buildIntent(base);
    }

    default:
      return null;
  }
}

/**
 * Validate a candidate intent object against the schema. Returns the
 * parsed intent on success, null on failure. Used by `hashToIntent`
 * and the SW navigator's RPC boundary so malformed payloads can never
 * propagate inward.
 */
function buildIntent(candidate: Record<string, unknown>): WorkspaceIntent | null {
  const result = v.safeParse(WorkspaceIntentSchema, candidate);
  return result.success ? result.output : null;
}

/**
 * Encode a `WorkspaceIntent` as a URL hash fragment, including the
 * leading `#`. `open-workspace` with no payload yields `''` (empty
 * fragment) so a tab URL like `workspace.html` is the canonical
 * "home" form.
 */
export function intentToHash(intent: WorkspaceIntent): string {
  switch (intent.kind) {
    case 'open-workspace':
      return '';

    case 'open-docs':
      return `#/docs/${encodeSegment(intent.section)}`;

    case 'edit-rule':
      return `#/edit/${encodeSegment(intent.uid)}`;

    case 'create-rule': {
      const parts = ['create', encodeSegment(intent.ruleType)];
      if (intent.draftNonce) parts.push(`draft-${encodeSegment(intent.draftNonce)}`);
      else if (intent.templateKey) parts.push(encodeSegment(intent.templateKey));
      return `#/${parts.join('/')}`;
    }

    case 'edit-environment':
      return `#/environment/${encodeSegment(intent.uid)}`;

    case 'open-collection-vars':
      return `#/collection-vars/${encodeSegment(intent.uid)}`;

    case 'open-request-editor':
      return `#/request/${encodeSegment(intent.uid)}`;

    case 'open-settings':
      if (!intent.target) return '#/settings';
      if ('categoryId' in intent.target) {
        return `#/settings/category/${encodeSegment(intent.target.categoryId)}`;
      }
      return `#/settings/${encodeSegment(intent.target.settingKey)}`;

    case 'open-workspace-manager':
      return '#/workspaces';

    case 'open-workspace-vars':
      return '#/workspace-vars';

    case 'open-vault':
      return '#/vault';

    case 'open-run-report':
      return `#/test/${encodeSegment(intent.runId)}`;

    case 'open-rule-flow': {
      const parts = ['flow', encodeSegment(intent.scope)];
      if (intent.scope === 'this-page' && intent.url) {
        // URL segments are split on `/` — encode each piece individually
        // so `://` and query strings round-trip intact.
        for (const piece of intent.url.split('/')) parts.push(encodeSegment(piece));
      } else if (intent.entityId) {
        parts.push(encodeSegment(intent.entityId));
      }
      return `#/${parts.join('/')}`;
    }
  }
}

/**
 * Validate an already-parsed candidate (e.g. from a message handler).
 * Exported for call sites that receive an intent as structured data
 * rather than as a URL hash.
 */
export function parseIntent(candidate: unknown): WorkspaceIntent | null {
  const result = v.safeParse(WorkspaceIntentSchema, candidate);
  return result.success ? result.output : null;
}
