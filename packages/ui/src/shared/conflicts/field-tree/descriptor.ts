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

import type { Translate } from '@openheaders/ui/context/LocaleContext';

export type CoercionPolicyName =
  | 'enabled-default-true'
  | 'published-default-false'
  | 'optional-string'
  | 'boolean-strict'
  | 'number-strict'
  | 'optional-number'
  | 'array-comma-space-join';

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
  'number-strict': {
    read: (v) => (typeof v === 'number' ? String(v) : ''),
    write: (s) => Number(s),
  },
  'optional-number': {
    read: (v) => (typeof v === 'number' ? String(v) : ''),
    write: (s) => (s === '' ? undefined : Number(s)),
  },
  'array-comma-space-join': {
    read: (v) => (Array.isArray(v) ? v.map((x) => String(x)).join(', ') : ''),
    write: (s) => (s === '' ? [] : s.split(',').map((x) => x.trim())),
  },
};

export function getPolicy(name: CoercionPolicyName | undefined): CoercionPolicy {
  return name ? POLICIES[name] : { read: (v) => (v === undefined || v === null ? '' : String(v)), write: (s) => s };
}

export type LeafFlag = 'mask' | 'redact-presence';

export type FieldNode =
  | {
      kind: 'leaf';
      valueType: 'string' | 'number' | 'boolean';
      coercion?: CoercionPolicyName;
      flags?: ReadonlySet<LeafFlag>;
      /** When `'skip'`, the leaf is excluded from `extractBaseline` but still
       *  read by `readPath`. Used by adapters that must accept theirs at a
       *  path the baseline projection deliberately omits. */
      baseline?: 'skip';
    }
  | {
      kind: 'enum';
      allowedValues: readonly string[];
      coercion?: CoercionPolicyName;
      flags?: ReadonlySet<LeafFlag>;
      baseline?: 'skip';
    }
  | { kind: 'object'; children: Record<string, FieldNode> }
  | {
      kind: 'set';
      identity: 'uid';
      summary: (row: unknown) => string;
      child: FieldNode;
      /** Optional human-friendly label for `prettyPath` on set-level keys.
       *  Label vocabulary resolves through `t`; row data interpolates raw. */
      rowLabel?: (t: Translate, row: unknown) => string;
      /** When true, row order carries semantic meaning beyond visual
       *  organization (e.g. DNR last-write-wins on duplicate header
       *  names; query-param append stacking). The conflict tracker
       *  refuses to silently auto-rebase a peer reorder on this set if
       *  the user has any leaf edit pending in it — a peer-side reorder
       *  changes the user's by-position mental model. Order-insensitive
       *  sets (default) silent-rebase whenever the user's order matches
       *  baseline, since uid identity carries each row's data through
       *  the move regardless. */
      orderSensitive?: boolean;
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
      /** Optional accessor for cases where the discriminator does not live
       *  on the value at the union's prefix (e.g. Rule's `type` lives at
       *  the entity root while the union covers `rule.action`). When set,
       *  the walker invokes `discriminate(parent, value)` instead of
       *  `value[discriminator]`. */
      discriminate?: (parent: unknown, value: unknown) => string | undefined;
      /** When true, `extractBaseline` always emits a structural marker
       *  key `union:<prefix>` containing a stable-stringified projection
       *  of the active branch. The conflicts hook recognises that key
       *  as a kind-transition signal and suppresses per-leaf paths
       *  under the same prefix when it diverges. Off by default — Vault
       *  surfaces kind transitions as a leaf conflict at the
       *  discriminator path and would lose that signal otherwise. */
      emitDivergenceKey?: boolean;
    }
  | { kind: 'opaque'; provisional?: true; reason?: string }
  | { kind: 'omit' };

// ── Constructor helpers ──────────────────────────────────────────

export const leaf = (
  valueType: 'string' | 'number' | 'boolean' = 'string',
  opts: { coercion?: CoercionPolicyName; flags?: ReadonlySet<LeafFlag>; baseline?: 'skip' } = {},
): FieldNode => {
  if (valueType === 'boolean' && !opts.coercion) {
    throw new Error('boolean leaf requires explicit coercion policy');
  }
  return { kind: 'leaf', valueType, ...opts };
};

export const enumLeaf = (
  allowedValues: readonly string[],
  opts: { coercion?: CoercionPolicyName; flags?: ReadonlySet<LeafFlag>; baseline?: 'skip' } = {},
): FieldNode => ({ kind: 'enum', allowedValues, ...opts });

export const obj = (children: Record<string, FieldNode>): FieldNode => ({ kind: 'object', children });

export const setByUid = (args: {
  summary: (row: unknown) => string;
  rowLabel?: (t: Translate, row: unknown) => string;
  child: FieldNode;
  orderSensitive?: boolean;
}): FieldNode => ({
  kind: 'set',
  identity: 'uid',
  summary: args.summary,
  rowLabel: args.rowLabel,
  child: args.child,
  orderSensitive: args.orderSensitive,
});

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
  discriminate?: (parent: unknown, value: unknown) => string | undefined;
  emitDivergenceKey?: boolean;
}): FieldNode => ({ kind: 'union', ...args });

export const opaque = (reason?: string): FieldNode => ({ kind: 'opaque', provisional: true, reason });
export const omit = (): FieldNode => ({ kind: 'omit' });
