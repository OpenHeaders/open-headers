/**
 * Detail pane for rows that came from `chrome.webRequest.onErrorOccurred`
 * — a blocked / canceled / failed request that the host's HAR pipeline
 * never finished. There's no response, no headers, no cookies, no
 * timing breakdown to render, so we replace the usual tab set with a
 * single "Error" pane explaining what happened and why.
 */

import { lookupErrorCode } from '../../data/chromium-error-codes';
import type { InspectorRequest } from '../../data/types';

interface ErrorViewProps {
  request: InspectorRequest & { error: NonNullable<InspectorRequest['error']> };
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

export function ErrorView({ request }: ErrorViewProps) {
  const info = lookupErrorCode(request.error.code);
  return (
    <div className="dt-error-detail">
      <div className="dt-error-detail-header">
        <span className="dt-error-detail-badge">{info.reason}</span>
        <code className="dt-error-detail-code">{request.error.code}</code>
      </div>
      <p className="dt-error-detail-description">{info.description}</p>
      <dl className="dt-error-detail-meta">
        <dt>Method</dt>
        <dd>{request.method}</dd>
        <dt>URL</dt>
        <dd className="dt-error-detail-url">{request.url}</dd>
        <dt>Type</dt>
        <dd>{request.resourceType ?? '—'}</dd>
        <dt>Time</dt>
        <dd>{formatTime(request.timestamp)}</dd>
      </dl>
    </div>
  );
}
