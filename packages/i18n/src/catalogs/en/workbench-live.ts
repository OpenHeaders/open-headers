/**
 * Workbench live/workflows station (Phase C) — the live-variable editor
 * family (`LiveVariableEditor` edit + create modes, the toggles row, the
 * refresh-policy picker, the shared `live/layout` form chrome) and the
 * `live-display` copy plane (circuit descriptors, schedule wording,
 * per-step run states) consumed by the editor headers, sidebar
 * dashboard, and graph overlay. Grows per live-station slice — the
 * workflow editors (graph, steps, gates) are the next slice.
 *
 * Technical plane stays raw inside keyed sentences: `{{live.NAME}}`
 * reference syntax, policy kind ids (expires-in / expires-at), duration
 * values and relative-time phrases from formatRelativeMs/formatCountdown
 * (interpolated as {when} — locale-aware relative time is Phase I with
 * Intl.RelativeTimeFormat), step ids / capture names / workflow names,
 * code examples ({"expires_in": 3600}, run_time + captured_seconds,
 * epoch ms values), MV3, server error text ({error} / {message}).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchLive = {
  // ── live-display: circuit descriptors ───────────────────────────────
  'workbench.editors.live.circuit.idleLabel': 'idle',
  'workbench.editors.live.circuit.idleHint': 'No cache yet — run a refresh to populate.',
  'workbench.editors.live.circuit.pausedLabel': 'paused',
  'workbench.editors.live.circuit.pausedHint': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Circuit is open after {count} consecutive failure. Automatic retry is deferred. Click Retry now to bypass the backoff.',
      other:
        'Circuit is open after {count} consecutive failures. Automatic retry is deferred. Click Retry now to bypass the backoff.',
    }),
  'workbench.editors.live.circuit.probingLabel': 'probing…',
  'workbench.editors.live.circuit.probingHint': 'Probe attempt in flight — a single success closes the circuit.',
  'workbench.editors.live.circuit.retryLabel': 'retry {attempt} of 3',
  'workbench.editors.live.circuit.retryHint':
    'Pre-breaker retry tier — quick retries with 5–10s backoff between attempts. Circuit opens after 3 consecutive failures.',
  'workbench.editors.live.circuit.healthyLabel': 'healthy',
  'workbench.editors.live.circuit.healthyHint': 'Circuit closed, no recent failures.',

  // ── live-display: schedule + policy wording ─────────────────────────
  'workbench.editors.live.schedule.last': 'last {when}',
  'workbench.editors.live.schedule.manualOnly': 'manual refresh only',
  'workbench.editors.live.schedule.autoRefresh': 'auto-refresh {when}',
  'workbench.editors.live.schedule.expires': 'expires {when}',
  'workbench.editors.live.policy.interval': 'every {seconds}s',
  'workbench.editors.live.policy.expiresIn': 'expires-in from {source} (lead {lead}s)',
  'workbench.editors.live.policy.expiresAt': 'expires-at from {source} (lead {lead}s)',
  'workbench.editors.live.policy.manual': 'manual refresh',

  // ── live-display: per-step run states ───────────────────────────────
  'workbench.editors.live.stepRun.completed': 'Completed on last run',
  'workbench.editors.live.stepRun.failed': 'Last run failed at this step',
  'workbench.editors.live.stepRun.extractFailed': 'Fetched, but a capture extractor did not match',
  'workbench.editors.live.stepRun.skipped': 'Skipped by its run condition on last run',
  'workbench.editors.live.stepRun.notRun': 'Not part of a successful run yet',
  'workbench.editors.live.maskEmpty': '(empty)',

  // ── Shared live form chrome (live/layout) ───────────────────────────
  'workbench.editors.live.form.namePlaceholder': 'Name',
  'workbench.editors.live.form.descriptionPlaceholder': 'Description (optional)',

  // ── Live-variable editor: edit mode ─────────────────────────────────
  'workbench.editors.live.variable.sourceNotFound': 'Source not found.',
  'workbench.editors.live.variable.liveTag': 'Live',
  'workbench.editors.live.variable.disabledTag': 'Disabled',
  'workbench.editors.live.variable.overrideTag': 'override',
  'workbench.editors.live.variable.refresh': 'Refresh',
  'workbench.editors.live.variable.valueLabel': 'Value',
  'workbench.editors.live.variable.neverRefreshed': '(never refreshed)',
  'workbench.editors.live.variable.nameLabel': 'Name',
  'workbench.editors.live.variable.nameHint': 'Reference as {{live.NAME}}',
  'workbench.editors.live.variable.descriptionLabel': 'Description',
  'workbench.editors.live.variable.bindingSection': 'Binding',
  'workbench.editors.live.variable.workflowLabel': 'Workflow',
  'workbench.editors.live.variable.stepLabel': 'Step',
  'workbench.editors.live.variable.captureLabel': 'Capture',
  'workbench.editors.live.variable.selectWorkflow': 'Select a workflow',
  'workbench.editors.live.variable.selectStep': 'Select a step',
  'workbench.editors.live.variable.selectCapture': 'Select a capture',
  'workbench.editors.live.variable.stepOption': '{id} ({count} captures)',
  'workbench.editors.live.variable.openFlow': 'Open flow',
  'workbench.editors.live.variable.overrideSection': 'Manual override',
  'workbench.editors.live.variable.overrideValuePlaceholder': 'Fixed override value',
  'workbench.editors.live.variable.overrideExpiresLabel': 'Expires (ms)',
  'workbench.editors.live.variable.overrideExpiresHint': 'Wall-clock epoch ms — leave blank for permanent override',
  'workbench.editors.live.variable.applyOverride': 'Apply override',
  'workbench.editors.live.variable.clearOverride': 'Clear',
  'workbench.editors.live.variable.setOverride': 'Set manual override',
  'workbench.editors.live.variable.overrideNote':
    'Resolver serves the pinned value; scheduler still refreshes the underlying workflow.',
  'workbench.editors.live.variable.deletedElsewhere': 'Source was deleted from another tab',
  'workbench.editors.live.variable.saveFailed': 'Failed to save live variable',
  'workbench.editors.live.variable.refreshFailed': 'Refresh failed: {error}',
  'workbench.editors.live.variable.refreshed': 'Refreshed',
  'workbench.editors.live.variable.overrideSaveFailed': 'Override save failed.',
  'workbench.editors.live.variable.overrideApplied': 'Override applied',
  'workbench.editors.live.variable.overrideCleared': 'Override cleared',

  // ── Live-variable editor: create mode ───────────────────────────────
  'workbench.editors.live.create.title': 'New Live Variable',
  'workbench.editors.live.create.namePlaceholder': 'Name (e.g. accessToken)',
  'workbench.editors.live.create.referenceAs': 'Reference as {{live.{name}}}',
  'workbench.editors.live.create.createWorkflow': 'Create a workflow',
  'workbench.editors.live.create.noWorkflows': 'No workflows yet.',
  'workbench.editors.live.create.nameRequired': 'Name is required',
  'workbench.editors.live.create.bindingRequired': 'Select a workflow, step, and capture',
  'workbench.editors.live.create.createFailed': 'Failed to create live variable',

  // ── Toggles row (Enabled / Wait for fresh value) ────────────────────
  'workbench.editors.live.toggles.enabled': 'Enabled',
  'workbench.editors.live.toggles.enabledTooltip':
    'When off, {{live.NAME}} references stop resolving in rules and requests.',
  'workbench.editors.live.toggles.waitForFresh': 'Wait for fresh value',
  'workbench.editors.live.toggles.waitForFreshTooltip':
    'Before applying rules, wait for the backing workflow to finish a refresh (up to ~5s). Off: rules use the last cached value and refresh in the background — faster but can be briefly stale after the extension wakes.',

  // ── Refresh-policy picker ───────────────────────────────────────────
  'workbench.editors.live.refreshPolicy.manual': 'Manual only',
  'workbench.editors.live.refreshPolicy.interval': 'Fixed interval',
  'workbench.editors.live.refreshPolicy.expiresIn': 'Expires in N seconds (relative)',
  'workbench.editors.live.refreshPolicy.expiresAt': 'Expires at epoch ms (absolute)',
  'workbench.editors.live.refreshPolicy.leadUnit': 'lead s',
  'workbench.editors.live.refreshPolicy.selectCapture': 'Select capture',
  'workbench.editors.live.refreshPolicy.noCaptures': 'No captures defined yet.',
  'workbench.editors.live.refreshPolicy.subMinuteWarning':
    'Sub-minute intervals hit the MV3 alarm floor and burn quota fast. Use only when necessary.',
  'workbench.editors.live.refreshPolicy.expiresInHelpPrefix': 'Capture value = seconds until expiry (e.g. OAuth',
  'workbench.editors.live.refreshPolicy.expiresInHelpMid': '). Refresh fires `lead` seconds before',
  'workbench.editors.live.refreshPolicy.expiresInHelpSuffix': '.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpPrefix': 'Capture value = absolute unix epoch in',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds': 'milliseconds',
  'workbench.editors.live.refreshPolicy.expiresAtHelpMid': '(e.g.',
  'workbench.editors.live.refreshPolicy.expiresAtHelpSuffix': '). Refresh fires `lead` seconds before that moment.',
  'workbench.editors.live.refreshPolicy.noCapturesWarning':
    'Add a capture to the workflow first so expiry math has a source.',

  // ── Workflow editor shell (LiveWorkflowEditor) ──────────────────────
  'workbench.editors.live.workflow.viewEditor': 'Editor',
  'workbench.editors.live.workflow.viewPreview': 'Preview',
  'workbench.editors.live.workflow.refresh': 'Refresh',
  'workbench.editors.live.workflow.disabledTag': 'Disabled',
  'workbench.editors.live.workflow.notFound': 'Workflow not found.',
  'workbench.editors.live.workflow.deletedElsewhere': 'Workflow was deleted from another tab',
  'workbench.editors.live.workflow.saveFailed': 'Failed to save workflow',
  'workbench.editors.live.workflow.createFailed': 'Failed to create workflow',
  'workbench.editors.live.workflow.refreshed': 'Refreshed',
  'workbench.editors.live.workflow.refreshFailed': 'Refresh failed: {error}',
  'workbench.editors.live.workflow.defaultName': 'Workflow',
  'workbench.editors.live.workflow.newDraftName': 'New Workflow',

  // ── Workflow form body ──────────────────────────────────────────────
  'workbench.editors.live.form.structuralIssues': 'Workflow has structural issues',
  'workbench.editors.live.form.stepsTitle': 'Steps ({count})',
  'workbench.editors.live.form.addStepButton': 'Step',
  'workbench.editors.live.form.noSteps': 'No steps yet — add one to wire a request + extraction into this workflow.',
  'workbench.editors.live.form.enabledAria': 'Workflow enabled',
  'workbench.editors.live.form.enabled': 'Enabled',
  'workbench.editors.live.form.disabled': 'Disabled',
  'workbench.editors.live.form.parallelLabel': 'Run independent steps in parallel',
  'workbench.editors.live.form.parallelTooltip':
    'Sequential only in v1. Parallel execution coming in a future release.',
  'workbench.editors.live.form.refreshPolicySection': 'Refresh policy',

  // ── Workflow step editor ────────────────────────────────────────────
  'workbench.editors.live.step.title': 'Step {number}',
  'workbench.editors.live.step.idPrefix': 'id',
  'workbench.editors.live.step.namePrefix': 'name',
  'workbench.editors.live.step.typeTooltip': 'Step type — Foreach and Composite coming in a future release.',
  'workbench.editors.live.step.typeRequest': 'Request',
  'workbench.editors.live.step.typeForeach': 'Foreach',
  'workbench.editors.live.step.typeComposite': 'Composite',
  'workbench.editors.live.step.runsIfTag': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'runs if {count} condition',
      other: 'runs if {count} conditions',
    }),
  'workbench.editors.live.step.priorityTag': 'priority: {ref}',
  'workbench.editors.live.step.scriptsTag': 'scripts',
  'workbench.editors.live.step.selectRequest': 'Select a request',
  'workbench.editors.live.step.descriptionPlaceholder': 'Optional step description',
  'workbench.editors.live.step.capturesHeader': 'CAPTURES ({count})',
  'workbench.editors.live.step.addCapture': '+ Capture',
  'workbench.editors.live.step.captureRequired': 'At least one capture is required before an LV can bind to this step.',
  'workbench.editors.live.step.removeCaptureAria': 'Remove capture {name}',
  'workbench.editors.live.step.exposeAria': 'Expose capture {name} as live variable',
  'workbench.editors.live.step.exposeAs': 'Expose as',
  'workbench.editors.live.step.exposeTooltip':
    'When on, saving the workflow creates a Live Variable that resolves `{{live.<name>}}` from this capture. Turn off to use the capture only inside this workflow (e.g. via {{step.<stepId>.<captureName>}}).',
  'workbench.editors.live.step.afterChip': '↳ after {parents}',
  'workbench.editors.live.step.implicitMark': '(implicit)',
  'workbench.editors.live.step.implicitTooltip':
    'Implicit prior-step dependency (no explicit dependsOn declared). Set an explicit dependsOn to lock the relationship.',

  // ── Step collapse sections (depends on / run condition / priority / retry / timeout / scripts) ──
  'workbench.editors.live.sections.dependsOn': 'Depends on',
  'workbench.editors.live.sections.dependsOnImplicit': '(implicit — prior step)',
  'workbench.editors.live.sections.dependsOnRoot': '(root)',
  'workbench.editors.live.sections.dependsOnPlaceholder': 'Select ancestor step(s) — empty = root step',
  'workbench.editors.live.sections.dependsOnImplicitHint':
    'No explicit dependsOn — implicitly depends on the previous step in declared order.',
  'workbench.editors.live.sections.dependsOnRootHint': 'Explicit root — runs as soon as the workflow starts.',
  'workbench.editors.live.sections.useImplicit': 'Use implicit',
  'workbench.editors.live.sections.waitsFor': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Step waits for {count} ancestor to complete or skip.',
      other: 'Step waits for {count} ancestors to complete or skip.',
    }),
  'workbench.editors.live.sections.reset': 'Reset',
  'workbench.editors.live.sections.runCondition': 'Run condition',
  'workbench.editors.live.sections.none': '(none)',
  'workbench.editors.live.sections.priority': 'Priority',
  'workbench.editors.live.sections.priorityStepPlaceholder': 'Ancestor step',
  'workbench.editors.live.sections.priorityCapturePlaceholder': 'Capture name',
  'workbench.editors.live.sections.sortNumeric': 'Numeric',
  'workbench.editors.live.sections.sortLexicographic': 'Lexicographic',
  'workbench.editors.live.sections.priorityTooltip':
    'When multiple steps can run next, the one with the lowest priority value runs first. Missing values sort last.',
  'workbench.editors.live.sections.clear': 'Clear',
  'workbench.editors.live.sections.retryPolicy': 'Retry policy',
  'workbench.editors.live.sections.retrySummary': '({count} attempts)',
  'workbench.editors.live.sections.retrySummaryExponential': '({count} attempts, exponential)',
  'workbench.editors.live.sections.attemptsPlaceholder': 'Attempts',
  'workbench.editors.live.sections.attemptsPrefix': 'attempts',
  'workbench.editors.live.sections.delayPrefix': 'delay ms',
  'workbench.editors.live.sections.backoffFixed': 'Fixed',
  'workbench.editors.live.sections.backoffExponential': 'Exponential',
  'workbench.editors.live.sections.retryOnNetwork': 'Network errors only',
  'workbench.editors.live.sections.retryOn5xx': 'Network + 5xx',
  'workbench.editors.live.sections.retryOn429': 'Network + 429',
  'workbench.editors.live.sections.retryOn4xx': 'Network + 4xx',
  'workbench.editors.live.sections.retryOnCustom': 'Custom (edited as data)',
  'workbench.editors.live.sections.retryTooltip':
    'Network failures (DNS, connection, timeout) always retry while attempts remain. Adding a status match also retries matching responses; extraction errors never retry. Clear the attempts field to disable retries.',
  'workbench.editors.live.sections.timeout': 'Timeout',
  'workbench.editors.live.sections.noTimeoutPlaceholder': 'No timeout',
  'workbench.editors.live.sections.timeoutTooltip':
    'Per attempt — the request (including the body read) aborts past this ceiling. A retrying step gets the full timeout on every attempt. Clear the field for no ceiling.',
  'workbench.editors.live.sections.scripts': 'Scripts',
  'workbench.editors.live.sections.scriptsOn': '(on)',
  'workbench.editors.live.sections.scriptsOff': '(off)',
  'workbench.editors.live.sections.runScriptsAria': "Run the request's scripts on this step",
  'workbench.editors.live.sections.runScriptsLabel': "Run the request's pre-request / post-response scripts",
  'workbench.editors.live.sections.scriptsTooltip':
    'Runs on every chain attempt. Step scripts get a read-only oh.* surface (oh.sendRequest and oh.variables.set are rejected). A script error or a failed oh.test assertion fails the step, so last-good values are preserved — assertions gate what this workflow publishes. Needs a script-capable runtime; on hosts without one the step runs without scripts.',

  // ── Step gate editor (run-condition clauses) ────────────────────────
  'workbench.editors.live.gate.kindStatus': 'Status',
  'workbench.editors.live.gate.kindCaptureExists': 'Capture exists',
  'workbench.editors.live.gate.kindCaptureEquals': 'Capture equals',
  'workbench.editors.live.gate.kindCaptureMatches': 'Capture matches',
  'workbench.editors.live.gate.kindNumericCompare': 'Capture numeric compare',
  'workbench.editors.live.gate.kindInList': 'Capture in list',
  'workbench.editors.live.gate.kindHeaderContains': 'Header contains',
  'workbench.editors.live.gate.futureNumericCompare': 'Numeric compare — coming in a future release.',
  'workbench.editors.live.gate.futureInList': 'In-list match — coming in a future release.',
  'workbench.editors.live.gate.futureHeaderContains': 'Header contains — coming in a future release.',
  'workbench.editors.live.gate.status2xx': '2xx (any success)',
  'workbench.editors.live.gate.status3xx': '3xx (redirect)',
  'workbench.editors.live.gate.status4xx': '4xx (client error)',
  'workbench.editors.live.gate.status5xx': '5xx (server error)',
  'workbench.editors.live.gate.statusEquals': 'equals…',
  'workbench.editors.live.gate.statusNotEquals': 'not equals…',
  'workbench.editors.live.gate.statusOneOf': 'one of…',
  'workbench.editors.live.gate.allAnd': 'All (AND)',
  'workbench.editors.live.gate.anyOr': 'Any (OR)',
  'workbench.editors.live.gate.orTooltip':
    'OR logic coming in a future release. Use multiple steps with mutually-exclusive gates for now.',
  'workbench.editors.live.gate.matchModesAria': 'About match modes',
  'workbench.editors.live.gate.noConditions': 'No conditions — step runs whenever its dependencies complete.',
  'workbench.editors.live.gate.conditionCount': '{count} condition(s)',
  'workbench.editors.live.gate.addCondition': 'Add condition',
  'workbench.editors.live.gate.andTag': 'AND',
  'workbench.editors.live.gate.stepPlaceholder': 'Step',
  'workbench.editors.live.gate.capturePlaceholder': 'Capture name',
  'workbench.editors.live.gate.equalsPlaceholder': 'Equals value',
  'workbench.editors.live.gate.removeClauseAria': 'Remove clause {number}',
  'workbench.editors.live.gate.statusClassTooltip': 'Matches any status in the class (e.g. 2xx = 200-299).',

  // ── Workflow graph view ─────────────────────────────────────────────
  'workbench.editors.live.graph.clauseStatusIs': '{stepId} status is {value}',
  'workbench.editors.live.graph.clauseStatusIsNot': '{stepId} status is not {value}',
  'workbench.editors.live.graph.clauseStatusIn': '{stepId} status in [{list}]',
  'workbench.editors.live.graph.clauseCaptureExists': '{ref} exists',
  'workbench.editors.live.graph.clauseCaptureMatches': '{ref} matches /{pattern}/',
  'workbench.editors.live.graph.menuAddStep': 'Add step',
  'workbench.editors.live.graph.menuEditStep': 'Edit step',
  'workbench.editors.live.graph.menuDeleteStep': 'Delete step',
  'workbench.editors.live.graph.connectTitle': 'Drag to another step to add a dependency',
  'workbench.editors.live.graph.removeDependency': 'Remove dependency',
  'workbench.editors.live.graph.zoomIn': 'Zoom in',
  'workbench.editors.live.graph.zoomOut': 'Zoom out',
  'workbench.editors.live.graph.recenter': 'Re-center',
  'workbench.editors.live.graph.legendClick': 'click',
  'workbench.editors.live.graph.legendSelect': 'select',
  'workbench.editors.live.graph.legendEditKeys': '2×click / ⏎',
  'workbench.editors.live.graph.legendEdit': 'edit',
  'workbench.editors.live.graph.legendDelete': 'delete',
  'workbench.editors.live.graph.legendConnectKeys': 'drag ○',
  'workbench.editors.live.graph.legendConnect': 'connect',
  'workbench.editors.live.graph.legendRightClick': 'right-click',
  'workbench.editors.live.graph.legendMenu': 'menu',
  'workbench.editors.live.graph.legendDragNode': 'drag node',
  'workbench.editors.live.graph.legendMove': 'move',
  'workbench.editors.live.graph.legendDragBg': 'drag bg',
  'workbench.editors.live.graph.legendPan': 'pan',
  'workbench.editors.live.graph.legendScroll': 'scroll',
  'workbench.editors.live.graph.legendZoom': 'zoom',
  'workbench.editors.live.graph.editStepInForm': 'Edit step in form',
  'workbench.editors.live.graph.requestNotFound': 'Request not found',
  'workbench.editors.live.graph.noRequestSelected': 'No request selected',
  'workbench.editors.live.graph.noCaptures': 'No captures',
  'workbench.editors.live.graph.orderedBy': 'Ordered by {ref}',
  'workbench.editors.live.graph.exposedAs': 'Exposed as {{live.{name}}}',
  'workbench.editors.live.graph.exposedAsPending': 'Exposed as {{live.{name}}} — pending first run',

  // ── Workflow status panel + run status strip ────────────────────────
  'workbench.editors.live.status.title': 'Workflow Status',
  'workbench.editors.live.status.noEnvironment': 'No environment',
  'workbench.editors.live.status.unknownEnv': 'Unknown env',
  'workbench.editors.live.status.activeSuffix': '(active)',
  'workbench.editors.live.status.pillPaused': 'PAUSED',
  'workbench.editors.live.status.pillProbing': 'PROBING',
  'workbench.editors.live.status.pillRetrying': 'RETRYING',
  'workbench.editors.live.status.pillHealthy': 'HEALTHY',
  'workbench.editors.live.status.summaryHealthy': '{count} healthy',
  'workbench.editors.live.status.summaryRetrying': '{count} retrying',
  'workbench.editors.live.status.summaryProbing': '{count} probing',
  'workbench.editors.live.status.summaryPaused': '{count} paused',
  'workbench.editors.live.status.loading': 'Loading…',
  'workbench.editors.live.status.empty': 'No workflow runs yet. Create a workflow and click Refresh to populate.',
  'workbench.editors.live.status.failuresCount': 'failures: {count}',
  'workbench.editors.live.status.failuresTooltip': 'Consecutive failures since the last successful refresh.',
  'workbench.editors.live.status.openingsCount': 'openings: {count}',
  'workbench.editors.live.status.openingsTooltip':
    'Number of times the circuit has transitioned OPEN in the current cycle. Halves on a well-aged recovery, decrements by one on a recent recovery.',
  'workbench.editors.live.status.nextAttempt': 'next attempt {countdown}',
  'workbench.editors.live.status.nextAttemptTooltip':
    'Wall-clock time at which the next automatic probe will run. Click Refresh now to bypass.',
  'workbench.editors.live.status.refreshNow': 'Refresh now',
  'workbench.editors.live.status.resetCircuit': 'Reset circuit',
  'workbench.editors.live.status.resetCircuitTooltip':
    'Clear failure counters + pending backoff. Does not run a probe.',
  'workbench.editors.live.status.circuitReset': 'Circuit reset',
  'workbench.editors.live.status.resetFailed': 'Reset failed: {error}',
  'workbench.editors.live.status.dragToResize': 'Drag to resize',
  'workbench.editors.live.status.boundCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'bound: {count} variable',
      other: 'bound: {count} variables',
    }),
  'workbench.editors.live.status.needsReRun': 'needs re-run',
  'workbench.editors.live.status.needsReRunTooltip':
    'The workflow or an input it resolves changed since this value was extracted — run Refresh to re-extract.',
  'workbench.editors.live.status.neverRunForEnv': 'never run for this env — click Refresh to populate',

  // ── Graph run overlay ───────────────────────────────────────────────
  'workbench.editors.live.runOverlay.valuesPreserved': 'values preserved from an earlier run',
  'workbench.editors.live.runOverlay.responseBytes': 'response {bytes} bytes',

  // ── Create Workflow from requests modal ─────────────────────────────
  'workbench.editors.live.fromRequests.title': 'Create Workflow from “{name}”',
  'workbench.editors.live.fromRequests.createButton': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Create Workflow ({count} step)',
      other: 'Create Workflow ({count} steps)',
    }),
  'workbench.editors.live.fromRequests.empty': 'This container has no requests to build a workflow from.',
  'workbench.editors.live.fromRequests.hint': 'Each selected request becomes a workflow step, in the order shown.',

  // ── Extractor picker (capture extraction kinds) ─────────────────────
  'workbench.editors.live.extractor.groupPlaceholder': 'group',
  'workbench.editors.live.extractor.groupBody': 'Response body',
  'workbench.editors.live.extractor.groupResponse': 'Response',
  'workbench.editors.live.extractor.wholeBody': 'Whole body',
  'workbench.editors.live.extractor.jsonPath': 'JSON path',
  'workbench.editors.live.extractor.regex': 'Regex',
  'workbench.editors.live.extractor.header': 'Header',
  'workbench.editors.live.extractor.statusCode': 'Status code',
} as const satisfies Catalog;
