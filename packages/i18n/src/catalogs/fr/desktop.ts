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
  'desktop.firstRunLegal.message':
    'En continuant à utiliser Open Headers, vous acceptez nos conditions de licence et notre politique de confidentialité.',
  'desktop.firstRunLegal.license': 'Conditions de licence',
  'desktop.firstRunLegal.privacy': 'Politique de confidentialité',
  'desktop.firstRunLegal.acknowledge': 'Compris',
} as const satisfies Catalog;
