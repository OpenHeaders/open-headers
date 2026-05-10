/**
 * Docs panel sections — one named export per top-level section.
 *
 * Sections are pure render — no state, no effects. The DocsPanel
 * shell decides which one to mount based on the current section
 * id; a section's job is just to lay out its content.
 *
 * Sub-anchors (e.g. `doc-url-pattern` inside `conditions`) use the
 * shared `<Anchor>` helper so the panel can scroll to them after
 * mounting the section.
 */

import { Card, Tag, theme } from 'antd';
import type React from 'react';
import { SHORTCUTS, useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import {
  BodyInterceptDiagram,
  ConditionsUrlAnatomyDiagram,
  DelayRoutingDiagram,
  DirectVsIndirectDiagram,
  ExecutionDnrReachDiagram,
  ExecutionScriptReachDiagram,
  ExecutionStackDiagram,
  HeaderOpsDiagram,
  InjectTimingDiagram,
  MockFlowDiagram,
  MultiTabSyncDiagram,
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
} from './diagrams';
import {
  Anchor,
  BrowserTag,
  Callout,
  DiagramFrame,
  DocHeading,
  DocLink,
  DocParagraph,
  EngineTag,
  Example,
  OnThisPage,
  StateRow,
  SurfaceContext,
} from './shared';

// ── Concepts: Request Tracking ───────────────────────────────────

export const RequestTrackingSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel']} />
    <DocParagraph>
      The <strong>This Page</strong> tab in the popup shows which rules are active for the current page and which
      requests they matched. Tracking spans both request and response phases of every connection the page makes.
    </DocParagraph>
    <DiagramFrame caption="A single connection has two phases — both contribute to the badge count.">
      <RequestTrackingPhasesDiagram />
    </DiagramFrame>

    <DocHeading level={3}>How it works</DocHeading>
    <DocParagraph>
      The extension observes HTTP requests via the <code>webRequest</code> API. When a request URL matches a rule's
      conditions (domains, URL pattern, or URL regex), it's recorded with its resource type. Recording happens live
      inside the service worker; the popup just reads that record back when you open the <strong>This Page</strong> tab.
    </DocParagraph>
    <DiagramFrame caption="Browser fires webRequest events; the extension matches and records; the popup reads later.">
      <RequestTrackingDiagram />
    </DiagramFrame>
    <DocParagraph>
      Each matched rule shows a numbered badge equal to how many requests it matched. Click the badge to expand into a
      list of timestamps, URLs, resource types, and the pattern that matched.
    </DocParagraph>
    <DiagramFrame caption="The badge collapses the count; clicking it reveals the full match list.">
      <RequestTrackingUiDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Direct vs indirect matches</DocHeading>
    <DocParagraph>
      A <strong>direct</strong> match means the page URL itself matched. An <strong>indirect</strong> match means only a
      sub-resource — script, stylesheet, XHR, image, font — matched while the page URL didn't. The same rule can produce
      either kind depending on which page you're on.
    </DocParagraph>
    <DiagramFrame caption="One rule, two page contexts. Green = matched. Dashed = excluded.">
      <DirectVsIndirectDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Resource types</DocHeading>
    <DocParagraph>
      Each matched request carries its Chrome <code>ResourceType</code> — Page, Frame, Fetch/XHR, Script, CSS, Image,
      Font, Media, WebSocket, Ping, or Other. See the <DocLink to="resource-types">Resource types</DocLink> reference
      page for the full mapping with examples.
    </DocParagraph>
  </>
);

