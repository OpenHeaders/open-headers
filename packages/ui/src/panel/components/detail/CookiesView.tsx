/**
 * CookiesView — the Cookies section of the inspector. Composes the
 * filter toolbar, request / response cookie sections, insight cards,
 * and the rule-creation CTAs.
 *
 * Design principle: columns encode the raw facts; chips encode facts
 * NOT in any column (semantic role / lifecycle / cross-cell warnings);
 * insights surface actionable problems above the table. No data is
 * duplicated between the three layers.
 *
 * Section / row machinery lives in:
 *   - cookies/CookieSection      (per-direction table, filter, sort, optional grouping)
 *   - cookies/CookieRow          (single row + value expander)
 *   - cookies/SecurityGlyphs     (S/H/L 3-glyph cell replacing 3 columns)
 *   - cookies/CookieChips        (semantic + lifecycle chips only)
 *   - cookies/CookieMenus        (More filters / View dropdowns)
 *   - cookies/CookieInsightCard  (actionable callout above the lists)
 *   - cookies/CookieValueExpander (JWT / JSON / base64 / URL-decoded panel)
 *   - panel/data/cookies/cookie-enrich   (HAR × jar join + Set-Cookie parser)
 *   - panel/data/cookies/cookie-filter   (query grammar)
 *   - panel/data/cookies/cookie-insights (rule engine for warnings + dropped detection)
 *   - panel/data/cookies/cookie-role     (auth / tracking / pref classifier)
 *   - panel/data/value-introspect (JWT / JSON / base64 detector)
 *
 * Request cookie attributes that aren't in HAR — Domain, Path, Expires,
 * HttpOnly, Secure, SameSite, Partition — come from the browser jar
 * via the host-installed CookieJarFetcher seam.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { useT, type Translate } from '@openheaders/ui/context/LocaleContext';
import { App } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeasuredCssHeights } from '@openheaders/ui/shared/hooks/dom/useMeasuredStickyOffset';
import { useModifiedSettings, useResetSettings, useSetting } from '@openheaders/ui/workbench/settings/hooks';
import { deleteKeyForRow, emptyEditForm } from '../../data/cookies/cookie-edit';
import { enrichCookies } from '../../data/cookies/cookie-enrich';
import { hasCookieQueryError, parseCookieQuery, type CookieFilterToken } from '../../data/cookies/cookie-filter';
import { DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '../../data/text-match';
import { FilterInput } from '../FilterInput';
import { cookieHeaderRuleTouched } from '../../data/cookies/cookie-indicators';
import {
  getEditedCookieKeys,
  isCookieJarWritable,
  type JarCookieEdit,
  type JarCookieKey,
  removeJarCookie,
  writeJarCookie,
} from '../../data/cookies/cookie-jar-cache';
import {
  computeCookieInsights,
  droppedCookieNames,
  problemCookieNames,
  type CookieInsight,
  type CookieInsightAction,
} from '../../data/cookies/cookie-insights';
import type { CookieRow as CookieRowModel } from '../../data/cookies/cookie-model';
import { seedRequestCookieOverride, seedResponseCookieOverride } from '../../data/cookies/cookie-override-seed';
import { currentHarEntry, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { useCookieJar } from '../../data/cookies/use-cookie-jar';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { CookieCtaMenu } from './cookies/CookieCtaMenu';
import { CookieEditPopover } from './cookies/CookieEditPopover';
import { CookieInsightCard } from './cookies/CookieInsightCard';
import { COOKIE_VIEW_MENU_KEYS, CookieMoreFiltersMenu, CookieViewMenu } from './cookies/CookieMenus';
import { CookieSection } from './cookies/CookieSection';

export interface CookiesViewProps {
  row: InspectorRowWithFires;
  pageOrigin: string | null;
  /** Open the in-panel create popover pre-filled with a Cookie /
   *  Set-Cookie header rule, anchored to the clicked control. Override
   *  gestures seed `value` from the capture (`cookie-override-seed`);
   *  `''` is the explicit empty override ("don't send any cookies"). */
  onOverrideHeader: (
    direction: 'request' | 'response',
    headerName: string,
    value: string | undefined,
    anchorEl: HTMLElement,
  ) => void;
  /** Open a jar cookie as an editor-tab document (the edit popover's
   *  "Open in new tab" link). */
  onOpenCookieDocument?: (cookieKey: JarCookieKey, scopeUrl: string) => void;
}

