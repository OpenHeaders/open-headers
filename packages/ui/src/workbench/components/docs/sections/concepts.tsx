import { Tag } from 'antd';
import type React from 'react';
import {
  DirectVsIndirectDiagram,
  ExecutionDnrReachDiagram,
  ExecutionScriptReachDiagram,
  ExecutionStackDiagram,
  LimitationsOverviewDiagram,
  LivePillAggregationDiagram,
  LiveWorkflowFreshnessDiagram,
  MultiTabLocalDiagram,
  MultiTabNavigationDiagram,
  MultiTabNumberingDiagram,
  MultiTabSyncDiagram,
  MultiTabSyncedDiagram,
  PermissionsAuditFlowDiagram,
  PermissionsImpactDiagram,
  RESOURCE_TYPE_ICONS,
  RequestExecutorOutcomesDiagram,
  RequestExecutorScopeDiagram,
  RequestTrackingDiagram,
  RequestTrackingPhasesDiagram,
  RequestTrackingUiDiagram,
  RulesCapacityDiagram,
  RulesPipelineDiagram,
  SyncLifecycleDiagram,
  SyncTopologyDiagram,
  SystemStatusPopoverDiagram,
  SystemStatusPopupSurfaceDiagram,
  SystemStatusWorkbenchSurfaceDiagram,
  SystemStatusWorstLevelDiagram,
  VaultDriftDetailDiagram,
  VaultHydrationDiagram,
} from '../diagrams';
import {
  Callout,
  DiagramFrame,
  DocHeading,
  DocLink,
  DocParagraph,
  EngineTag,
  StateRow,
  SurfaceContext,
} from '../shared';

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

export const ResourceTypeTable: React.FC = () => (
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
      your machine. The link is loopback-only (<code>127.0.0.1:8137</code>) and carries dynamic variables, team
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
      The desktop app is in development and ships after the extension stabilizes. Workspaces, variables, and team
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
