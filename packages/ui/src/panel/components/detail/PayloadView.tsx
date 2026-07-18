import { lazy, Suspense, useMemo, useState } from 'react';
import type { RequestOverride } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, Rule } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRulePopover } from '../RulePopoverHost';
import { type DualMode, DualModeButtons, SwapSidesButton } from './DualViewControls';
import { HighlightedText } from './HighlightedText';
import { overrideLabels } from './override-labels';
import OverrideBodyButton from './OverrideBodyButton';
import Skeleton from './Skeleton';
import SplitBodyView from './SplitBodyView';
import TextBodyViewer from './TextBodyViewer';

// Lazy: keeps Monaco's diff bundle out of the panel's initial chunk —
// it only loads when a two-sided override is actually inspected.
const DiffBodyView = lazy(() => import('./DiffBodyView'));

type QsViewMode = 'parsed' | 'source' | 'url-encoded';

function buildSourceString(params: Array<{ name: string; value: string }>): string {
  return params.map((p) => `${p.name}=${p.value}`).join('&');
}

function buildUrlEncodedString(params: Array<{ name: string; value: string }>): string {
  return params.map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`).join('&');
}

function QsToggle({ mode, onModeChange }: { mode: QsViewMode; onModeChange: (m: QsViewMode) => void }) {
  const t = useT();
  // The two modes the current one can switch to — each button offers the
  // view it is not currently showing.
  const allModes: Array<{ target: QsViewMode; label: string }> = [
    { target: 'parsed', label: t('panel.inspector.payload.viewParsed') },
    { target: 'source', label: t('panel.inspector.payload.viewSource') },
    { target: 'url-encoded', label: t('panel.inspector.payload.viewUrlEncoded') },
  ];
  const others = allModes.filter((o) => o.target !== mode);
  return (
    <span className="dt-payload-toggles">
      {others.map((o) => (
        <button key={o.target} type="button" className="dt-payload-toggle-btn" onClick={() => onModeChange(o.target)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

interface RequestBodyDualViewProps {
  /** The page's body as composed, before the rule rewrote it. */
  originalText: string;
  /** The body that actually went to the server. */
  sentText: string;
  declaredMime: string;
  searchQuery?: string;
  dualMode: DualMode;
  onDualModeChange: (mode: DualMode) => void;
  swapped: boolean;
  onSwapSides: () => void;
  /** Override CTAs for the bottom toolbar — ride the modified pane in the
   *  split (the original pane is read-only) and the diff's single bar. */
  overrideAction?: React.ReactNode;
}

/**
 * Two-sided request-body view (a request-body rule fired) — the same
 * anatomy as the Response tab's dual view: Monaco diff by default
 * (original-left convention), a "Full request" split leading with the
 * modified body, and the swap-sides control on the caption row.
 */
function RequestBodyDualView({
  originalText,
  sentText,
  declaredMime,
  searchQuery,
  dualMode,
  onDualModeChange,
  swapped,
  onSwapSides,
  overrideAction,
}: RequestBodyDualViewProps) {
  const t = useT();
  const labels = useMemo(() => overrideLabels(t), [t]);
  const modeButtons = (
    <DualModeButtons
      mode={dualMode}
      onModeChange={onDualModeChange}
      splitModeLabel={t('panel.inspector.dualView.fullRequest')}
    />
  );

  if (dualMode === 'diff') {
    const sides = swapped
      ? {
          original: sentText,
          modified: originalText,
          originalLabel: labels.requestModified,
          modifiedLabel: labels.requestOriginal,
        }
      : {
          original: originalText,
          modified: sentText,
          originalLabel: labels.requestOriginal,
          modifiedLabel: labels.requestModified,
        };
    return (
      <div className="dt-payload-body-wrap">
        <div className="dt-body-dual">
          <Suspense fallback={<Skeleton />}>
            <DiffBodyView
              original={sides.original}
              modified={sides.modified}
              originalLabel={sides.originalLabel}
              modifiedLabel={sides.modifiedLabel}
              declaredMime={declaredMime}
              controls={modeButtons}
              onSwapSides={onSwapSides}
              overrideAction={overrideAction}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  const modifiedPane = (rightmost: boolean) => (
    <TextBodyViewer
      text={sentText}
      declaredMime={declaredMime}
      searchQuery={searchQuery}
      toolbarAction={overrideAction}
      toolbarTrailing={rightmost ? modeButtons : undefined}
    />
  );
  const originalPane = (rightmost: boolean) => (
    <TextBodyViewer
      text={originalText}
      declaredMime={declaredMime}
      toolbarTrailing={rightmost ? modeButtons : undefined}
    />
  );
  const headerAction = <SwapSidesButton onSwap={onSwapSides} />;

  return (
    <div className="dt-payload-body-wrap">
      {swapped ? (
        <SplitBodyView
          startLabel={labels.requestOriginal}
          start={originalPane(false)}
          endLabel={labels.requestModified}
          end={modifiedPane(true)}
          headerAction={headerAction}
        />
      ) : (
        <SplitBodyView
          startLabel={labels.requestModified}
          start={modifiedPane(false)}
          endLabel={labels.requestOriginal}
          end={originalPane(true)}
          headerAction={headerAction}
        />
      )}
    </div>
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
  const t = useT();
  const rulePopover = useRulePopover();
  const queryString = har.request?.queryString ?? [];
  const postData = har.request?.postData;
  const [qsMode, setQsMode] = useState<QsViewMode>('parsed');
  const [dualMode, setDualMode] = useState<DualMode>('diff');
  const [swapped, setSwapped] = useState(false);
  // Both override CTAs are rule scaffolds, not mirrors of the captured
  // data (same as the Headers tab's always-present Redirect/Delay/Cancel):
  // a request can take a query string or body it doesn't currently carry,
  // so we offer both whenever the handlers are wired and let the editor
  // open empty when there's nothing to pre-fill. When a rule of that type
  // already fired here, the CTA edits THAT rule in place instead of
  // scaffolding a second one over it — same dispatch as the Response tab.
  const queryOverrideAction = firedQueryParamRule ? (
    <OverrideBodyButton
      label={t('panel.inspector.overrideCta.editQueryParams')}
      title={t('panel.inspector.overrideCta.editQueryParamsTitle')}
      onClick={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule: firedQueryParamRule }, { pinned: true })}
    />
  ) : onOverrideQueryParams ? (
    <OverrideBodyButton
      label={t('panel.inspector.overrideCta.overrideQueryParams')}
      title={t('panel.inspector.overrideCta.overrideQueryParamsTitle')}
      onClick={(e) => onOverrideQueryParams(e.currentTarget)}
    />
  ) : undefined;
  const bodyOverrideAction = firedRequestBodyRule ? (
    <OverrideBodyButton
      label={t('panel.inspector.overrideCta.editRequestBody')}
      title={t('panel.inspector.overrideCta.editRequestBodyTitle')}
      onClick={(e) => rulePopover.open({ anchorEl: e.currentTarget, rule: firedRequestBodyRule }, { pinned: true })}
    />
  ) : onOverrideRequestBody ? (
    <OverrideBodyButton
      label={t('panel.inspector.overrideCta.overrideRequestBody')}
      title={t('panel.inspector.overrideCta.overrideRequestBodyTitle')}
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

  // Both CTAs ride the body viewer's bottom toolbar (after the cursor
  // readout, behind its divider — same slot as the Response tab's
  // Override CTA). The pinned footer only remains for layouts without
  // that toolbar: the structured form-param table and the no-body case.
  const toolbarCtas =
    queryOverrideAction || bodyOverrideAction ? (
      <>
        {queryOverrideAction}
        {bodyOverrideAction}
      </>
    ) : undefined;
  const bodyHostsToolbarCtas = postData != null && !hasStructuredPostData;

  return (
    <div className="dt-payload-view">
      <div className="dt-payload-sections">
        {queryString.length > 0 && (
          <details className="dt-section" open>
            <summary>
              {t('panel.inspector.payload.queryStringParameters')}
              <QsToggle mode={qsMode} onModeChange={setQsMode} />
            </summary>
            {qsMode === 'parsed' ? (
              <div className="dt-payload-table">
                {/* HAR queryString entries arrive DECODED (URLSearchParams
                    in the correlators' har synth) — a second decode here
                    corrupts values whose decoded text still looks encoded
                    and throws on a bare `%`. */}
                {queryString.map((q, i) => (
                  <div key={`q-${i}-${q.name}`} className="dt-payload-row">
                    <span className="dt-payload-key">
                      <HighlightedText text={q.name} query={qsHighlight} />
                    </span>
                    <span className="dt-payload-val">
                      <HighlightedText text={q.value} query={qsHighlight} />
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
            <summary>{t('panel.inspector.payload.requestBody', { mime: postData.mimeType ?? '' })}</summary>
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
              // A request-body rule fired: the page's original body against
              // what actually went to the server — same dual view as the
              // Response tab (diff by default, Full request split, swap-sides
              // in the corner).
              <RequestBodyDualView
                originalText={requestOverride.original.body.content}
                sentText={requestOverride.sent.body?.content ?? postData.text ?? ''}
                declaredMime={postData.mimeType ?? ''}
                searchQuery={bodyHighlight}
                dualMode={dualMode}
                onDualModeChange={setDualMode}
                swapped={swapped}
                onSwapSides={() => setSwapped((s) => !s)}
                overrideAction={toolbarCtas}
              />
            ) : (
              <div className="dt-payload-body-wrap">
                <TextBodyViewer
                  text={postData.text ?? ''}
                  declaredMime={postData.mimeType ?? ''}
                  searchQuery={bodyHighlight}
                  toolbarAction={toolbarCtas}
                />
              </div>
            )}
          </details>
        )}
      </div>

      {/* Pinned bottom footer — fallback host for the CTAs when no body
        * viewer toolbar is on screen to carry them. */}
      {toolbarCtas && !bodyHostsToolbarCtas && (
        <div className="dt-response-toolbar dt-payload-footer">{toolbarCtas}</div>
      )}
    </div>
  );
}
