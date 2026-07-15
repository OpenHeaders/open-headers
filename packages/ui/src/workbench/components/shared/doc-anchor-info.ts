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

import type { MessageKey } from '@openheaders/i18n';

export interface DocAnchorInfo {
  titleKey: MessageKey;
  summaryKey: MessageKey;
}

export const DOC_ANCHOR_INFO: Record<string, DocAnchorInfo> = {
  // ── Header operations ────────────────────────────────────────────
  override: {
    titleKey: 'workbench.docs.anchor.override.title',
    summaryKey: 'workbench.docs.anchor.override.summary',
  },
  append: {
    titleKey: 'workbench.docs.anchor.append.title',
    summaryKey: 'workbench.docs.anchor.append.summary',
  },
  remove: {
    titleKey: 'workbench.docs.anchor.remove.title',
    summaryKey: 'workbench.docs.anchor.remove.summary',
  },
  merge: {
    titleKey: 'workbench.docs.anchor.merge.title',
    summaryKey: 'workbench.docs.anchor.merge.summary',
  },
  // ── Query-param operations ───────────────────────────────────────
  'qp-add': {
    titleKey: 'workbench.docs.anchor.qpAdd.title',
    summaryKey: 'workbench.docs.anchor.qpAdd.summary',
  },
  'qp-override': {
    titleKey: 'workbench.docs.anchor.qpOverride.title',
    summaryKey: 'workbench.docs.anchor.qpOverride.summary',
  },
  'qp-remove': {
    titleKey: 'workbench.docs.anchor.qpRemove.title',
    summaryKey: 'workbench.docs.anchor.qpRemove.summary',
  },
  'qp-remove-all': {
    titleKey: 'workbench.docs.anchor.qpRemoveAll.title',
    summaryKey: 'workbench.docs.anchor.qpRemoveAll.summary',
  },
  // ── Condition types ──────────────────────────────────────────────
  'url-pattern': {
    titleKey: 'workbench.docs.anchor.urlPattern.title',
    summaryKey: 'workbench.docs.anchor.urlPattern.summary',
  },
  'url-regex': {
    titleKey: 'workbench.docs.anchor.urlRegex.title',
    summaryKey: 'workbench.docs.anchor.urlRegex.summary',
  },
  'request-domains': {
    titleKey: 'workbench.docs.anchor.requestDomains.title',
    summaryKey: 'workbench.docs.anchor.requestDomains.summary',
  },
  'exclude-domains': {
    titleKey: 'workbench.docs.anchor.excludeDomains.title',
    summaryKey: 'workbench.docs.anchor.excludeDomains.summary',
  },
  'initiator-domains': {
    titleKey: 'workbench.docs.anchor.initiatorDomains.title',
    summaryKey: 'workbench.docs.anchor.initiatorDomains.summary',
  },
  methods: {
    titleKey: 'workbench.docs.anchor.methods.title',
    summaryKey: 'workbench.docs.anchor.methods.summary',
  },
  'condition-resource-types': {
    titleKey: 'workbench.docs.anchor.conditionResourceTypes.title',
    summaryKey: 'workbench.docs.anchor.conditionResourceTypes.summary',
  },
  'domain-type': {
    titleKey: 'workbench.docs.anchor.domainType.title',
    summaryKey: 'workbench.docs.anchor.domainType.summary',
  },
  headers: {
    titleKey: 'workbench.docs.anchor.headers.title',
    summaryKey: 'workbench.docs.anchor.headers.summary',
  },
  // ── Redirect ─────────────────────────────────────────────────────
  'redirect-regex': {
    titleKey: 'workbench.docs.anchor.redirectRegex.title',
    summaryKey: 'workbench.docs.anchor.redirectRegex.summary',
  },
  // ── Body modes ───────────────────────────────────────────────────
  'request-body-dynamic': {
    titleKey: 'workbench.docs.anchor.requestBodyDynamic.title',
    summaryKey: 'workbench.docs.anchor.requestBodyDynamic.summary',
  },
  'response-dynamic': {
    titleKey: 'workbench.docs.anchor.responseDynamic.title',
    summaryKey: 'workbench.docs.anchor.responseDynamic.summary',
  },
  'request-body-graphql': {
    titleKey: 'workbench.docs.anchor.requestBodyGraphql.title',
    summaryKey: 'workbench.docs.anchor.requestBodyGraphql.summary',
  },
  'response-graphql': {
    titleKey: 'workbench.docs.anchor.responseGraphql.title',
    summaryKey: 'workbench.docs.anchor.responseGraphql.summary',
  },
};
