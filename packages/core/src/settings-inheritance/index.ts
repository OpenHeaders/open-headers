/**
 * Settings inheritance — THE rule every host and surface shares.
 *
 * A collection or folder keeps a `settings` record with one slice per
 * request kind, each a set of independent scalar knobs under the
 * kind's own field names (`@openheaders/core/schemas` —
 * `ContainerSettingsSchema`). A request that leaves a knob absent
 * reads the NEAREST ancestor whose slice of the request's kind sets
 * it; a knob nobody sets is the runtime default. The rule is a
 * per-knob CASCADE within a kind: the effective settings merge across
 * levels (a folder's timeout beside the collection's TLS window), a
 * request's own defined value wins outright, and nothing is ever
 * copied down — an inheriting request resolves the chain at the next
 * read or send. A slice never reaches another kind's requests: the
 * HTTP TLS floor is HTTP's alone (the per-kind law). The proxy trio
 * (mode · URL · credential ref) resolves as ONE unit keyed on the
 * mode: the level that sets the mode supplies the URL and the
 * credential ref with it.
 *
 * Auth inherits a whole config from a pool; scripts compose
 * additively outer → inner; settings cascade knob by knob — three
 * units over the one ancestor chain. The chain (outer → inner) is
 * the caller's to derive and differs per host: the oracle reads the
 * tree index (the containment authority), the renderer the projected
 * trees — never a leaf's stored path.
 */

import type { AuthProtocolKind } from '../auth-inheritance';
import {
  INHERITABLE_SETTING_KEYS_BY_KIND,
  type InheritableSettingKeysByKind,
  type KindSettingsShape,
  PROXY_SETTING_KEYS,
  SETTINGS_KINDS,
} from '../schemas/inheritable-settings';
import type { ContainerSettings, InheritableSettingKey, InheritableSettings, InheritedSettingSource } from '../types';

/** A collection or folder as the rule sees it. */
export interface SettingsCarrier {
  level: 'collection' | 'folder';
  uid: string;
  name: string;
  settings?: ContainerSettings;
}

/** A slice of the vocabulary over `K`, every key optional (absent =
 *  inherit or the runtime default). */
export type SettingsOf<K extends InheritableSettingKey> = { [P in K]?: InheritableSettings[P] };

/** The knobs one kind's request reads — the kind's slice of the
 *  vocabulary; the request entity IS one (its settings fields are the
 *  same optional scalars), and so is a container's slice of the kind. */
export type KindSettings<K extends AuthProtocolKind> = KindSettingsShape<K>;

/** The knob names of one kind. */
export type KindSettingKey<K extends AuthProtocolKind> = InheritableSettingKeysByKind[K];

export interface EffectiveSettings<K extends InheritableSettingKey> {
  /** The effective value per key — the request's own, else the
   *  nearest ancestor's, else absent (the runtime default). */
  settings: SettingsOf<K>;
  /** One entry per key an ANCESTOR supplied, in key order; empty when
   *  every key was the request's own or nobody's. */
  sources: InheritedSettingSource[];
}

const PROXY_KEY_SET: ReadonlySet<string> = new Set(PROXY_SETTING_KEYS);

/** The carrier's slice of the kind; absent when the level sets nothing for it. */
function sliceAt<K extends AuthProtocolKind>(carrier: SettingsCarrier, kind: K): KindSettings<K> | undefined {
  return carrier.settings?.[kind];
}

/** The innermost chain index whose slice of `kind` defines `key`; -1 when none. */
function innermostDefining<K extends AuthProtocolKind>(
  chain: readonly SettingsCarrier[],
  kind: K,
  key: KindSettingKey<K>,
): number {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (sliceAt(chain[i], kind)?.[key] !== undefined) return i;
  }
  return -1;
}

/** Whether the kind's key list carries the proxy unit — a kind
 *  without the trio never reads it. */
function proxyModeKeyOf<K extends AuthProtocolKind>(kind: K): KindSettingKey<K> | undefined {
  return INHERITABLE_SETTING_KEYS_BY_KIND[kind].find((k) => k === 'proxyMode');
}

/**
 * Resolve the effective settings of `kind` for a request — its own
 * knobs over the chain (outer → inner). Per key: the request's own
 * defined value wins; else the innermost ancestor whose slice of the
 * kind defines it supplies it and is recorded as its source; else the
 * key stays absent. The proxy trio resolves as one unit under
 * whichever level defines `proxyMode` — that level's URL and
 * credential ref ride with it, and an outer level's never do.
 */
