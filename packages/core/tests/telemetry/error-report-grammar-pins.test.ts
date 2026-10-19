import { describe, expect, it } from 'vitest';
import { ErrorReportEnvelopeSchema, ErrorReportSchema } from '../../src/telemetry';

/**
 * The structural law of the error reports plan §4.2 law 2 — the
 * sibling of the usage channel's no-string-fields guard. A report needs
 * code identifiers, so strings are admitted, but ONLY under a pinned
 * regex: this test walks the runtime shape of the report and envelope
 * schemas and fails if a `string`-typed node appears anywhere without a
 * `regex` validation in its pipe. Law 1 rides along: the envelope
 * carries no install identity (`installId`, `sinceInstall`) and no
 * `events`. Adding a bare `v.string()` field breaks this forever, by
 * design.
 */

interface SchemaNode {
  readonly type?: string;
  readonly options?: readonly unknown[];
  readonly entries?: Readonly<Record<string, unknown>>;
  readonly wrapped?: unknown;
  readonly item?: unknown;
  readonly pipe?: readonly unknown[];
}

const ALLOWED_LEAF_TYPES = new Set(['picklist', 'literal', 'boolean', 'number', 'string']);

function isSchemaNode(value: unknown): value is SchemaNode {
  return typeof value === 'object' && value !== null && typeof (value as SchemaNode).type === 'string';
}

function hasRegexPin(node: SchemaNode): boolean {
  return (node.pipe ?? []).some((step) => isSchemaNode(step) && step.type === 'regex');
}

/** Depth-first walk collecting every (path, type, pinned) triple in the schema tree. */
function collectNodes(value: unknown, path: string, out: Array<{ path: string; type: string; pinned: boolean }>): void {
  if (!isSchemaNode(value) || value.type === undefined) return;
  out.push({ path, type: value.type, pinned: hasRegexPin(value) });
  if (value.options) {
    value.options.forEach((option, index) => {
      collectNodes(option, `${path}[${index}]`, out);
    });
  }
  if (value.entries) {
    for (const [key, entry] of Object.entries(value.entries)) collectNodes(entry, `${path}.${key}`, out);
  }
  collectNodes(value.wrapped, `${path}?`, out);
  collectNodes(value.item, `${path}[]`, out);
}

describe('error report vocabulary — grammar-pins guard', () => {
  const nodes: Array<{ path: string; type: string; pinned: boolean }> = [];
  collectNodes(ErrorReportEnvelopeSchema, 'envelope', nodes);

  it('actually walked the vocabulary (sanity floor)', () => {
    expect(nodes.length).toBeGreaterThan(30);
    expect(nodes.filter((n) => n.type === 'strict_object').length).toBeGreaterThanOrEqual(4);
    expect(nodes.filter((n) => n.type === 'string').length).toBeGreaterThanOrEqual(4);
  });

  it('pins every string-typed node with a regex — an identifier, a bundle basename, a fingerprint, a session id', () => {
    const unpinned = nodes.filter((n) => n.type === 'string' && !n.pinned);
    expect(unpinned).toEqual([]);
  });

  it('uses only closed unions, booleans, numbers, and pinned strings as leaves', () => {
    const leaves = nodes.filter((n) => !['variant', 'union', 'strict_object', 'optional', 'array'].includes(n.type));
    const offenders = leaves.filter((n) => !ALLOWED_LEAF_TYPES.has(n.type));
    expect(offenders).toEqual([]);
  });

  it('carries no install identity and no usage events on the envelope (law 1)', () => {
    const top = Object.keys(ErrorReportEnvelopeSchema.entries);
    expect(top).not.toContain('installId');
    expect(top).not.toContain('sinceInstall');
    expect(top).not.toContain('events');
    expect(top).toContain('sessionId');
    expect(top).toContain('reports');
  });

  it('keeps the report itself string-free outside the three pinned grammars', () => {
    const report: Array<{ path: string; type: string; pinned: boolean }> = [];
    collectNodes(ErrorReportSchema, 'report', report);
    const strings = report.filter((n) => n.type === 'string').map((n) => n.path);
    expect(strings).toEqual([
      'report.frames[][0].file',
      'report.frames[][0].fn?',
      'report.componentStack?[]',
      'report.fingerprint',
    ]);
  });
});
