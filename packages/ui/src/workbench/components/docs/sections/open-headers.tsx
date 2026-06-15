import type React from 'react';
import {
  ComparisonMatrixDiagram,
  ComparisonVsCloudDiagram,
  ComparisonVsHeaderOnlyDiagram,
  ComparisonVsProxyDiagram,
  ParadigmApiCatalogDiagram,
  ParadigmConvergenceDiagram,
  ParadigmFieldSyncDiagram,
  ParadigmFrontEndsDiagram,
  ParadigmLocalFirstDiagram,
  ParadigmRuleEngineDiagram,
  ParadigmShiftDiagram,
  RoadmapCliDiagram,
  RoadmapDaemonDiagram,
  RoadmapDesktopAppDiagram,
  RoadmapGitWorkspacesDiagram,
  RoadmapImportersDiagram,
  RoadmapMcpArchitectureDiagram,
  RoadmapMcpToolsDiagram,
  RoadmapMilestonesDiagram,
  RoadmapWebAppDiagram,
} from '../diagrams';
import { Callout, DiagramFrame, DocHeading, DocLink, DocParagraph } from '../shared';

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
      Team collaboration ships through user-controlled storage
      backends (Git, on the roadmap) — not through a vendor server.
    </DocParagraph>
    <DiagramFrame>
      <ParadigmLocalFirstDiagram />
    </DiagramFrame>

    <DocParagraph>
      The same principle applies to <em>how</em> you reach that data. The browser extension is the default front-end
      today — four surfaces inside the browser. A native desktop app, a CLI, and a remote web app follow on the roadmap.
      Every front-end speaks to a back-end of your choice; pick any combination, and every surface stays in sync.
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
      <DocLink to="comparison">How we compare</DocLink> is next. Looking for what's coming? Skip to{' '}
      <DocLink to="roadmap">What we're building next</DocLink>.
    </Callout>
  </>
);

// ── Open Headers: The comparison ────────────────────────────────

