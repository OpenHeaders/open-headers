import { Card, Tag, theme } from 'antd';
import type React from 'react';
import {
  ActionsRuleAnatomyDiagram,
  ActionsTaxonomyDiagram,
  AppendDiagram,
  AppendWontApplyDiagram,
  BlockDiagram,
  BlockUseCasesDiagram,
  BlockWontApplyDiagram,
  BodyDynamicDiagram,
  BodyGraphqlDiagram,
  BodyInterceptDiagram,
  BodyStaticDiagram,
  BodyUseCasesDiagram,
  BodyWontApplyDiagram,
  DelayNavDiagram,
  DelayRoutingDiagram,
  DelayUseCasesDiagram,
  DelayWontApplyDiagram,
  DelayXhrDiagram,
  HeaderOpsDiagram,
  InjectCssDiagram,
  InjectScriptDiagram,
  InjectTimingDiagram,
  InjectUseCasesDiagram,
  InjectWontApplyDiagram,
  MergeDiagram,
  MergeWontApplyDiagram,
  MockDynamicDiagram,
  MockFlowDiagram,
  MockStaticDiagram,
  MockUseCasesDiagram,
  MockWontApplyDiagram,
  OverrideDiagram,
  OverrideWontApplyDiagram,
  QueryParamAddReplaceDiagram,
  QueryParamRemoveAllDiagram,
  QueryParamRemoveDiagram,
  QueryParamReplaceOnlyDiagram,
  QueryParamUseCasesDiagram,
  QueryParamWontApplyDiagram,
  RedirectRegexDiagram,
  RedirectStaticDiagram,
  RedirectUseCasesDiagram,
  RedirectWontApplyDiagram,
  RemoveDiagram,
  RemoveWontApplyDiagram,
} from '../diagrams';
import {
  Anchor,
  Callout,
  DiagramFrame,
  DocHeading,
  DocLink,
  DocParagraph,
  EngineTag,
  OnThisPage,
  SurfaceContext,
} from '../shared';

// ── Actions overview (concept page that unites all action pages) ───

const ACTION_ANCHORS = [
  { id: 'modify-request', title: 'Modify Request' },
  { id: 'modify-response', title: 'Modify Response' },
  { id: 'run-code', title: 'Run Code' },
];

export const ActionsSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      An action is the <strong>do</strong> part of a rule. Where a <DocLink to="conditions">condition</DocLink> decides{' '}
      <em>whether</em> the rule fires, the action decides <em>what changes</em>. Every rule pairs a stack of AND-matched
      conditions with exactly one action.
    </DocParagraph>
    <DocParagraph>
      Actions fall into three categories — modify the outgoing request, modify the incoming response, or run code in the
      page. Each action is implemented by one of two engines: <strong>DNR</strong> (Chrome's
      <code>declarativeNetRequest</code>, fast and native) or <strong>Script</strong> (Open Headers' in-page engine, for
      things DNR can't express). See <DocLink to="execution">How rules execute</DocLink> for the trade-offs.
    </DocParagraph>
    <DiagramFrame caption="A rule = AND-matched conditions paired with exactly one action.">
      <ActionsRuleAnatomyDiagram />
    </DiagramFrame>
    <DiagramFrame caption="Three categories, every action with its engine tag.">
      <ActionsTaxonomyDiagram />
    </DiagramFrame>
    <OnThisPage entries={ACTION_ANCHORS} />

    <Anchor id="modify-request">
      <Card
        title="Modify Request"
        extra={<Tag color="blue">before it leaves the browser</Tag>}
        style={{ marginBottom: 8 }}
      >
        <DocParagraph>
          Reshape the outgoing request — its headers, URL parameters, body, destination, or whether it goes out at all.
          Most rules live here.
        </DocParagraph>
        <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 22 }}>
          <li>
            <DocLink to="header-actions">Header Actions</DocLink> — Add / Replace / Append / Remove / Merge on request
            headers.
          </li>
          <li>
            <DocLink to="block">Block</DocLink> — cancel the request at the network layer.
          </li>
          <li>
            <DocLink to="redirect">Redirect</DocLink> — send the request to a different URL, static or regex.
          </li>
          <li>
            <DocLink to="query-param">Query Params</DocLink> — add, replace, or remove URL parameters.
          </li>
          <li>
            <DocLink to="body">Request Body</DocLink> — rewrite the outgoing fetch / XHR body (static, dynamic, or
            GraphQL-filtered).
          </li>
        </ul>
      </Card>
    </Anchor>

    <Anchor id="modify-response">
      <Card
        title="Modify Response"
        extra={<Tag color="green">before the page sees it</Tag>}
        style={{ marginBottom: 8 }}
      >
        <DocParagraph>
          Reshape the response on its way back — headers, body, or HTTP status. Useful for mocking unbuilt endpoints and
          forcing failure modes in development.
        </DocParagraph>
        <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 22 }}>
          <li>
            <DocLink to="header-actions">Header Actions</DocLink> — same five operations apply to response headers.
          </li>
          <li>
            <DocLink to="mock">Response Body + Status</DocLink> — intercept the reply and return synthetic body, status,
            or headers.
          </li>
        </ul>
      </Card>
    </Anchor>

    <Anchor id="run-code">
      <Card
        title="Run Code"
        extra={<Tag color="purple">inside the page or its scheduler</Tag>}
        style={{ marginBottom: 8 }}
      >
        <DocParagraph>
          Effects that don't fit "modify a request or response" cleanly — code injection and artificial latency. Both
          run through the Script engine because DNR has no equivalent.
        </DocParagraph>
        <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 22 }}>
          <li>
            <DocLink to="inject">Inject JS / CSS</DocLink> — run JavaScript or CSS in the page context, before page
            scripts or after the DOM is ready.
          </li>
          <li>
            <DocLink to="delay">Delay</DocLink> — add artificial latency to navigations and JS-initiated fetch / XHR.
          </li>
        </ul>
      </Card>
    </Anchor>

    <Callout kind="tip" title="One action per rule">
      Each rule carries exactly one action. To do two things at once — add a header AND redirect, for example — write
      two rules with the same conditions. Both fire on the same request; DNR composes them in a documented order.
    </Callout>
  </>
);

