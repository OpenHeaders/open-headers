/**
 * Heuristic insights for a cascade summary.
 *
 * Same shape as the Timing tab's bottleneck callout — short auto-derived
 * messages that turn the raw summary numbers into prescriptions. The
 * view renders these as a stacked list above the chain tree.
 */

import type { CascadeSummary } from './cascade-summary';

export type CascadeInsightKind = 'failure' | 'third-party' | 'host';

export interface CascadeInsight {
  kind: CascadeInsightKind;
  /** One-liner displayed in bold at the top of the callout. */
  headline: string;
  /** Optional hint rendered below the headline in muted text. */
  hint?: string;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generates 0..3 insights. Order: failures first (reliability),
 * dominant host (perf attribution), third-party share (cleanup target).
 */
export function computeCascadeInsights(summary: CascadeSummary): readonly CascadeInsight[] {
  const out: CascadeInsight[] = [];

  if (summary.failedCount > 0) {
    out.push({
      kind: 'failure',
      headline: `${summary.failedCount} failed request${summary.failedCount === 1 ? '' : 's'} in this cascade.`,
      hint: 'Check ad-blockers, CSP rules, and CORS configuration.',
    });
  }

  if (summary.transferredBytes > 0) {
    let topHost: string | null = null;
    let topBytes = 0;
    let topCount = 0;
    for (const [host, stats] of summary.byHost) {
      if (stats.bytes > topBytes) {
        topHost = host;
        topBytes = stats.bytes;
        topCount = stats.count;
      }
    }
    if (topHost && topBytes / summary.transferredBytes > 0.3) {
      const percent = Math.round((topBytes / summary.transferredBytes) * 100);
      out.push({
        kind: 'host',
        headline: `${topHost} loaded ${topCount} request${topCount === 1 ? '' : 's'} (${formatBytes(topBytes)}) — ${percent}% of cascade weight.`,
        hint: 'Largest single host in this cascade. Self-host or defer if you can.',
      });
    }
  }

  if (summary.transferredBytes > 0 && summary.thirdPartyBytes / summary.transferredBytes > 0.5) {
    const percent = Math.round((summary.thirdPartyBytes / summary.transferredBytes) * 100);
    out.push({
      kind: 'third-party',
      headline: `${percent}% of cascade bytes are third-party.`,
      hint: 'Trim, defer, or self-host non-essential third parties.',
    });
  }

  return out;
}
