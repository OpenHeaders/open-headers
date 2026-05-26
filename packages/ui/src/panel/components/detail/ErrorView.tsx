/**
 * Detail pane for lifecycles that resolved to a `failed` terminal —
 * blocked / canceled / network-failed requests with no usable response,
 * headers, cookies, or timing breakdown. Replaces the usual tab set with
 * a single "Error" pane explaining what happened and why.
 */

import type { RequestError, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { lookupErrorCode } from '../../data/chromium-error-codes';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';

interface ErrorViewProps {
  row: InspectorRowWithFires & { lifecycle: RequestLifecycle & { error: RequestError } };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function ErrorView({ row }: ErrorViewProps) {
  const lc = row.lifecycle;
  const info = lookupErrorCode(lc.error.code);
  return (
    <div className="dt-error-detail">
      <div className="dt-error-detail-header">
        <span className="dt-error-detail-badge">{info.reason}</span>
        <code className="dt-error-detail-code">{lc.error.code}</code>
      </div>
      <p className="dt-error-detail-description">{info.description}</p>
      <dl className="dt-error-detail-meta">
        <dt>Method</dt>
        <dd>{lc.method}</dd>
        <dt>URL</dt>
        <dd className="dt-error-detail-url">{lc.url}</dd>
        <dt>Type</dt>
        <dd>{lc.resourceType || '—'}</dd>
        <dt>Time</dt>
        <dd>{formatTime(lc.startedAtMs)}</dd>
      </dl>
    </div>
  );
}
