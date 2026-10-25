/**
 * The install-state tracker (the v2 plan §3) — the small persisted
 * record from which `stage`, `profile`, `activeDays` and `migratedFrom`
 * derive, and the latch behind every once-per-install event. Pure
 * functions over a record the host persists beside the install
 * identity; the controller owns the record's lifecycle (minted or
 * seeded on the first enabled boot, wiped with the identity on
 * toggle-off), the hosts supply the live readings.
 *
 * The record holds: the milestones already announced (sent or seeded),
 * a 28-day activity bitmask, the tools ever used, the first import's
 * origin, and the local latch of accepted shares — keyed by ids that
 * never ride the wire. Nothing here is an identifier of the install.
 *
 * Seeding (plan §3, the upgrade of the existing fleet): on the first
 * boot under schema 3 the tracker is empty but the install is not, so
 * the sent-bits seed from host state WITHOUT emitting — rules exist →
 * the first rule was created, saved requests → the first request was
 * sent, a server backend → the first server was joined, an owner's
 * grant → a share went out, an editor's or viewer's → one came in. No
 * host persists "a rule ever matched", so an install older than the
 * `8-30` bucket that seeds `configured` seeds `activated` too; younger
 * installs climb on their next match. `migratedFrom` reads `unknown`.
 */

import * as v from 'valibot';
import type { TelemetryEvent } from './vocabulary/events';
import type { TelemetryMilestoneKind, TelemetryPlanBucket, TelemetrySyncKind } from './vocabulary/grammar';
import { bucketScale, bucketSinceInstall, DAY_MS, TelemetryMilestoneKindSchema } from './vocabulary/grammar';
import { migratedFromImportSource } from './vocabulary/mappers';
import type { TelemetryMigratedFrom, TelemetryRole, TelemetryStage, TelemetryState } from './vocabulary/state';
import { bucketActiveDays, bucketTeamSeats, TelemetryMigratedFromSchema } from './vocabulary/state';

/** Days of activity the bitmask remembers; the `activeDays` bucket counts within it. */
export const TELEMETRY_ACTIVITY_WINDOW_DAYS = 28;

const ACTIVITY_MASK = (1 << TELEMETRY_ACTIVITY_WINDOW_DAYS) - 1;

/** The persisted record. `activity.day` is the UTC day index of bit 0; higher bits are earlier days. */
export interface TelemetryInstallStateRecord {
  version: 1;
  milestones: TelemetryMilestoneKind[];
  activity: { day: number; bits: number };
  tools: { interceptor: boolean; apiClient: boolean };
  migratedFrom: TelemetryMigratedFrom;
  /** Local latch keys of the shares accepted (an Org or workspace id); never on the wire. */
  acceptedShares: string[];
  seeded: boolean;
}

const InstallStateRecordSchema = v.strictObject({
  version: v.literal(1),
  milestones: v.array(TelemetryMilestoneKindSchema),
  activity: v.strictObject({ day: v.pipe(v.number(), v.integer()), bits: v.pipe(v.number(), v.integer()) }),
  tools: v.strictObject({ interceptor: v.boolean(), apiClient: v.boolean() }),
  migratedFrom: TelemetryMigratedFromSchema,
  acceptedShares: v.array(v.string()),
  seeded: v.boolean(),
});

/** A persisted value read back as the record, or null for anything else (an older shape re-seeds; never a crash). */
export function readInstallStateRecord(value: unknown): TelemetryInstallStateRecord | null {
  const parsed = v.safeParse(InstallStateRecordSchema, value);
  return parsed.success ? parsed.output : null;
}

/**
 * What a host can read of its install at flush time (plan §3). Every
 * member is optional: a host omits what it cannot read — the CLI holds
 * no workspace, a client joined to a server knows neither its role nor
 * the team's size — and the state block carries no member for it.
 */
export interface ProductTelemetryHostReadings {
  /** Rules in the active workspace. */
  rules?: number;
  /** Saved requests across workspaces, every protocol. */
  requests?: number;
  workspaces?: number;
  sync?: TelemetrySyncKind;
  plan?: TelemetryPlanBucket;
  /** The maximum role this install's person holds across the directory grants it can see. */
  role?: TelemetryRole;
  /** Member count of the largest workspace the install belongs to. */
  team?: number;
}

