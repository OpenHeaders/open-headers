import type { CascadeInsight } from '../../../data/cascade/cascade-insights';

export function InsightCallout({ insight }: { insight: CascadeInsight }) {
  const icon = insight.kind === 'failure' ? '⚠' : '⚡';
  return (
    <div className="dt-initiator-insight" data-kind={insight.kind}>
      <span className="dt-initiator-insight-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="dt-initiator-insight-body">
        <div className="dt-initiator-insight-headline">{insight.headline}</div>
        {insight.hint && <div className="dt-initiator-insight-hint">{insight.hint}</div>}
      </div>
    </div>
  );
}
