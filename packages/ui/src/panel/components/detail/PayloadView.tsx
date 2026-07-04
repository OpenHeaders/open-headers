import { useState } from 'react';
import type { RequestOverride } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, Rule } from '@openheaders/core/types';
import { useRulePopover } from '../RulePopoverHost';
import { HighlightedText } from './HighlightedText';
import OverrideBodyButton from './OverrideBodyButton';
import SplitBodyView from './SplitBodyView';
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
  /** Open the request-body create popover pre-filled from the capture,
   *  anchored to the CTA button. */
  onOverrideRequestBody?: (anchorEl: HTMLElement) => void;
  /** Open the query-param create popover pre-filled from the capture,
   *  anchored to the CTA button. */
  onOverrideQueryParams?: (anchorEl: HTMLElement) => void;
  /** Live request-body rule that fired on this request — flips the CTA
   *  from create ("Override request body") to edit (quick-edit popover
   *  targeting this rule). Same flip as the Response tab. */
  firedRequestBodyRule?: Rule | null;
  /** Live query-param rule that fired on this request — same flip for
   *  the query-params CTA. */
  firedQueryParamRule?: Rule | null;
  /** Two-sided request-body capture (a request-body rule fired): the page's
   *  original body beside what actually went on the wire. Splits the Request
   *  Body section when present. */
  requestOverride?: RequestOverride;
}

export default function PayloadView({
  har,
  searchHighlight,
  searchSection,
  onOverrideRequestBody,
  onOverrideQueryParams,
  firedRequestBodyRule,
  firedQueryParamRule,
  requestOverride,
}: PayloadViewProps) {
  const rulePopover = useRulePopover();
  const queryString = har.request?.queryString ?? [];
  const postData = har.request?.postData;
  const [qsMode, setQsMode] = useState<QsViewMode>('parsed');
  // Both override CTAs are rule scaffolds, not mirrors of the captured
  // data (same as the Headers tab's always-present Redirect/Delay/Cancel):
  // a request can take a query string or body it doesn't currently carry,
  // so we offer both whenever the handlers are wired and let the editor
  // open empty when there's nothing to pre-fill. When a rule of that type
  // already fired here, the CTA edits THAT rule in place instead of
  // scaffolding a second one over it — same dispatch as the Response tab.
  const queryOverrideAction = firedQueryParamRule ? (
    <OverrideBodyButton
      label="Edit query params override"
      title="Edit the rule that rewrote these query parameters — changes apply to future requests"
      onClick={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule: firedQueryParamRule }, { pinned: true })}
    />
  ) : onOverrideQueryParams ? (
    <OverrideBodyButton
      label="Override query params"
      title="Create a rule that rewrites these query parameters"
      onClick={(e) => onOverrideQueryParams(e.currentTarget)}
    />
  ) : undefined;
  const bodyOverrideAction = firedRequestBodyRule ? (
    <OverrideBodyButton
      label="Edit request body override"
      title="Edit the rule that replaced this request body — changes apply to future requests"
      onClick={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule: firedRequestBodyRule }, { pinned: true })}
    />
  ) : onOverrideRequestBody ? (
    <OverrideBodyButton
      label="Override request body"
      title="Create a rule that replaces this request body with an editable static body"
      onClick={(e) => onOverrideRequestBody(e.currentTarget)}
    />
  ) : undefined;

  const qsHighlight = searchSection === 'Query Params' ? searchHighlight : undefined;
  const bodyHighlight = searchSection === 'Request Body' ? searchHighlight : undefined;

  // Structured post data (form params) renders as a key/value table.
  // Unstructured post data (raw text body) routes through the unified
  // `TextBodyViewer` — same pipeline as the response body: Prettier +
  // Monaco viewer + theme + sniffer pill for misdeclared Content-Types.
  const hasStructuredPostData = postData?.params && postData.params.length > 0;

  return (
    <div className="dt-payload-view">
      <div className="dt-payload-sections">
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
          // The raw-text body fills the remaining pane height so Monaco owns
          // the scroll; the structured form-param table stays natural-flow.
          <details className={hasStructuredPostData ? 'dt-section' : 'dt-section dt-payload-body-section'} open>
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
            ) : requestOverride?.original?.body ? (
              // A request-body rule fired: the page's original body beside what
              // actually went to the server.
              <div className="dt-payload-body-wrap">
                <SplitBodyView
                  startLabel="Original · page"
                  start={
                    <TextBodyViewer
                      text={requestOverride.original.body.content}
                      declaredMime={postData.mimeType ?? ''}
                    />
                  }
                  endLabel="Sent · server"
                  end={
                    <TextBodyViewer
                      text={requestOverride.sent.body?.content ?? postData.text ?? ''}
                      declaredMime={postData.mimeType ?? ''}
                      searchQuery={bodyHighlight}
                    />
                  }
                />
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

      {/* Pinned bottom footer — one per-section override CTA, left-aligned,
        * so the Payload tab reads like the Response/Preview tabs. */}
      {(queryOverrideAction || bodyOverrideAction) && (
        <div className="dt-response-toolbar dt-payload-footer">
          {queryOverrideAction}
          {bodyOverrideAction}
        </div>
      )}
    </div>
  );
}
