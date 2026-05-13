/**
 * Template codec (template.yaml).
 *
 * Layout:
 *
 *   schemaVersion: 5
 *   uid: a1b2c3d4
 *   name: Bearer Token
 *   ruleType: header
 *   icon: 🔐
 *   description: Pre-filled header rule for bearer auth.
 *   includes:
 *     conditions: true
 *     formValues: true
 *   conditions:
 *     - type: request-domains
 *       values: [api.example.com]
 *   formValues:
 *     operation: override
 *     headerName: Authorization
 *   createdAt: 2026-04-19T00:00:00.000Z
 *   updatedAt: 2026-04-19T00:00:00.000Z
 */

import * as v from 'valibot';
import * as YAML from 'yaml';
import { makeParsed, type ParsedDocument, type WriteableDocument } from '../../schemas/document';
import { TemplateSchema } from '../../schemas/template';
import type { Template } from '../../types/template';
import type { HeaderModification, QueryParamEntry, RuleCondition } from '../../types/rule';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import { buildFreshDocument, mergeKnownFields } from './merge';
import { TEMPLATE_FIELD_ORDER } from './ordering';

export interface TemplateCodecContext {
  /** Workspace-relative template folder path. */
  path: string;
}

export function parseTemplate(yaml: string, context: TemplateCodecContext): ParsedDocument<Template> {
  const doc = YAML.parseDocument(yaml);
  const raw = doc.toJS() as Record<string, unknown>;
  const merged = { ...raw, path: context.path };
  const value = v.parse(TemplateSchema, merged);
  return makeParsed(value, doc);
}

export function serializeTemplate(write: WriteableDocument<Template>): string {
  const value = canonicalizeTemplate(write.value);
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(value, TEMPLATE_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, value, TEMPLATE_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}

/**
 * Normalize nested row key order in a template's set-modeled subtrees
 * so two clients building the same template via different paths emit
 * byte-identical YAML. Same architectural shape as `canonicalizeRule`
 * — Template's `formValues` mirrors a Rule's action shape (header
 * mods / query params / conditions), and the set-modeled rows enter
 * insertion order via the form's register sequence vs. the
 * oracle-projected materialize pipeline. Without this, the diff dialog
 * would render every row as removed+added on a partial-leaf change.
 *
 * Wired into `serializeTemplate` so the persist boundary emits canonical
 * YAML — design §23.3 "byte-identical YAML for byte-identical state".
 */
export function canonicalizeTemplate(template: Template): Template {
  const conditions = template.conditions.map(canonicalCondition);
  const formValues = canonicalFormValues(template.formValues, template.ruleType);
  return { ...template, conditions, formValues };
}

function canonicalFormValues(
  formValues: Record<string, unknown>,
  ruleType: Template['ruleType'],
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...formValues };
  if (ruleType === 'header') {
    if (Array.isArray(out.requestHeaders)) {
      out.requestHeaders = (out.requestHeaders as HeaderModification[]).map(canonicalHeaderModification);
    }
    if (Array.isArray(out.responseHeaders) && (out.responseHeaders as unknown[]).length > 0) {
      const first = (out.responseHeaders as unknown[])[0];
      // Header rules: array of HeaderModification. Mock rules: not
      // expressed via Template (template ruleType excludes mock today),
      // so the array form is the only shape we encounter.
      if (first && typeof first === 'object' && 'uid' in (first as object)) {
        out.responseHeaders = (out.responseHeaders as HeaderModification[]).map(canonicalHeaderModification);
      }
    }
  }
  if (ruleType === 'query-param' && Array.isArray(out.params)) {
    out.params = (out.params as QueryParamEntry[]).map(canonicalQueryParamEntry);
  }
  return out;
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
