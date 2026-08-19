/**
 * DevTools panel — rule quick-editor popover + rule hover snapshot
 * plane — French. Mirrors `catalogs/en/panel-quick-editor.ts` key for
 * key. Raw by design: rule/collection/folder/header/param names, URLs,
 * `{{template}}` chips, status codes + MIME values, code/JSON example
 * placeholders, direction glyphs (⬇ ⬆), `mergeSeparator` and DNR
 * schema vocabulary, and core validator sentences riding as holes.
 * `modèle` renders template prose; snapshot op words render as nouns
 * (injection / substitution / ajout / fusion / retrait).
 */

import type { Catalog } from '../../types';

export const panelQuickEditor = {
  // ── Quick-editor popovers (station: quick-editor popover family) ────
  'panel.quickEditor.clearRuleNameAria': 'Effacer le nom de la règle',
  'panel.quickEditor.renameTitle': '{name} — cliquez pour renommer',
  'panel.quickEditor.enabledOn': 'Activée',
  'panel.quickEditor.enabledOff': 'Désactivée',
  'panel.quickEditor.ruleEnabledAria': 'Règle activée',
  'panel.quickEditor.openInTab': 'Ouvrir dans un onglet',
  'panel.quickEditor.openInWorkspace': "Ouvrir dans l'espace de travail →",
  'panel.quickEditor.saveButton': 'Enregistrer',
  'panel.quickEditor.openToInspect': "Ouvrez dans l'espace de travail pour inspecter ou modifier cette règle.",
  'panel.quickEditor.variableMissing':
    'Variable manquante — survolez la référence rouge pour la créer et activer Enregistrer.',
  'panel.quickEditor.retargetHint': 'Ajustez les conditions ci-dessous pour recibler la règle.',

  // Save/toggle toasts (create + edit chains share the not-found case).
  'panel.quickEditor.toast.ruleUpdated': 'Règle mise à jour',
  'panel.quickEditor.toast.ruleNotFound': 'Règle introuvable — elle a peut-être été supprimée.',
  'panel.quickEditor.toast.saveFailed': "Échec de l'enregistrement",
  'panel.quickEditor.toast.toggleFailed': 'Impossible de basculer la règle',
  'panel.quickEditor.toast.changedElsewhere': 'Règle modifiée ailleurs — fermez et rouvrez le popover.',
  'panel.quickEditor.toast.noWorkspace': 'Aucun espace de travail actif',
  'panel.quickEditor.toast.collectionCreateFailed': 'Impossible de créer une collection pour la règle',
  'panel.quickEditor.toast.folderCreateFailed':
    'Impossible de créer le dossier « {name} » — enregistrement à la racine de la collection.',
  'panel.quickEditor.toast.createFailed': 'Impossible de créer la règle',
  'panel.quickEditor.toast.createdDraft': "Règle créée comme brouillon — publiez-la depuis l'espace de travail.",
  'panel.quickEditor.toast.created': 'Règle créée',

  // Destination row ("Saving to" label + raw collection/folder names).
  'panel.quickEditor.destination.title': 'Choisir où la règle est enregistrée',
  'panel.quickEditor.destination.savingTo': 'Enregistrement dans',
  'panel.quickEditor.destination.newTag': 'nouveau',
  'panel.quickEditor.destination.autoNamed': 'Auto — {folder}',
  'panel.quickEditor.destination.autoRoot': 'Auto — racine de la collection',
  'panel.quickEditor.destination.root': 'Racine de la collection',

  // Conditions row ("Conditions" label + raw digest of the list).
  'panel.quickEditor.conditions.title': 'Voir et modifier quand cette règle se déclenche',
  'panel.quickEditor.conditions.label': 'Conditions',
  'panel.quickEditor.conditions.none': 'aucune — ne correspond à aucune requête',

  // Header quick editors (single-mod hover + whole-list + create).
  'panel.quickEditor.header.addHeader': 'Ajouter un en-tête',
  'panel.quickEditor.header.mergeSeparatorTitle': 'Séparateur de fusion',
  'panel.quickEditor.header.directionRequest': 'Requête',
  'panel.quickEditor.header.directionResponse': 'Réponse',
  'panel.quickEditor.validation.nameRequired': "Le nom d'en-tête est requis.",
  'panel.quickEditor.validation.invalidName': "Nom d'en-tête invalide.",
  'panel.quickEditor.validation.invalidValue': "Valeur d'en-tête invalide.",
  // {operation} interpolates the raw schema operation the one-click fix
  // would switch to (e.g. add).
  'panel.quickEditor.validation.switchTo': 'Passer à {operation}',

  // Typed bodies — popover-only copy.
  'panel.quickEditor.redirect.targetPlaceholder': 'p. ex. https://openheaders.com/redirected',
  'panel.quickEditor.redirect.hint':
    "Les requêtes correspondantes sont envoyées vers cette URL avant d'atteindre le réseau.",
  'panel.quickEditor.delay.hint':
    "Les navigations sont retardées jusqu'à 30 000 ms ; XHR/fetch est plafonné à 5 000 ms. Les " +
    'sous-ressources ne sont pas retardées.',
  'panel.quickEditor.block.editHint': "Les requêtes correspondantes sont bloquées avant d'atteindre le réseau.",
  'panel.quickEditor.block.blockRequestsTo': 'Bloquer les requêtes vers',
  'panel.quickEditor.block.createHint':
    'Les requêtes correspondantes sont annulées avant de quitter le navigateur — la page voit une erreur ' + 'réseau.',
  'panel.quickEditor.response.tagModify': 'Modification',
  'panel.quickEditor.response.tagMock': 'Mock',
  'panel.quickEditor.response.dynamicBody':
    "Cette règle construit sa réponse avec JavaScript. Ouvrez dans l'espace de travail pour modifier le script.",
  'panel.quickEditor.requestBody.hint':
    'Les requêtes correspondantes sont envoyées avec ce corps au lieu de celui de la page.',
  'panel.quickEditor.requestBody.dynamicBody':
    "Cette règle construit son corps avec JavaScript. Ouvrez dans l'espace de travail pour modifier le script.",
  'panel.quickEditor.inject.sourceUrlLabel': 'URL source',
  'panel.quickEditor.inject.loadsStylesheetHint':
    'Les pages correspondantes chargent cette feuille de style pendant leur chargement.',
  'panel.quickEditor.inject.loadsScriptHint': 'Les pages correspondantes chargent ce script pendant leur chargement.',
  'panel.quickEditor.inject.injectedHint': 'Injecté dans les pages correspondantes pendant leur chargement.',
  'panel.quickEditor.message.incoming': 'Entrant ⬇',
  'panel.quickEditor.message.outgoing': 'Sortant ⬆',
  'panel.quickEditor.message.injectedConnectionsHint':
    'Injecté sur les connexions correspondantes avant que les écouteurs ne le voient.',
  'panel.quickEditor.message.injectedStreamsHint':
    'Injecté sur les flux correspondants avant que les écouteurs ne le voient.',
  'panel.quickEditor.message.replacedFramesHint':
    "Les frames correspondants sont remplacés par cette charge utile avant d'être vus.",
  'panel.quickEditor.message.replacedEventsHint':
    "Les événements correspondants sont remplacés par cette charge utile avant d'être vus.",
  'panel.quickEditor.message.droppedFramesHint': "Les frames correspondants sont abandonnés avant d'être vus.",
  'panel.quickEditor.message.droppedEventsHint': "Les événements correspondants sont abandonnés avant d'être vus.",
  'panel.quickEditor.queryParam.addAction': 'Ajouter une action',
  'panel.quickEditor.queryParam.removeAllWarning':
    'Tout retirer supprime la chaîne de requête entière — les autres opérations de cette règle seront ' + 'ignorées.',
  'panel.quickEditor.auth.challengesHint':
    "Répond aux défis d'authentification serveur (401) et proxy (407) sur les requêtes correspondantes.",

  // ── Rule hover popover (fire-snapshot plane) ─────────────────────────
  'panel.ruleHover.tagRuleEdited': 'Règle modifiée',
  'panel.ruleHover.tagVariableChanged': 'Variable modifiée',
  'panel.ruleHover.tagDeleted': 'Supprimée',
  'panel.ruleHover.tagDisabled': 'Désactivée',
  'panel.ruleHover.tagModRemoved': 'Mod retirée',
  'panel.ruleHover.tagConditionsMismatch': 'Les conditions ne correspondent pas',
  'panel.ruleHover.tagWontFire': 'Ne se déclenchera pas',
  'panel.ruleHover.tagTitle.ruleDisabled':
    "Le drapeau d'activation de la règle est désactivé — elle ne se déclenchera sur aucune requête future.",
  'panel.ruleHover.tagTitle.modGone': 'La modification correspondante a été retirée de la règle.',
  'panel.ruleHover.tagTitle.conditionsMismatch': 'Les conditions de la règle ne couvrent plus cette URL.',
  'panel.ruleHover.tagTitle.nameUnresolved':
    "Le modèle de nom d'en-tête ne peut pas être entièrement résolu (p. ex. référence un TOTP). DNR rejette " +
    "les caractères de modèle littéraux dans les noms d'en-tête.",
  'panel.ruleHover.tagTitle.valueUnresolved': "Le modèle de valeur d'en-tête ne peut pas être entièrement résolu.",
  'panel.ruleHover.tagTitle.separatorUnresolved':
    'Le modèle de séparateur de fusion ne peut pas être entièrement résolu.',
  'panel.ruleHover.deletedBody':
    "Cette règle a été supprimée. La capture ci-dessus montre ce qu'elle a fait quand elle s'est déclenchée.",
  'panel.ruleHover.modRemovedBody':
    "La modification correspondante a été retirée de la règle. Ouvrez dans l'espace de travail pour la " +
    "recréer ou l'ajuster.",

  // Snapshot block (Original / Now / Future rows + byline).
  'panel.ruleHover.snapshot.opInject': 'injection',
  'panel.ruleHover.snapshot.opOverride': 'substitution',
  'panel.ruleHover.snapshot.opAppend': 'ajout',
  'panel.ruleHover.snapshot.opMerge': 'fusion',
  'panel.ruleHover.snapshot.opRemove': 'retrait',
  'panel.ruleHover.snapshot.templateTitle': 'Modèle avant résolution des variables au moment du déclenchement',
  'panel.ruleHover.snapshot.nameDriftTitle':
    "Même modèle — une variable référencée se résout maintenant en un autre nom d'en-tête",
  'panel.ruleHover.snapshot.cancels': 'annule « {rule} »',
  'panel.ruleHover.snapshot.original': 'Original',
  'panel.ruleHover.snapshot.now': 'Maintenant',
  'panel.ruleHover.snapshot.future': 'Futur',
  'panel.ruleHover.snapshot.futureTitle': 'Ce que la prochaine requête correspondante recevrait',
  'panel.ruleHover.snapshot.removed': 'retiré',
  'panel.ruleHover.snapshot.empty': '(vide)',
  'panel.ruleHover.snapshot.totpNote':
    'Les références TOTP / différées sont résolues au moment de la requête et ne sont pas capturées ici.',
  'panel.ruleHover.snapshot.alsoByRule': 'Aussi par cette règle sur cette requête',

  // Future-row variants (one key per FutureKind wording).
  'panel.ruleHover.future.ruleDeleted': 'la règle a été supprimée — ne se déclenchera pas',
  'panel.ruleHover.future.ruleDisabled': 'la règle est désactivée — ne se déclenchera pas',
  'panel.ruleHover.future.modGone': 'cette modification a été retirée de la règle',
  'panel.ruleHover.future.conditionsMismatch': 'les conditions de la règle ne correspondent plus à cette URL',
  'panel.ruleHover.future.nameUnresolved':
    "le modèle de nom d'en-tête ne peut pas être résolu — la règle ne se déclenchera pas",
  'panel.ruleHover.future.valueUnresolved':
    'le modèle de valeur ne peut pas être résolu — la règle ne se déclenchera pas',
  'panel.ruleHover.future.separatorUnresolved':
    'le modèle mergeSeparator ne peut pas être résolu — la règle ne se déclenchera pas',
  'panel.ruleHover.future.templateTitle': 'Modèle : {template}',
} as const satisfies Catalog;
