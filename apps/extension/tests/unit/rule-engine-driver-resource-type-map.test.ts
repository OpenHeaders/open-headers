/**
 * Resource-type vocabulary seam: lifecycle `resourceType` (per-correlator
 * vocab) → `TrackedResourceType` (the driver's webRequest vocab).
 *
 * Regression for the S42/S43 CDP vocab leak: 'document'/'xhr' were cast
 * to TrackedResourceType unmapped, so the main-frame commit gate
 * (`meta.resourceType === 'main_frame'` in tab-telemetry) silently
 * missed on CDP tabs.
 */

import { describe, expect, it } from 'vitest';

import { clearMainFrameId, isMainFrame, setMainFrameId } from '@/background/correlator-host/main-frame-registry';
import { toTrackedResourceType } from '@/background/rule-engine-driver/resource-type-map';

describe('toTrackedResourceType', () => {
  it('is identity for the webRequest vocabulary (heuristic path)', () => {
    for (const t of [
      'main_frame',
      'sub_frame',
      'xmlhttprequest',
      'script',
      'stylesheet',
      'image',
      'font',
      'media',
      'websocket',
      'ping',
      'other',
    ]) {
      expect(toTrackedResourceType(t, false)).toBe(t);
    }
  });

  it('splits CDP document by the main-frame verdict', () => {
    expect(toTrackedResourceType('document', true)).toBe('main_frame');
    expect(toTrackedResourceType('document', false)).toBe('sub_frame');
  });

  it('maps CDP xhr-family types to xmlhttprequest', () => {
    expect(toTrackedResourceType('xhr', false)).toBe('xmlhttprequest');
    expect(toTrackedResourceType('fetch', false)).toBe('xmlhttprequest');
    expect(toTrackedResourceType('eventsource', false)).toBe('xmlhttprequest');
  });

  it('folds types webRequest never surfaces to other', () => {
    for (const t of ['preflight', 'manifest', 'signedexchange', 'texttrack', 'prefetch', 'cspviolationreport']) {
      expect(toTrackedResourceType(t, false)).toBe('other');
    }
  });

  it('folds unknown future vocabulary to other instead of leaking it', () => {
    expect(toTrackedResourceType('fedcm', false)).toBe('other');
  });
});

describe('main-frame registry', () => {
  it('answers false until seeded, true for the seeded frame, false after clear', () => {
    clearMainFrameId(7);
    expect(isMainFrame(7, 'F1')).toBe(false);
    setMainFrameId(7, 'F1');
    expect(isMainFrame(7, 'F1')).toBe(true);
    expect(isMainFrame(7, 'F2')).toBe(false);
    expect(isMainFrame(8, 'F1')).toBe(false);
    clearMainFrameId(7);
    expect(isMainFrame(7, 'F1')).toBe(false);
  });

  it('treats an absent frameId as not-main (worker requests, heuristic lifecycles)', () => {
    setMainFrameId(7, 'F1');
    expect(isMainFrame(7, undefined)).toBe(false);
    clearMainFrameId(7);
  });
});
