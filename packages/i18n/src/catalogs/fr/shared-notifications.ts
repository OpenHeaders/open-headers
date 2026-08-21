/**
 * Shared notifications family — French. Mirrors
 * `catalogs/en/shared-notifications.ts` key for key; see that file for
 * the family rules (store copy is captured at push time — timeline
 * entries keep the locale they were pushed under).
 */

import type { Catalog } from '../../types';

export const sharedNotifications = {
  // ── Tool window chrome ─────────────────────────────────────────────
  'shared.notifications.title': 'Notifications',
  'shared.notifications.info.summary':
    "Des suggestions sur votre configuration et une chronologie de session des événements de l'application — " +
    'disponibilité des mises à jour, résultats des tâches en arrière-plan et autres avis, rassemblés ici plutôt ' +
    "que d'interrompre votre travail.",
  'shared.notifications.suggestionsHeading': 'Suggestions',
  'shared.notifications.timelineHeading': 'Chronologie',
  'shared.notifications.clearAll': 'Tout effacer',
  'shared.notifications.suggestionsEmpty.title': 'Aucune suggestion',
  'shared.notifications.suggestionsEmpty.description': 'Des conseils sur votre configuration apparaîtront ici.',
  'shared.notifications.timelineEmpty.title': 'Aucune notification',
  'shared.notifications.timelineEmpty.description':
    "Les événements de l'application et les mises à jour apparaîtront ici.",
  'shared.notifications.dismiss': 'Ignorer',
  'shared.notifications.moreActions': "Plus d'actions",

  // ── Mute ("Don't show again") flow ─────────────────────────────────
  'shared.notifications.dontShowAgain': 'Ne plus afficher',
  'shared.notifications.muted.title': 'Notifications désactivées',
  'shared.notifications.muted.description': '« {title} » ne sera plus affichée.',
  'shared.notifications.muted.reEnable': 'Réactiver',
  'shared.notifications.muted.reEnableTooltip': "Autoriser cette notification à s'afficher de nouveau",

  // ── Seed nudges ────────────────────────────────────────────────────
  'shared.notifications.seed.website.title': 'Découvrez Open Headers',
  'shared.notifications.seed.website.description':
    'Découvrez toutes nos fonctionnalités de manière interactive, ainsi que les dernières nouveautés.',
  'shared.notifications.seed.website.action': 'Visiter notre site web',
  'shared.notifications.seed.website.tooltip': 'Ouvrir le site web et effacer la notification',
  'shared.notifications.seed.star.title': 'Aidez-nous à grandir',
  'shared.notifications.seed.star.description': 'Recommandez-nous à vos amis et collègues',
  'shared.notifications.seed.star.action': 'Donnez-nous une étoile sur GitHub',
  'shared.notifications.seed.star.tooltip': 'Ouvrir GitHub et effacer la notification',

  // ── Desktop-app suggestion (browser hosts without the companion) ───
  'shared.notifications.desktopApp.title': 'Une expérience utilisateur unifiée',
  'shared.notifications.desktopApp.rowTerminal': 'Terminal intégré — accès shell complet dans vos espaces de travail',
  'shared.notifications.desktopApp.rowGit': 'Contrôle de version — commits et historique Git pour vos espaces de travail',
  'shared.notifications.desktopApp.rowProxy': 'Capturez le trafic en direct de vos onglets de navigateur ou du système',
  'shared.notifications.desktopApp.rowMcp': 'Serveur MCP pour les assistants IA — analyse du trafic en direct et débogage',
  'shared.notifications.desktopApp.rowRequests': 'Créez et exécutez des requêtes API natives — gRPC, WebSocket, SSE et plus',
  'shared.notifications.desktopApp.action': "Télécharger l'application de bureau",
  'shared.notifications.desktopApp.tooltip': "Télécharger l'app et effacer la suggestion",

  // ── App-update timeline entries ────────────────────────────────────
  'shared.notifications.appUpdate.title': 'Open Headers {version} disponible',
  'shared.notifications.appUpdate.securityTitle': 'Mise à jour de sécurité Open Headers {version} disponible',
  'shared.notifications.appUpdate.securityDescription':
    'Cette version corrige un problème de sécurité affectant la version que vous utilisez. Mettez à jour dès que ' +
    'possible.',
  'shared.notifications.appUpdate.download': 'Télécharger…',

  // ── Update corner balloon (AppUpdateToast) ─────────────────────────
  'shared.notifications.toast.settings': 'Paramètres…',
  'shared.notifications.toast.dontShowAgain': 'Ne plus afficher',
  'shared.notifications.toast.optionsTooltip': 'Désactiver ou changer le comportement',
  'shared.notifications.toast.optionsAria': 'Options de notification de mise à jour',
  'shared.notifications.toast.close': 'Fermer',
  'shared.notifications.toast.upToDateTitle': 'Vous êtes à jour',
  'shared.notifications.toast.upToDateDescription': 'Open Headers {version} est la dernière version.',
  'shared.notifications.toast.checkFailed': 'Échec de la vérification de mise à jour',
  'shared.notifications.toast.downloadFailed': 'Échec du téléchargement de la mise à jour',
  'shared.notifications.toast.available': 'Open Headers {version} disponible',
  'shared.notifications.toast.update': 'Mettre à jour…',
  'shared.notifications.toast.packageManager': 'Mettez à jour via votre gestionnaire de paquets Linux.',
  'shared.notifications.toast.releaseNotes': 'Notes de version',
  'shared.notifications.toast.readyToInstall': 'Open Headers {version} prêt à installer',
  'shared.notifications.toast.restartToInstall': 'Redémarrer pour installer',
  'shared.notifications.toast.updatedTo': 'Mise à jour vers Open Headers {version} effectuée',
  'shared.notifications.toast.seeWhatsNew': 'Voir les nouveautés',

  // ── Security-floor entry banner ────────────────────────────────────
  'shared.notifications.securityBanner.messageWithVersion':
    'Open Headers {availableVersion} corrige un problème de sécurité affectant la version que vous utilisez ' +
    '({currentVersion}). Mettez à jour dès que possible.',
  'shared.notifications.securityBanner.messageNoVersion':
    'Un correctif de sécurité est publié pour la version que vous utilisez ({currentVersion}). Mettez à jour dès ' +
    'que possible.',
  'shared.notifications.securityBanner.update': 'Mettre à jour…',

  // ── Secrets-storage suggestion ─────────────────────────────────────
  'shared.notifications.secrets.title': 'Le stockage des secrets est verrouillé',
  'shared.notifications.secrets.description':
    'Les secrets du Vault et les jetons OAuth ne peuvent être ni lus ni enregistrés durant cette session. {remedy}',
  'shared.notifications.secrets.relaunch': "Relancer l'application",
  'shared.notifications.secrets.remedy.darwin':
    "L'accès au trousseau système a été refusé à Open Headers. Relancez l'application et autorisez l'accès au " +
    'trousseau lorsque vous y êtes invité.',
  'shared.notifications.secrets.remedy.linux':
    "Aucun trousseau de clés utilisable n'est disponible. Configurez-en un (GNOME Keyring ou KWallet), puis " +
    "relancez l'application.",
  'shared.notifications.secrets.remedy.other':
    "Open Headers n'a pas pu accéder au magasin d'identifiants du système. Relancez l'application pour réessayer.",
} as const satisfies Catalog;