export function effectiveSettingsFor<K extends AuthProtocolKind>(
  kind: K,
  own: KindSettings<K>,
  chain: readonly SettingsCarrier[],
): EffectiveSettings<KindSettingKey<K>> {
  const keys = INHERITABLE_SETTING_KEYS_BY_KIND[kind];
  const settings: SettingsOf<KindSettingKey<K>> = {};
  const sources: InheritedSettingSource[] = [];
  // The proxy unit's owner: the request when it sets the mode, else
  // the innermost ancestor that does; resolved once, read per key.
  const proxyModeKey = proxyModeKeyOf(kind);
  const ownProxy = proxyModeKey !== undefined && own[proxyModeKey] !== undefined;
  const proxyLevel = ownProxy || proxyModeKey === undefined ? -1 : innermostDefining(chain, kind, proxyModeKey);
  for (const key of keys) {
    const ownValue = own[key];
    if (PROXY_KEY_SET.has(key)) {
      if (ownProxy) {
        if (ownValue !== undefined) settings[key] = ownValue;
        continue;
      }
      if (proxyLevel === -1) continue;
      const carrier = chain[proxyLevel];
      const value = sliceAt(carrier, kind)?.[key];
      if (value === undefined) continue;
      settings[key] = value;
      sources.push(sourceOf(carrier, key));
      continue;
    }
    if (ownValue !== undefined) {
      settings[key] = ownValue;
      continue;
    }
    const level = innermostDefining(chain, kind, key);
    if (level === -1) continue;
    const carrier = chain[level];
    const value = sliceAt(carrier, kind)?.[key];
    if (value === undefined) continue;
    settings[key] = value;
    sources.push(sourceOf(carrier, key));
  }
  return { settings, sources };
}

function sourceOf(carrier: SettingsCarrier, key: InheritableSettingKey): InheritedSettingSource {
  return { key, level: carrier.level, uid: carrier.uid, name: carrier.name };
}

/**
 * What the chain alone supplies for `kind` — the inherited values a
 * surface shows as placeholders under a request (or a folder) that
 * sets nothing, each with its source.
 */
export function inheritedSettingsFor<K extends AuthProtocolKind>(
  kind: K,
  chain: readonly SettingsCarrier[],
): EffectiveSettings<KindSettingKey<K>> {
  return effectiveSettingsFor(kind, {}, chain);
}

/** One level's value of one knob — a step of a knob's provenance. */
export interface SettingLevelValue<K extends InheritableSettingKey = InheritableSettingKey> {
  key: K;
  level: 'collection' | 'folder';
  uid: string;
  name: string;
  value: NonNullable<InheritableSettings[K]>;
}

/** Per knob, the levels that set it, outer → inner — the WHOLE history
 *  a surface shows when its own value (or its inherited one) shadows
 *  an outer level's; absent when nobody above sets the knob. */
export type SettingProvenance<K extends InheritableSettingKey> = { [P in K]?: SettingLevelValue<P>[] };

/**
 * Every ancestor level's value of every knob of `kind`, outer →
 * inner. A proxy knob counts through the unit: a level lists it only
 * while that level sets the mode. The innermost entry is the nearest
 * supplier (the `inheritedSettingsFor` source); the ones above it are
 * the values it shadows.
 */
export function settingProvenanceFor<K extends AuthProtocolKind>(
  kind: K,
  chain: readonly SettingsCarrier[],
): SettingProvenance<KindSettingKey<K>> {
  const out: SettingProvenance<KindSettingKey<K>> = {};
  const proxyModeKey = proxyModeKeyOf(kind);
  for (const key of INHERITABLE_SETTING_KEYS_BY_KIND[kind]) {
    const levels: SettingLevelValue<typeof key>[] = [];
    for (const carrier of chain) {
      const slice = sliceAt(carrier, kind);
      if (slice === undefined) continue;
      if (PROXY_KEY_SET.has(key) && proxyModeKey !== undefined && slice[proxyModeKey] === undefined) continue;
      const value = slice[key];
      if (value === undefined) continue;
      levels.push({ key, level: carrier.level, uid: carrier.uid, name: carrier.name, value });
    }
    if (levels.length > 0) out[key] = levels;
  }
  return out;
}

/** One knob's write on one kind's slice — a value sets the leaf,
 *  `undefined` removes it. Name the key to type the value
 *  (`ContainerSettingUpdate<'timeoutMs'>`). */
export interface ContainerSettingUpdate<K extends InheritableSettingKey = InheritableSettingKey> {
  kind: AuthProtocolKind;
  key: K;
  value: InheritableSettings[K] | undefined;
}

/**
 * The per-knob writes that take `prev` to `next` over every kind —
 * what a container editor's Save hands the settings mutator: a
 * changed value → set, a cleared one → unset, an unchanged one →
 * nothing. Strict equality per knob (scalars only), the kinds in the
 * record's order and the knobs in each kind's key order.
 */
export function settingUpdatesBetween(
  prev: ContainerSettings | undefined,
  next: ContainerSettings,
): ContainerSettingUpdate[] {
  const out: ContainerSettingUpdate[] = [];
  for (const kind of SETTINGS_KINDS) collectKindUpdates(kind, prev?.[kind], next[kind], out);
  return out;
}

function collectKindUpdates<K extends AuthProtocolKind>(
  kind: K,
  before: KindSettings<K> | undefined,
  after: KindSettings<K> | undefined,
  out: ContainerSettingUpdate[],
): void {
  for (const key of INHERITABLE_SETTING_KEYS_BY_KIND[kind]) {
    const was = before?.[key];
    const is = after?.[key];
    if (was === is) continue;
    out.push({ kind, key, value: is });
  }
}
