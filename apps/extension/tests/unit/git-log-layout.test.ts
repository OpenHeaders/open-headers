// @vitest-environment jsdom
/**
 * Pure-model suite for the Git tool window's three sashes
 * (`git-log-layout.ts`) and the per-workspace prefs posture they
 * persist through (`workspace-prefs-store.ts`): drag bounds never push
 * a neighbour under its floor, shares round-trip, persisted drift
 * degrades field by field, and the grid templates read the model's
 * custom properties.
 */

import {
  detailsBounds,
  GIT_LOG_LAYOUT_DEFAULTS,
  GIT_LOG_LAYOUT_MIN,
  GIT_LOG_LAYOUT_VARS,
  GIT_RAIL_STRIP_WIDTH,
  gitLogColumnsTemplate,
  gitLogDetailRowsTemplate,
  infoBounds,
  normalizeGitLogLayoutPrefs,
  railBounds,
  shareOf,
} from '@openheaders/ui/workbench/components/panels/git/git-log-layout';
import { createWorkspacePrefsStore } from '@openheaders/ui/workbench/components/panels/git/workspace-prefs-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('git log layout bounds', () => {
  it('caps the rail at half the view and never past the log and details floors', () => {
    expect(railBounds(1200)).toEqual({ min: GIT_LOG_LAYOUT_MIN.rail, max: 600 });
    // 700 wide: half is 350, but log (260) + details (220) leave only 220.
    expect(railBounds(700)).toEqual({ min: GIT_LOG_LAYOUT_MIN.rail, max: 220 });
    // Too narrow for anything: the ceiling collapses onto the floor, never below it.
    expect(railBounds(300)).toEqual({ min: GIT_LOG_LAYOUT_MIN.rail, max: GIT_LOG_LAYOUT_MIN.rail });
  });

  it('caps the details column at 65% of what is left of the rail and keeps the log floor', () => {
    expect(detailsBounds(1000)).toEqual({ min: GIT_LOG_LAYOUT_MIN.details, max: 650 });
    // 600 available: 65% is 390, but the log keeps 260 → 340.
    expect(detailsBounds(600)).toEqual({ min: GIT_LOG_LAYOUT_MIN.details, max: 340 });
    expect(detailsBounds(400)).toEqual({ min: GIT_LOG_LAYOUT_MIN.details, max: GIT_LOG_LAYOUT_MIN.details });
  });

  it('lets the info row grow until the file tree sits at its floor', () => {
    expect(infoBounds(500)).toEqual({ min: GIT_LOG_LAYOUT_MIN.info, max: 420 });
    expect(infoBounds(100)).toEqual({ min: GIT_LOG_LAYOUT_MIN.info, max: GIT_LOG_LAYOUT_MIN.info });
  });

  it('turns a pixel size into a bounded four-decimal share', () => {
    expect(shareOf(450, 1000)).toBe(0.45);
    expect(shareOf(1, 3)).toBe(0.3333);
    expect(shareOf(2000, 1000)).toBe(1);
    expect(shareOf(100, 0)).toBe(0);
  });
});

describe('normalizeGitLogLayoutPrefs', () => {
  it('returns the defaults for an empty slot', () => {
    expect(normalizeGitLogLayoutPrefs({})).toEqual(GIT_LOG_LAYOUT_DEFAULTS);
  });

  it('degrades field by field: a rail under its floor lifts, a share outside (0, 1) falls back', () => {
    expect(normalizeGitLogLayoutPrefs({ railWidth: 40, detailsShare: 0.6, infoShare: 1.5 })).toEqual({
      railWidth: GIT_LOG_LAYOUT_MIN.rail,
      detailsShare: 0.6,
      infoShare: GIT_LOG_LAYOUT_DEFAULTS.infoShare,
    });
    expect(normalizeGitLogLayoutPrefs({ railWidth: Number.NaN, detailsShare: 0 })).toEqual(GIT_LOG_LAYOUT_DEFAULTS);
  });
});

describe('grid templates', () => {
  it('reads the rail and details properties with the rail open', () => {
    const columns = gitLogColumnsTemplate(false);
    expect(columns).toBe(
      `minmax(${GIT_LOG_LAYOUT_MIN.rail}px, var(${GIT_LOG_LAYOUT_VARS.rail})) minmax(${GIT_LOG_LAYOUT_MIN.log}px, 1fr) minmax(${GIT_LOG_LAYOUT_MIN.details}px, calc((100% - var(${GIT_LOG_LAYOUT_VARS.rail})) * var(${GIT_LOG_LAYOUT_VARS.details})))`,
    );
  });

  it('pins the strip width with the rail hidden and carves details from the rest', () => {
    const columns = gitLogColumnsTemplate(true);
    expect(columns.startsWith(`${GIT_RAIL_STRIP_WIDTH}px `)).toBe(true);
    expect(columns).toContain(`calc((100% - ${GIT_RAIL_STRIP_WIDTH}px) * var(${GIT_LOG_LAYOUT_VARS.details}))`);
    expect(columns).not.toContain(GIT_LOG_LAYOUT_VARS.rail);
  });

  it('splits the details body only while the info row shows', () => {
    expect(gitLogDetailRowsTemplate(false)).toBe('minmax(0, 1fr)');
    expect(gitLogDetailRowsTemplate(true)).toBe(
      `minmax(${GIT_LOG_LAYOUT_MIN.files}px, 1fr) minmax(${GIT_LOG_LAYOUT_MIN.info}px, calc(100% * var(${GIT_LOG_LAYOUT_VARS.info})))`,
    );
  });
});

describe('createWorkspacePrefsStore', () => {
  interface Prefs {
    size: number;
    on: boolean;
  }
  const defaults: Prefs = { size: 10, on: true };
  const parse = (p: Partial<Prefs>): Prefs => ({
    size: typeof p.size === 'number' ? p.size : defaults.size,
    on: p.on !== false,
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('reads the persisted slot through parse and keys it per workspace', () => {
    localStorage.setItem('oh:test:ws1', JSON.stringify({ size: 42, on: 'nope' }));
    localStorage.setItem('oh:test:ws2', 'not json');
    const store = createWorkspacePrefsStore<Prefs>({ storagePrefix: 'oh:test', defaults, parse });
    expect(store.get('ws1')).toEqual({ size: 42, on: true });
    expect(store.get('ws2')).toEqual(defaults);
    expect(store.get('ws3')).toEqual(defaults);
  });

  it('patch persists, notifies the workspace’s subscribers only, and unsubscribe stops it', () => {
    const store = createWorkspacePrefsStore<Prefs>({ storagePrefix: 'oh:test', defaults, parse });
    const one = vi.fn();
    const two = vi.fn();
    const off = store.subscribe('ws1', one);
    store.subscribe('ws2', two);
    store.patch('ws1', { size: 7 });
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('oh:test:ws1') ?? '{}')).toEqual({ size: 7, on: true });
    off();
    store.patch('ws1', { on: false });
    expect(one).toHaveBeenCalledTimes(1);
    expect(store.get('ws1')).toEqual({ size: 7, on: false });
  });
});
