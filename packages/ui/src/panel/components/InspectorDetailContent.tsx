/**
 * InspectorDetailContent — detail view rendered inside an editor tab.
 * Adapted from DetailPane but without the close button (tab bar owns
 * close) and with section state driven by InspectorTab.activeSection.
 */

import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import type { HeaderModification, HeaderOperation, Rule } from '@openheaders/core/types';
import { validateHeaderName } from '@openheaders/core/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type AnnotatedHeader,
  attributeHeaders,
  findCurrentMod,
  isAttributionEdited,
} from '../data/header-attribution';
import { formatHttpVersion } from '../data/http-version';
import type { DetailSection } from '../data/inspector-tab';
import { computeRuleApplicability, type RuleApplicability } from '../data/rule-applicability';
import { findRuleCollectionId } from '../data/rule-collection';
import { buildHeaderDraftFromRequest, handOffRuleDraft } from '../data/rule-draft-bridge';
import type { InspectorRequest } from '../data/types';
import type { RulesByUid } from '../data/use-rules-lookup';
import CookiesView from './detail/CookiesView';
import EventStreamView, { isEventStream } from './detail/EventStreamView';
import InitiatorView from './detail/InitiatorView';
import MessagesView, { hasWebSocketMessages } from './detail/MessagesView';
import PayloadView from './detail/PayloadView';
import PreviewView from './detail/PreviewView';
import TimingView from './detail/TimingView';
import { JsonTree } from './JsonTree';
import { ResolvedHeaderValue } from './ResolvedHeaderValue';
import { ResponseBodyView } from './ResponseBodyView';
import { useRulePopover } from './RulePopoverHost';

interface InspectorDetailContentProps {
  request: InspectorRequest;
  /** Rule registry used to attribute request/response header rows to
   *  the Open Headers rule that added, modified, or removed them. */
  rulesByUid: RulesByUid;
  /** Resolves the immediate downstream-initiator children of a request
   *  URL — i.e. siblings whose `_initiator` attributes them to this URL.
   *  Backed by the store's inverted initiator index so this leaf view
   *  never walks the full entries array itself. */
  getInitiatorChildren: (url: string) => readonly InspectorRequest[];
  /** Connection-reuse lookup for the Timing tab — App composes this
   *  over the entries array so the leaf view stays decoupled. */
  getConnectionReuse: (request: InspectorRequest) => import('../data/connection-reuse').ConnectionReuseInfo;
  /** Repeat-URL stats lookup for the Timing tab. Null when the URL is
   *  unique in this session (no comparison set). */
  getRepeatStats: (request: InspectorRequest) => import('../data/timing-repeats').RepeatStats | null;
  /** Session baseline (ms) — typically the timestamp of the first
   *  observed entry, used to render "Started +X ms" on the Timing tab. */
  baselineMs: number | null;
  /** Inspected-window origin — passed into InitiatorView for third-party
   *  classification in cascade chips and insights. */
  pageOrigin: string | null;
  /** Open a request as a new editor tab. Used by InitiatorView so the
   *  cascade tree doubles as a navigation surface. */
  onOpenRequest?: (entryId: string) => void;
  /** URL → entry lookup used by InitiatorView's upstream-chain walk.
   *  App owns the closure over `entries` so this leaf view stays
   *  decoupled from the global list. */
  getRequestByUrl: (url: string) => InspectorRequest | null;
  /** True while the "Disable Cache" toolbar toggle is on for the
   *  inspected tab. Tags `Cache-Control: no-cache` / `Pragma: no-cache`
   *  request headers as system-injected (yellow) instead of server. */
  cacheBypassEnabled: boolean;
  /** The `rulesEngine.liveRulesMode` setting. When on and any user
   *  header rule fired on this request without touching Cache-Control,
   *  the request carries automatic cache-bypass headers — attribute
   *  them as `system/live-rules` (yellow) rather than server. */
  liveRulesMode: boolean;
  activeSection: DetailSection;
  onSectionChange: (section: DetailSection) => void;
  searchHighlight?: string;
  searchSection?: string;
  searchLineNumber?: number;
  /** N-th occurrence of `searchHighlight` inside `searchSection`
   *  (0-based). Lets the viewer scroll to this exact match rather
   *  than the first. */
  searchMatchIndex?: number;
}

