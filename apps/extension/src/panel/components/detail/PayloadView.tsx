import { useState } from 'react';
import type { InspectorHarEntry } from '@/background/modules/devtools-inspector-port';

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
}

export default function PayloadView({ har }: PayloadViewProps) {
  const queryString = har.request?.queryString ?? [];
  const postData = har.request?.postData;
  const [qsMode, setQsMode] = useState<QsViewMode>('parsed');

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
                  <span className="dt-payload-key">{decodeURIComponent(q.name)}</span>
                  <span className="dt-payload-val">{decodeURIComponent(q.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="dt-body-pre" style={{ margin: '4px 12px' }}>
              {qsMode === 'source' ? buildSourceString(queryString) : buildUrlEncodedString(queryString)}
            </pre>
          )}
        </details>
      )}

      {postData && (
        <details className="dt-section" open>
          <summary>Request Body ({postData.mimeType})</summary>
          {postData.params && postData.params.length > 0 ? (
            <div className="dt-payload-table">
              {postData.params.map((p, i) => (
                <div key={`p-${i}-${p.name}`} className="dt-payload-row">
                  <span className="dt-payload-key">{p.name}</span>
                  <span className="dt-payload-val">{p.value ?? ''}</span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="dt-body-pre" style={{ margin: '4px 12px' }}>
              {postData.text ?? ''}
            </pre>
          )}
        </details>
      )}
    </div>
  );
}
