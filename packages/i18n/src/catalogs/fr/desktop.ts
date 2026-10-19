/**
 * Desktop namespace — French. Mirrors `catalogs/en/desktop.ts` key for
 * key; role-bound menu items keep Electron's own labels and the
 * 'Open Headers' brand rides raw inside the values.
 */

import type { Catalog } from '../../types';

export const desktop = {
  'desktop.tray.open': 'Ouvrir Open Headers',
  'desktop.tray.quit': 'Quitter',
  'desktop.menu.settings': 'Paramètres…',
  'desktop.menu.about': 'À propos de {name}',
  'desktop.menu.enableHardwareAcceleration': "Activer l'accélération matérielle",
  'desktop.menu.disableHardwareAcceleration': "Désactiver l'accélération matérielle",
  'desktop.menu.file': 'Fichier',
  'desktop.menu.edit': 'Édition',
  'desktop.menu.view': 'Affichage',
  'desktop.menu.window': 'Fenêtre',
  'desktop.menu.help': 'Aide',
  'desktop.menu.newItem': 'Nouveau…',
  'desktop.menu.newTab': 'Nouvel onglet',
  'desktop.menu.newWindow': 'Nouvelle fenêtre',
  'desktop.menu.import': 'Importer…',
  'desktop.menu.closeTab': "Fermer l'onglet",
  'desktop.menu.nextTab': 'Onglet suivant',
  'desktop.menu.previousTab': 'Onglet précédent',
  'desktop.menu.actualSize': 'Taille réelle',
  'desktop.menu.documentation': 'Documentation',
  'desktop.menu.reportIssue': 'Signaler un problème',
  'desktop.menu.saveDiagnostics': 'Enregistrer le diagnostic…',
  'desktop.menu.licenseAgreement': 'Contrat de licence',
  'desktop.update.check': 'Rechercher des mises à jour…',
  'desktop.update.checking': 'Recherche de mises à jour…',
  'desktop.update.updateAndRestart': 'Mettre à jour vers Open Headers {version} et redémarrer',
  'desktop.update.availableExternal': 'Version {version} disponible…',
  'desktop.update.downloading': 'Téléchargement de la mise à jour… {percent} %',
  'desktop.update.downloadingNoProgress': 'Téléchargement de la mise à jour…',
  'desktop.update.restartToInstall': 'Redémarrer pour installer Open Headers {version}',
  'desktop.dialog.hardwareAcceleration.title': 'Accélération matérielle',
  'desktop.dialog.hardwareAcceleration.willBeDisabled':
    "L'accélération matérielle sera désactivée au prochain démarrage de {name}.",
  'desktop.dialog.hardwareAcceleration.willBeEnabled':
    "L'accélération matérielle sera activée au prochain démarrage de {name}.",
  'desktop.dialog.hardwareAcceleration.detail': 'Redémarrez maintenant pour appliquer le changement immédiatement.',
  'desktop.dialog.hardwareAcceleration.restartNow': 'Redémarrer maintenant',
  'desktop.dialog.hardwareAcceleration.later': 'Plus tard',
  'desktop.dialog.windowCrashed.title': 'La fenêtre a planté',
  'desktop.dialog.windowCrashed.message': '{name} a rouvert la fenêtre une fois, et elle a planté de nouveau.',
  'desktop.dialog.windowCrashed.detail':
    'Les détails sont dans le fichier journal. Avec certains pilotes graphiques, redémarrer sans accélération matérielle aide.',
  'desktop.dialog.windowCrashed.reopen': 'Rouvrir',
  'desktop.dialog.windowCrashed.openLogs': 'Ouvrir les journaux',
  'desktop.dialog.windowCrashed.restartWithoutAcceleration': 'Redémarrer sans accélération matérielle',
  'desktop.dialog.windowCrashed.quit': 'Quitter',
  'desktop.dialog.windowUnresponsive.title': 'La fenêtre ne répond pas',
  'desktop.dialog.windowUnresponsive.message': '{name} ne répond pas.',
  'desktop.dialog.windowUnresponsive.detail': 'Vous pouvez continuer à attendre ou rouvrir la fenêtre.',
  'desktop.dialog.windowUnresponsive.keepWaiting': 'Continuer à attendre',
  'desktop.dialog.windowUnresponsive.reopen': 'Rouvrir',
  'desktop.dialog.windowUnresponsive.quit': 'Quitter',
  'desktop.dialog.gpuCrashed.title': 'Le processus graphique a planté',
  'desktop.dialog.gpuCrashed.message': 'Le processus graphique a planté deux fois pendant cette session.',
  'desktop.dialog.gpuCrashed.detail':
    'Redémarrer sans accélération matérielle contourne le pilote graphique. Vous pourrez la réactiver depuis le menu de l’application.',
  'desktop.dialog.gpuCrashed.restartWithoutAcceleration': 'Redémarrer sans accélération matérielle',
  'desktop.dialog.gpuCrashed.later': 'Plus tard',
  'desktop.firstRunLegal.message':
    'En continuant à utiliser Open Headers, vous acceptez nos conditions de licence et notre politique de confidentialité.',
  'desktop.firstRunLegal.license': 'Conditions de licence',
  'desktop.firstRunLegal.privacy': 'Politique de confidentialité',
  'desktop.firstRunLegal.acknowledge': 'Compris',
} as const satisfies Catalog;
