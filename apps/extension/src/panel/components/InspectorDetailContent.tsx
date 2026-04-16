/**
 * InspectorDetailContent — detail view rendered inside an editor tab.
 * Adapted from DetailPane but without the close button (tab bar owns
 * close) and with section state driven by InspectorTab.activeSection.
 */

import { useEffect, useRef, useState } from 'react';
import type { DetailSection } from '../data/inspector-tab';
import { buildHeaderDraftFromRequest, handOffRuleDraft } from '../data/rule-draft-bridge';
import type { InspectorRequest } from '../data/types';
import CookiesView from './detail/CookiesView';
import InitiatorView from './detail/InitiatorView';
import PayloadView from './detail/PayloadView';
import PreviewView from './detail/PreviewView';
import TimingView from './detail/TimingView';
import { JsonTree } from './JsonTree';
import { ResponseBodyView } from './ResponseBodyView';

interface InspectorDetailContentProps {
  request: InspectorRequest;
  activeSection: DetailSection;
  onSectionChange: (section: DetailSection) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
}

const PAYLOAD_SECTION: { key: DetailSection; label: string } = { key: 'payload', label: 'Payload' };
const COOKIES_SECTION: { key: DetailSection; label: string } = { key: 'cookies', label: 'Cookies' };
const HAR_SECTION: { key: DetailSection; label: string } = { key: 'har', label: 'HAR' };

function hasPayload(har: InspectorDetailContentProps['request']['harEntry']): boolean {
  if (har.request?.queryString && har.request.queryString.length > 0) return true;
  return !!har.request?.postData?.text;
}

function hasCookies(har: InspectorDetailContentProps['request']['harEntry']): boolean {
  if (har.request?.cookies && har.request.cookies.length > 0) return true;
  return (har.response?.headers ?? []).some((h) => h.name.toLowerCase() === 'set-cookie');
}

function PlaceholderButton({ label }: { label: string }) {
  return (
    <button type="button" className="dt-btn dt-btn-primary" disabled title="Coming soon">
      {label}
    </button>
  );
}

function isHighlightedHeader(
  index: number,
  section: string,
  searchSection: string | undefined,
  searchLineNumber: number | undefined,
  highlight: string | undefined,
  headerText: string,
): boolean {
  if (!highlight || !searchSection || searchLineNumber == null) return false;
  if (searchSection !== section) return false;
  if (index + 1 !== searchLineNumber) return false;
  return headerText.toLowerCase().includes(highlight.toLowerCase());
}

