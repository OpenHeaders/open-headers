/**
 * Cookies-tab variant of the Headers `InsightCard` — same shape, same
 * visual treatment, but renders `CookieInsightAction` instead.
 */

import type { CookieInsight, CookieInsightAction } from '../../../data/cookies/cookie-insights';

export function CookieInsightCard({
  insight,
  onAction,
}: {
  insight: CookieInsight;
  /** Receives the clicked CTA button so the caller can anchor the
   *  in-panel create popover to it. */
  onAction: (action: CookieInsightAction, anchorEl: HTMLElement) => void;
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
          className="dt-btn dt-btn-primary dt-btn--oh dt-header-insight-action"
          onClick={(e) => onAction(insight.action!, e.currentTarget)}
        >
          {insight.action.label}
        </button>
      )}
    </div>
  );
}
