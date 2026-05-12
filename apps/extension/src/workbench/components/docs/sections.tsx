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
  ComparisonMatrixDiagram,
  ConditionsHostVsOriginDiagram,
  ConditionsMatchingDiagram,
  ConditionsRuleFiresDiagram,
  DelayNavDiagram,
  DelayRoutingDiagram,
  DelayUseCasesDiagram,
  DelayWontApplyDiagram,
  DelayXhrDiagram,
  DirectVsIndirectDiagram,
  DomainTypeDiagram,
  ExcludeDomainsDiagram,
  ExecutionDnrReachDiagram,
  ExecutionScriptReachDiagram,
  ExecutionStackDiagram,
  HeaderOpsDiagram,
  HeadersConditionDiagram,
  InitiatorDomainsDiagram,
  InjectCssDiagram,
  InjectScriptDiagram,
  InjectTimingDiagram,
  InjectUseCasesDiagram,
  InjectWontApplyDiagram,
  KeyboardRegionsDiagram,
  LimitationsOverviewDiagram,
  LivePillAggregationDiagram,
  LiveWorkflowFreshnessDiagram,
  MergeDiagram,
  MergeWontApplyDiagram,
  MethodsDiagram,
  MockDynamicDiagram,
  MockFlowDiagram,
  MockStaticDiagram,
  MockUseCasesDiagram,
  MockWontApplyDiagram,
  MultiTabLocalDiagram,
  MultiTabNavigationDiagram,
  MultiTabNumberingDiagram,
  MultiTabSyncDiagram,
  MultiTabSyncedDiagram,
  OverrideDiagram,
  OverrideWontApplyDiagram,
  ParadigmApiCatalogDiagram,
  ParadigmConvergenceDiagram,
  ParadigmFieldSyncDiagram,
  ParadigmFrontEndsDiagram,
  ParadigmLocalFirstDiagram,
  ParadigmRuleEngineDiagram,
  ParadigmShiftDiagram,
  PermissionsAuditFlowDiagram,
  PermissionsImpactDiagram,
  QueryParamAddReplaceDiagram,
  QueryParamRemoveAllDiagram,
  QueryParamRemoveDiagram,
  QueryParamReplaceOnlyDiagram,
  QueryParamUseCasesDiagram,
  QueryParamWontApplyDiagram,
  RESOURCE_TYPE_ICONS,
  RedirectRegexDiagram,
  RedirectStaticDiagram,
  RedirectUseCasesDiagram,
  RedirectWontApplyDiagram,
  RemoveDiagram,
  RemoveWontApplyDiagram,
  RequestDomainsDiagram,
  RequestExecutorOutcomesDiagram,
  RequestExecutorScopeDiagram,
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
  ResourceTypesAnatomyDiagram,
  ResourceTypesDiagram,
  RoadmapMilestonesDiagram,
  RulesCapacityDiagram,
  RulesPipelineDiagram,
  SyncLifecycleDiagram,
  SyncTopologyDiagram,
  SystemStatusPopoverDiagram,
  SystemStatusPopupSurfaceDiagram,
  SystemStatusWorkbenchSurfaceDiagram,
  SystemStatusWorstLevelDiagram,
  UrlPatternDiagram,
  UrlRegexDiagram,
  VaultDriftDetailDiagram,
  VaultHydrationDiagram,
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
  OnThisPage,
  StateRow,
  SurfaceContext,
} from './shared';

// ── Open Headers: What do we do (differently) ───────────────────

