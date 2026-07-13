/**
 * Form → model projection for the ws / sse message filter, kept beside
 * the schema so every editor surface (save path, awareness banner, …)
 * assembles the exact same shape.
 *
 * The filter-type select carries 'none' for "every frame/event" — that
 * maps to no filter at all. A configured type with an empty value is
 * KEPT: dropping it would silently broaden the rule to every frame,
 * whereas the empty filter fails action validation and holds the rule
 * as a draft.
 */

import type { MessageFilter } from '../types';

export function buildMessageFilter(filterType: unknown, filterValue: unknown): MessageFilter | undefined {
  if (filterType !== 'contains' && filterType !== 'regex') return undefined;
  return { matchType: filterType, value: (filterValue as string) ?? '' };
}