const PAYLOAD_SECTION: { key: DetailSection; label: string } = { key: 'payload', label: 'Payload' };
const COOKIES_SECTION: { key: DetailSection; label: string } = { key: 'cookies', label: 'Cookies' };
const MESSAGES_SECTION: { key: DetailSection; label: string } = { key: 'messages', label: 'Messages' };
const EVENTSTREAM_SECTION: { key: DetailSection; label: string } = { key: 'eventstream', label: 'EventStream' };
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

/**
 * Single attributed header row. Styling derives from the attribution:
 *
 *   - `server`   — default monospace row, no decoration.
 *   - `added`    — blue left border + `+` glyph; "injected by <rule>"
 *                  tooltip; click the name to jump to the rule (same
 *                  affordance as `server` rows' "create a rule" jump,
 *                  repurposed as "open the rule that injected this").
 *   - `modified` — blue left border + `~` glyph; tooltip shows the
 *                  original server value; value shown is the one the
 *                  page actually sees.
 *   - `removed`  — muted text + strikethrough on the value; tooltip
 *                  explains that Open Headers removed it before it
 *                  reached the page.
 *
 * The server-origin rows keep the existing "click name → open Create
 * Rule prefilled" affordance. Rule-originated rows keep the same look
 * for the name button but point at the rule that applied the change.
 */
interface AttributedHeaderRowProps {
  row: AnnotatedHeader;
  /** Row index in the rendered list — only used to correlate with
   *  the search/highlight machinery. */
  index: number;
  sectionLabel: 'Request Headers' | 'Response Headers';
  searchSection: string | undefined;
  searchLineNumber: number | undefined;
  searchHighlight: string | undefined;
  /** Owning collection of the attributing rule, looked up by the parent.
   *  Used when resolving `{{collection.X}}` tokens inside the row's value
   *  and when the rule popover hands the same context to its TemplateInput. */
  ruleCollectionId?: string;
  /** URL of the request whose row this is. Threaded down so the
   *  popover can run the applicability matcher (does the live rule
   *  still match this URL?) without going through global state. */
  requestUrl: string;
  /** Reactive registry — looked up by `attribution.ctx.ruleUid` so
   *  the row reads the LIVE rule on every render. Attribution itself
   *  is historical-only; live state must be derived from this map.
   *  See `header-attribution.ts` for the architectural rule. */
  rulesByUid: RulesByUid;
  onNameClick: (name: string, value: string) => void;
}

