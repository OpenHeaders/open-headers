/**
 * Per-knob unsaved-vs-saved comparison behind the Settings tab's
 * orange dots. Two orthogonal facts color a knob's accent dot:
 *   • blue — the knob differs from its RUNTIME DEFAULT (the existing
 *     "what did I change here" affordance);
 *   • orange — the knob differs from the SAVED request (this knob's
 *     slice of why Save is orange), and orange wins while both hold.
 * A knob reverted to its default but not yet saved therefore still
 * dots orange, and on save every orange dot either turns blue
 * (non-default) or disappears (back at default).
 *
 * Comparison runs on NORMALIZED values: a stored default-equivalent
 * (`followRedirects: true`, `httpVersion: 'auto'`, …) equals the
 * cleared knob, so an explicit saved default never reads as a pending
 * edit. Both sides project through {@link settingsSlice} — the draft
 * directly, the saved side via the last-primed `Request` (the same
 * baseline derived dirty compares against).
 */

import type { Draft } from './draft';

export const SETTINGS_KNOB_KEYS = [
  'credentialsMode',
  'followRedirects',
  'sslVerification',
  'tlsMinVersion',
  'tlsMaxVersion',
  'tlsCipherSuites',
  'httpVersion',
  'resolveToAddress',
  'clientCertificateRef',
  'proxyMode',
  'proxyUrl',
  'proxyCredentialRef',
  'unixSocketPath',
  'cookieJar',
  'timeoutMs',
  'maxResponseBytes',
  'maxRedirects',
  'followOriginalHttpMethod',
  'followAuthorizationHeader',
] as const;

export type SettingsKnobKey = (typeof SETTINGS_KNOB_KEYS)[number];

/** The settings slice of a `Draft` — `Request` carries the same
 *  optional fields, so both sides of the comparison fit this shape. */
export type RequestSettingsSlice = Pick<Draft, SettingsKnobKey>;

/** Stored values equivalent to the cleared knob (the runtime default);
 *  keys without an entry treat only `undefined` as default. */
const DEFAULT_EQUIVALENT: { [K in SettingsKnobKey]?: RequestSettingsSlice[K] } = {
  credentialsMode: 'omit',
  followRedirects: true,
  sslVerification: true,
  httpVersion: 'auto',
  cookieJar: false,
  followOriginalHttpMethod: false,
  followAuthorizationHeader: false,
};

function normalized(slice: RequestSettingsSlice, key: SettingsKnobKey): unknown {
  const value = slice[key];
  return value === DEFAULT_EQUIVALENT[key] ? undefined : value;
}

/** Project the settings knobs out of a draft or a live `Request`. */
export function settingsSlice(source: RequestSettingsSlice): RequestSettingsSlice {
  return {
    credentialsMode: source.credentialsMode,
    followRedirects: source.followRedirects,
    sslVerification: source.sslVerification,
    tlsMinVersion: source.tlsMinVersion,
    tlsMaxVersion: source.tlsMaxVersion,
    tlsCipherSuites: source.tlsCipherSuites,
    httpVersion: source.httpVersion,
    resolveToAddress: source.resolveToAddress,
    clientCertificateRef: source.clientCertificateRef,
    proxyMode: source.proxyMode,
    proxyUrl: source.proxyUrl,
    proxyCredentialRef: source.proxyCredentialRef,
    unixSocketPath: source.unixSocketPath,
    cookieJar: source.cookieJar,
    timeoutMs: source.timeoutMs,
    maxResponseBytes: source.maxResponseBytes,
    maxRedirects: source.maxRedirects,
    followOriginalHttpMethod: source.followOriginalHttpMethod,
    followAuthorizationHeader: source.followAuthorizationHeader,
  };
}

/** Shared empty set for surfaces rendered without a saved baseline. */
export const NO_UNSAVED_SETTINGS: ReadonlySet<SettingsKnobKey> = new Set();

/** Knobs whose normalized draft value differs from the saved one —
 *  one strict compare per knob, minted fresh per call. */
export function unsavedSettingKeys(
  draft: RequestSettingsSlice,
  saved: RequestSettingsSlice,
): ReadonlySet<SettingsKnobKey> {
  const out = new Set<SettingsKnobKey>();
  for (const key of SETTINGS_KNOB_KEYS) {
    if (normalized(draft, key) !== normalized(saved, key)) out.add(key);
  }
  return out;
}
