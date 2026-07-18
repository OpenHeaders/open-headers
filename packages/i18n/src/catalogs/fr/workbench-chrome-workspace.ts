/**
 * Workbench chrome — the workspace plane — French. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); `Org` stays the raw product noun
 * (f., shared-workspace precedent); `OAuth`, format names (PNG, JPEG,
 * WebP, SVG) and the `KB` unit ride raw as en writes them.
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'Espaces de travail',
  'workbench.workspace.newWorkspace': 'Nouvel espace de travail',
  'workbench.workspace.intro':
    'Chaque espace de travail contient ses propres règles, collections, dossiers, modèles, variables et ' +
    "historique d'exécutions de tests. Glissez pour réordonner.",
  'workbench.workspace.deleteTitle': 'Supprimer « {name} » ?',
  'workbench.workspace.deleteBody':
    "Supprime définitivement l'espace de travail et toutes ses règles, collections, dossiers, modèles, variables " +
    "et son historique d'exécutions de tests. Cette action ne peut pas être annulée.",
  'workbench.workspace.deleteOk': 'Supprimer',
  'workbench.workspace.deleteFailed': "Échec de la suppression de l'espace de travail",
  'workbench.workspace.deletedToast': '« {name} » supprimé',
  'workbench.workspace.createOk': 'Créer',
  'workbench.workspace.createFailed': "Échec de la création de l'espace de travail",
  'workbench.workspace.createdToastPrefix': 'Espace de travail créé',
  'workbench.workspace.duplicateTitle': 'Dupliquer « {name} »',
  'workbench.workspace.duplicateTitleFallback': "Dupliquer l'espace de travail",
  'workbench.workspace.duplicateOk': 'Dupliquer',
  'workbench.workspace.duplicateFailed': "Échec de la duplication de l'espace de travail",
  'workbench.workspace.duplicatedToast': '« {source} » dupliqué → « {name} »',
  'workbench.workspace.publishFailed': "Échec de la publication de l'espace de travail",
  'workbench.workspace.publishedToast': '« {name} » publié vers {org}',
  'workbench.workspace.selectedOrgFallback': "l'Org sélectionnée",
  'workbench.workspace.editTitle': "Modifier l'espace de travail",
  'workbench.workspace.saveOk': 'Enregistrer',
  'workbench.workspace.updatedToast': '« {name} » mis à jour',
  'workbench.workspace.deletedElsewhere': 'Cet espace de travail a été supprimé depuis un autre onglet',
  'workbench.workspace.updateFailed': "Échec de la mise à jour de l'espace de travail",
  'workbench.workspace.updateFailedWithMessage': "Échec de la mise à jour de l'espace de travail : {message}",
  'workbench.workspace.newWorkspacesGoTo': 'Les nouveaux espaces de travail vont dans',
  'workbench.workspace.orgPrefHint': 'Changez-le à tout moment — les espaces de travail existants restent où ils sont.',
  'workbench.workspace.otherWorkspaces': 'Autres espaces de travail',
  'workbench.workspace.dragToReorder': 'Glissez pour réordonner',
  'workbench.workspace.activePill': 'Actif',
  'workbench.workspace.switch': 'Basculer',
  'workbench.workspace.renameAria': "Renommer l'espace de travail",
  'workbench.workspace.duplicateAria': "Dupliquer l'espace de travail",
  'workbench.workspace.publishAria': "Publier l'espace de travail vers un back-end",
  'workbench.workspace.deleteAria': "Supprimer l'espace de travail",
  'workbench.workspace.prefixLabel': 'Préfixe',
  'workbench.workspace.nameLabel': 'Nom',
  'workbench.workspace.nameRequired': 'Le nom est requis',
  'workbench.workspace.nameTooLong': 'Gardez les noms sous 60 caractères',
  'workbench.workspace.namePlaceholder': 'Mon espace de travail',
  'workbench.workspace.descriptionLabel': 'Description (facultatif)',
  'workbench.workspace.copyOfName': 'Copie de {name}',
  'workbench.workspace.copyOfPlaceholder': 'Copie de …',
  'workbench.workspace.intoOrg': "Dans l'Org",
  'workbench.workspace.includeSecrets': 'Inclure le contenu du vault (secrets)',
  'workbench.workspace.includeSecretsHint':
    'Ressaisissez les secrets dans la copie si nécessaire. Les connexions OAuth sont à réautoriser dans tous ' +
    'les cas.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': "Faire de « {name} » l'espace de travail actif ?",
  'workbench.workspace.makeActiveBody':
    'Le popup, le panneau latéral et tous les nouveaux {units} qui ne sont pas épinglés à un espace de travail ' +
    'précis basculeront vers « {name} ».',
  'workbench.workspace.makeActiveOk': 'Rendre actif',
  'workbench.workspace.cancel': 'Annuler',
  'workbench.workspace.nowActiveToast': "« {name} » est désormais l'espace de travail actif",
  'workbench.workspace.switcherAria': "Ce {unit} modifie l'espace de travail : {name}. Cliquez pour changer.",

  // ── Workspace: publish modal ────────────────────────────────────────
  'workbench.workspace.publishTitle': 'Publier « {name} »',
  'workbench.workspace.publishTitleFallback': "Publier l'espace de travail",
  'workbench.workspace.publishToOk': 'Publier vers {org}',
  'workbench.workspace.publishOk': 'Publier',
  'workbench.workspace.publishIntro':
    "La publication copie cet espace de travail dans l'Org choisie, où il se synchronise via ce back-end. " +
    "L'original reste ici.",
  'workbench.workspace.toOrg': "Vers l'Org",
  'workbench.workspace.pickTargetOrg': 'Choisissez une Org cible',
  'workbench.workspace.includeSecretsPublishHint':
    'Ressaisissez les secrets dans la copie publiée si nécessaire. Les connexions OAuth sont à réautoriser dans ' +
    'tous les cas.',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Logo',
  'workbench.workspace.org.logoAria': 'Changer le logo de cette organisation',
  'workbench.workspace.org.renameButton': 'Renommer',
  'workbench.workspace.org.renameAria': 'Renommer cette organisation',
  'workbench.workspace.org.renameTitle': 'Renommer {hint}',
  'workbench.workspace.org.renameTitleFallback': 'Renommer',
  'workbench.workspace.org.nameUpdated': 'Nom mis à jour',
  'workbench.workspace.org.identityLoading': "L'identité se charge encore — réessayez dans un instant",
  'workbench.workspace.org.renameExtra':
    "Affiché dans le sélecteur d'espaces de travail et à tous ceux avec qui vous partagez des espaces de travail.",
  'workbench.workspace.org.nameTooLong': 'Gardez les noms sous {max} caractères',
  'workbench.workspace.org.namePlaceholder': 'Mon portable de travail',
  'workbench.workspace.org.logoTitle': 'Logo de {hint}',
  'workbench.workspace.org.logoTitleFallback': "Logo de l'organisation",
  'workbench.workspace.org.logoAlt': "Logo actuel de l'organisation",
  'workbench.workspace.org.replace': 'Remplacer…',
  'workbench.workspace.org.upload': 'Téléverser…',
  'workbench.workspace.org.remove': 'Retirer',
  'workbench.workspace.org.logoUpdated': 'Logo mis à jour',
  'workbench.workspace.org.logoRemoved': 'Logo retiré',
  'workbench.workspace.org.fileReadFailed': "Ce fichier n'a pas pu être lu.",
  'workbench.workspace.org.logoHint':
    "PNG, JPEG, WebP ou SVG, jusqu'à {kb} KB. Les images carrées rendent le mieux. Affiché à tous ceux qui se " +
    'synchronisent avec cette organisation.',
  'workbench.workspace.org.logoReject.notImage': "Ce fichier n'a pas pu être lu comme une image.",
  'workbench.workspace.org.logoReject.corruptImage': "Ce fichier n'est pas une image valide de son type déclaré.",
  'workbench.workspace.org.logoReject.unsupportedFormat': 'Utilisez un fichier PNG, JPEG, WebP ou SVG.',
  'workbench.workspace.org.logoReject.tooLarge': 'Gardez le logo sous {kb} KB.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'Ce SVG contient des scripts ou des références externes — exportez un SVG simple et autonome.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'Vous avez maintenant accès à un espace de travail',
  'workbench.workspace.grant.arrivedTitle': 'Un espace de travail est maintenant disponible',
  'workbench.workspace.grant.open': "Ouvrir l'espace de travail",
  'workbench.workspace.grant.notifTitleActive': 'Vous avez maintenant accès à « {name} »',
  'workbench.workspace.grant.notifTitle': "L'espace de travail « {name} » est maintenant disponible",
  'workbench.workspace.grant.notifBodyActive': "Un admin vous a accordé l'accès — vous y travaillez dès maintenant.",
  'workbench.workspace.grant.notifBody':
    "Un admin vous a accordé l'accès — il apparaît dans le sélecteur d'espaces de travail.",
  'workbench.workspace.grant.orgFallback': 'votre organisation',
  'workbench.workspace.grant.zeroBanner':
    'Connecté à {orgs} — aucun espace de travail ne vous est encore accordé. Vous travaillez dans un espace de ' +
    "travail local ; les espaces accordés apparaissent ici automatiquement dès qu'un admin vous donne accès.",

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': 'Couleur {name}',
  'workbench.workspace.picker.searchIcons': 'Rechercher des icônes...',
  'workbench.workspace.picker.noIconTooltip': 'Aucune icône — afficher seulement le carré de couleur',
  'workbench.workspace.picker.noIconAria': 'Aucune icône',
  'workbench.workspace.picker.triggerAria': "Choisir le préfixe de l'espace de travail (couleur ou icône)",
} as const satisfies Catalog;