// Empty HAR placeholder for lifecycles that haven't landed a HAR shell yet —
// the cookie enrichment helpers expect a defined shape with optional fields.
const EMPTY_HAR = { request: undefined, response: undefined } as unknown as InspectorHarEntry;

// (i) content for the two CTA worlds — the override menu creates RULES
// (virtual, rewrite matching requests in flight); Add cookie writes the
// BROWSER JAR (a real cookie, same store as the browser's own cookie UI).
function overrideCtaInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.cookies.ctaInfo.overrideTitle'),
    kicker: t('panel.inspector.cookies.ctaInfo.ruleKicker'),
    summary: t('panel.inspector.cookies.ctaInfo.overrideSummary'),
    sections: [
      {
        heading: t('panel.inspector.cookies.ctaInfo.choicesHeading'),
        items: [
          {
            label: t('panel.inspector.cookies.ctaInfo.requestLabel'),
            desc: t('panel.inspector.cookies.ctaInfo.requestDesc'),
          },
          {
            label: t('panel.inspector.cookies.ctaInfo.responseLabel'),
            desc: t('panel.inspector.cookies.ctaInfo.responseDesc'),
          },
          {
            label: t('panel.inspector.cookies.ctaInfo.noneLabel'),
            desc: t('panel.inspector.cookies.ctaInfo.noneDesc'),
          },
        ],
      },
    ],
  };
}

function addCookieInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('panel.inspector.cookies.ctaInfo.addTitle'),
    kicker: t('panel.inspector.cookies.ctaInfo.jarKicker'),
    summary: t('panel.inspector.cookies.ctaInfo.addSummary'),
    description: t('panel.inspector.cookies.ctaInfo.addDescription'),
  };
}

