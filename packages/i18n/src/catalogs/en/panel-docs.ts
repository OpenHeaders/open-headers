/**
 * DevTools panel — docs navigation + the Filter Syntax docs body.
 * Filter grammar tokens, chord chips, and the FilterExample device
 * ride raw under the S18 diagram boundary; quoted example terms ride
 * raw inside keyed captions.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': 'Filter Syntax',
  'panel.docs.nav.filterSyntax.summary':
    'Text tokens, property filters, and the match toggles — every card filters one shared example capture.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  // Filter grammar (`api users`, `-term`, `domain:`, `is:from-cache`,
  // `larger-than:100k`, …), the toggle glyphs (Aa / ab / .*), the Alt+C /
  // Alt+W / Alt+R chords, the × clear glyph, and everything inside the
  // FilterExample device (mock input text, the example-capture rows, its
  // kicker, ✓/✗ glyphs, per-row failure reasons) ride raw — S18 diagram
  // boundary. DiagramFrame captions, card prose, titles and headings key.
  'panel.docs.filterSyntax.intro1Prefix': 'The traffic filter combines free text,',
  'panel.docs.filterSyntax.intro1Suffix':
    'property filters, and three match toggles. Terms separated by spaces must ALL match (AND), and every card below runs its filter over the same five-request example capture — each diagram is one slice of that picture.',
  'panel.docs.filterSyntax.intro2Prefix':
    'Every filter input in the panel — Network, Console, Storage, Headers, Cookies, Initiator, Messages — carries the same three toggles',
  'panel.docs.filterSyntax.intro2MatchCase': 'match case',
  'panel.docs.filterSyntax.intro2WholeWord': 'whole word',
  'panel.docs.filterSyntax.intro2Regex': 'regex',
  'panel.docs.filterSyntax.intro2Middle': 'and a',
  'panel.docs.filterSyntax.intro2Suffix': 'button that clears the text.',
  'panel.docs.filterSyntax.intro2Kbd': 'Keyboard:',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'flip the toggles while the input has focus.',

  'panel.docs.filterSyntax.headingText': 'Text filters',
  'panel.docs.filterExample.captureHeading': 'The example capture',
  'panel.docs.filterSyntax.headingProperty': 'Property filters',
  'panel.docs.filterSyntax.headingToggles': 'Match toggles',
  'panel.docs.filterSyntax.headingElsewhere': 'Everywhere else',

  'panel.docs.filterSyntax.textTitle': 'Text',
  'panel.docs.filterSyntax.text1':
    'A bare term keeps every request whose URL contains it. Several terms AND together — a request must contain all of them, in any position.',
  'panel.docs.filterSyntax.textCaption':
    'Two terms — only the request whose URL contains both “api” and “users” survives.',

  'panel.docs.filterSyntax.negationTitle': 'Negation',
  'panel.docs.filterSyntax.negation1Prefix': 'A leading',
  'panel.docs.filterSyntax.negation1Middle': 'flips any token:',
  'panel.docs.filterSyntax.negation1Middle2':
    'hides matching requests instead of keeping them. Works on property filters too —',
  'panel.docs.filterSyntax.negationCaption': 'Everything stays EXCEPT requests matching the negated term.',

  'panel.docs.filterSyntax.phraseTitle': 'Exact Phrase',
  'panel.docs.filterSyntax.phrase1Prefix':
    'Quotes make one token out of text that contains spaces, and keep characters like',
  'panel.docs.filterSyntax.phrase1Or': 'or',
  'panel.docs.filterSyntax.phrase1Suffix': 'literal — useful for query strings.',
  'panel.docs.filterSyntax.phraseCaption': 'The quoted phrase matches as one contiguous piece of the URL.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    'token checks one attribute of the request instead of the whole URL. Property filters compose with text tokens and with each other — all of them must match.',

  'panel.docs.filterSyntax.domainTitle': 'Domain',
  'panel.docs.filterSyntax.domain1Prefix':
    'Matches the hostname by substring, so an apex domain catches every subdomain —',
  'panel.docs.filterSyntax.domain1Suffix': '— without wildcards.',
  'panel.docs.filterSyntax.domainCaption':
    'One value covers every openheaders.com subdomain; the third-party host misses.',

  'panel.docs.filterSyntax.statusCodeTitle': 'Status Code',
  'panel.docs.filterSyntax.statusCode1':
    'Keeps requests whose response carried exactly this code. Pending and failed requests have no code, so they never match.',
  'panel.docs.filterSyntax.statusCodeCaption': 'Only the 404 survives — the exact code, not a range.',

  'panel.docs.filterSyntax.methodTitle': 'Method',
  'panel.docs.filterSyntax.method1Prefix': 'Keeps requests using this HTTP verb, compared case-insensitively —',
  'panel.docs.filterSyntax.method1And': 'and',
  'panel.docs.filterSyntax.method1Suffix': 'are the same filter.',
  'panel.docs.filterSyntax.methodCaption': 'Only the POST survives.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'MIME Type',
  'panel.docs.filterSyntax.mime1Prefix': "Matches the response's content type by substring —",
  'panel.docs.filterSyntax.mime1Catches': 'catches',
  'panel.docs.filterSyntax.mime1Suffix': 'catches every image format.',
  'panel.docs.filterSyntax.mimeCaption': 'Both JSON responses survive; scripts, fonts and images miss.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'Response Header',
  'panel.docs.filterSyntax.respHeader1Prefix':
    "Keeps requests whose response carries a header with this exact name — the value doesn't matter. Handy for spotting CDN cache behavior",
  'panel.docs.filterSyntax.respHeader1Suffix': 'or missing security headers (negate it).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Only the CDN response carries an x-cache header.',

  'panel.docs.filterSyntax.largerThanTitle': 'Larger Than',
  'panel.docs.filterSyntax.largerThan1':
    'Keeps requests that transferred more than N bytes. Suffixes scale the number:',
  'panel.docs.filterSyntax.largerThanCaption': 'Only the 128 kB bundle clears the 100k threshold.',

  'panel.docs.filterSyntax.fromCacheTitle': 'From Cache',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Keeps responses the browser served from cache — a',
  'panel.docs.filterSyntax.fromCache1Middle': ', or a disk/memory cache hit that never touched the network. Negate it',
  'panel.docs.filterSyntax.fromCache1Suffix': 'to see only what actually crossed the wire.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Only the cached tracking pixel survives.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'The three buttons inside the input change how text tokens compare. They apply to free text (and',
  'panel.docs.filterSyntax.togglesIntroMiddle': 'style tokens on the detail tabs);',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'and the other property filters keep their own semantics.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Match Case',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Off (the default),',
  'panel.docs.filterSyntax.matchCase1And': 'and',
  'panel.docs.filterSyntax.matchCase1Suffix': "are the same filter. On, the term must match the URL's exact casing.",
  'panel.docs.filterSyntax.matchCaseCaption':
    'With Aa on, “Users” matches nothing — every URL in the capture is lowercase.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Whole Word',
  'panel.docs.filterSyntax.wholeWord1Prefix': 'The term only matches at word boundaries —',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'and friends count as boundaries. Use it when a short term is buried inside longer words.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '“user” no longer matches inside “users” — with ab off, request #7 would match.',

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    "The whole input becomes one regular expression tested against the URL — property tokens are not parsed in this mode. A pattern that doesn't compile turns the input red and hides nothing.",
  'panel.docs.filterSyntax.regexCaption': 'One pattern, two file types: URLs ending in .js or .woff2.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Other Filter Inputs',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'The detail tabs carry the same input with their own property keys; the toggles and',
  'panel.docs.filterSyntax.otherIntroSuffix': 'negation work identically in each:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'plain text with the three toggles; Storage also counts matches per section on its navigation rail while you type.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'plain text (or a regex under',
  'panel.docs.filterSyntax.otherSearchMiddle': ') with the three toggles, submitted with Enter. The',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'chips pick which data it scans — at least one stays selected — and each result opens its source: the request tab, the storage section, or the Console.',
} as const satisfies Catalog;