// ── Actions: Header Actions ──────────────────────────────────────

const ActionHeading: React.FC<{ title: string; engine: 'dnr' | 'script' }> = ({ title, engine }) => (
  <DocHeading level={3}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {title} <EngineTag kind={engine} />
    </span>
  </DocHeading>
);

export const HeaderActionsSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Four operations on request and response headers — three native (Add/Replace, Append, Remove) plus one script-based
      (Merge) for value concatenation DNR can't express.
    </DocParagraph>
    <DiagramFrame caption="Same starting headers, four different outcomes">
      <HeaderOpsDiagram />
    </DiagramFrame>

    <Anchor id="override">
      <ActionHeading title="Add / Replace" engine="dnr" />
      <DocParagraph>
        Sets the header to this value. Replaces if present, adds if missing — always one header with your value.
      </DocParagraph>
      <DiagramFrame caption="Same rule covers both cases — replaces when present, adds when absent.">
        <OverrideDiagram />
      </DiagramFrame>
      <DiagramFrame caption="If the rule's conditions don't match the request, nothing happens — no error, no-op.">
        <OverrideWontApplyDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="append">
      <ActionHeading title="Append" engine="dnr" />
      <DocParagraph>
        Adds a new header entry with the same name. The original stays — duplicate headers result. Use for Set-Cookie,
        Link, Via.
      </DocParagraph>
      <DiagramFrame caption="The original header stays; a second row with the same name is added. Both are delivered.">
        <AppendDiagram />
      </DiagramFrame>
      <DiagramFrame caption="Some headers can't be duplicated — the browser collapses them. Reach for Override or Merge instead.">
        <AppendWontApplyDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="remove">
      <ActionHeading title="Remove" engine="dnr" />
      <DocParagraph>Deletes all instances of this header. No value needed.</DocParagraph>
      <DiagramFrame caption="Targeted row vanishes; everything else passes through unchanged.">
        <RemoveDiagram />
      </DiagramFrame>
      <DiagramFrame caption="If the header isn't there, nothing happens — no error, just a no-op.">
        <RemoveWontApplyDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="merge">
      <ActionHeading title="Merge" engine="script" />
      <DocParagraph>
        Reads the existing value at runtime and appends yours with a separator. Defaults to <code>{'; '}</code> for
        Cookie and <code>{', '}</code> for others. The separator can be empty for direct concatenation.
      </DocParagraph>
      <DiagramFrame caption="Existing value stays; your value is appended after the separator.">
        <MergeDiagram />
      </DiagramFrame>
      <DiagramFrame caption="Script-engine only — page navigations and static resources flow through untouched.">
        <MergeWontApplyDiagram />
      </DiagramFrame>
      <Callout kind="limitation">
        Merge is invisible in DevTools and can't read browser-default headers (Accept, User-Agent) — only headers
        explicitly set by page code.
      </Callout>
    </Anchor>
  </>
);

