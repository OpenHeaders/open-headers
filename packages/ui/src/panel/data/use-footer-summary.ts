/**
 * Status-bar (footer) summary figures — total/filtered byte counts, the
 * filtered-subset block, and the Finish / DCL / Load timing scope. Owns
 * the `footerTimingMode` setting read (aggregate timeline vs latest
 * navigation).
 */

import { useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { useMemo } from 'react';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { computeFooterSubset, type UsePanelDataResult } from './panel-data-projection';
import { formatBytesToKb } from './size-info';
import { formatFooterDuration } from './timing/footer-timing';

// Footer totals use decimal (1000-byte) units, matching the Size column
// (`formatBytesToKb`) and the host network table's status-bar figures.
function formatBytes(total: number): string {
  if (total < 1000) return `${total} B`;
  if (total < 1000 * 1000) return `${(total / 1000).toFixed(1)} kB`;
  return `${(total / (1000 * 1000)).toFixed(1)} MB`;
}

export interface FooterSubsetFigures {
  requestCount: number;
  transferredSize: string;
  resourceSize: string;
  totalTransferredSize: string;
  totalResourceSize: string;
}

export interface FooterSummary {
  transferredSize: string;
  resourceSize: string;
  footerSubset: FooterSubsetFigures | undefined;
  finishTime: string;
  footerDclMs: number | undefined;
  footerLoadMs: number | undefined;
}

export function useFooterSummary(
  data: UsePanelDataResult,
  filteredRows: readonly InspectorRowWithFires[],
): FooterSummary {
  const [footerTimingMode] = useSetting('devpanelLayout.footerTimingMode');

  const transferredSize = useMemo(() => formatBytes(data.totalBytesTransferred), [data.totalBytesTransferred]);
  const resourceSize = useMemo(() => formatBytes(data.totalResourceSize), [data.totalResourceSize]);
  // Filtered-subset footer figures. The browser's summary bar reads
  // `subset / total` for requests / transferred / resources whenever the filter
  // hides at least one row (count-based, exactly its `selectedNodeNumber !==
  // nodeCount` trigger); Finish / DCL / Load stay full. Both byte sides are
  // formatted in kB (`formatBytesToKb`) — the browser keeps the comparison in a
  // single unit there (it never rolls the subset/total to MB the way the
  // single-total form does), so the two figures stay directly comparable.
  // Computed from the same `computeFooterTotals` the projection runs over the
  // full set, and over the shared `filteredRows`, so the subset grows live as a
  // passing row streams.
  const footerSubset = useMemo(() => {
    const totals = computeFooterSubset(data.rows, filteredRows);
    if (!totals) return undefined;
    return {
      requestCount: totals.requestCount,
      transferredSize: formatBytesToKb(totals.totalBytesTransferred),
      resourceSize: formatBytesToKb(totals.totalResourceSize),
      totalTransferredSize: formatBytesToKb(data.totalBytesTransferred),
      totalResourceSize: formatBytesToKb(data.totalResourceSize),
    };
  }, [data.rows, filteredRows, data.totalBytesTransferred, data.totalResourceSize]);
  // Footer timing scope: aggregate (whole preserve-log timeline, browser
  // default) vs the latest navigation only. Coincide for a single navigation.
  const aggregateTiming = footerTimingMode !== 'lastNav';
  const finishTimeMs = aggregateTiming ? data.aggregateFinishMs : data.finishTimeMs;
  const footerDclMs = aggregateTiming ? data.aggregateDclMs : data.footerDclMs;
  const footerLoadMs = aggregateTiming ? data.aggregateLoadMs : data.footerLoadMs;
  const finishTime = useMemo(() => formatFooterDuration(finishTimeMs), [finishTimeMs]);

  return { transferredSize, resourceSize, footerSubset, finishTime, footerDclMs, footerLoadMs };
}
