import type { HeaderInsight, HeaderInsightAction } from '../../../data/header-insights';

export function InsightCard({
  insight,
  onAction,
}: {
  insight: HeaderInsight;
  onAction: (action: HeaderInsightAction) => void;
}) {
  return (
    <div className="dt-header-insight" data-severity={insight.severity}>
      <span className="dt-header-insight-icon" aria-hidden="true">
        {insight.severity === 'err' ? '⚠' : insight.severity === 'warn' ? '⚠' : 'ℹ'}
      </span>
      <div className="dt-header-insight-body">
        <div className="dt-header-insight-title">{insight.title}</div>
        {insight.detail && <div className="dt-header-insight-detail">{insight.detail}</div>}
      </div>
      {insight.action && (
        <button
          type="button"
          className="dt-btn dt-btn-primary dt-header-insight-action"
          onClick={() => onAction(insight.action!)}
        >
          {insight.action.label}
        </button>
      )}
    </div>
  );
}
