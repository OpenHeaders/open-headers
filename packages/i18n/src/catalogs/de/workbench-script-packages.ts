/**
 * Script-packages family — German. Mirrors
 * `catalogs/en/workbench-script-packages.ts` key for key. Raw by
 * design inside keyed sentences: the `oh.require` / `module.exports`
 * API vocabulary (code chips), and {name} holes carrying package
 * names. Package = das Paket (established German dev term — no
 * loanword needed); Paketbibliothek per the chrome mint.
 */

import type { Catalog } from '../../types';

export const workbenchScriptPackages = {
  // ── List rail ──────────────────────────────────────────────────────
  'workbench.scriptPackages.title': 'Paketbibliothek',
  'workbench.scriptPackages.new': 'Neu',
  'workbench.scriptPackages.searchPlaceholder': 'Pakete finden...',
  'workbench.scriptPackages.emptyNone': 'Noch keine Pakete',
  'workbench.scriptPackages.emptyNoMatch': 'Kein Paket gefunden',

  // ── Primer ─────────────────────────────────────────────────────────
  'workbench.scriptPackages.primer.title': 'Nutze Scripts mit Paketen über Anfragen hinweg wieder',
  'workbench.scriptPackages.primer.step1': '1. Erstelle ein Paket mit etwas wiederverwendbarem Code.',
  'workbench.scriptPackages.primer.step2': '2. Exportiere die Funktionen, die du wiederverwenden willst.',
  'workbench.scriptPackages.primer.step3': '3. Nutze oh.require, um das Paket in deinen Anfrage-Scripts zu laden.',

  // ── Editor pane ────────────────────────────────────────────────────
  'workbench.scriptPackages.nameAria': 'Name des Pakets',
  'workbench.scriptPackages.descriptionPlaceholder': 'Beschreibung (optional)',
  'workbench.scriptPackages.descriptionAria': 'Beschreibung des Pakets',
  'workbench.scriptPackages.save': 'Speichern',
  'workbench.scriptPackages.deleteTitle': 'Dieses Paket löschen?',
  'workbench.scriptPackages.deleteDescription': 'Scripts, die oh.require darauf aufrufen, werden dann fehlschlagen.',
  'workbench.scriptPackages.delete': 'Löschen',
  'workbench.scriptPackages.loadFromScriptPrefix': 'Lade es aus einem Script mit',
  'workbench.scriptPackages.exportViaInfix': '— exportiere die öffentliche Schnittstelle über',
  'workbench.scriptPackages.sourcePlaceholder':
    'Schreibe wiederverwendbares JavaScript und exportiere dann mit module.exports.',

  // ── Discard-on-switch confirm ──────────────────────────────────────
  'workbench.scriptPackages.discardTitle': 'Ungespeicherte Änderungen verwerfen?',
  'workbench.scriptPackages.discardContent': 'Das aktuelle Paket hat ungespeicherte Änderungen. Wechseln verwirft sie.',
  'workbench.scriptPackages.discardOk': 'Verwerfen',

  // ── Write outcomes ─────────────────────────────────────────────────
  'workbench.scriptPackages.nameRequired':
    'Der Name des Pakets ist erforderlich — er ist der Schlüssel für oh.require.',
  'workbench.scriptPackages.saved': 'Paket gespeichert',
  'workbench.scriptPackages.duplicateName': 'Ein Paket namens „{name}“ existiert in diesem Arbeitsbereich bereits.',
  'workbench.scriptPackages.notFound': 'Paket nicht gefunden — es wurde möglicherweise gelöscht.',
  'workbench.scriptPackages.saveFailed': 'Speichern fehlgeschlagen',
  'workbench.scriptPackages.deleted': 'Paket gelöscht',
  'workbench.scriptPackages.deleteFailed': 'Löschen fehlgeschlagen',
} as const satisfies Catalog;
