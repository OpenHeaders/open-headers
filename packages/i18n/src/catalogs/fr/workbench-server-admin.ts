/**
 * Daemon-admin family — French. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.com/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and `daemon` as the product loanword
 * (m., web.ts precedent). Seat vocabulary (`siège individuel`, the
 * `oh-license.…` placeholder) reuses `web.ts` verbatim.
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'Administration du serveur',
  'workbench.serverAdmin.intro':
    "Les utilisateurs de l'annuaire se connectent avec un jeton lié ou via SSO et voient exactement les espaces " +
    "de travail accordés ici. La désactivation révoque les jetons de l'utilisateur et le déconnecte immédiatement.",
  'workbench.serverAdmin.deniedDescription': 'Administrer ce serveur requiert la capacité daemon.admin.',
  'workbench.serverAdmin.cancel': 'Annuler',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.notes.sectionTitle': 'Notes de version',
  'workbench.serverAdmin.notes.sectionHint':
    'Ce qui a été livré dans le build du serveur administré par cette console.',
  'workbench.serverAdmin.notes.versionLine': 'Serveur {version}',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'Utilisateurs',
  'workbench.serverAdmin.users.sectionHint':
    "Admettez un utilisateur, puis accordez des rôles par espace de travail ci-dessous. L'email relie les " +
    'connexions SSO à la fiche.',
  'workbench.serverAdmin.users.nameRequired': 'Le nom est requis',
  'workbench.serverAdmin.users.displayNamePlaceholder': "Nom d'affichage",
  'workbench.serverAdmin.users.emailPlaceholder': 'Email (facultatif — requis pour le SSO)',
  'workbench.serverAdmin.users.seatKeyPlaceholder': 'Clé de siège individuel (oh-license.…)',
  'workbench.serverAdmin.users.addUser': 'Ajouter un utilisateur',
  'workbench.serverAdmin.users.seatLimit':
    "Ce serveur est à sa limite de sièges. Ajoutez des sièges à votre licence d'équipe, ou collez ci-dessus la clé " +
    "de siège individuel de l'utilisateur qui rejoint — elle l'admet sans consommer un siège de la réserve.",
  'workbench.serverAdmin.users.seatsSoldAt': 'Les sièges individuels sont vendus sur',
  'workbench.serverAdmin.users.emptyDirectory':
    "Aucun utilisateur dans l'annuaire pour le moment — le serveur fonctionne en palier solo. Ajoutez un " +
    'utilisateur pour ouvrir le palier équipe.',
  'workbench.serverAdmin.users.deactivatedOn': 'Désactivé le {date}',
  'workbench.serverAdmin.users.addedOn': 'ajouté le {date}',
  'workbench.serverAdmin.users.loadFailed': "Échec du chargement de l'annuaire des utilisateurs : {message}",
  'workbench.serverAdmin.users.addFailed': "Échec de l'ajout de l'utilisateur : {message}",

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': 'Siège individuel',
  'workbench.serverAdmin.seat.healthyTooltip':
    'Admis par son propre siège individuel ({id}) — non décompté de la réserve de ce serveur.',
  'workbench.serverAdmin.seat.lapsedTooltip':
    "Son siège individuel ({id}) est {status}. Il reste connecté — une échéance n'évince jamais — mais le siège " +
    'ne se renouvelle plus.',
  'workbench.serverAdmin.seat.absorbTitle': 'Absorber ce siège dans la réserve ?',
  'workbench.serverAdmin.seat.absorbDescription':
    "L'utilisateur devient un siège de réserve ordinaire et sa licence individuelle cesse de se renouveler ici. " +
    'Cette action ne peut pas être annulée.',
  'workbench.serverAdmin.seat.absorbOk': 'Absorber',
  'workbench.serverAdmin.seat.absorbCta': 'Absorber dans la réserve',
  'workbench.serverAdmin.seat.absorbed': 'Siège absorbé dans la réserve.',
  'workbench.serverAdmin.seat.absorbFailed': "Échec de l'absorption du siège : {message}",

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': 'Désactiver cet utilisateur ?',
  'workbench.serverAdmin.deactivate.description':
    'Ses jetons sont révoqués et ses connexions actives fermées. Réadmettez-le plus tard en ajoutant à nouveau ' +
    'le même email.',
  'workbench.serverAdmin.deactivate.cta': 'Désactiver',
  'workbench.serverAdmin.deactivate.done':
    'Utilisateur désactivé. Ses jetons ont été révoqués et ses connexions actives fermées.',
  'workbench.serverAdmin.deactivate.failed': 'Échec de la désactivation : {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': 'Lecteur',
  'workbench.serverAdmin.grants.roleEditor': 'Éditeur',
  'workbench.serverAdmin.grants.roleOwner': 'Propriétaire',
  'workbench.serverAdmin.grants.none': 'Aucun accès à un espace de travail pour le moment.',
  'workbench.serverAdmin.grants.idpTooltip':
    "Accordé par le mappage du fournisseur d'identité. La révocation ne tient que jusqu'à sa prochaine connexion " +
    'SSO, qui le réapplique.',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'Espace de travail',
  'workbench.serverAdmin.grants.grantCta': 'Accorder',
  'workbench.serverAdmin.grants.everyWorkspace': 'Accordé sur chaque espace de travail.',
  'workbench.serverAdmin.grants.grantFailed': "Échec de l'octroi : {message}",
  'workbench.serverAdmin.grants.revokeFailed': 'Échec de la révocation : {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'Définir le mot de passe — {name}',
  'workbench.serverAdmin.password.resetTitle': 'Réinitialiser le mot de passe — {name}',
  'workbench.serverAdmin.password.explainer':
    "L'utilisateur se connecte avec son email et ce mot de passe au portail web du serveur. Transmettez-le-lui " +
    'directement — il est haché sur le serveur et ne peut pas être relu.',
  'workbench.serverAdmin.password.placeholder': 'Nouveau mot de passe (8 caractères minimum)',
  'workbench.serverAdmin.password.setCta': 'Définir le mot de passe',
  'workbench.serverAdmin.password.resetCta': 'Réinitialiser le mot de passe',
  'workbench.serverAdmin.password.removeCta': 'Supprimer le mot de passe',
  'workbench.serverAdmin.password.setDone': 'Mot de passe défini.',
  'workbench.serverAdmin.password.removedDone': 'Mot de passe supprimé.',
  'workbench.serverAdmin.password.updateFailed': 'Échec de la mise à jour du mot de passe : {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': "Définir l'email Git — {name}",
  'workbench.serverAdmin.gitEmail.changeTitle': "Changer l'email Git — {name}",
  'workbench.serverAdmin.gitEmail.explainer':
    'Les commits portant le travail de cet utilisateur sont signés avec cette adresse, et se relient donc à ' +
    "son profil d'hébergement Git. À défaut, l'email de l'annuaire est utilisé, puis une adresse noreply.",
  'workbench.serverAdmin.gitEmail.placeholder': "email de l'auteur des commits",
  'workbench.serverAdmin.gitEmail.setCta': "Définir l'email Git",
  'workbench.serverAdmin.gitEmail.changeCta': "Changer l'email Git",
  'workbench.serverAdmin.gitEmail.removeCta': 'Supprimer la surcharge',
  'workbench.serverAdmin.gitEmail.setDone': 'Email Git défini.',
  'workbench.serverAdmin.gitEmail.removedDone': "Surcharge d'email Git supprimée.",
  'workbench.serverAdmin.gitEmail.updateFailed': "Échec de la mise à jour de l'email Git : {message}",

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    'Liez un espace de travail du serveur à un dépôt et pilotez commit, pull, push et branches à distance. ' +
    'Les chemins sont sur le système de fichiers du serveur lui-même.',
  'workbench.serverAdmin.git.workspaceLabel': 'Espace de travail',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'Rapports',
  'workbench.serverAdmin.audit.sectionHint':
    "Chaque décision de permission prise par ce serveur, et chaque admission d'appareil, sous forme de piste " +
    "d'audit filtrable. L'export respecte les filtres actifs.",
  'workbench.serverAdmin.audit.capAdmission': 'Admission (connexion)',
  'workbench.serverAdmin.audit.capAdminPlane': "Plan d'administration",
  'workbench.serverAdmin.audit.capSsoGrant': 'Octroi SSO (mappage)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'Révocation SSO (mappage)',
  'workbench.serverAdmin.audit.capWorkspaceRead': "Lecture d'espace de travail",
  'workbench.serverAdmin.audit.capWorkspaceWrite': "Écriture d'espace de travail",
  'workbench.serverAdmin.audit.capWorkspaceList': 'Liste des espaces de travail',
  'workbench.serverAdmin.audit.rangeLastHour': 'Dernière heure',
  'workbench.serverAdmin.audit.rangeLast24Hours': 'Dernières 24 heures',
  'workbench.serverAdmin.audit.rangeLast7Days': '7 derniers jours',
  'workbench.serverAdmin.audit.rangeLast30Days': '30 derniers jours',
  'workbench.serverAdmin.audit.colTime': 'Heure',
  'workbench.serverAdmin.audit.colEvent': 'Événement',
  'workbench.serverAdmin.audit.colCapability': 'Capacité',
  'workbench.serverAdmin.audit.colWorkspace': 'Espace de travail',
  'workbench.serverAdmin.audit.colActor': 'Acteur',
  'workbench.serverAdmin.audit.eventAdmission': 'Admission',
  'workbench.serverAdmin.audit.eventAdmissionRefused': 'Admission refusée',
  'workbench.serverAdmin.audit.eventSsoGrant': 'Octroi SSO',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'Révocation SSO',
  'workbench.serverAdmin.audit.eventAllow': 'Autorisé',
  'workbench.serverAdmin.audit.eventDeny': 'Refusé',
  'workbench.serverAdmin.audit.filterActor': 'Acteur',
  'workbench.serverAdmin.audit.filterCapability': 'Capacité',
  'workbench.serverAdmin.audit.filterDecision': 'Décision',
  'workbench.serverAdmin.audit.filterWorkspace': 'Espace de travail',
  'workbench.serverAdmin.audit.filterAnyTime': "N'importe quand",
  'workbench.serverAdmin.audit.decisionAllow': 'Autorisé',
  'workbench.serverAdmin.audit.decisionDeny': 'Refusé',
  'workbench.serverAdmin.audit.refresh': 'Actualiser',
  'workbench.serverAdmin.audit.exportJsonl': 'Exporter en JSONL',
  'workbench.serverAdmin.audit.emptyText': "Aucune ligne d'audit ne correspond.",
  'workbench.serverAdmin.audit.loadMore': 'Charger plus',
} as const satisfies Catalog;
