/**
 * Concepts: Variables.
 */

import type React from 'react';
import {
  VariablesConsumersDiagram,
  VariablesCreationMapDiagram,
  VariablesLiveLifecycleDiagram,
  VariablesResolutionLadderDiagram,
  VariablesShadowingDiagram,
} from '../../diagrams';
import {
  Anchor,
  Callout,
  DiagramFrame,
  DocHeading,
  DocParagraph,
  OnThisPage,
  SurfaceContext,
} from '../../shared';

const VARIABLE_ANCHORS = [
  { id: 'variables-scopes', title: 'The five scopes' },
  { id: 'variables-priority', title: 'Priority and shadowing' },
  { id: 'variables-rules', title: 'Variables in rules' },
  { id: 'variables-requests', title: 'Variables in requests' },
  { id: 'variables-workflows', title: 'Variables in workflows' },
  { id: 'variables-namespaces', title: 'Namespace-only helpers' },
  { id: 'variables-inspecting', title: 'Creating and inspecting' },
];

export const VariablesSection: React.FC = () => (
  <>
    <SurfaceContext surfaces={['workbench', 'devtools']} />
    <DocParagraph>
      Any templatable field — a header value, a redirect URL, a request body, a workflow step — can reference a
      variable with <code>{'{{name}}'}</code>. The value is substituted at use time, so one definition drives every
      rule, request, and workflow that mentions it. Variables live in five scopes, each with its own home in the app
      and its own rank when the same name exists in more than one.
    </DocParagraph>
    <OnThisPage entries={VARIABLE_ANCHORS} />
    <DiagramFrame
      caption={
        <>
          A bare <code>{'{{token}}'}</code> walks four scopes top-down and stops at the first hit. Live and the other
          namespaced scopes sit outside the walk.
        </>
      }
    >
      <VariablesResolutionLadderDiagram />
    </DiagramFrame>

    <Anchor id="variables-scopes">
      <DocHeading level={3}>The five scopes</DocHeading>
    </Anchor>
    <DocHeading level={4}>Vault — secrets, this device only</DocHeading>
    <DocParagraph>
      The vault holds per-device secrets: API keys, passwords, TOTP seeds. Vault entries never sync and never leave the
      device — they stay out of workspace exports and git history. Two kinds exist: <em>string</em> entries resolve
      verbatim, and <em>TOTP</em> entries resolve to the current 6–8 digit code computed from the stored seed — the
      seed itself is never exposed through a template. Vault ranks highest, so a vault secret always wins a bare
      reference.
    </DocParagraph>
    <DocHeading level={4}>Environment — switchable value sets</DocHeading>
    <DocParagraph>
      Environments are named sets of variables you swap as a unit — <code>staging</code>, <code>production</code>, a
      teammate's local setup. The active environment is picked in the header selector; a name the active environment
      doesn't define falls back to the default environment before the walk continues downward. Running with no
      environment selected is a valid state — resolution simply skips the scope. Rows can be marked secret so their
      values render masked in the editor.
    </DocParagraph>
    <DocHeading level={4}>Collection — scoped to one collection</DocHeading>
    <DocParagraph>
      Collection variables are defined on a collection and resolve only for the rules and requests that belong to it.
      They're the right home for values that are true of one API but not the whole workspace — a base URL, a tenant
      id, a version prefix.
    </DocParagraph>
    <DocHeading level={4}>Workspace — shared with everyone</DocHeading>
    <DocParagraph>
      Workspace variables are the workspace-wide globals — visible to every rule, request, and workflow, and synced
      with the workspace. They rank lowest, which makes them the natural base layer: put the common value here and let
      an environment or collection override it where needed.
    </DocParagraph>
    <DocHeading level={4}>Live — published by a workflow run</DocHeading>
    <DocParagraph>
      A live variable is backed by a Live Workflow — a chain of requests that signs in, fetches a token, and exposes a
      captured value. Saving the workflow activates it; a successful run (manual or scheduled) publishes the exposed
      value, and auto-refresh re-runs the workflow to keep it fresh. Live values are reachable only as{' '}
      <code>{'{{live.name}}'}</code> — never through a bare reference — so a rule template can't silently pick up an
      in-flight refresh value when a workspace or environment variable shares the name. Editing the workflow's recipe
      marks the published value stale until the next run.
    </DocParagraph>
    <DiagramFrame
      caption={
        <>
          Run succeeds → exposed capture publishes as <code>{'{{live.token}}'}</code> → rules and requests consume it.
          The schedule re-runs the workflow.
        </>
      }
    >
      <VariablesLiveLifecycleDiagram />
    </DiagramFrame>

    <Anchor id="variables-priority">
      <DocHeading level={3}>Priority and shadowing</DocHeading>
    </Anchor>
    <DocParagraph>
      A bare <code>{'{{name}}'}</code> resolves through the four real scopes in strict order — vault, then the active
      environment (with default-environment fallback), then the collection, then the workspace — and stops at the
      first scope that defines the name. Lower definitions still exist; they're just shadowed.
    </DocParagraph>
    <DiagramFrame
      caption={
        <>
          Environment beats workspace for the bare reference; <code>{'{{workspace.api_host}}'}</code> still reads the
          shadowed value.
        </>
      }
    >
      <VariablesShadowingDiagram />
    </DiagramFrame>
    <DocParagraph>
      Every scope also has a namespace that pins resolution to it, skipping the ladder entirely:{' '}
      <code>{'{{vault.name}}'}</code>, <code>{'{{env.name}}'}</code>, <code>{'{{collection.name}}'}</code>,{' '}
      <code>{'{{workspace.name}}'}</code>, <code>{'{{live.name}}'}</code>. Use the bare form for the normal case and
      the namespaced form when you mean a specific scope regardless of what's defined above it.
    </DocParagraph>
    <Callout kind="tip" title="Keep secrets in the vault">
      Rules, requests, and workflows sync with the workspace — the vault doesn't. Reference{' '}
      <code>{'{{vault.api_key}}'}</code> from a synced entity and each teammate supplies their own value locally;
      nothing sensitive ever lands in the shared data.
    </Callout>

    <Anchor id="variables-rules">
      <DocHeading level={3}>Variables in rules</DocHeading>
    </Anchor>
    <DocParagraph>
      Almost every string a rule carries is templatable: condition values (domains, URL patterns, header names), header
      values, redirect URLs, query-param names and values, static request and response bodies, injected code, WS / SSE
      payloads, and Basic-auth credentials. The rule editor highlights each reference, shows the resolved value on
      hover, and banners any reference that doesn't resolve — an unresolved rule can't take effect until every
      reference has a value.
    </DocParagraph>
    <DiagramFrame caption="One templated value feeding all three consumer surfaces — substituted where each one applies.">
      <VariablesConsumersDiagram />
    </DiagramFrame>
    <Callout kind="note" title="Dynamic (JS) bodies are not templated">
      Request-body and response rules in <em>dynamic</em> mode run your JavaScript instead of substituting templates —
      the code computes its values itself. Only <em>static</em> bodies participate in <code>{'{{name}}'}</code>{' '}
      substitution.
    </Callout>

    <Anchor id="variables-requests">
      <DocHeading level={3}>Variables in requests</DocHeading>
    </Anchor>
    <DocParagraph>
      In the API client, the URL, query params, headers, auth fields, and body all resolve on Send — including
      collection variables of the collection the request lives in. A reference that can't be resolved blocks the send
      with an error naming the missing variable, rather than putting a literal <code>{'{{name}}'}</code> on the wire.
    </DocParagraph>

    <Anchor id="variables-workflows">
      <DocHeading level={3}>Variables in workflows</DocHeading>
    </Anchor>
    <DocParagraph>
      Each Live Workflow step resolves like a request, plus one extra scope: <code>{'{{step.<id>.<capture>}}'}</code>{' '}
      references a value captured by an earlier step in the same run — sign in with step 1, spend the session token in
      step 2. Step references only exist while the chain is executing; captures marked as exposed are what publish as
      live variables when the run succeeds.
    </DocParagraph>

    <Anchor id="variables-namespaces">
      <DocHeading level={3}>Namespace-only helpers</DocHeading>
    </Anchor>
    <DocParagraph>
      Three more namespaces resolve values that aren't stored variables at all. <code>{'{{dynamic.*}}'}</code> runs a
      built-in generator — <code>{'{{dynamic.uuid}}'}</code>, <code>{'{{dynamic.timestamp}}'}</code>,{' '}
      <code>{'{{dynamic.isoTimestamp}}'}</code>, <code>{'{{dynamic.randomInt}}'}</code>, and friends — producing a
      fresh value on every resolution: per send in the API client, per compile for static rules (the value is baked in
      until the next recompile). <code>{'{{file.*}}'}</code> references a stored file by name. And{' '}
      <code>{'{{step.*}}'}</code>, above, only has meaning inside a running workflow chain. None of them join the bare
      walk — they're reachable only through their prefix.
    </DocParagraph>

    <Anchor id="variables-inspecting">
      <DocHeading level={3}>Creating and inspecting</DocHeading>
    </Anchor>
    <DocParagraph>
      Every scope is created from the sidebar: <strong>Vault</strong>, <strong>Workspace Variables</strong>, and{' '}
      <strong>Live Variables</strong> are top-level entries; environments are added under{' '}
      <strong>Environments</strong>; and each collection carries its own <strong>Variables</strong> page.
    </DocParagraph>
    <DiagramFrame caption="Each variable home in the sidebar, annotated with the namespace it feeds.">
      <VariablesCreationMapDiagram />
    </DiagramFrame>
    <DocParagraph>
      The <strong>Variables</strong> tool window is the inspection surface. <em>In context</em> lists the variables the
      focused rule, request, or template actually references — each resolved through the full ladder so you see the
      exact value that will apply. <em>All scopes</em> lists everything defined anywhere, grouped by priority. In any
      templatable field, typing <code>{'{{'}</code> opens the suggester with every resolvable name, and hovering a
      reference shows its resolved value and winning scope.
    </DocParagraph>
  </>
);
