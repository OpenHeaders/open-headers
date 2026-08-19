/**
 * Import/export family — French. Mirrors
 * `catalogs/en/workbench-import-export.ts` key for key.
 *
 * Raw by design inside keyed sentences: brand + format proper nouns
 * (Postman / Insomnia / Bruno / HAR / OpenAPI), file extensions and
 * filenames rendered as `<Text code>` chips (`.bru`,
 * `.openheaders.yaml`), export ids / fingerprints / entity names
 * ({id} / {name} holes carry data), the ` · ` separator glyphs,
 * third-party UI paths and button labels (Postman menus, DevTools
 * `Save all as HAR`, `Copy as cURL`), `uid` / `{{template}}` tokens,
 * and `vault` lowercase per the glossary. Report vocabulary: drop =
 * `abandon`, transform = `transformation`, preset = `préréglage`;
 * merge strategies quote the settings-defs mints (« ajouter comme
 * nouveau » / « remplacer l'existant »).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchImportExport = {
  // ── Export modal ───────────────────────────────────────────────────
  'workbench.importExport.export.title': 'Exporter',
  'workbench.importExport.export.cancel': 'Annuler',
  'workbench.importExport.export.download': 'Télécharger',
  'workbench.importExport.export.sourceLabel': 'Source :',
  'workbench.importExport.export.scopeLabel': 'Périmètre :',
  'workbench.importExport.export.filenameLabel': 'Nom de fichier :',
  'workbench.importExport.export.scopeWholeWorkspace': 'Espace de travail entier',
  'workbench.importExport.export.vaultSecrets': 'Secrets du vault',
  'workbench.importExport.export.vaultOmit': 'Omettre (par défaut)',
  'workbench.importExport.export.vaultEncrypted': 'Chiffrés (phrase secrète)',
  'workbench.importExport.export.vaultPlaintext': 'En clair (avancé)',
  'workbench.importExport.export.passphrasePlaceholder': 'Phrase secrète',
  'workbench.importExport.export.confirmPassphrasePlaceholder': 'Confirmez la phrase secrète',
  'workbench.importExport.export.hintPlaceholder':
    'Indice facultatif (visible par le destinataire — jamais la phrase secrète elle-même)',
  'workbench.importExport.export.strengthEmpty': 'saisissez une phrase secrète',
  'workbench.importExport.export.strengthWeak': 'faible',
  'workbench.importExport.export.strengthFair': 'moyenne',
  'workbench.importExport.export.strengthGood': 'bonne',
  'workbench.importExport.export.strengthStrong': 'forte',
  'workbench.importExport.export.strengthNote':
    'Solidité de la phrase secrète : {label}. Partagez la phrase secrète hors bande (Signal, gestionnaire de ' +
    'mots de passe, voix). Quiconque possède la phrase secrète peut lire chaque secret de cet export.',
  'workbench.importExport.export.plaintextTitle': 'Les secrets en clair sont lisibles par quiconque voit ce fichier',
  'workbench.importExport.export.plaintextUseOnly':
    "À n'utiliser que pour partager avec un système de toute confiance (p. ex. sauvegarde sur votre propre " +
    'disque chiffré).',
  'workbench.importExport.export.switchToEncrypted': 'Passer en chiffré (recommandé)',
  'workbench.importExport.export.acknowledgeRisks': 'Je comprends les risques',
  'workbench.importExport.export.fingerprintsTitle': 'Chiffré — partagez ces empreintes avec le destinataire',
  'workbench.importExport.export.ciphertextFingerprint': 'Empreinte du chiffré :',
  'workbench.importExport.export.keyFingerprint': 'Empreinte de la clé :',
  'workbench.importExport.export.fingerprintMatchNote':
    'Après avoir saisi la phrase secrète, le destinataire verra la même empreinte de clé si elle correspond à ' +
    'la vôtre.',
  'workbench.importExport.export.advanced': 'Avancé',
  'workbench.importExport.export.strictLiteralLabel': "Strictement littéral — n'exporter que ma sélection",
  'workbench.importExport.export.strictLiteralHelp':
    'Par défaut, choisir une collection ou un dossier embarque chaque descendant plus les conteneurs parents ' +
    "pour que l'import se suffise à lui-même. Avec strictement littéral, seuls les uids choisis partent — le " +
    "destinataire voit des dépendances manquantes pour tout ce que vous n'avez pas inclus.",
  'workbench.importExport.export.oauthNote':
    'Les secrets client OAuth sont toujours omis quel que soit le mode vault. Le destinataire saisit les ' +
    'siens à la première authentification.',
  'workbench.importExport.export.exportFailed': "Échec de l'export",
  'workbench.importExport.export.exportedShareFingerprints':
    '{filename} exporté — partagez les empreintes avec le destinataire',
  'workbench.importExport.export.exported': '{filename} exporté',

  // ── Import hub (ImportSourceModal) ─────────────────────────────────
  'workbench.importExport.hub.title': 'IMPORTER',
  'workbench.importExport.hub.closeAria': "Fermer l'import",
  'workbench.importExport.hub.readingFile': 'Lecture du fichier…',
  'workbench.importExport.hub.pastePlaceholder': 'Collez une commande curl ou une URL',
  'workbench.importExport.hub.continueAria': "Poursuivre l'import",
  'workbench.importExport.hub.notRecognized':
    'Pas encore reconnu — collez une commande curl, une URL, un HAR, un export Postman / Insomnia / Bruno, un ' +
    "document OpenAPI ou un export d'espace de travail.",
  'workbench.importExport.hub.dropAria': 'Déposez ici un fichier ou dossier importable',
  'workbench.importExport.hub.dropTitle': 'Déposez un fichier ou un dossier à importer',
  'workbench.importExport.hub.kindHar': 'Capture HAR',
  'workbench.importExport.hub.kindPostman': 'Collection ou sauvegarde Postman',
  'workbench.importExport.hub.kindInsomnia': 'Export Insomnia',
  'workbench.importExport.hub.kindBrunoSuffix': 'fichier ou dossier de collection',
  'workbench.importExport.hub.kindOpenapi': 'Document OpenAPI 3.x',
  'workbench.importExport.hub.kindWorkspaceSuffix': "export d'espace de travail",
  'workbench.importExport.hub.autoDetected': 'Le format est reconnu automatiquement.',
  'workbench.importExport.hub.browseFiles': 'Parcourir les fichiers…',
  'workbench.importExport.hub.browseFolder': 'Parcourir un dossier…',
  'workbench.importExport.hub.switchingFrom': 'Vous migrez depuis',
  'workbench.importExport.hub.switchingOr': 'ou',
  'workbench.importExport.hub.migrateCta': 'Migrer depuis un autre outil',

  // ── Modal farm (ImportExportModals) ────────────────────────────────
  'workbench.importExport.modals.noBrunoFiles':
    'Aucun fichier Bruno dans ce dossier — fichiers .bru ou bruno.json attendus.',
  'workbench.importExport.modals.unreadableSkipped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} fichier n'a pas pu être lu et a été ignoré.",
      many: "{count} fichiers n'ont pas pu être lus et ont été ignorés.",
      other: "{count} fichiers n'ont pas pu être lus et ont été ignorés.",
    }),
  'workbench.importExport.modals.readFailed': 'Impossible de lire {name} : {message}',
  'workbench.importExport.modals.importedSummary': ({ count, label }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} entité importée',
      many: '{count} entités importées',
      other: '{count} entités importées',
    })} depuis « ${label} »`,

  // ── Import preview shell (ImportPreviewModal) ──────────────────────
  'workbench.importExport.preview.fallbackTitle': "IMPORTER UN EXPORT D'ESPACE DE TRAVAIL",
  'workbench.importExport.preview.closeAria': "Fermer l'aperçu d'import",
  'workbench.importExport.preview.cancel': 'Annuler',
  'workbench.importExport.preview.emptyFile': 'Déposez un fichier .openheaders.yaml pour le prévisualiser.',
  'workbench.importExport.preview.emptyClipboard': "Collez un export d'espace de travail pour le prévisualiser.",
  'workbench.importExport.preview.preparing': "Préparation de l'import…",
  'workbench.importExport.preview.footerExportInfo': 'Export {id} · {scope}',
  'workbench.importExport.preview.footerPickFile': 'Choisissez un fichier à prévisualiser',
  'workbench.importExport.preview.footerNoData': 'Aucune donnée',
  'workbench.importExport.preview.importInto': 'Importer dans :',
  'workbench.importExport.preview.staleTitle': "L'espace de travail a changé depuis l'ouverture de cet aperçu",
  'workbench.importExport.preview.staleDescription':
    "Rouvrez l'aperçu d'import pour actualiser le diff, puis réessayez.",
  'workbench.importExport.preview.advanced': 'Avancé',
  'workbench.importExport.preview.advancedCount': 'Avancé ({count})',
  'workbench.importExport.preview.previewFailed': "Échec de l'aperçu",
  'workbench.importExport.preview.mergeTitle': ({ count }, locale) =>
    `Import — ${plural(locale, Number(count), {
      one: '{count} élément',
      many: '{count} éléments',
      other: '{count} éléments',
    })}`,

  // ── Target picker (TargetControl) ──────────────────────────────────
  'workbench.importExport.target.importInto': 'Importer dans',
  'workbench.importExport.target.current': 'Actuel',
  'workbench.importExport.target.new': 'Nouveau',
  'workbench.importExport.target.pickExisting': 'Choisir un existant',
  'workbench.importExport.target.noActiveWorkspace': 'Aucun espace de travail actif',
  'workbench.importExport.target.selectWorkspace': 'Sélectionnez un espace de travail',
  'workbench.importExport.target.landsOnOrg': 'Atterrit sur {name} et se synchronise vers ses appareils',
  'workbench.importExport.target.staysLocal': 'Reste sur cet appareil',

  // ── Advanced toggles (AdvancedPanel) ───────────────────────────────
  'workbench.importExport.advanced.title': 'Avancé',
  'workbench.importExport.advanced.closeAria': 'Fermer le panneau avancé',
  'workbench.importExport.advanced.backupRestoreLabel': "C'est le mien — préférer la mise à jour par uid",
  'workbench.importExport.advanced.backupRestoreHelp':
    "Fait passer les collisions d'uid de « ajouter comme nouveau » à « remplacer l'existant ». Ignoré pour " +
    "les entités modifiées localement depuis la création de l'export.",
  'workbench.importExport.advanced.trustExportLabel':
    "Faire confiance à cet export — conserver les drapeaux d'activation",
  'workbench.importExport.advanced.trustExportHelp':
    'Les règles / workflows Live / variables Live importés atterrissent désactivés par défaut. Ne cochez ' +
    "ceci que si vous faites confiance à l'expéditeur.",
  'workbench.importExport.advanced.stripScriptsLabel': "Retirer les scripts de requête à l'import",
  'workbench.importExport.advanced.stripScriptsHelp':
    'Supprime les scripts pré-requête et post-réponse de chaque requête importée. Recommandé quand ' +
    "l'expéditeur est inconnu.",
  'workbench.importExport.advanced.omitOAuthLabel': 'Omettre les configs OAuth',
  'workbench.importExport.advanced.omitOAuthHelp':
    "Par défaut, les configs OAuth2 voyagent avec la requête (point d'accès de token, client id, scopes — " +
    'jamais le secret client ni les tokens). Avec cette option, chaque requête OAuth2 atterrit avec ' +
    "l'authentification à none.",
  'workbench.importExport.advanced.keepOrderLabel': "Conserver l'ordre de la collection cible à la mise à jour",
  'workbench.importExport.advanced.keepOrderHelp':
    "Par défaut, une collection mise à jour prend l'ordre des enfants de l'export. Avec cette option, l'ordre " +
    'existant de votre cible est préservé.',
  'workbench.importExport.advanced.workspaceSettingsLabel': "Inclure les réglages au niveau de l'espace de travail",
  'workbench.importExport.advanced.workspaceSettingsHelp':
    "Réservé à une future liste d'autorisation de réglages à sémantique d'espace de travail. La liste " +
    'actuelle est vide — rien ne passe par cet interrupteur en v1.',
  'workbench.importExport.advanced.refuseUidCollisionLabel': 'Refuser en cas de collision de workspace.uid',
  'workbench.importExport.advanced.refuseUidCollisionHelp':
    "Par défaut, importer dans un nouvel espace de travail régénère silencieusement l'uid de l'espace en cas " +
    'de collision. Avec cette option, un espace de travail existant portant le même uid bloque ' +
    "l'import.",

  // ── Status chips (StatusChips + buildImportStatusChips) ────────────
  'workbench.importExport.chips.dismiss': 'Fermer',
  'workbench.importExport.chips.plaintextLabel': 'Secrets en clair',
  'workbench.importExport.chips.plaintextTitle': 'Cet export contient des secrets du vault en clair.',
  'workbench.importExport.chips.plaintextBody':
    "Quiconque possède ce fichier peut lire chaque secret qu'il transporte. Pensez à le réémettre chiffré " +
    'avant de le transférer.',
  'workbench.importExport.chips.skippedLabel': '{count} ignorés',
  'workbench.importExport.chips.skippedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} entité n'a pas pu être analysée et sera ignorée.",
      many: "{count} entités n'ont pas pu être analysées et seront ignorées.",
      other: "{count} entités n'ont pas pu être analysées et seront ignorées.",
    }),
  'workbench.importExport.chips.andMore': '…et {count} de plus',
  'workbench.importExport.chips.dedupSameLabel': 'Déjà importé ici',
  'workbench.importExport.chips.dedupSameTitle': 'Vous avez importé cet export ({id}) ici le {date}.',
  'workbench.importExport.chips.dedupSameBody': 'Le réimporter appliquera vos choix de stratégie par entité actuels.',
  'workbench.importExport.chips.dedupOtherLabel': 'Importé ailleurs',
  'workbench.importExport.chips.dedupOtherTitle': "Vous avez aussi importé l'export {id} dans « {name} ».",
  'workbench.importExport.chips.dedupOtherBody': "Cet espace de travail n'est pas affecté par cet import.",
  'workbench.importExport.chips.dedupUidLabel': 'La source existe déjà',
  'workbench.importExport.chips.dedupUidTitle': 'Un espace de travail issu de cette source existe déjà (« {name} »).',
  'workbench.importExport.chips.dedupUidBody':
    "Changez la cible ci-dessus pour l'actualiser, ou importez comme nouvelle copie.",
  'workbench.importExport.chips.staleLabel': 'Données modifiées',
  'workbench.importExport.chips.staleTitle': "L'espace de travail cible a été modifié par un autre onglet.",
  'workbench.importExport.chips.staleBody':
    "L'arbre de collisions ci-dessous a été actualisé — vérifiez et cliquez de nouveau sur Importer.",
  'workbench.importExport.chips.previewErrorLabel': "Échec de l'aperçu",
  'workbench.importExport.chips.previewErrorTitle': 'Impossible de calculer le diff de collisions.',
  'workbench.importExport.chips.unresolvedLabel': '{count} non résolues',
  'workbench.importExport.chips.unresolvedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} référence non résolue.',
      many: '{count} références non résolues.',
      other: '{count} références non résolues.',
    }),
  'workbench.importExport.chips.unresolvedBody':
    "Ces noms ne se résolvent ni dans l'export ni dans la cible. Les imports atterriront comme liaisons " +
    "cassées — reliez-les quand l'entité manquante apparaîtra.",
  'workbench.importExport.chips.referencedBy': 'référencé par {count}',
  'workbench.importExport.chips.summaryThen': 'Avant :',
  'workbench.importExport.chips.summaryNow': 'Maintenant :',
  'workbench.importExport.chips.summaryNew': '{count} nouveaux',
  'workbench.importExport.chips.summaryKept': '{count} conservés',
  'workbench.importExport.chips.summaryRemoved': '{count} retirés',
  'workbench.importExport.chips.showBreakdown': 'Afficher le détail par section',
  'workbench.importExport.chips.hideBreakdown': 'Masquer le détail',
  'workbench.importExport.chips.sectionNew': '(+{count} nouveaux)',
  'workbench.importExport.chips.sectionRemoved': '({count} retirés)',

  // ── Vault blocks (VaultBlocks) ─────────────────────────────────────
  'workbench.importExport.vault.encryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault chiffré — {count} secret',
      many: 'Vault chiffré — {count} secrets',
      other: 'Vault chiffré — {count} secrets',
    }),
  'workbench.importExport.vault.hintFromSender': "Indice de l'expéditeur :",
  'workbench.importExport.vault.enterPassphrase':
    'Saisissez la phrase secrète pour déchiffrer ces secrets localement. Sauter le déchiffrement poursuit le ' +
    "reste de l'import — les secrets sont simplement omis.",
  'workbench.importExport.vault.passphrasePlaceholder': 'Phrase secrète',
  'workbench.importExport.vault.decrypt': 'Déchiffrer le vault',
  'workbench.importExport.vault.decryptedTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Vault déchiffré — {count} secret prêt à importer',
      many: 'Vault déchiffré — {count} secrets prêts à importer',
      other: 'Vault déchiffré — {count} secrets prêts à importer',
    }),
  'workbench.importExport.vault.keyFingerprint': 'Empreinte de la clé :',
  'workbench.importExport.vault.compareWithSender': "(à comparer avec l'expéditeur)",
  'workbench.importExport.vault.ciphertextFingerprint': 'Empreinte du chiffré :',
  'workbench.importExport.vault.partialTitle': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} secret n'a pas pu être décodé — il sera omis de l'import",
      many: "{count} secrets n'ont pas pu être décodés — ils seront omis de l'import",
      other: "{count} secrets n'ont pas pu être décodés — ils seront omis de l'import",
    }),
  'workbench.importExport.vault.andMore': '…et {count} de plus',

  // ── Shared across the stage-2 import modals ────────────────────────
  'workbench.importExport.import.cancel': 'Annuler',
  'workbench.importExport.import.importCta': 'Importer',
  'workbench.importExport.import.importCtaCount': 'Importer ({count})',
  'workbench.importExport.import.importShortcutTooltip': 'Importer ({shortcut})',
  'workbench.importExport.import.importTo': 'IMPORTER VERS',
  'workbench.importExport.import.hintNavigate': 'naviguer',
  'workbench.importExport.import.hintSelect': 'sélectionner',
  'workbench.importExport.import.hintImport': 'importer',
  'workbench.importExport.import.hintClose': 'fermer',
  'workbench.importExport.import.cantReadFile': 'Impossible de lire ce fichier',
  'workbench.importExport.import.failedCreateCollection': 'Impossible de créer la collection',
  'workbench.importExport.import.importFailed': "Échec de l'import : {message}",
  'workbench.importExport.import.transformsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transformation',
      many: '{count} transformations',
      other: '{count} transformations',
    }),
  'workbench.importExport.import.dropsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} abandon', many: '{count} abandons', other: '{count} abandons' }),
  'workbench.importExport.import.importedRequests': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} requête importée',
      many: '{count} requêtes importées',
      other: '{count} requêtes importées',
    }),

  // ── HAR modal ──────────────────────────────────────────────────────
  'workbench.importExport.har.title': 'IMPORTER DEPUIS HAR',
  'workbench.importExport.har.tooltipChooseFile': "Choisissez d'abord un fichier .har",
  'workbench.importExport.har.tooltipSelectEntry': 'Sélectionnez au moins une entrée',
  'workbench.importExport.har.footerSelected': '{selected} sur {total} sélectionnées',
  'workbench.importExport.har.footerChooseFile': 'Choisissez un fichier .har',
  'workbench.importExport.har.introPrefix': 'Importez un fichier',
  'workbench.importExport.har.introSuffix':
    '(HTTP Archive) exporté depuis les DevTools ou un proxy. Chaque entrée devient une requête de destination ' +
    'dans la collection choisie. Les cookies et les téléversements multipart sont abandonnés avec des ' +
    "annotations de suivi ; les en-têtes d'authentification sont promus en types d'authentification de " +
    'premier rang.',
  'workbench.importExport.har.filterPlaceholder': 'Filtrer par URL / méthode / nom',
  'workbench.importExport.har.selectAll': 'Tout sélectionner',
  'workbench.importExport.har.selectNone': 'Aucune',
  'workbench.importExport.har.readFailed': 'Échec de lecture du HAR : {message}',
  'workbench.importExport.har.dropTitle': 'Déposez un fichier .har ici, ou cliquez pour en choisir un',
  'workbench.importExport.har.dropHint': 'Exporté depuis DevTools Network → clic droit → Save all as HAR',
  'workbench.importExport.har.noImportableEntries': "Le fichier n'a aucune entrée importable.",
  'workbench.importExport.har.noFilterMatch': 'Aucune entrée ne correspond au filtre.',
  'workbench.importExport.har.showingFirst':
    'Affichage des {shown} premières sur {total}. Utilisez le filtre pour affiner.',
  'workbench.importExport.har.transformsApplied': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} transformation appliquée à la source',
      many: '{count} transformations appliquées à la source',
      other: '{count} transformations appliquées à la source',
    }),
  'workbench.importExport.har.dropsRecorded': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} abandon enregistré',
      many: '{count} abandons enregistrés',
      other: '{count} abandons enregistrés',
    }),
  'workbench.importExport.har.transformsTooltip':
    'Les transformations réécrivent des champs source en équivalents normalisés — p. ex. promouvoir les ' +
    "en-têtes Authorization en types d'authentification de premier rang.",
  'workbench.importExport.har.dropsTooltip':
    'Les abandons sont des champs source sans correspondance dans le modèle (cookies, téléversements ' +
    'multipart, etc.). Chacun a une annotation de suivi dans le rapport complet.',
  'workbench.importExport.har.reportHover':
    "Survolez pour les détails · liste complète dans l'export du rapport d'import (Paramètres → Données)",

  // ── cURL modal ─────────────────────────────────────────────────────
  'workbench.importExport.curl.title': 'IMPORTER DEPUIS CURL',
  'workbench.importExport.curl.tooltipPasteFirst': "Collez d'abord une commande curl",
  'workbench.importExport.curl.tooltipEnterName': 'Saisissez un nom',
  'workbench.importExport.curl.introPrefix': 'Collez une commande',
  'workbench.importExport.curl.introSuffix':
    '— p. ex. « Copy as cURL » depuis les DevTools du navigateur ou une doc API.',
  'workbench.importExport.curl.sourcePlaceholder':
    "curl -X POST 'https://api.openheaders.com/v1/things' \\\n  -H 'authorization: Bearer xyz' \\\n  -H 'content-type: application/json' \\\n  --data-raw '{\"name\":\"hello\"}'",
  'workbench.importExport.curl.cantParse': "Impossible d'analyser cette commande",
  'workbench.importExport.curl.parseFallback': 'Analyse impossible — vérifiez la commande et réessayez.',
  'workbench.importExport.curl.nameLabel': 'NOM',
  'workbench.importExport.curl.namePlaceholder': 'Le nom de cette requête dans la barre latérale',
  'workbench.importExport.curl.failedCreateRequest': 'Impossible de créer la requête',
  'workbench.importExport.curl.importedName': '« {name} » importée',
  'workbench.importExport.curl.headersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} en-tête', many: '{count} en-têtes', other: '{count} en-têtes' }),
  'workbench.importExport.curl.paramsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} paramètre de requête',
      many: '{count} paramètres de requête',
      other: '{count} paramètres de requête',
    }),
  'workbench.importExport.curl.noBody': 'aucun corps',
  'workbench.importExport.curl.bodyType': 'corps {type}',
  'workbench.importExport.curl.noAuth': 'aucune auth',
  'workbench.importExport.curl.authType': 'auth {type}',
  'workbench.importExport.curl.droppedWord': 'abandonné',

  // ── Postman collection modal ───────────────────────────────────────
  'workbench.importExport.postman.title': 'IMPORTER DEPUIS POSTMAN',
  'workbench.importExport.postman.intro':
    'Importez un JSON de collection Postman v2.1. La structure des dossiers, les variables de collection, les ' +
    "docs et réglages de requête, l'authentification par requête (basic / bearer / api-key / OAuth 2.0) et " +
    "les scripts de requête (traduits vers l'API oh.* quand c'est possible) sont préservés. AWS sigv4 et les " +
    'téléversements de fichiers sont suivis comme abandons. Attachez éventuellement un fichier ' +
    "d'environnement Postman pour créer un Environnement correspondant.",
  'workbench.importExport.postman.tooltipChooseFile': "Choisissez d'abord un fichier de collection",
  'workbench.importExport.postman.tooltipEnterName': 'Saisissez un nom de collection',
  'workbench.importExport.postman.collectionNameLabel': 'NOM DE LA COLLECTION',
  'workbench.importExport.postman.collectionNamePlaceholder': 'Nom de la nouvelle collection',
  'workbench.importExport.postman.readFileFailed': 'Échec de lecture du fichier : {message}',
  'workbench.importExport.postman.readEnvFailed': "Échec de lecture de l'environnement : {message}",
  'workbench.importExport.postman.parsedCollection': 'COLLECTION ANALYSÉE',
  'workbench.importExport.postman.requestsLabel': 'Requêtes :',
  'workbench.importExport.postman.foldersLabel': 'Dossiers :',
  'workbench.importExport.postman.collectionVarsLabel': 'Vars de collection :',
  'workbench.importExport.postman.folderTree': 'Arborescence des dossiers',
  'workbench.importExport.postman.optionalEnvFile': "FACULTATIF · FICHIER D'ENVIRONNEMENT",
  'workbench.importExport.postman.environmentLabel': 'Environnement : {name}',
  'workbench.importExport.postman.varsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var', many: '{count} vars', other: '{count} vars' }),
  'workbench.importExport.postman.secretCount': '{count} secret',
  'workbench.importExport.postman.remove': 'Retirer',
  'workbench.importExport.postman.envDropped': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} variable d'env abandonnée (entrées désactivées)",
      many: "{count} variables d'env abandonnées (entrées désactivées)",
      other: "{count} variables d'env abandonnées (entrées désactivées)",
    }),
  'workbench.importExport.postman.dropCollectionTitle':
    'Déposez un JSON de collection Postman v2.1 ici, ou cliquez pour en choisir un',
  'workbench.importExport.postman.dropEnvTitle': "Déposez un JSON d'environnement Postman ici (facultatif)",
  'workbench.importExport.postman.dropCollectionHint':
    'Exporté depuis Postman → Collection → ⋯ → Export (Collection v2.1)',
  'workbench.importExport.postman.dropEnvHint': 'Exporté depuis Postman → Environments → ⋯ → Export',
  'workbench.importExport.postman.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} dossier', many: '{count} dossiers', other: '{count} dossiers' }),
  'workbench.importExport.postman.oneEnvironment': '1 environnement',

  // ── Sectioned modal (backup / Insomnia / Bruno / OpenAPI) ──────────
  'workbench.importExport.sectioned.titlePostmanBackup': 'IMPORTER DEPUIS UNE SAUVEGARDE POSTMAN',
  'workbench.importExport.sectioned.blurbPostmanBackup':
    'Importez un dump de sauvegarde Postman. Les collections, environnements, globales et préréglages ' +
    "d'en-têtes sont reconnus ; les préréglages d'en-têtes atterrissent comme règles d'en-tête non publiées. " +
    'Les scripts, OAuth 2.0, AWS sigv4 et les téléversements de fichiers sont suivis comme abandons.',
  'workbench.importExport.sectioned.titleInsomnia': 'IMPORTER DEPUIS INSOMNIA',
  'workbench.importExport.sectioned.blurbInsomnia':
    'Importez un export Insomnia (JSON v4 ou YAML v5). Les espaces de travail deviennent des collections avec ' +
    "leurs arborescences de dossiers ; les environnements s'aplatissent (les sous-environnements fusionnent " +
    'par-dessus leur base) et les références {{ _.var }} se réécrivent en {{var}} ; les specs API embarquées ' +
    'sont conservées comme spécifications modifiables liées à leurs collections générées.',
  'workbench.importExport.sectioned.titleBruno': 'IMPORTER DEPUIS BRUNO',
  'workbench.importExport.sectioned.blurbBruno':
    'Importez une requête Bruno .bru ou un dossier de collection entier. Méthode, en-têtes, paramètres, corps ' +
    'et auth basic/bearer/api-key sont préservés ; un dossier apporte son arborescence, son ordre et ses ' +
    'environnements ; les scripts, tests et blocs de docs sont suivis comme abandons.',
  'workbench.importExport.sectioned.titleOpenapi': 'IMPORTER DEPUIS OPENAPI',
  'workbench.importExport.sectioned.blurbOpenapi':
    'Importez un document OpenAPI 3.x (JSON ou YAML). Les opérations deviennent des requêtes sous {{baseUrl}}, ' +
    'les tags deviennent des dossiers, les paramètres et corps de requête sont préservés (les corps définis ' +
    'uniquement par schéma reçoivent un échafaudage de substitution), et les schémas de sécurité se ' +
    'transposent en authentification — renseignez les substituts {{clientId}}/{{clientSecret}} après ' +
    "l'import. Le document peut aussi continuer à vivre comme spécification modifiable liée à la collection " +
    'générée.',
  'workbench.importExport.sectioned.tooltipNothingParsed': 'Rien analysé pour le moment',
  'workbench.importExport.sectioned.tooltipNeedsNames': 'Chaque collection doit avoir un nom',
  'workbench.importExport.sectioned.cantReadImport': 'Impossible de lire cet import',
  'workbench.importExport.sectioned.readInputFailed': "Échec de lecture de l'entrée : {message}",
  'workbench.importExport.sectioned.importAs': 'IMPORTER EN TANT QUE',
  'workbench.importExport.sectioned.specWithCollection': 'Spécification avec une collection',
  'workbench.importExport.sectioned.specWithCollectionHelp':
    'Le document continue à vivre comme spec modifiable, liée à la collection générée.',
  'workbench.importExport.sectioned.collectionOnly': 'Collection',
  'workbench.importExport.sectioned.collectionOnlyHelp': "Conversion seule — le document lui-même n'est pas conservé.",
  'workbench.importExport.sectioned.specificationsSection': 'SPÉCIFICATIONS · {count}',
  'workbench.importExport.sectioned.collectionsSection': 'COLLECTIONS · {count}',
  'workbench.importExport.sectioned.environmentsSection': 'ENVIRONNEMENTS · {count}',
  'workbench.importExport.sectioned.headerPresetsSection': "PRÉRÉGLAGES D'EN-TÊTES · {count}",
  'workbench.importExport.sectioned.collectionNamePlaceholder': 'Nom de la collection',
  'workbench.importExport.sectioned.varsShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} var', many: '{count} vars', other: '{count} vars' }),
  'workbench.importExport.sectioned.headersShort': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} en-tête', many: '{count} en-têtes', other: '{count} en-têtes' }),
  'workbench.importExport.sectioned.presetsNote':
    "Chaque préréglage atterrit comme règle d'en-tête non publiée — ajoutez des conditions et publiez-la " +
    "quand elle est prête ; rien ne touche le trafic réel d'ici là.",
  'workbench.importExport.sectioned.nothingImportable': "Rien d'importable dans ce fichier",
  'workbench.importExport.sectioned.nothingImportableDesc':
    "Le fichier s'est analysé, mais chaque section était vide ou abandonnée — voir les notes d'import " + 'ci-dessous.',
  'workbench.importExport.sectioned.requestsPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} requête', many: '{count} requêtes', other: '{count} requêtes' }),
  'workbench.importExport.sectioned.specificationsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} spécification',
      many: '{count} spécifications',
      other: '{count} spécifications',
    }),
  'workbench.importExport.sectioned.environmentsPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} environnement',
      many: '{count} environnements',
      other: '{count} environnements',
    }),
  'workbench.importExport.sectioned.headerRulesPart': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: "{count} règle d'en-tête (non publiée)",
      many: "{count} règles d'en-tête (non publiées)",
      other: "{count} règles d'en-tête (non publiées)",
    }),
  'workbench.importExport.sectioned.importedLead': 'Import de {parts}',
  'workbench.importExport.sectioned.emptyFinish': 'Import terminé — rien à transférer',

  // ── Migration surfaces ─────────────────────────────────────────────
  'workbench.importExport.migrate.title': 'Migrer depuis un autre outil',
  'workbench.importExport.migrate.scanCta': 'Analyser cet ordinateur',
  'workbench.importExport.migrate.pullCta': 'Importer depuis un compte Postman',
  'workbench.importExport.migrate.scanNote':
    "L'analyse vérifie une liste fixe de dossiers d'applications et ne lit que les fichiers de données des " +
    "outils (sauvegardes et magasins locaux). Elle n'ouvre jamais de fichiers d'identifiants, de cookies ou " +
    'de session, et rien ne quitte cet ordinateur. Importer quoi que ce soit est une étape séparée et ' +
    'explicite.',
  'workbench.importExport.migrate.scanFailed':
    "L'analyse n'a pas pu s'exécuter — réessayez, ou utilisez le hub d'import avec un fichier exporté.",
  'workbench.importExport.migrate.backupReadFailed': "Le fichier de sauvegarde n'a pas pu être lu.",
  'workbench.importExport.migrate.localReadFailed': "Les données locales n'ont pas pu être lues.",
  'workbench.importExport.migrate.detected': 'Détecté',
  'workbench.importExport.migrate.notFound': 'Introuvable',
  'workbench.importExport.migrate.cancel': 'Annuler',
  'workbench.importExport.migrate.fromAccount': 'Importer depuis votre compte Postman',
  'workbench.importExport.migrate.localDataPrefix':
    "Des données locales Insomnia, Thunder Client ou Bruno ? Exportez-les depuis l'outil et déposez le " +
    'fichier dans le',
  'workbench.importExport.migrate.importHub': "hub d'import",
  'workbench.importExport.migrate.localDataSuffix':
    "— ou analysez cet ordinateur avec l'application de bureau Open Headers.",
  'workbench.importExport.migrate.desktopConnected':
    'Votre application de bureau est connectée — choisissez-y « Migrer depuis un autre outil » ; la ' +
    'progression se reflète ici et les espaces de travail importés se synchronisent.',
  'workbench.importExport.migrate.desktopNeeded':
    "L'analyse nécessite l'application de bureau ; une fois exécutée là-bas, les espaces de travail importés " +
    'se synchronisent vers ce navigateur.',
  'workbench.importExport.migrate.closeConfirmTitle': "Fermer l'import ?",
  'workbench.importExport.migrate.closeListingContent':
    'Vos espaces de travail sont encore en cours de listage — les gros comptes peuvent prendre une minute. ' +
    'Fermer abandonne le listage.',
  'workbench.importExport.migrate.closeListingOk': "Continuer d'attendre",
  'workbench.importExport.migrate.closeSelectingContent':
    "Votre sélection d'espaces de travail sera perdue. Rien n'a encore été importé.",
  'workbench.importExport.migrate.closeSelectingOk': 'Continuer la sélection',
  'workbench.importExport.migrate.closeAnyway': 'Fermer quand même',
  'workbench.importExport.migrate.discardAndClose': 'Abandonner et fermer',

  // ── Postman account pull (PostmanPullStepper + PostmanKeySteps) ────
  // The steps.glyph* values depict Postman's own UI inside the
  // walkthrough glyphs — Postman's UI does not localize into French,
  // so its menu paths and button labels ride raw; only the
  // instruction chrome around them translates.
  'workbench.importExport.pull.keyIntro':
    'Collez une clé API Postman pour lister vos espaces de travail et choisir lesquels importer.',
  'workbench.importExport.pull.keyAria': 'Clé API Postman',
  'workbench.importExport.pull.listCta': 'Lister les espaces de travail',
  'workbench.importExport.pull.listFailed': "Les espaces de travail n'ont pas pu être listés.",
  'workbench.importExport.pull.startFailed': "L'import n'a pas pu démarrer.",
  'workbench.importExport.pull.quipContacting': 'Contact de votre compte Postman',
  'workbench.importExport.pull.quipCounting': 'Comptage des collections',
  'workbench.importExport.pull.quipWeighing': 'Pesée des environnements',
  'workbench.importExport.pull.quipWrangling': 'Rassemblement des espaces de travail',
  'workbench.importExport.pull.quipAlphabetizing': 'Tri alphabétique des dossiers',
  'workbench.importExport.pull.quipSniffing': 'Repérage des requêtes',
  'workbench.importExport.pull.quipUntangling': 'Démêlage des variables',
  'workbench.importExport.pull.quipStacking': 'Empilement des en-têtes',
  'workbench.importExport.pull.pickIntro':
    'Chaque espace de travail Postman sélectionné atterrit dans son propre espace de travail, en gardant son ' +
    "nom exact, avec un rapport de fin d'exécution.",
  'workbench.importExport.pull.noWorkspaces': 'Aucun espace de travail trouvé sur ce compte.',
  'workbench.importExport.pull.workspaceCounts': '{collections} collections · {environments} environnements',
  'workbench.importExport.pull.importCta': 'Importer la sélection',
  'workbench.importExport.pull.back': 'Retour',
  'workbench.importExport.pull.steps.menuA': "Dans l'application Postman ou sur https://postman.co",
  'workbench.importExport.pull.steps.menuB': 'Menu Settings → Account settings',
  'workbench.importExport.pull.steps.generateA': 'Barre latérale gauche → API keys',
  'workbench.importExport.pull.steps.generateB': 'Generate API key',
  'workbench.importExport.pull.steps.copyA': 'Saisissez un nom quelconque → Generate API key',
  'workbench.importExport.pull.steps.copyB': 'Copiez la clé → Collez-la ci-dessus',
  'workbench.importExport.pull.steps.glyphAccountSettings': 'Account settings',
  'workbench.importExport.pull.steps.glyphApiKeys': 'API keys',
  'workbench.importExport.pull.steps.glyphGenerate': 'Generate API key',
  'workbench.importExport.pull.steps.glyphCopy': 'Copy to Clipboard',

  // ── Detection details table ────────────────────────────────────────
  'workbench.importExport.detection.vendorCol': 'Outil',
  'workbench.importExport.detection.dataFoundCol': 'Données trouvées',
  'workbench.importExport.detection.contentsCol': 'Contenu',
  'workbench.importExport.detection.backupFrom': 'Sauvegarde du {date}',
  'workbench.importExport.detection.localData': 'Données locales',
  'workbench.importExport.detection.importCta': 'Importer…',
  'workbench.importExport.detection.exportFallbackPrefix':
    'Ou exportez-les (Preferences → Data → Export), puis déposez le fichier dans le',
  'workbench.importExport.detection.backupContents':
    "{collections} collections · {environments} environnements · {headerPresets} préréglages d'en-têtes · " +
    '{globals} globales',
  'workbench.importExport.detection.localContents':
    '{collections} collections · {environments} environnements · {requests} requêtes',
  'workbench.importExport.detection.emptyScanned':
    "Aucun magasin de données importable n'a été trouvé sur cet ordinateur.",
  'workbench.importExport.detection.emptyNotScanned':
    "Rien d'analysé pour le moment — « Analyser cet ordinateur » liste ici les données importables.",
  'workbench.importExport.detection.skippedLead': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} fichier de magasin a été ignoré —',
      many: '{count} fichiers de magasin ont été ignorés —',
      other: '{count} fichiers de magasin ont été ignorés —',
    }),

  // ── Migration report modal ─────────────────────────────────────────
  'workbench.importExport.report.title': "Rapport d'import Postman",
  'workbench.importExport.report.noReport': "Aucun rapport d'import trouvé pour cet espace de travail.",
  'workbench.importExport.report.cleanImport': 'Tout a été importé proprement — aucun abandon ni transformation.',
  'workbench.importExport.report.copyOk': 'Rapport copié en JSON',
  'workbench.importExport.report.copyAnonymizedOk': 'Rapport anonymisé copié en JSON',
  'workbench.importExport.report.copyFailed': "Le rapport n'a pas pu être copié.",
  'workbench.importExport.report.copyReport': 'Copier le rapport',
  'workbench.importExport.report.download': 'Télécharger',
  'workbench.importExport.report.anonymizeTooltip':
    "Pour un partage public (p. ex. une issue GitHub) : les noms d'espaces de travail deviennent " +
    '« Workspace N » et les valeurs réécrites sont caviardées. Les chemins, raisons et comptes restent pour ' +
    'que le rapport reste exploitable.',
  'workbench.importExport.report.anonymize': 'Anonymiser',
  'workbench.importExport.report.close': 'Fermer',
  'workbench.importExport.report.openWorkspace': "Ouvrir l'espace de travail",
  'workbench.importExport.report.countsLine':
    '{collections} collections · {environments} environnements · {requests} requêtes',
  'workbench.importExport.report.savedExamplesPart': '{count} exemples enregistrés',
  'workbench.importExport.report.globalVariablesPart': '{count} variables globales',
  'workbench.importExport.report.notesPart': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} note', many: '{count} notes', other: '{count} notes' }),
  'workbench.importExport.report.summaryImported': 'Importé',
  'workbench.importExport.report.wordCollection': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'collection', many: 'collections', other: 'collections' }),
  'workbench.importExport.report.wordEnvironment': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'environnement', many: 'environnements', other: 'environnements' }),
  'workbench.importExport.report.wordRequest': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'requête', many: 'requêtes', other: 'requêtes' }),
  'workbench.importExport.report.wordSavedExample': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'exemple enregistré',
      many: 'exemples enregistrés',
      other: 'exemples enregistrés',
    }),
  'workbench.importExport.report.wordGlobalVariable': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'variable globale',
      many: 'variables globales',
      other: 'variables globales',
    }),
  'workbench.importExport.report.wordWorkspace': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} espace de travail',
      many: '{count} espaces de travail',
      other: '{count} espaces de travail',
    }),
  'workbench.importExport.report.withOpen': '(avec',
  'workbench.importExport.report.and': 'et',
  'workbench.importExport.report.into': 'dans',

  // ── Re-import diff panel ───────────────────────────────────────────
  'workbench.importExport.reimport.agePreviously': 'précédemment',
  'workbench.importExport.reimport.previouslyImported': '(importé {age})',
  'workbench.importExport.reimport.newIssues': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} nouveau problème depuis le dernier import',
      many: '{count} nouveaux problèmes depuis le dernier import',
      other: '{count} nouveaux problèmes depuis le dernier import',
    }),
  'workbench.importExport.reimport.nowHandled': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} entrée auparavant non prise en charge est maintenant gérée',
      many: '{count} entrées auparavant non prises en charge sont maintenant gérées',
      other: '{count} entrées auparavant non prises en charge sont maintenant gérées',
    }),
  'workbench.importExport.reimport.countsChanged': 'Les comptes ont changé depuis le dernier import',
  'workbench.importExport.reimport.minorChanges': 'Changements mineurs par rapport au dernier import',
  'workbench.importExport.reimport.newDrops': 'Nouveaux abandons ({count})',
  'workbench.importExport.reimport.dropsResolved': 'Abandons résolus ({count})',
  'workbench.importExport.reimport.newTransforms': 'Nouvelles transformations ({count})',
  'workbench.importExport.reimport.transformsResolved': 'Transformations devenues inutiles ({count})',
} as const satisfies Catalog;
