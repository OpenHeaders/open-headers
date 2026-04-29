/**
 * Validation pipeline for an incoming workspace-export envelope.
 *
 * Discipline (per docs/V5_WORKSPACE_EXPORT_DESIGN.md §4):
 *   - **Fail-closed on the envelope, fail-soft per-entity.** A malformed
 *     envelope rejects the whole import. A single malformed entity
 *     drops to the report and the rest proceeds.
 *
 * Order of gates is load-bearing — each gate runs only if the previous
 * passed:
 *
 *   1. Size cap pre-parse (caller-supplied; default 50 MB raw)
 *   2. Format detection: `JSON.parse` then `YAML.parseDocument`
 *      with `maxAliasCount: 100` (billion-laughs defense)
 *   3. Discriminator: `kind === 'workspace-export'` literal
 *   4. `schemaVersion: 5` literal (hard refuse on anything else)
 *   5. Envelope schema (valibot) — all top-level fields, picklists,
 *      bounded strings, no `v.unknown()`
 *   6. Per-entity schema — every entity validates independently; a
 *      single failure drops to `drops[]` with `path` + `reason`,
 *      siblings continue
 *   7. Crypto envelope validation (when `secrets` is present) —
 *      `iterations ≥ 100_000`, base64url shape, kind picklist
 *
 * Out of scope here:
 *   - Reference integrity / variable-reference scan (informational
 *     gates that drive the missing-deps section in the preview modal,
 *     not parse-time rejects). Lands alongside the importer in PR 2B.
 *   - Untrusted-string rendering — that's a UI-side concern (text
 *     nodes, no markdown, no `dangerouslySetInnerHTML`).
 *
 * Pure function. No platform deps.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import {
  CollectionSchema,
  EnvironmentSchema,
  FolderSchema,
  LiveVariableSchema,
  LiveWorkflowSchema,
  RequestSchema,
  RuleSchema,
  TemplateSchema,
  VaultSchema,
  WorkspaceVariablesSchema,
} from '../schemas/index';
import { CURRENT_EXPORT_FORMAT_VERSION, type WorkspaceExport, WorkspaceExportSchema } from './schema';

/** Default raw-input cap (design §4.1 step 1). 50 MB. */
export const DEFAULT_SIZE_CAP_BYTES = 50 * 1024 * 1024;
/** YAML alias / anchor depth cap (design §4.1 step 2). 100 — defends
 *  against billion-laughs / YAML-bomb attacks. */
export const YAML_MAX_ALIAS_COUNT = 100;

/**
 * Per-entity drop record. Surfaces in the preview modal as "N entities
 * couldn't be imported — review" alongside the importable tree, and
 * lands in the import report so users can tell what didn't make it.
 */
export interface ImportDrop {
  /** Pointer into the envelope, e.g. `entities.rules[3]`. */
  path: string;
  /** Why we dropped it. */
  reason:
    | 'schema-invalid'
    | 'migration-failed'
    | 'missing-required-field'
    | 'unsupported-entity-kind'
    | 'duplicate-uid';
  /** Human-readable details (typically the valibot issue message). */
  details: string;
  /**
   * Optional uid + name pulled from the raw object before validation
   * failed, so the preview modal can label the dropped row even when
   * the entity itself didn't pass schema. Best-effort — both can be
   * absent.
   */
  uid?: string;
  name?: string;
}

export type ParseResult =
  | {
      ok: true;
      export: WorkspaceExport;
      /** Per-entity drops accumulated during gate 6. The envelope is
       *  valid; these are entries that didn't validate against their
       *  own entity schema and were skipped — the rest proceeds. */
      drops: ImportDrop[];
    }
  | {
      ok: false;
      reason:
        | 'size-cap'
        | 'format'
        | 'discriminator'
        | 'schema-version'
        | 'envelope-schema'
        | 'export-format-version'
        | 'crypto-envelope';
      /** Human-readable details for the rejection banner. */
      details: string;
    };

