/**
 * Workbench Docs panel — the Variables section body. `{{ns.NAME}}`
 * reference tokens and scope names ride raw inside keyed prose.
 */

import type { Catalog } from '../../types';

export const workbenchDocsVariables = {
  // ── Concepts: Variables ─────────────────────────────────────────────
  'workbench.docs.body.variables.intro1Prefix':
    'Any templatable field — a header value, a redirect URL, a request body, a workflow step — can ' +
    'reference a variable with',
  'workbench.docs.body.variables.intro1Suffix':
    '. The value is substituted at use time, so one definition drives every rule, request, and workflow ' +
    'that mentions it. Variables live in five scopes, each with its own home in the app and its own rank ' +
    'when the same name exists in more than one.',
  'workbench.docs.body.variables.ladderCaptionPrefix': 'A bare',
  'workbench.docs.body.variables.ladderCaptionSuffix':
    'walks four scopes top-down and stops at the first hit. Live and the other namespaced scopes sit ' +
    'outside the walk.',
  'workbench.docs.body.variables.scopesHeading': 'The five scopes',
  'workbench.docs.body.variables.vaultHeading': 'Vault — secrets, this device only',
  'workbench.docs.body.variables.vault1Prefix':
    'The vault holds per-device secrets: API keys, passwords, TOTP seeds. Vault entries never sync and ' +
    'never leave the device — they stay out of workspace exports and git history. Two kinds exist:',
  'workbench.docs.body.variables.vaultKindString': 'string',
  'workbench.docs.body.variables.vault1Middle': 'entries resolve verbatim, and',
  'workbench.docs.body.variables.vaultKindTotp': 'TOTP',
  'workbench.docs.body.variables.vault1Suffix':
    'entries resolve to the current 6–8 digit code computed from the stored seed — the seed itself is never ' +
    'exposed through a template. Vault ranks highest, so a vault secret always wins a bare reference.',
  'workbench.docs.body.variables.vaultCaptionPrefix': 'Reference the secret with',
  'workbench.docs.body.variables.vaultCaptionSuffix': 'from synced entities — never paste the raw value.',
  'workbench.docs.body.variables.environmentHeading': 'Environment — switchable value sets',
  'workbench.docs.body.variables.environment1Prefix': 'Environments are named sets of variables you swap as a unit —',
  'workbench.docs.body.variables.environment1Suffix':
    ", a teammate's local setup. The active environment is picked in the header selector; a name the active " +
    "environment doesn't define falls back to the default environment before the walk continues downward. " +
    'Running with no environment selected is a valid state — resolution simply skips the scope. Rows can be ' +
    'marked secret so their values render masked in the editor.',
  'workbench.docs.body.variables.environmentCaption':
    'One name, a value per stage — switch the environment instead of duplicating rules.',
  'workbench.docs.body.variables.collectionHeading': 'Collection — scoped to one collection',
  'workbench.docs.body.variables.collection1':
    'Collection variables are defined on a collection and resolve only for the rules and requests that ' +
    "belong to it. They're the right home for values that are true of one API but not the whole workspace " +
    '— a base URL, a tenant id, a version prefix.',
  'workbench.docs.body.variables.collectionCaption':
    'Collection variables resolve only inside their own collection — elsewhere the walk passes them by.',
  'workbench.docs.body.variables.workspaceHeading': 'Workspace — shared with everyone',
  'workbench.docs.body.variables.workspace1':
    'Workspace variables are the workspace-wide globals — visible to every rule, request, and workflow, ' +
    'and synced with the workspace. They rank lowest, which makes them the natural base layer: put the ' +
    'common value here and let an environment or collection override it where needed.',
  'workbench.docs.body.variables.workspaceCaption':
    'The base layer — for values true everywhere. Not for secrets, not for per-stage values.',
  'workbench.docs.body.variables.liveHeading': 'Live — published by a workflow run',
  'workbench.docs.body.variables.live1Prefix':
    'A live variable is backed by a Live Workflow — a chain of requests that signs in, fetches a token, and ' +
    'exposes a captured value. Saving the workflow activates it; a successful run (manual or scheduled) ' +
    'publishes the exposed value, and auto-refresh re-runs the workflow to keep it fresh. Live values are ' +
    'reachable only as',
  'workbench.docs.body.variables.live1Suffix':
    "— never through a bare reference — so a rule template can't silently pick up an in-flight refresh " +
    "value when a workspace or environment variable shares the name. Editing the workflow's recipe marks " +
    'the published value stale until the next run.',
  'workbench.docs.body.variables.liveRefCaptionPrefix': 'Always the prefix —',
  'workbench.docs.body.variables.liveRefCaptionSuffix': '— and always workflow-backed, never a pasted token.',
  'workbench.docs.body.variables.liveLifecycleCaptionPrefix': 'Run succeeds → exposed capture publishes as',
  'workbench.docs.body.variables.liveLifecycleCaptionSuffix':
    '→ rules and requests consume it. The schedule re-runs the workflow.',
  'workbench.docs.body.variables.priorityHeading': 'Priority and shadowing',
  'workbench.docs.body.variables.priority1Prefix': 'A bare',
  'workbench.docs.body.variables.priority1Suffix':
    'resolves through the four real scopes in strict order — vault, then the active environment (with ' +
    'default-environment fallback), then the collection, then the workspace — and stops at the first scope ' +
    "that defines the name. Lower definitions still exist; they're just shadowed.",
  'workbench.docs.body.variables.shadowingCaptionPrefix': 'Environment beats workspace for the bare reference;',
  'workbench.docs.body.variables.shadowingCaptionSuffix': 'still reads the shadowed value.',
  'workbench.docs.body.variables.namespacePin1Prefix':
    'Every scope also has a namespace that pins resolution to it, skipping the ladder entirely:',
  'workbench.docs.body.variables.namespacePin1Suffix':
    '. Use the bare form for the normal case and the namespaced form when you mean a specific scope ' +
    "regardless of what's defined above it.",
  'workbench.docs.body.variables.tipTitle': 'Keep secrets in the vault',
  'workbench.docs.body.variables.tip1Prefix':
    "Rules, requests, and workflows sync with the workspace — the vault doesn't. Reference",
  'workbench.docs.body.variables.tip1Suffix':
    'from a synced entity and each teammate supplies their own value locally; nothing sensitive ever lands ' +
    'in the shared data.',
  'workbench.docs.body.variables.rulesHeading': 'Variables in rules',
  'workbench.docs.body.variables.rules1':
    'Almost every string a rule carries is templatable: condition values (domains, URL patterns, header ' +
    'names), header values, redirect URLs, query-param names and values, static request and response ' +
    'bodies, injected code, WS / SSE payloads, and Basic-auth credentials. The rule editor highlights each ' +
    "reference, shows the resolved value on hover, and banners any reference that doesn't resolve — an " +
    "unresolved rule can't take effect until every reference has a value.",
  'workbench.docs.body.variables.consumersCaption':
    'One templated value feeding all three consumer surfaces — substituted where each one applies.',
  'workbench.docs.body.variables.dynamicNoteTitle': 'Dynamic (JS) bodies are not templated',
  'workbench.docs.body.variables.dynamicNote1Prefix': 'Request-body and response rules in',
  'workbench.docs.body.variables.dynamicWord': 'dynamic',
  'workbench.docs.body.variables.dynamicNote1Middle':
    'mode run your JavaScript instead of substituting templates — the code computes its values itself. Only',
  'workbench.docs.body.variables.staticWord': 'static',
  'workbench.docs.body.variables.dynamicNote1Middle2': 'bodies participate in',
  'workbench.docs.body.variables.dynamicNote1Suffix': 'substitution.',
  'workbench.docs.body.variables.requestsHeading': 'Variables in requests',
  'workbench.docs.body.variables.requests1Prefix':
    'In the API client, the URL, query params, headers, auth fields, and body all resolve on Send — ' +
    "including collection variables of the collection the request lives in. A reference that can't be " +
    'resolved blocks the send with an error naming the missing variable, rather than putting a literal',
  'workbench.docs.body.variables.requests1Suffix': 'on the wire.',
  'workbench.docs.body.variables.workflowsHeading': 'Variables in workflows',
  'workbench.docs.body.variables.workflows1Prefix':
    'Each Live Workflow step resolves like a request, plus one extra scope:',
  'workbench.docs.body.variables.workflows1Suffix':
    'references a value captured by an earlier step in the same run — sign in with step 1, spend the ' +
    'session token in step 2. Step references only exist while the chain is executing; captures marked as ' +
    'exposed are what publish as live variables when the run succeeds.',
  'workbench.docs.body.variables.namespacesHeading': 'Namespace-only helpers',
  'workbench.docs.body.variables.helpers1': "Three more namespaces resolve values that aren't stored variables at all.",
  'workbench.docs.body.variables.helpersDynamicMiddle': 'runs a built-in generator —',
  'workbench.docs.body.variables.helpersFriends':
    ', and friends — producing a fresh value on every resolution: per send in the API client, per compile ' +
    'for static rules (the value is baked in until the next recompile).',
  'workbench.docs.body.variables.helpersFileMiddle': 'references a stored file by name. And',
  'workbench.docs.body.variables.helpersStepSuffix':
    ', above, only has meaning inside a running workflow chain. None of them join the bare walk — ' +
    "they're reachable only through their prefix.",
  'workbench.docs.body.variables.inspectingHeading': 'Creating and inspecting',
  'workbench.docs.body.variables.create1Prefix': 'Every scope is created from the sidebar:',
  'workbench.docs.body.variables.sidebarVault': 'Vault',
  'workbench.docs.body.variables.sidebarWorkspaceVars': 'Workspace Variables',
  'workbench.docs.body.variables.createAnd': ', and',
  'workbench.docs.body.variables.sidebarLiveVars': 'Live Variables',
  'workbench.docs.body.variables.create1Middle': 'are top-level entries; environments are added under',
  'workbench.docs.body.variables.sidebarEnvironments': 'Environments',
  'workbench.docs.body.variables.create1Middle2': '; and each collection carries its own',
  'workbench.docs.body.variables.sidebarVariables': 'Variables',
  'workbench.docs.body.variables.create1Suffix': 'page.',
  'workbench.docs.body.variables.creationMapCaption':
    'Each variable home in the sidebar, annotated with the namespace it feeds.',
  'workbench.docs.body.variables.inspect1Prefix': 'The',
  'workbench.docs.body.variables.inspect1Middle': 'tool window is the inspection surface.',
  'workbench.docs.body.variables.inScopeLabel': 'In scope',
  'workbench.docs.body.variables.inspect1Middle2':
    'lists the variables the focused rule, request, or template actually references — each resolved ' +
    'through the full ladder so you see the exact value that will apply.',
  'workbench.docs.body.variables.allScopesLabel': 'All scopes',
  'workbench.docs.body.variables.inspect1Middle3':
    'lists everything defined anywhere, grouped by priority. In any templatable field, typing',
  'workbench.docs.body.variables.inspect1Suffix':
    'opens the suggester with every resolvable name, and hovering a reference shows its resolved value and ' +
    'winning scope.',
} as const satisfies Catalog;
