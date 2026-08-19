/**
 * DevTools panel — docs navigation + the Filter Syntax docs body —
 * Spanish. Mirrors `catalogs/en/panel-docs.ts` key for key. Filter
 * grammar tokens, chord chips, and the FilterExample device ride raw
 * under the S18 diagram boundary; quoted example terms ride raw
 * inside keyed captions («api», «Users»); tool-window and detail tab
 * names (Network, Console, Storage, Headers, …) stay raw. Mints:
 * filter-grammar token rides raw (m., distinct from the auth token
 * loanword); match toggles = `conmutadores`; the keyed Enter renders
 * as the es `Intro`.
 */

import type { Catalog } from '../../types';

export const panelDocs = {
  // ── Docs tool-window navigation ─────────────────────────────────────
  'panel.docs.nav.group.panel': 'Panel',
  'panel.docs.nav.filterSyntax.title': 'Sintaxis de los filtros',
  'panel.docs.nav.filterSyntax.summary':
    'Tokens de texto, filtros de propiedad y los conmutadores de coincidencia — cada tarjeta filtra una misma ' +
    'captura de ejemplo compartida.',

  // ── Docs tool window: Filter Syntax section body ─────────────────────
  'panel.docs.filterSyntax.intro1Prefix': 'El filtro de tráfico combina texto libre,',
  'panel.docs.filterSyntax.intro1Suffix':
    'filtros de propiedad y tres conmutadores de coincidencia. Los términos separados por espacios deben ' +
    'coincidir TODOS (AND), y cada tarjeta de abajo aplica su filtro sobre la misma captura de ejemplo de ' +
    'cinco solicitudes — cada diagrama es una porción de esa imagen.',
  'panel.docs.filterSyntax.intro2Prefix':
    'Cada campo de filtro del panel — Network, Console, Storage, Headers, Cookies, Initiator, Messages — ' +
    'lleva los mismos tres conmutadores',
  'panel.docs.filterSyntax.intro2MatchCase': 'coincidir mayúsculas y minúsculas',
  'panel.docs.filterSyntax.intro2WholeWord': 'palabra completa',
  'panel.docs.filterSyntax.intro2Regex': 'regex',
  'panel.docs.filterSyntax.intro2Middle': 'y un',
  'panel.docs.filterSyntax.intro2Suffix': 'botón que borra el texto.',
  'panel.docs.filterSyntax.intro2Kbd': 'Teclado:',
  'panel.docs.filterSyntax.intro2KbdSuffix': 'cambian los conmutadores mientras el campo tiene el foco.',

  'panel.docs.filterSyntax.headingText': 'Filtros de texto',
  'panel.docs.filterExample.captureHeading': 'La captura de ejemplo',
  'panel.docs.filterSyntax.headingProperty': 'Filtros de propiedad',
  'panel.docs.filterSyntax.headingToggles': 'Conmutadores de coincidencia',
  'panel.docs.filterSyntax.headingElsewhere': 'En cualquier otra parte',

  'panel.docs.filterSyntax.textTitle': 'Texto',
  'panel.docs.filterSyntax.text1':
    'Un término suelto conserva cada solicitud cuya URL lo contiene. Varios términos se combinan en AND — una ' +
    'solicitud debe contenerlos todos, en cualquier posición.',
  'panel.docs.filterSyntax.textCaption':
    'Dos términos — solo sobrevive la solicitud cuya URL contiene tanto «api» como «users».',

  'panel.docs.filterSyntax.negationTitle': 'Negación',
  'panel.docs.filterSyntax.negation1Prefix': 'Un',
  'panel.docs.filterSyntax.negation1Middle': 'inicial invierte cualquier token:',
  'panel.docs.filterSyntax.negation1Middle2':
    'oculta las solicitudes coincidentes en lugar de conservarlas. Funciona también con los filtros de ' +
    'propiedad —',
  'panel.docs.filterSyntax.negationCaption':
    'Todo permanece EXCEPTO las solicitudes que coinciden con el término negado.',

  'panel.docs.filterSyntax.phraseTitle': 'Frase exacta',
  'panel.docs.filterSyntax.phrase1Prefix':
    'Las comillas hacen un solo token de un texto que contiene espacios, y mantienen literales caracteres como',
  'panel.docs.filterSyntax.phrase1Or': 'o',
  'panel.docs.filterSyntax.phrase1Suffix': '— útil para las cadenas de consulta.',
  'panel.docs.filterSyntax.phraseCaption':
    'La frase entre comillas coincide como un solo fragmento contiguo de la URL.',

  'panel.docs.filterSyntax.propertyIntroPrefix': 'A',
  'panel.docs.filterSyntax.propertyIntroSuffix':
    '— un token así comprueba un atributo de la solicitud en lugar de la URL completa. Los filtros de ' +
    'propiedad se combinan con los tokens de texto y entre sí — todos deben coincidir.',

  'panel.docs.filterSyntax.domainTitle': 'Dominio',
  'panel.docs.filterSyntax.domain1Prefix':
    'Coincide con el nombre de host por subcadena, de modo que un dominio raíz atrapa todos los subdominios —',
  'panel.docs.filterSyntax.domain1Suffix': '— sin comodines.',
  'panel.docs.filterSyntax.domainCaption':
    'Un solo valor cubre todos los subdominios de openheaders.com; el host de terceros falla.',

  'panel.docs.filterSyntax.statusCodeTitle': 'Código de estado',
  'panel.docs.filterSyntax.statusCode1':
    'Conserva las solicitudes cuya respuesta llevó exactamente este código. Las solicitudes pendientes y ' +
    'fallidas no tienen código, así que nunca coinciden.',
  'panel.docs.filterSyntax.statusCodeCaption': 'Solo sobrevive la 404 — el código exacto, no un rango.',

  'panel.docs.filterSyntax.methodTitle': 'Método',
  'panel.docs.filterSyntax.method1Prefix':
    'Conserva las solicitudes que usan este verbo HTTP, comparado sin distinguir mayúsculas y minúsculas —',
  'panel.docs.filterSyntax.method1And': 'y',
  'panel.docs.filterSyntax.method1Suffix': 'son el mismo filtro.',
  'panel.docs.filterSyntax.methodCaption': 'Solo sobrevive el POST.',

  'panel.docs.filterSyntax.mimeTypeTitle': 'Tipo MIME',
  'panel.docs.filterSyntax.mime1Prefix': 'Coincide con el tipo de contenido de la respuesta por subcadena —',
  'panel.docs.filterSyntax.mime1Catches': 'atrapa',
  'panel.docs.filterSyntax.mime1Suffix': 'atrapa todos los formatos de imagen.',
  'panel.docs.filterSyntax.mimeCaption':
    'Las dos respuestas JSON sobreviven; los scripts, las fuentes y las imágenes fallan.',

  'panel.docs.filterSyntax.responseHeaderTitle': 'Encabezado de respuesta',
  'panel.docs.filterSyntax.respHeader1Prefix':
    'Conserva las solicitudes cuya respuesta lleva un encabezado con este nombre exacto — el valor no ' +
    'importa. Práctico para detectar el comportamiento de caché de un CDN',
  'panel.docs.filterSyntax.respHeader1Suffix': 'o los encabezados de seguridad ausentes (niégalo).',
  'panel.docs.filterSyntax.respHeaderCaption': 'Solo la respuesta del CDN lleva un encabezado x-cache.',

  'panel.docs.filterSyntax.largerThanTitle': 'Mayor que',
  'panel.docs.filterSyntax.largerThan1':
    'Conserva las solicitudes que transfirieron más de N bytes. Los sufijos escalan el número:',
  'panel.docs.filterSyntax.largerThanCaption': 'Solo el bundle de 128 kB supera el umbral de 100k.',

  'panel.docs.filterSyntax.fromCacheTitle': 'Desde la caché',
  'panel.docs.filterSyntax.fromCache1Prefix': 'Conserva las respuestas que el navegador sirvió desde la caché — un',
  'panel.docs.filterSyntax.fromCache1Middle': ', o un acierto de caché de disco/memoria que nunca tocó la red. Niégalo',
  'panel.docs.filterSyntax.fromCache1Suffix': 'para ver solo lo que realmente cruzó la red.',
  'panel.docs.filterSyntax.fromCacheCaption': 'Solo sobrevive el píxel de rastreo en caché.',

  'panel.docs.filterSyntax.togglesIntroPrefix':
    'Los tres botones dentro del campo cambian cómo se comparan los tokens de texto. Se aplican al texto ' +
    'libre (y a los tokens de estilo',
  'panel.docs.filterSyntax.togglesIntroMiddle': 'en las pestañas de detalle);',
  'panel.docs.filterSyntax.togglesIntroSuffix': 'y los demás filtros de propiedad conservan su propia semántica.',

  'panel.docs.filterSyntax.matchCaseTitle': 'Coincidir mayúsculas y minúsculas',
  'panel.docs.filterSyntax.matchCase1Prefix': 'Desactivado (el valor predeterminado),',
  'panel.docs.filterSyntax.matchCase1And': 'y',
  'panel.docs.filterSyntax.matchCase1Suffix':
    'son el mismo filtro. Activado, el término debe coincidir con las mayúsculas y minúsculas exactas de la URL.',
  'panel.docs.filterSyntax.matchCaseCaption':
    'Con Aa activado, «Users» no coincide con nada — todas las URL de la captura están en minúsculas.',

  'panel.docs.filterSyntax.wholeWordTitle': 'Palabra completa',
  'panel.docs.filterSyntax.wholeWord1Prefix': 'El término solo coincide en los límites de palabra —',
  'panel.docs.filterSyntax.wholeWord1Suffix':
    'y compañía cuentan como límites. Úsalo cuando un término corto queda enterrado dentro de palabras más ' +
    'largas.',
  'panel.docs.filterSyntax.wholeWordCaption':
    '«user» ya no coincide dentro de «users» — con ab desactivado, la solicitud #7 coincidiría.',

  'panel.docs.filterSyntax.regexTitle': 'Regex',
  'panel.docs.filterSyntax.regex1':
    'Todo el campo se convierte en una sola expresión regular probada contra la URL — los tokens de propiedad ' +
    'no se analizan en este modo. Un patrón que no compila pone el campo en rojo y no oculta nada.',
  'panel.docs.filterSyntax.regexCaption': 'Un solo patrón, dos tipos de archivo: las URL que terminan en .js o .woff2.',

  'panel.docs.filterSyntax.otherInputsTitle': 'Otros campos de filtro',
  'panel.docs.filterSyntax.otherIntroPrefix':
    'Las pestañas de detalle llevan el mismo campo con sus propias claves de propiedad; los conmutadores y la ' +
    'negación con',
  'panel.docs.filterSyntax.otherIntroSuffix': 'funcionan igual en cada una:',
  'panel.docs.filterSyntax.otherPlainGroup': 'Console, Storage, Messages, Call Stack',
  'panel.docs.filterSyntax.otherPlainBody':
    'texto simple con los tres conmutadores; Storage además cuenta las coincidencias por sección en su riel ' +
    'de navegación mientras escribes.',
  'panel.docs.filterSyntax.otherSearchPrefix': 'texto simple (o una regex bajo',
  'panel.docs.filterSyntax.otherSearchMiddle': ') con los tres conmutadores, enviado con Intro. Los chips',
  'panel.docs.filterSyntax.otherSearchSuffix':
    'eligen qué datos explora — al menos uno queda seleccionado — y cada resultado abre su origen: la pestaña ' +
    'de la solicitud, la sección de almacenamiento o la Console.',
} as const satisfies Catalog;
