/**
 * The single network-table row predicate — the text/property URL filter, the
 * type-facet set, and the toolbar coarse filters composed into one decision.
 *
 * Owned here, at the component layer, because it bridges two filter modules:
 * the URL/property grammar + coarse toggles in `data/filter-engine` and the
 * resource-type facets in `traffic/resource-types`. Both the table (which rows
 * to render) and the footer subset (`subset / total`) run THIS function over
 * the same inputs, so the displayed rows and the footer counts can never drift.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { type FilterConfig, type FilterToken, matchesUrlFilter, passesRowFilters } from '../../data/filter-engine';
import { matchesResourceType } from './resource-types';

export interface PanelRowFilters {
  /** Active resource-type facets (empty = all types). */
  readonly filter: ReadonlySet<string>;
  /** Parsed URL-filter tokens (empty = no URL filter). */
  readonly filterTokens: readonly FilterToken[];
  /** Toolbar coarse-filter config (hide data/extension URLs, only 3rd-party, …). */
  readonly filterConfig: FilterConfig;
}

export function matchesPanelFilters(
  lc: RequestLifecycle,
  { filter, filterTokens, filterConfig }: PanelRowFilters,
): boolean {
  if (!passesRowFilters(lc, filterConfig)) return false;
  if (!matchesResourceType(lc.resourceType, filter)) return false;
  if (filterTokens.length > 0 && !matchesUrlFilter(lc, filterTokens, filterConfig)) return false;
  return true;
}