export interface ParseOptions {
  /** Override raw-input cap (default `DEFAULT_SIZE_CAP_BYTES`). */
  sizeCapBytes?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function reject(reason: Exclude<Extract<ParseResult, { ok: false }>['reason'], never>, details: string): ParseResult {
  return { ok: false, reason, details };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Best-effort extract of `uid` and `name` from a raw entity object so a
 * dropped row can still be labelled in the preview. Returns `{}` for
 * pathological inputs.
 */
function dropLabelFor(raw: unknown): Pick<ImportDrop, 'uid' | 'name'> {
  const rec = asRecord(raw);
  if (!rec) return {};
  const uid = typeof rec.uid === 'string' ? rec.uid : undefined;
  const name = typeof rec.name === 'string' ? rec.name : undefined;
  return { ...(uid !== undefined ? { uid } : {}), ...(name !== undefined ? { name } : {}) };
}

function validateEntityArray<T>(
  raw: unknown,
  schema: v.GenericSchema<unknown, T>,
  pathPrefix: string,
  drops: ImportDrop[],
): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  raw.forEach((item, idx) => {
    const parsed = v.safeParse(schema, item);
    if (parsed.success) {
      out.push(parsed.output);
    } else {
      drops.push({
        path: `${pathPrefix}[${idx}]`,
        reason: 'schema-invalid',
        details: parsed.issues.map((i) => i.message).join('; '),
        ...dropLabelFor(item),
      });
    }
  });
  return out;
}

// ── Main entry point ────────────────────────────────────────────────

export function parseWorkspaceExport(input: string, opts: ParseOptions = {}): ParseResult {
  const sizeCap = opts.sizeCapBytes ?? DEFAULT_SIZE_CAP_BYTES;

  // ── Gate 1: size cap ────────────────────────────────────────────
  // UTF-8 byte length is the security-relevant measure (callers may
  // hand us a string that's < N chars but > N bytes for non-ASCII).
  // `TextEncoder` is in every supported runtime (Node 22+, MV3 SW,
  // Electron renderer).
  const byteLength = new TextEncoder().encode(input).length;
  if (byteLength > sizeCap) {
    return reject('size-cap', `Input is ${byteLength} bytes; max allowed is ${sizeCap}`);
  }

  // ── Gate 2: format detection ────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    try {
      const doc = YAML.parseDocument(input);
      if (doc.errors.length > 0) {
        return reject('format', doc.errors.map((e) => e.message).join('; '));
      }
      // `maxAliasCount` lives on `ToJSOptions`, not on parse — billion-
      // laughs blow-up happens during the alias-resolution walk that
      // `toJS()` performs.
      parsed = doc.toJS({ maxAliasCount: YAML_MAX_ALIAS_COUNT });
    } catch (err) {
      return reject('format', err instanceof Error ? err.message : 'YAML parse failed');
    }
  }

  const rec = asRecord(parsed);
  if (!rec) return reject('format', 'Top-level value must be a JSON / YAML object');

  // ── Gate 3: discriminator ───────────────────────────────────────
  if (rec.kind !== 'workspace-export') {
    return reject(
      'discriminator',
      `Expected kind: 'workspace-export'; got ${typeof rec.kind === 'string' ? `'${rec.kind}'` : String(rec.kind)}`,
    );
  }

  // ── Gate 4: schemaVersion ───────────────────────────────────────
  if (rec.schemaVersion !== 5) {
    return reject('schema-version', `Unsupported schemaVersion ${String(rec.schemaVersion)}; importer requires 5`);
  }

  // ── Gate 4b: exportFormatVersion ────────────────────────────────
  // BACKWARD_TRANSITIVE per design §8.1 — accept ≤ current, refuse
  // newer. The envelope schema also enforces a positive integer; we
  // surface the cap rejection separately so the preview modal can
  // render a "this export was made by a newer version" message.
  if (
    typeof rec.exportFormatVersion === 'number' &&
    Number.isInteger(rec.exportFormatVersion) &&
    rec.exportFormatVersion > CURRENT_EXPORT_FORMAT_VERSION
  ) {
    return reject(
      'export-format-version',
      `Export was created with envelope format ${rec.exportFormatVersion}; this importer supports up to ${CURRENT_EXPORT_FORMAT_VERSION}`,
    );
  }

  // ── Gate 5: envelope schema (valibot) ───────────────────────────
  // We strip `entities` from the envelope-schema check and re-validate
  // each entity independently below (gate 6) so a single bad entity
  // doesn't take down the whole envelope. Same posture as the existing
  // `parseEntityArray` helper in core's import package.
  //
  // The envelope schema still validates `kind` / `schemaVersion` /
  // `exportFormatVersion` / `exportId` / `exportedAt` / `source` /
  // `scope` / `notes` / `workspace` / `meta` / `secrets` strictly —
  // those are the load-bearing fields that drive trust signals in the
  // preview.
  const { entities: rawEntities, ...envelopeWithoutEntities } = rec;
  const envelopeShell = {
    ...envelopeWithoutEntities,
    // Placeholder satisfies the envelope schema; we replace it after
    // gate 6 with the validated arrays.
    entities: emptyEntitiesShell(),
  };
  const envelopeParsed = v.safeParse(WorkspaceExportSchema, envelopeShell);
  if (!envelopeParsed.success) {
    return reject('envelope-schema', envelopeParsed.issues.map((i) => i.message).join('; '));
  }

  // ── Gate 6: per-entity schema (fail-soft) ───────────────────────
  const drops: ImportDrop[] = [];
  const rawEntitiesRec = asRecord(rawEntities) ?? {};
  const collections = validateEntityArray(rawEntitiesRec.collections, CollectionSchema, 'entities.collections', drops);
  const folders = validateEntityArray(rawEntitiesRec.folders, FolderSchema, 'entities.folders', drops);
  const rules = validateEntityArray(rawEntitiesRec.rules, RuleSchema, 'entities.rules', drops);
  const requests = validateEntityArray(rawEntitiesRec.requests, RequestSchema, 'entities.requests', drops);
  const templates = validateEntityArray(rawEntitiesRec.templates, TemplateSchema, 'entities.templates', drops);
  const environments = validateEntityArray(
    rawEntitiesRec.environments,
    EnvironmentSchema,
    'entities.environments',
    drops,
  );
  const liveWorkflows = validateEntityArray(
    rawEntitiesRec.liveWorkflows,
    LiveWorkflowSchema,
    'entities.liveWorkflows',
    drops,
  );
  const liveVariables = validateEntityArray(
    rawEntitiesRec.liveVariables,
    LiveVariableSchema,
    'entities.liveVariables',
    drops,
  );

  const workspaceVarsParsed = v.safeParse(WorkspaceVariablesSchema, rawEntitiesRec.workspaceVars);
  let workspaceVars: v.InferOutput<typeof WorkspaceVariablesSchema>;
  if (workspaceVarsParsed.success) {
    workspaceVars = workspaceVarsParsed.output;
  } else {
    drops.push({
      path: 'entities.workspaceVars',
      reason: 'schema-invalid',
      details: workspaceVarsParsed.issues.map((i) => i.message).join('; '),
    });
    workspaceVars = { schemaVersion: 5, variables: [] };
  }

  let vault: v.InferOutput<typeof VaultSchema> | undefined;
  if (rawEntitiesRec.vault !== undefined) {
    const vaultParsed = v.safeParse(VaultSchema, rawEntitiesRec.vault);
    if (vaultParsed.success) {
      vault = vaultParsed.output;
    } else {
      drops.push({
        path: 'entities.vault',
        reason: 'schema-invalid',
        details: vaultParsed.issues.map((i) => i.message).join('; '),
      });
    }
  }

  // ── Compose the validated WorkspaceExport ───────────────────────
  const exportObj: WorkspaceExport = {
    ...envelopeParsed.output,
    entities: {
      collections,
      folders,
      rules,
      requests,
      templates,
      environments,
      workspaceVars,
      liveWorkflows,
      liveVariables,
      ...(vault !== undefined ? { vault } : {}),
    },
  };

  // ── Gate 7: crypto envelope (extra checks beyond the schema) ────
  // The envelope schema already enforces `iterations ≥ 100_000`,
  // base64url shape, and the `kind` picklist. This gate exists as a
  // hook for future runtime checks (e.g. ciphertext length sanity)
  // without requiring an envelope-schema change.

  return { ok: true, export: exportObj, drops };
}

// ── Internal: entity-shell placeholder ──────────────────────────────

/**
 * The envelope schema requires `entities` to be present and shaped, but
 * gate 6 validates entities independently. Give the envelope-schema
 * gate something it accepts, then replace it with the per-entity
 * results.
 */
function emptyEntitiesShell(): WorkspaceExport['entities'] {
  return {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    workspaceVars: { schemaVersion: 5, variables: [] },
    liveWorkflows: [],
    liveVariables: [],
  };
}
