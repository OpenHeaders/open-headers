/**
 * Workbench chrome — the workspace plane — German. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); die Org stays the raw product noun
 * (f., shared-workspace precedent); das Back-end (register), `OAuth`,
 * format names (PNG, JPEG, WebP, SVG) and the `KB` unit ride raw as
 * en writes them. Runtime-quoted names use „…“ (S57); neuter {unit}
 * follows the panel precedent.
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'Arbeitsbereiche',
  'workbench.workspace.newWorkspace': 'Neuer Arbeitsbereich',
  'workbench.workspace.intro':
    'Jeder Arbeitsbereich enthält seine eigenen Regeln, Sammlungen, Ordner, Vorlagen, Variablen und den ' +
    'Verlauf der Testläufe. Ziehe zum Neuordnen.',
  'workbench.workspace.deleteTitle': '„{name}“ löschen?',
  'workbench.workspace.deleteBody':
    'Löscht den Arbeitsbereich dauerhaft, mit allen Regeln, Sammlungen, Ordnern, Vorlagen, Variablen und dem ' +
    'Verlauf der Testläufe. Diese Aktion kann nicht rückgängig gemacht werden.',
  'workbench.workspace.deleteOk': 'Löschen',
  'workbench.workspace.deleteFailed': 'Arbeitsbereich konnte nicht gelöscht werden',
  'workbench.workspace.deletedToast': '„{name}“ gelöscht',
  'workbench.workspace.createOk': 'Erstellen',
  'workbench.workspace.createFailed': 'Arbeitsbereich konnte nicht erstellt werden',
  'workbench.workspace.createdToastPrefix': 'Arbeitsbereich erstellt',
  'workbench.workspace.duplicateTitle': '„{name}“ duplizieren',
  'workbench.workspace.duplicateTitleFallback': 'Arbeitsbereich duplizieren',
  'workbench.workspace.duplicateOk': 'Duplizieren',
  'workbench.workspace.duplicateFailed': 'Arbeitsbereich konnte nicht dupliziert werden',
  'workbench.workspace.duplicatedToast': '„{source}“ → „{name}“ dupliziert',
  'workbench.workspace.publishFailed': 'Arbeitsbereich konnte nicht veröffentlicht werden',
  'workbench.workspace.publishedToast': '„{name}“ in {org} veröffentlicht',
  'workbench.workspace.selectedOrgFallback': 'die ausgewählte Org',
  'workbench.workspace.editTitle': 'Arbeitsbereich bearbeiten',
  'workbench.workspace.saveOk': 'Speichern',
  'workbench.workspace.updatedToast': '„{name}“ aktualisiert',
  'workbench.workspace.deletedElsewhere': 'Dieser Arbeitsbereich wurde aus einem anderen Tab gelöscht',
  'workbench.workspace.updateFailed': 'Arbeitsbereich konnte nicht aktualisiert werden',
  'workbench.workspace.updateFailedWithMessage': 'Arbeitsbereich konnte nicht aktualisiert werden: {message}',
  'workbench.workspace.newWorkspacesGoTo': 'Neue Arbeitsbereiche gehen an',
  'workbench.workspace.orgPrefHint': 'Jederzeit änderbar — bestehende Arbeitsbereiche bleiben, wo sie sind.',
  'workbench.workspace.otherWorkspaces': 'Weitere Arbeitsbereiche',
  'workbench.workspace.dragToReorder': 'Ziehe zum Neuordnen',
  'workbench.workspace.activePill': 'Aktiv',
  'workbench.workspace.switch': 'Wechseln',
  'workbench.workspace.renameAria': 'Arbeitsbereich umbenennen',
  'workbench.workspace.duplicateAria': 'Arbeitsbereich duplizieren',
  'workbench.workspace.publishAria': 'Arbeitsbereich in ein Back-end veröffentlichen',
  'workbench.workspace.deleteAria': 'Arbeitsbereich löschen',
  'workbench.workspace.prefixLabel': 'Präfix',
  'workbench.workspace.nameLabel': 'Name',
  'workbench.workspace.nameRequired': 'Ein Name ist erforderlich',
  'workbench.workspace.nameTooLong': 'Halte Namen unter 60 Zeichen',
  'workbench.workspace.namePlaceholder': 'Mein Arbeitsbereich',
  'workbench.workspace.descriptionLabel': 'Beschreibung (optional)',
  'workbench.workspace.copyOfName': 'Kopie von {name}',
  'workbench.workspace.copyOfPlaceholder': 'Kopie von …',
  'workbench.workspace.intoOrg': 'In die Org',
  'workbench.workspace.includeSecrets': 'Inhalt des vault einschließen (Secrets)',
  'workbench.workspace.includeSecretsHint':
    'Gib Secrets in der Kopie bei Bedarf neu ein. OAuth-Verbindungen werden in jedem Fall neu autorisiert.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': '„{name}“ zum aktiven Arbeitsbereich machen?',
  'workbench.workspace.makeActiveBody':
    'Das Popup, das Seitenpanel und alle neuen {units}, die nicht an einen bestimmten Arbeitsbereich ' +
    'angeheftet sind, wechseln zu „{name}“.',
  'workbench.workspace.makeActiveOk': 'Aktiv machen',
  'workbench.workspace.cancel': 'Abbrechen',
  'workbench.workspace.nowActiveToast': '„{name}“ ist jetzt der aktive Arbeitsbereich',
  'workbench.workspace.switcherAria': 'Dieses {unit} bearbeitet den Arbeitsbereich: {name}. Klicke zum Wechseln.',

  // ── Workspace: publish modal ────────────────────────────────────────
  'workbench.workspace.publishTitle': '„{name}“ veröffentlichen',
  'workbench.workspace.publishTitleFallback': 'Arbeitsbereich veröffentlichen',
  'workbench.workspace.publishToOk': 'In {org} veröffentlichen',
  'workbench.workspace.publishOk': 'Veröffentlichen',
  'workbench.workspace.publishIntro':
    'Veröffentlichen kopiert diesen Arbeitsbereich in die gewählte Org, wo er über deren Back-end ' +
    'synchronisiert wird. Das Original bleibt hier.',
  'workbench.workspace.toOrg': 'In die Org',
  'workbench.workspace.pickTargetOrg': 'Wähle eine Ziel-Org',
  'workbench.workspace.includeSecretsPublishHint':
    'Gib Secrets in der veröffentlichten Kopie bei Bedarf neu ein. OAuth-Verbindungen werden in jedem Fall ' +
    'neu autorisiert.',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Logo',
  'workbench.workspace.org.logoAria': 'Das Logo dieser Organisation ändern',
  'workbench.workspace.org.renameButton': 'Umbenennen',
  'workbench.workspace.org.renameAria': 'Diese Organisation umbenennen',
  'workbench.workspace.org.renameTitle': '{hint} umbenennen',
  'workbench.workspace.org.renameTitleFallback': 'Umbenennen',
  'workbench.workspace.org.nameUpdated': 'Name aktualisiert',
  'workbench.workspace.org.identityLoading': 'Die Identität lädt noch — versuche es gleich noch einmal',
  'workbench.workspace.org.renameExtra':
    'Erscheint im Arbeitsbereich-Umschalter und bei allen, mit denen du Arbeitsbereiche teilst.',
  'workbench.workspace.org.nameTooLong': 'Halte Namen unter {max} Zeichen',
  'workbench.workspace.org.namePlaceholder': 'Mein Arbeits-Laptop',
  'workbench.workspace.org.logoTitle': 'Logo von {hint}',
  'workbench.workspace.org.logoTitleFallback': 'Logo der Organisation',
  'workbench.workspace.org.logoAlt': 'Aktuelles Logo der Organisation',
  'workbench.workspace.org.replace': 'Ersetzen…',
  'workbench.workspace.org.upload': 'Hochladen…',
  'workbench.workspace.org.remove': 'Entfernen',
  'workbench.workspace.org.logoUpdated': 'Logo aktualisiert',
  'workbench.workspace.org.logoRemoved': 'Logo entfernt',
  'workbench.workspace.org.fileReadFailed': 'Diese Datei konnte nicht gelesen werden.',
  'workbench.workspace.org.logoHint':
    'PNG, JPEG, WebP oder SVG, bis {kb} KB. Quadratische Bilder wirken am besten. Wird allen gezeigt, die ' +
    'sich mit dieser Organisation synchronisieren.',
  'workbench.workspace.org.logoReject.notImage': 'Diese Datei konnte nicht als Bild gelesen werden.',
  'workbench.workspace.org.logoReject.corruptImage': 'Diese Datei ist kein gültiges Bild ihres angegebenen Typs.',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'Verwende eine PNG-, JPEG-, WebP- oder SVG-Datei.',
  'workbench.workspace.org.logoReject.tooLarge': 'Halte das Logo unter {kb} KB.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'Dieses SVG enthält Skripte oder externe Verweise — exportiere ein einfaches, in sich geschlossenes SVG.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'Du hast jetzt Zugriff auf einen Arbeitsbereich',
  'workbench.workspace.grant.arrivedTitle': 'Ein Arbeitsbereich ist jetzt verfügbar',
  'workbench.workspace.grant.open': 'Arbeitsbereich öffnen',
  'workbench.workspace.grant.notifTitleActive': 'Du hast jetzt Zugriff auf „{name}“',
  'workbench.workspace.grant.notifTitle': 'Der Arbeitsbereich „{name}“ ist jetzt verfügbar',
  'workbench.workspace.grant.notifBodyActive': 'Ein Admin hat dir Zugriff gewährt — du arbeitest jetzt darin.',
  'workbench.workspace.grant.notifBody':
    'Ein Admin hat dir Zugriff gewährt — er erscheint im Arbeitsbereich-Umschalter.',
  'workbench.workspace.grant.orgFallback': 'deine Organisation',
  'workbench.workspace.grant.zeroBanner':
    'Verbunden mit {orgs} — dir wurde noch kein Arbeitsbereich gewährt. Du arbeitest in einem lokalen ' +
    'Arbeitsbereich; gewährte Arbeitsbereiche erscheinen hier automatisch, sobald ein Admin dir Zugriff gibt.',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': 'Farbe {name}',
  'workbench.workspace.picker.searchIcons': 'Symbole durchsuchen...',
  'workbench.workspace.picker.noIconTooltip': 'Kein Symbol — nur das Farbquadrat zeigen',
  'workbench.workspace.picker.noIconAria': 'Kein Symbol',
  'workbench.workspace.picker.triggerAria': 'Präfix des Arbeitsbereichs wählen (Farbe oder Symbol)',
} as const satisfies Catalog;
