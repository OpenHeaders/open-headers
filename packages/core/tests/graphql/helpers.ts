/**
 * Shared helpers for the GraphQL unit matrix — fixture loading and the
 * span-stripped AST comparison the round-trip tests pin.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DocumentNode, type GraphqlSchema, parseDocument, schemaFromSdl } from '@openheaders/core/graphql';

const here = dirname(fileURLToPath(import.meta.url));

export function fixture(name: string): string {
  return readFileSync(join(here, '..', 'fixtures', 'graphql', name), 'utf8');
}

export function parseOrThrow(source: string): DocumentNode {
  const parsed = parseDocument(source);
  if (parsed.document === null) throw new Error(parsed.errors.map((error) => error.message).join('\n'));
  return parsed.document;
}

export function schemaOrThrow(source: string): GraphqlSchema {
  const result = schemaFromSdl(source);
  if (result.schema === null || result.errors.length > 0) {
    throw new Error(result.errors.map((error) => error.message).join('\n') || 'no schema');
  }
  return result.schema;
}

/** The AST without positions — what a print → parse round trip preserves. */
export function stripSpans(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSpans);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'start' || key === 'end') continue;
      out[key] = stripSpans(entry);
    }
    return out;
  }
  return value;
}

export const OPENHEADERS_SDL = fixture('openheaders.graphql');
