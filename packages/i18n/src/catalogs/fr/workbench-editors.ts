/**
 * Workbench editors — shared editor chrome — French. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the
 * {column} / {header} / {key} / {name} / {language} / {message} holes,
 * and `package` / `snippet` as dev loanwords (m., script-packages
 * precedent). Package-flow strings shared with
 * `workbench-script-packages.ts` (duplicate name, not-found, save
 * failed) reuse its fr sentences verbatim; `Hériter` mints the
 * Inherit option label — `workbench-editors-request.ts` must reuse it.
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': "Plus d'informations",

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Clé',
  'workbench.editors.grid.value': 'Valeur',
  'workbench.editors.grid.description': 'Description',
  'workbench.editors.grid.showColumns': 'Afficher les colonnes',
  'workbench.editors.grid.tableOptions': 'Options du tableau',
  'workbench.editors.grid.bulk': 'En bloc',
  'workbench.editors.grid.keyValue': 'Clé-Valeur',
  'workbench.editors.grid.selectAllAria': 'Activer ou désactiver toutes les lignes',
  'workbench.editors.grid.selectAllTitle': 'Tout activer / désactiver',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Redimensionner la colonne {column}',
  'workbench.editors.grid.overriddenBy': 'Doublon — substitué par la ligne {header} que vous avez ajoutée.',
  'workbench.editors.grid.suggestionValueAria': 'Valeur de {key}',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.titleCollection': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.titleFolder': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.descriptionCollection':
    "Ces scripts s'exécutent pour chaque requête de cette collection — le script pré-requête avant chaque envoi, " +
    "le script post-réponse après chaque réponse. Ils s'exécutent en premier : scripts de collection, puis " +
    'scripts de dossier, puis les scripts propres à la requête.',
  'workbench.editors.ancestorScripts.descriptionFolder':
    "Ces scripts s'exécutent pour chaque requête de ce dossier — le script pré-requête avant chaque envoi, le " +
    "script post-réponse après chaque réponse. Ils s'exécutent après les scripts de la collection et avant les " +
    'scripts propres à la requête.',
  'workbench.editors.ancestorScripts.notFoundCollection': 'Collection de requêtes introuvable.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Dossier introuvable.',
  'workbench.editors.ancestorScripts.saveFailed': "Impossible d'enregistrer les scripts.",
  'workbench.editors.ancestorScripts.saveFailedDetail': "Impossible d'enregistrer les scripts : {message}",
  'workbench.editors.ancestorScripts.deletedElsewhere': 'Cet élément a été supprimé dans une autre fenêtre.',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.titleCollection': 'Autorisation — {name}',
  'workbench.editors.ancestorAuth.titleFolder': 'Autorisation — {name}',
  'workbench.editors.ancestorAuth.descriptionCollection':
    "Les requêtes réglées sur Hériter utilisent cette autorisation. L'autorisation propre d'un dossier prend le " +
    "pas, et l'autorisation explicite d'une requête gagne toujours. Hériter ici signifie que rien n'est configuré " +
    'à ce niveau.',
  'workbench.editors.ancestorAuth.descriptionFolder':
    "Les requêtes réglées sur Hériter utilisent cette autorisation avant celle de la collection. L'autorisation " +
    "explicite d'une requête gagne toujours. Hériter ici signifie que rien n'est configuré à ce niveau — les " +
    'requêtes retombent sur la collection.',
  'workbench.editors.ancestorAuth.notFoundCollection': 'Collection de requêtes introuvable.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Dossier introuvable.',
  'workbench.editors.ancestorAuth.saveFailed': "Impossible d'enregistrer l'autorisation.",
  'workbench.editors.ancestorAuth.saveFailedDetail': "Impossible d'enregistrer l'autorisation : {message}",
  'workbench.editors.ancestorAuth.deletedElsewhere': 'Cet élément a été supprimé dans une autre fenêtre.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': "Chargement de l'exemple…",
  'workbench.editors.responseExample.notFound': 'Exemple introuvable.',
  'workbench.editors.responseExample.toast.deletedOtherTab': "L'exemple a été supprimé depuis un autre onglet",
  'workbench.editors.responseExample.toast.saveFailed': "Échec de l'enregistrement de l'exemple",
  'workbench.editors.responseExample.toast.saveFailedDetail': "Échec de l'enregistrement de l'exemple : {message}",
  'workbench.editors.responseExample.openAsRequest': 'Ouvrir comme requête',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'Crée un nouveau brouillon de requête amorcé depuis la requête de cet exemple',
  'workbench.editors.responseExample.editStatus': 'Modifier le code de statut',
  'workbench.editors.responseExample.statusPlaceholder': 'Saisissez le code de réponse',
  'workbench.editors.responseExample.capturedTooltip': 'Capturé le {date}',
  'workbench.editors.responseExample.moreActionsAria': "Plus d'actions de réponse",
  'workbench.editors.responseExample.tab.body': 'Corps',
  'workbench.editors.responseExample.tab.headers': 'En-têtes ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Langage du corps',
  'workbench.editors.responseExample.format': 'Formater',
  'workbench.editors.responseExample.formatBody': 'Formater le corps',
  'workbench.editors.responseExample.noFormatter': 'Aucun formateur pour {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Snippets',
  'workbench.editors.scriptEditor.packages': 'Packages',
  'workbench.editors.scriptEditor.searchSnippets': 'Rechercher des snippets',
  'workbench.editors.scriptEditor.searchPackages': 'Rechercher des packages',
  'workbench.editors.scriptEditor.noSnippetFound': 'Aucun snippet trouvé',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'Aucun package dans cet espace de travail pour le moment',
  'workbench.editors.scriptEditor.noPackageFound': 'Aucun package trouvé',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Ouvrir la Bibliothèque de packages →',
  'workbench.editors.scriptEditor.saveToPackage': 'Enregistrer dans la Bibliothèque de packages',
  'workbench.editors.scriptEditor.newPackage': 'Nouveau package',
  'workbench.editors.scriptEditor.newPackageName': 'Nom du nouveau package',
  'workbench.editors.scriptEditor.back': 'Retour',
  'workbench.editors.scriptEditor.create': 'Créer',
  'workbench.editors.scriptEditor.orAppend': 'Ou ajouter à un package existant :',
  'workbench.editors.scriptEditor.noPackagesYet': 'Aucun package pour le moment',
  'workbench.editors.scriptEditor.savedTo': 'Enregistré dans « {name} »',
  'workbench.editors.scriptEditor.packageCreated': 'Package « {name} » créé',
  'workbench.editors.scriptEditor.duplicatePackage':
    'Un package nommé « {name} » existe déjà dans cet espace de travail.',
  'workbench.editors.scriptEditor.packageNotFound': 'Package introuvable — il a peut-être été supprimé.',
  'workbench.editors.scriptEditor.saveFailed': "Échec de l'enregistrement",
  'workbench.editors.scriptEditor.menuFind': 'Rechercher',
  'workbench.editors.scriptEditor.find': 'Rechercher',
  'workbench.editors.scriptEditor.replace': 'Remplacer',
  'workbench.editors.scriptEditor.beautify': 'Embellir',
  'workbench.editors.scriptEditor.group.request': 'Requête',
  'workbench.editors.scriptEditor.group.workflows': 'Workflows',
  'workbench.editors.scriptEditor.group.packages': 'Packages',
  'workbench.editors.scriptEditor.group.variables': 'Variables',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Envoyer une requête HTTP',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Envoyer une requête HTTP avec un corps JSON',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Lire une variable',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Définir une variable',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Lire un secret du vault',
  'workbench.editors.scriptEditor.snippet.usePackage': 'Utiliser un package',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Définir un en-tête',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Retirer un en-tête',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Définir un paramètre de requête',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Retirer un paramètre de requête',
  'workbench.editors.scriptEditor.snippet.setUrl': "Définir l'URL",
  'workbench.editors.scriptEditor.snippet.setMethod': 'Définir la méthode',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Définir un corps JSON',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'Le code de statut est 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'Le corps de la réponse contient une chaîne',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'Le corps de la réponse est égal à une chaîne',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': "Vérification d'une valeur JSON du corps de réponse",
  'workbench.editors.scriptEditor.snippet.headerCheck': "Vérification d'un en-tête de réponse",
  'workbench.editors.scriptEditor.snippet.responseTime': 'Le temps de réponse est inférieur à 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Enregistrer une valeur de la réponse dans une variable',
} as const satisfies Catalog;