function AttributedHeaderRow({
  row,
  index,
  sectionLabel,
  searchSection,
  searchLineNumber,
  searchHighlight,
  ruleCollectionId,
  requestUrl,
  rulesByUid,
  onNameClick,
}: AttributedHeaderRowProps) {
  const rulePopover = useRulePopover();
  const { name, value, attribution } = row;
  const kind = attribution.kind;

  // Chrome / Firefox / Edge reject DNR rules that target protected
  // headers (`sec-ch-ua`, `host`, `content-length`, etc.) at apply
  // time. We silently skip the "click to override" CTA for these —
  // no lock icon, no special tooltip, no visual weirdness — the row
  // just looks like a normal header that happens to not be a link.
  const direction: 'request' | 'response' = sectionLabel === 'Response Headers' ? 'response' : 'request';
  const isProtected = !validateHeaderName(name, direction === 'response').valid;

  const classes = [
    'dt-kv',
    isHighlightedHeader(index, sectionLabel, searchSection, searchLineNumber, searchHighlight, `${name}: ${value}`)
      ? 'dt-kv--highlighted'
      : '',
    kind === 'server' ? '' : `dt-kv--oh-${kind}`,
  ]
    .filter(Boolean)
    .join(' ');

  // Rule-attributed rows hover-trigger the popover. The popover (not a
  // native title tooltip) is the affordance — it shows the snapshot of
  // what the rule did on this request and lets the user edit the rule
  // for FUTURE requests. The native title would just lie about what's
  // current vs historical. Server rows still get a one-line title CTA
  // on the name button.
  const ruleCtx = kind === 'added' || kind === 'modified' || kind === 'removed' ? attribution.ctx : null;
  // Live rule + live mod — derived reactively from the rule registry on
  // every render. The attribution context is historical-only; "what
  // does the rule look like NOW" must always come from `rulesByUid`.
  const liveRule: Rule | null = ruleCtx ? (rulesByUid.get(ruleCtx.ruleUid) ?? null) : null;
  const currentMod: HeaderModification | null = ruleCtx ? findCurrentMod(liveRule, ruleCtx) : null;
  const ruleEdited = ruleCtx ? isAttributionEdited(liveRule, ruleCtx) : false;
  const ruleForHover: Rule | null = liveRule;
  const operationForHover: HeaderOperation | undefined =
    kind === 'added' || kind === 'modified' ? attribution.operation : kind === 'removed' ? 'remove' : undefined;

  // Re-resolve the live mod's template against the current resolver
  // and compare with the snapshot's frozen resolved value. Catches the
  // class of drift the structural diff misses — when the rule wasn't
  // edited but a `{{var}}` it references has been (env value flipped,
  // workspace var renamed, etc.). Either signal yields the chip.
  const resolver = useVariableResolver();
  const currentResolvedValue = useMemo(() => {
    if (!currentMod) return null;
    if (currentMod.operation === 'remove') return null;
    const tpl = currentMod.value;
    if (typeof tpl !== 'string') return null;
    return resolver.resolveTemplate(tpl, ruleCollectionId ? { collectionId: ruleCollectionId } : undefined).result;
  }, [resolver, currentMod, ruleCollectionId]);
  const currentResolvedName = useMemo(() => {
    if (!currentMod) return null;
    return resolver.resolveTemplate(
      currentMod.headerName,
      ruleCollectionId ? { collectionId: ruleCollectionId } : undefined,
    ).result;
  }, [resolver, currentMod, ruleCollectionId]);
  const applicability = useMemo<RuleApplicability | null>(() => {
    if (!ruleCtx) return null;
    return computeRuleApplicability({
      liveRule,
      ctx: ruleCtx,
      url: requestUrl,
      resolver,
      collectionId: ruleCollectionId,
    });
  }, [liveRule, ruleCtx, requestUrl, resolver, ruleCollectionId]);
  // Drift detection is only meaningful when the snapshot's resolved
  // value is a reliable baseline. Two cases where it isn't:
  //   - The template contains `{{vault.TOTP_*}}` — TOTP codes never
  //     bake into compiled DNR rules (`reject` mode in the SW), so the
  //     snapshot keeps the literal `{{vault.TOTP_*}}`. The renderer
  //     resolver uses `defer` mode and returns an empty string. Modes
  //     differ, so a naive compare always shows drift.
  //   - The template references a var that didn't resolve at fire
  //     time (broken ref, env not selected, etc.).
  // Both surface as `valueResolved === valueTemplate` AND the template
  // contains `{{`. Skip the drift signal in those cases — the chip
  // would be a false alarm and the popover's "Now resolves to" line
  // would mislead.
  const snapshotResolutionReliable =
    ruleCtx?.snapshotMod.valueTemplate === undefined ||
    !ruleCtx.snapshotMod.valueTemplate.includes('{{') ||
    ruleCtx.snapshotMod.valueTemplate !== ruleCtx.snapshotMod.valueResolved;
  const valueDrifted =
    !!ruleCtx &&
    !ruleEdited &&
    snapshotResolutionReliable &&
    currentResolvedValue != null &&
    ruleCtx.snapshotMod.valueResolved != null &&
    ruleCtx.snapshotMod.valueResolved !== currentResolvedValue;
  // Header-name drift: same shape — rule template unchanged, but a var
  // referenced by the *name* resolves differently now. Same reliability
  // gate as value drift: skip when the snapshot's name still contains
  // `{{` (resolution failed at fire time — TOTP in name, broken ref —
  // so we have no reliable baseline). Without this guard, a TOTP-in-
  // name template would always show as drifted because the SW kept
  // the literal `{{}}` while the renderer's defer mode resolves to ''.
  const snapshotNameReliable = !ruleCtx?.snapshotMod.headerName.includes('{{');
  const nameDrifted =
    !!ruleCtx &&
    !ruleEdited &&
    snapshotNameReliable &&
    currentResolvedName != null &&
    currentResolvedName !== ruleCtx.snapshotMod.headerName;
  const editedSinceFire = (ruleEdited ?? false) || valueDrifted || nameDrifted;

  const handleRowMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ruleCtx) return;
    rulePopover.open({
      anchorEl: e.currentTarget,
      attribution,
      rule: ruleForHover,
      target: operationForHover ? { direction, headerName: name, operation: operationForHover } : undefined,
      currentResolvedValue,
      currentResolvedName,
      applicability,
    });
  };
  const handleRowMouseOut = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ruleCtx) return;
    rulePopover.scheduleClose(e.relatedTarget);
  };

  // Rule-injected / -modified rows display the resolved value (so users
  // see what hit the wire, not the literal `{{env.foo}}`). The resolved
  // chunks are display-only — variable editing happens inside the rule
  // popover's TemplateInput. Server / removed rows show the raw value.
  const showResolvedValue = kind === 'added' || kind === 'modified' || kind === 'system';

  const serverTitle = kind === 'server' ? 'Create a rule to override this header' : undefined;
  const systemTitle = kind === 'system' ? `Injected by ${attribution.label} (Open Headers system feature)` : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-only popover trigger; primary affordance is the rule's full editor reachable via the popover.
    // biome-ignore lint/a11y/useKeyWithMouseEvents: hover-anchored popover; keyboard users use "Open in workspace" inside the popover.
    <div
      className={classes}
      style={{ fontFamily: 'monospace' }}
      onMouseOver={ruleCtx ? handleRowMouseOver : undefined}
      onMouseOut={ruleCtx ? handleRowMouseOut : undefined}
    >
      {isProtected ? (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{name}</span>
      ) : (
        <button
          type="button"
          className="dt-btn-link"
          style={{ fontFamily: 'monospace', fontWeight: 600 }}
          onClick={() => onNameClick(name, value)}
          title={serverTitle ?? systemTitle}
        >
          {name}
        </button>
      )}
      <span className="dt-kv-oh-value">
        : {showResolvedValue ? <ResolvedHeaderValue value={value} collectionId={ruleCollectionId} /> : value}
      </span>
      {editedSinceFire && <EditedSinceFireChip kind={ruleEdited ? 'rule' : 'value'} />}
    </div>
  );
}

