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
  'workbench.workspace.leaveTitle': '„{name}“ verlassen?',
  'workbench.workspace.leaveBody':
    'Sie geben Ihren eigenen Zugriff auf diesen Arbeitsbereich auf — er verschwindet aus all Ihren offenen Tabs. ' +
    'Alle anderen behalten ihren, und ein Administrator kann ihn Ihnen erneut gewähren.',
  'workbench.workspace.leaveOk': 'Verlassen',
  'workbench.workspace.leaveFailed': 'Arbeitsbereich konnte nicht verlassen werden',
  'workbench.workspace.leftToast': '„{name}“ verlassen',
  'workbench.workspace.leaveAria': 'Arbeitsbereich verlassen',
  'workbench.workspace.members.title': 'Mitglieder von „{name}“',
  'workbench.workspace.members.openAria': 'Mitglieder verwalten',
  'workbench.workspace.members.loadFailed': 'Mitglieder konnten nicht geladen werden',
  'workbench.workspace.members.updateFailed': 'Mitglieder konnten nicht aktualisiert werden',
  'workbench.workspace.members.operatorTag': 'Server-Betreiber',
  'workbench.workspace.members.managedTag': 'Verwaltet',
  'workbench.workspace.members.managedTooltip': 'Diese Berechtigung wird vom Identitätsanbieter verwaltet.',
  'workbench.workspace.members.removeConfirm': '{name} aus diesem Arbeitsbereich entfernen?',
  'workbench.workspace.members.removeOk': 'Entfernen',
  'workbench.workspace.members.removeAria': 'Mitglied entfernen',
  'workbench.workspace.members.removedToast': '{name} entfernt',
  'workbench.workspace.members.updatedToast': '{name} aktualisiert',
  'workbench.workspace.members.addedToast': '{name} hinzugefügt',
  'workbench.workspace.members.addPlaceholder': 'Person oder Dienstkonto hinzufügen …',
  'workbench.workspace.members.addButton': 'Hinzufügen',
  'workbench.workspace.members.noneToAdd': 'Alle auf diesem Server haben bereits Zugriff.',
  'workbench.workspace.members.readOnlyHint': 'Nur Besitzer eines Arbeitsbereichs können Mitglieder ändern.',
  'workbench.workspace.members.visibilityLabel': 'Zugriff',
  'workbench.workspace.members.visibilityPrivate': 'Privat',
  'workbench.workspace.members.visibilityInternal': 'Intern',
  'workbench.workspace.members.visibilityPrivateHint': 'Nur eingeladene Mitglieder können diesen Arbeitsbereich sehen.',
  'workbench.workspace.members.visibilityInternalHint':
    'Jedes Mitglied dieses Servers kann diesen Arbeitsbereich ansehen. Bearbeiten können nur hinzugefügte Mitglieder.',
  'workbench.workspace.members.visibilityUpdatedToast': 'Arbeitsbereichszugriff aktualisiert',
  'workbench.workspace.members.visibilityPublic': 'Öffentlich',
  'workbench.workspace.members.visibilityPublicHint':
    'Jeder mit dem Link kann einen geteilten, schreibgeschützten Schnappschuss dieses Arbeitsbereichs ansehen. ' +
    'Bearbeiten können nur Mitglieder, die Sie hinzufügen.',
  'workbench.workspace.publicShare.heading': 'Öffentlicher Link',
  'workbench.workspace.publicShare.loadFailed': 'Status der öffentlichen Freigabe konnte nicht geladen werden',
  'workbench.workspace.publicShare.disabledHint':
    'Öffentliche Arbeitsbereiche sind auf diesem Server deaktiviert. Ein Operator kann sie mit publicWorkspaces ' +
    'in daemon.json aktivieren.',
  'workbench.workspace.publicShare.notShared':
    'Noch kein Schnappschuss geteilt — der Link wird aktiv, sobald Sie einen teilen.',
  'workbench.workspace.publicShare.sharedAt': 'Schnappschuss geteilt {when}',
  'workbench.workspace.publicShare.shareButton': 'Öffentlich teilen…',
  'workbench.workspace.publicShare.updateButton': 'Öffentliche Kopie aktualisieren…',
  'workbench.workspace.publicShare.stopButton': 'Teilen beenden',
  'workbench.workspace.publicShare.stopConfirm':
    'Diesen Arbeitsbereich nicht mehr teilen? Der öffentliche Link funktioniert sofort nicht mehr.',
  'workbench.workspace.publicShare.stopOk': 'Teilen beenden',
  'workbench.workspace.publicShare.stoppedToast': 'Öffentlicher Link entfernt',
  'workbench.workspace.publicShare.sharedToast': 'Öffentlicher Schnappschuss geteilt',
  'workbench.workspace.publicShare.copyLink': 'Link kopieren',
  'workbench.workspace.publicShare.copiedToast': 'Link kopiert',
  'workbench.workspace.publicShare.reviewTitle': '„{name}“ öffentlich teilen',
  'workbench.workspace.publicShare.reviewIntro':
    'Jeder mit dem Link sieht einen schreibgeschützten Schnappschuss dieses Arbeitsbereichs im jetzigen Stand. ' +
    'Prüfen Sie vor dem Bestätigen, was enthalten ist:',
  'workbench.workspace.publicShare.reviewUpdateNote':
    'Erneutes Teilen ersetzt die öffentliche Kopie unter demselben Link.',
  'workbench.workspace.publicShare.reviewStripped':
    'Nie enthalten: Vault-Einträge, OAuth-Tokens, Live-Werte, Dateiinhalte und die Werte geheimer Variablen.',
  'workbench.workspace.publicShare.reviewStrippedCount':
    '{count} geheime Variablenwerte bleiben verborgen — ihre Namen bleiben sichtbar.',
  'workbench.workspace.publicShare.reviewContents': 'Inhalt',
  'workbench.workspace.publicShare.reviewEmpty':
    'Dieser Arbeitsbereich ist leer — der veröffentlichte Schnappschuss wäre es auch.',
  'workbench.workspace.publicShare.reviewVariables': 'Variablen ({count})',
  'workbench.workspace.publicShare.reviewNoVariables': 'Keine Variablen.',
  'workbench.workspace.publicShare.reviewValueHidden': 'verborgen',
  'workbench.workspace.publicShare.confirmShare': 'Schnappschuss teilen',
  'workbench.workspace.publicShare.previewFailed': 'Schnappschuss-Vorschau konnte nicht erstellt werden',
  'workbench.workspace.publicShare.shareFailed': 'Schnappschuss konnte nicht geteilt werden',
  'workbench.workspace.publicShare.scope.workspace': 'Arbeitsbereich',
  'workbench.workspace.publicShare.scope.environment': 'Umgebung',
  'workbench.workspace.publicShare.scope.collection': 'Sammlung',
  'workbench.workspace.publicShare.cat.requests': '{count} Requests',
  'workbench.workspace.publicShare.cat.collections': '{count} Sammlungen',
  'workbench.workspace.publicShare.cat.folders': '{count} Ordner',
  'workbench.workspace.publicShare.cat.rules': '{count} Regeln',
  'workbench.workspace.publicShare.cat.environments': '{count} Umgebungen',
  'workbench.workspace.publicShare.cat.examples': '{count} Antwortbeispiele',
  'workbench.workspace.publicShare.cat.specs': '{count} API-Spezifikationen',
  'workbench.workspace.publicShare.cat.scripts': '{count} Skriptpakete',
  'workbench.workspace.publicShare.cat.templates': '{count} Vorlagen',
  'workbench.workspace.publicShare.cat.live': '{count} Live-Workflows',
  'workbench.workspace.publicShare.cat.files': '{count} Dateien',
  'workbench.workspace.publicView.bannerTag': 'Öffentlicher Schnappschuss',
  'workbench.workspace.publicView.banner':
    'Schreibgeschützte öffentliche Kopie von „{name}“. Änderungen hier werden nirgends gespeichert.',
  'workbench.workspace.publicView.loadFailed': 'Dieser öffentliche Arbeitsbereichs-Link ist nicht verfügbar.',
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
