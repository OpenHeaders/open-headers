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
import type { Template } from '../../types/v5/template';
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
  const doc = write.raw ? (write.raw as YAML.Document) : buildFreshDocument(write.value, TEMPLATE_FIELD_ORDER);
  if (write.raw) mergeKnownFields(doc, write.value, TEMPLATE_FIELD_ORDER);
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}