export const ParadigmSection: React.FC = () => (
  <>
    <DiagramFrame>
      <ParadigmShiftDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Everything in one extension</DocHeading>
    <DocParagraph>
      Three product categories have historically split this surface area between them: desktop proxies handle HTTP
      interception, cloud API platforms hold your requests and collections, and lightweight header extensions cover the
      "just rewrite one header" case. None of them ships the others. Open Headers does — inside a single browser
      extension, with one workspace store powering every surface.
    </DocParagraph>
    <DiagramFrame caption="Three legacy categories converge into one install. Nobody else ships this combination inside the extension.">
      <ParadigmConvergenceDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Enterprise-grade rule engine</DocHeading>
    <DocParagraph>
      The rule engine isn't a single trick stretched across nine UIs — it's two real execution paths with one shared
      language on top. <strong>DNR-native</strong> rules compile down to Chrome's <code>declarativeNetRequest</code>
      API and catch every browser-issued request (pages, sub-frames, fetch, XHR, images, fonts, scripts). The{' '}
      <strong>script engine</strong> picks up where DNR can't reach — value-merging headers, transforming bodies,
      mocking responses, injecting code, delaying calls. Both engines read the same condition language and the same five
      variable scopes, so a rule you wrote against DNR moves to the script engine by changing one action type.
    </DocParagraph>
    <DiagramFrame caption="Two execution paths, nine rule categories, one shared condition + variable language.">
      <ParadigmRuleEngineDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Full API request catalog</DocHeading>
    <DocParagraph>
      Every capability a desktop API client ships — request building, environments, OAuth 2.0 (including PKCE + Client
      Credentials + refresh), pre- and post-response scripts, multipart with content-addressed file blobs, collections +
      folders, GraphQL with schema introspection — lives inside the extension. Same workspace store as the rules, same
      five variable scopes, same surfaces. Bring your collections from another platform and keep working; nothing
      exports back out to a cloud you don't control.
    </DocParagraph>
    <DiagramFrame caption="The request editor, with protocol support, every auth type, scripts, files, and collections — inside the extension.">
      <ParadigmApiCatalogDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Local-first by design</DocHeading>
    <DocParagraph>
      "Local-first" is a posture, not a feature. The extension has no account system, no cloud relay, no telemetry
      endpoint, no background phone-home — and you have a real choice in <em>where</em> the back-end lives. Four hosting
      options, all local-only, all under your control: the in-browser service worker (today, zero setup), the desktop
      app's embedded back-end, a standalone local daemon serving every Open Headers surface on one machine, or a
      back-end you self-host on your own VM. Every option preserves the same guarantees; the trade-off is reach, not
      ownership.
    </DocParagraph>
    <DocParagraph>
      Cross-user cloud sync is explicitly off the roadmap. Team collaboration ships through user-controlled storage
      backends (Git, on the roadmap) — never through a vendor server.
    </DocParagraph>
    <DiagramFrame>
      <ParadigmLocalFirstDiagram />
    </DiagramFrame>

    <DocParagraph>
      The same principle applies to <em>how</em> you reach that data. The browser extension is the default front-end
      today — four surfaces inside the browser. A native desktop app, a CLI, and a remote web app follow on the
      roadmap. Every front-end speaks to a back-end of your choice; pick any combination, and every surface stays in
      sync.
    </DocParagraph>
    <DiagramFrame>
      <ParadigmFrontEndsDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Auto-Sync without losing your work</DocHeading>
    <DocParagraph>
      Cross-device sync is usually where local-first products fold and ask you to trust their cloud. Open Headers solves
      it at the <strong>per-field</strong> level: the popup toggling a rule's <code>enabled</code> flag and the
      workbench rewriting a header value in the same rule both land, in any order, with no stale-draft banner and no
      overwrite. The same approach scales from the four surfaces of one extension today to a local daemon backing
      extension + desktop + CLI tomorrow, and to multi-user team workspaces through a Git remote — without ever needing
      a vendor server in the middle.
    </DocParagraph>
    <DiagramFrame caption="Two surfaces, one rule, different fields — both edits land, nothing overwritten.">
      <ParadigmFieldSyncDiagram />
    </DiagramFrame>

    <Callout kind="note">
      Want to see how this compares to other tools you might have tried?{' '}
      <DocLink to="comparison">The comparison</DocLink> is next. Looking for what's coming? Skip to{' '}
      <DocLink to="roadmap">The roadmap</DocLink>.
    </Callout>
  </>
);

// ── Open Headers: The comparison ────────────────────────────────

