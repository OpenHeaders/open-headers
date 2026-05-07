/**
 * Rule codec (rule.yaml).
 *
 * Layout — base fields first, discriminator, then the per-type action:
 *
 *   schemaVersion: 5
 *   uid: a1b2c3d4
 *   name: Set Auth Header
 *   type: header
 *   enabled: true
 *   conditions:
 *     - type: request-domains
 *       values: [api.example.com]
 *   action:
 *     requestHeaders:
 *       - operation: override
 *         headerName: Authorization
 *         value: Bearer {{TOKEN}}
 *     responseHeaders: []
 *
 * The same file layout covers all 8 rule variants — `type` discriminates
 * the `action` payload. `path` is runtime-only, supplied by the caller.
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { RuleSchema } from '../../schemas/rule';
import type { HeaderModification, QueryParamEntry, Rule, RuleCondition } from '../../types/v5/rule';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { RULE_FIELD_ORDER } from './ordering';

export interface RuleCodecContext {
  /** Workspace-relative rule folder path. */
  path: string;
}

export function parseRule(yaml: string, context: RuleCodecContext): ParsedDocument<Rule> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path };
  const value = v.parse(RuleSchema, merged);
  return makeParsed(value, doc);
}

export function serializeRule(write: WriteableDocument<Rule>): string {
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, RULE_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, RULE_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}

/**
 * Normalize nested row key order in a rule's set-modeled subtrees so
 * two clients that built the same rule via different paths
 * (form-projected vs. oracle-projected) emit byte-identical YAML.
 *
 * `buildFreshDocument` enforces top-level rule field order via
 * `RULE_FIELD_ORDER`; nested rows (header mods, query params,
 * conditions) and Record-shaped collections (mock responseHeaders)
 * serialize in JS insertion order. Form.List rows enter insertion
 * order via the form's register sequence; oracle-projected rows enter
 * via the materialize pipeline. Without normalization the two paths
 * emit identical data with divergent key order — every row reads as
 * removed/added in a line-diff even when only one leaf actually
 * differs.
 *
 * Currently used by the rule conflict-diff dialog. Per design §23.3
 * ("byte-identical YAML for byte-identical state") the persist
 * boundary should also adopt this — left as a follow-up because
 * flipping `serializeRule` to call it has wider blast radius
 * (rewrites every desktop-side rule.yaml on next write). Tracked as
 * an architectural gap; not a regression vs. prior behavior.
 */
export function canonicalizeRule(rule: Rule): Rule {
  const conditions = rule.conditions.map(canonicalCondition);
  const baseClone = { ...rule, conditions };
  switch (rule.type) {
    case 'header':
      return {
        ...baseClone,
        type: 'header',
        action: {
          requestHeaders: (rule.action.requestHeaders ?? []).map(canonicalHeaderModification),
          responseHeaders: (rule.action.responseHeaders ?? []).map(canonicalHeaderModification),
        },
      } as Rule;
    case 'query-param':
      return {
        ...baseClone,
        type: 'query-param',
        action: { params: (rule.action.params ?? []).map(canonicalQueryParamEntry) },
      } as Rule;
    case 'mock':
      return {
        ...baseClone,
        type: 'mock',
        action: { ...rule.action, responseHeaders: canonicalRecord(rule.action.responseHeaders) },
      } as Rule;
    default:
      return baseClone as Rule;
  }
}

function canonicalHeaderModification(h: HeaderModification): HeaderModification {
  const out: HeaderModification = { uid: h.uid, operation: h.operation, headerName: h.headerName };
  if (h.value !== undefined) out.value = h.value;
  if (h.mergeSeparator !== undefined) out.mergeSeparator = h.mergeSeparator;
  return out;
}

function canonicalQueryParamEntry(p: QueryParamEntry): QueryParamEntry {
  const out: QueryParamEntry = { uid: p.uid, param: p.param, operation: p.operation };
  if (p.value !== undefined) out.value = p.value;
  return out;
}

function canonicalCondition(c: RuleCondition): RuleCondition {
  const out: RuleCondition = { uid: c.uid, type: c.type, values: [...c.values] };
  if (c.headerName !== undefined) out.headerName = c.headerName;
  return out;
}

function canonicalRecord(r: Record<string, string> | undefined): Record<string, string> {
  if (!r) return {};
  const keys = Object.keys(r).sort();
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = r[k];
  return out;
}