/** The UTC day index (days since the epoch) of an instant. */
export function utcDayIndex(now: number): number {
  return Math.floor(now / DAY_MS);
}

export function freshInstallState(day: number): TelemetryInstallStateRecord {
  return {
    version: 1,
    milestones: [],
    activity: { day, bits: 1 },
    tools: { interceptor: false, apiClient: false },
    migratedFrom: 'none',
    acceptedShares: [],
    seeded: false,
  };
}

/** Plan §3's seeding rule, applied once to an install that predates its tracker. */
export function seedInstallState(
  readings: ProductTelemetryHostReadings,
  install: { installedAt: number; now: number },
): TelemetryInstallStateRecord {
  const milestones = new Set<TelemetryMilestoneKind>();
  const rules = (readings.rules ?? 0) > 0;
  const requests = (readings.requests ?? 0) > 0;
  if (rules) {
    milestones.add('first_rule_created');
    if (bucketSinceInstall(install.installedAt, install.now) === '31+') milestones.add('first_rule_matched');
  }
  if (requests) milestones.add('first_request_sent');
  if (readings.sync === 'server') milestones.add('first_server_connected');
  if (readings.role === 'owner') milestones.add('first_share_sent');
  if (readings.role === 'editor' || readings.role === 'viewer') milestones.add('first_share_accepted');
  return {
    version: 1,
    milestones: [...milestones],
    activity: { day: utcDayIndex(install.now), bits: 1 },
    tools: { interceptor: rules, apiClient: requests },
    migratedFrom: 'unknown',
    acceptedShares: [],
    seeded: true,
  };
}

/** Mark a UTC day active. A day earlier than bit 0 (a clock that ran backwards) sets its own bit when it is still in the window. */
export function markActiveDay(record: TelemetryInstallStateRecord, day: number): TelemetryInstallStateRecord {
  const { activity } = record;
  if (day > activity.day) {
    const shift = day - activity.day;
    const bits = shift >= TELEMETRY_ACTIVITY_WINDOW_DAYS ? 1 : ((activity.bits << shift) & ACTIVITY_MASK) | 1;
    return { ...record, activity: { day, bits } };
  }
  const back = activity.day - day;
  if (back >= TELEMETRY_ACTIVITY_WINDOW_DAYS) return record;
  const bits = activity.bits | (1 << back);
  return bits === activity.bits ? record : { ...record, activity: { ...activity, bits } };
}

/** Distinct active days in the window. */
export function activeDayCount(record: TelemetryInstallStateRecord): number {
  let count = 0;
  for (let bits = record.activity.bits & ACTIVITY_MASK; bits !== 0; bits >>>= 1) count += bits & 1;
  return count;
}

export interface InstallStateObservation {
  record: TelemetryInstallStateRecord;
  /** The milestones this observation reached for the first time, in the order to emit them. */
  milestones: TelemetryMilestoneKind[];
}

function reach(
  record: TelemetryInstallStateRecord,
  kinds: readonly TelemetryMilestoneKind[],
  patch: Partial<TelemetryInstallStateRecord> = {},
): InstallStateObservation {
  const milestones = kinds.filter((kind) => !record.milestones.includes(kind));
  const changed = milestones.length > 0 || Object.keys(patch).length > 0;
  return {
    record: changed ? { ...record, ...patch, milestones: [...record.milestones, ...milestones] } : record,
    milestones,
  };
}

/**
 * Fold one tracked event into the record: the tool it proves, the
 * origin it names, and the milestone it reaches when it is the first
 * of its kind. The controller emits the returned milestones right
 * behind the event.
 */
export function observeTelemetryEvent(
  record: TelemetryInstallStateRecord,
  event: TelemetryEvent,
): InstallStateObservation {
  switch (event.name) {
    case 'rule_created':
      return reach(record, ['first_rule_created'], interceptorTool(record));
    case 'rule_matched':
      return reach(record, ['first_rule_matched'], interceptorTool(record));
    case 'request_sent':
      return reach(record, ['first_request_sent'], apiClientTool(record));
    case 'import_run': {
      if (!event.ok) return { record, milestones: [] };
      const origin = record.migratedFrom === 'none' ? { migratedFrom: migratedFromImportSource(event.source) } : {};
      return reach(record, ['first_import'], origin);
    }
    case 'workflow_run':
      return event.ok ? reach(record, ['first_workflow_run']) : { record, milestones: [] };
    case 'share_sent':
      return reach(record, ['first_share_sent']);
    case 'share_accepted':
      return reach(record, ['first_share_accepted']);
    case 'license_activated':
      return reach(record, ['first_license']);
    case 'mcp_client_connected':
      return reach(record, ['first_mcp_client']);
    default:
      return { record, milestones: [] };
  }
}

