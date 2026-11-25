/**
 * Criteria (the workflow runs plan, The model — "One criteria
 * vocabulary, no language"): what a call's response is held to
 * (`successCriteria`) and what picks an `expect`'s message (`match`).
 *
 * A criterion is an extractor plus a comparison, or a status match. Its
 * `equals` value is a template, resolved once before anything is judged;
 * judging is then pure and synchronous, so every candidate message is
 * held to the same values.
 */

import type { Criterion, Extractor, StatusMatch } from '../types/live';
import { applyExtractor, type ExtractorSubject } from './extractor';
import { matchStatus } from './gate-evaluator';

export type CriteriaVerdict = { ok: true } | { ok: false; reason: string };

/** Whether any criterion's value holds a template for the host to resolve. */
export function criteriaHoldTemplate(criteria: readonly Criterion[]): boolean {
  return criteria.some((criterion) => criterion.kind === 'equals' && criterion.value.includes('{{'));
}

/** The criteria with every `equals` value resolved. */
export async function resolveCriteria(
  criteria: readonly Criterion[],
  resolve: (template: string) => Promise<string>,
): Promise<Criterion[]> {
  const resolved: Criterion[] = [];
  for (const criterion of criteria) {
    resolved.push(criterion.kind === 'equals' ? { ...criterion, value: await resolve(criterion.value) } : criterion);
  }
  return resolved;
}

/** Hold a subject to resolved criteria: every one must hold; the first that does not is the reason. */
export function judgeCriteria(criteria: readonly Criterion[], subject: ExtractorSubject): CriteriaVerdict {
  for (const criterion of criteria) {
    const reason = unmetReason(criterion, subject);
    if (reason !== null) return { ok: false, reason };
  }
  return { ok: true };
}

const SEEN_VALUE_LIMIT = 120;

function unmetReason(criterion: Criterion, subject: ExtractorSubject): string | null {
  if (criterion.kind === 'status') {
    if (subject.status === undefined) return 'A session message has no status.';
    if (matchStatus(subject.status, criterion.match)) return null;
    return `Expected status ${describeStatusMatch(criterion.match)}; got ${subject.status}.`;
  }

  const what = describeExtractor(criterion.extractor);
  const extracted = applyExtractor(criterion.extractor, subject);
  switch (criterion.kind) {
    case 'exists':
      return extracted.ok ? null : `Expected ${what} to exist: ${extracted.message}`;
    case 'equals': {
      const expected = `Expected ${what} to equal "${criterion.value}"`;
      if (!extracted.ok) return `${expected}: ${extracted.message}`;
      return extracted.value === criterion.value ? null : `${expected}; got "${seen(extracted.value)}".`;
    }
    case 'matches': {
      const expected = `Expected ${what} to match /${criterion.pattern}/`;
      if (!extracted.ok) return `${expected}: ${extracted.message}`;
      const regex = compile(criterion.pattern);
      if (regex === null) return `Pattern /${criterion.pattern}/ does not compile.`;
      return regex.test(extracted.value) ? null : `${expected}; got "${seen(extracted.value)}".`;
    }
  }
}

function seen(value: string): string {
  return value.length > SEEN_VALUE_LIMIT ? `${value.slice(0, SEEN_VALUE_LIMIT)}…` : value;
}

function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function describeExtractor(extractor: Extractor): string {
  switch (extractor.kind) {
    case 'json-path':
      return extractor.path;
    case 'header':
      return `header "${extractor.name}"`;
    case 'body-regex':
      return `/${extractor.pattern}/`;
    case 'whole-body':
      return 'the body';
    case 'status-code':
      return 'the status';
  }
}

function describeStatusMatch(match: StatusMatch): string {
  if (typeof match === 'string') return match;
  const [op, arg] = match;
  switch (op) {
    case 'eq':
      return String(arg);
    case 'ne':
      return `other than ${arg}`;
    case 'in':
      return `one of ${arg.join(', ')}`;
  }
}
