/**
 * Settings inheritance — THE rule every host and surface shares.
 *
 * A collection or folder keeps a `settings` object of independent
 * scalar knobs under the request kinds' own field names
 * (`@openheaders/core/schemas` — `InheritableSettingsSchema`). A
 * request that leaves a knob absent reads the NEAREST ancestor that
 * sets it; a knob nobody sets is the runtime default. The rule is a
 * per-knob CASCADE: the effective settings merge across levels (a
 * folder's timeout beside the collection's TLS window), a request's
 * own defined value wins outright, and nothing is ever copied down —
 * an inheriting request resolves the chain at the next read or send.
 * The proxy trio (mode · URL · credential ref) resolves as ONE unit
 * keyed on the mode: the level that sets the mode supplies the URL
 * and the credential ref with it.
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
  INHERITABLE_SETTING_KEYS,
  INHERITABLE_SETTING_KEYS_BY_KIND,
  type InheritableSettingKeysByKind,
  PROXY_SETTING_KEYS,
} from '../schemas/inheritable-settings';
import type { InheritableSettingKey, InheritableSettings, InheritedSettingSource } from '../types';

/** A collection or folder as the rule sees it. */
export interface SettingsCarrier {
  level: 'collection' | 'folder';
  uid: string;
  name: string;
  settings?: InheritableSettings;
}

/** A slice of the union over `K`, every key optional (absent =
 *  inherit or the runtime default). */
export type SettingsOf<K extends InheritableSettingKey> = { [P in K]?: InheritableSettings[P] };

/** The knobs one kind's request reads — the per-kind slice of the union. */
export type KindSettings<K extends AuthProtocolKind> = SettingsOf<InheritableSettingKeysByKind[K]>;

export interface EffectiveSettings<K extends InheritableSettingKey> {
  /** The effective value per key — the request's own, else the
   *  nearest ancestor's, else absent (the runtime default). */
  settings: SettingsOf<K>;
  /** One entry per key an ANCESTOR supplied, in key order; empty when
   *  every key was the request's own or nobody's. */
  sources: InheritedSettingSource[];
}

const PROXY_KEY_SET: ReadonlySet<string> = new Set(PROXY_SETTING_KEYS);

/** The innermost chain index whose settings define `key`; -1 when none. */
function innermostDefining(chain: readonly SettingsCarrier[], key: InheritableSettingKey): number {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].settings?.[key] !== undefined) return i;
  }
  return -1;
}

/**
 * Resolve the effective settings for `keys` over the chain (outer →
 * inner). Per key: the request's own defined value wins; else the
 * innermost ancestor that defines it supplies it and is recorded as
 * its source; else the key stays absent. The proxy trio resolves as
 * one unit under whichever level defines `proxyMode` — that level's
 * URL and credential ref ride with it, and an outer level's never do.
 */
export function effectiveSettingsFor<K extends InheritableSettingKey>(
  own: SettingsOf<K>,
  chain: readonly SettingsCarrier[],
  keys: readonly K[],
): EffectiveSettings<K> {
  const settings: SettingsOf<K> = {};
  const sources: InheritedSettingSource[] = [];
  // The proxy unit's owner: the request when it sets the mode, else
  // the innermost ancestor that does; resolved once, read per key.
  const ownProxy = own[proxyModeKey(keys)] !== undefined;
  const proxyLevel = ownProxy ? -1 : innermostDefining(chain, 'proxyMode');
  for (const key of keys) {
    const ownValue = own[key];
    if (PROXY_KEY_SET.has(key)) {
      if (ownProxy) {
        if (ownValue !== undefined) settings[key] = ownValue;
        continue;
      }
      if (proxyLevel === -1) continue;
      const carrier = chain[proxyLevel];
      const value = carrier.settings?.[key];
      if (value === undefined) continue;
      settings[key] = value;
      sources.push(sourceOf(carrier, key));
      continue;
    }
    if (ownValue !== undefined) {
      settings[key] = ownValue;
      continue;
    }
    const level = innermostDefining(chain, key);
    if (level === -1) continue;
    const carrier = chain[level];
    const value = carrier.settings?.[key];
    if (value === undefined) continue;
    settings[key] = value;
    sources.push(sourceOf(carrier, key));
  }
  return { settings, sources };
}

/** `proxyMode` when the key list carries the unit, else the first key
 *  (a list without the trio never reads it — the lookup stays typed). */
function proxyModeKey<K extends InheritableSettingKey>(keys: readonly K[]): K {
  return keys.find((k) => k === 'proxyMode') ?? keys[0];
}

function sourceOf(carrier: SettingsCarrier, key: InheritableSettingKey): InheritedSettingSource {
  return { key, level: carrier.level, uid: carrier.uid, name: carrier.name };
}

/**
 * The effective settings for one request KIND — its own knobs over the
 * chain under the kind's key list (`INHERITABLE_SETTING_KEYS_BY_KIND`).
 * What the executors call: the request entity IS a `KindSettings<K>`
 * (its settings fields are the same optional scalars).
 */
export function effectiveKindSettingsFor<K extends AuthProtocolKind>(
  kind: K,
  own: KindSettings<K>,
  chain: readonly SettingsCarrier[],
): EffectiveSettings<InheritableSettingKeysByKind[K]> {
  return effectiveSettingsFor(own, chain, INHERITABLE_SETTING_KEYS_BY_KIND[kind]);
}

/**
 * What the chain alone supplies for `keys` — the inherited values a
 * surface shows as placeholders under a request (or a folder) that
 * sets nothing, each with its source.
 */
export function inheritedSettingsFor<K extends InheritableSettingKey>(
  chain: readonly SettingsCarrier[],
  keys: readonly K[],
): EffectiveSettings<K> {
  return effectiveSettingsFor({}, chain, keys);
}

/** One knob's write — a value sets the leaf, `undefined` removes it.
 *  Name the key to type the value (`InheritableSettingUpdate<'timeoutMs'>`). */
export interface InheritableSettingUpdate<K extends InheritableSettingKey = InheritableSettingKey> {
  key: K;
  value: InheritableSettings[K] | undefined;
}

/**
 * The per-knob writes that take `prev` to `next` over `keys` (every
 * knob when omitted) — what a container editor's Save hands the
 * settings mutator: a changed value → set, a cleared one → unset, an
 * unchanged one → nothing. Strict equality per knob (scalars only).
 */
export function settingUpdatesBetween(
  prev: InheritableSettings | undefined,
  next: InheritableSettings,
  keys: readonly InheritableSettingKey[] = definedKeysOfBoth(prev, next),
): InheritableSettingUpdate[] {
  const out: InheritableSettingUpdate[] = [];
  for (const key of keys) {
    const before = prev?.[key];
    const after = next[key];
    if (before === after) continue;
    out.push({ key, value: after });
  }
  return out;
}

/** The knobs either side defines, in the object's key order. */
function definedKeysOfBoth(prev: InheritableSettings | undefined, next: InheritableSettings): InheritableSettingKey[] {
  return INHERITABLE_SETTING_KEYS.filter((key) => prev?.[key] !== undefined || next[key] !== undefined);
}