const interceptorTool = (record: TelemetryInstallStateRecord): Partial<TelemetryInstallStateRecord> =>
  record.tools.interceptor ? {} : { tools: { ...record.tools, interceptor: true } };

const apiClientTool = (record: TelemetryInstallStateRecord): Partial<TelemetryInstallStateRecord> =>
  record.tools.apiClient ? {} : { tools: { ...record.tools, apiClient: true } };

/**
 * Fold the readings in: a rule or a saved request on the install proves
 * the tool was used ("ever used" latches, so a later empty workspace
 * does not unmake a profile), and a server backend configured is the
 * first server joined.
 */
export function observeHostReadings(
  record: TelemetryInstallStateRecord,
  readings: ProductTelemetryHostReadings,
): InstallStateObservation {
  const interceptor = record.tools.interceptor || (readings.rules ?? 0) > 0;
  const apiClient = record.tools.apiClient || (readings.requests ?? 0) > 0;
  const tools =
    interceptor === record.tools.interceptor && apiClient === record.tools.apiClient
      ? {}
      : { tools: { interceptor, apiClient } };
  return reach(record, readings.sync === 'server' ? ['first_server_connected'] : [], tools);
}

/** The once-per-workspace latch of `share_accepted`: `first` is true the first time `key` is seen. */
export function latchShareAccepted(
  record: TelemetryInstallStateRecord,
  key: string,
): { record: TelemetryInstallStateRecord; first: boolean } {
  if (record.acceptedShares.includes(key)) return { record, first: false };
  return { record: { ...record, acceptedShares: [...record.acceptedShares, key] }, first: true };
}

function deriveStage(record: TelemetryInstallStateRecord, readings: ProductTelemetryHostReadings): TelemetryStage {
  const has = (kind: TelemetryMilestoneKind): boolean => record.milestones.includes(kind);
  if ((readings.role !== undefined && readings.role !== 'none') || has('first_share_accepted')) return 'team';
  const activated = has('first_rule_matched') || has('first_request_sent');
  if (activated && activeDayCount(record) >= 3) return 'retained';
  if (activated) return 'activated';
  const configured =
    has('first_rule_created') || has('first_request_sent') || (readings.rules ?? 0) > 0 || (readings.requests ?? 0) > 0;
  return configured ? 'configured' : 'installed';
}

/** The state block for one envelope: the ladder, the readings bucketed, the tracker's own facts. */
export function deriveTelemetryState(
  record: TelemetryInstallStateRecord,
  readings: ProductTelemetryHostReadings,
): TelemetryState {
  const interceptor = record.tools.interceptor || (readings.rules ?? 0) > 0;
  const apiClient = record.tools.apiClient || (readings.requests ?? 0) > 0;
  return {
    stage: deriveStage(record, readings),
    ...(readings.rules !== undefined ? { rules: bucketScale(readings.rules) } : {}),
    ...(readings.requests !== undefined ? { requests: bucketScale(readings.requests) } : {}),
    ...(readings.workspaces !== undefined ? { workspaces: bucketScale(readings.workspaces) } : {}),
    ...(readings.sync !== undefined ? { sync: readings.sync } : {}),
    ...(readings.plan !== undefined ? { plan: readings.plan } : {}),
    ...(readings.role !== undefined ? { role: readings.role } : {}),
    ...(readings.team !== undefined ? { team: bucketTeamSeats(readings.team) } : {}),
    profile: interceptor && apiClient ? 'both' : interceptor ? 'interceptor' : apiClient ? 'api-client' : 'none',
    activeDays: bucketActiveDays(activeDayCount(record)),
    migratedFrom: record.migratedFrom,
  };
}
