/**
 * The install state block (the v2 plan §3) — the slowly-changing facts
 * of one install, read at flush time and stamped on every event of the
 * envelope. Every member is a closed picklist or an existing bucket;
 * exact counts never ride (the seats grammar below is buckets too).
 *
 * The block is a self-describing FACT, not the KPI definition: the
 * warehouse derives stage, profile and activity from the rows and a
 * view compares the two (the tripwire). One snapshot per batch — an
 * event queued before a state change carries the state at flush.
 */

import * as v from 'valibot';
import { TelemetryPlanBucketSchema, TelemetryScaleBucketSchema, TelemetrySyncKindSchema } from './grammar';

/**
 * The lifecycle ladder, lowest first: `installed` (nothing saved) →
 * `configured` (a rule or a saved request) → `activated` (a rule
 * matched or a request sent, ever) → `retained` (activated and active
 * on three distinct days) → `team` (a role, or a share accepted). The
 * client stamps the highest reached.
 */
export const TELEMETRY_STAGES = ['installed', 'configured', 'activated', 'retained', 'team'] as const;

export const TelemetryStageSchema = v.picklist([...TELEMETRY_STAGES]);

/** The workspace role this install's person holds, the maximum across the directory grants it can see; `none` for a solo install. */
export const TelemetryRoleSchema = v.picklist(['none', 'owner', 'editor', 'viewer']);

/**
 * A seats grammar, not the scale grammar (the v2 plan §3): the member
 * count of the largest workspace the install belongs to, against the
 * six-seat free cap and the fifty-seat Team ceiling.
 */
export const TelemetryTeamBucketSchema = v.picklist(['1', '2-5', '6-10', '11-50', '51+']);

/** Who they are, by behaviour: the tools ever used on this install. */
export const TelemetryProfileSchema = v.picklist(['none', 'interceptor', 'api-client', 'both']);

/** Distinct active UTC days in the trailing 28, kept as a local bitmask; today always counts, so `1` is the floor. */
export const TelemetryActiveDaysBucketSchema = v.picklist(['1', '2-3', '4-9', '10+']);

/**
 * Which tool the install left — the first successful import's source,
 * persisted. `unknown` on installs that predate schema 3 (the seeding
 * rule), `none` until a schema-3 install imports anything.
 */
export const TelemetryMigratedFromSchema = v.picklist([
  'unknown',
  'none',
  'postman',
  'insomnia',
  'bruno',
  'modheader',
  'requestly',
  'har',
  'openapi',
  'other',
]);

/**
 * The block itself. The tracker-derived members (`stage`, `profile`,
 * `activeDays`, `migratedFrom`) are always known and always stamped;
 * the host readings are optional on the wire — omitted where a host
 * cannot read the fact (the CLI reads no workspace, a client joined to
 * a server knows no role or team size), never misreported.
 */
export const TelemetryStateSchema = v.strictObject({
  stage: TelemetryStageSchema,
  rules: v.optional(TelemetryScaleBucketSchema),
  requests: v.optional(TelemetryScaleBucketSchema),
  workspaces: v.optional(TelemetryScaleBucketSchema),
  sync: v.optional(TelemetrySyncKindSchema),
  plan: v.optional(TelemetryPlanBucketSchema),
  role: v.optional(TelemetryRoleSchema),
  team: v.optional(TelemetryTeamBucketSchema),
  profile: TelemetryProfileSchema,
  activeDays: TelemetryActiveDaysBucketSchema,
  migratedFrom: TelemetryMigratedFromSchema,
});

export type TelemetryStage = v.InferOutput<typeof TelemetryStageSchema>;
export type TelemetryRole = v.InferOutput<typeof TelemetryRoleSchema>;
export type TelemetryTeamBucket = v.InferOutput<typeof TelemetryTeamBucketSchema>;
export type TelemetryProfile = v.InferOutput<typeof TelemetryProfileSchema>;
export type TelemetryActiveDaysBucket = v.InferOutput<typeof TelemetryActiveDaysBucketSchema>;
export type TelemetryMigratedFrom = v.InferOutput<typeof TelemetryMigratedFromSchema>;
export type TelemetryState = v.InferOutput<typeof TelemetryStateSchema>;

/** The higher of two stages on the ladder. */
export function maxTelemetryStage(a: TelemetryStage, b: TelemetryStage): TelemetryStage {
  return TELEMETRY_STAGES.indexOf(a) >= TELEMETRY_STAGES.indexOf(b) ? a : b;
}

/** Bucket a workspace's member count onto the seats grammar; nothing reads below one (the install's own person). */
export function bucketTeamSeats(members: number): TelemetryTeamBucket {
  if (members <= 1) return '1';
  if (members <= 5) return '2-5';
  if (members <= 10) return '6-10';
  if (members <= 50) return '11-50';
  return '51+';
}

/** Bucket a distinct-active-days count; today always counts, so nothing reads below one. */
export function bucketActiveDays(days: number): TelemetryActiveDaysBucket {
  if (days <= 1) return '1';
  if (days <= 3) return '2-3';
  if (days <= 9) return '4-9';
  return '10+';
}
