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
import type { Rule } from '../../types/v5/rule';
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
