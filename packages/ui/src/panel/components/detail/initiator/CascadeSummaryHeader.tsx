import type { CascadeSummary } from '../../../data/cascade/cascade-summary';
import { formatBytes, formatMs } from './utils';

export function CascadeSummaryHeader({ summary }: { summary: CascadeSummary }) {
  if (summary.requestCount === 0) return null;
  return (
    <div className="dt-initiator-cascade-summary">
      <span className="dt-initiator-cascade-stat">
        <strong>{summary.requestCount}</strong> request{summary.requestCount === 1 ? '' : 's'}
      </span>
      <span className="dt-initiator-cascade-stat">
        <strong>{formatBytes(summary.transferredBytes)}</strong> transferred
      </span>
      <span className="dt-initiator-cascade-stat">
        <strong>{formatMs(summary.cumulativeMs)}</strong> cumulative
      </span>
      {summary.failedCount > 0 && (
        <span className="dt-initiator-cascade-stat" data-tone="warn">
          <strong>{summary.failedCount}</strong> failed
        </span>
      )}
    </div>
  );
}
