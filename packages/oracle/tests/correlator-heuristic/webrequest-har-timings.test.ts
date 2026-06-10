/**
 * Pure timing-block synthesis — the webRequest floor and the Resource
 * Timing ladder, including the two accepted limitations the module
 * pins: Timing-Allow-Origin-hidden legs degrade to the floor (never
 * invented), and the missing request-end instant folds send into wait.
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { describe, expect, it } from 'vitest';

import {
  floorHarTimings,
  isResponseBodyIncomplete,
  resourceTimingHarTimings,
} from '../../src/correlator-heuristic/webrequest-har-timings';

const T0 = 1_700_000_000_000;

function rtEntry(overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name: 'https://api.openheaders.io/doc',
    initiatorType: 'navigation',
    nextHopProtocol: 'h2',
    startTime: 0,
    duration: 900,
    transferSize: 300,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    responseStatus: 200,
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 5,
    domainLookupStart: 10,
    domainLookupEnd: 30,
    connectStart: 30,
    connectEnd: 90,
    secureConnectionStart: 50,
    requestStart: 95,
    responseStart: 400,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 900,
    ...overrides,
  };
}

describe('floorHarTimings', () => {
  it('spans blocked to headers-received and receive to the terminal; legs unknown', () => {
    const t = floorHarTimings({ startedAtMs: T0, headersReceivedAtMs: T0 + 400, completedAtMs: T0 + 2_000 });
    expect(t).toEqual({ blocked: 400, dns: -1, connect: -1, ssl: -1, send: -1, wait: -1, receive: 1_600 });
  });

  it('keeps receive open (-1) while the hop is in flight', () => {
    const t = floorHarTimings({ startedAtMs: T0, headersReceivedAtMs: T0 + 400 });
    expect(t.receive).toBe(-1);
    expect(t._blocked_queueing).toBeUndefined();
  });
});

describe('resourceTimingHarTimings', () => {
  it('maps the full connection ladder with the send leg folded into wait', () => {
    const t = resourceTimingHarTimings(rtEntry(), { timeOriginMs: T0 });
    expect(t).toEqual({
      blocked: 10, // startTime → domainLookupStart
      _blocked_queueing: 5, // startTime → fetchStart
      dns: 20,
      connect: 80, // dns-anchored exporter dialect: domainLookupStart → connectEnd
      ssl: 40, // secureConnectionStart → connectEnd
      send: 0, // no request-end instant on this surface
      wait: 305, // requestStart → responseStart
      receive: 500,
    });
  });

  it('returns null when the Timing-Allow-Origin check hid the legs', () => {
    const hidden = rtEntry({
      domainLookupStart: 0,
      domainLookupEnd: 0,
      connectStart: 0,
      connectEnd: 0,
      secureConnectionStart: 0,
      requestStart: 0,
      responseStart: 0,
      responseEnd: 900,
    });
    expect(resourceTimingHarTimings(hidden, { timeOriginMs: T0 })).toBeNull();
  });

  it('reads collapsed dns/connect legs as a reused connection (-1), socket wait inside blocked', () => {
    const reused = rtEntry({
      fetchStart: 5,
      domainLookupStart: 5,
      domainLookupEnd: 5,
      connectStart: 5,
      connectEnd: 5,
      secureConnectionStart: 0,
      requestStart: 40,
    });
    const t = resourceTimingHarTimings(reused, { timeOriginMs: T0 });
    expect(t).toMatchObject({ dns: -1, connect: -1, ssl: -1, blocked: 40, _blocked_queueing: 5 });
  });

  it('ends wait at the FINAL response headers when a 103 interim response came first', () => {
    // Probe-proven (probe-early-hints-navtiming.mjs): with a 103,
    // responseStart reports the interim's first byte while the host's
    // Waiting runs to the real headers — finalResponseHeadersStart.
    const earlyHints = rtEntry({
      responseStart: 130,
      firstInterimResponseStart: 130,
      finalResponseHeadersStart: 2_200,
      responseEnd: 3_000,
    });
    const t = resourceTimingHarTimings(earlyHints, { timeOriginMs: T0 });
    expect(t?.wait).toBe(2_105); // requestStart 95 → final headers 2200
    expect(t?.receive).toBe(800); // final headers 2200 → responseEnd 3000
  });

  it('closes an early-hints open download at the webRequest terminal from the final headers', () => {
    const open = rtEntry({
      responseStart: 130,
      firstInterimResponseStart: 130,
      finalResponseHeadersStart: 2_200,
      responseEnd: 0,
    });
    const t = resourceTimingHarTimings(open, { timeOriginMs: T0, terminalMs: T0 + 3_100 });
    expect(t?.wait).toBe(2_105);
    expect(t?.receive).toBe(900); // terminal − (origin + final headers)
  });

  it('closes an open download at the webRequest terminal instant', () => {
    const open = rtEntry({ responseEnd: 0 });
    const t = resourceTimingHarTimings(open, { timeOriginMs: T0, terminalMs: T0 + 2_000 });
    expect(t?.receive).toBe(1_600); // terminal − (origin + responseStart)
  });

  it('keeps receive open (-1) for an unfinished download with no terminal yet', () => {
    const open = rtEntry({ responseEnd: 0 });
    expect(resourceTimingHarTimings(open, { timeOriginMs: T0 })?.receive).toBe(-1);
  });

  it('measures the final hop of a redirected request from redirectEnd', () => {
    const redirected = rtEntry({
      startTime: 0,
      redirectStart: 0,
      redirectEnd: 200,
      fetchStart: 205,
      domainLookupStart: 210,
      domainLookupEnd: 230,
      connectStart: 230,
      connectEnd: 290,
      secureConnectionStart: 250,
      requestStart: 295,
      responseStart: 600,
    });
    const t = resourceTimingHarTimings(redirected, { timeOriginMs: T0 });
    expect(t).toMatchObject({ blocked: 10, _blocked_queueing: 5, dns: 20, wait: 305 });
  });
});

describe('isResponseBodyIncomplete', () => {
  it('true only for a started-but-never-finished body on an errored hop', () => {
    expect(isResponseBodyIncomplete(rtEntry({ responseEnd: 0 }), 'net::ERR_ABORTED')).toBe(true);
    expect(isResponseBodyIncomplete(rtEntry({ responseEnd: 0 }), undefined)).toBe(false);
    expect(isResponseBodyIncomplete(rtEntry({ responseEnd: 900 }), 'net::ERR_ABORTED')).toBe(false);
    expect(isResponseBodyIncomplete(rtEntry({ responseStart: 0, responseEnd: 0 }), 'net::ERR_ABORTED')).toBe(false);
  });
});