// ── Actions: Block / Redirect / QueryParam / Inject / Delay / Body / Mock ──

export const BlockSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Cancels matching requests at the network layer. The browser receives a network error and the page sees the request
      fail as if the server were unreachable.
    </DocParagraph>

    <ActionHeading title="How it works" engine="dnr" />
    <DocParagraph>
      Compiles to a DNR <code>block</code> action with no body. Applies regardless of resource type — pages, sub-frames,
      scripts, images, fonts, fetch, XHR — so a single rule covers everything unless you scope it down with a Resource
      Type condition.
    </DocParagraph>
    <DiagramFrame caption="Request is killed before it leaves the browser; the page sees a network error.">
      <BlockDiagram />
    </DiagramFrame>
    <DiagramFrame caption="Already-loaded resources stay loaded — Block only catches future requests.">
      <BlockWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Blocking ad / analytics / tracking domains, simulating outages for a single host, or denying access to one
      endpoint while leaving the rest of an API reachable. To block only the document of a page (not its sub-resources),
      add a Resource Type condition of <code>main_frame</code>.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — scope each one with Conditions (Domains, URL Pattern, Resource Type).">
      <BlockUseCasesDiagram />
    </DiagramFrame>
    <Callout kind="note">
      Blocking a <code>main_frame</code> request renders an "ERR_BLOCKED_BY_CLIENT" page in Chrome. Sub-resource blocks
      happen silently — what the user sees depends on the page's own error handling.
    </Callout>
  </>
);

export const RedirectSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Redirects matching requests to a different URL. Supports static URLs and regex capture groups.
    </DocParagraph>

    <Anchor id="redirect-url">
      <ActionHeading title="Static redirect" engine="dnr" />
      <DocParagraph>Enter a full URL to redirect every matching request to the same destination.</DocParagraph>
      <DiagramFrame caption="Same destination for every matching request — full URL substitution.">
        <RedirectStaticDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="redirect-regex">
      <ActionHeading title="Regex redirect" engine="dnr" />
      <DocParagraph>
        Pair with a URL Regex condition. Use <code>\1</code>, <code>\2</code>, etc. to reference capture groups in the
        destination URL.
      </DocParagraph>
      <DiagramFrame caption="The capture group's matched text gets substituted into the destination URL.">
        <RedirectRegexDiagram />
      </DiagramFrame>
    </Anchor>

    <DiagramFrame caption="Redirect doesn't retro-apply to already-loaded pages. Loops are silently capped by Chrome.">
      <RedirectWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Forcing HTTP → HTTPS, migrating users from an old domain, rewriting API versions, and proxying CDN traffic to a
      local dev server are the four typical patterns. Pair Static with full URLs you know up-front; reach for Regex when
      the path needs to carry through the redirect.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — pick Regex when the destination path depends on the match.">
      <RedirectUseCasesDiagram />
    </DiagramFrame>
  </>
);

export const QueryParamSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Modify URL query parameters before the request leaves the browser. Compiles to a DNR <code>queryTransform</code>{' '}
      action.
    </DocParagraph>

    <Anchor id="qp-add">
      <ActionHeading title="Add / Replace" engine="dnr" />
      <DocParagraph>Adds the parameter if missing, or replaces its value if already present.</DocParagraph>
      <DiagramFrame caption="Adds when missing, replaces when present — always one matching param with your value.">
        <QueryParamAddReplaceDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="qp-override">
      <ActionHeading title="Replace only" engine="dnr" />
      <DocParagraph>
        Replaces the value <strong>only when the parameter is already present</strong>. URLs without the param are left
        untouched. Use this to canonicalize a value (e.g. force <code>region=eu</code> on URLs already carrying any
        region) without injecting it into URLs that didn't have it.
      </DocParagraph>
      <DiagramFrame caption="Replaces only existing values — URLs without the param are untouched.">
        <QueryParamReplaceOnlyDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="qp-remove">
      <ActionHeading title="Remove" engine="dnr" />
      <DocParagraph>Removes specific parameters by name. The value is ignored.</DocParagraph>
      <DiagramFrame caption="Named param goes away; every other query param passes through.">
        <QueryParamRemoveDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="qp-remove-all">
      <ActionHeading title="Remove all" engine="dnr" />
      <DocParagraph>
        Strips the entire query string. Can't be combined with Add / Replace in the same rule.
      </DocParagraph>
      <DiagramFrame caption="Strips the whole query in one step — the URL ends up bare.">
        <QueryParamRemoveAllDiagram />
      </DiagramFrame>
    </Anchor>

    <DiagramFrame caption="Remove All conflicts with Add / Replace at the DNR layer — split into two rules.">
      <QueryParamWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Forcing a debug flag, canonicalizing region or locale, scrubbing tracking params, or stripping all query strings
      for privacy. Each one maps cleanly to one of the four operations above.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — pick the operation that matches your intent.">
      <QueryParamUseCasesDiagram />
    </DiagramFrame>
  </>
);

