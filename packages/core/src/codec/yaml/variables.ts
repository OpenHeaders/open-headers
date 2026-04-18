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
 *     - name: API_URL
 *       value: https://api.openheaders.io
 *       type: default
 *
 *   workspace-vars.secret.yaml
 *   ──────────────────────────
 *   schemaVersion: 5
 *   secrets:
 *     - name: API_TOKEN
 *       value: <plaintext-at-rest>
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { VaultSchema, WorkspaceVariablesSchema } from '../../schemas/variable';
import type { Vault, WorkspaceVariables } from '../../types/v5/variable';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { VAULT_FIELD_ORDER, WORKSPACE_VARIABLES_FIELD_ORDER } from './ordering';

// ── WorkspaceVariables ─────────────────────────────────────────────

export function parseWorkspaceVariables(yaml: string): ParsedDocument<WorkspaceVariables> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const value = v.parse(WorkspaceVariablesSchema, raw);
  return makeParsed(value, doc);
}

export function serializeWorkspaceVariables(write: WriteableDocument<WorkspaceVariables>): string {
  const doc = write.raw
    ? (write.raw as YAML.Document)
    : buildFreshDocument(write.value, WORKSPACE_VARIABLES_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, WORKSPACE_VARIABLES_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}

// ── Vault ─────────────────────────────────────────────────────────

export function parseVault(yaml: string): ParsedDocument<Vault> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const value = v.parse(VaultSchema, raw);
  return makeParsed(value, doc);
}

export function serializeVault(write: WriteableDocument<Vault>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, VAULT_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, VAULT_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
