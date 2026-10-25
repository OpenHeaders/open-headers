/**
 * The event policy table (the v2 plan §4) — the ONE place cadence
 * lives. The controller reads it for latching, the worker for the
 * retention tier, the pack tests for coverage; an if-chain over event
 * names exists nowhere else.
 *
 * - `once-per-install`: a persisted sent-bit (the first run, each
 *   milestone kind) — the install-state tracker's latch.
 * - `once-per-workspace`: latched locally by the workspace the share
 *   opened — the tracker's latch, keyed by an id that never rides the
 *   wire.
 * - `daily`: once per session per UTC day, per `latchBy` member when
 *   one is named — the session store's latch, re-armed at the day roll.
 * - `every`: counted on every occurrence.
 *
 * `volume` is the retention tier: `precious` rows are the funnel facts
 * a dashboard is lost without; `firehose` rows are the counts that can
 * be sampled or summarised first when the archive is ever thinned.
 */

import type { TelemetryEvent, TelemetryEventName } from './events';

export type TelemetryCadence = 'once-per-install' | 'once-per-workspace' | 'daily' | 'every';

export type TelemetryVolume = 'precious' | 'firehose';

export interface TelemetryEventPolicy<Name extends TelemetryEventName = TelemetryEventName> {
  readonly name: Name;
  readonly cadence: TelemetryCadence;
  /** The payload member a `daily` or `once-per-install` latch is keyed by; absent = one latch for the name. */
  readonly latchBy?: Exclude<keyof Extract<TelemetryEvent, { name: Name }>, 'name'>;
  readonly volume: TelemetryVolume;
}

type PolicyTable = { readonly [Name in TelemetryEventName]: TelemetryEventPolicy<Name> };

/** One row of the table, whichever name it is for. */
export type AnyTelemetryEventPolicy = PolicyTable[TelemetryEventName];

export const TELEMETRY_EVENT_POLICY: PolicyTable = {
  first_run: { name: 'first_run', cadence: 'once-per-install', volume: 'precious' },
  session_start: { name: 'session_start', cadence: 'daily', volume: 'firehose' },
  milestone: { name: 'milestone', cadence: 'once-per-install', latchBy: 'kind', volume: 'precious' },
  feature_used: { name: 'feature_used', cadence: 'daily', latchBy: 'feature', volume: 'firehose' },
  rule_created: { name: 'rule_created', cadence: 'every', volume: 'firehose' },
  rule_matched: { name: 'rule_matched', cadence: 'daily', latchBy: 'ruleType', volume: 'firehose' },
  request_sent: { name: 'request_sent', cadence: 'daily', latchBy: 'protocol', volume: 'firehose' },
  import_run: { name: 'import_run', cadence: 'every', volume: 'precious' },
  workflow_run: { name: 'workflow_run', cadence: 'every', volume: 'firehose' },
  share_sent: { name: 'share_sent', cadence: 'every', volume: 'precious' },
  share_accepted: { name: 'share_accepted', cadence: 'once-per-workspace', volume: 'precious' },
  error_beacon: { name: 'error_beacon', cadence: 'daily', latchBy: 'code', volume: 'firehose' },
  license_activated: { name: 'license_activated', cadence: 'every', volume: 'precious' },
  limit_hit: { name: 'limit_hit', cadence: 'every', volume: 'precious' },
  paywall_hit: { name: 'paywall_hit', cadence: 'every', volume: 'precious' },
  upgrade_cta_shown: { name: 'upgrade_cta_shown', cadence: 'daily', latchBy: 'surface', volume: 'firehose' },
  upgrade_cta_clicked: { name: 'upgrade_cta_clicked', cadence: 'every', volume: 'precious' },
  mcp_client_connected: { name: 'mcp_client_connected', cadence: 'daily', latchBy: 'client', volume: 'firehose' },
  viewport_seen: { name: 'viewport_seen', cadence: 'daily', latchBy: 'surface', volume: 'firehose' },
};

export function telemetryPolicyFor(name: TelemetryEventName): AnyTelemetryEventPolicy {
  return TELEMETRY_EVENT_POLICY[name];
}

/**
 * The session-store latch key of a `daily` event keyed by a member
 * (`feature_used:popup`, `rule_matched:header`); null for everything
 * else — `every` counts each occurrence, the install-level cadences are
 * the tracker's, and the bare daily `session_start` has its own two
 * latches in the controller.
 */
export function oncePerSessionLatchKey(event: TelemetryEvent): string | null {
  const policy = telemetryPolicyFor(event.name);
  if (policy.cadence !== 'daily' || policy.latchBy === undefined) return null;
  return `${event.name}:${String(Reflect.get(event, policy.latchBy))}`;
}
