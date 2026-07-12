/**
 * Rate-budget reading + failure classification. Budget state comes from
 * response headers only — plan caps drift across plan lineups and are
 * never hardcoded. Two distinct exhaustion modes: a 429 minute-bucket
 * hit is transient (honor RetryAfter, resume); the monthly service cap
 * is terminal for the run (stop, clearly-labeled partial report).
 */

import { isRecord } from '../data-scan/json';
import type { PullFailure, PullRateBudget } from './types';

/** Pause applied to a 429 that carried no usable RetryAfter header. */
export const DEFAULT_RETRY_AFTER_SECONDS = 10;

export type HeaderLookup = (name: string) => string | null;

function readIntHeader(header: HeaderLookup, ...names: string[]): number | undefined {
  for (const name of names) {
    const raw = header(name);
    if (raw === null) continue;
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return undefined;
}

/** Read the budget headers off one response. */
export function readRateBudget(header: HeaderLookup): PullRateBudget {
  const limitMonth = readIntHeader(header, 'RateLimit-Limit-Month');
  const remainingMonth = readIntHeader(header, 'RateLimit-Remaining-Month');
  const retryAfterSeconds = readIntHeader(header, 'RetryAfter', 'Retry-After');
  return {
    ...(limitMonth !== undefined ? { limitMonth } : {}),
    ...(remainingMonth !== undefined ? { remainingMonth } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

function bodyError(bodyText: string): { name?: string; message?: string } {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (isRecord(parsed) && isRecord(parsed.error)) {
      return {
        ...(typeof parsed.error.name === 'string' ? { name: parsed.error.name } : {}),
        ...(typeof parsed.error.message === 'string' ? { message: parsed.error.message } : {}),
      };
    }
  } catch {
    // Non-JSON body — classified on status alone.
  }
  return {};
}

/**
 * Classify a non-OK response. The reason strings are user-facing and
 * never echo the key.
 */
export function classifyPullFailure(status: number, bodyText: string, budget: PullRateBudget): PullFailure {
  const { name, message } = bodyError(bodyText);
  if (status === 401 || status === 403) {
    return {
      kind: 'unauthorized',
      status,
      reason: `The Data API rejected the key (HTTP ${status}). Check the key and try again.`,
    };
  }
  if (status === 429) {
    const serviceLimit = /service.?limit/i.test(`${name ?? ''} ${message ?? ''}`) || budget.remainingMonth === 0;
    if (serviceLimit) {
      return {
        kind: 'service-limit-exhausted',
        status,
        reason:
          'The monthly Data API service limit is exhausted — the pull stopped and will not retry. Re-run after the limit resets.',
      };
    }
    return {
      kind: 'rate-limited',
      status,
      reason: 'Rate limited by the Data API — pausing before the next attempt.',
      retryAfterSeconds: budget.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS,
    };
  }
  return {
    kind: 'http-error',
    status,
    reason: `The Data API answered HTTP ${status}${message !== undefined ? ` — ${message}` : ''}.`,
  };
}
