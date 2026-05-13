import { useState } from 'react';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { HighlightedText } from './HighlightedText';
import TextBodyViewer from './TextBodyViewer';

type QsViewMode = 'parsed' | 'source' | 'url-encoded';

function buildSourceString(params: Array<{ name: string; value: string }>): string {
  return params.map((p) => `${p.name}=${p.value}`).join('&');
}

function buildUrlEncodedString(params: Array<{ name: string; value: string }>): string {
  return params.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`).join('&');
}

function QsToggle({ mode, onModeChange }: { mode: QsViewMode; onModeChange: (m: QsViewMode) => void }) {
  if (mode === 'parsed') {
    return (
      <span className="dt-payload-toggles">
        <button type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange('source')}>
          View source
        </button>
        <button type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange('url-encoded')}>
          View URL-encoded
        </button>
      </span>
    );
  }
  if (mode === 'source') {
    return (
      <span className="dt-payload-toggles">
        <button type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange('parsed')}>
          View parsed
        </button>
        <button type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange('url-encoded')}>
          View URL-encoded
        </button>
      </span>
    );
  }
  return (
    <span className="dt-payload-toggles">
      <button type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange('parsed')}>
        View parsed
      </button>
      <button type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange('source')}>
        View source
      </button>
    </span>
  );
}

interface PayloadViewProps {
  har: InspectorHarEntry;
  /** Query string the user just searched for. Highlighted in the
   *  matching section's body (Query Params or Request Body) so they
   *  can see where the match lives. */
  searchHighlight?: string;
  /** Section the search matched on (engine-side name: "Query Params"
   *  or "Request Body"). Used to scope highlighting to the right pane —
   *  without it, a search for "value" would light up both panes even
   *  though the match came from only one. */
  searchSection?: string;
}

export default function PayloadView({ har, searchHighlight, searchSection }: PayloadViewProps) {
  const queryString = har.request?.queryString ?? [];
  const postData = har.request?.postData;
  const [qsMode, setQsMode] = useState<QsViewMode>('parsed');

  const qsHighlight = searchSection === 'Query Params' ? searchHighlight : undefined;
  const bodyHighlight = searchSection === 'Request Body' ? searchHighlight : undefined;

  // Structured post data (form params) renders as a key/value table.
  // Unstructured post data (raw text body) routes through the unified
  // `TextBodyViewer` — same pipeline as the response body: Prettier +
  // Monaco viewer + theme + sniffer pill for misdeclared Content-Types.
  const hasStructuredPostData = postData?.params && postData.params.length > 0;

  return (
    <div className="dt-payload-view">
      {queryString.length > 0 && (
        <details className="dt-section" open>
          <summary>
            Query String Parameters
            <QsToggle mode={qsMode} onModeChange={setQsMode} />
          </summary>
          {qsMode === 'parsed' ? (
            <div className="dt-payload-table">
              {queryString.map((q, i) => (
                <div key={`q-${i}-${q.name}`} className="dt-payload-row">
                  <span className="dt-payload-key">
                    <HighlightedText text={decodeURIComponent(q.name)} query={qsHighlight} />
                  </span>
                  <span className="dt-payload-val">
                    <HighlightedText text={decodeURIComponent(q.value)} query={qsHighlight} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="dt-body-pre" style={{ margin: '4px 12px' }}>
              <HighlightedText
                text={qsMode === 'source' ? buildSourceString(queryString) : buildUrlEncodedString(queryString)}
                query={qsHighlight}
              />
            </pre>
          )}
        </details>
      )}

      {postData && (
        <details className="dt-section" open>
          <summary>Request Body ({postData.mimeType})</summary>
          {hasStructuredPostData ? (
            <div className="dt-payload-table">
              {postData.params?.map((p, i) => (
                <div key={`p-${i}-${p.name}`} className="dt-payload-row">
                  <span className="dt-payload-key">
                    <HighlightedText text={p.name} query={bodyHighlight} />
                  </span>
                  <span className="dt-payload-val">
                    <HighlightedText text={p.value ?? ''} query={bodyHighlight} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dt-payload-body-wrap">
              <TextBodyViewer
                text={postData.text ?? ''}
                declaredMime={postData.mimeType ?? ''}
                searchQuery={bodyHighlight}
              />
            </div>
          )}
        </details>
      )}
    </div>
  );
}
