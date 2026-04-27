/**
 * Pure builder for the workspace-export envelope.
 *
 * No storage reads, no platform deps — the SW caller hands the builder
 * the data it wants exported. Tests can call this directly with hand-
 * built fixtures to assert envelope shape, ordering, and strip rules.
 *
 * What the builder strips (every export, regardless of scope):
 *   - OAuth2 `clientSecret` from any `Request.auth.type === 'oauth2'`
 *     (always — recipient enters their own at first auth, per §3.1).
 *   - `path` reconstructed from `toFolderName(name, uid)` so the value
 *     is canonical regardless of what the caller passed in.
 *
 * What the builder does NOT do (lands in later PRs):
 *   - Encryption of the vault block (PR 4 wires `crypto.ts`).
 *   - Plaintext-vault include (PR 4).
 *   - Transitive-dependency expansion for selection / collection scopes
 *     (caller pre-resolves; builder is intentionally dumb).
 *
 * The builder is `WorkspaceExportSchema`-shaped on output — callers
 * still parse the result through valibot before emitting bytes if they
 * want runtime guarantees, but the builder itself produces a valid
 * envelope by construction.
 */

import type {
  Collection,
  Environment,
  Folder,
  LiveVariable,
  LiveWorkflow,
  Request,
  Rule,
  Template,
  Vault,
  WorkspaceVariables,
} from '../types/v5/index';
import { generateUid, toFolderName } from '../utils/workspace';
import { CURRENT_EXPORT_FORMAT_VERSION, type WorkspaceExport } from './schema';

// ── Builder input ───────────────────────────────────────────────────

export interface BuildWorkspaceExportInput {
  /** Caller-resolved `now`, so tests can pin `exportedAt`. */
  exportedAt: string;
  /** Caller-resolved `exportId`; defaults to a fresh uid if omitted. */
  exportId?: string;
  source: {
    app: 'extension' | 'desktop';
    appVersion: string;
    platform: 'chrome' | 'firefox' | 'edge' | 'safari' | 'electron';
    workspaceLabel?: string;
  };
  scope: 'workspace' | 'collection' | 'selection';
  notes?: string;
  workspace: {
    uid: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    defaultEnvironmentId?: string;
  };
  entities: {
    collections: Collection[];
    folders: Folder[];
    rules: Rule[];
    requests: Request[];
    templates: Template[];
    environments: Environment[];
    workspaceVars: WorkspaceVariables;
    liveWorkflows: LiveWorkflow[];
    liveVariables: LiveVariable[];
    /**
     * Vault is omitted by default. PR 4 wires the encrypted /
     * plaintext include modes — for now, passing `vault` here is a
     * no-op (the redaction enum is forced to `'omitted'`).
     */
    vault?: Vault;
  };
}

export interface BuildWorkspaceExportOptions {
  /**
   * Vault include mode. PR 1 only honors `'omitted'`; passing
   * `'encrypted'` or `'plaintext'` throws so callers can't silently
   * ship secrets through an unfinished pipeline.
   */
  vaultMode?: 'omitted' | 'encrypted' | 'plaintext';
}

// ── Strip helpers ───────────────────────────────────────────────────

function stripOAuthClientSecret<R extends Request>(req: R): R {
  if (req.auth?.type !== 'oauth2') return req;
  // Spread-omit: produce a new auth object without `clientSecret`.
  const { clientSecret: _omitted, ...authWithoutSecret } = req.auth;
  return { ...req, auth: authWithoutSecret } as R;
}

/**
 * Canonicalize the leaf segment of `currentPath` to `toFolderName(name,
 * uid)` while preserving the parent path. This way an entity passed in
 * with a stale or non-canonical leaf is normalized, but the tree
 * prefix (`rules/...` / `requests/...` / `templates/...`) and the
 * parent collection / folder slug-uids stay intact — which is what
 * the importer relies on for tree affiliation (see
 * `yaml.ts` header). When `currentPath` is empty, the leaf becomes
 * the whole path.
 */
function canonicalLeafPath(currentPath: string | undefined, name: string, uid: string): string {
  const leaf = toFolderName(name, uid);
  if (!currentPath) return leaf;
  const idx = currentPath.lastIndexOf('/');
  if (idx === -1) return leaf;
  return `${currentPath.substring(0, idx)}/${leaf}`;
}

function withCanonicalPath<E extends { name: string; uid: string; path?: string }>(entity: E): E {
  return { ...entity, path: canonicalLeafPath(entity.path, entity.name, entity.uid) };
}

// ── Build ───────────────────────────────────────────────────────────

export function buildWorkspaceExport(
  input: BuildWorkspaceExportInput,
  opts: BuildWorkspaceExportOptions = {},
): WorkspaceExport {
  const vaultMode = opts.vaultMode ?? 'omitted';
  if (vaultMode !== 'omitted') {
    throw new Error(
      `Vault include mode '${vaultMode}' is not implemented yet (lands in PR 4). ` +
        'Only "omitted" is supported in PR 1.',
    );
  }

  const requests = input.entities.requests.map((req) => withCanonicalPath(stripOAuthClientSecret(req)));
  const collections = input.entities.collections.map(withCanonicalPath);
  const folders = input.entities.folders.map(withCanonicalPath);
  const rules = input.entities.rules.map(withCanonicalPath);
  const templates = input.entities.templates.map(withCanonicalPath);
  const environments = input.entities.environments.map(withCanonicalPath);

  const exportObj: WorkspaceExport = {
    kind: 'workspace-export',
    schemaVersion: 5,
    exportFormatVersion: CURRENT_EXPORT_FORMAT_VERSION,
    exportId: input.exportId ?? generateUid(),
    exportedAt: input.exportedAt,
    source: {
      app: input.source.app,
      appVersion: input.source.appVersion,
      platform: input.source.platform,
      ...(input.source.workspaceLabel !== undefined ? { workspaceLabel: input.source.workspaceLabel } : {}),
    },
    scope: input.scope,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    workspace: {
      uid: input.workspace.uid,
      name: input.workspace.name,
      ...(input.workspace.description !== undefined ? { description: input.workspace.description } : {}),
      ...(input.workspace.color !== undefined ? { color: input.workspace.color } : {}),
      ...(input.workspace.icon !== undefined ? { icon: input.workspace.icon } : {}),
      ...(input.workspace.defaultEnvironmentId !== undefined
        ? { defaultEnvironmentId: input.workspace.defaultEnvironmentId }
        : {}),
    },
    entities: {
      collections,
      folders,
      environments,
      workspaceVars: input.entities.workspaceVars,
      templates,
      requests,
      rules,
      liveWorkflows: input.entities.liveWorkflows,
      liveVariables: input.entities.liveVariables,
    },
    meta: {
      redactions: {
        vault: 'omitted',
        liveCache: 'omitted',
        oauthTokens: 'omitted',
        totpCooldowns: 'omitted',
      },
      counts: {
        rules: rules.length,
        requests: requests.length,
        environments: environments.length,
        liveWorkflows: input.entities.liveWorkflows.length,
        liveVariables: input.entities.liveVariables.length,
        templates: templates.length,
        secrets: 0,
      },
    },
  };

  return exportObj;
}
