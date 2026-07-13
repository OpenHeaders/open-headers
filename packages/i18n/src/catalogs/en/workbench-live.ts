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
  'workbench.editors.live.refreshPolicy.secondsUnit': 'seconds',
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
} as const satisfies Catalog;