const ResourceTypeTable: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      marginTop: 4,
      marginBottom: 8,
    }}
  >
    {RESOURCE_TYPES.map(({ tag, code, color, desc, examples }) => (
      <div
        key={code}
        style={{
          padding: '8px 10px',
          borderRadius: 4,
          background: 'var(--ant-color-fill-quaternary)',
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <strong>{tag}</strong>
          <Tag color={color} style={{ fontSize: 10, margin: 0 }}>
            {code}
          </Tag>
        </div>
        <div style={{ color: 'var(--ant-color-text-secondary)' }}>{desc}</div>
        <div
          style={{
            marginTop: 4,
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'var(--ant-color-text-tertiary)',
          }}
        >
          {examples.map((ex, i) => (
            <code
              key={i}
              style={{
                display: 'block',
                paddingLeft: 8,
                opacity: 0.85,
                whiteSpace: 'pre',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {ex}
            </code>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const RESOURCE_TYPES = [
  {
    tag: 'Page',
    code: 'main_frame',
    color: 'blue',
    desc: 'Top-level document navigation — the URL shown in the address bar.',
    examples: ['https://openheaders.io/', 'https://openheaders.io/docs/getting-started'],
  },
  {
    tag: 'Frame',
    code: 'sub_frame',
    color: 'cyan',
    desc: 'An iframe or nested frame embedded within the page.',
    examples: ['<iframe src="https://ads.openheaders.io/banner">', '<iframe src="https://player.vimeo.com/video/123">'],
  },
  {
    tag: 'Fetch/XHR',
    code: 'xmlhttprequest',
    color: 'green',
    desc: 'API calls via fetch() or XMLHttpRequest. Chrome reports both as the same type — there is no way to distinguish them.',
    examples: ['fetch("/api/v1/users")', 'new XMLHttpRequest(); xhr.open("GET", "/api/data")'],
  },
  {
    tag: 'Script',
    code: 'script',
    color: 'orange',
    desc: 'JavaScript files loaded by the page.',
    examples: ['<script src="/js/app.bundle.js">', 'import("/modules/analytics.js")'],
  },
  {
    tag: 'CSS',
    code: 'stylesheet',
    color: 'purple',
    desc: 'Stylesheets loaded by the page.',
    examples: ['<link rel="stylesheet" href="/css/main.css">', '@import url("https://fonts.googleapis.com/css2?...")'],
  },
  {
    tag: 'Image',
    code: 'image',
    color: 'magenta',
    desc: 'Images loaded by the page or its styles.',
    examples: ['<img src="/logo.png">', 'background-image: url("/hero.webp")'],
  },
  {
    tag: 'Font',
    code: 'font',
    color: 'volcano',
    desc: 'Web fonts loaded via @font-face rules.',
    examples: ['@font-face { src: url("/fonts/Inter.woff2") }', 'fonts.gstatic.com/s/roboto/v30/...woff2'],
  },
  {
    tag: 'Media',
    code: 'media',
    color: 'gold',
    desc: 'Audio or video resources.',
    examples: ['<video src="/trailer.mp4">', '<audio src="/podcast-ep1.mp3">'],
  },
  {
    tag: 'WebSocket',
    code: 'websocket',
    color: 'lime',
    desc: 'WebSocket handshake — the initial HTTP upgrade request. Only the handshake is tracked, not individual messages.',
    examples: ['new WebSocket("wss://ws.openheaders.io/live")', 'new WebSocket("ws://localhost:59510")'],
  },
  {
    tag: 'Ping',
    code: 'ping',
    color: 'geekblue',
    desc: 'Beacon and ping requests typically used for analytics/tracking.',
    examples: ['navigator.sendBeacon("/analytics", data)', '<a ping="/track/click" href="...">'],
  },
  {
    tag: 'Other',
    code: 'other',
    color: 'default',
    desc: "Anything that doesn't fit the above categories.",
    examples: ['<link rel="icon" href="/favicon.ico">', '<link rel="manifest" href="/site.webmanifest">'],
  },
] as const;

// ── Concepts: Execution (DNR vs Script) ──────────────────────────

export const ExecutionSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench']} />
    <DocParagraph>
      Rules execute through one of two engines depending on what they do. Knowing which path a rule travels explains
      where it applies — and where it cannot.
    </DocParagraph>
    <DiagramFrame caption="JS-initiated requests pass through Script then DNR. Static and navigation traffic bypass Script entirely.">
      <ExecutionStackDiagram />
    </DiagramFrame>

    <DocHeading level={3}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <EngineTag kind="dnr" /> Native, fast, broad reach
      </span>
    </DocHeading>
    <DocParagraph>
      Header Override / Append / Remove, Block, Redirect, and Query Param rules compile to{' '}
      <code>declarativeNetRequest</code> entries. Chrome applies them at the network layer, before any request leaves
      the browser.
    </DocParagraph>
    <DocParagraph>
      Reach is broad: pages, sub-frames, scripts, images, fonts, fetch, XHR — every request the browser makes on behalf
      of the page.
    </DocParagraph>
    <DiagramFrame caption="A single bordered list — DNR's reach is essentially universal.">
      <ExecutionDnrReachDiagram />
    </DiagramFrame>

    <DocHeading level={3}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <EngineTag kind="script" /> JS-context, narrow reach
      </span>
    </DocHeading>
    <DocParagraph>
      Inject, Delay, Request Body, API Response, and Header Merge rules work by monkey-patching <code>fetch()</code> and{' '}
      <code>XMLHttpRequest</code> from inside the page. They can transform JavaScript-initiated traffic in ways DNR
      can't express — including reading and rewriting response bodies, which DNR has no access to.
    </DocParagraph>
    <DiagramFrame caption="Two columns — what the script engine actually intercepts, and what slips through unchanged.">
      <ExecutionScriptReachDiagram />
    </DiagramFrame>
    <Callout kind="limitation">
      Static resources (<code>&lt;img&gt;</code>, <code>&lt;script&gt;</code>, <code>&lt;link&gt;</code>), page
      navigations, and browser-internal requests bypass this engine entirely. Use a DNR-based rule for those.
    </Callout>
  </>
);

// ── Concepts: Multi-tab Behavior ─────────────────────────────────

export const MultiTabSection: React.FC = () => (
  <>
    <DocParagraph>
      Multiple workspace tabs open at once is a first-class state. Persisted data syncs through{' '}
      <code>chrome.storage</code>, layout state stays per-tab, and navigation intents reuse existing tabs in the same
      window before opening new ones.
    </DocParagraph>
    <DiagramFrame caption="Data syncs through chrome.storage; layout state stays per-tab">
      <MultiTabSyncDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Navigation reuses existing tabs</DocHeading>
    <DocParagraph>
      Same-window first: if a workspace tab is already open in the window you're clicking from, it activates and
      receives the intent (docs section to scroll to, rule to edit). Different window: a fresh tab opens in your current
      window rather than pulling focus across Chrome windows — mirroring how Chrome's own DevTools works, with one panel
      per window.
    </DocParagraph>

    <DocHeading level={3}>Tab numbering</DocHeading>
    <DocParagraph>
      With two or more workspace tabs, each tab's title is prefixed with its ordinal — <code>#1 Open Headers</code>,{' '}
      <code>#2 Open Headers</code>, <code>#3 Open Headers</code>. When the count drops back to one, the survivor sheds
      its prefix.
    </DocParagraph>
    <DocParagraph>
      Ordinals are stable within a tab's lifetime: closing <code>#1</code> while <code>#2</code> and <code>#3</code>{' '}
      remain does not renumber survivors. The next tab opened gets <code>#4</code>; numbering resets to <code>#1</code>{' '}
      only after every workspace tab has closed.
    </DocParagraph>

    <DocHeading level={3}>What syncs, what doesn't</DocHeading>
    <DocParagraph>
      Every persisted entity — rules, collections, folders, environments, workspace variables, vault, requests,
      templates — lives in <code>chrome.storage.local</code> as the single source of truth. Saves in tab A broadcast
      through the background and tab B re-hydrates. Workspace and environment switches propagate the same way.
    </DocParagraph>
    <Callout kind="note" title="Layout does not live-sync">
      Pane ratios and tool-window dock state are per-workspace, but changes don't propagate to already-open tabs.
      Dragging a splitter in tab A leaves tab B untouched until reload — live layout sync would feel jarring while
      typing. A tab opened <em>after</em> the drag inherits the new layout.
    </Callout>
    <Callout kind="warn" title="Unsaved drafts are tab-local">
      Editor drafts live in their own tab's memory. If tab A saves the same rule tab B is editing, tab A wins the
      storage write — there's no cross-tab "modified, reload?" prompt today. Only matters when two tabs edit the same
      entity simultaneously.
    </Callout>
  </>
);

// ── Concepts: System Status ──────────────────────────────────────

const SubsystemHeading: React.FC<{ name: string; subtitle: string }> = ({ name, subtitle }) => (
  <DocHeading level={3}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
        {name}
      </Tag>
      <span>{subtitle}</span>
    </span>
  </DocHeading>
);

export const SystemStatusSection: React.FC = () => (
  <>
    <DocParagraph>
      The <strong>System status</strong> pill — in the workspace footer and the popup / sidepanel header — is a live
      snapshot of the extension's health. Each subsystem reports a single state and the worst level wins: red &gt;
      yellow &gt; green.
    </DocParagraph>
    <DocParagraph>
      Rows come in two groups: grey first (no events yet this service-worker lifetime) and colored after (have reported
      at least once). Full history lives in the Observability log — export from{' '}
      <strong>Settings → Data → Export Diagnostic Log</strong>.
    </DocParagraph>

    <SubsystemHeading name="Sync" subtitle="Desktop-app connection" />
    <DocParagraph>Mirrors the WebSocket connection to the OpenHeaders desktop app.</DocParagraph>
    <StateRow color="success" label="green">
      Connected, or disabled on purpose (auto-connect off).
    </StateRow>
    <StateRow color="warning" label="yellow">
      Connecting, reconnecting, or the settings URL was rejected.
    </StateRow>
    <StateRow color="error" label="red">
      Reserved for fatal desktop-sync failures; not used today.
    </StateRow>

    <SubsystemHeading name="Rules" subtitle="declarativeNetRequest engine" />
    <DocParagraph>Reports on every DNR rebuild.</DocParagraph>
    <StateRow color="success" label="green">
      N active rules, or "Rule execution paused".
    </StateRow>
    <StateRow color="warning" label="yellow">
      Unresolved <code>{'{{VAR}}'}</code> references in the compiled set, rule cap exceeded, or approaching DNR
      capacity.
    </StateRow>
    <StateRow color="error" label="red">
      Transport failure — Chrome rejected the dynamic or session rule update.
    </StateRow>

    <SubsystemHeading name="Requests" subtitle="API request executor" />
    <DocParagraph>Reflects the last ad-hoc API request fired from the Request editor.</DocParagraph>
    <StateRow color="success" label="green">
      Last request returned a response.
    </StateRow>
    <StateRow color="warning" label="yellow">
      Last request failed before producing a response (network offline, DNS, abort).
    </StateRow>

    <SubsystemHeading name="Permissions" subtitle="Host permissions audit" />
    <DocParagraph>
      Audits <code>&lt;all_urls&gt;</code> on each service-worker wake.
    </DocParagraph>
    <StateRow color="success" label="green">
      All host permissions granted.
    </StateRow>
    <StateRow color="warning" label="yellow">
      Audit couldn't run — unusual; the browser didn't expose <code>chrome.permissions</code>.
    </StateRow>
    <StateRow color="error" label="red">
      Host permissions were narrowed from <code>chrome://extensions</code>. Rules targeting revoked hosts silently no-op
      until access is restored.
    </StateRow>

    <SubsystemHeading name="Secrets" subtitle="Vault integrity" />
    <DocParagraph>Tracks the per-workspace vault blob.</DocParagraph>
    <StateRow color="success" label="green">
      Vault healthy — last decrypt succeeded.
    </StateRow>
    <StateRow color="warning" label="yellow">
      Schema drift on hydrate — a stored vault entry didn't match the current shape and was dropped.
    </StateRow>
    <StateRow color="error" label="red">
      A cipher decrypt failed for a named secret. Sticks red until a subsequent successful read; reinstall or restore
      from backup if it persists.
    </StateRow>

    <Callout kind="note" title="Desktop App — product note">
      The v5 desktop app is in development and ships after the v5 extension stabilizes. Workspaces, variables, and team
      sync that integrate with the desktop app unlock then. The <strong>Sync</strong> subsystem flips from disabled to
      connecting automatically on first launch — no reinstall required.
    </Callout>
  </>
);

// ── Concepts: Limitations ────────────────────────────────────────

export const LimitationsSection: React.FC = () => (
  <>
    <DocParagraph>
      Quick reference for behaviors that surprise people. Each item is also called out inline in the section it affects.
    </DocParagraph>
    <Callout kind="limitation" title="Modified headers don't show in DevTools">
      Header actions are applied correctly but Chrome's Network tab still displays the original server headers.
    </Callout>
    <Callout kind="limitation" title="Script-based rules — narrow reach">
      Inject, Delay, Body, Mock, and Header Merge only intercept <code>fetch()</code> and <code>XMLHttpRequest</code>.
      Static resources and page navigations bypass them. See <em>How rules execute</em>.
    </Callout>
    <Callout kind="limitation" title="Merge can't read browser-default headers">
      The Merge operation only sees headers explicitly set by page code — Accept, User-Agent, and other browser-defaults
      are invisible to it.
    </Callout>
    <Callout kind="limitation" title="Header matching needs Chrome 128+">
      Conditions that match on request / response header values require Chrome 128 or newer. Older browsers ignore the
      condition silently.
    </Callout>
  </>
);

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
  { id: 'headers', title: 'Request / Response Headers' },
];

export const ConditionsSection: React.FC = () => (
  <>
    <DocParagraph>
      All conditions must match for a rule to fire (AND logic). Each condition maps directly to a Chrome{' '}
      <code>declarativeNetRequest</code> field.
    </DocParagraph>
    <DiagramFrame caption="Which slice of a URL each condition matches">
      <ConditionsUrlAnatomyDiagram />
    </DiagramFrame>
    <OnThisPage entries={CONDITION_ANCHORS} />

    <Anchor id="url-pattern">
      <Card title="URL Pattern" extra={<Tag color="blue">urlFilter</Tag>} style={{ marginBottom: 8 }}>
        Wildcard pattern on the full URL. Use <code>*</code> to match any characters. Protocol must be specified:{' '}
        <code>*://</code> for any, <code>https://</code> for HTTPS only.
        <Example
          rule="*://api.openheaders.io/*"
          after={['https://api.openheaders.io/v2/users', 'http://api.openheaders.io/health']}
          wontApply={[
            'https://other-site.com/api — different domain, only api.openheaders.io matches',
            'https://cdn.openheaders.io/img.png — cdn is a different subdomain than api',
            '→ Use Request Domains with openheaders.io to match all subdomains at once',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="url-regex">
      <Card title="URL Regex" extra={<Tag color="purple">regexFilter</Tag>} style={{ marginBottom: 8 }}>
        RE2 regular expression on the full URL including protocol. For complex matching. Cannot be combined with URL
        Pattern.
        <Example
          rule="^https://api\.openheaders\.io/v[0-9]+"
          after={['https://api.openheaders.io/v2', 'https://api.openheaders.io/v3']}
          wontApply={[
            'http://api.openheaders.io/v2 — regex specifies https:// only',
            'https://api.openheaders.io/latest — does not match /v[0-9]+',
            '→ Use ^https?:// to match both http and https',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="request-domains">
      <Card title="Request Domains" extra={<Tag color="green">requestDomains</Tag>} style={{ marginBottom: 8 }}>
        Matches the domain and ALL its subdomains automatically.
        <Example
          rule="openheaders.io"
          after={['openheaders.io', 'api.openheaders.io', 'cdn.openheaders.io']}
          wontApply={[
            'not-openheaders.io — different domain, not a subdomain',
            'openheaders.com — different TLD',
            '→ Add each domain separately or use URL Pattern for cross-domain matching',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="exclude-domains">
      <Card
        title="Exclude Domains"
        extra={<Tag color="warning">excludedRequestDomains</Tag>}
        style={{ marginBottom: 8 }}
      >
        Skip these domains even if other conditions match. Must be combined with Request Domains or other conditions —
        it only excludes, it doesn't match on its own.
        <Example
          rule="Request Domains: openheaders.io + Exclude: staging.openheaders.io"
          after={[
            'api.openheaders.io — matched by Request Domains, not excluded',
            'cdn.openheaders.io — matched, not excluded',
          ]}
          wontApply={[
            'staging.openheaders.io — matched by Request Domains but then excluded',
            '→ Remove the Exclude condition to apply to staging too',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="initiator-domains">
      <Card title="Initiator Domains" extra={<Tag>initiatorDomains</Tag>} style={{ marginBottom: 8 }}>
        Only match requests made FROM pages on this domain.
        <Example
          rule="portal.openheaders.io"
          after={['API call while browsing portal.openheaders.io']}
          wontApply={[
            'Same API call while browsing other-site.com',
            '→ Use Request Domains instead to match by destination, not origin',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="methods">
      <Card title="Methods" extra={<Tag>requestMethods</Tag>} style={{ marginBottom: 8 }}>
        Filter by HTTP method. Select specific methods to ignore others.
        <Example
          rule="GET, POST"
          after={['GET /api/users', 'POST /api/login']}
          wontApply={[
            'PUT /api/users/1 — method not selected',
            'DELETE /api/users/1 — method not selected',
            '→ Add more methods or remove this condition to match all methods',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="condition-resource-types">
      <Card title="Resource Types" extra={<Tag>resourceTypes</Tag>} style={{ marginBottom: 8 }}>
        Filter by what kind of resource is being loaded.
        <Example
          rule="xhr"
          after={["fetch('/api/data')", 'XMLHttpRequest calls']}
          wontApply={[
            'Page navigation (main_frame) — not xhr',
            '<img> loads, <script> loads, CSS loads',
            '→ Add "page" to also match page navigations',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="domain-type">
      <Card title="Domain Type" extra={<Tag>domainType</Tag>} style={{ marginBottom: 8 }}>
        First-party (same site) or third-party (cross-site). Useful for blocking trackers.
        <Example
          rule="thirdParty"
          after={['Requests to analytics.google.com (cross-site)', 'Requests to cdn.external.com (cross-site)']}
          wontApply={[
            'Requests to same domain the user is browsing',
            '→ Use "firstParty" to match same-site requests instead',
          ]}
        />
      </Card>
    </Anchor>

    <Anchor id="headers">
      <Card title="Request / Response Headers" extra={<BrowserTag min="chrome-128" />} style={{ marginBottom: 8 }}>
        Match requests that have a specific header with an exact value.
        <Example
          rule="Authorization = Bearer test-token"
          after={['Request with Authorization: Bearer test-token']}
          wontApply={[
            "Authorization: Bearer other-token — value doesn't match exactly",
            'Request without Authorization header — header must be present',
            'No wildcard or partial matching — Chrome only supports exact header name and exact value',
          ]}
        />
      </Card>
    </Anchor>
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
      <Example
        rule="Override X-Auth: Bearer token"
        before={['X-Auth: old-value']}
        after={['X-Auth: Bearer token']}
        wontApply={[
          'Request to a non-matching domain — conditions must match first',
          '→ Check Request Domains or URL Pattern conditions',
        ]}
      />
    </Anchor>

    <Anchor id="append">
      <ActionHeading title="Append" engine="dnr" />
      <DocParagraph>
        Adds a new header entry with the same name. The original stays — duplicate headers result. Use for Set-Cookie,
        Link, Via.
      </DocParagraph>
      <Example
        rule="Append Set-Cookie: tracking=xyz"
        before={['Set-Cookie: session=abc']}
        after={['Set-Cookie: session=abc', 'Set-Cookie: tracking=xyz']}
        wontApply={[
          "Headers that don't support duplicates (e.g. Authorization) — browser keeps only one",
          '→ Use Override to replace the value, or Merge to append to the existing value',
        ]}
      />
    </Anchor>

    <Anchor id="remove">
      <ActionHeading title="Remove" engine="dnr" />
      <DocParagraph>Deletes all instances of this header. No value needed.</DocParagraph>
      <Example
        rule="Remove X-Frame-Options"
        before={['X-Frame-Options: DENY', 'Content-Type: text/html']}
        after={['Content-Type: text/html']}
        wontApply={[
          'Header already absent — no-op, no error',
          '→ Use Override to change the value instead of removing entirely',
        ]}
      />
    </Anchor>

    <Anchor id="merge">
      <ActionHeading title="Merge" engine="script" />
      <DocParagraph>
        Reads the existing value at runtime and appends yours with a separator. Defaults to <code>{'; '}</code> for
        Cookie and <code>{', '}</code> for others. The separator can be empty for direct concatenation.
      </DocParagraph>
      <Example
        rule="Merge Cookie + new=val (sep: '; ')"
        before={['Cookie: session=abc']}
        after={['Cookie: session=abc; new=val']}
        wontApply={[
          'Page navigations — only fetch / XHR',
          'Static resources (img, script, link) — only JS-initiated requests',
          '→ For page-level headers, use Override or Append (DNR) instead',
        ]}
      />
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
    <Example
      rule="Block · Request Domains: ads.openheaders.io"
      after={['Any request to ads.openheaders.io fails with a network error']}
      wontApply={[
        'Already-loaded resources — only future requests are intercepted',
        '→ Reload the page after enabling the rule',
      ]}
    />

    <DocHeading level={3}>When to use this</DocHeading>
    <DocParagraph>
      Blocking ad / analytics / tracking domains, simulating outages for a single host, or denying access to one
      endpoint while leaving the rest of an API reachable. To block only the document of a page (not its sub-resources),
      add a Resource Type condition of <code>main_frame</code>.
    </DocParagraph>
    <Callout kind="note">
      Blocking a <code>main_frame</code> request renders an "ERR_BLOCKED_BY_CLIENT" page in Chrome. Sub-resource blocks
      happen silently — what the user sees depends on the page's own error handling.
    </Callout>
  </>
);

export const RedirectSection: React.FC = () => (
  <>
    <DocParagraph>
      Redirects matching requests to a different URL. Supports static URLs and regex capture groups.
    </DocParagraph>

    <Anchor id="redirect-url">
      <ActionHeading title="Static redirect" engine="dnr" />
      <DocParagraph>Enter a full URL to redirect every matching request to the same destination.</DocParagraph>
      <Example
        rule="https://openheaders.io/new-page"
        after={['All matching requests → https://openheaders.io/new-page']}
      />
    </Anchor>

    <Anchor id="redirect-regex">
      <ActionHeading title="Regex redirect" engine="dnr" />
      <DocParagraph>
        Pair with a URL Regex condition. Use <code>\1</code>, <code>\2</code>, etc. to reference capture groups in the
        destination URL.
      </DocParagraph>
      <Example
        rule="Condition: ^http://(openheaders\.io/.*)$  →  https://\1"
        before={['http://openheaders.io/page']}
        after={['https://openheaders.io/page']}
      />
    </Anchor>
  </>
);

export const QueryParamSection: React.FC = () => (
  <>
    <DocParagraph>
      Modify URL query parameters before the request leaves the browser. Compiles to a DNR <code>queryTransform</code>{' '}
      action.
    </DocParagraph>

    <Anchor id="qp-add">
      <ActionHeading title="Add / Replace" engine="dnr" />
      <DocParagraph>Adds the parameter if missing, or replaces its value if already present.</DocParagraph>
      <Example rule="debug = true" before={['?page=1']} after={['?page=1&debug=true']} />
    </Anchor>

    <Anchor id="qp-override">
      <ActionHeading title="Replace only" engine="dnr" />
      <DocParagraph>
        Replaces the value <strong>only when the parameter is already present</strong>. URLs without the param are left
        untouched. Use this to canonicalize a value (e.g. force <code>region=eu</code> on URLs already carrying any
        region) without injecting it into URLs that didn't have it.
      </DocParagraph>
      <Example rule="region = eu (override)" before={['?region=us', '?page=1']} after={['?region=eu', '?page=1']} />
    </Anchor>

    <Anchor id="qp-remove">
      <ActionHeading title="Remove" engine="dnr" />
      <DocParagraph>Removes specific parameters by name. The value is ignored.</DocParagraph>
      <Example rule="Remove utm_source" before={['?utm_source=google&page=1']} after={['?page=1']} />
    </Anchor>

    <Anchor id="qp-remove-all">
      <ActionHeading title="Remove all" engine="dnr" />
      <DocParagraph>
        Strips the entire query string. Can't be combined with Add / Replace in the same rule.
      </DocParagraph>
      <Example rule="Remove All" before={['?utm_source=google&page=1&debug=true']} after={['(no query string)']} />
    </Anchor>
  </>
);

export const InjectSection: React.FC = () => (
  <>
    <DocParagraph>
      Inject JavaScript or CSS into matching pages. Code runs in the page's context via a content script.
    </DocParagraph>
    <DiagramFrame caption="Insertion timing — pre-page-script vs DOM-safe">
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
      <Example
        rule="Script (ASAP): wrap fetch to log every call"
        after={['Every fetch() in the page logs URL + method to the console before the real call goes out']}
        wontApply={[
          'Sandboxed iframes that disable script execution',
          '→ Use a parent-page rule and post messages into the iframe instead',
        ]}
      />
    </Anchor>

    <Anchor id="inject-css">
      <ActionHeading title="CSS injection" engine="script" />
      <DocParagraph>
        Inject custom CSS as a <code>&lt;style&gt;</code> tag. Useful for dark-mode overrides, hiding noisy elements, or
        per-environment theming.
      </DocParagraph>
      <Example
        rule="CSS: header.banner { display: none }"
        after={['The .banner header is hidden on every matching page']}
      />
    </Anchor>
  </>
);

export const DelaySection: React.FC = () => (
  <>
    <DocParagraph>
      Adds artificial latency to matching requests. Three lanes run in parallel depending on the request kind.
    </DocParagraph>
    <DiagramFrame caption="Delay routing — three lanes for three request kinds">
      <DelayRoutingDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Document &amp; iframe navigations</DocHeading>
    <DocParagraph>
      Routed through a local waiting page. Honors delays up to <strong>30,000 ms</strong> — Chrome's DNR redirect
      ceiling.
    </DocParagraph>
    <Example
      rule="Delay 8000ms (page navigation)"
      after={['Page hangs on a waiting screen for 8 seconds before loading']}
    />

    <DocHeading level={3}>JS-initiated XHR / fetch</DocHeading>
    <DocParagraph>
      Intercepted by a <code>fetch()</code> / <code>XMLHttpRequest</code> monkey-patch. Capped at{' '}
      <strong>5,000 ms</strong> to avoid starving Chrome's HTTP connection pool — values above are clamped on the wire.
    </DocParagraph>
    <Example
      rule="Delay 3000ms (XHR)"
      after={['Each fetch() / XHR resolves 3 seconds later than it normally would']}
      wontApply={[
        'Service-worker fetches that bypass page-level monkey-patches',
        '→ Inject the patch in the service-worker scope if you control it',
      ]}
    />

    <DocHeading level={3}>Sub-resources</DocHeading>
    <DocParagraph>
      Images, scripts, stylesheets, fonts, and other passive resources are <strong>not delayed</strong>. They need a
      real local proxy that can hold the connection open and stream bytes — something an extension can't do.
    </DocParagraph>
    <Callout kind="limitation">
      Use a local desktop proxy if you specifically need to throttle static-resource loads.
    </Callout>
  </>
);

export const BodySection: React.FC = () => (
  <>
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
      <Example
        rule={`Static body: { "userId": "test-1" }`}
        before={[`Original POST body: { "userId": "abc" }`]}
        after={[`Body sent: { "userId": "test-1" }`]}
        wontApply={[
          'GET / HEAD requests — no body to replace',
          'Static resource loads — only JS-initiated fetch / XHR',
        ]}
      />
    </Anchor>

    <Anchor id="body-dynamic">
      <ActionHeading title="Dynamic body" engine="script" />
      <DocParagraph>
        Write a function that receives the original body and request context, then returns the modified body. The
        function receives <code>{'{ method, url, body, bodyAsJson }'}</code>.
      </DocParagraph>
      <Example
        rule="Dynamic body: stamp every payload with a debug flag"
        before={[`{ "userId": "abc" }`]}
        after={[`{ "userId": "abc", "debug": true }`]}
      />
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
      <Example
        rule={`GraphQL: operationName Equals "GetUser"  →  static body`}
        after={['Only POST /graphql with operationName="GetUser" gets the static-body substitution']}
      />
    </Anchor>
  </>
);

export const MockSection: React.FC = () => (
  <>
    <DocParagraph>
      Intercept API calls and return custom responses. Script-based — intercepts <code>fetch()</code> and{' '}
      <code>XMLHttpRequest</code>.
    </DocParagraph>
    <DiagramFrame caption="Static skips the network entirely; Dynamic hits it first, then transforms">
      <MockFlowDiagram />
    </DiagramFrame>

    <Anchor id="mock-static">
      <ActionHeading title="Static response" engine="script" />
      <DocParagraph>
        Returns a fixed body with full control over the synthetic response — status code, Content-Type, and any
        additional response headers (Set-Cookie, CORS headers, custom flags). The real request is never made. Useful for
        offline development against a known fixture.
      </DocParagraph>
      <Example
        rule={`Static response: 200 { "users": [] } (Content-Type: application/json)`}
        after={[`fetch("/api/users") resolves with { "users": [] } and never hits the server`]}
        wontApply={[
          'Static resource loads — only JS-initiated fetch / XHR',
          '→ Use a real local server / proxy for static-resource fixtures',
        ]}
      />
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
      <Example
        rule="Dynamic response: redact emails from JSON body"
        before={[`{ "user": { "email": "alice@openheaders.io" } }`]}
        after={[`{ "user": { "email": "[redacted]" } }`]}
      />
    </Anchor>
  </>
);

// ── Reference: Resource Types ────────────────────────────────────

export const ResourceTypesSection: React.FC = () => (
  <>
    <DocParagraph>
      Reference for Chrome's <code>ResourceType</code> values surfaced by request tracking and the Resource Types
      condition. Each label maps to a single underlying type — there's no overlap between rows.
    </DocParagraph>
    <ResourceTypeTable />
  </>
);

// ── Reference: Keyboard Shortcuts ────────────────────────────────

const ShortcutRow: React.FC<{ id: string; label: string; codeBg: string }> = ({ id, label, codeBg }) => {
  const chord = useShortcutLabel(id);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <code
        style={{
          fontSize: 11,
          padding: '1px 6px',
          background: codeBg,
          borderRadius: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {chord}
      </code>
    </div>
  );
};

export const KeyboardShortcutsSection: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <>
      <DocParagraph>
        Press <code>?</code> anytime to jump here. Shortcuts use{' '}
        <strong>{/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ Cmd' : 'Ctrl'}</strong> as the modifier key.
      </DocParagraph>
      {(['panels', 'tabs', 'navigation', 'actions'] as const).map((category) => {
        const items = SHORTCUTS.filter((s) => s.category === category);
        if (items.length === 0) return null;
        return (
          <Card
            key={category}
            size="small"
            style={{ marginBottom: 8 }}
            title={category.charAt(0).toUpperCase() + category.slice(1)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map((s) => (
                <ShortcutRow key={s.id} id={s.id} label={s.label} codeBg={token.colorFillQuaternary} />
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
};
