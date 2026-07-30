/**
 * Seam helpers — the pinned-pipeline backstop deadline: a timeout-less
 * `'2-prior-knowledge'` / `'3'` send gets the 300 s default (those
 * pipelines have no undici timers behind them), a user-set timeout
 * always wins, and undici-pipeline sends pass through untouched.
 */

import { describe, expect, it } from 'vitest';
import { PINNED_PIPELINE_TIMEOUT_MS, withPinnedPipelineTimeout } from '../../../src/live/request-transport/seam';
import { makeRequest } from './helpers';

describe('withPinnedPipelineTimeout', () => {
  it("defaults a timeout-less '3' send to the backstop deadline", () => {
    const out = withPinnedPipelineTimeout(makeRequest({ httpVersion: '3' }));
    expect(out.timeoutMs).toBe(PINNED_PIPELINE_TIMEOUT_MS);
  });

  it("defaults a timeout-less '2-prior-knowledge' send to the backstop deadline", () => {
    const out = withPinnedPipelineTimeout(makeRequest({ httpVersion: '2-prior-knowledge' }));
    expect(out.timeoutMs).toBe(PINNED_PIPELINE_TIMEOUT_MS);
  });

  it('never overrides a user-set timeout', () => {
    const request = makeRequest({ httpVersion: '3', timeoutMs: 15_000 });
    expect(withPinnedPipelineTimeout(request)).toBe(request);
  });

  it('passes undici-pipeline sends through untouched — their timers backstop them', () => {
    for (const httpVersion of [undefined, 'auto', '1.1', '2'] as const) {
      const request = makeRequest(httpVersion !== undefined ? { httpVersion } : {});
      expect(withPinnedPipelineTimeout(request)).toBe(request);
      expect(request.timeoutMs).toBeUndefined();
    }
  });
});
