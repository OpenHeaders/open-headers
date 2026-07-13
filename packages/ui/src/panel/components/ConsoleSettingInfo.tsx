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
  const lit = new Set<TokenId>(HIGHLIGHT[setting]);
  const cls = (id: TokenId, extra = '') =>
    `dt-console-eg-tok${extra ? ` ${extra}` : ''}${lit.has(id) ? ' dt-console-eg-hl' : ''}`;
  return (
    <div className="dt-console-eg">
      <div className="dt-console-eg-cap">Example console</div>
      <div className="dt-console-eg-card">
        <div className="dt-console-eg-row">
          <span className="dt-console-eg-dot" />
          <span className={cls('prenavRow')}>boot complete</span>
        </div>
        <div className="dt-console-eg-row dt-console-eg-nav">
          <span className={cls('navDivider')}>Navigated to app.openheaders.io</span>
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
          <span className={cls('netErrRow')}>GET https://api.openheaders.io/coupons 404 (Not Found)</span>
        </div>
        <div className="dt-console-eg-row" data-tone="error">
          <span className="dt-console-eg-dot" data-tone="error" />
          <span className={cls('corsRow')}>Access to fetch at pay.openheaders.io blocked by CORS policy</span>
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

const CONSOLE_SETTING_INFO: Record<ConsoleSettingKey, InfoPopoverContent> = {
  hideNetwork: {
    title: 'Hide network',
    kicker: 'Console',
    summary:
      'Hides the browser’s own network log entries — failed and blocked requests — while the page’s console output always stays.',
    description:
      'Also hides the "finished loading" rows synthesized by Log XMLHttpRequests — they are network-source messages too.',
    diagram: <ExampleCard setting="hideNetwork" />,
  },
  logXhr: {
    title: 'Log XMLHttpRequests',
    kicker: 'Console',
    summary: 'Logs a row whenever an XHR, fetch, or EventSource request finishes or fails.',
    description:
      'Rows log at the Info level — failures too — and the URL links to the request’s row in the Network panel. Hide network hides these rows as well.',
    diagram: <ExampleCard setting="logXhr" />,
  },
  preserveLog: {
    title: 'Preserve log',
    kicker: 'Console',
    summary: 'Keeps the log across page navigations instead of clearing it.',
    description:
      'Off, a navigation — the page’s top context being recreated — cuts the view to the entries that arrive after it.',
    diagram: <ExampleCard setting="preserveLog" />,
  },
  eagerEval: {
    title: 'Eager evaluation',
    kicker: 'Console',
    summary: 'Previews the result of the expression you are typing on the grey line under the prompt.',
    description:
      'The preview evaluates side-effect-free: an expression that would change page state shows nothing instead of running, and nothing is written to the log until you press Enter.',
    diagram: <ExampleCard setting="eagerEval" />,
  },
  selectedContextOnly: {
    title: 'Selected context only',
    kicker: 'Console',
    summary: 'Only shows messages from the JavaScript context picked in the toolbar’s context selector.',
    description: 'Entries that carry no context — the browser’s own log entries — always stay visible.',
    diagram: <ExampleCard setting="selectedContextOnly" />,
  },
  autocompleteHistory: {
    title: 'Autocomplete from history',
    kicker: 'Console',
    summary:
      'Suggests the most recent command that extends what you typed, as a dimmed completion in the prompt.',
    description:
      'Tab — or → at the end of the input — accepts it; ↑/↓ still walk the history. The history lives for the current panel session.',
    diagram: <ExampleCard setting="autocompleteHistory" />,
  },
  groupSimilar: {
    title: 'Group similar messages',
    kicker: 'Console',
    summary: 'Collapses consecutive identical messages into one row with a count badge.',
    description: 'Typed commands and their results never group — the transcript stays literal.',
    diagram: <ExampleCard setting="groupSimilar" />,
  },
  evalUserGesture: {
    title: 'Treat code evaluation as user action',
    kicker: 'Console',
    summary: 'Runs prompt commands as if a user gesture triggered them.',
    description:
      'APIs gated on user activation — opening a window, writing to the clipboard, fullscreen — succeed from the prompt with this on.',
    diagram: <ExampleCard setting="evalUserGesture" />,
  },
  showCorsErrors: {
    title: 'Show CORS errors in console',
    kicker: 'Console',
    summary:
      'Shows the browser’s CORS explanations — "Access to fetch at … has been blocked by CORS policy: …" — alongside the page’s output.',
    description: 'Off hides only those explanation messages; the blocked request itself still shows in the Network panel.',
    diagram: <ExampleCard setting="showCorsErrors" />,
  },
};

export function ConsoleSettingInfo({ infoKey }: { infoKey: ConsoleSettingKey }) {
  return (
    <InfoTrigger
      content={CONSOLE_SETTING_INFO[infoKey]}
      className="dt-header-info-trigger dt-console-setting-info"
    />
  );
}
