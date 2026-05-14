import { Card, Tag } from 'antd';
import type React from 'react';
import {
  ActionsRuleAnatomyDiagram,
  ConditionsHostVsOriginDiagram,
  ConditionsMatchingDiagram,
  DomainTypeDiagram,
  ExcludeDomainsDiagram,
  HeadersConditionDiagram,
  InitiatorDomainsDiagram,
  MethodsDiagram,
  RequestDomainsDiagram,
  ResourceTypesDiagram,
  UrlPatternDiagram,
  UrlRegexDiagram,
} from '../diagrams';
import { Anchor, BrowserTag, DiagramFrame, DocLink, DocParagraph, OnThisPage, SurfaceContext } from '../shared';

// ── Conditions Reference (one section, multiple sub-anchors) ─────

const CONDITION_ANCHORS = [
  { id: 'url-pattern', title: 'URL Pattern' },
  { id: 'url-regex', title: 'URL Regex' },
  { id: 'request-domains', title: 'Request Domains' },
  { id: 'exclude-domains', title: 'Exclude Domains' },
  { id: 'initiator-domains', title: 'Initiator Domains' },
  { id: 'methods', title: 'Methods' },
  { id: 'condition-resource-types', title: 'Resource Types' },
  { id: 'domain-type', title: 'Domain Type' },
  { id: 'headers', title: 'Response Headers' },
];

export const ConditionsSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      A condition is a filter on one attribute of an outgoing request. Stack multiple conditions and they combine with
      AND logic — every condition must match for the rule to fire. Each condition maps directly to a Chrome{' '}
      <code>declarativeNetRequest</code> field.
    </DocParagraph>
    <DocParagraph>
      Most conditions also have an <strong>Excl.</strong> variant in the rule editor — Excl. Methods, Excl. Resources,
      Excl. Initiator, Excl. Resp Header — that flips the match (e.g., "everything except these methods"). Use them
      whenever the negative set is smaller than the positive one.
    </DocParagraph>
    <DiagramFrame caption="A rule pairs AND-matched conditions with one action — conditions decide whether the rule fires.">
      <ActionsRuleAnatomyDiagram focus="conditions" />
    </DiagramFrame>
    <DiagramFrame caption="Each condition checks one request attribute. All must match for the rule to fire.">
      <ConditionsMatchingDiagram />
    </DiagramFrame>
    <DiagramFrame caption="The page URL and the fetch's destination URL are tracked separately — that's why there are two domain conditions.">
      <ConditionsHostVsOriginDiagram />
    </DiagramFrame>
    <OnThisPage entries={CONDITION_ANCHORS} />

    <Anchor id="url-pattern">
      <Card title="URL Pattern" extra={<Tag color="blue">urlFilter</Tag>} style={{ marginBottom: 8 }}>
        Wildcard pattern on the full URL. Use <code>*</code> to match any characters. The protocol must be specified:{' '}
        <code>*://</code> for any, <code>https://</code> for HTTPS only.
        <DiagramFrame caption="Gold = wildcard, green = literal. Each test URL below shows whether the pattern matches it.">
          <UrlPatternDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="url-regex">
      <Card title="URL Regex" extra={<Tag color="purple">regexFilter</Tag>} style={{ marginBottom: 8 }}>
        RE2 regular expression on the full URL including protocol. For matching that wildcards can't express. Cannot be
        combined with URL Pattern in the same rule.
        <DiagramFrame caption="Purple = real regex syntax. Green = literal characters. Each test URL below shows whether the regex matches.">
          <UrlRegexDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="request-domains">
      <Card title="Request Domains" extra={<Tag color="green">requestDomains</Tag>} style={{ marginBottom: 8 }}>
        Matches a domain plus every one of its subdomains, automatically. Enter the apex domain once; the rule covers{' '}
        <code>api.</code>, <code>cdn.</code>, <code>www.</code>, and any deeper nesting without wildcards.
        <DiagramFrame caption="One value, all subdomains. The boundary cases below show what counts as a true subdomain.">
          <RequestDomainsDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="exclude-domains">
      <Card
        title="Exclude Domains"
        extra={<Tag color="warning">excludedRequestDomains</Tag>}
        style={{ marginBottom: 8 }}
      >
        Subtracts hosts from another condition's matches — same subdomain semantics as Request Domains, so excluding a
        host also excludes its subdomains. Doesn't match anything on its own.
        <DiagramFrame caption="Green include narrows to a candidate set; red exclude removes some of those. Subdomains follow.">
          <ExcludeDomainsDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="initiator-domains">
      <Card title="Initiator Domains" extra={<Tag>initiatorDomains</Tag>} style={{ marginBottom: 8 }}>
        Matches by which page is open when the request is made — the request's origin, not its destination. The same
        fetch call to the same URL can match or miss depending on which tab the user is browsing.
        <DiagramFrame caption="Same destination, two different page contexts. The initiator decides which one matches.">
          <InitiatorDomainsDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="methods">
      <Card title="Methods" extra={<Tag>requestMethods</Tag>} style={{ marginBottom: 8 }}>
        Filter by HTTP verb. Multi-select — pick the methods that should match; the rest don't trigger the rule. Leave
        the condition off entirely to match every method.
        <DiagramFrame caption="Orange pills are selected; gray are skipped. Test requests below trace each verb to its outcome.">
          <MethodsDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="condition-resource-types">
      <Card title="Resource Types" extra={<Tag>resourceTypes</Tag>} style={{ marginBottom: 8 }}>
        Filter by what kind of resource is being loaded — page navigations, XHR/fetch, scripts, images, fonts, and more.
        Multi-select like Methods. See the <DocLink to="resource-types">Resource Types</DocLink> reference for the full
        list with code names and concrete examples.
        <DiagramFrame caption="Purple kinds match; gray kinds are skipped. Each test request shows its kind inline.">
          <ResourceTypesDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="domain-type">
      <Card title="Domain Type" extra={<Tag>domainType</Tag>} style={{ marginBottom: 8 }}>
        Classifies each request by its relationship to the page — <code>firstParty</code> when the destination shares
        the page's registrable domain, <code>thirdParty</code> when it doesn't. Common use: blocking trackers (match
        only thirdParty) or scoping a rule to your own services (match only firstParty).
        <DiagramFrame caption="Page banner sets the origin; the selector picks which type matches; the table shows the verdict per destination.">
          <DomainTypeDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>

    <Anchor id="headers">
      <Card title="Response Headers" extra={<BrowserTag min="chrome-128" />} style={{ marginBottom: 8 }}>
        Match responses carrying a specific header with a specific value. Chrome's DNR doesn't expose request-header
        matching — this condition is response-side only. Both the header name and the value are compared as exact
        strings (no wildcards, no partial matching) and the header must actually be present on the response.
        <DiagramFrame caption="Two pills (name + value) joined by =, then test response headers hitting each failure mode.">
          <HeadersConditionDiagram />
        </DiagramFrame>
      </Card>
    </Anchor>
  </>
);
