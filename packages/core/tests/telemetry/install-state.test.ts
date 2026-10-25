import { describe, expect, it } from 'vitest';
import {
  activeDayCount,
  deriveTelemetryState,
  freshInstallState,
  latchShareAccepted,
  markActiveDay,
  observeHostReadings,
  observeTelemetryEvent,
  seedInstallState,
  TELEMETRY_ACTIVITY_WINDOW_DAYS,
  utcDayIndex,
} from '../../src/telemetry';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_760_000_000_000;
const TODAY = utcDayIndex(NOW);

describe('the install-state tracker — activity', () => {
  it('counts today as the first active day and keeps the trailing window as a bitmask', () => {
    let record = freshInstallState(TODAY);
    expect(activeDayCount(record)).toBe(1);
    record = markActiveDay(record, TODAY);
    expect(activeDayCount(record)).toBe(1);
    record = markActiveDay(record, TODAY + 1);
    record = markActiveDay(record, TODAY + 3);
    expect(activeDayCount(record)).toBe(3);
    expect(record.activity).toEqual({ day: TODAY + 3, bits: 0b1101 });
  });

  it('forgets a day once it leaves the window and resets on a gap longer than the window', () => {
    let record = freshInstallState(TODAY);
    record = markActiveDay(record, TODAY + TELEMETRY_ACTIVITY_WINDOW_DAYS - 1);
    expect(activeDayCount(record)).toBe(2);
    record = markActiveDay(record, TODAY + TELEMETRY_ACTIVITY_WINDOW_DAYS);
    expect(activeDayCount(record)).toBe(2);
    record = markActiveDay(record, TODAY + 3 * TELEMETRY_ACTIVITY_WINDOW_DAYS);
    expect(record.activity).toEqual({ day: TODAY + 3 * TELEMETRY_ACTIVITY_WINDOW_DAYS, bits: 1 });
  });

  it('sets an earlier day inside the window when the clock ran backwards, and ignores one outside it', () => {
    const record = markActiveDay(freshInstallState(TODAY), TODAY - 2);
    expect(record.activity).toEqual({ day: TODAY, bits: 0b101 });
    expect(markActiveDay(record, TODAY - TELEMETRY_ACTIVITY_WINDOW_DAYS)).toBe(record);
    expect(markActiveDay(record, TODAY)).toBe(record);
  });
});

describe('the install-state tracker — observing events', () => {
  it('reaches each milestone once and returns the same record when nothing changed', () => {
    const fresh = freshInstallState(TODAY);
    const first = observeTelemetryEvent(fresh, { name: 'rule_created', ruleType: 'header', origin: 'editor' });
    expect(first.milestones).toEqual(['first_rule_created']);
    expect(first.record.tools).toEqual({ interceptor: true, apiClient: false });
    const again = observeTelemetryEvent(first.record, { name: 'rule_created', ruleType: 'block', origin: 'editor' });
    expect(again.milestones).toEqual([]);
    expect(again.record).toBe(first.record);
    const untracked = observeTelemetryEvent(first.record, { name: 'feature_used', feature: 'popup' });
    expect(untracked.record).toBe(first.record);
  });

  it('maps the slice-one shapes onto their milestones', () => {
    const fresh = freshInstallState(TODAY);
    expect(observeTelemetryEvent(fresh, { name: 'request_sent', protocol: 'ws' }).milestones).toEqual([
      'first_request_sent',
    ]);
    expect(
      observeTelemetryEvent(fresh, { name: 'share_sent', route: 'git', role: 'editor', members: '1' }).milestones,
    ).toEqual(['first_share_sent']);
    expect(observeTelemetryEvent(fresh, { name: 'share_accepted', route: 'server' }).milestones).toEqual([
      'first_share_accepted',
    ]);
    expect(observeTelemetryEvent(fresh, { name: 'license_activated', plan: 'team' }).milestones).toEqual([
      'first_license',
    ]);
    expect(observeTelemetryEvent(fresh, { name: 'mcp_client_connected', client: 'cursor' }).milestones).toEqual([
      'first_mcp_client',
    ]);
    expect(observeTelemetryEvent(fresh, { name: 'workflow_run', ok: true }).milestones).toEqual(['first_workflow_run']);
    expect(observeTelemetryEvent(fresh, { name: 'workflow_run', ok: false }).milestones).toEqual([]);
    expect(observeTelemetryEvent(fresh, { name: 'limit_hit', limit: 'seats' }).milestones).toEqual([]);
  });

  it('keeps a seeded unknown origin even after a later import', () => {
    const seeded = seedInstallState({ rules: 1 }, { installedAt: NOW - 3 * DAY, now: NOW });
    const imported = observeTelemetryEvent(seeded, { name: 'import_run', source: 'bruno', ok: true });
    expect(imported.record.migratedFrom).toBe('unknown');
    expect(imported.milestones).toEqual(['first_import']);
  });

  it('latches a share key once', () => {
    const fresh = freshInstallState(TODAY);
    const first = latchShareAccepted(fresh, 'org-1');
    expect(first.first).toBe(true);
    expect(latchShareAccepted(first.record, 'org-1')).toEqual({ record: first.record, first: false });
  });

  it('reaches first_server_connected from a server reading alone', () => {
    const fresh = freshInstallState(TODAY);
    expect(observeHostReadings(fresh, { sync: 'git' }).milestones).toEqual([]);
    expect(observeHostReadings(fresh, { sync: 'server' }).milestones).toEqual(['first_server_connected']);
  });
});

describe('the install-state tracker — the ladder', () => {
  it('derives installed → configured → activated → retained → team', () => {
    let record = freshInstallState(TODAY);
    expect(deriveTelemetryState(record, {}).stage).toBe('installed');
    expect(deriveTelemetryState(record, { requests: 1 }).stage).toBe('configured');
    record = observeTelemetryEvent(record, { name: 'rule_created', ruleType: 'header', origin: 'editor' }).record;
    expect(deriveTelemetryState(record, {}).stage).toBe('configured');
    record = observeTelemetryEvent(record, { name: 'rule_matched', ruleType: 'header' }).record;
    expect(deriveTelemetryState(record, {}).stage).toBe('activated');
    record = markActiveDay(markActiveDay(record, TODAY + 1), TODAY + 2);
    expect(deriveTelemetryState(record, {}).stage).toBe('retained');
    expect(deriveTelemetryState(record, { role: 'editor' }).stage).toBe('team');
    expect(deriveTelemetryState(record, { role: 'none' }).stage).toBe('retained');
  });

  it('buckets the readings and names the profile by the tools ever used', () => {
    const record = observeTelemetryEvent(freshInstallState(TODAY), { name: 'request_sent', protocol: 'grpc' }).record;
    expect(
      deriveTelemetryState(record, {
        rules: 21,
        requests: 0,
        workspaces: 6,
        sync: 'git',
        plan: 'individual',
        role: 'none',
        team: 1,
      }),
    ).toEqual({
      stage: 'activated',
      rules: '21-100',
      requests: '0',
      workspaces: '6-20',
      sync: 'git',
      plan: 'individual',
      role: 'none',
      team: '1',
      profile: 'both',
      activeDays: '1',
      migratedFrom: 'none',
    });
  });
});
