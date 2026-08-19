/**
 * Per-setting `(i)` info-popover content for the Console settings pane.
 * Same pattern as the network table's `NetworkColumnInfo` — a
 * hover-revealed glyph that opens an `<InfoPopover>`.
 *
 * Every popover leads with the same canonical example transcript rendered
 * as a compact card; the setting's own slice of that transcript is the
 * highlighted token, so reading across all nine popovers builds one
 * coherent picture of a single console session seen setting by setting.
 */

import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { type InfoPopoverContent, InfoTrigger } from '@openheaders/ui/shared/info-popover';

export type ConsoleSettingKey =
  | 'hideNetwork'
  | 'logXhr'
  | 'preserveLog'
  | 'eagerEval'
  | 'selectedContextOnly'
  | 'autocompleteHistory'
  | 'groupSimilar'
  | 'evalUserGesture'
  | 'showCorsErrors';

type TokenId =
  | 'prenavRow'
  | 'navDivider'
  | 'repeatRow'
  | 'repeatPill'
  | 'frameRow'
  | 'netErrRow'
  | 'corsRow'
  | 'xhrRow'
  | 'promptCmd'
  | 'ghost'
  | 'preview';

/** Which token(s) of the example each setting lights up. Hide network
 * covers the browser's network entries AND the synthesized XHR rows;
 * Preserve log lights the navigation seam plus the row that survives it. */
const HIGHLIGHT: Record<ConsoleSettingKey, readonly TokenId[]> = {
  hideNetwork: ['netErrRow', 'xhrRow'],
  logXhr: ['xhrRow'],
  preserveLog: ['prenavRow', 'navDivider'],
  eagerEval: ['preview'],
  selectedContextOnly: ['frameRow'],
  autocompleteHistory: ['ghost'],
  groupSimilar: ['repeatPill'],
  evalUserGesture: ['promptCmd'],
  showCorsErrors: ['corsRow'],
};

function ExampleCard({ setting }: { setting: ConsoleSettingKey }) {
  const t = useT();
  const lit = new Set<TokenId>(HIGHLIGHT[setting]);
  const cls = (id: TokenId, extra = '') =>
    `dt-console-eg-tok${extra ? ` ${extra}` : ''}${lit.has(id) ? ' dt-console-eg-hl' : ''}`;
  return (
    <div className="dt-console-eg">
      <div className="dt-console-eg-cap">{t('panel.console.info.exampleCaption')}</div>
      <div className="dt-console-eg-card">
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-dot" />
          <span className={cls('prenavRow')}>boot complete</span>
        </div>
        <div className="dt-console-eg-row dt-console-eg-nav">
          <span className={cls('navDivider')}>Navigated to app.openheaders.com</span>
        </div>
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-dot" />
          <span className={cls('repeatPill', 'dt-console-eg-pill')}>3</span>
          <span className={cls('repeatRow')}>cart updated</span>
        </div>
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-dot" />
          <span className={cls('frameRow')}>checkout frame ready</span>
        </div>
        <div className="dt-console-eg-row" data-tone="error">
          <span className="dt-console-eg-dot" data-tone="error" />
          <span className={cls('netErrRow')}>GET https://api.openheaders.com/coupons 404 (Not Found)</span>
        </div>
        <div className="dt-console-eg-row" data-tone="error">
          <span className="dt-console-eg-dot" data-tone="error" />
          <span className={cls('corsRow')}>Access to fetch at pay.openheaders.com blocked by CORS policy</span>
        </div>
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-dot" data-tone="info" />
          <span className={cls('xhrRow')}>Fetch finished loading: GET "/v1/cart".</span>
        </div>
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-glyph">›</span>
          <span className="dt-console-eg-prompt">
            <span className={cls('promptCmd')}>cart.items.len</span>
            <span className={cls('ghost', 'dt-console-eg-ghost')}>gth</span>
          </span>
        </div>
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-glyph dt-console-eg-glyph--result">‹</span>
          <span className={cls('preview', 'dt-console-eg-ghost')}>3</span>
        </div>
      </div>
    </div>
  );
}

/** Popover titles reuse the settings-pane label keys (they name their
 *  control); groupSimilar's popover title differs from its checkbox label
 *  and keeps its own key. */
function consoleSettingInfo(t: Translate, infoKey: ConsoleSettingKey): InfoPopoverContent {
  const kicker = t('panel.toolWindows.console');
  const diagram = <ExampleCard setting={infoKey} />;
  switch (infoKey) {
    case 'hideNetwork':
      return {
        title: t('panel.console.setting.hideNetwork'),
        kicker,
        summary: t('panel.console.info.hideNetwork.summary'),
        description: t('panel.console.info.hideNetwork.description'),
        diagram,
      };
    case 'logXhr':
      return {
        title: t('panel.console.setting.logXhr'),
        kicker,
        summary: t('panel.console.info.logXhr.summary'),
        description: t('panel.console.info.logXhr.description'),
        diagram,
      };
    case 'preserveLog':
      return {
        title: t('panel.console.setting.preserveLog'),
        kicker,
        summary: t('panel.console.info.preserveLog.summary'),
        description: t('panel.console.info.preserveLog.description'),
        diagram,
      };
    case 'eagerEval':
      return {
        title: t('panel.console.setting.eagerEval'),
        kicker,
        summary: t('panel.console.info.eagerEval.summary'),
        description: t('panel.console.info.eagerEval.description'),
        diagram,
      };
    case 'selectedContextOnly':
      return {
        title: t('panel.console.setting.selectedContextOnly'),
        kicker,
        summary: t('panel.console.info.selectedContextOnly.summary'),
        description: t('panel.console.info.selectedContextOnly.description'),
        diagram,
      };
    case 'autocompleteHistory':
      return {
        title: t('panel.console.setting.autocompleteHistory'),
        kicker,
        summary: t('panel.console.info.autocompleteHistory.summary'),
        description: t('panel.console.info.autocompleteHistory.description'),
        diagram,
      };
    case 'groupSimilar':
      return {
        title: t('panel.console.info.groupSimilar.title'),
        kicker,
        summary: t('panel.console.info.groupSimilar.summary'),
        description: t('panel.console.info.groupSimilar.description'),
        diagram,
      };
    case 'evalUserGesture':
      return {
        title: t('panel.console.setting.evalUserGesture'),
        kicker,
        summary: t('panel.console.info.evalUserGesture.summary'),
        description: t('panel.console.info.evalUserGesture.description'),
        diagram,
      };
    case 'showCorsErrors':
      return {
        title: t('panel.console.setting.showCorsErrors'),
        kicker,
        summary: t('panel.console.info.showCorsErrors.summary'),
        description: t('panel.console.info.showCorsErrors.description'),
        diagram,
      };
  }
}

export function ConsoleSettingInfo({ infoKey }: { infoKey: ConsoleSettingKey }) {
  const t = useT();
  return (
    <InfoTrigger
      content={consoleSettingInfo(t, infoKey)}
      className="dt-header-info-trigger dt-console-setting-info"
    />
  );
}
