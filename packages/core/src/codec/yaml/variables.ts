/**
 * WorkspaceVariables + Vault codecs.
 *
 * Single-file entities (no secret split here — workspace-level secrets
 * live in `workspace-vars.secret.yaml` via the Vault codec; environment
 * secrets live in `environments/<name>.secret.yaml` via the Environment
 * codec).
 *
 *   workspace-vars.yaml
 *   ───────────────────
 *   schemaVersion: 5
 *   variables:
 *     - uid: a3f7c1e9
 *       name: API_URL
 *       value: https://api.openheaders.com
 *       type: default
 *
 *   workspace-vars.secret.yaml
 *   ──────────────────────────
 *   schemaVersion: 5
 *   secrets:
 *     - uid: 9d2b8e1f
 *       kind: string
 *       name: API_TOKEN
 *       value: <plaintext-at-rest>
 *
 * Hand-edited rows without `uid` get one minted at parse time; the next
 * save round-trips the minted value back to disk.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { VaultSchema, WorkspaceVariablesSchema } from '../../schemas/variable';
import type { Vault, VaultSecret, WorkspaceVariables } from '../../types/variable';
import { generateUid } from '../../utils/workspace';
import { emitCanonicalYaml } from './canonical-emit';
import { VAULT_FIELD_ORDER, WORKSPACE_VARIABLES_FIELD_ORDER } from './ordering';
import { extractUnknownFields, unknownFieldsOf } from './unknown-fields';

// ── WorkspaceVariables ─────────────────────────────────────────────

export function parseWorkspaceVariables(yaml: string): ParsedDocument<WorkspaceVariables> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  if (Array.isArray(raw.variables)) {
    raw.variables = raw.variables.map(mintVariableUidIfMissing);
  }
  const value = v.parse(WorkspaceVariablesSchema, raw);
  return makeParsed(value, extractUnknownFields(raw, WorkspaceVariablesSchema, WORKSPACE_VARIABLES_FIELD_ORDER));
}

export function serializeWorkspaceVariables(write: WriteableDocument<WorkspaceVariables>): string {
  return emitCanonicalYaml(
    write.value,
    WorkspaceVariablesSchema,
    WORKSPACE_VARIABLES_FIELD_ORDER,
    unknownFieldsOf(write),
  );
}

// ── Vault ─────────────────────────────────────────────────────────

export function parseVault(yaml: string): ParsedDocument<Vault> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  if (Array.isArray(raw.secrets)) {
    raw.secrets = raw.secrets.map(mintSecretUidIfMissing);
  }
  const value = v.parse(VaultSchema, raw);
  return makeParsed(value, extractUnknownFields(raw, VaultSchema, VAULT_FIELD_ORDER));
}

export function serializeVault(write: WriteableDocument<Vault>): string {
  return emitCanonicalYaml(write.value, VaultSchema, VAULT_FIELD_ORDER, unknownFieldsOf(write));
}

// ── Internals ─────────────────────────────────────────────────────

function mintVariableUidIfMissing(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.uid === 'string') return obj;
  return { ...obj, uid: generateUid() };
}

function mintSecretUidIfMissing(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.uid === 'string') return obj;
  return { ...obj, uid: generateUid() } as VaultSecret;
}
