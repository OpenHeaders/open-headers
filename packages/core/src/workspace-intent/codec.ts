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
 *   #/create-environment     → create-environment
 *   #/collection-vars/<uid>  → open-collection-vars
 *   #/request-collection-vars/<uid>  → open-request-collection-vars
 *   #/template-collection-vars/<uid>  → open-template-collection-vars
 *   #/request/<uid>          → open-request-editor
 *   #/settings               → open-settings (no target)
 *   #/settings/<key>         → open-settings with settingKey
 *   #/settings/category/<id> → open-settings with categoryId
 *   #/workspaces             → open-workspace-manager
 *   #/export                 → open-export-modal
 *   #/import-modal          → open-import-modal
 *   #/workspace-vars         → open-workspace-vars
 *   #/vault                  → open-vault
 *   #/test/<runId>           → open-run-report
 *   #/flow/<scope>           → open-rule-flow
 *   #/flow/<scope>/<...url>  → open-rule-flow with url
 *   #/live-variable/<uid>    → edit-live-variable
 *   #/live-workflow/<uid>    → edit-live-workflow
 *   #/create-live-variable   → create-live-variable (no seed)
 *   #/create-live-variable/<reqUid> → create-live-variable with seed request
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

    case 'create-environment':
      return buildIntent({ kind: 'create-environment' });

    case 'collection-vars':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-collection-vars', uid: rest[0] });

    case 'request-collection-vars':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-request-collection-vars', uid: rest[0] });

    case 'template-collection-vars':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'open-template-collection-vars', uid: rest[0] });

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

    case 'export':
      return buildIntent({ kind: 'open-export-modal' });

    case 'import-modal':
      return buildIntent({ kind: 'open-import-modal' });

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

    case 'live-variable':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'edit-live-variable', uid: rest[0] });

    case 'live-workflow':
      if (!rest[0]) return null;
      return buildIntent({ kind: 'edit-live-workflow', uid: rest[0] });

    case 'create-live-variable': {
      if (rest.length === 0) return buildIntent({ kind: 'create-live-variable' });
      return buildIntent({ kind: 'create-live-variable', seedRequestUid: rest[0] });
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

    case 'create-environment':
      return '#/create-environment';

    case 'open-collection-vars':
      return `#/collection-vars/${encodeSegment(intent.uid)}`;

    case 'open-request-collection-vars':
      return `#/request-collection-vars/${encodeSegment(intent.uid)}`;

    case 'open-template-collection-vars':
      return `#/template-collection-vars/${encodeSegment(intent.uid)}`;

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

    case 'open-export-modal':
      return '#/export';

    case 'open-import-modal':
      return '#/import-modal';

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

    case 'edit-live-variable':
      return `#/live-variable/${encodeSegment(intent.uid)}`;

    case 'edit-live-workflow':
      return `#/live-workflow/${encodeSegment(intent.uid)}`;

    case 'create-live-variable':
      return intent.seedRequestUid
        ? `#/create-live-variable/${encodeSegment(intent.seedRequestUid)}`
        : '#/create-live-variable';
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

/**
 * Workspace-bound intent — the URL-pinned binding form. The `/ws/<wsId>/`
 * prefix lets a workbench tab encode its editing-scope workspace in the
 * hash, so cold mount can resolve the binding synchronously, the SW
 * navigator can match candidate tabs by parsing their URL, and tab
 * restore / bookmarks preserve the binding without runtime state.
 *
 * `workspaceId` is optional — bare hashes (legacy, no binding) parse to
 * `{ intent }` with no workspaceId, and the workbench falls back to the
 * global active workspace. Same fallback applies when the wsId in the
 * URL no longer corresponds to an existing workspace (deleted while
 * bookmarked).
 */
export interface BoundIntent {
  workspaceId?: string;
  intent: WorkspaceIntent;
}

// Workspace ids match the hex-uid convention enforced by the schema's
// uid validators; we keep this regex permissive here (any URL-safe
// non-empty segment) and let the consuming workbench validate against
// the actual workspace list. The codec's job is shape, not existence.
const WS_PREFIX_PATTERN = /^ws$/;

/**
 * Parse a URL hash into a {@link BoundIntent}. Recognizes the optional
 * `/ws/<wsId>/` prefix; if absent, returns `{ intent }` with no
 * workspaceId (legacy bookmark compat). Returns null when the inner
 * intent fails to parse.
 */
export function hashToBoundIntent(rawHash: string): BoundIntent | null {
  const segments = parseHashSegments(rawHash);
  if (segments.length >= 2 && WS_PREFIX_PATTERN.test(segments[0])) {
    const workspaceId = segments[1];
    const remainder = segments.slice(2);
    const innerHash = remainder.length === 0 ? '' : `#/${remainder.map(encodeSegment).join('/')}`;
    const intent = hashToIntent(innerHash);
    if (!intent) return null;
    return { workspaceId, intent };
  }
  // No `/ws/` prefix — fall back to the bare-intent parse.
  const intent = hashToIntent(rawHash);
  if (!intent) return null;
  return { intent };
}

/**
 * Encode a {@link BoundIntent} as a URL hash, including the leading `#`.
 * `workspaceId` undefined → bare intent hash (legacy form). Defined →
 * `#/ws/<wsId>/<intent-tail>`, which round-trips through
 * {@link hashToBoundIntent}.
 */
export function boundIntentToHash(bound: BoundIntent): string {
  const innerHash = intentToHash(bound.intent);
  if (bound.workspaceId === undefined) return innerHash;
  // innerHash is either '' (open-workspace) or starts with '#/'.
  const tail = innerHash === '' ? '' : `/${innerHash.slice(2)}`;
  return `#/ws/${encodeSegment(bound.workspaceId)}${tail}`;
}
