/**
 * Descriptor v2 — declarative field-tree for the generic conflict
 * adapter walker. Each entity declares its own descriptor; the walker
 * derives extractBaseline / readPath / snapshotSets / resolution
 * writes / pretty labels by recursive descent.
 *
 * Locked design — see docs/MWPT_FULL_ENTITY_MIGRATION_STATUS.md
 * "Session 27 — closed" block. Five concrete fixes from three rounds
 * of design review live in the node-kind union below.
 */

export type CoercionPolicyName =
  | 'enabled-default-true'
  | 'published-default-false'
  | 'optional-string'
  | 'boolean-strict';

export interface CoercionPolicy {
  /** Read raw value off entity → canonical string for path-keyed view. */
  read(value: unknown): string;
  /** Inverse of read — write a canonical string back into the entity. */
  write(value: string): unknown;
}

const POLICIES: Record<CoercionPolicyName, CoercionPolicy> = {
  'enabled-default-true': {
    read: (v) => (v === false ? 'false' : 'true'),
    write: (s) => s === 'true',
  },
  'published-default-false': {
    read: (v) => (v === true ? 'true' : 'false'),
    write: (s) => s === 'true',
  },
  'optional-string': {
    read: (v) => (typeof v === 'string' ? v : ''),
    write: (s) => (s === '' ? undefined : s),
  },
  'boolean-strict': {
    read: (v) => (v === true ? 'true' : 'false'),
    write: (s) => s === 'true',
  },
};

export function getPolicy(name: CoercionPolicyName | undefined): CoercionPolicy {
  return name ? POLICIES[name] : { read: (v) => (v === undefined || v === null ? '' : String(v)), write: (s) => s };
}

export type LeafFlag = 'mask' | 'redact-presence';

export type FieldNode =
  | { kind: 'leaf'; valueType: 'string' | 'number' | 'boolean'; coercion?: CoercionPolicyName; flags?: ReadonlySet<LeafFlag> }
  | { kind: 'enum'; allowedValues: readonly string[]; coercion?: CoercionPolicyName; flags?: ReadonlySet<LeafFlag> }
  | { kind: 'object'; children: Record<string, FieldNode> }
  | {
      kind: 'set';
      identity: 'uid';
      summary: (row: unknown) => string;
      child: FieldNode;
      /** Optional human-friendly label for `prettyPath` on set-level keys. */
      rowLabel?: (row: unknown) => string;
    }
  | { kind: 'set'; identity: 'value'; summary?: (value: string) => string }
  | {
      kind: 'set';
      identity: 'key';
      keyAccessor: 'object-property';
      summary: (value: unknown) => string;
      child: FieldNode;
    }
  | {
      kind: 'union';
      discriminator: string;
      kindTransitionUnsafe: boolean;
      branches: Record<string, FieldNode>;
      divergenceLabel?: string;
    }
  | { kind: 'opaque'; provisional?: true; reason?: string }
  | { kind: 'omit' };

// ── Constructor helpers ──────────────────────────────────────────

export const leaf = (
  valueType: 'string' | 'number' | 'boolean' = 'string',
  opts: { coercion?: CoercionPolicyName; flags?: ReadonlySet<LeafFlag> } = {},
): FieldNode => {
  if (valueType === 'boolean' && !opts.coercion) {
    throw new Error('boolean leaf requires explicit coercion policy');
  }
  return { kind: 'leaf', valueType, ...opts };
};

export const enumLeaf = (
  allowedValues: readonly string[],
  opts: { coercion?: CoercionPolicyName; flags?: ReadonlySet<LeafFlag> } = {},
): FieldNode => ({ kind: 'enum', allowedValues, ...opts });

export const obj = (children: Record<string, FieldNode>): FieldNode => ({ kind: 'object', children });

export const setByUid = (
  args: { summary: (row: unknown) => string; rowLabel?: (row: unknown) => string; child: FieldNode },
): FieldNode => ({ kind: 'set', identity: 'uid', summary: args.summary, rowLabel: args.rowLabel, child: args.child });

export const setByValue = (summary?: (value: string) => string): FieldNode => ({
  kind: 'set',
  identity: 'value',
  summary,
});

export const setByKey = (args: { summary: (value: unknown) => string; child: FieldNode }): FieldNode => ({
  kind: 'set',
  identity: 'key',
  keyAccessor: 'object-property',
  summary: args.summary,
  child: args.child,
});

export const union = (args: {
  discriminator: string;
  kindTransitionUnsafe: boolean;
  branches: Record<string, FieldNode>;
  divergenceLabel?: string;
}): FieldNode => ({ kind: 'union', ...args });

export const opaque = (reason?: string): FieldNode => ({ kind: 'opaque', provisional: true, reason });
export const omit = (): FieldNode => ({ kind: 'omit' });
