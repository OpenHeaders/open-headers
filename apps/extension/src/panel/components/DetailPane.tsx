import { useEffect, useRef, useState } from 'react';
import { buildHeaderDraftFromRequest, handOffRuleDraft } from '../data/rule-draft-bridge';
import type { InspectorRequest } from '../data/types';
import { JsonTree } from './JsonTree';
import { ResponseBodyView } from './ResponseBodyView';

interface DetailPaneProps {
  entry: InspectorRequest | null;
  onClose: () => void;
  initialTab?: 'headers' | 'payload' | 'response' | 'initiator' | 'timing' | 'har';
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
  searchNonce?: number;
}

type Tab = 'headers' | 'payload' | 'response' | 'initiator' | 'timing' | 'har';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'headers', label: 'Headers' },
  { key: 'payload', label: 'Payload' },
  { key: 'response', label: 'Response' },
  { key: 'initiator', label: 'Initiator' },
  { key: 'timing', label: 'Timing' },
  { key: 'har', label: 'HAR' },
];

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

export function DetailPane({
  entry,
  onClose,
  initialTab,
  searchHighlight,
  searchSection,
  searchLineNumber,
  searchNonce,
}: DetailPaneProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'headers');
  const [error, setError] = useState<string | null>(null);
  const tabBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (searchNonce == null || !tabBodyRef.current) return;
    requestAnimationFrame(() => {
      const el = tabBodyRef.current?.querySelector('.dt-kv--highlighted') ?? tabBodyRef.current?.querySelector('mark');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, [searchNonce]);

  if (!entry) {
    return <div className="dt-empty">Select a request to inspect</div>;
  }

  const har = entry.harEntry;
  const requestHeaders = har.request?.headers ?? [];
  const responseHeaders = har.response?.headers ?? [];
  const queryString = har.request?.queryString ?? [];
  const postData = har.request?.postData;

  const createHeaderRule = async (
    direction: 'request' | 'response',
    headerName: string,
    value?: string,
  ): Promise<void> => {
    try {
      setError(null);
      const draft = buildHeaderDraftFromRequest(entry, { direction, headerName, value });
      await handOffRuleDraft(draft);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const statusOk = entry.statusCode != null && entry.statusCode < 400;

  return (
    <div className="dt-detail-pane">
      <div className="dt-tabs" role="tablist">
        <button type="button" className="dt-tab-close" onClick={onClose} title="Close">
          {'\u00d7'}
        </button>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className="dt-tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="dt-body-info" style={{ margin: '4px 8px', color: 'var(--dt-status-red)' }}>
          {error}
        </div>
      )}

      <div className="dt-tab-body" ref={tabBodyRef}>
        {tab === 'headers' && (
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
                  {entry.url}
                </span>
              </div>
              <div className="dt-kv">
                <span className="dt-kv-key">Request Method:</span>
                <span className="dt-kv-val">{entry.method}</span>
              </div>
              {entry.statusCode != null && (
                <div className="dt-kv">
                  <span className="dt-kv-key">Status Code:</span>
                  <span className={`dt-kv-val ${statusOk ? 'dt-kv-val--status-ok' : 'dt-kv-val--status-err'}`}>
                    {entry.statusCode} {entry.statusText ?? ''}
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

            {entry.fires.length > 0 && (
              <details className="dt-section" open>
                <summary>Open Headers Rule Fires ({entry.fires.length})</summary>
                {entry.fires.map((f, i) => (
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

        {tab === 'payload' && (
          <>
            <details className="dt-section" open>
              <summary>Query Parameters</summary>
              {queryString.length > 0 ? (
                queryString.map((q, i) => (
                  <div key={`q-${i}-${q.name}`} className="dt-kv" style={{ fontFamily: 'monospace' }}>
                    <span className="dt-kv-key" style={{ fontWeight: 600 }}>
                      {q.name}:
                    </span>
                    <span className="dt-kv-val">{q.value}</span>
                  </div>
                ))
              ) : (
                <div className="dt-kv dt-col-muted">No query parameters.</div>
              )}
            </details>
            {postData && (
              <details className="dt-section" open>
                <summary>Request Body ({postData.mimeType})</summary>
                <pre className="dt-body-pre" style={{ marginLeft: 12 }}>
                  {postData.text ?? ''}
                </pre>
              </details>
            )}
          </>
        )}

        {tab === 'response' && (
          <>
            <div className="dt-cta-row">
              <PlaceholderButton label="Modify API response" />
            </div>
            <ResponseBodyView
              request={entry}
              searchHighlight={searchSection === 'Response' ? searchHighlight : undefined}
              searchLineNumber={searchSection === 'Response' ? searchLineNumber : undefined}
            />
          </>
        )}

        {tab === 'initiator' && (
          <div className="dt-panel-mono" style={{ fontSize: 12, lineHeight: 1.6 }}>
            {har._initiator ? (
              <JsonTree value={har._initiator} defaultExpandedDepth={3} />
            ) : (
              <span className="dt-col-muted">No initiator data available.</span>
            )}
          </div>
        )}

        {tab === 'timing' && (
          <>
            {har.timings ? (
              <details className="dt-section" open>
                <summary>Timing Breakdown</summary>
                {Object.entries(har.timings).map(([key, val]) => (
                  <div key={key} className="dt-kv">
                    <span className="dt-kv-key" style={{ minWidth: 80 }}>
                      {key}:
                    </span>
                    <span className="dt-kv-val">
                      {typeof val === 'number' && val >= 0 ? `${val.toFixed(2)} ms` : '\u2014'}
                    </span>
                  </div>
                ))}
              </details>
            ) : (
              <span className="dt-col-muted">No timing data available.</span>
            )}
            {har.time != null && (
              <div className="dt-kv" style={{ marginTop: 4, fontWeight: 600 }}>
                <span className="dt-kv-key">Total:</span>
                <span className="dt-kv-val">{har.time.toFixed(2)} ms</span>
              </div>
            )}
          </>
        )}

        {tab === 'har' && (
          <div className="dt-panel-mono" style={{ fontSize: 12, lineHeight: 1.6 }}>
            <JsonTree value={har} defaultExpandedDepth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