export const ComparisonSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={[]} />
    <DocParagraph>
      The shortest version: Open Headers is what you'd build if you took the request-shaping power of a desktop proxy,
      the rule library of a cloud API platform, and the always-on surface of a header-only extension, and asked them to
      share a single store.
    </DocParagraph>
    <DiagramFrame caption="Three product categories, one set of trade-offs each — and where Open Headers lands.">
      <ComparisonMatrixDiagram />
    </DiagramFrame>

    <DocHeading level={3}>vs cloud API platforms</DocHeading>
    <DocParagraph>
      Cloud-hosted tools expect your traffic, credentials, and rule definitions to live on their servers. That model
      assumes you're fine with that data leaving your machine — and with maintaining an account to access your own work.
      Open Headers doesn't make either assumption. Everything stays local; team collaboration ships through
      user-controlled storage (Git, on the roadmap), not through a vendor's database.
    </DocParagraph>

    <DocHeading level={3}>vs desktop proxies</DocHeading>
    <DocParagraph>
      Proxies route your full traffic through a separate process. They're powerful but heavy: install a binary, install
      a CA certificate, configure each app to point at the proxy port. Open Headers uses Chrome's{' '}
      <code>declarativeNetRequest</code> API for static traffic and a per-page script engine for dynamic transforms. No
      proxy port, no CA cert, no per-app config — and matched rules apply with the page's own permissions, not a
      man-in-the-middle's.
    </DocParagraph>

    <DocHeading level={3}>vs header-only extensions</DocHeading>
    <DocParagraph>
      Header-only extensions handle exactly one rule type and stop there. Open Headers handles{' '}
      <DocLink to="header-actions">nine</DocLink> — header Add / Replace / Append / Remove / Merge,{' '}
      <DocLink to="block">Block</DocLink>, <DocLink to="redirect">Redirect</DocLink>,{' '}
      <DocLink to="query-param">Query Params</DocLink>, <DocLink to="inject">Inject</DocLink>,{' '}
      <DocLink to="delay">Delay</DocLink>, <DocLink to="body">Body</DocLink>, <DocLink to="mock">Mock</DocLink> — all
      driven by the same <DocLink to="conditions">condition language</DocLink>, all observable through the same{' '}
      <DocLink to="request-tracking">request-tracking</DocLink> surface.
    </DocParagraph>

    <Callout kind="tip" title="Why this matters in practice">
      Most workflows hit more than one of these categories. Mocking an API response, blocking a third-party tracker, and
      forcing a debug header onto one specific environment are three different rule types — three different installs in
      the legacy world. Here, they share one workspace.
    </Callout>
  </>
);

// ── Open Headers: The roadmap ───────────────────────────────────

