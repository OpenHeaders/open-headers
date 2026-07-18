/**
 * Workbench settings — keyboard-category setting definitions — French.
 * Mirrors `catalogs/en/workbench-settings-defs-keyboard.ts` key for
 * key. Chord notation and physical key names (ArrowDown, Enter, Space,
 * ⌘K, Alt+C, …) ride raw inside keyed values — localized key names are
 * a deferred Phase I workstream. Action labels reuse the shipped
 * `popup.shortcuts.*` fr wording where the same action exists there;
 * popup tab names quote the shipped fr labels (« Cette page »,
 * « Toutes les règles », « Collections »). `Flux d'activité` and
 * `palette de commandes` are minted here — `workbench-chrome.ts` must
 * reuse them.
 */

import type { Catalog } from '../../types';

export const workbenchSettingsDefsKeyboard = {
  // ── Keyboard category defs ─────────────────────────────────────────
  'workbench.settings.def.keyboard.toggleDebugMode.label': 'Basculer le mode débogage',
  'workbench.settings.def.keyboard.toggleDebugMode.description':
    "Active ou désactive le mode débogage depuis n'importe quelle surface. Ne se déclenche que quand aucun " +
    "champ texte n'a le focus.",
  'workbench.settings.def.keyboard.toggleDebugMode.capabilityUnavailableHint':
    'Le mode débogage est disponible dans Chrome et Edge.',
  'workbench.settings.def.keyboard.commandPalette.label': 'Ouvrir la palette de commandes',
  'workbench.settings.def.keyboard.commandPalette.description': 'Afficher la palette de commandes en surimpression.',
  'workbench.settings.def.keyboard.openSettings.label': 'Ouvrir les paramètres',
  'workbench.settings.def.keyboard.openSettings.description': 'Ouvrir la fenêtre modale des paramètres.',
  'workbench.settings.def.keyboard.toggleLeftSidebar.label': 'Basculer la barre latérale gauche',
  'workbench.settings.def.keyboard.toggleLeftSidebar.description': 'Afficher ou masquer la barre latérale gauche.',
  'workbench.settings.def.keyboard.toggleRightSidebar.label': 'Basculer la barre latérale droite',
  'workbench.settings.def.keyboard.toggleRightSidebar.description': 'Afficher ou masquer la barre latérale droite.',
  'workbench.settings.def.keyboard.toggleBottomPanel.label': 'Basculer le panneau inférieur',
  'workbench.settings.def.keyboard.toggleBottomPanel.description': 'Afficher ou masquer le panneau inférieur.',
  'workbench.settings.def.keyboard.toggleActivityFeed.label': "Basculer le flux d'activité",
  'workbench.settings.def.keyboard.toggleActivityFeed.description': "Afficher ou masquer le panneau Flux d'activité.",
  'workbench.settings.def.keyboard.newRule.label': 'Créer un élément',
  'workbench.settings.def.keyboard.newRule.description':
    'Ouvrir le menu de création pour les règles et les requêtes API.',
  'workbench.settings.def.keyboard.newTab.label': 'Nouvel onglet',
  'workbench.settings.def.keyboard.newTab.description': 'Ouvrir un nouvel onglet de brouillon de requête API.',
  'workbench.settings.def.keyboard.import.label': 'Importer',
  'workbench.settings.def.keyboard.import.description':
    "Ouvrir le hub d'import pour curl, HAR et les fichiers d'espace de travail.",
  'workbench.settings.def.keyboard.save.label': 'Enregistrer',
  'workbench.settings.def.keyboard.save.description': "Enregistrer l'onglet d'éditeur actif.",
  'workbench.settings.def.keyboard.closeTab.label': "Fermer l'onglet",
  'workbench.settings.def.keyboard.closeTab.description': "Fermer l'onglet d'éditeur en focus.",
  'workbench.settings.def.keyboard.previousTab.label': 'Onglet précédent',
  'workbench.settings.def.keyboard.previousTab.description': "Donner le focus à l'onglet d'éditeur précédent.",
  'workbench.settings.def.keyboard.nextTab.label': 'Onglet suivant',
  'workbench.settings.def.keyboard.nextTab.description': "Donner le focus à l'onglet d'éditeur suivant.",
  'workbench.settings.def.keyboard.tabSearch.label': 'Rechercher dans les onglets',
  'workbench.settings.def.keyboard.tabSearch.description':
    'Ouvrir une recherche en surimpression sur tous les onglets ouverts.',
  'workbench.settings.def.keyboard.focusSidebarFilter.label': 'Focus sur le filtre de la section active',
  'workbench.settings.def.keyboard.focusSidebarFilter.description':
    'Déplacer le focus vers le champ de filtre de la section de barre latérale où vous vous trouvez.',
  'workbench.settings.def.keyboard.focusLeftSidebar.label': 'Focus sur la barre latérale gauche',
  'workbench.settings.def.keyboard.focusLeftSidebar.description':
    'Déplacer le focus clavier vers la barre latérale gauche.',
  'workbench.settings.def.keyboard.focusEditor.label': "Focus sur l'éditeur",
  'workbench.settings.def.keyboard.focusEditor.description': "Déplacer le focus clavier vers la zone d'édition.",
  'workbench.settings.def.keyboard.focusRightSidebar.label': 'Focus sur la barre latérale droite',
  'workbench.settings.def.keyboard.focusRightSidebar.description':
    'Déplacer le focus clavier vers la barre latérale droite.',
  'workbench.settings.def.keyboard.focusBottomPanel.label': 'Focus sur le panneau inférieur',
  'workbench.settings.def.keyboard.focusBottomPanel.description':
    "Déplacer le focus clavier vers la rangée d'onglets du panneau inférieur.",
  'workbench.settings.def.keyboard.showShortcutHelp.label': "Afficher l'aide des raccourcis",
  'workbench.settings.def.keyboard.showShortcutHelp.description': 'Afficher le mémo des raccourcis clavier.',
  'workbench.settings.def.keyboard.find.label': "Rechercher dans l'éditeur",
  'workbench.settings.def.keyboard.find.description':
    "Ouvrir le widget de recherche dans l'éditeur de code en focus. Ne se déclenche que quand l'éditeur a le " +
    "focus — n'interfère pas avec les raccourcis globaux.",
  'workbench.settings.def.keyboard.replace.label': "Remplacer dans l'éditeur",
  'workbench.settings.def.keyboard.replace.description':
    "Ouvrir le widget rechercher-remplacer dans l'éditeur de code en focus. Ne se déclenche que quand l'éditeur " +
    "a le focus — n'interfère pas avec les raccourcis globaux.",
  'workbench.settings.def.keyboard.formatCode.label': 'Formater le code',
  'workbench.settings.def.keyboard.formatCode.description':
    "Formater le contenu de l'éditeur de code en focus. Ne se déclenche que quand l'éditeur a le focus — " +
    "n'interfère pas avec les raccourcis globaux.",
  'workbench.settings.def.keyboard.preset.label': 'Préréglage de raccourcis',
  'workbench.settings.def.keyboard.preset.description':
    'Le jeu de raccourcis de base. Les raccourcis que vous personnalisez restent par-dessus le préréglage et ' +
    'survivent à son changement.',
  'workbench.settings.def.keyboard.preset.option.openheaders.label': 'Réglages par défaut OpenHeaders',
  'workbench.settings.def.keyboard.preset.option.vscode.label': 'Style VS Code',

  // ── Keyboard popup defs ────────────────────────────────────────────
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.label': "Popup — Basculer l'aide des raccourcis",
  'workbench.settings.def.keyboard.popup.toggleShortcutsHelp.description':
    'Afficher ou masquer le mémo des raccourcis clavier du popup.',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.label': 'Popup — Basculer le menu des options',
  'workbench.settings.def.keyboard.popup.toggleOptionsMenu.description':
    'Ouvrir ou fermer le menu déroulant des options du pied de page.',
  'workbench.settings.def.keyboard.popup.focusSearch.label': 'Popup — Focus sur la recherche',
  'workbench.settings.def.keyboard.popup.focusSearch.description':
    "Déplacer le focus clavier dans le champ de recherche de l'onglet actif.",
  'workbench.settings.def.keyboard.popup.prevPage.label': 'Popup — Page précédente',
  'workbench.settings.def.keyboard.popup.prevPage.description':
    "Aller à la page précédente des règles dans l'onglet actif.",
  'workbench.settings.def.keyboard.popup.nextPage.label': 'Popup — Page suivante',
  'workbench.settings.def.keyboard.popup.nextPage.description':
    "Aller à la page suivante des règles dans l'onglet actif.",
  'workbench.settings.def.keyboard.popup.moveDown.label': 'Popup — Descendre',
  'workbench.settings.def.keyboard.popup.moveDown.description':
    'Avancer la ligne en focus. ArrowDown est toujours disponible comme alias.',
  'workbench.settings.def.keyboard.popup.moveUp.label': 'Popup — Monter',
  'workbench.settings.def.keyboard.popup.moveUp.description':
    'Déplacer le focus vers la ligne précédente. ArrowUp est toujours disponible comme alias.',
  'workbench.settings.def.keyboard.popup.expandRow.label': 'Popup — Développer / entrer dans les sous-lignes',
  'workbench.settings.def.keyboard.popup.expandRow.description':
    'Développer la ligne en focus. ArrowRight et Enter sont toujours disponibles comme alias.',
  'workbench.settings.def.keyboard.popup.collapseRow.label': 'Popup — Replier / sortir des sous-lignes',
  'workbench.settings.def.keyboard.popup.collapseRow.description':
    'Replier la ligne en focus. ArrowLeft est toujours disponible comme alias.',
  'workbench.settings.def.keyboard.popup.toggleRow.label': 'Popup — Basculer la ligne',
  'workbench.settings.def.keyboard.popup.toggleRow.description':
    "Activer ou désactiver la règle en focus. Par défaut : la barre d'espace.",
  'workbench.settings.def.keyboard.popup.editRow.label': 'Popup — Modifier la ligne',
  'workbench.settings.def.keyboard.popup.editRow.description':
    "Ouvrir la règle en focus dans l'éditeur d'espace de travail.",
  'workbench.settings.def.keyboard.popup.copyValue.label': 'Popup — Copier la valeur',
  'workbench.settings.def.keyboard.popup.copyValue.description':
    'Copier la valeur principale de la ligne en focus dans le presse-papiers.',
  'workbench.settings.def.keyboard.popup.deleteRow.label': 'Popup — Supprimer la ligne',
  'workbench.settings.def.keyboard.popup.deleteRow.description':
    'Préparer la suppression de la ligne en focus. Appuyez à nouveau (ou Enter) pour confirmer.',
  'workbench.settings.def.keyboard.popup.addRule.label': 'Popup — Ajouter une règle',
  'workbench.settings.def.keyboard.popup.addRule.description': 'Créer une nouvelle règle depuis le popup.',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.label': 'Popup — Basculer la pause des règles (global)',
  'workbench.settings.def.keyboard.popup.toggleRulesPause.description':
    'Suspendre ou reprendre toutes les règles de toutes les collections.',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.label':
    'Popup — Basculer la pause (collection/dossier en focus)',
  'workbench.settings.def.keyboard.popup.togglePauseFocused.description':
    "Suspendre ou reprendre la collection ou le dossier en focus dans l'onglet Collections. Sans effet sur les " +
    "lignes de règle individuelles — les règles utilisent la bascule d'activation (Space).",
  'workbench.settings.def.keyboard.popup.cycleTheme.label': 'Popup — Changer de thème',
  'workbench.settings.def.keyboard.popup.cycleTheme.description': 'Alterner entre les thèmes clair, sombre et auto.',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.label': 'Popup — Basculer le mode compact',
  'workbench.settings.def.keyboard.popup.toggleCompactMode.description':
    'Basculer le popup entre densité compacte et confortable.',
  'workbench.settings.def.keyboard.popup.openWorkspace.label': "Popup — Ouvrir l'espace de travail",
  'workbench.settings.def.keyboard.popup.openWorkspace.description': "Ouvrir l'onglet complet de l'espace de travail.",
  'workbench.settings.def.keyboard.popup.openSettings.label': 'Popup — Ouvrir les paramètres',
  'workbench.settings.def.keyboard.popup.openSettings.description':
    "Ouvrir la page des paramètres dans un nouvel onglet d'espace de travail. Correspond au raccourci de " +
    "l'espace de travail.",
  'workbench.settings.def.keyboard.popup.tabThisPage.label': 'Popup — Onglet Cette page',
  'workbench.settings.def.keyboard.popup.tabThisPage.description': "Activer l'onglet de règles « Cette page ».",
  'workbench.settings.def.keyboard.popup.tabAllRules.label': 'Popup — Onglet Toutes les règles',
  'workbench.settings.def.keyboard.popup.tabAllRules.description': "Activer l'onglet « Toutes les règles ».",
  'workbench.settings.def.keyboard.popup.tabCollections.label': 'Popup — Onglet Collections',
  'workbench.settings.def.keyboard.popup.tabCollections.description': "Activer l'onglet « Collections ».",
  'workbench.settings.def.keyboard.popup.toggleSurface.label': 'Popup — Basculer la surface (popup ↔ panneau latéral)',
  'workbench.settings.def.keyboard.popup.toggleSurface.description':
    "Basculer entre les dispositions popup et panneau latéral depuis l'en-tête du popup.",
  'workbench.settings.def.keyboard.popup.openTourGuide.label': 'Popup — Ouvrir la visite guidée',
  'workbench.settings.def.keyboard.popup.openTourGuide.description':
    "Rejouer la visite de bienvenue depuis n'importe quel onglet du popup.",
} as const satisfies Catalog;