export const InjectSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Inject JavaScript or CSS into matching pages. Code runs in the page's context via a content script.
    </DocParagraph>
    <DiagramFrame caption="Insertion timing — pre-page-script (ASAP) vs DOM-safe (After Load).">
      <InjectTimingDiagram />
    </DiagramFrame>

    <Anchor id="inject-script">
      <ActionHeading title="Script injection" engine="script" />
      <DocParagraph>Inline code or an external URL. Choose insertion timing:</DocParagraph>
      <DocParagraph>
        <strong>As Soon As Possible</strong> — runs before the page's own scripts. Useful for monkey-patches that need
        to win the race (e.g. wrapping <code>fetch</code> before app code captures a reference).
      </DocParagraph>
      <DocParagraph>
        <strong>After Page Load</strong> — runs once the page has parsed. Safer default for code that reads the DOM,
        since elements are guaranteed to exist.
      </DocParagraph>
      <DiagramFrame caption="Script lands as a <script> tag in the page — sees the same globals as page JS.">
        <InjectScriptDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="inject-css">
      <ActionHeading title="CSS injection" engine="script" />
      <DocParagraph>
        Inject custom CSS as a <code>&lt;style&gt;</code> tag. Useful for dark-mode overrides, hiding noisy elements, or
        per-environment theming.
      </DocParagraph>
      <DiagramFrame caption="CSS is appended as a <style> tag with normal CSS specificity.">
        <InjectCssDiagram />
      </DiagramFrame>
    </Anchor>

    <DiagramFrame caption="Sandboxed iframes and strict CSP pages block injected scripts.">
      <InjectWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Monkey-patching browser APIs before app code grabs them, forcing a dark-mode theme, hiding noisy UI elements, and
      seeding window-level feature flags before the page initializes.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — ASAP timing is required for the first and fourth.">
      <InjectUseCasesDiagram />
    </DiagramFrame>
  </>
);

export const DelaySection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Adds artificial latency to matching requests. Three lanes run in parallel depending on the request kind.
    </DocParagraph>
    <DiagramFrame caption="Delay routing — three lanes for three request kinds.">
      <DelayRoutingDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Document &amp; iframe navigations</DocHeading>
    <DocParagraph>
      Routed through a local waiting page. Honors delays up to <strong>30,000 ms</strong> — Chrome's DNR redirect
      ceiling.
    </DocParagraph>
    <DiagramFrame caption="A local waiting page holds the navigation for N ms, then forwards to the real target.">
      <DelayNavDiagram />
    </DiagramFrame>

    <DocHeading level={3}>JS-initiated XHR / fetch</DocHeading>
    <DocParagraph>
      Intercepted by a <code>fetch()</code> / <code>XMLHttpRequest</code> monkey-patch. Capped at{' '}
      <strong>5,000 ms</strong> to avoid starving Chrome's HTTP connection pool — values above are clamped on the wire.
    </DocParagraph>
    <DiagramFrame caption="setTimeout inside the page-level patch holds the call before forwarding to the network.">
      <DelayXhrDiagram />
    </DiagramFrame>

    <DiagramFrame caption="Sub-resources and service-worker fetches escape the page-level monkey-patch.">
      <DelayWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Surfacing loading-state regressions, exercising debounce/throttle code paths, exposing race conditions between
      concurrent requests, and approximating slow-network conditions during local development.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — pair with URL Pattern or Domains to scope.">
      <DelayUseCasesDiagram />
    </DiagramFrame>

    <Callout kind="note" title="Desktop App — product note">
      Throttling static resources (images, scripts, stylesheets, fonts) needs a real local network layer that can hold
      connections open and stream bytes — out of reach for an extension. The desktop app picks that up soon.
    </Callout>
  </>
);

