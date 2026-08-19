/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * French. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw
 * inside keyed captions (« api », « Users »); tool-window and detail
 * tab names (Network, Console, Storage, Headers, …) stay raw.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panneau',
  'panel.docs.nav.filterSyntax.title': 'Syntaxe des filtres',
  'panel.docs.nav.filterSyntax.summary':
    'Jetons de texte, filtres de propriété et bascules de correspondance — chaque carte filtre une même ' +
    "capture d'exemple partagée.",

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  'panel.docs.filterSyntax.intro1Prefix': 'Le filtre de trafic combine du texte libre,',
  'panel.docs.filterSyntax.intro1Suffix':
    'des filtres de propriété et trois bascules de correspondance. Les termes séparés par des espaces ' +
    'doivent TOUS correspondre (AND), et chaque carte ci-dessous applique son filtre à la même capture ' +
    "d'exemple de cinq requêtes — chaque diagramme est une tranche de cette image.",
  'panel.docs.filterSyntax.intro2Prefix':
    'Chaque champ de filtre du panneau — Network, Console, Storage, Headers, Cookies, Initiator, Messages — ' +
    'porte les trois mêmes bascules',
  'panel.docs.filterSyntax.intro2MatchCase': 'respecter la casse',
  'panel.docs.filterSyntax.intro2WholeWord': 'mot entier',
  'panel.docs.filterSyntax.intro2Regex': 'regex',
  'panel.docs.filterSyntax.intro2Middle': 'et un',
  'panel.docs.filterSyntax.intro2Suffix': 'bouton qui efface le texte.',
  'panel.docs.filterSyntax.intro2Kbd': 'Clavier :',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'actionnent les bascules quand le champ a le focus.',

  'panel.docs.filterSyntax.headingText': 'Filtres de texte',
  'panel.docs.filterExample.captureHeading': "La capture d'exemple",
  'panel.docs.filterSyntax.headingProperty': 'Filtres de propriété',
  'panel.docs.filterSyntax.headingToggles': 'Bascules de correspondance',
  'panel.docs.filterSyntax.headingElsewhere': 'Partout ailleurs',

  'panel.docs.filterSyntax.textTitle': 'Texte',
  'panel.docs.filterSyntax.text1':
    "Un terme nu conserve chaque requête dont l'URL le contient. Plusieurs termes se combinent en AND — une " +
    "requête doit tous les contenir, à n'importe quelle position.",
  'panel.docs.filterSyntax.textCaption':
    "Deux termes — seule la requête dont l'URL contient à la fois « api » et « users » survit.",

  'panel.docs.filterSyntax.negationTitle': 'Négation',
  'panel.docs.filterSyntax.negation1Prefix': 'Un',
  'panel.docs.filterSyntax.negation1Middle': "en tête inverse n'importe quel jeton :",
  'panel.docs.filterSyntax.negation1Middle2':
    'masque les requêtes correspondantes au lieu de les conserver. Fonctionne aussi sur les filtres de ' +
    'propriété —',
  'panel.docs.filterSyntax.negationCaption': 'Tout reste SAUF les requêtes correspondant au terme nié.',

  'panel.docs.filterSyntax.phraseTitle': 'Phrase exacte',
  'panel.docs.filterSyntax.phrase1Prefix':
    "Les guillemets font un seul jeton d'un texte qui contient des espaces, et gardent littéraux des " +
    'caractères comme',
  'panel.docs.filterSyntax.phrase1Or': 'ou',
  'panel.docs.filterSyntax.phrase1Suffix': '— utile pour les chaînes de requête.',
  'panel.docs.filterSyntax.phraseCaption':
    "La phrase entre guillemets correspond comme un seul morceau contigu de l'URL.",

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    "— un tel jeton vérifie un attribut de la requête au lieu de l'URL entière. Les filtres de propriété se " +
    'composent avec les jetons de texte et entre eux — tous doivent correspondre.',

  'panel.docs.filterSyntax.domainTitle': 'Domaine',
  'panel.docs.filterSyntax.domain1Prefix':
    "Correspond au nom d'hôte par sous-chaîne, si bien qu'un domaine apex attrape chaque sous-domaine —",
  'panel.docs.filterSyntax.domain1Suffix': '— sans jokers.',
  'panel.docs.filterSyntax.domainCaption':
    "Une seule valeur couvre chaque sous-domaine de openheaders.com ; l'hôte tiers échoue.",

  'panel.docs.filterSyntax.statusCodeTitle': 'Code de statut',
  'panel.docs.filterSyntax.statusCode1':
    'Conserve les requêtes dont la réponse portait exactement ce code. Les requêtes en attente et échouées ' +
    "n'ont pas de code, donc elles ne correspondent jamais.",
  'panel.docs.filterSyntax.statusCodeCaption': 'Seule la 404 survit — le code exact, pas une plage.',

  'panel.docs.filterSyntax.methodTitle': 'Méthode',
  'panel.docs.filterSyntax.method1Prefix':
    'Conserve les requêtes utilisant ce verbe HTTP, comparé sans tenir compte de la casse —',
  'panel.docs.filterSyntax.method1And': 'et',
  'panel.docs.filterSyntax.method1Suffix': 'sont le même filtre.',
  'panel.docs.filterSyntax.methodCaption': 'Seul le POST survit.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'Type MIME',
  'panel.docs.filterSyntax.mime1Prefix': 'Correspond au type de contenu de la réponse par sous-chaîne —',
  'panel.docs.filterSyntax.mime1Catches': 'attrape',
  'panel.docs.filterSyntax.mime1Suffix': "attrape chaque format d'image.",
  'panel.docs.filterSyntax.mimeCaption': 'Les deux réponses JSON survivent ; scripts, polices et images échouent.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'En-tête de réponse',
  'panel.docs.filterSyntax.respHeader1Prefix':
    "Conserve les requêtes dont la réponse porte un en-tête avec ce nom exact — la valeur n'importe pas. " +
    "Pratique pour repérer le comportement de cache d'un CDN",
  'panel.docs.filterSyntax.respHeader1Suffix': 'ou les en-têtes de sécurité manquants (niez-le).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Seule la réponse du CDN porte un en-tête x-cache.',

  'panel.docs.filterSyntax.largerThanTitle': 'Plus grand que',
  'panel.docs.filterSyntax.largerThan1':
    "Conserve les requêtes qui ont transféré plus de N octets. Les suffixes mettent le nombre à l'échelle :",
  'panel.docs.filterSyntax.largerThanCaption': 'Seul le bundle de 128 kB franchit le seuil de 100k.',

  'panel.docs.filterSyntax.fromCacheTitle': 'Depuis le cache',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Conserve les réponses que le navigateur a servies depuis le cache — un',
  'panel.docs.filterSyntax.fromCache1Middle':
    ", ou un hit de cache disque/mémoire qui n'a jamais touché le réseau. Niez-le",
  'panel.docs.filterSyntax.fromCache1Suffix': 'pour ne voir que ce qui a réellement traversé le réseau.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Seul le pixel de suivi en cache survit.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'Les trois boutons dans le champ changent la façon dont les jetons de texte se comparent. Ils ' +
    "s'appliquent au texte libre (et aux jetons du style",
  'panel.docs.filterSyntax.togglesIntroMiddle': 'sur les onglets de détail) ;',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'et les autres filtres de propriété gardent leur propre sémantique.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Respecter la casse',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Désactivé (par défaut),',
  'panel.docs.filterSyntax.matchCase1And': 'et',
  'panel.docs.filterSyntax.matchCase1Suffix':
    "sont le même filtre. Activé, le terme doit correspondre à la casse exacte de l'URL.",
  'panel.docs.filterSyntax.matchCaseCaption':
    'Avec Aa activé, « Users » ne correspond à rien — chaque URL de la capture est en minuscules.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Mot entier',
  'panel.docs.filterSyntax.wholeWord1Prefix': "Le terme ne correspond qu'aux frontières de mots —",
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'et compagnie comptent comme frontières. Utilisez-le quand un terme court est enfoui dans des mots plus ' +
    'longs.',
  'panel.docs.filterSyntax.wholeWordCaption':
    "« user » ne correspond plus à l'intérieur de « users » — avec ab désactivé, la requête #7 correspondrait.",

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    "Le champ entier devient une seule expression régulière testée contre l'URL — les jetons de propriété ne " +
    'sont pas analysés dans ce mode. Un motif qui ne compile pas met le champ en rouge et ne masque rien.',
  'panel.docs.filterSyntax.regexCaption':
    'Un seul motif, deux types de fichiers : les URL se terminant par .js ou .woff2.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Autres champs de filtre',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'Les onglets de détail portent le même champ avec leurs propres clés de propriété ; les bascules et la ' +
    'négation par',
  'panel.docs.filterSyntax.otherIntroSuffix': "fonctionnent à l'identique dans chacun :",
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'texte brut avec les trois bascules ; Storage compte aussi les correspondances par section sur son rail ' +
    'de navigation pendant la saisie.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'texte brut (ou une regex sous',
  'panel.docs.filterSyntax.otherSearchMiddle': ') avec les trois bascules, soumis avec Enter. Les puces',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'choisissent quelles données il parcourt — au moins une reste sélectionnée — et chaque résultat ouvre sa ' +
    "source : l'onglet de requête, la section de stockage ou la Console.",
} as const satisfies Catalog;
