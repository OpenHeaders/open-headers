/**
 * Popover blurbs for docs SUB-ANCHORS — the fine-grained (i) triggers
 * on rows and fields (header operations, query-param operations,
 * condition types, redirect regex, dynamic/GraphQL body modes). The
 * docs registry carries title + summary for top-level SECTIONS only;
 * anchors live inside a section's prose, so their one-liners are
 * authored here. Keyed by the anchor doc-id `getDocId` returns —
 * `<DocInfo>` resolves the owning section for the kicker and the
 * "More information" jump.
 */

export interface DocAnchorInfo {
  title: string;
  summary: string;
}

export const DOC_ANCHOR_INFO: Record<string, DocAnchorInfo> = {
  // ── Header operations ────────────────────────────────────────────
  override: {
    title: 'Add / Replace',
    summary: 'Sets the header to this value — added when missing, replacing any existing value.',
  },
  append: {
    title: 'Append',
    summary:
      'Appends this value to the header’s existing value. Only standard list-valued headers support appending — on others the rule is saved as a draft.',
  },
  remove: {
    title: 'Remove',
    summary: 'Strips the header from matching traffic entirely; the value field is unused.',
  },
  merge: {
    title: 'Merge',
    summary: 'Merges this value into the header’s existing list, skipping values already present.',
  },
  // ── Query-param operations ───────────────────────────────────────
  'qp-add': {
    title: 'Add / Replace',
    summary: 'Sets the parameter on the URL — added when missing, replaced when already present.',
  },
  'qp-override': {
    title: 'Replace Only',
    summary: 'Replaces the parameter’s value only when the URL already carries it; URLs without it pass unchanged.',
  },
  'qp-remove': {
    title: 'Remove',
    summary: 'Removes the parameter from matching URLs.',
  },
  'qp-remove-all': {
    title: 'Remove All',
    summary:
      'Strips the entire query string from matching URLs. Other operations in the same rule are ignored while it is present.',
  },
  // ── Condition types ──────────────────────────────────────────────
  'url-pattern': {
    title: 'URL Pattern',
    summary: 'Matches the request URL against a urlFilter pattern — * wildcards, || domain anchors, ^ separators.',
  },
  'url-regex': {
    title: 'URL Regex',
    summary:
      'Matches the request URL against a regular expression; capture groups feed \\1, \\2 substitutions in redirect targets.',
  },
  'request-domains': {
    title: 'Request Domains',
    summary: 'Matches requests whose target host is one of the listed domains, subdomains included.',
  },
  'exclude-domains': {
    title: 'Exclude Domains',
    summary: 'Matches every request except those whose target host is listed.',
  },
  'initiator-domains': {
    title: 'Initiator Domains',
    summary:
      'Matches by the page that issued the request rather than the request URL itself. The Excl. variant inverts the list.',
  },
  methods: {
    title: 'Methods',
    summary: 'Matches on the HTTP method (GET, POST, …). The Excl. variant inverts the list.',
  },
  'condition-resource-types': {
    title: 'Resource Types',
    summary:
      'Matches on what the browser is fetching — documents, scripts, XHR/fetch, images, … The Excl. variant inverts the list.',
  },
  'domain-type': {
    title: 'Domain Type',
    summary: 'First-party matches requests to the same site as the page; third-party matches cross-site requests.',
  },
  headers: {
    title: 'Response Header',
    summary: 'Matches on a header of the received response — by presence, or by value when one is given.',
  },
  // ── Redirect ─────────────────────────────────────────────────────
  'redirect-regex': {
    title: 'Regex Substitution',
    summary: 'With a URL Regex condition, \\1, \\2 … insert the captured groups into the redirect target.',
  },
  // ── Body modes ───────────────────────────────────────────────────
  'request-body-dynamic': {
    title: 'Dynamic (JavaScript)',
    summary: 'Runs your JavaScript against each matching request to build the outgoing body from the original.',
  },
  'response-dynamic': {
    title: 'Dynamic (JavaScript)',
    summary:
      'Runs your JavaScript for each matching response — transforming the real reply (network) or building one from scratch (mock).',
  },
  'request-body-graphql': {
    title: 'GraphQL Operation Filter',
    summary: 'Additionally gates the rule on the GraphQL operation name found in the request payload.',
  },
  'response-graphql': {
    title: 'GraphQL Operation Filter',
    summary: 'Additionally gates the rule on the GraphQL operation name found in the request payload.',
  },
};