export const ComparisonSection: React.FC = () => (
  <>
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
    <DiagramFrame>
      <ComparisonVsCloudDiagram />
    </DiagramFrame>

    <DocHeading level={3}>vs desktop proxies</DocHeading>
    <DocParagraph>
      Proxies route your full traffic through a separate process. They're powerful but heavy: install a binary, install
      a CA certificate, configure each app to point at the proxy port. Open Headers uses Chrome's{' '}
      <code>declarativeNetRequest</code> API for static traffic and a per-page script engine for dynamic transforms. No
      proxy port, no CA cert, no per-app config — and matched rules apply with the page's own permissions, not a
      man-in-the-middle's.
    </DocParagraph>
    <DiagramFrame>
      <ComparisonVsProxyDiagram />
    </DiagramFrame>

    <DocHeading level={3}>vs header-only extensions</DocHeading>
    <DocParagraph>
      Header-only extensions handle exactly one rule type and stop there. Open Headers handles{' '}
      <DocLink to="header-actions">nine</DocLink> — header Add / Replace / Append / Remove / Merge,{' '}
      <DocLink to="block">Block</DocLink>, <DocLink to="redirect">Redirect</DocLink>,{' '}
      <DocLink to="query-param">Query Params</DocLink>, <DocLink to="inject">Inject</DocLink>,{' '}
      <DocLink to="delay">Delay</DocLink>, <DocLink to="request-body">Request Body</DocLink>,{' '}
      <DocLink to="response">Response</DocLink> — all
      driven by the same <DocLink to="conditions">condition language</DocLink>, all observable through the same{' '}
      <DocLink to="request-tracking">request-tracking</DocLink> surface.
    </DocParagraph>
    <DiagramFrame>
      <ComparisonVsHeaderOnlyDiagram />
    </DiagramFrame>

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
    <DocParagraph>
      Open Headers is local-only today, one extension on one device. The work below extends that shape without breaking
      it. Cross-user sync ships through <strong>user-controlled</strong> means — Git repositories and self-hosted
      deployments — never a vendor-hosted cloud.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapMilestonesDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Workspace collaboration via Git (Team-ready)</DocHeading>
    <DocParagraph>
      Workspaces serialize to YAML in a Git repository you control. Pull syncs; push shares; merge conflicts resolve
      through Git's existing tooling. No central server, no account, no vendor lock-in. Real-time presence is{' '}
      <code>git log</code> and <code>git blame</code> — durable, auditable, already understood.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapGitWorkspacesDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Desktop app</DocHeading>
    <DocParagraph>
      A native binary that runs the same workspace store as the extension. Useful for surfaces an extension can't reach
      — system-level traffic shaping, multi-window editing, deeper filesystem integration. The two share the same
      on-disk format, so opening the desktop app on a workspace the extension owns is a read, not a migration.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapDesktopAppDiagram />
    </DiagramFrame>

    <DocHeading level={3}>MCP Server — AI agent control</DocHeading>
    <DocParagraph>
      Open Headers exposes itself over <strong>Model Context Protocol</strong> so any MCP-capable AI client — Claude
      Desktop, Claude Code, Cursor, VS Code, Cline, and the growing ecosystem behind it — can drive your workspace
      directly. Ask the agent in plain English to add a header rule, run a saved request against staging, switch
      environments, diff two workspaces, or import a Postman collection; the agent translates that to MCP tool calls and
      your workbench reflects the result.
    </DocParagraph>
    <DocParagraph>
      The server runs <strong>local-only by default</strong> (stdio transport, paired one-to-one with a client on the
      same machine) and <strong>HTTP/SSE for remote</strong> when you self-host. No vendor relay; your agent talks
      directly to your installation. Tool calls run with the same workspace permissions you have — secrets stay behind
      the vault, sensitive operations stay opt-in.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapMcpArchitectureDiagram />
    </DiagramFrame>
    <DiagramFrame>
      <RoadmapMcpToolsDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Local / LAN daemon for cross-device sync</DocHeading>
    <DocParagraph>
      A sync daemon you can run on your machine, your LAN, or a tunneled host. Extension, desktop app, and CLI all
      become clients of the same daemon — same workspaces, same rules, same vault, across every device you use. The
      daemon stays on the local network; there is no opt-in cloud path layered on top.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapDaemonDiagram />
    </DiagramFrame>

    <DocHeading level={3}>CLI</DocHeading>
    <DocParagraph>
      Headless scripting and CI integration. List rules, toggle environments, run a single saved request from the shell,
      diff a workspace against another. The CLI talks to the same daemon as the extension and desktop app, so automation
      stays in sync with what you see in the UI.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapCliDiagram />
    </DiagramFrame>

    <DocHeading level={3}>Self-hosted VM deployment + Web App</DocHeading>
    <DocParagraph>
      The same UI shipped as a web bundle you can serve from your own origin. For locked-down corporate browsers, kiosk
      devices, or any environment where installing an extension isn't an option — and for users who want a branded
      deployment of Open Headers under their own domain.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapWebAppDiagram />
    </DiagramFrame>

    <DocHeading level={3}>More importers</DocHeading>
    <DocParagraph>
      Beyond the existing cURL / HAR / Postman importers: Insomnia collections, OpenAPI specs, and full HAR request
      imports (not just headers). Importer parity is how Open Headers earns adoption from people already invested in
      another tool — bring your collection across in one step, keep working.
    </DocParagraph>
    <DiagramFrame>
      <RoadmapImportersDiagram />
    </DiagramFrame>

    <Callout kind="note" title="What about a hosted cloud back-end?">
      Not on the menu for now — if you want a cloud-hosted back-end, you can self-host it on your own VM (see above).
      The focus right now is finishing the roadmap, not running and maintaining free cloud infrastructure for end users.
      Happy to help if you're setting up a self-hosted deployment and run into trouble; just not in a position to
      provide hosting itself.
    </Callout>
  </>
);
