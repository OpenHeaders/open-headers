/**
 * Concepts: System Status.
 */

import { Tag } from 'antd';
import type React from 'react';
import {
  LivePillAggregationDiagram,
  LiveWorkflowFreshnessDiagram,
  PermissionsAuditFlowDiagram,
  PermissionsImpactDiagram,
  RequestExecutorOutcomesDiagram,
  RequestExecutorScopeDiagram,
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
} from '../../diagrams';
import { Callout, DiagramFrame, DocHeading, DocParagraph, StateRow, SurfaceContext } from '../../shared';

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