export default function CookiesView({ row, pageOrigin, onOverrideHeader, onOpenCookieDocument }: CookiesViewProps) {
  const t = useT();
  const lc = row.lifecycle;
  const har = currentHarEntry(lc) ?? EMPTY_HAR;

  // ── Settings ────────────────────────────────────────────────────
  const [filter, setFilter] = useState('');
  const [filterConfig, setFilterConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [sortMode, setSortMode] = useSetting('devpanelCookies.sortMode');
  const [expiresFormat, setExpiresFormat] = useSetting('devpanelCookies.expiresFormat');
  const [showInsights, setShowInsights] = useSetting('devpanelCookies.showInsights');
  const [showChips, setShowChips] = useSetting('devpanelCookies.showChips');
  const [showFilteredOut, setShowFilteredOut] = useSetting('devpanelCookies.showFilteredOut');
  const [decodeValues, setDecodeValues] = useSetting('devpanelCookies.decodeValues');
  const [groupByRole, setGroupByRole] = useSetting('devpanelCookies.groupByRole');
  const [problemsOnly, setProblemsOnly] = useSetting('devpanelCookies.problemsOnly');
  const [thirdPartyOnly, setThirdPartyOnly] = useSetting('devpanelCookies.thirdPartyOnly');
  const [ruleOnly, setRuleOnly] = useSetting('devpanelCookies.ruleOnly');

  const toggleProblemsOnly = useCallback(() => setProblemsOnly(!problemsOnly), [problemsOnly, setProblemsOnly]);
  const toggleThirdPartyOnly = useCallback(() => setThirdPartyOnly(!thirdPartyOnly), [thirdPartyOnly, setThirdPartyOnly]);
  const toggleRuleOnly = useCallback(() => setRuleOnly(!ruleOnly), [ruleOnly, setRuleOnly]);
  const toggleShowFilteredOut = useCallback(() => setShowFilteredOut(!showFilteredOut), [showFilteredOut, setShowFilteredOut]);
  const toggleDecodeValues = useCallback(() => setDecodeValues(!decodeValues), [decodeValues, setDecodeValues]);
  const toggleShowInsights = useCallback(() => setShowInsights(!showInsights), [showInsights, setShowInsights]);
  const toggleShowChips = useCallback(() => setShowChips(!showChips), [showChips, setShowChips]);
  const toggleGroupByRole = useCallback(() => setGroupByRole(!groupByRole), [groupByRole, setGroupByRole]);
  const viewMenuModified = useModifiedSettings(COOKIE_VIEW_MENU_KEYS);
  const resetViewMenu = useResetSettings(COOKIE_VIEW_MENU_KEYS);

  const overrideInfo = useMemo(() => overrideCtaInfo(t), [t]);
  const addInfo = useMemo(() => addCookieInfo(t), [t]);

  // ── Jar lookup ─────────────────────────────────────────────────
  const jar = useCookieJar(lc.url);

  // ── Cookie write handlers ──────────────────────────────────────
  const { modal, message } = App.useApp();
  const writable = isCookieJarWritable();

  const seedDomain = useMemo(() => {
    try {
      return new URL(lc.url).hostname;
    } catch {
      return '';
    }
  }, [lc.url]);
  const seedSecure = lc.url.startsWith('https:');

  const addCanonical = useMemo(
    () => emptyEditForm({ domain: seedDomain, secure: seedSecure }),
    [seedDomain, seedSecure],
  );

  const onApplyEdit = useCallback(
    async (edit: JarCookieEdit): Promise<boolean> => {
      const { cookie, error } = await writeJarCookie(edit);
      if (cookie) message.success(t('panel.inspector.cookies.toast.saved', { name: edit.name }));
      else
        message.error(
          error
            ? t('panel.inspector.cookies.toast.saveFailedWithError', { name: edit.name, error })
            : t('panel.inspector.cookies.toast.saveFailed', { name: edit.name }),
        );
      return cookie != null;
    },
    [message, t],
  );

  const onDeleteCookie = useCallback(
    (cookie: CookieRowModel) => {
      modal.confirm({
        title: t('panel.inspector.cookies.confirmDelete.title', { name: cookie.name }),
        content: t('panel.inspector.cookies.confirmDelete.content'),
        okText: t('panel.inspector.cookies.confirmDelete.ok'),
        okButtonProps: { danger: true },
        onOk: () =>
          removeJarCookie(deleteKeyForRow(cookie)).then((ok) => {
            if (ok) message.success(t('panel.inspector.cookies.toast.deleted', { name: cookie.name }));
            else message.error(t('panel.inspector.cookies.toast.deleteFailed', { name: cookie.name }));
          }),
      });
    },
    [modal, message, t],
  );

  // ── Enrichment ─────────────────────────────────────────────────
  // `jar` changes identity on every (re-)fetch — including the one a
  // panel cookie write triggers — so reading the live edited-keys set
  // here recomputes with the edit applied.
  const { request: requestRows, response: responseRows, requestBytes, responseBytes } = useMemo(
    () => enrichCookies({ url: lc.url, har, jar, showFilteredOut, editedKeys: getEditedCookieKeys() }),
    [lc.url, har, jar, showFilteredOut],
  );

  // ── Rule-interaction (blue square) — per direction, from this
  //    request's fires. The Cookie header is a bundle, so a fired
  //    Cookie / Set-Cookie rule marks every row in that direction. ──
  const requestRuleTouched = useMemo(() => cookieHeaderRuleTouched(row.fires, 'request'), [row.fires]);
  const responseRuleTouched = useMemo(() => cookieHeaderRuleTouched(row.fires, 'response'), [row.fires]);

  // ── Insights + derived problem / dropped sets ──────────────────
  const insights = useMemo<readonly CookieInsight[]>(
    () =>
      computeCookieInsights(t, {
        url: lc.url,
        request: requestRows,
        response: responseRows,
        pageOrigin,
      }),
    [t, lc.url, requestRows, responseRows, pageOrigin],
  );
  const problemNames = useMemo(() => problemCookieNames(insights), [insights]);
  const droppedNames = useMemo(() => droppedCookieNames(insights), [insights]);

  // ── Compiled filter ────────────────────────────────────────────
  const compiledQuery = useMemo<readonly CookieFilterToken[]>(() => {
    // The typed query parses under the match config (regex mode makes it
    // one pattern); the quick-toggle synthetic tokens parse separately so
    // they stay property tokens in every mode.
    const tokens = [...parseCookieQuery(filter, filterConfig)];
    const synthetic: string[] = [];
    if (problemsOnly) synthetic.push('is:problem');
    if (thirdPartyOnly) synthetic.push('is:third-party');
    if (ruleOnly) synthetic.push('is:rule');
    if (synthetic.length > 0) tokens.push(...parseCookieQuery(synthetic.join(' ')));
    return tokens;
  }, [filter, filterConfig, problemsOnly, thirdPartyOnly, ruleOnly]);
  const filterHasError = useMemo(() => hasCookieQueryError(compiledQuery), [compiledQuery]);

  // ── Footprint line ─────────────────────────────────────────────
  const sentCount = requestRows.filter((r) => r.attribution !== 'filtered-out').length;
  const setCount = responseRows.length;
  const filteredOutCount = requestRows.filter((r) => r.attribution === 'filtered-out').length;
  const droppedCount = droppedNames.size;
  const problemsCount = problemNames.size;
  const footprintBits: string[] = [];
  if (sentCount > 0) {
    footprintBits.push(t('panel.inspector.cookies.footprint.sent', { count: sentCount, bytes: requestBytes }));
  }
  if (setCount > 0) {
    footprintBits.push(t('panel.inspector.cookies.footprint.set', { count: setCount, bytes: responseBytes }));
  }
  if (droppedCount > 0) footprintBits.push(t('panel.inspector.cookies.footprint.dropped', { count: droppedCount }));
  if (filteredOutCount > 0) {
    footprintBits.push(t('panel.inspector.cookies.footprint.filteredOut', { count: filteredOutCount }));
  }
  if (problemsCount > 0) footprintBits.push(t('panel.inspector.cookies.footprint.flagged', { count: problemsCount }));
  const footprintText = footprintBits.join(' · ');

  // ── CTAs — all open the in-panel create popover anchored to the
  //    clicked control. Override gestures seed the value from the
  //    capture (real cookies, auth values as {{var}} references);
  //    `''` = explicit empty override (send no cookies). ──────────────
  const requestSeed = useMemo(() => seedRequestCookieOverride(requestRows, lc.url), [requestRows, lc.url]);
  const responseSeed = useMemo(() => seedResponseCookieOverride(responseRows, lc.url), [responseRows, lc.url]);
  const onCreateCookieOverride = (anchorEl: HTMLElement): void =>
    onOverrideHeader('request', 'Cookie', requestSeed, anchorEl);
  const onCreateSetCookieOverride = (anchorEl: HTMLElement): void =>
    onOverrideHeader('response', 'Set-Cookie', responseSeed, anchorEl);
  const onCreateRemoveAllCookies = (anchorEl: HTMLElement): void =>
    onOverrideHeader('request', 'Cookie', '', anchorEl);

  const handleInsightAction = (action: CookieInsightAction, anchorEl: HTMLElement): void => {
    if (action.kind === 'override-set-cookie') onOverrideHeader('response', 'Set-Cookie', responseSeed, anchorEl);
    else if (action.kind === 'remove-cookie') onOverrideHeader('request', 'Cookie', '', anchorEl);
    else if (action.kind === 'override-cookie-header') onOverrideHeader('request', 'Cookie', requestSeed, anchorEl);
  };

  const onMakeRule = (cookie: CookieRowModel, anchorEl: HTMLElement): void => {
    // Request direction seeds the whole Cookie bundle; a response row
    // seeds ITS OWN Set-Cookie line (one header per cookie).
    if (cookie.direction === 'request') onOverrideHeader('request', 'Cookie', requestSeed, anchorEl);
    else onOverrideHeader('response', 'Set-Cookie', seedResponseCookieOverride([cookie], lc.url), anchorEl);
  };

  const onOpenDocument = useCallback(
    (cookieKey: JarCookieKey) => onOpenCookieDocument?.(cookieKey, lc.url),
    [onOpenCookieDocument, lc.url],
  );

  // ── Measured sticky offsets ────────────────────────────────────
  const paneRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const firstSummaryRef = useRef<HTMLElement | null>(null);
  useMeasuredCssHeights(paneRef, [
    { ref: toolbarRef, cssVar: '--oh-cookies-toolbar-h' },
    { ref: firstSummaryRef, cssVar: '--oh-cookies-summary-h' },
  ]);

  const now = Date.now();
  const hasAny = requestRows.length > 0 || responseRows.length > 0;

  if (!hasAny) {
    return (
      <span className="dt-col-muted" style={{ padding: 12 }}>
        {t('panel.inspector.cookies.empty')}
      </span>
    );
  }

  return (
    <div className="dt-cookies-pane" ref={paneRef}>
      <div className="dt-header-filter" ref={toolbarRef}>
        <FilterInput
          value={filter}
          onChange={setFilter}
          config={filterConfig}
          onConfigChange={setFilterConfig}
          hasError={filterHasError}
          placeholder={t('panel.inspector.cookies.filterPlaceholder')}
          ariaLabel={t('panel.inspector.cookies.filterAria')}
        />
        <CookieCtaMenu
          onOverrideRequest={onCreateCookieOverride}
          onOverrideResponse={onCreateSetCookieOverride}
          onRemoveAll={onCreateRemoveAllCookies}
        />
        <InfoTrigger content={overrideInfo} className="dt-header-info-trigger" />
        {writable && (
          <>
            <CookieEditPopover mode="add" canonical={addCanonical} onSubmit={onApplyEdit}>
              <button type="button" className="dt-btn" title={t('panel.inspector.cookies.cta.addCookieTitle')}>
                {t('panel.inspector.cookies.cta.addCookie')}
              </button>
            </CookieEditPopover>
            <InfoTrigger content={addInfo} className="dt-header-info-trigger" />
          </>
        )}
        <CookieMoreFiltersMenu
          problemsOnly={problemsOnly}
          thirdPartyOnly={thirdPartyOnly}
          ruleOnly={ruleOnly}
          showFilteredOut={showFilteredOut}
          onToggleProblemsOnly={toggleProblemsOnly}
          onToggleThirdPartyOnly={toggleThirdPartyOnly}
          onToggleRuleOnly={toggleRuleOnly}
          onToggleShowFilteredOut={toggleShowFilteredOut}
        />
        <CookieViewMenu
          sortMode={sortMode}
          expiresFormat={expiresFormat}
          decodeValues={decodeValues}
          showInsights={showInsights}
          showChips={showChips}
          groupByRole={groupByRole}
          modified={viewMenuModified}
          onSortChange={setSortMode}
          onExpiresFormatChange={setExpiresFormat}
          onToggleDecodeValues={toggleDecodeValues}
          onToggleShowInsights={toggleShowInsights}
          onToggleShowChips={toggleShowChips}
          onToggleGroupByRole={toggleGroupByRole}
          onReset={resetViewMenu}
        />
      </div>

      {footprintText && (
        <div className="dt-header-footprint">
          <span className="dt-header-footprint-dot" aria-hidden="true" />
          <span className="dt-header-footprint-text">{footprintText}</span>
        </div>
      )}

      {showInsights && insights.length > 0 && (
        <div className="dt-header-insights">
          {insights.map((ins) => (
            <CookieInsightCard key={ins.id} insight={ins} onAction={handleInsightAction} />
          ))}
        </div>
      )}

      <CookieSection
        label={t('panel.inspector.cookies.section.response')}
        direction="response"
        rows={responseRows}
        problemNames={problemNames}
        droppedNames={droppedNames}
        pageOrigin={pageOrigin}
        compiledQuery={compiledQuery}
        sortMode={sortMode}
        expiresFormat={expiresFormat}
        decodeValues={decodeValues}
        showChips={showChips}
        groupByRole={groupByRole}
        now={now}
        summaryRef={firstSummaryRef}
        onMakeRule={onMakeRule}
        writable={writable}
        ruleTouched={responseRuleTouched}
        scopeUrl={lc.url}
        onOpenDocument={onOpenCookieDocument ? onOpenDocument : undefined}
        onApplyEdit={onApplyEdit}
        onDelete={onDeleteCookie}
      />

      <CookieSection
        label={t('panel.inspector.cookies.section.request')}
        direction="request"
        rows={requestRows}
        problemNames={problemNames}
        droppedNames={droppedNames}
        pageOrigin={pageOrigin}
        compiledQuery={compiledQuery}
        sortMode={sortMode}
        expiresFormat={expiresFormat}
        decodeValues={decodeValues}
        showChips={showChips}
        groupByRole={groupByRole}
        now={now}
        onMakeRule={onMakeRule}
        writable={writable}
        ruleTouched={requestRuleTouched}
        scopeUrl={lc.url}
        onOpenDocument={onOpenCookieDocument ? onOpenDocument : undefined}
        onApplyEdit={onApplyEdit}
        onDelete={onDeleteCookie}
      />
    </div>
  );
}
