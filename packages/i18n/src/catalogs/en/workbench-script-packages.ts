/**
 * Script-packages family — the PackageLibrary singleton tab
 * (`workbench/components/script-packages/`): the package list rail,
 * the editor pane, and the three-step primer.
 *
 * Raw by design inside keyed sentences: the `oh.require` /
 * `module.exports` API vocabulary and the `package_name` identifier
 * example (rendered as code chips or code-block illustrations — the
 * primer's code blocks themselves stay raw per the illustration
 * boundary), and {name} holes carrying package names.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'Package Library',
  'workbench.scriptPackages.new': 'New',
  'workbench.scriptPackages.searchPlaceholder': 'Find packages...',
  'workbench.scriptPackages.emptyNone': 'No packages yet',
  'workbench.scriptPackages.emptyNoMatch': 'No package found',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'Reuse scripts across requests with packages',
  'workbench.scriptPackages.primer.step1': '1. Create a package with some reusable code.',
  'workbench.scriptPackages.primer.step2': '2. Export the functions you want to reuse.',
  'workbench.scriptPackages.primer.step3': '3. Use oh.require to load the package in your request scripts.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'Package name',
  'workbench.scriptPackages.descriptionPlaceholder': 'Description (optional)',
  'workbench.scriptPackages.descriptionAria': 'Package description',
  'workbench.scriptPackages.save': 'Save',
  'workbench.scriptPackages.deleteTitle': 'Delete this package?',
  'workbench.scriptPackages.deleteDescription': 'Scripts calling oh.require on it will start failing.',
  'workbench.scriptPackages.delete': 'Delete',
  'workbench.scriptPackages.loadFromScriptPrefix': 'Load it from a script with',
  'workbench.scriptPackages.exportViaInfix': '— export the public surface via',
  'workbench.scriptPackages.sourcePlaceholder': 'Write reusable JavaScript, then export with module.exports.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': 'Discard unsaved changes?',
  'workbench.scriptPackages.discardContent': 'The current package has unsaved edits. Switching discards them.',
  'workbench.scriptPackages.discardOk': 'Discard',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired': 'Package name is required — it is the oh.require key.',
  'workbench.scriptPackages.saved': 'Package saved',
  'workbench.scriptPackages.duplicateName': 'A package named “{name}” already exists in this workspace.',
  'workbench.scriptPackages.notFound': 'Package not found — it may have been deleted.',
  'workbench.scriptPackages.saveFailed': 'Save failed',
  'workbench.scriptPackages.deleted': 'Package deleted',
  'workbench.scriptPackages.deleteFailed': 'Delete failed',
} as const satisfies Catalog;
