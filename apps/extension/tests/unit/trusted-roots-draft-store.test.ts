/**
 * The trusted-roots draft registry — the renderer-side carrier of the
 * Trusted Certificates tab's unsaved list. Pins: publish / clear per
 * workspace, an empty draft is live (withholds) and distinct from no
 * draft, identical content does not re-emit, and the frame stamp adds
 * `trustedRootsDraft` only while a draft is live for that workspace.
 */

import {
  __resetTrustedRootsDraftsForTests,
  getTrustedRootsDraft,
  publishTrustedRootsDraft,
  withTrustedRootsDraft,
} from '@openheaders/ui/shared/trusted-roots-draft';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT_A = '-----BEGIN CERTIFICATE-----\nA\n-----END CERTIFICATE-----';
const ROOT_B = '-----BEGIN CERTIFICATE-----\nB\n-----END CERTIFICATE-----';

afterEach(() => {
  __resetTrustedRootsDraftsForTests();
});

describe('trusted-roots draft registry', () => {
  it('publishes and clears one list per workspace', () => {
    publishTrustedRootsDraft('ws-1', [ROOT_A]);
    publishTrustedRootsDraft('ws-2', [ROOT_B]);
    expect(getTrustedRootsDraft('ws-1')).toEqual([ROOT_A]);
    expect(getTrustedRootsDraft('ws-2')).toEqual([ROOT_B]);
    expect(getTrustedRootsDraft('ws-3')).toBeUndefined();
    expect(getTrustedRootsDraft(null)).toBeUndefined();
    publishTrustedRootsDraft('ws-1', null);
    expect(getTrustedRootsDraft('ws-1')).toBeUndefined();
    expect(getTrustedRootsDraft('ws-2')).toEqual([ROOT_B]);
  });

  it('an empty draft is live and distinct from no draft; identical content keeps the same snapshot', () => {
    publishTrustedRootsDraft('ws-1', []);
    expect(getTrustedRootsDraft('ws-1')).toEqual([]);
    publishTrustedRootsDraft('ws-1', [ROOT_A]);
    const first = getTrustedRootsDraft('ws-1');
    publishTrustedRootsDraft('ws-1', [ROOT_A]);
    expect(getTrustedRootsDraft('ws-1')).toBe(first);
    publishTrustedRootsDraft('ws-1', [ROOT_A, ROOT_B]);
    expect(getTrustedRootsDraft('ws-1')).not.toBe(first);
  });

  it('stamps the frame only while a draft is live for that workspace', () => {
    const frame = { draft: { uid: 'r1' }, sendId: 's-1' };
    expect(withTrustedRootsDraft(frame, 'ws-1')).toBe(frame);
    publishTrustedRootsDraft('ws-1', [ROOT_A]);
    expect(withTrustedRootsDraft(frame, 'ws-1')).toEqual({ ...frame, trustedRootsDraft: [ROOT_A] });
    expect(withTrustedRootsDraft(frame, 'ws-2')).toBe(frame);
    expect(withTrustedRootsDraft(frame, null)).toBe(frame);
    publishTrustedRootsDraft('ws-1', []);
    expect(withTrustedRootsDraft(frame, 'ws-1')).toEqual({ ...frame, trustedRootsDraft: [] });
  });
});
