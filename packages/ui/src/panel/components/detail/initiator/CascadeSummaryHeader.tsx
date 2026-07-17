import { useT } from '@openheaders/ui/context/LocaleContext';
import type { CascadeSummary } from '../../../data/cascade/cascade-summary';
import { formatBytes, formatMs } from './utils';

export function CascadeSummaryHeader({ summary }: { summary: CascadeSummary }) {
  const t = useT();
  if (summary.requestCount === 0) return null;
  return (
    <div className="dt-initiator-cascade-summary">
      <span className="dt-initiator-cascade-stat">
        <strong>{summary.requestCount}</strong>{' '}
        {t('panel.inspector.initiator.cascade.requestsWord', { count: summary.requestCount })}
      </span>
      <span className="dt-initiator-cascade-stat">
        <strong>{formatBytes(summary.transferredBytes)}</strong> {t('panel.inspector.initiator.cascade.transferred')}
      </span>
      <span className="dt-initiator-cascade-stat">
        <strong>{formatMs(summary.cumulativeMs)}</strong> {t('panel.inspector.initiator.cascade.cumulative')}
      </span>
      {summary.failedCount > 0 && (
        <span className="dt-initiator-cascade-stat" data-tone="warn">
          <strong>{summary.failedCount}</strong> {t('panel.inspector.initiator.cascade.failed')}
        </span>
      )}
    </div>
  );
}
