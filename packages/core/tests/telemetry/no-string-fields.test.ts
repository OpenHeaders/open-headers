import { describe, expect, it } from 'vitest';
import { TelemetryEventSchema } from '../../src/telemetry';

/**
 * The structural law of TELEMETRY_PLAN.md §1: no event payload property may
 * admit arbitrary `string`. This test walks the runtime shape of the event
 * schema and fails if a `string`-typed node appears anywhere inside a
 * payload — closed unions (picklist/literal), booleans, and numbers are the
 * only permitted leaves. Adding a `v.string()` field to the vocabulary
 * breaks this test forever, by design.
 */

interface SchemaNode {
  readonly type?: string;
  readonly options?: readonly unknown[];
  readonly entries?: Readonly<Record<string, unknown>>;
  readonly wrapped?: unknown;
  readonly item?: unknown;
}

const ALLOWED_LEAF_TYPES = new Set(['picklist', 'literal', 'boolean', 'number']);

function isSchemaNode(value: unknown): value is SchemaNode {
  return typeof value === 'object' && value !== null && typeof (value as SchemaNode).type === 'string';
}

/** Depth-first walk collecting every (path, type) pair in the schema tree. */
function collectNodeTypes(value: unknown, path: string, out: Array<{ path: string; type: string }>): void {
  if (!isSchemaNode(value) || value.type === undefined) return;
  out.push({ path, type: value.type });
  if (value.options) {
    // picklist options are plain values, variant options are schemas —
    // isSchemaNode filters the former out naturally.
    value.options.forEach((option, index) => {
      collectNodeTypes(option, `${path}[${index}]`, out);
    });
  }
  if (value.entries) {
    for (const [key, entry] of Object.entries(value.entries)) collectNodeTypes(entry, `${path}.${key}`, out);
  }
  collectNodeTypes(value.wrapped, `${path}?`, out);
  collectNodeTypes(value.item, `${path}[]`, out);
}

describe('telemetry vocabulary — no-string-fields guard', () => {
  const nodes: Array<{ path: string; type: string }> = [];
  collectNodeTypes(TelemetryEventSchema, 'event', nodes);

  it('actually walked the vocabulary (sanity floor)', () => {
    // 7 variant options plus their properties — a broken walker that visits
    // nothing must not masquerade as a passing guard.
    expect(nodes.length).toBeGreaterThan(20);
    expect(nodes.filter((n) => n.type === 'strict_object').length).toBeGreaterThanOrEqual(7);
  });

  it('admits no string-typed node anywhere in any event payload', () => {
    const strings = nodes.filter((n) => n.type === 'string');
    expect(strings).toEqual([]);
  });

  it('uses only closed unions, booleans, and numbers as leaves', () => {
    const leaves = nodes.filter((n) => !['variant', 'strict_object', 'optional', 'array'].includes(n.type));
    const offenders = leaves.filter((n) => !ALLOWED_LEAF_TYPES.has(n.type));
    expect(offenders).toEqual([]);
  });
});