export const BodySection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Override or transform request bodies before they leave the browser. Script-based — intercepts <code>fetch()</code>{' '}
      and <code>XMLHttpRequest</code>.
    </DocParagraph>
    <DiagramFrame caption="The rule fires between page.js and the network — three transform shapes">
      <BodyInterceptDiagram />
    </DiagramFrame>

    <Anchor id="body-static">
      <ActionHeading title="Static body" engine="script" />
      <DocParagraph>
        Replaces the entire request body with a fixed string. Works for both REST and GraphQL — the rule doesn't parse
        the body, it substitutes wholesale.
      </DocParagraph>
      <DiagramFrame caption="Whole body replaced — original is discarded.">
        <BodyStaticDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="body-dynamic">
      <ActionHeading title="Dynamic body" engine="script" />
      <DocParagraph>
        Write a function that receives the original body and request context, then returns the modified body. The
        function receives <code>{'{ method, url, body, bodyAsJson }'}</code>.
      </DocParagraph>
      <DiagramFrame caption="Function sees the original; returns whatever should be sent.">
        <BodyDynamicDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="body-graphql">
      <ActionHeading title="GraphQL filter" engine="script" />
      <DocParagraph>
        When Resource Type is GraphQL, the rule fires only on requests whose JSON payload's configured field matches the
        value. The runtime parses the request body as JSON, reads the field named by <code>key</code>, and tests it
        against <code>value</code> using the chosen operator (<code>Equals</code> for exact match, <code>Contains</code>{' '}
        for substring).
      </DocParagraph>
      <DocParagraph>
        Common keys: <code>operationName</code> for the named operation, <code>query</code> for a substring of the query
        text. Requests without a JSON body, or with a missing or non-matching field, pass through untouched.
      </DocParagraph>
      <DiagramFrame caption="Field-level gate — operations that don't match flow through untouched.">
        <BodyGraphqlDiagram />
      </DiagramFrame>
    </Anchor>

    <DiagramFrame caption="GET/HEAD have nothing to replace; static resources don't enter the script intercept.">
      <BodyWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Forcing test fixtures, stamping every payload with metadata (debug flags, request IDs), mocking specific GraphQL
      operations, and anonymizing PII before replay are the four typical patterns.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — pair with URL Pattern or Domains to scope.">
      <BodyUseCasesDiagram />
    </DiagramFrame>
  </>
);

export const MockSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Intercept API calls and return custom responses — full control over status code, body, and response headers.
      Script-based — intercepts <code>fetch()</code> and <code>XMLHttpRequest</code>.
    </DocParagraph>
    <DiagramFrame caption="Static skips the network entirely; Dynamic hits it first, then transforms.">
      <MockFlowDiagram />
    </DiagramFrame>

    <Anchor id="mock-static">
      <ActionHeading title="Static response" engine="script" />
      <DocParagraph>
        Returns a fixed body with full control over the synthetic response — status code, Content-Type, and any
        additional response headers (Set-Cookie, CORS headers, custom flags). The real request is never made. Useful for
        offline development against a known fixture.
      </DocParagraph>
      <DiagramFrame caption="Server is never contacted — page receives the fixture as if it came from the wire.">
        <MockStaticDiagram />
      </DiagramFrame>
    </Anchor>

    <Anchor id="mock-dynamic">
      <ActionHeading title="Dynamic response" engine="script" />
      <DocParagraph>
        The real request is made first. Your function receives the response and request context, then returns the
        modified response. The function receives <code>{'{ status, body, bodyAsJson, url, method }'}</code>.
      </DocParagraph>
      <DocParagraph>
        Status code, Content-Type, and response-header fields set on the rule still apply on top of the function's
        return value, so you can mutate the body while letting the rule control wrapper headers.
      </DocParagraph>
      <DiagramFrame caption="Real call happens first; the function rewrites whatever comes back.">
        <MockDynamicDiagram />
      </DiagramFrame>
    </Anchor>

    <DiagramFrame caption="Static resources and page navigations never enter the script intercept.">
      <MockWontApplyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Offline development against a fixture, simulating specific error responses, redacting PII before it reaches the
      page, and exercising edge-case payload shapes that are hard to reproduce against a real backend.
    </DocParagraph>
    <DiagramFrame caption="Four typical patterns — pick Static for fixtures, Dynamic for real-data transforms.">
      <MockUseCasesDiagram />
    </DiagramFrame>
  </>
);
