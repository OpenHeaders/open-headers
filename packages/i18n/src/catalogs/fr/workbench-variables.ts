/**
 * Workbench variables station — French. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key. Technical plane
 * raw inside keyed sentences: `{{live.NAME}}` reference syntax, TOTP
 * algorithm names, PEM / Base32 / TOTP spec vocabulary, {name} /
 * {message} holes. Page titles reuse the sidebar names minted by the
 * variables doc body (`Variables d'espace de travail`,
 * `Variables Live`, `Vault` raw); the Scope panel section titles reuse
 * its `Dans la portée` / `Toutes les portées` labels; scope nouns
 * match `shared-components.ts` (`Environnement`, `Collection`,
 * `Espace de travail`, `Live`).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': 'Variable',
  'workbench.variables.table.headerSecret': 'Secret',
  'workbench.variables.table.headerValue': 'Valeur',
  'workbench.variables.table.namePlaceholder': 'Nom',
  'workbench.variables.table.valuePlaceholder': 'Valeur',
  'workbench.variables.table.addVariable': 'Ajouter une variable…',
  'workbench.variables.table.addSecret': 'Ajouter un secret…',
  'workbench.variables.table.enableRow': 'Activer la variable',
  'workbench.variables.table.disableRow': 'Désactiver la variable',
  'workbench.variables.table.markSensitive': 'Marquer comme sensible',
  'workbench.variables.table.unmarkSensitive': 'Ne plus marquer comme sensible',
  'workbench.variables.table.showValue': 'Afficher la valeur',
  'workbench.variables.table.hideValue': 'Masquer la valeur',
  'workbench.variables.table.kindText': 'Texte',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': 'Certificat',
  'workbench.variables.table.kindSecretManager': 'Gestionnaire de secrets',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': "Magasin d'identifiants du système",
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': 'Fournisseur',
  'workbench.variables.table.smField.vault': 'Vault',
  'workbench.variables.table.smField.item': 'Élément',
  'workbench.variables.table.smField.field': 'Champ',
  'workbench.variables.table.smField.account': 'Compte',
  'workbench.variables.table.smField.secretId': 'ID du secret',
  'workbench.variables.table.smField.service': 'Service',
  'workbench.variables.table.smField.name': 'Nom',
  'workbench.variables.table.smField.stage': 'Étape',
  'workbench.variables.table.smField.region': 'Région',
  'workbench.variables.table.smField.profile': 'Profil',
  'workbench.variables.table.smField.vaultUrl': 'URL du vault',
  'workbench.variables.table.smField.version': 'Version',
  'workbench.variables.table.smField.mount': 'Point de montage',
  'workbench.variables.table.smField.path': 'Chemin',
  'workbench.variables.table.smField.key': 'Clé',
  'workbench.variables.table.smField.serverUrl': 'URL du serveur',
  'workbench.variables.table.smFieldOptional': '{label} (facultatif)',
  'workbench.variables.table.smStatus.notTested': 'Non testé',
  'workbench.variables.table.smStatus.connected': 'Connecté',
  'workbench.variables.table.smStatus.connectedDetail': 'Le dernier contact a réussi à {time}.',
  'workbench.variables.table.smStatus.notInstalled': 'Indisponible sur cet appareil',
  'workbench.variables.table.smStatus.integrationDisabled': 'Intégration désactivée',
  'workbench.variables.table.smStatus.noCredentials': 'Aucun identifiant configuré',
  'workbench.variables.table.smStatus.locked': 'Verrouillé',
  'workbench.variables.table.smStatus.denied': 'Accès refusé',
  'workbench.variables.table.smStatus.unreachable': 'Injoignable',
  'workbench.variables.table.smStatus.brokerUnreachable': 'Connectez l’application de bureau',
  'workbench.variables.table.smStatus.noConnection': 'Aucune connexion sélectionnée',
  'workbench.variables.table.smStatus.guidance.onepassword.connected':
    '1Password redemande l’approbation après 10 minutes d’inactivité ; la prochaine utilisation affiche l’invite.',
  'workbench.variables.table.smStatus.guidance.onepassword.unreachable':
    'L’application 1Password n’a pas accepté la connexion. Vérifiez que le nom du compte correspond à sa barre latérale et que Réglages › Développeur › Intégrer avec les SDK 1Password est activé.',
  'workbench.variables.table.smConnection': 'Connexion',
  'workbench.variables.table.smConnectionPlaceholder': 'Connexion…',
  'workbench.variables.table.smConnectionDesktopOnly': 'À configurer dans l’application de bureau',
  'workbench.variables.table.smConnectionConnectDesktop': 'Connectez l’application de bureau',
  'workbench.variables.table.smConnectionNone': 'Aucune connexion pour ce fournisseur pour l’instant',
  'workbench.variables.table.smConnectionManage': 'Gérer…',
  'workbench.variables.table.smField.auth': 'Authentification',
  'workbench.variables.table.smField.auth.app': 'Application de bureau (biométrie)',
  'workbench.variables.table.smField.auth.serviceAccount': 'Jeton de compte de service (environnement)',
  'workbench.variables.table.smField.auth.appHint':
    'Nécessite l’application 1Password avec Réglages › Développeur › Intégrer avec les SDK 1Password activé ; le nom du compte est celui affiché dans sa barre latérale.',
  'workbench.variables.table.smField.namespace': 'Espace de noms',
  'workbench.variables.table.smField.authMethod': 'Méthode d’authentification',
  'workbench.variables.table.smField.authMethod.token': 'Jeton',
  'workbench.variables.table.smField.authMethod.approle': 'AppRole',
  'workbench.variables.table.smField.authMethod.oidc': 'OIDC',
  'workbench.variables.secretManagers.addDesktopOnly': 'Ajoutez des connexions dans l’application de bureau.',
  'workbench.variables.secretManagers.editDesktopOnly':
    'Modifiez ou retirez des connexions dans l’application de bureau.',
  'workbench.variables.secretManagers.add': 'Ajouter une connexion',
  'workbench.variables.secretManagers.empty': 'Aucune connexion à un gestionnaire de secrets pour l’instant',
  'workbench.variables.secretManagers.emptyHint':
    'Connectez un gestionnaire de secrets une seule fois ; les entrées du coffre référencent ensuite les secrets par chemin à travers lui, et le secret n’est récupéré qu’à l’exécution d’une requête.',
  'workbench.variables.secretManagers.header.label': 'Nom',
  'workbench.variables.secretManagers.header.provider': 'Fournisseur',
  'workbench.variables.secretManagers.header.target': 'Compte ou serveur',
  'workbench.variables.secretManagers.header.status': 'État',
  'workbench.variables.secretManagers.row.test': 'Tester',
  'workbench.variables.secretManagers.row.edit': 'Modifier',
  'workbench.variables.secretManagers.row.remove': 'Supprimer',
  'workbench.variables.secretManagers.form.provider': 'Fournisseur',
  'workbench.variables.secretManagers.form.label': 'Nom',
  'workbench.variables.secretManagers.form.labelPlaceholder': 'Travail',
  'workbench.variables.secretManagers.form.save': 'Enregistrer',
  'workbench.variables.secretManagers.form.cancel': 'Annuler',
  'workbench.variables.secretManagers.form.incomplete': 'Renseignez les champs obligatoires.',
  'workbench.variables.secretManagers.test.ok': 'Connecté — {label} est autorisé sur cet appareil.',
  'workbench.variables.secretManagers.test.failed': 'Connexion impossible : {detail}',
  'workbench.variables.secretManagers.saveFailedDetail': 'Impossible d’enregistrer la connexion : {message}',
  'workbench.variables.secretManagers.browserNote':
    'Les connexions aux gestionnaires de secrets résident dans l’application de bureau. Ouvrez-la pour en ajouter ou en tester une.',
  'workbench.variables.secretManagers.browserNoteConnected':
    'Ces connexions sont celles de l’application de bureau. Testez-les d’ici ; ajoutez-les ou modifiez-les dans l’application de bureau.',
  'workbench.variables.table.smInfo.exampleCaption': 'Exemple de connexion et de référence',
  'workbench.variables.table.smInfo.referenceTitle': 'Référence',
  'workbench.variables.table.smInfo.fieldsHeading': 'Champs',
  'workbench.variables.table.smInfo.reference':
    'Le chemin vers un secret dans le gestionnaire. La valeur est récupérée via la connexion uniquement lorsqu’une requête s’exécute et n’est jamais stockée ici.',
  'workbench.variables.table.smInfo.label':
    'Votre propre nom pour cette connexion — ce que montre le sélecteur de connexion de la ligne du coffre. Il n’atteint jamais le gestionnaire.',
  'workbench.variables.table.smInfo.provider.onepassword':
    'Les secrets restent dans 1Password. Une entrée du coffre nomme un vault, un élément et un champ ; la valeur est récupérée via l’app 1Password sur cet appareil (elle vous demande d’approuver) ou un token de compte de service, uniquement lorsqu’une requête s’exécute.',
  'workbench.variables.table.smInfo.provider.bitwarden':
    'Les secrets restent dans Bitwarden Secrets Manager. Une entrée du coffre nomme un secret par son ID ; la valeur est récupérée avec le token d’accès du compte machine détenu par cet appareil, uniquement lorsqu’une requête s’exécute.',
  'workbench.variables.table.smInfo.provider.oskeychain':
    'Les secrets restent dans le magasin d’identifiants de cet ordinateur — Trousseau d’accès macOS, Gestionnaire d’identifiants Windows ou Secret Service sous Linux. Une entrée du coffre nomme un service et un compte ; la valeur n’est lue que lorsqu’une requête s’exécute.',
  'workbench.variables.table.smInfo.provider.awssm':
    'Les secrets restent dans AWS Secrets Manager. Une entrée du coffre nomme un secret et, en option, une étape ; la valeur est récupérée avec les identifiants AWS détenus par cet appareil, uniquement lorsqu’une requête s’exécute.',
  'workbench.variables.table.smInfo.provider.azurekv':
    'Les secrets restent dans Azure Key Vault. Une entrée du coffre nomme un secret et, en option, une version dans un Key Vault ; la valeur est récupérée avec l’identité Azure détenue par cet appareil, uniquement lorsqu’une requête s’exécute.',
  'workbench.variables.table.smInfo.provider.hashivault':
    'Les secrets restent dans HashiCorp Vault. Une entrée du coffre nomme un point de montage, un chemin et une clé ; la valeur est récupérée depuis le serveur avec la méthode d’authentification choisie, uniquement lorsqu’une requête s’exécute.',
  'workbench.variables.table.smInfo.connection.onepassword.account':
    'Le nom du compte exactement tel que l’app 1Password l’affiche dans sa barre latérale — l’app fait correspondre sur ce nom.',
  'workbench.variables.table.smInfo.connection.onepassword.auth':
    'Comment cet appareil se connecte : via l’app de bureau 1Password, qui vous demande d’approuver chaque session (Touch ID si disponible), ou via un token de compte de service lu dans OP_SERVICE_ACCOUNT_TOKEN dans l’environnement de cette app, pour les machines sans l’app.',
  'workbench.variables.table.smInfo.connection.bitwarden.serverUrl':
    'Laissez vide pour bitwarden.com ; indiquez l’adresse d’un serveur auto-hébergé ou européen.',
  'workbench.variables.table.smInfo.connection.awssm.profile':
    'Le profil nommé du fichier d’identifiants AWS sur cet appareil ; vide utilise la chaîne d’identifiants par défaut.',
  'workbench.variables.table.smInfo.connection.awssm.region':
    'La région où vivent les secrets ; vide utilise la région par défaut du profil ou de l’environnement.',
  'workbench.variables.table.smInfo.connection.azurekv.vaultUrl':
    'L’URL propre du Key Vault (https://<name>.vault.azure.net) — une connexion par Key Vault.',
  'workbench.variables.table.smInfo.connection.hashivault.serverUrl':
    'L’adresse du serveur HashiCorp Vault, port compris.',
  'workbench.variables.table.smInfo.connection.hashivault.namespace':
    'L’espace de noms sur un serveur Enterprise ; vide pour l’espace racine.',
  'workbench.variables.table.smInfo.connection.hashivault.authMethod':
    'Comment cet appareil s’authentifie auprès du serveur : un token, un AppRole ou OIDC via votre fournisseur d’identité.',
  'workbench.variables.table.smInfo.locator.onepassword.vault':
    'Le vault 1Password qui contient l’élément, par son nom.',
  'workbench.variables.table.smInfo.locator.onepassword.item': 'Le titre de l’élément, tel que 1Password l’affiche.',
  'workbench.variables.table.smInfo.locator.onepassword.field':
    'Le champ dans l’élément — password, credential ou le libellé d’un champ personnalisé ; écrivez section/champ lorsque le champ se trouve dans une section.',
  'workbench.variables.table.smInfo.locator.bitwarden.secretId':
    'L’ID du secret dans Bitwarden Secrets Manager — l’UUID sur sa page.',
  'workbench.variables.table.smInfo.locator.oskeychain.service':
    'Le service sous lequel l’entrée est stockée — le nom de l’élément dans Trousseau d’accès ou la cible dans le Gestionnaire d’identifiants.',
  'workbench.variables.table.smInfo.locator.oskeychain.account': 'Le nom de compte de cette entrée.',
  'workbench.variables.table.smInfo.locator.awssm.name': 'Le nom du secret ou son ARN complet.',
  'workbench.variables.table.smInfo.locator.awssm.stage': 'L’étiquette d’étape à lire ; vide lit AWSCURRENT.',
  'workbench.variables.table.smInfo.locator.azurekv.name': 'Le nom du secret dans le Key Vault.',
  'workbench.variables.table.smInfo.locator.azurekv.version': 'Une version précise à lire ; vide lit la plus récente.',
  'workbench.variables.table.smInfo.locator.hashivault.mount':
    'Le chemin du point de montage du moteur de secrets — secret pour le moteur KV par défaut.',
  'workbench.variables.table.smInfo.locator.hashivault.path': 'Le chemin vers le secret sous ce point de montage.',
  'workbench.variables.table.smInfo.locator.hashivault.key': 'La clé dans le secret dont la valeur est lue.',
  'workbench.variables.table.certPlaceholder': 'Certificat (PEM)',
  'workbench.variables.table.certKeyPlaceholder': 'Clé privée (PEM)',
  'workbench.variables.table.passphrasePlaceholder': 'Phrase de passe de la clé (facultatif)',
  'workbench.variables.table.showCertificate': 'Afficher le certificat',
  'workbench.variables.table.hideCertificate': 'Masquer le certificat',
  'workbench.variables.table.seedPlaceholder': 'Graine Base32',
  'workbench.variables.table.showSeed': 'Afficher la graine',
  'workbench.variables.table.hideSeed': 'Masquer la graine',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} chiffres · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} chiffres · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': 'Émetteur',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': 'VARIABLES ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': "Variables d'espace de travail",
  'workbench.variables.workspace.description':
    'Partagées entre tous les environnements de cet espace de travail. Priorité la plus basse — substituées ' +
    'par les portées collection, environnement et vault.',
  'workbench.variables.workspace.saveFailed': "Échec de l'enregistrement des variables d'espace de travail",
  'workbench.variables.workspace.saveFailedDetail':
    "Échec de l'enregistrement des variables d'espace de travail : {message}",

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': 'Environnement introuvable.',
  'workbench.variables.environment.activeTag': 'Actif',
  'workbench.variables.environment.defaultTag': 'Par défaut',
  'workbench.variables.environment.defaultTooltip':
    "Le résolveur retombe ici quand une variable manque à l'environnement actif.",
  'workbench.variables.environment.setActive': 'Rendre actif',
  'workbench.variables.environment.setDefault': 'Définir par défaut',
  'workbench.variables.environment.unsetDefault': 'Retirer le défaut',
  'workbench.variables.environment.setDefaultTooltip':
    "Définir par défaut — le résolveur retombe ici quand une variable manque à l'environnement actif.",
  'workbench.variables.environment.unsetDefaultTooltip':
    'Retirer le défaut — le résolveur cessera de retomber sur cet environnement.',
  'workbench.variables.environment.deletedElsewhere': "L'environnement a été supprimé depuis un autre onglet",
  'workbench.variables.environment.updateFailed': "Échec de la mise à jour de l'environnement",
  'workbench.variables.environment.updateFailedDetail': "Échec de la mise à jour de l'environnement : {message}",

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'Collection introuvable.',
  'workbench.variables.collection.title': '{name} · Variables',
  'workbench.variables.collection.descriptionRule':
    'Variables disponibles pour chaque règle de cette collection. Substituées par les portées environnement ' +
    'et vault ; substituent la portée espace de travail. Stockées en clair — utilisez le Vault pour les secrets.',
  'workbench.variables.collection.descriptionRequest':
    'Variables disponibles pour chaque requête de cette collection. Substituées par les portées environnement ' +
    'et vault ; substituent la portée espace de travail. Stockées en clair — utilisez le Vault pour les secrets.',
  'workbench.variables.collection.descriptionTemplate':
    'Variables disponibles pour chaque modèle de cette collection. Substituées par les portées environnement ' +
    'et vault ; substituent la portée espace de travail. Stockées en clair — utilisez le Vault pour les secrets.',
  'workbench.variables.collection.deletedElsewhere': 'La collection a été supprimée depuis un autre onglet',
  'workbench.variables.collection.saveFailed': "Échec de l'enregistrement des variables de collection",
  'workbench.variables.collection.saveFailedDetail':
    "Échec de l'enregistrement des variables de collection : {message}",

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Les secrets du vault sont chiffrés au repos, ne quittent jamais cet appareil et priment sur toutes les ' +
    'autres portées.',
  'workbench.variables.vault.trustedRootsNote':
    'Vous cherchez des certificats CA ? Les certificats de confiance sont des données de l’espace de travail, ' +
    'pas des secrets — ils ont leur propre onglet.',
  'workbench.variables.vault.trustedRootsLink': 'Ouvrir les certificats de confiance',
  'workbench.variables.vault.secretManagersNote':
    'Les comptes et serveurs des gestionnaires de secrets sont des réglages de l’appareil, pas des entrées du coffre.',
  'workbench.variables.vault.secretManagersLink': 'Ouvrir les gestionnaires de secrets',
  'workbench.variables.vault.cipherLocked':
    "Le stockage des secrets est verrouillé — le système a refusé l'accès à son trousseau, les secrets du " +
    'vault ne peuvent donc être ni lus ni enregistrés cette session.',
  'workbench.variables.vault.cipherLockedRelaunch': "Relancer l'application",
  'workbench.variables.vault.lockedTitle': 'Vault verrouillé — clé au repos perdue',
  'workbench.variables.vault.lockedDescription':
    'Les secrets de ce vault sont toujours stockés sur cet appareil mais ne peuvent plus être déchiffrés : la ' +
    'clé au repos qui les scellait a disparu (données de navigation effacées, nouveau profil, ou clé ' +
    "d'extension réinitialisée). L'édition est désactivée pour qu'une nouvelle entrée ne puisse pas écraser " +
    'les données scellées. Ressaisissez les secrets pour déverrouiller le vault — les entrées existantes ' +
    'seront remplacées.',
  'workbench.variables.vault.secretsCount':
    'SECRETS ({strings} string · {totps} TOTP · {certs} certificat · {refs} gestionnaire de secrets)',
  'workbench.variables.vault.saveFailed': "Échec de l'enregistrement du vault",
  'workbench.variables.vault.saveFailedDetail': "Échec de l'enregistrement du vault : {message}",

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Variables Live',
  'workbench.variables.live.newVariable': 'Nouvelle variable live',
  'workbench.variables.live.descriptionPrefix':
    "Chaque liaison associe un nom à une capture d'un Workflow (une chaîne de requêtes planifiée). Référencée " +
    'dans les règles et requêtes comme',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': 'Nom',
  'workbench.variables.live.headerValue': 'Valeur',
  'workbench.variables.live.headerWorkflow': 'Workflow',
  'workbench.variables.live.empty':
    "Aucune variable live pour le moment. Créez-en une pour lier un nom à la valeur capturée d'un workflow.",
  'workbench.variables.live.draftMarker': 'brouillon',
  'workbench.variables.live.offMarker': 'inactif',
  'workbench.variables.live.overrideMarker': 'substitution',
  'workbench.variables.live.clickEyeToReveal': "Cliquez l'œil pour révéler",
  'workbench.variables.live.showValue': 'Afficher la valeur',
  'workbench.variables.live.hideValue': 'Masquer la valeur',
  'workbench.variables.live.notCapturedYet': 'pas encore capturée',
  'workbench.variables.live.missingWorkflow': 'workflow manquant',
  'workbench.variables.live.refreshNow': 'Actualiser le workflow maintenant',
  'workbench.variables.live.refreshAria': 'Actualiser {name}',
  'workbench.variables.live.editBinding': 'Modifier la liaison (nom / activée / substitution)',
  'workbench.variables.live.editAria': 'Modifier {name}',
  'workbench.variables.live.delete': 'Supprimer',
  'workbench.variables.live.deleteAria': 'Supprimer {name}',
  'workbench.variables.live.deleteFailed': 'Échec de la suppression de « {name} »',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': 'Environnement',
  'workbench.variables.panel.scope.collection': 'Collection',
  'workbench.variables.panel.scope.workspace': 'Espace de travail',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': 'Dans la portée',
  'workbench.variables.panel.inContextTitleNamed': 'Dans la portée : {name}',
  'workbench.variables.panel.inContextSummary':
    'Les variables que la règle, la requête ou le modèle actif référence — chacune résolue à travers chaque ' +
    "portée, pour voir la valeur exacte qui s'appliquera. Vide tant que vous n'en ouvrez pas.",
  'workbench.variables.panel.allScopesTitle': 'Toutes les portées',
  'workbench.variables.panel.allScopesSummary':
    'Chaque variable définie dans toutes les portées, groupée par priorité de résolution. Ouvrez le (i) ' +
    "d'une portée pour savoir comment la référencer et où elle se classe.",
  'workbench.variables.panel.sectionAboutAria': 'À propos de {title}',
  'workbench.variables.panel.scopeAboutAria': 'À propos des variables {scope}',
  'workbench.variables.panel.scopeSummary.vault':
    'Secrets par utilisateur, stockés dans votre vault et jamais synchronisés.',
  'workbench.variables.panel.scopeSummary.environment':
    "Variables de l'environnement actif, avec repli sur l'environnement par défaut.",
  'workbench.variables.panel.scopeSummary.collection': 'Variables limitées à la collection active.',
  'workbench.variables.panel.scopeSummary.workspace': "Variables partagées dans tout l'espace de travail.",
  'workbench.variables.panel.scopeSummary.live':
    'Une valeur adossée à un workflow, résolue depuis la dernière exécution.',
  'workbench.variables.panel.scopeInfo.title': '{label} {qualifier}',
  'workbench.variables.panel.scopeInfo.qualifierSecret': 'secret',
  'workbench.variables.panel.scopeInfo.qualifierVariable': 'variable',
  'workbench.variables.panel.scopeInfo.writePrefix': 'Écrivez',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': 'uniquement — jamais en',
  'workbench.variables.panel.scopeInfo.orJustMiddle': 'ou simplement',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': 'La forme nue',
  'workbench.variables.panel.scopeInfo.bareSuffix': 'se résout par priorité :',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live reste hors de cet ordre.',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · défaut : {default}',
  'workbench.variables.panel.env.subtitleNoneDefault': 'Aucun environnement · défaut : {default}',
  'workbench.variables.panel.env.subtitleNone': 'Aucun environnement',
  'workbench.variables.panel.env.editTooltip': "Ouvrir l'éditeur de variables d'environnement",
  'workbench.variables.panel.env.createTooltip': 'Créez votre premier environnement',
  'workbench.variables.panel.env.selectTooltip': "Choisir l'environnement actif",
  'workbench.variables.panel.collection.noneActive': 'Aucune collection active',
  'workbench.variables.panel.live.resolvedCount': '{resolved}/{total} résolues',
  'workbench.variables.panel.live.noneDefined': 'aucune variable live définie',
  'workbench.variables.panel.action.edit': 'Modifier',
  'workbench.variables.panel.action.editTooltip': "Ouvrir l'éditeur de variables {scope}",
  'workbench.variables.panel.action.create': 'Créer',
  'workbench.variables.panel.action.select': 'Sélectionner',
  'workbench.variables.panel.emptyScopeSecrets': 'Aucun secret défini.',
  'workbench.variables.panel.emptyScopeVariables': 'Aucune variable définie.',
  'workbench.variables.panel.openHint': "Ouvrez une requête ou une règle pour voir les variables qu'elle référence.",
  'workbench.variables.panel.noneReferenced': 'Aucune variable référencée dans cette {noun}.',
  'workbench.variables.panel.noun.rule': 'règle',
  'workbench.variables.panel.noun.request': 'requête',
  'workbench.variables.panel.noun.template': 'modèle',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable résolue',
      many: 'Toutes les {count} variables résolues',
      other: 'Toutes les {count} variables résolues',
    }),
  'workbench.variables.panel.unresolvedCount': '{count} non résolues',
  'workbench.variables.panel.valueUnresolved': 'non résolue',
  'workbench.variables.panel.valueEmpty': '(vide)',
  'workbench.variables.panel.showValue': 'Afficher la valeur',
  'workbench.variables.panel.hideValue': 'Masquer la valeur',
  'workbench.variables.panel.copyValue': 'Copier la valeur',
  'workbench.variables.panel.copied': 'Copié',
  'workbench.variables.panel.errors.title': 'Problèmes de résolution ({count})',
  'workbench.variables.panel.errors.referenceTooltip': "La référence brute à l'intérieur de {{…}}",
  'workbench.variables.panel.errors.reason.unresolved': 'non résolue',
  'workbench.variables.panel.errors.reason.unsetInScope': 'hors portée',
  'workbench.variables.panel.errors.reason.unknownNamespace': 'espace de noms inconnu',
  'workbench.variables.panel.errors.reason.stepOutOfContext': "référence d'étape hors contexte",
  'workbench.variables.panel.errors.reason.empty': 'vide',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': 'valeur invalide',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': 'autorisation requise',
  'workbench.variables.panel.errors.reason.secretNotFound': 'secret introuvable',
  'workbench.variables.panel.errors.reason.secretUnavailable': 'gestionnaire indisponible',
  'workbench.variables.panel.errors.reason.secretBrokerUnreachable': 'application de bureau non connectée',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Copier le code',
  'workbench.totpPreview.copied': 'Copié',
  'workbench.totpPreview.refreshesTooltip': "S'actualise dans {seconds}s",
  'workbench.totpPreview.refreshesAria': "Le code TOTP s'actualise dans {seconds} secondes",
} as const satisfies Catalog;
