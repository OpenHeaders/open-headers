/**
 * DevTools panel — inspector stream tabs — French. Mirrors
 * `catalogs/en/panel-inspector-streams.ts` key for key. Grid column
 * headers, opcode vocabulary, `id:` / `event:` / `Last-Event-ID`
 * wire fields, the JSON toggle, and Base64 / Hex / UTF-8 modes stay
 * parity-raw.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelInspectorStreams = {
  // ── Messages / EventStream tabs (inspector detail) ──────────────────
  'panel.inspector.streams.clearAll': 'Tout effacer',
  'panel.inspector.streams.directionFilterTitle': 'Filtrer par direction',
  'panel.inspector.streams.directionAll': 'Toutes',
  'panel.inspector.streams.directionSend': 'Envoi',
  'panel.inspector.streams.directionReceive': 'Réception',
  'panel.inspector.streams.filterAria': 'Filtrer les messages du flux',
  'panel.inspector.streams.sortByTitle': 'Trier par {column}',
  'panel.inspector.streams.resizeColumnAria': 'Redimensionner la colonne {column}',

  // View ▾ menu shared by both grids.
  'panel.inspector.streams.view.label': 'Vue',
  'panel.inspector.streams.view.layout': 'Disposition',
  'panel.inspector.streams.view.layoutCompact': 'Compacte',
  'panel.inspector.streams.view.layoutWide': 'Large',
  'panel.inspector.streams.view.split': 'Scission',
  'panel.inspector.streams.view.splitSideBySide': 'Côte à côte',
  'panel.inspector.streams.view.splitStacked': 'Empilés',
  'panel.inspector.streams.view.splitDisabledTitle': "Activez l'aperçu de la charge utile pour scinder le panneau",
  'panel.inspector.streams.view.showPreview': "Afficher l'aperçu de la charge utile",

  // Fire-rail dot titles + row actions — resolved once per locale into
  // the row labels object.
  'panel.inspector.streams.fire.appliedFrame':
    'Règle appliquée — la charge utile du frame correspond à celle de la règle',
  'panel.inspector.streams.fire.inferredFrame': 'Règle correspondante — application non vérifiable pour ce frame',
  'panel.inspector.streams.fire.injectedFrame': 'Règle appliquée — ce frame a été injecté par la règle',
  'panel.inspector.streams.fire.replacedFrame': 'Règle appliquée — la règle a remplacé ce frame',
  'panel.inspector.streams.fire.droppedSendFrame': "Règle a abandonné ce frame — il n'a jamais été envoyé au serveur",
  'panel.inspector.streams.fire.droppedRecvFrame': "Règle a abandonné ce frame — la page ne l'a jamais reçu",
  'panel.inspector.streams.fire.appliedEvent':
    "Règle appliquée — la charge utile de l'événement correspond à celle de la règle",
  'panel.inspector.streams.fire.inferredEvent': 'Règle correspondante — application non vérifiable pour cet événement',
  'panel.inspector.streams.fire.injectedEvent': 'Règle appliquée — cet événement a été injecté par la règle',
  'panel.inspector.streams.fire.replacedEvent': 'Règle appliquée — la règle a remplacé cet événement',
  'panel.inspector.streams.fire.droppedEvent': "Règle a abandonné cet événement — la page ne l'a jamais reçu",
  'panel.inspector.streams.row.copied': 'Copié',
  'panel.inspector.streams.row.copyPayload': 'Copier la charge utile',
  'panel.inspector.streams.row.editRule': 'Modifier la règle',
  'panel.inspector.streams.row.override': 'Substituer',
  'panel.inspector.streams.row.droppedSendCell': 'Abandonné — jamais envoyé au serveur',
  'panel.inspector.streams.row.droppedRecvCell': 'Abandonné — jamais délivré à la page',
  'panel.inspector.streams.row.notCaptured': 'Non capturé',

  // Messages (WebSocket) surface.
  'panel.inspector.messages.filterPlaceholder': 'Filtrer les messages',
  'panel.inspector.messages.listAria': 'Messages WebSocket',
  'panel.inspector.messages.overrideMessage': 'Substituer le message',
  'panel.inspector.messages.overrideMessageTitle': 'Créer une règle de message pour cette connexion',
  'panel.inspector.messages.editRuleTitle': 'Modifier la règle de message qui a agi sur ce frame',
  'panel.inspector.messages.createRuleTitle': 'Créer une règle de message semée depuis ce frame',
  'panel.inspector.messages.syntheticDroppedTitle':
    "Ligne synthétique — la page a produit ce frame ; la règle l'a abandonné avant l'envoi",
  'panel.inspector.messages.syntheticInjectedTitle':
    "Frame synthétique — injecté par une règle dans la page ; n'a jamais traversé le réseau",
  'panel.inspector.messages.emptyNoDebug':
    'Les frames WebSocket ne sont visibles que quand le mode débogage est activé pour cet onglet.',
  'panel.inspector.messages.emptySynthetic':
    "Aucun frame n'a traversé le réseau — une règle d'injection s'est déclenchée ici, et les frames injectés " +
    'sont délivrés synthétiquement dans la page, invisibles pour la capture réseau.',
  'panel.inspector.messages.emptyNone': 'Aucun frame WebSocket échangé pour le moment.',
  'panel.inspector.messages.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} frame plus ancien abandonné.',
      many: '{count} frames plus anciens abandonnés.',
      other: '{count} frames plus anciens abandonnés.',
    });
    return `Affichage des ${String(shown)} derniers frames — ${dropped}`;
  },

  // EventStream (SSE) surface.
  'panel.inspector.sse.filterPlaceholder': 'Filtrer les événements',
  'panel.inspector.sse.listAria': 'Événements envoyés par le serveur',
  'panel.inspector.sse.overrideEvent': "Substituer l'événement",
  'panel.inspector.sse.overrideEventTitle': 'Créer une règle de message pour ce flux',
  'panel.inspector.sse.editRuleTitle': 'Modifier la règle de message qui a agi sur cet événement',
  'panel.inspector.sse.createRuleTitle': 'Créer une règle de message semée depuis cet événement',
  'panel.inspector.sse.syntheticTitle':
    "Événement synthétique — injecté par une règle dans la page ; n'a jamais traversé le réseau",
  'panel.inspector.sse.emptySynthetic':
    "Aucun événement n'a traversé le réseau — une règle d'injection s'est déclenchée ici, et les événements " +
    'injectés sont délivrés synthétiquement dans la page, invisibles pour la capture réseau.',
  'panel.inspector.sse.emptyUnparseable': 'Aucun événement SSE analysable dans le corps de la réponse.',
  'panel.inspector.sse.emptyNoDebug':
    "Aucun événement capturé. Sans mode débogage, les flux server-sent ne sont matérialisés qu'à la fin de " +
    "la requête ; les flux au long cours peuvent ne s'afficher ici qu'à la fermeture de la connexion.",
  'panel.inspector.sse.emptyNone': 'Aucun événement reçu pour le moment.',
  'panel.inspector.sse.truncation': ({ shown, count }, locale) => {
    const dropped = plural(locale, Number(count), {
      one: '{count} événement plus ancien abandonné.',
      many: '{count} événements plus anciens abandonnés.',
      other: '{count} événements plus anciens abandonnés.',
    });
    return `Affichage des ${String(shown)} derniers événements — ${dropped}`;
  },

  // Preview panes (MessagePreview / SseEventPreview / shared TextPayload
  // + BinaryPreview). The JSON toggle stays raw beside the keyed Raw.
  'panel.inspector.streams.preview.noMessageTitle': 'Aucun message sélectionné',
  'panel.inspector.streams.preview.noMessageHint': 'Sélectionnez un message pour parcourir son contenu.',
  'panel.inspector.streams.preview.noEventTitle': 'Aucun événement sélectionné',
  'panel.inspector.streams.preview.noEventHint': 'Sélectionnez un événement pour parcourir son contenu.',
  'panel.inspector.streams.preview.raw': 'Brut',
  'panel.inspector.streams.preview.copy': 'Copier',
  'panel.inspector.streams.preview.copied': 'Copié',
  'panel.inspector.streams.preview.copyTitle': 'Copier dans le presse-papiers',
  'panel.inspector.streams.preview.decodeFailed': "La charge utile binaire n'a pas pu être décodée.",
  'panel.inspector.messages.preview.droppedSendPane':
    "La règle a abandonné ce frame — la page l'a produit, mais il n'a jamais été envoyé au serveur.",
  'panel.inspector.messages.preview.droppedRecvPane':
    "La règle a abandonné ce frame — il a atteint le navigateur mais n'a jamais été délivré à la page.",
  'panel.inspector.messages.preview.originalNotCaptured':
    "Le frame produit par la page n'a pas été capturé — seul le frame modifié a traversé le réseau.",
  'panel.inspector.messages.preview.syntheticNote':
    "Frame synthétique — injecté par une règle dans la page ; il n'a jamais traversé le réseau.",
  'panel.inspector.sse.preview.droppedPane':
    "La règle a abandonné cet événement — il a atteint le navigateur mais n'a jamais été délivré à la page.",
  'panel.inspector.sse.preview.syntheticNote':
    "Événement synthétique — injecté par une règle dans la page ; il n'a jamais traversé le réseau.",

  // Inferred-tier (i) corpora on the split captions — frame and event
  // wordings are separate referents.
  'panel.inspector.messages.inferredModified.title': 'Dérivé, non capturé',
  'panel.inspector.messages.inferredModified.summary':
    "Ce côté montre la charge utile de remplacement de la règle — le plan de capture n'a jamais vu que le " +
    'frame du réseau.',
  'panel.inspector.messages.inferredModified.description':
    "Le réseau a enregistré le frame d'origine ; la modification a eu lieu dans la page après capture. Que " +
    'ce frame précis ait reçu le remplacement est inféré du sélecteur de frames de la règle, en accord avec ' +
    'le point ambre de déclenchement.',
  'panel.inspector.messages.inferredDropped.title': 'Abandonné, inféré',
  'panel.inspector.messages.inferredDropped.summary':
    'Le réseau a enregistré ce frame, mais la règle a arrêté sa livraison dans la page.',
  'panel.inspector.messages.inferredDropped.description':
    "L'abandon survient après la capture, rien ne peut donc enregistrer la non-livraison elle-même. Que ce " +
    'frame précis ait été abandonné est inféré du sélecteur de frames de la règle, en accord avec le point ' +
    'ambre de déclenchement.',
  'panel.inspector.sse.inferredModified.title': 'Dérivé, non capturé',
  'panel.inspector.sse.inferredModified.summary':
    "Ce côté montre la charge utile de remplacement de la règle — le plan de capture n'a jamais vu que " +
    "l'événement du réseau.",
  'panel.inspector.sse.inferredModified.description':
    "Le réseau a enregistré l'événement d'origine ; la modification a eu lieu dans la page après capture. " +
    "Que cet événement précis ait reçu le remplacement est inféré du sélecteur d'événements de la règle, en " +
    'accord avec le point ambre de déclenchement.',
  'panel.inspector.sse.inferredDropped.title': 'Abandonné, inféré',
  'panel.inspector.sse.inferredDropped.summary':
    'Le réseau a enregistré cet événement, mais la règle a arrêté sa livraison dans la page.',
  'panel.inspector.sse.inferredDropped.description':
    "L'abandon survient après la capture, rien ne peut donc enregistrer la non-livraison elle-même. Que cet " +
    "événement précis ait été abandonné est inféré du sélecteur d'événements de la règle, en accord avec le " +
    'point ambre de déclenchement.',

  // Column / rail (i) corpora — titles are raw column nouns; kickers
  // reuse the section-tab keys; the fire-rail kicker is the raw brand.
  'panel.inspector.messages.columnInfo.exampleCaption': 'Exemple de frame',
  // Fragment between the length and time tokens in the example card's
  // meta line ('42 chars · 18:00:01').
  'panel.inspector.messages.columnInfo.exampleChars': 'car. ·',
  'panel.inspector.messages.columnInfo.data.summary':
    'La charge utile du frame — les frames texte montrent leur contenu tel quel.',
  'panel.inspector.messages.columnInfo.data.description':
    'Sélectionnez une ligne pour ouvrir la visionneuse de charge utile : un arbre JSON quand le texte ' +
    "s'analyse, une visionneuse Base64 / Hex / UTF-8 pour les frames binaires.",
  'panel.inspector.messages.columnInfo.data.insteadHeading': 'À la place de la charge utile',
  'panel.inspector.messages.columnInfo.data.binaryDesc':
    'Un frame binaire — les octets vivent dans la visionneuse de charge utile, pas dans la cellule.',
  'panel.inspector.messages.columnInfo.data.pingPongDesc': 'Frames de contrôle keepalive échangés par les extrémités.',
  'panel.inspector.messages.columnInfo.data.closeDesc': 'La poignée de main de fermeture qui termine le socket.',
  'panel.inspector.messages.columnInfo.length.summary':
    'La taille de la charge utile — un simple compte de caractères pour les frames texte, des octets ' +
    'formatés (p. ex. `4 B`) pour les frames binaires.',
  'panel.inspector.messages.columnInfo.time.summary': "L'instant horloge où le frame a traversé le réseau.",
  'panel.inspector.messages.columnInfo.time.description':
    "La seule colonne triable. Croissant est l'ordre du réseau ; les frames de la même milliseconde gardent " +
    "leur ordre d'arrivée dans les deux sens.",
  'panel.inspector.messages.directionInfo.title': 'Direction',
  'panel.inspector.messages.directionInfo.summary': 'Dans quel sens le frame a voyagé.',
  'panel.inspector.messages.directionInfo.arrowsHeading': 'Flèches',
  'panel.inspector.messages.directionInfo.sentDesc': 'Envoyé — la page a poussé ce frame vers le serveur.',
  'panel.inspector.messages.directionInfo.receivedDesc': 'Reçu — le serveur a poussé ce frame vers la page.',
  'panel.inspector.messages.directionInfo.errorDesc':
    'Erreur — une défaillance de transport a terminé le flux ; la ligne se lit en rouge.',
  'panel.inspector.streams.fireRail.title': 'Déclenchements de règles',
  'panel.inspector.streams.fireRail.dotColorsHeading': 'Couleurs des points',
  'panel.inspector.messages.fireRail.summary':
    'Un point marque chaque frame sur lequel une règle de message WebSocket a agi. Les frames ne portent ' +
    'aucune attribution de règle, le point est donc dérivé : les règles de message déclenchées de cette ' +
    'requête, chaque sélecteur de frames rejoué contre le frame.',
  'panel.inspector.messages.fireRail.appliedDesc':
    'Appliqué — la charge utile du frame égale la charge de remplacement ou injectée de la règle.',
  'panel.inspector.messages.fireRail.inferredDesc':
    "Inféré — la direction et le filtre de message de la règle sélectionnent ce frame, mais l'application " +
    "n'est pas vérifiable (un frame modifié ne porte plus la charge utile que le filtre a sélectionnée).",
  'panel.inspector.messages.fireRail.description':
    "Un frame sortant abandonné ne traverse jamais le réseau, il n'a donc aucune ligne. Un frame entrant " +
    "abandonné a d'abord été capturé sur le réseau — sa ligne reste, marquée « Abandonné — jamais délivré à " +
    'la page ».',
  'panel.inspector.sse.columnInfo.exampleCaption': "Exemple d'événement",
  'panel.inspector.sse.columnInfo.id.summary':
    "Le champ `id:` de l'événement — le curseur de reconnexion distribué par le serveur.",
  'panel.inspector.sse.columnInfo.id.description':
    "Vide quand le serveur n'envoie pas d'id. À la reconnexion, le navigateur renvoie le dernier id dans " +
    '`Last-Event-ID`, pour que le serveur reprenne le flux là où il en était.',
  'panel.inspector.sse.columnInfo.type.summary':
    "Le champ `event:` de l'événement — `message` pour les événements par défaut.",
  'panel.inspector.sse.columnInfo.type.description':
    "Le code de page s'abonne par type : `onmessage` ne voit que les événements par défaut ; les événements " +
    'nommés exigent un `addEventListener` pour ce type exact.',
  'panel.inspector.sse.columnInfo.data.summary':
    "La charge utile de l'événement — toujours du texte ; les champs `data:` multilignes arrivent joints.",
  'panel.inspector.sse.columnInfo.data.description':
    'Sélectionnez une ligne pour ouvrir la visionneuse de charge utile : un arbre JSON quand le texte ' +
    "s'analyse, tel quel sinon.",
  'panel.inspector.sse.columnInfo.time.summary': "L'instant horloge où l'événement est arrivé.",
  'panel.inspector.sse.columnInfo.time.description':
    "Triable, croissant par défaut. Les événements extraits d'un corps de réponse terminé ne portent pas " +
    "d'heure — le format SSE n'en a pas — leurs cellules restent donc vides.",
  'panel.inspector.sse.fireRail.summary':
    'Un point marque chaque événement sur lequel une règle de message SSE a agi. Une capture enregistrée par ' +
    'le wrapper fait preuve ; sans elle, le point est dérivé : les règles SSE déclenchées de cette requête, ' +
    "chaque sélecteur d'événements rejoué contre l'événement.",
  'panel.inspector.sse.fireRail.appliedDesc':
    'Appliqué — le wrapper a enregistré son action sur cet événement précis, ou une charge injectée ' + 'correspond.',
  'panel.inspector.sse.fireRail.inferredDesc':
    "Inféré — le nom d'événement et le filtre de données de la règle sélectionnent cet événement, mais " +
    "l'application n'est pas vérifiable depuis le réseau seul.",
  'panel.inspector.sse.fireRail.description':
    'Les événements server-sent ne voyagent que serveur → page, et le réseau les enregistre avant que la ' +
    'règle agisse : un événement abandonné garde sa ligne, marquée « Abandonné — jamais délivré à la page » ; ' +
    "un événement injecté ne traverse jamais le réseau et s'affiche comme une ligne synthétique.",
} as const satisfies Catalog;
