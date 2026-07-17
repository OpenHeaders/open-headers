/**
 * DevTools panel — console tool window: transcript chrome, prompt,
 * context selector, level menu, and the console settings pane with
 * its `(i)` corpora. Virtualized transcript rows read a memoized
 * label object — never `t()` per row (plan §4 hot path).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelConsole = {
  // ── Console tool window (station: console family) ───────────────────
  // Raw by design: level wire names (debug/log/…), the › ‹ chevrons and
  // ⚙ prefix, context labels (top / frame names / script URLs), source
  // locations (file:line, "(generated: …)"), "(anonymous)", the browser's
  // synthesized network phrasing ("Fetch finished loading:", "Failed to
  // load resource:"), and the example-transcript rows in the (i) corpora.
  'panel.console.clear': 'Clear console',
  'panel.console.collapseAll': 'Collapse all',
  'panel.console.expandAll': 'Expand all',
  'panel.console.filterAria': 'Filter console messages',
  'panel.console.levelTitle': 'Log level: {label}',
  'panel.console.settings': 'Console settings',
  'panel.console.settingsPaneAria': 'Console settings',
  'panel.console.contextTitle': 'JavaScript context — where console commands evaluate',

  // Level-filter menu (the browser's "Default levels ▾" ladder)
  'panel.console.levels.verbose': 'Verbose',
  'panel.console.levels.info': 'Info',
  'panel.console.levels.warnings': 'Warnings',
  'panel.console.levels.errors': 'Errors',
  'panel.console.levels.all': 'All levels',
  'panel.console.levels.defaultLevels': 'Default levels',
  'panel.console.levels.hideAll': 'Hide all',
  'panel.console.levels.only': '{level} only',
  'panel.console.levels.custom': 'Custom levels',
  'panel.console.levels.default': 'Default',

  // Settings pane (labels + hover titles, browser pane order)
  'panel.console.setting.hideNetwork': 'Hide network',
  'panel.console.setting.hideNetworkTitle': "Hide the browser's network log entries (failed and blocked requests)",
  'panel.console.setting.logXhr': 'Log XMLHttpRequests',
  'panel.console.setting.logXhrTitle': 'Log a message when an XHR, fetch, or EventSource request finishes or fails',
  'panel.console.setting.preserveLog': 'Preserve log',
  'panel.console.setting.preserveLogTitle': 'Do not clear the log on navigation',
  'panel.console.setting.eagerEval': 'Eager evaluation',
  'panel.console.setting.eagerEvalTitle': 'Eagerly evaluate text in the prompt (side-effect-free preview)',
  'panel.console.setting.selectedContextOnly': 'Selected context only',
  'panel.console.setting.selectedContextOnlyTitle': 'Only show messages from the selected context',
  'panel.console.setting.autocompleteHistory': 'Autocomplete from history',
  'panel.console.setting.autocompleteHistoryTitle': 'Suggest commands you ran before as you type in the prompt',
  'panel.console.setting.groupSimilar': 'Group similar messages in console',
  'panel.console.setting.groupSimilarTitle': 'Collapse repeated identical messages into one row with a count',
  'panel.console.setting.evalUserGesture': 'Treat code evaluation as user action',
  'panel.console.setting.evalUserGestureTitle':
    'Evaluate with a user gesture, so APIs gated on user activation work from the prompt',
  'panel.console.setting.showCorsErrors': 'Show CORS errors in console',
  'panel.console.setting.showCorsErrorsTitle': "Show CORS policy errors alongside the page's own output",

  // Per-setting (i) info corpora (titles reuse the setting label keys;
  // groupSimilar's popover title differs from its checkbox label)
  'panel.console.info.exampleCaption': 'Example console',
  'panel.console.info.hideNetwork.summary':
    'Hides the browser’s own network log entries — failed and blocked requests — while the page’s console output always stays.',
  'panel.console.info.hideNetwork.description':
    'Also hides the "finished loading" rows synthesized by Log XMLHttpRequests — they are network-source messages too.',
  'panel.console.info.logXhr.summary': 'Logs a row whenever an XHR, fetch, or EventSource request finishes or fails.',
  'panel.console.info.logXhr.description':
    'Rows log at the Info level — failures too — and the URL links to the request’s row in the Network panel. Hide network hides these rows as well.',
  'panel.console.info.preserveLog.summary': 'Keeps the log across page navigations instead of clearing it.',
  'panel.console.info.preserveLog.description':
    'Off, a navigation — the page’s top context being recreated — cuts the view to the entries that arrive after it.',
  'panel.console.info.eagerEval.summary':
    'Previews the result of the expression you are typing on the grey line under the prompt.',
  'panel.console.info.eagerEval.description':
    'The preview evaluates side-effect-free: an expression that would change page state shows nothing instead of running, and nothing is written to the log until you press Enter.',
  'panel.console.info.selectedContextOnly.summary':
    'Only shows messages from the JavaScript context picked in the toolbar’s context selector.',
  'panel.console.info.selectedContextOnly.description':
    'Entries that carry no context — the browser’s own log entries — always stay visible.',
  'panel.console.info.autocompleteHistory.summary':
    'Suggests the most recent command that extends what you typed, as a dimmed completion in the prompt.',
  'panel.console.info.autocompleteHistory.description':
    'Tab — or → at the end of the input — accepts it; ↑/↓ still walk the history. The history lives for the current panel session.',
  'panel.console.info.groupSimilar.title': 'Group similar messages',
  'panel.console.info.groupSimilar.summary':
    'Collapses consecutive identical messages into one row with a count badge.',
  'panel.console.info.groupSimilar.description':
    'Typed commands and their results never group — the transcript stays literal.',
  'panel.console.info.evalUserGesture.summary': 'Runs prompt commands as if a user gesture triggered them.',
  'panel.console.info.evalUserGesture.description':
    'APIs gated on user activation — opening a window, writing to the clipboard, fullscreen — succeed from the prompt with this on.',
  'panel.console.info.showCorsErrors.summary':
    'Shows the browser’s CORS explanations — "Access to fetch at … has been blocked by CORS policy: …" — alongside the page’s output.',
  'panel.console.info.showCorsErrors.description':
    'Off hides only those explanation messages; the blocked request itself still shows in the Network panel.',

  // Capture-stopped banner + never-silent empty surfaces
  'panel.console.banner.leftScope':
    'Capture stopped — this tab left Debug mode’s scope. Showing the last captured output.',
  'panel.console.banner.debugOff': 'Capture stopped — Debug mode is off. Showing the last captured output.',
  'panel.console.enableDebug': 'Enable Debug mode',
  'panel.console.empty.noCdp.title': 'Console capture needs Debug mode',
  'panel.console.empty.noCdp.sub': 'Debug-mode inspection isn’t available in this browser.',
  'panel.console.empty.capturing.title': 'No console output yet',
  'panel.console.empty.capturing.sub':
    'This tab’s log messages and uncaught exceptions will appear here as they happen.',
  'panel.console.empty.debugOff.title': 'Enable Debug mode to view console logs',
  'panel.console.empty.debugOff.sub':
    'Open Headers captures this tab’s console output and uncaught exceptions while Debug mode is on.',
  'panel.console.empty.outOfScope.title': 'This tab is outside Debug mode’s scope',
  'panel.console.empty.outOfScope.sub':
    'Bring it into scope from Debug mode — change the scope or pin this tab — to capture its console output.',
  'panel.console.noMatch': 'No console entries match your filter.',
  'panel.console.revealedHidden': 'Revealed message is hidden by the active filter',

  // Log rows
  'panel.console.repeatTitle': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} identical message', other: '{count} identical messages' }),
  'panel.console.expandStack': 'Expand stack trace',
  'panel.console.collapseStack': 'Collapse stack trace',

  // REPL prompt
  'panel.console.prompt.waiting': 'Waiting for a JavaScript context…',
  'panel.console.prompt.placeholder': 'Run JavaScript in the selected context',
  'panel.console.prompt.aria': 'Console prompt',
  'panel.console.prompt.previewAria': 'Eager evaluation preview',
} as const satisfies Catalog;
