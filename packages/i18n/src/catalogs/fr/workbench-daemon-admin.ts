/**
 * Daemon-admin family — French. Mirrors
 * `catalogs/en/workbench-daemon-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.io/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and `daemon` as the product loanword
 * (m., web.ts precedent). Seat vocabulary (`siège individuel`, the
 * `oh-license.…` placeholder) reuses `web.ts` verbatim.
 */

import type { Catalog } from '../../types';

export const workbenchDaemonAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.daemonAdmin.title': 'Administration du daemon',
  'workbench.daemonAdmin.intro':
    "Les utilisateurs de l'annuaire se connectent avec un jeton lié ou via SSO et voient exactement les espaces " +
    "de travail accordés ici. La désactivation révoque les jetons de l'utilisateur et le déconnecte immédiatement.",
  'workbench.daemonAdmin.deniedDescription': 'Administrer ce daemon requiert la capacité daemon.admin.',
  'workbench.daemonAdmin.cancel': 'Annuler',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.daemonAdmin.users.sectionTitle': 'Utilisateurs',
  'workbench.daemonAdmin.users.sectionHint':
    "Admettez un utilisateur, puis accordez des rôles par espace de travail ci-dessous. L'email relie les " +
    'connexions SSO à la fiche.',
  'workbench.daemonAdmin.users.nameRequired': 'Le nom est requis',
  'workbench.daemonAdmin.users.displayNamePlaceholder': "Nom d'affichage",
  'workbench.daemonAdmin.users.emailPlaceholder': 'Email (facultatif — requis pour le SSO)',
  'workbench.daemonAdmin.users.seatKeyPlaceholder': 'Clé de siège individuel (oh-license.…)',
  'workbench.daemonAdmin.users.addUser': 'Ajouter un utilisateur',
  'workbench.daemonAdmin.users.seatLimit':
    "Ce daemon est à sa limite de sièges. Ajoutez des sièges à votre licence d'équipe, ou collez ci-dessus la clé " +
    "de siège individuel de l'utilisateur qui rejoint — elle l'admet sans consommer un siège de la réserve.",
  'workbench.daemonAdmin.users.seatsSoldAt': 'Les sièges individuels sont vendus sur',
  'workbench.daemonAdmin.users.emptyDirectory':
    "Aucun utilisateur dans l'annuaire pour le moment — le daemon fonctionne en palier solo. Ajoutez un " +
    'utilisateur pour ouvrir le palier équipe.',
  'workbench.daemonAdmin.users.deactivatedOn': 'Désactivé le {date}',
  'workbench.daemonAdmin.users.addedOn': 'ajouté le {date}',
  'workbench.daemonAdmin.users.loadFailed': "Échec du chargement de l'annuaire des utilisateurs : {message}",
  'workbench.daemonAdmin.users.addFailed': "Échec de l'ajout de l'utilisateur : {message}",

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.daemonAdmin.seat.tag': 'Siège individuel',
  'workbench.daemonAdmin.seat.healthyTooltip':
    'Admis par son propre siège individuel ({id}) — non décompté de la réserve de ce daemon.',
  'workbench.daemonAdmin.seat.lapsedTooltip':
    "Son siège individuel ({id}) est {status}. Il reste connecté — une échéance n'évince jamais — mais le siège " +
    'ne se renouvelle plus.',
  'workbench.daemonAdmin.seat.absorbTitle': 'Absorber ce siège dans la réserve ?',
  'workbench.daemonAdmin.seat.absorbDescription':
    "L'utilisateur devient un siège de réserve ordinaire et sa licence individuelle cesse de se renouveler ici. " +
    'Cette action ne peut pas être annulée.',
  'workbench.daemonAdmin.seat.absorbOk': 'Absorber',
  'workbench.daemonAdmin.seat.absorbCta': 'Absorber dans la réserve',
  'workbench.daemonAdmin.seat.absorbed': 'Siège absorbé dans la réserve.',
  'workbench.daemonAdmin.seat.absorbFailed': "Échec de l'absorption du siège : {message}",

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.daemonAdmin.deactivate.title': 'Désactiver cet utilisateur ?',
  'workbench.daemonAdmin.deactivate.description':
    'Ses jetons sont révoqués et ses connexions actives fermées. Réadmettez-le plus tard en ajoutant à nouveau ' +
    'le même email.',
  'workbench.daemonAdmin.deactivate.cta': 'Désactiver',
  'workbench.daemonAdmin.deactivate.done':
    'Utilisateur désactivé. Ses jetons ont été révoqués et ses connexions actives fermées.',
  'workbench.daemonAdmin.deactivate.failed': 'Échec de la désactivation : {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.daemonAdmin.grants.roleViewer': 'Lecteur',
  'workbench.daemonAdmin.grants.roleEditor': 'Éditeur',
  'workbench.daemonAdmin.grants.roleOwner': 'Propriétaire',
  'workbench.daemonAdmin.grants.none': 'Aucun accès à un espace de travail pour le moment.',
  'workbench.daemonAdmin.grants.idpTooltip':
    "Accordé par le mappage du fournisseur d'identité. La révocation ne tient que jusqu'à sa prochaine connexion " +
    'SSO, qui le réapplique.',
  'workbench.daemonAdmin.grants.workspacePlaceholder': 'Espace de travail',
  'workbench.daemonAdmin.grants.grantCta': 'Accorder',
  'workbench.daemonAdmin.grants.everyWorkspace': 'Accordé sur chaque espace de travail.',
  'workbench.daemonAdmin.grants.grantFailed': "Échec de l'octroi : {message}",
  'workbench.daemonAdmin.grants.revokeFailed': 'Échec de la révocation : {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.daemonAdmin.password.setTitle': 'Définir le mot de passe — {name}',
  'workbench.daemonAdmin.password.resetTitle': 'Réinitialiser le mot de passe — {name}',
  'workbench.daemonAdmin.password.explainer':
    "L'utilisateur se connecte avec son email et ce mot de passe au portail web du daemon. Transmettez-le-lui " +
    'directement — il est haché sur le daemon et ne peut pas être relu.',
  'workbench.daemonAdmin.password.placeholder': 'Nouveau mot de passe (8 caractères minimum)',
  'workbench.daemonAdmin.password.setCta': 'Définir le mot de passe',
  'workbench.daemonAdmin.password.resetCta': 'Réinitialiser le mot de passe',
  'workbench.daemonAdmin.password.removeCta': 'Supprimer le mot de passe',
  'workbench.daemonAdmin.password.setDone': 'Mot de passe défini.',
  'workbench.daemonAdmin.password.removedDone': 'Mot de passe supprimé.',
  'workbench.daemonAdmin.password.updateFailed': 'Échec de la mise à jour du mot de passe : {message}',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.daemonAdmin.audit.sectionTitle': 'Rapports',
  'workbench.daemonAdmin.audit.sectionHint':
    "Chaque décision de permission prise par ce daemon, et chaque admission d'appareil, sous forme de piste " +
    "d'audit filtrable. L'export respecte les filtres actifs.",
  'workbench.daemonAdmin.audit.capAdmission': 'Admission (connexion)',
  'workbench.daemonAdmin.audit.capAdminPlane': "Plan d'administration",
  'workbench.daemonAdmin.audit.capSsoGrant': 'Octroi SSO (mappage)',
  'workbench.daemonAdmin.audit.capSsoRevoke': 'Révocation SSO (mappage)',
  'workbench.daemonAdmin.audit.capWorkspaceRead': "Lecture d'espace de travail",
  'workbench.daemonAdmin.audit.capWorkspaceWrite': "Écriture d'espace de travail",
  'workbench.daemonAdmin.audit.capWorkspaceList': 'Liste des espaces de travail',
  'workbench.daemonAdmin.audit.rangeLastHour': 'Dernière heure',
  'workbench.daemonAdmin.audit.rangeLast24Hours': 'Dernières 24 heures',
  'workbench.daemonAdmin.audit.rangeLast7Days': '7 derniers jours',
  'workbench.daemonAdmin.audit.rangeLast30Days': '30 derniers jours',
  'workbench.daemonAdmin.audit.colTime': 'Heure',
  'workbench.daemonAdmin.audit.colEvent': 'Événement',
  'workbench.daemonAdmin.audit.colCapability': 'Capacité',
  'workbench.daemonAdmin.audit.colWorkspace': 'Espace de travail',
  'workbench.daemonAdmin.audit.colActor': 'Acteur',
  'workbench.daemonAdmin.audit.eventAdmission': 'Admission',
  'workbench.daemonAdmin.audit.eventAdmissionRefused': 'Admission refusée',
  'workbench.daemonAdmin.audit.eventSsoGrant': 'Octroi SSO',
  'workbench.daemonAdmin.audit.eventSsoRevoke': 'Révocation SSO',
  'workbench.daemonAdmin.audit.eventAllow': 'Autorisé',
  'workbench.daemonAdmin.audit.eventDeny': 'Refusé',
  'workbench.daemonAdmin.audit.filterActor': 'Acteur',
  'workbench.daemonAdmin.audit.filterCapability': 'Capacité',
  'workbench.daemonAdmin.audit.filterDecision': 'Décision',
  'workbench.daemonAdmin.audit.filterWorkspace': 'Espace de travail',
  'workbench.daemonAdmin.audit.filterAnyTime': "N'importe quand",
  'workbench.daemonAdmin.audit.decisionAllow': 'Autorisé',
  'workbench.daemonAdmin.audit.decisionDeny': 'Refusé',
  'workbench.daemonAdmin.audit.refresh': 'Actualiser',
  'workbench.daemonAdmin.audit.exportJsonl': 'Exporter en JSONL',
  'workbench.daemonAdmin.audit.emptyText': "Aucune ligne d'audit ne correspond.",
  'workbench.daemonAdmin.audit.loadMore': 'Charger plus',
} as const satisfies Catalog;
