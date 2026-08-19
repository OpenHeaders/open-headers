/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane. Compact mirrors of workbench controls reuse the
 * `workbench.editors.rule.fields.*` keys directly (S35 field-key
 * reuse law) — only popover-own copy (hints, toasts, snapshot
 * chrome) lives here.
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  // Raw by design: rule/collection/folder/header/param names, URLs,
  // `{{template}}` chips, status codes + MIME values, code/JSON example
  // placeholders (workbench keeps its message-filter examples raw too),
  // the CSS / JS / GraphQL / cURL-style proper nouns, and core
  // validator sentences (`validateHeaderName` / capability reasons —
  // the core headers.ts plane is a later station). Field labels,
  // operation options and placeholders that mirror a workbench control
  // reuse that control's `workbench.editors.rule.fields.*` key
  // (names-its-referent — the popover is the compact form of the same
  // control).
  'panel.quickEditor.clearRuleNameAria': 'Clear rule name',
  'panel.quickEditor.renameTitle': '{name} — click to rename',
  'panel.quickEditor.enabledOn': 'Enabled',
  'panel.quickEditor.enabledOff': 'Disabled',
  'panel.quickEditor.ruleEnabledAria': 'Rule enabled',
  'panel.quickEditor.openInTab': 'Open in tab',
  'panel.quickEditor.openInWorkspace': 'Open in workspace →',
  'panel.quickEditor.saveButton': 'Save',
  'panel.quickEditor.openToInspect': 'Open in workspace to inspect or change this rule.',
  'panel.quickEditor.variableMissing': 'Variable missing — hover the red reference to create it and enable Save.',
  'panel.quickEditor.retargetHint': 'Adjust the conditions below to retarget the rule.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Rule updated',
  'panel.quickEditor.toast.ruleNotFound': 'Rule not found — it may have been deleted.',
  'panel.quickEditor.toast.saveFailed': 'Save failed',
  'panel.quickEditor.toast.toggleFailed': 'Could not toggle the rule',
  'panel.quickEditor.toast.changedElsewhere': 'Rule changed elsewhere — close and reopen the popover.',
  'panel.quickEditor.toast.noWorkspace': 'No active workspace',
  'panel.quickEditor.toast.collectionCreateFailed': 'Failed to create a collection for the rule',
  'panel.quickEditor.toast.folderCreateFailed': 'Couldn’t create the “{name}” folder — saving at the collection root.',
  'panel.quickEditor.toast.createFailed': 'Failed to create rule',
  'panel.quickEditor.toast.createdDraft': 'Rule created as a draft — publish it from the workspace.',
  'panel.quickEditor.toast.created': 'Rule created',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Choose where the rule is saved',
  'panel.quickEditor.destination.savingTo': 'Saving to',
  'panel.quickEditor.destination.newTag': 'new',
  'panel.quickEditor.destination.autoNamed': 'Auto — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Auto — collection root',
  'panel.quickEditor.destination.root': 'Collection root',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Show and edit when this rule fires',
  'panel.quickEditor.conditions.label': 'Conditions',
  'panel.quickEditor.conditions.none': 'none — matches no requests',

  // Header quick editors (single-mod hover + whole-list + create).
  // Operation options reuse the workbench op keys; validator sentences
  // from core ride raw — only the UI fallbacks are keyed here.
  'panel.quickEditor.header.addHeader': 'Add header',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Merge separator',
  'panel.quickEditor.header.directionRequest': 'Request',
  'panel.quickEditor.header.directionResponse': 'Response',
  'panel.quickEditor.validation.nameRequired': 'Header name is required.',
  'panel.quickEditor.validation.invalidName': 'Invalid header name.',
  'panel.quickEditor.validation.invalidValue': 'Invalid header value.',
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Switch to {operation}',

  // Typed bodies — popover-only copy. Field labels / option words that
  // mirror a workbench control reuse its key (see the station comment
  // above); the ws direction words differ from the workbench's
  // parenthesized pair, so they are popover-local (glyphs ride raw).
  'panel.quickEditor.redirect.targetPlaceholder': 'e.g. https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint': 'Matching requests are sent to this URL before they reach the network.',
  'panel.quickEditor.delay.hint':
    'Navigations are delayed up to 30,000 ms; XHR/fetch is capped at 5,000 ms. Sub-resources are not delayed.',
  'panel.quickEditor.block.editHint': 'Matching requests are blocked before they reach the network.',
  'panel.quickEditor.block.blockRequestsTo': 'Block requests to',
  'panel.quickEditor.block.createHint':
    'Matching requests are canceled before they leave the browser — the page sees a network error.',
  'panel.quickEditor.response.tagModify': 'Modify',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    'This rule builds its response with JavaScript. Open in workspace to edit the script.',
  'panel.quickEditor.requestBody.hint': "Matching requests are sent with this body instead of the page's.",
  'panel.quickEditor.requestBody.dynamicBody':
    'This rule builds its body with JavaScript. Open in workspace to edit the script.',
  'panel.quickEditor.inject.sourceUrlLabel': 'Source URL',
  'panel.quickEditor.inject.loadsStylesheetHint': 'Matching pages load this stylesheet as they load.',
  'panel.quickEditor.inject.loadsScriptHint': 'Matching pages load this script as they load.',
  'panel.quickEditor.inject.injectedHint': 'Injected into matching pages as they load.',
  'panel.quickEditor.message.incoming': 'Incoming ⬇',
  'panel.quickEditor.message.outgoing': 'Outgoing ⬆',
  'panel.quickEditor.message.injectedConnectionsHint': 'Injected on matching connections before listeners see it.',
  'panel.quickEditor.message.injectedStreamsHint': 'Injected on matching streams before listeners see it.',
  'panel.quickEditor.message.replacedFramesHint':
    'Matching frames are replaced with this payload before they are seen.',
  'panel.quickEditor.message.replacedEventsHint':
    'Matching events are replaced with this payload before they are seen.',
  'panel.quickEditor.message.droppedFramesHint': 'Matching frames are dropped before they are seen.',
  'panel.quickEditor.message.droppedEventsHint': 'Matching events are dropped before they are seen.',
  'panel.quickEditor.queryParam.addAction': 'Add action',
  'panel.quickEditor.queryParam.removeAllWarning':
    'Remove All strips the entire query string — the other operations in this rule will be ignored.',
  'panel.quickEditor.auth.challengesHint':
    'Answers server (401) and proxy (407) authentication challenges on matching requests.',

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  // Raw by design: header names/values, `{{template}}` text, the
  // sibling-mod rows (req / res wire chips, op glyphs, the wire-shaped
  // hover title) and the snapshot byline's direction word
  // (request/response — wire vocabulary beside the raw header name).
  'panel.ruleHover.tagRuleEdited': 'Rule edited',
  'panel.ruleHover.tagVariableChanged': 'Variable changed',
  'panel.ruleHover.tagDeleted': 'Deleted',
  'panel.ruleHover.tagDisabled': 'Disabled',
  'panel.ruleHover.tagModRemoved': 'Mod removed',
  'panel.ruleHover.tagConditionsMismatch': "Conditions don't match",
  'panel.ruleHover.tagWontFire': "Won't fire",
  'panel.ruleHover.tagTitle.ruleDisabled': "Rule's enabled flag is off — it will not fire on any future request.",
  'panel.ruleHover.tagTitle.modGone': 'The matching modification was removed from the rule.',
  'panel.ruleHover.tagTitle.conditionsMismatch': "Rule's conditions no longer cover this URL.",
  'panel.ruleHover.tagTitle.nameUnresolved':
    "Header-name template can't be fully resolved (e.g. references a TOTP). DNR rejects literal template chars in header names.",
  'panel.ruleHover.tagTitle.valueUnresolved': "Header-value template can't be fully resolved.",
  'panel.ruleHover.tagTitle.separatorUnresolved': "Merge-separator template can't be fully resolved.",
  'panel.ruleHover.deletedBody': 'This rule has been deleted. The capture above shows what it did when it fired.',
  'panel.ruleHover.modRemovedBody':
    'The matching modification has been removed from the rule. Open in workspace to recreate or adjust it.',

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'inject',
  'panel.ruleHover.snapshot.opOverride': 'override',
  'panel.ruleHover.snapshot.opAppend': 'append',
  'panel.ruleHover.snapshot.opMerge': 'merge',
  'panel.ruleHover.snapshot.opRemove': 'remove',
  'panel.ruleHover.snapshot.templateTitle': 'Template before variable resolution at fire time',
  'panel.ruleHover.snapshot.nameDriftTitle':
    'Same template — a referenced variable now resolves to a different header name',
  'panel.ruleHover.snapshot.cancels': 'cancels "{rule}"',
  'panel.ruleHover.snapshot.original': 'Original',
  'panel.ruleHover.snapshot.now': 'Now',
  'panel.ruleHover.snapshot.future': 'Future',
  'panel.ruleHover.snapshot.futureTitle': 'What the next matching request would get',
  'panel.ruleHover.snapshot.removed': 'removed',
  'panel.ruleHover.snapshot.empty': '(empty)',
  'panel.ruleHover.snapshot.totpNote': 'TOTP / deferred refs are resolved at request time and not captured here.',
  'panel.ruleHover.snapshot.alsoByRule': 'Also by this rule on this request',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': "rule was deleted — won't fire",
  'panel.ruleHover.future.ruleDisabled': "rule is disabled — won't fire",
  'panel.ruleHover.future.modGone': 'this modification was removed from the rule',
  'panel.ruleHover.future.conditionsMismatch': "rule's conditions no longer match this URL",
  'panel.ruleHover.future.nameUnresolved': "header name template can't be resolved — rule won't fire",
  'panel.ruleHover.future.valueUnresolved': "value template can't be resolved — rule won't fire",
  'panel.ruleHover.future.separatorUnresolved': "mergeSeparator template can't be resolved — rule won't fire",
  'panel.ruleHover.future.templateTitle': 'Template: {template}',
} as const satisfies Catalog;