export function InspectorDetailContent({
  request,
  activeSection,
  onSectionChange,
  searchHighlight,
  searchSection,
  searchLineNumber,
}: InspectorDetailContentProps) {
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to highlighted element when search navigates here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: searchLineNumber triggers re-scroll when clicking different results for the same query
  useEffect(() => {
    if (!searchHighlight || !rootRef.current) return;
    requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector('.dt-kv--highlighted') ?? rootRef.current?.querySelector('mark');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [searchHighlight, searchLineNumber]);

  const har = request.harEntry;
  const requestHeaders = har.request?.headers ?? [];
  const responseHeaders = har.response?.headers ?? [];

  const createHeaderRule = async (
    direction: 'request' | 'response',
    headerName: string,
    value?: string,
  ): Promise<void> => {
    try {
      setError(null);
      const draft = buildHeaderDraftFromRequest(request, { direction, headerName, value });
      await handOffRuleDraft(draft);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const statusOk = request.statusCode != null && request.statusCode < 400;
  const section = activeSection;
  const sections: Array<{ key: DetailSection; label: string }> = [
    { key: 'headers', label: 'Headers' },
    ...(hasPayload(har) ? [PAYLOAD_SECTION] : []),
    { key: 'preview', label: 'Preview' },
    { key: 'response', label: 'Response' },
    { key: 'initiator', label: 'Initiator' },
    { key: 'timing', label: 'Timing' },
    ...(hasCookies(har) ? [COOKIES_SECTION] : []),
    HAR_SECTION,
  ];

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="dt-detail-sections" role="tablist">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            className="dt-detail-section-tab"
            aria-selected={section === s.key}
            onClick={() => onSectionChange(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="dt-body-info" style={{ margin: '4px 8px', color: 'var(--dt-status-red)' }}>
          {error}
        </div>
      )}

      <div
        className="dt-tab-body"
        ref={tabBodyRef}
        style={section === 'preview' || section === 'response' ? { display: 'none' } : undefined}
      >
        {section === 'headers' && (
          <>
            <div className="dt-cta-row" style={{ padding: '4px 0' }}>
              <PlaceholderButton label="Redirect URL" />
              <PlaceholderButton label="Replace host" />
              <PlaceholderButton label="Replace URL part" />
              <PlaceholderButton label="Delay request" />
              <PlaceholderButton label="Cancel request" />
            </div>

            <details className="dt-section" open>
              <summary>General</summary>
              <div className="dt-kv">
                <span className="dt-kv-key">Request URL:</span>
                <span className="dt-kv-val" style={{ wordBreak: 'break-all' }}>
                  {request.url}
                </span>
              </div>
              <div className="dt-kv">
                <span className="dt-kv-key">Request Method:</span>
                <span className="dt-kv-val">{request.method}</span>
              </div>
              {request.statusCode != null && (
                <div className="dt-kv">
                  <span className="dt-kv-key">Status Code:</span>
                  <span className={`dt-kv-val ${statusOk ? 'dt-kv-val--status-ok' : 'dt-kv-val--status-err'}`}>
                    {request.statusCode} {request.statusText ?? ''}
                  </span>
                </div>
              )}
              {har.serverIPAddress && (
                <div className="dt-kv">
                  <span className="dt-kv-key">Remote Address:</span>
                  <span className="dt-kv-val">{har.serverIPAddress}</span>
                </div>
              )}
              {(() => {
                const referrerPolicy = responseHeaders.find((h) => h.name.toLowerCase() === 'referrer-policy')?.value;
                if (!referrerPolicy) return null;
                return (
                  <div className="dt-kv">
                    <span className="dt-kv-key">Referrer Policy:</span>
                    <span className="dt-kv-val">{referrerPolicy}</span>
                  </div>
                );
              })()}
            </details>

            {request.fires.length > 0 && (
              <details className="dt-section" open>
                <summary>Open Headers Rule Fires ({request.fires.length})</summary>
                {request.fires.map((f, i) => (
                  <div key={`fire-${i}-${f.ruleUid}`} className="dt-kv" style={{ fontFamily: 'monospace' }}>
                    <span
                      className={`dt-exec-badge ${f.authoritative ? 'dt-exec-badge--auth' : 'dt-exec-badge--inferred'}`}
                    >
                      {f.authoritative ? 'authoritative' : 'inferred'}
                    </span>
                    <code>{f.ruleUid}</code>
                    {f.pattern && <span className="dt-col-muted"> &mdash; {f.pattern}</span>}
                  </div>
                ))}
              </details>
            )}

            <details className="dt-section" open>
              <summary>
                Response Headers
                <button
                  type="button"
                  className="dt-btn-primary dt-btn"
                  style={{ marginLeft: 8, fontSize: 10, height: 16, padding: '0 4px' }}
                  onClick={() => createHeaderRule('response', '', '')}
                >
                  + Add Header
                </button>
              </summary>
              {responseHeaders.length > 0 ? (
                responseHeaders.map((h, i) => (
                  <div
                    key={`res-${i}-${h.name}`}
                    className={`dt-kv ${isHighlightedHeader(i, 'Response Headers', searchSection, searchLineNumber, searchHighlight, `${h.name}: ${h.value}`) ? 'dt-kv--highlighted' : ''}`}
                    style={{ fontFamily: 'monospace' }}
                  >
                    <button
                      type="button"
                      className="dt-btn-link"
                      style={{ fontFamily: 'monospace', fontWeight: 600 }}
                      onClick={() => createHeaderRule('response', h.name, h.value)}
                      title="Create a rule to override this header"
                    >
                      {h.name}
                    </button>
                    <span>: {h.value}</span>
                  </div>
                ))
              ) : (
                <div className="dt-kv dt-col-muted">None captured.</div>
              )}
            </details>

            <details className="dt-section" open>
              <summary>
                Request Headers
                <button
                  type="button"
                  className="dt-btn-primary dt-btn"
                  style={{ marginLeft: 8, fontSize: 10, height: 16, padding: '0 4px' }}
                  onClick={() => createHeaderRule('request', '', '')}
                >
                  + Add Header
                </button>
              </summary>
              {requestHeaders.length > 0 ? (
                requestHeaders.map((h, i) => (
                  <div
                    key={`req-${i}-${h.name}`}
                    className={`dt-kv ${isHighlightedHeader(i, 'Request Headers', searchSection, searchLineNumber, searchHighlight, `${h.name}: ${h.value}`) ? 'dt-kv--highlighted' : ''}`}
                    style={{ fontFamily: 'monospace' }}
                  >
                    <button
                      type="button"
                      className="dt-btn-link"
                      style={{ fontFamily: 'monospace', fontWeight: 600 }}
                      onClick={() => createHeaderRule('request', h.name, h.value)}
                      title="Create a rule to override this header"
                    >
                      {h.name}
                    </button>
                    <span>: {h.value}</span>
                  </div>
                ))
              ) : (
                <div className="dt-kv dt-col-muted">None captured.</div>
              )}
            </details>
          </>
        )}

        {section === 'payload' && <PayloadView har={har} />}

        {section === 'initiator' && <InitiatorView har={har} requestUrl={request.url} />}

        {section === 'timing' && <TimingView har={har} />}

        {section === 'cookies' && <CookiesView har={har} />}

        {section === 'har' && (
          <div className="dt-panel-mono" style={{ fontSize: 12, lineHeight: 1.6 }}>
            <JsonTree value={har} defaultExpandedDepth={2} />
          </div>
        )}
      </div>

      {section === 'preview' && <PreviewView request={request} />}

      {section === 'response' && (
        <ResponseBodyView
          request={request}
          searchHighlight={searchSection === 'Response' ? searchHighlight : undefined}
          searchLineNumber={searchSection === 'Response' ? searchLineNumber : undefined}
        />
      )}
    </div>
  );
}