/**
 * Inline chip that flags a row whose snapshot — what hit the wire on
 * this past request — no longer matches what the rule would do now.
 * Two reasons: the rule itself was edited (`kind='rule'`), or a
 * variable referenced by the rule's template resolves to something
 * different now (`kind='value'`). Hovering the row surfaces the
 * popover with the full diff.
 */
function EditedSinceFireChip({ kind }: { kind: 'rule' | 'value' }) {
  const label = kind === 'rule' ? '· rule edited since' : '· variable changed since';
  const title =
    kind === 'rule'
      ? 'Rule has been edited since this request — current rule applies only to future requests'
      : 'A variable referenced by this rule resolves to a different value now — applies only to future requests';
  return (
    <span
      title={title}
      style={{
        marginLeft: 8,
        fontSize: 10,
        fontStyle: 'italic',
        opacity: 0.7,
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
}

export function InspectorDetailContent({
  request,
  rulesByUid,
  getInitiatorChildren,
  getConnectionReuse,
  getRepeatStats,
  baselineMs,
  pageOrigin,
  onOpenRequest,
  getRequestByUrl,
  cacheBypassEnabled,
  liveRulesMode,
  activeSection,
  onSectionChange,
  searchHighlight,
  searchSection,
  searchLineNumber,
  searchMatchIndex,
}: InspectorDetailContentProps) {
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBodyRef = useRef<HTMLDivElement>(null);
  const { localCollections } = useRules();
  // Cached `rule.uid → collectionId` for any rule referenced by an
  // attributed row. Avoids re-walking `localCollections` on every row.
  const ruleCollectionByUid = useMemo<Map<string, string | undefined>>(() => {
    const m = new Map<string, string | undefined>();
    for (const rule of rulesByUid.values()) {
      m.set(rule.uid, findRuleCollectionId(rule, localCollections));
    }
    return m;
  }, [rulesByUid, localCollections]);
  const collectionIdFor = (h: AnnotatedHeader): string | undefined => {
    const a = h.attribution;
    if (a.kind === 'added' || a.kind === 'modified' || a.kind === 'removed') {
      return ruleCollectionByUid.get(a.ctx.ruleUid);
    }
    return undefined;
  };

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
  // Live Rules Mode system-attribution gate: yellow the cache-bypass
  // request headers when a user header rule fired and didn't itself
  // touch Cache-Control. Mirrors the DNR-side gate in header-builder.
  const liveRulesFired = useMemo<boolean>(() => {
    if (!liveRulesMode) return false;
    const seen = new Set<string>();
    for (const fire of request.fires) {
      if (seen.has(fire.ruleUid)) continue;
      seen.add(fire.ruleUid);
      const rule = rulesByUid.get(fire.ruleUid);
      if (!rule || rule.type !== 'header') continue;
      const mods = [...(rule.action.requestHeaders ?? []), ...(rule.action.responseHeaders ?? [])];
      if (mods.length === 0) continue;
      const userTouchesCacheControl = (rule.action.requestHeaders ?? []).some(
        (m) => m.headerName.toLowerCase() === 'cache-control',
      );
      if (!userTouchesCacheControl) return true;
    }
    return false;
  }, [liveRulesMode, request.fires, rulesByUid]);

  // Attribute each header row to a rule (or `server` for untouched
  // rows). `attributeHeaders` merges rule-added rows that aren't in
  // the HAR at all, so these lists may be longer than the raw HAR
  // `headers` arrays. Recompute only when inputs change.
  const requestHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(har.request?.headers ?? [], request.fires, 'request', rulesByUid, {
        cacheBypassEnabled,
        liveRulesFired,
      }),
    [har.request?.headers, request.fires, rulesByUid, cacheBypassEnabled, liveRulesFired],
  );
  const responseHeaders = useMemo<readonly AnnotatedHeader[]>(
    () =>
      attributeHeaders(har.response?.headers ?? [], request.fires, 'response', rulesByUid, {
        cacheBypassEnabled,
        liveRulesFired,
      }),
    [har.response?.headers, request.fires, rulesByUid, cacheBypassEnabled, liveRulesFired],
  );

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
  const showMessages = hasWebSocketMessages(har);
  const showEventStream = isEventStream(request.mimeType);
  const sections: Array<{ key: DetailSection; label: string }> = [
    { key: 'headers', label: 'Headers' },
    ...(showMessages ? [MESSAGES_SECTION] : []),
    ...(showEventStream ? [EVENTSTREAM_SECTION] : []),
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
                const httpVersion = har.response?.httpVersion ?? har.request?.httpVersion;
                if (!httpVersion) return null;
                const friendly = formatHttpVersion(httpVersion);
                const showRawHint = friendly !== httpVersion.toUpperCase();
                return (
                  <div className="dt-kv">
                    <span className="dt-kv-key">HTTP Version:</span>
                    <span className="dt-kv-val" title={showRawHint ? `ALPN: ${httpVersion}` : undefined}>
                      {friendly}
                    </span>
                  </div>
                );
              })()}
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

            {/* Rule fires for this request live in the dedicated
             *  "Matched Rules" tool window (bottom-right dock).
             *  Keeping them out of the Headers tab avoids duplicating
             *  information with the inline per-header attribution
             *  badges below (modified / injected / removed). */}

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
                  <AttributedHeaderRow
                    key={`res-${i}-${h.name}`}
                    row={h}
                    index={i}
                    sectionLabel="Response Headers"
                    searchSection={searchSection}
                    searchLineNumber={searchLineNumber}
                    searchHighlight={searchHighlight}
                    ruleCollectionId={collectionIdFor(h)}
                    requestUrl={request.url}
                    rulesByUid={rulesByUid}
                    onNameClick={(name, value) => createHeaderRule('response', name, value)}
                  />
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
                  <AttributedHeaderRow
                    key={`req-${i}-${h.name}`}
                    row={h}
                    index={i}
                    sectionLabel="Request Headers"
                    searchSection={searchSection}
                    searchLineNumber={searchLineNumber}
                    searchHighlight={searchHighlight}
                    ruleCollectionId={collectionIdFor(h)}
                    requestUrl={request.url}
                    rulesByUid={rulesByUid}
                    onNameClick={(name, value) => createHeaderRule('request', name, value)}
                  />
                ))
              ) : (
                <div className="dt-kv dt-col-muted">None captured.</div>
              )}
            </details>
          </>
        )}

        {section === 'payload' && (
          <PayloadView har={har} searchHighlight={searchHighlight} searchSection={searchSection} />
        )}

        {section === 'messages' && showMessages && <MessagesView har={har} />}

        {section === 'eventstream' && showEventStream && <EventStreamView request={request} />}

        {section === 'initiator' && (
          <InitiatorView
            request={request}
            getInitiatorChildren={getInitiatorChildren}
            getRequestByUrl={getRequestByUrl}
            pageOrigin={pageOrigin}
            onOpenRequest={onOpenRequest}
          />
        )}

        {section === 'timing' && (
          <TimingView
            request={request}
            connectionReuse={getConnectionReuse(request)}
            repeatStats={getRepeatStats(request)}
            baselineMs={baselineMs}
          />
        )}

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
          searchMatchIndex={searchSection === 'Response' ? searchMatchIndex : undefined}
        />
      )}
    </div>
  );
}