export const RoadmapSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={[]} />
    <DocParagraph>
      Open Headers is local-only today, one extension on one device. The work below extends that shape without breaking
      it. Cross-user cloud sync is <strong>explicitly not on the roadmap</strong> — collaboration always ships through
      user-controlled storage backends.
    </DocParagraph>
    <DiagramFrame caption="Six milestones in sequence — local-only stays the product through every one of them.">
      <RoadmapMilestonesDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Team workspaces via Git</DocHeading>
    <DocParagraph>
      Workspaces serialize to YAML in a Git repository you control. Pull syncs; push shares; merge conflicts resolve
      through Git's existing tooling. No central server, no account, no vendor lock-in. Real-time presence is{' '}
      <code>git log</code> and <code>git blame</code> — durable, auditable, already understood.
    </DocParagraph>

    <DocHeading level={3}>Desktop app</DocHeading>
    <DocParagraph>
      A native binary that runs the same workspace store as the extension. Useful for surfaces an extension can't reach
      — system-level traffic shaping, multi-window editing, deeper filesystem integration. The two share the same
      on-disk format, so opening the desktop app on a workspace the extension owns is a read, not a migration.
    </DocParagraph>

    <DocHeading level={3}>Local / LAN daemon for cross-device sync</DocHeading>
    <DocParagraph>
      A sync daemon you can run on your machine, your LAN, or a tunneled host. Extension, desktop app, and CLI all
      become clients of the same daemon — same workspaces, same rules, same vault, across every device you use. The
      daemon stays on the local network; there is no opt-in cloud path layered on top.
    </DocParagraph>

    <DocHeading level={3}>CLI</DocHeading>
    <DocParagraph>
      Headless scripting and CI integration. List rules, toggle environments, run a single saved request from the shell,
      diff a workspace against another. The CLI talks to the same daemon as the extension and desktop app, so automation
      stays in sync with what you see in the UI.
    </DocParagraph>

    <DocHeading level={3}>Self-hosted web app</DocHeading>
    <DocParagraph>
      The same UI shipped as a web bundle you can serve from your own origin. For locked-down corporate browsers, kiosk
      devices, or any environment where installing an extension isn't an option — and for users who want a branded
      deployment of Open Headers under their own domain.
    </DocParagraph>

    <DocHeading level={3}>More importers</DocHeading>
    <DocParagraph>
      Beyond the existing cURL / HAR / Postman importers: Insomnia collections, OpenAPI specs, and full HAR request
      imports (not just headers). Importer parity is how Open Headers earns adoption from people already invested in
      another tool — bring your collection across in one step, keep working.
    </DocParagraph>

    <Callout kind="note" title="Not on the roadmap">
      A cloud-hosted backend for team collaboration. The local-only stance is a design decision, not a phase. If you
      need a feature that fundamentally requires a vendor server, Open Headers is the wrong tool — and we'd rather be
      honest about that than ship the feature and quietly compromise the product's posture.
    </Callout>
  </>
);

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
    {RESOURCE_TYPES.map(({ tag, code, color, desc, examples }) => {
      const Icon = RESOURCE_TYPE_ICONS[code];
      return (
        <div
          key={code}
          style={{
            padding: '8px 10px',
            borderRadius: 4,
            background: 'var(--ant-color-fill-quaternary)',
            fontSize: 12,
            lineHeight: 1.6,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {Icon ? (
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <Icon size={36} />
            </div>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
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
        </div>
      );
    })}
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
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
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
    <SurfaceContext surfaces={['workbench', 'devtools']} />
    <DocParagraph>
      Multiple workspace tabs open at once is a first-class state. Persisted data syncs through{' '}
      <code>chrome.storage</code>, layout state stays per-tab, and navigation intents reuse existing tabs in the same
      window before opening new ones.
    </DocParagraph>
    <DiagramFrame caption="Tab A saves, the SW broadcasts, Tab B re-hydrates. Layout state stays in each tab.">
      <MultiTabSyncDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Navigation reuses existing tabs</DocHeading>
    <DocParagraph>
      Same-window first: if a workspace tab is already open in the window you're clicking from, it activates and
      receives the intent (docs section to scroll to, rule to edit). Different window: a fresh tab opens in your current
      window rather than pulling focus across Chrome windows — mirroring how Chrome's own DevTools works, with one panel
      per window.
    </DocParagraph>
    <DiagramFrame caption="Warm path activates the same-window tab; cold path opens a new tab in the caller's window.">
      <MultiTabNavigationDiagram />
    </DiagramFrame>

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
    <DiagramFrame caption="Survivors keep their numbers across closes; the next tab is always max + 1.">
      <MultiTabNumberingDiagram />
    </DiagramFrame>

    <DocHeading level={3}>What syncs, what doesn't</DocHeading>
    <DocParagraph>
      Every persisted entity — rules, collections, folders, environments, workspace variables, vault, requests,
      templates — lives in <code>chrome.storage.local</code> as the single source of truth. Saves in tab A broadcast
      through the background and tab B re-hydrates. Workspace and environment switches propagate the same way.
    </DocParagraph>
    <DiagramFrame caption="One shared chrome.storage; both tabs read and write the same persisted data.">
      <MultiTabSyncedDiagram />
    </DiagramFrame>
    <DiagramFrame caption="Layout drags and unsaved typing live in each tab — the other tab never sees them.">
      <MultiTabLocalDiagram />
    </DiagramFrame>
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
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      <strong>System status</strong> is a live snapshot of the extension's health. The workbench footer shows it as a
      six-pill row — one pill per subsystem, each with its own colored dot. The popup and side-panel collapse it down to
      a single <code>● System status</code> entry in their bottom footer, with the dot's color tracking the worst-state
      subsystem.
    </DocParagraph>
    <DiagramFrame caption="In the workbench, the row sits in the footer with one pill per subsystem.">
      <SystemStatusWorkbenchSurfaceDiagram />
    </DiagramFrame>
    <DiagramFrame caption="Click the toolbar icon, and the same status surfaces as a single labeled pill in the popup's footer.">
      <SystemStatusPopupSurfaceDiagram />
    </DiagramFrame>
    <DocParagraph>
      Each subsystem reports a single state and the worst level wins: red &gt; yellow &gt; green. One red anywhere flips
      the composite dot red.
    </DocParagraph>
    <DiagramFrame caption="Six subsystem states fold into one composite via max — red beats yellow beats green.">
      <SystemStatusWorstLevelDiagram />
    </DiagramFrame>
    <DocParagraph>
      Clicking any pill opens the same details popover. Rows come in two groups: grey first (no events yet this
      service-worker lifetime) and colored after (have reported at least once). Within each group the canonical
      subsystem order is preserved. Full history lives in the Observability log — export from{' '}
      <strong>Settings → Data → Export Diagnostic Log</strong>.
    </DocParagraph>
    <DiagramFrame caption="Greys above the divider, coloreds below; on first report a row migrates once.">
      <SystemStatusPopoverDiagram />
    </DiagramFrame>

    <SubsystemHeading name="Sync" subtitle="Desktop-app connection" />
    <DocParagraph>
      Mirrors the WebSocket connection between the extension's service worker and the OpenHeaders desktop app running on
      your machine. The link is loopback-only (<code>127.0.0.1:59210</code>) and carries dynamic variables, team
      workspace data, and presence — nothing leaves your device.
    </DocParagraph>
    <DiagramFrame caption="Single WebSocket between the extension and the desktop app on localhost.">
      <SyncTopologyDiagram />
    </DiagramFrame>
    <DocParagraph>
      The pill reflects the live connection state. A drop triggers exponential-backoff reconnects; periodic pings detect
      silent disconnects behind strict corporate proxies.
    </DocParagraph>
    <DiagramFrame caption="Disabled and Connected are green; Connecting, Reconnecting, and URL rejected are yellow.">
      <SyncLifecycleDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      <strong>Connected to desktop</strong> (handshake succeeded) or <strong>Desktop sync disabled</strong>{' '}
      (auto-connect off).
    </StateRow>
    <StateRow color="warning" label="yellow">
      <strong>Connecting…</strong> / <strong>Reconnecting (attempt N)</strong>, or{' '}
      <strong>Desktop URL rejected by settings</strong>.
    </StateRow>
    <StateRow color="error" label="red">
      Reserved for fatal desktop-sync failures; no code path emits this today.
    </StateRow>

    <SubsystemHeading name="Rules" subtitle="declarativeNetRequest engine" />
    <DocParagraph>
      Reports on every DNR rebuild. Every save runs your rule through four stages before it goes live: compile to DNR
      JSON, resolve <code>{'{{VAR}}'}</code> references, enforce the active-rule cap, then apply through Chrome's
      <code> declarativeNetRequest</code> API. Each stage can flip the pill.
    </DocParagraph>
    <DiagramFrame caption="Four stages — each can emit a Status level if it goes sideways.">
      <RulesPipelineDiagram />
    </DiagramFrame>
    <DocParagraph>
      The active-rule count maps to a state on a three-zone capacity bar. Rules over the cap are dropped in match-order
      (top wins), and the yellow message carries the dropped count.
    </DocParagraph>
    <DiagramFrame caption="Green up to the warn threshold, yellow up to the cap, red beyond — but truncation keeps you out of the red zone at runtime.">
      <RulesCapacityDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      <strong>N active DNR rule(s)</strong> or <strong>Rule execution paused</strong>.
    </StateRow>
    <StateRow color="warning" label="yellow">
      Unresolved <code>{'{{VAR}}'}</code> references (<em>N unresolved variables in M rules</em>), the rule cap was
      exceeded (<em>Dropped N rules over cap</em>), or you're approaching DNR capacity (
      <em>Approaching DNR capacity (N ≥ threshold)</em>).
    </StateRow>
    <StateRow color="error" label="red">
      Transport failure — Chrome rejected the dynamic or session rule update (
      <em>Failed to apply [dynamic|session] DNR rules</em>).
    </StateRow>

    <SubsystemHeading name="Requests" subtitle="API request executor" />
    <DocParagraph>
      Reflects the last ad-hoc API request fired from the Request editor's <strong>Send</strong> button. The pill flips
      green for <em>any</em> HTTP response — including 4xx and 5xx — because "the request completed" is a separate
      question from "the server liked it." Only network-level failures with no response turn it yellow.
    </DocParagraph>
    <DiagramFrame caption="Any status code = green. Yellow is reserved for failures with no response back.">
      <RequestExecutorOutcomesDiagram />
    </DiagramFrame>
    <DocParagraph>
      Background traffic doesn't update this pill: Live workflow refreshes pass <code>silentStatus: true</code>, and
      webpage requests flow through the Rules engine, not the executor.
    </DocParagraph>
    <DiagramFrame caption="Only ad-hoc Send-button traffic shapes this pill — everything else stays quiet.">
      <RequestExecutorScopeDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      <strong>Last request: {'<status> <statusText>'}</strong> — any HTTP response (e.g. <em>200 OK</em>,{' '}
      <em>404 Not Found</em>, <em>500 Server Error</em>).
    </StateRow>
    <StateRow color="warning" label="yellow">
      <strong>Last request failed: {'<message>'}</strong> — network-level failure before a response (e.g.{' '}
      <em>NetworkError</em>, <em>Aborted</em>, offline/DNS).
    </StateRow>

    <SubsystemHeading name="Permissions" subtitle="Host permissions audit" />
    <DocParagraph>
      DNR rules and content scripts targeting a host that's been revoked from <code>chrome://extensions</code> don't
      error — they silently no-op. This audit's whole job is to surface that hidden state, since otherwise you'd spend
      30 minutes debugging a rule that <em>looks</em> fine.
    </DocParagraph>
    <DiagramFrame caption="Granted: the rule fires. Narrowed: the rule silently no-ops and the header never arrives.">
      <PermissionsImpactDiagram />
    </DiagramFrame>
    <DocParagraph>
      The audit polls <code>chrome.permissions.contains({"{ origins: ['<all_urls>'] }"})</code> on every service-worker
      wake. MV3 has no permission-change observer in Chromium, so poll-on-wake is the cheapest signal we can get.
    </DocParagraph>
    <DiagramFrame caption="One call, three branches — green for granted, red for narrowed, yellow if the API call itself fails.">
      <PermissionsAuditFlowDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      <strong>All host permissions granted</strong> — <code>&lt;all_urls&gt;</code> is still in scope.
    </StateRow>
    <StateRow color="warning" label="yellow">
      <strong>Could not audit host permissions</strong> — unusual; the browser didn't expose{' '}
      <code>chrome.permissions</code>.
    </StateRow>
    <StateRow color="error" label="red">
      <strong>Host permissions narrowed</strong> — some rules will silently no-op on revoked hosts until access is
      restored from <code>chrome://extensions</code>.
    </StateRow>

    <SubsystemHeading name="Secrets" subtitle="Vault integrity" />
    <DocParagraph>
      Tracks the per-workspace encrypted vault blob in <code>chrome.storage.local</code>. On every service-worker wake,
      each stored secret is validated against the current schema; entries that fail validation are dropped from the
      in-memory vault and the pill flips yellow until they're re-saved.
    </DocParagraph>
    <DiagramFrame caption="Hydrate loads the blob; the schema validator keeps matches, drops drifts, and reports yellow.">
      <VaultHydrationDiagram />
    </DiagramFrame>
    <DocParagraph>
      "Drift" usually means a stored entry was written by an older build (missing a field that's now required, or a
      field with the wrong type). The validator's job is to fail loud — silently inheriting unknown shapes is what
      causes the bug six versions later.
    </DocParagraph>
    <DiagramFrame caption="Same two fields side by side: a valid entry vs a drift entry with a missing cipher and a wrongly-typed createdAt.">
      <VaultDriftDetailDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      Default — no schema-drift events this service-worker lifetime.
    </StateRow>
    <StateRow color="warning" label="yellow">
      <strong>Schema drift: dropped entry from {'<storageKey>'}</strong> — at least one stored vault entry didn't match
      the current shape and was dropped on hydrate. Re-saving from the Vault editor restores it.
    </StateRow>
    <StateRow color="error" label="red">
      Reserved for cipher decrypt failures; no code path emits this today.
    </StateRow>

    <SubsystemHeading name="Live" subtitle="Live Variable workflow refresh" />
    <DocParagraph>
      Each Live workflow refreshes on its own cadence. Per-workflow state turns on three checks: whether the last
      extractor succeeded, whether the run is within <code>2×</code> its cadence, and how many failures it's had in a
      row. The three states fold into the pill via "worst wins".
    </DocParagraph>
    <DiagramFrame caption="Fresh = clean run · stale = past 2× cadence or 1–4 failures · failing = ≥ 5 consecutive failures.">
      <LiveWorkflowFreshnessDiagram />
    </DiagramFrame>
    <DocParagraph>
      Only the <strong>active workspace's</strong> workflows contribute. Inactive workspaces are excluded — you can't
      see or act on those rules right now, so pilling on them would surface noise you can't reach. Switching workspaces
      recomputes the pill against the new active set.
    </DocParagraph>
    <DiagramFrame caption="Active-workspace workflows fold into one pill via max(); other workspaces are skipped.">
      <LivePillAggregationDiagram />
    </DiagramFrame>
    <StateRow color="success" label="green">
      <strong>N workflows fresh</strong> — every active-workspace workflow's last run was OK and within 2× its cadence.
      Also shown as <strong>No workflows configured</strong> when there are none.
    </StateRow>
    <StateRow color="warning" label="yellow">
      <strong>N workflows stale or failing</strong> — at least one run is past 2× cadence, the last extractor failed, or
      there are 1–4 consecutive failures.
    </StateRow>
    <StateRow color="error" label="red">
      <strong>N workflows failing (5+ consecutive)</strong> — any single workflow crossed five consecutive failures and
      is now considered failing.
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
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Quick reference for behaviors that surprise people. Each item is also called out inline in the section it affects.
    </DocParagraph>
    <DiagramFrame caption="Four common gotchas at a glance — each callout below has the details.">
      <LimitationsOverviewDiagram />
    </DiagramFrame>
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
    <DiagramFrame caption="Each condition checks one request attribute. All must match for the rule to fire.">
      <ConditionsMatchingDiagram />
    </DiagramFrame>
    <DiagramFrame caption="Once all conditions match, the rule's action runs and the outgoing request is modified.">
      <ConditionsRuleFiresDiagram />
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

// ── Reference: Resource Types ────────────────────────────────────

export const ResourceTypesSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['popup', 'side-panel', 'workbench', 'devtools']} />
    <DocParagraph>
      Reference for Chrome's <code>ResourceType</code> values surfaced by request tracking and the Resource Types
      condition. Each label maps to a single underlying type — there's no overlap between rows.
    </DocParagraph>
    <DiagramFrame caption="What kind of request lands in which ResourceType — at a glance.">
      <ResourceTypesAnatomyDiagram />
    </DiagramFrame>
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
      <SurfaceContext surfaces={['workbench']} />
      <DocParagraph>
        Press <code>?</code> anytime to jump here. Shortcuts use{' '}
        <strong>{/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ Cmd' : 'Ctrl'}</strong> as the modifier key.
      </DocParagraph>
      <DiagramFrame caption="Four chords park your focus in one of four shell regions.">
        <KeyboardRegionsDiagram />
      </DiagramFrame>
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
