/**
 * Workbench variables station — German. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, {name} /
 * {message} holes. Page titles reuse the sidebar names minted by the
 * variables doc body (Arbeitsbereich-Variablen, Live-Variablen,
 * Umgebungen, `Vault` raw); the Scope panel section titles reuse its
 * „Im Geltungsbereich“ / „Alle Geltungsbereiche“ labels,
 * Geltungsbereich throughout (separate-referent law), einfache
 * Referenz for bare refs, Namensraum for namespace. Lowercase en
 * `vault` in prose stays `vault` (per-case token law — Der vault
 * konnte …); capitalized `Vault` stays Vault. Der Seed raw; capture
 * = die Erfassung (panel-docs mint). MINTS: resolver = der Resolver
 * (raw); binding = die Bindung; Überschreibung = the live override
 * marker (rides the Überschreiben op-noun family).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': 'Variable',
  'workbench.variables.table.headerSecret': 'Secret',
  'workbench.variables.table.headerValue': 'Wert',
  'workbench.variables.table.namePlaceholder': 'Name',
  'workbench.variables.table.valuePlaceholder': 'Wert',
  'workbench.variables.table.addVariable': 'Variable hinzufügen…',
  'workbench.variables.table.addSecret': 'Secret hinzufügen…',
  'workbench.variables.table.enableRow': 'Variable aktivieren',
  'workbench.variables.table.disableRow': 'Variable deaktivieren',
  'workbench.variables.table.markSensitive': 'Als sensibel markieren',
  'workbench.variables.table.unmarkSensitive': 'Markierung als sensibel aufheben',
  'workbench.variables.table.showValue': 'Wert anzeigen',
  'workbench.variables.table.hideValue': 'Wert verbergen',
  'workbench.variables.table.kindText': 'Text',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': 'Zertifikat',
  'workbench.variables.table.certPlaceholder': 'Zertifikat (PEM)',
  'workbench.variables.table.certKeyPlaceholder': 'Privater Schlüssel (PEM)',
  'workbench.variables.table.passphrasePlaceholder': 'Passphrase des Schlüssels (optional)',
  'workbench.variables.table.showCertificate': 'Zertifikat anzeigen',
  'workbench.variables.table.hideCertificate': 'Zertifikat verbergen',
  'workbench.variables.table.seedPlaceholder': 'Base32-Seed',
  'workbench.variables.table.showSeed': 'Seed anzeigen',
  'workbench.variables.table.hideSeed': 'Seed verbergen',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} Stellen · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} Stellen · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': 'Aussteller',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': 'VARIABLEN ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': 'Arbeitsbereich-Variablen',
  'workbench.variables.workspace.description':
    'Geteilt über alle Umgebungen dieses Arbeitsbereichs. Niedrigste Priorität — überschrieben von den ' +
    'Geltungsbereichen Sammlung, Umgebung und vault.',
  'workbench.variables.workspace.saveFailed': 'Arbeitsbereich-Variablen konnten nicht gespeichert werden',
  'workbench.variables.workspace.saveFailedDetail':
    'Arbeitsbereich-Variablen konnten nicht gespeichert werden: {message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': 'Umgebung nicht gefunden.',
  'workbench.variables.environment.activeTag': 'Aktiv',
  'workbench.variables.environment.defaultTag': 'Standard',
  'workbench.variables.environment.defaultTooltip':
    'Der Resolver fällt hierauf zurück, wenn der aktiven Umgebung eine Variable fehlt.',
  'workbench.variables.environment.setActive': 'Aktiv setzen',
  'workbench.variables.environment.setDefault': 'Als Standard festlegen',
  'workbench.variables.environment.unsetDefault': 'Standard aufheben',
  'workbench.variables.environment.setDefaultTooltip':
    'Als Standard festlegen — der Resolver fällt hierauf zurück, wenn der aktiven Umgebung eine Variable fehlt.',
  'workbench.variables.environment.unsetDefaultTooltip':
    'Als Standard aufheben — der Resolver fällt nicht mehr auf diese Umgebung zurück.',
  'workbench.variables.environment.deletedElsewhere': 'Die Umgebung wurde in einem anderen Tab gelöscht',
  'workbench.variables.environment.updateFailed': 'Umgebung konnte nicht aktualisiert werden',
  'workbench.variables.environment.updateFailedDetail': 'Umgebung konnte nicht aktualisiert werden: {message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'Sammlung nicht gefunden.',
  'workbench.variables.collection.title': '{name} · Variablen',
  'workbench.variables.collection.descriptionRule':
    'Variablen, die jeder Regel in dieser Sammlung zur Verfügung stehen. Überschrieben von den ' +
    'Geltungsbereichen Umgebung und vault; überschreiben den Geltungsbereich des Arbeitsbereichs. Im Klartext ' +
    'gespeichert — nutze den Vault für Secrets.',
  'workbench.variables.collection.descriptionRequest':
    'Variablen, die jeder Anfrage in dieser Sammlung zur Verfügung stehen. Überschrieben von den ' +
    'Geltungsbereichen Umgebung und vault; überschreiben den Geltungsbereich des Arbeitsbereichs. Im Klartext ' +
    'gespeichert — nutze den Vault für Secrets.',
  'workbench.variables.collection.descriptionTemplate':
    'Variablen, die jeder Vorlage in dieser Sammlung zur Verfügung stehen. Überschrieben von den ' +
    'Geltungsbereichen Umgebung und vault; überschreiben den Geltungsbereich des Arbeitsbereichs. Im Klartext ' +
    'gespeichert — nutze den Vault für Secrets.',
  'workbench.variables.collection.deletedElsewhere': 'Die Sammlung wurde in einem anderen Tab gelöscht',
  'workbench.variables.collection.saveFailed': 'Sammlungsvariablen konnten nicht gespeichert werden',
  'workbench.variables.collection.saveFailedDetail': 'Sammlungsvariablen konnten nicht gespeichert werden: {message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Vault-Secrets sind im Ruhezustand verschlüsselt, verlassen dieses Gerät nie und haben Vorrang vor jedem ' +
    'anderen Geltungsbereich.',
  'workbench.variables.vault.cipherLocked':
    'Der Secret-Speicher ist gesperrt — das System hat den Zugriff auf seinen Schlüsselbund verweigert, daher ' +
    'können Secrets aus dem vault in dieser Sitzung weder gelesen noch gespeichert werden.',
  'workbench.variables.vault.cipherLockedRelaunch': 'App neu starten',
  'workbench.variables.vault.lockedTitle': 'Vault gesperrt — Schlüssel für den Ruhezustand verloren',
  'workbench.variables.vault.lockedDescription':
    'Die Secrets in diesem vault sind weiterhin auf diesem Gerät gespeichert, lassen sich aber nicht mehr ' +
    'entschlüsseln: Der Schlüssel für den Ruhezustand, der sie versiegelt hat, ist weg (gelöschte ' +
    'Browserdaten, ein neues Profil oder ein zurückgesetzter Erweiterungsschlüssel). Die Bearbeitung ist ' +
    'deaktiviert, damit ein neuer Eintrag die versiegelten Daten nicht überschreiben kann. Gib die Secrets ' +
    'erneut ein, um den vault zu entsperren — die bestehenden Einträge werden ersetzt.',
  'workbench.variables.vault.secretsCount': 'SECRETS ({strings} String · {totps} TOTP · {certs} Zertifikat)',
  'workbench.variables.vault.saveFailed': 'Der vault konnte nicht gespeichert werden',
  'workbench.variables.vault.saveFailedDetail': 'Der vault konnte nicht gespeichert werden: {message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Live-Variablen',
  'workbench.variables.live.newVariable': 'Neue Live-Variable',
  'workbench.variables.live.descriptionPrefix':
    'Jede Bindung verknüpft einen Namen mit einer Erfassung aus einem Workflow (einer geplanten ' +
    'Anfragekette). In Regeln und Anfragen referenziert als',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': 'Name',
  'workbench.variables.live.headerValue': 'Wert',
  'workbench.variables.live.headerWorkflow': 'Workflow',
  'workbench.variables.live.empty':
    'Noch keine Live-Variablen. Erstelle eine, um einen Namen an den erfassten Wert eines Workflows zu binden.',
  'workbench.variables.live.draftMarker': 'Entwurf',
  'workbench.variables.live.offMarker': 'aus',
  'workbench.variables.live.overrideMarker': 'Überschreibung',
  'workbench.variables.live.clickEyeToReveal': 'Klicke auf das Auge zum Aufdecken',
  'workbench.variables.live.showValue': 'Wert anzeigen',
  'workbench.variables.live.hideValue': 'Wert verbergen',
  'workbench.variables.live.notCapturedYet': 'noch nicht erfasst',
  'workbench.variables.live.missingWorkflow': 'Workflow fehlt',
  'workbench.variables.live.refreshNow': 'Workflow jetzt aktualisieren',
  'workbench.variables.live.refreshAria': '{name} aktualisieren',
  'workbench.variables.live.editBinding': 'Bindung bearbeiten (Name / aktiv / Überschreibung)',
  'workbench.variables.live.editAria': '{name} bearbeiten',
  'workbench.variables.live.delete': 'Löschen',
  'workbench.variables.live.deleteAria': '{name} löschen',
  'workbench.variables.live.deleteFailed': '„{name}“ konnte nicht gelöscht werden',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': 'Umgebung',
  'workbench.variables.panel.scope.collection': 'Sammlung',
  'workbench.variables.panel.scope.workspace': 'Arbeitsbereich',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': 'Im Geltungsbereich',
  'workbench.variables.panel.inContextTitleNamed': 'Im Geltungsbereich: {name}',
  'workbench.variables.panel.inContextSummary':
    'Die Variablen, die die aktive Regel, Anfrage oder Vorlage referenziert — jede durch alle ' +
    'Geltungsbereiche aufgelöst, sodass du genau den Wert siehst, der gelten wird. Leer, bis du eine öffnest.',
  'workbench.variables.panel.allScopesTitle': 'Alle Geltungsbereiche',
  'workbench.variables.panel.allScopesSummary':
    'Jede Variable, die über alle Geltungsbereiche hinweg definiert ist, gruppiert nach ' +
    'Auflösungspriorität. Öffne das (i) eines Geltungsbereichs, um zu sehen, wie du ihn referenzierst und wo ' +
    'er rangiert.',
  'workbench.variables.panel.sectionAboutAria': 'Über {title}',
  'workbench.variables.panel.scopeAboutAria': 'Über {scope}-Variablen',
  'workbench.variables.panel.scopeSummary.vault':
    'Secrets pro Nutzer, gespeichert in deinem vault und nie synchronisiert.',
  'workbench.variables.panel.scopeSummary.environment':
    'Variablen aus der aktiven Umgebung, mit Rückfall auf die Standard-Umgebung.',
  'workbench.variables.panel.scopeSummary.collection': 'Variablen, begrenzt auf die aktive Sammlung.',
  'workbench.variables.panel.scopeSummary.workspace': 'Variablen, geteilt über den ganzen Arbeitsbereich.',
  'workbench.variables.panel.scopeSummary.live': 'Ein Workflow-gestützter Wert, aufgelöst aus dem letzten Lauf.',
  'workbench.variables.panel.scopeInfo.title': '{label} {qualifier}',
  'workbench.variables.panel.scopeInfo.qualifierSecret': 'Secret',
  'workbench.variables.panel.scopeInfo.qualifierVariable': 'Variable',
  'workbench.variables.panel.scopeInfo.writePrefix': 'Schreibe',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': 'nur — nicht einfach als',
  'workbench.variables.panel.scopeInfo.orJustMiddle': 'oder einfach',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': 'Die einfache Referenz',
  'workbench.variables.panel.scopeInfo.bareSuffix': 'löst sich nach Priorität auf:',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live steht außerhalb dieser Reihenfolge.',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · Standard: {default}',
  'workbench.variables.panel.env.subtitleNoneDefault': 'Keine Umgebung · Standard: {default}',
  'workbench.variables.panel.env.subtitleNone': 'Keine Umgebung',
  'workbench.variables.panel.env.editTooltip': 'Den Editor für Umgebungsvariablen öffnen',
  'workbench.variables.panel.env.createTooltip': 'Erstelle deine erste Umgebung',
  'workbench.variables.panel.env.selectTooltip': 'Die aktive Umgebung wählen',
  'workbench.variables.panel.collection.noneActive': 'Keine aktive Sammlung',
  'workbench.variables.panel.live.resolvedCount': '{resolved}/{total} aufgelöst',
  'workbench.variables.panel.live.noneDefined': 'keine Live-Variablen definiert',
  'workbench.variables.panel.action.edit': 'Bearbeiten',
  'workbench.variables.panel.action.editTooltip': 'Den Editor für {scope}-Variablen öffnen',
  'workbench.variables.panel.action.create': 'Erstellen',
  'workbench.variables.panel.action.select': 'Auswählen',
  'workbench.variables.panel.emptyScopeSecrets': 'Keine Secrets definiert.',
  'workbench.variables.panel.emptyScopeVariables': 'Keine Variablen definiert.',
  'workbench.variables.panel.openHint':
    'Öffne eine Anfrage oder Regel, um die Variablen zu sehen, die sie referenziert.',
  'workbench.variables.panel.noneReferenced': 'Keine Variablen in dieser {noun} referenziert.',
  'workbench.variables.panel.noun.rule': 'Regel',
  'workbench.variables.panel.noun.request': 'Anfrage',
  'workbench.variables.panel.noun.template': 'Vorlage',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} Variable aufgelöst', other: 'Alle {count} Variablen aufgelöst' }),
  'workbench.variables.panel.unresolvedCount': '{count} nicht aufgelöst',
  'workbench.variables.panel.valueUnresolved': 'nicht aufgelöst',
  'workbench.variables.panel.valueEmpty': '(leer)',
  'workbench.variables.panel.showValue': 'Wert anzeigen',
  'workbench.variables.panel.hideValue': 'Wert verbergen',
  'workbench.variables.panel.copyValue': 'Wert kopieren',
  'workbench.variables.panel.copied': 'Kopiert',
  'workbench.variables.panel.errors.title': 'Auflösungsprobleme ({count})',
  'workbench.variables.panel.errors.referenceTooltip': 'Die rohe Referenz innerhalb von {{…}}',
  'workbench.variables.panel.errors.reason.unresolved': 'nicht aufgelöst',
  'workbench.variables.panel.errors.reason.unsetInScope': 'nicht im Geltungsbereich',
  'workbench.variables.panel.errors.reason.unknownNamespace': 'unbekannter Namensraum',
  'workbench.variables.panel.errors.reason.stepOutOfContext': 'Schritt-Referenz außerhalb des Geltungsbereichs',
  'workbench.variables.panel.errors.reason.empty': 'leer',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': 'ungültiger Wert',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Code kopieren',
  'workbench.totpPreview.copied': 'Kopiert',
  'workbench.totpPreview.refreshesTooltip': 'Aktualisiert sich in {seconds}s',
  'workbench.totpPreview.refreshesAria': 'Der TOTP-Code aktualisiert sich in {seconds} Sekunden',
} as const satisfies Catalog;
