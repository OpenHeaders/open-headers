/**
 * Workbench editors — the GraphQL client editor — Romanian. Mirrors
 * `catalogs/en/workbench-editors-graphql.ts` key for key. Wire
 * vocabulary (GraphQL, the `{query, variables, operationName}`
 * envelope names, SDL, introspection, `Query` / `Subscription` tab
 * and pane nouns, `extensions`, `Docs`) rides raw inside keyed values.
 * schemă = schema; exploratorul de schemă = schema explorer; variabile
 * = variables; introspecție = introspection; abonament = subscription
 * (prose; the pane title stays the raw `Subscription`); document = the
 * GraphQL document (S19 separate referent beside Docs = the raw tab
 * noun); constructor = builder; fragment = GraphQL fragment
 * (context-partitioned from the merge-editor bloc = hunk — the GraphQL
 * term itself); Autorizare / Antete / Scripturi / Setări / Schemă =
 * the editor tab family (THE TAB-NOUN DECISION, S109; Docs / Query
 * stay raw); specificație = spec carried; operație = operation. Every
 * raw token takes a head noun (starea HTTP {status}, lista errors[],
 * valoarea data).
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsGraphql = {
  // ── GraphQL request editor ──────────────────────────────────────────
  'workbench.editors.graphql.notFound': 'Cererea GraphQL nu a fost găsită.',
  'workbench.editors.graphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.graphql.query.label': 'Query',
  'workbench.editors.graphql.query.stop': 'Oprire',
  'workbench.editors.graphql.query.stopTooltip': 'Oprește interogarea și păstrează ce a sosit',
  'workbench.editors.graphql.operation.placeholder': 'Operație',
  'workbench.editors.graphql.operation.tooltip':
    'Operația pe care o rulează acest Query — documentul conține mai multe; alegerea circulă în rețea ca operationName.',
  'workbench.editors.graphql.response.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} eroare', few: '{count} erori', other: '{count} de erori' }),
  'workbench.editors.graphql.response.errorsTitle': 'Erori GraphQL',
  'workbench.editors.graphql.response.errorsSummary':
    'Serverul a răspuns cu starea HTTP {status} și o listă errors[] — un câmp a eșuat, documentul a fost refuzat sau autentificarea lipsea. Citiți valoarea data de alături: parțială sau null.',
  'workbench.editors.graphql.response.dataNull':
    'Valoarea data este null — fiecare câmp rădăcină a propagat eroarea sau cererea a fost refuzată înainte de execuție.',
  'workbench.editors.graphql.response.extensions': 'extensions',
  'workbench.editors.graphql.response.extensionsTitle': 'Extensiile răspunsului',
  'workbench.editors.graphql.response.extensionsSummary':
    'Obiectul extensions al serverului circulă alături de data — urmărire, cost, indicii de cache, orice a ales să atașeze.',
  'workbench.editors.graphql.query.placeholder': 'query { viewer { id } }',
  'workbench.editors.graphql.tab.docs': 'Docs',
  'workbench.editors.graphql.tab.query': 'Query',
  'workbench.editors.graphql.tab.authorization': 'Autorizare',
  'workbench.editors.graphql.tab.headers': 'Antete',
  'workbench.editors.graphql.tab.schema': 'Schemă',
  'workbench.editors.graphql.tab.scripts': 'Scripturi',
  'workbench.editors.graphql.tab.settings': 'Setări',
  'workbench.editors.graphql.explorer.emptyTitle': 'Explorați datele disponibile de la server',
  'workbench.editors.graphql.explorer.emptyHint':
    'Introduceți adresa URL a serverului pentru a încărca schema prin introspecție.',
  'workbench.editors.graphql.explorer.introspect': 'Utilizare introspecție GraphQL',
  'workbench.editors.graphql.explorer.loadFailed': 'Schema GraphQL nu a putut fi încărcată.',
  'workbench.editors.graphql.explorer.tryAgain': 'Reîncercare',
  'workbench.editors.graphql.explorer.useSpec': 'Utilizare specificație GraphQL',
  'workbench.editors.graphql.explorer.importSchema': 'Import schemă GraphQL',
  'workbench.editors.graphql.variables.title': 'Variabile',
  'workbench.editors.graphql.variables.generate': 'Generare variabile',
  'workbench.editors.graphql.variables.generateHint':
    'Completează variabilele din definițiile de variabile ale operației selectate.',
  'workbench.editors.graphql.variables.generateNeedsOperation': 'Operația selectată nu declară nicio variabilă.',
  'workbench.editors.graphql.variables.placeholder': '{ "id": "1" }',
  'workbench.editors.graphql.headers.hint.contentType':
    'Fiecare operație GraphQL trimite prin POST plicul {query, variables, operationName} ca JSON. Adăugați propriul rând Content-Type pentru a suprascrie.',
  'workbench.editors.graphql.schema.sourceLabel': 'Sursa schemei',
  'workbench.editors.graphql.schema.sourcePlaceholder': 'Selectați o sursă de schemă',
  'workbench.editors.graphql.schema.or': 'SAU',
  'workbench.editors.graphql.schema.hint':
    'Schema alimentează exploratorul, completarea și validarea — obținută prin introspecție de la server, prin autentificarea și setările acestei cereri, legată dintr-o specificație GraphQL sau importată dintr-un fișier SDL ori de introspecție.',
  'workbench.editors.graphql.scripts.beforeQuery': 'Înainte de interogare',
  'workbench.editors.graphql.scripts.afterResponse': 'După răspuns',
  'workbench.editors.graphql.toast.deletedOtherTab': 'Această cerere GraphQL a fost ștearsă într-o altă filă.',
  'workbench.editors.graphql.toast.updateFailed': 'Salvarea cererii GraphQL a eșuat',
  'workbench.editors.graphql.toast.updateFailedDetail': 'Salvarea cererii GraphQL a eșuat: {message}',
  'workbench.editors.graphql.explorer.needsUrl': 'Introduceți mai întâi adresa URL a punctului final.',
  'workbench.editors.graphql.explorer.introspecting': 'Introspecție în curs…',
  'workbench.editors.graphql.explorer.search': 'Căutare tipuri și câmpuri',
  'workbench.editors.graphql.explorer.noResults': 'Nimic nu corespunde cu „{term}”.',
  'workbench.editors.graphql.explorer.back': 'Înapoi',
  'workbench.editors.graphql.explorer.fields': 'Câmpuri',
  'workbench.editors.graphql.explorer.arguments': 'Argumente',
  'workbench.editors.graphql.explorer.values': 'Valori',
  'workbench.editors.graphql.explorer.inputFields': 'Câmpuri de intrare',
  'workbench.editors.graphql.explorer.implements': 'Implementează',
  'workbench.editors.graphql.explorer.possibleTypes': 'Tipuri posibile',
  'workbench.editors.graphql.explorer.returns': 'Returnează',
  'workbench.editors.graphql.explorer.specifiedBy': 'Specificat de',
  'workbench.editors.graphql.explorer.deprecated': 'Învechit: {reason}',
  'workbench.editors.graphql.explorer.insert': 'Inserare la cursor',
  'workbench.editors.graphql.explorer.insertHint':
    'Adaugă câmpul în document la poziția cursorului — argumentele sale obligatorii ca variabile, un set de selecție gol când returnează un obiect. Într-un singur sens: documentul rămâne al dvs.',
  'workbench.editors.graphql.schema.source.introspection': 'Introspecție GraphQL',
  'workbench.editors.graphql.schema.source.spec': 'Specificație GraphQL legată',
  'workbench.editors.graphql.schema.refresh': 'Reîmprospătare',
  'workbench.editors.graphql.schema.fetchedAt': 'Introspecție efectuată {when}',
  'workbench.editors.graphql.schema.notIntrospected':
    'Introspecție neefectuată încă — schema se încarcă de la punctul final prin autentificarea, antetele și setările acestei cereri.',
  'workbench.editors.graphql.schema.introspectFailed': 'Introspecția a eșuat: {message}',
  'workbench.editors.graphql.schema.noSpecLinked': 'Nicio specificație GraphQL nu este legată.',
  'workbench.editors.graphql.schema.linkInSpecTab': 'Legați una în fila „Specificație”',
  'workbench.editors.graphql.schema.changeInSpecTab': 'Schimbați-o în fila „Specificație”',
  'workbench.editors.graphql.schema.specMissing': 'Specificația legată nu mai există în acest spațiu de lucru.',
  'workbench.editors.graphql.schema.summaryTypes': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} tip', few: '{count} tipuri', other: '{count} de tipuri' }),
  'workbench.editors.graphql.schema.problems': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} problemă de schemă',
      few: '{count} probleme de schemă',
      other: '{count} de probleme de schemă',
    }),
  'workbench.editors.graphql.schema.importReadFailed': 'Citirea fișierului a eșuat: {message}',
  'workbench.editors.graphql.schema.importFailed': 'Importul schemei a eșuat',
  'workbench.editors.graphql.schema.imported': '„{name}” a fost importat ca specificație GraphQL și legat.',
  'workbench.editors.graphql.spec.selectLabel': 'Specificație GraphQL',
  'workbench.editors.graphql.spec.selectPlaceholder': 'Legați o specificație GraphQL…',
  'workbench.editors.graphql.spec.none': 'Nicio specificație GraphQL nu este legată de această cerere.',
  'workbench.editors.graphql.spec.hint':
    'Specificația legată este sursa de schemă a acestei cereri — exploratorul, completarea și validarea o citesc. Într-o colecție generată dintr-o specificație, cererea citește legătura colecției până își leagă propria specificație.',
  'workbench.editors.graphql.explorer.title': 'Explorator de schemă',
  'workbench.editors.graphql.explorer.hide': 'Ascundere explorator',
  'workbench.editors.graphql.explorer.show': 'Afișare explorator',
  'workbench.editors.graphql.explorer.showDescriptions': 'Afișare descrieri',
  'workbench.editors.graphql.explorer.hideDescriptions': 'Ascundere descrieri',
  'workbench.editors.graphql.builder.broken': 'Corectați documentul pentru a folosi constructorul — nu se parsează.',
  'workbench.editors.graphql.builder.expand': 'Extindere',
  'workbench.editors.graphql.builder.collapse': 'Restrângere',
  'workbench.editors.graphql.builder.fragmentReadOnly':
    'Fragmentele sunt doar în citire aici — editați-le în document.',
  'workbench.editors.graphql.builder.argumentPlaceholder': 'valoare sau $variabilă',
  'workbench.editors.graphql.builder.invalidValue': 'Nu este o valoare GraphQL.',
  'workbench.editors.graphql.variables.problems': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} problemă', few: '{count} probleme', other: '{count} de probleme' }),
  // ── Subscriptions (graphql-transport-ws over the WebSocket plane) ──
  'workbench.editors.graphql.subscription.tooltip':
    'Abonare — deschide abonamentul prin WebSocket (graphql-transport-ws) și îi transmite evenimentele în flux',
  'workbench.editors.graphql.subscription.stopTooltip': 'Oprește abonamentul — trimite complete și închide sesiunea',
  'workbench.editors.graphql.subscription.openFailed': 'Deschiderea abonamentului a eșuat',
  'workbench.editors.graphql.subscription.paneTitle': 'Subscription',
  'workbench.editors.graphql.subscription.subscribing': 'Abonare în curs…',
  'workbench.editors.graphql.subscription.subscribed': 'Abonat',
  'workbench.editors.graphql.subscription.completed': 'Finalizat',
  'workbench.editors.graphql.subscription.stopped': 'Oprit',
  'workbench.editors.graphql.subscription.errored': 'Eroare',
  'workbench.editors.graphql.subscription.closed': 'Închis {code}',
  'workbench.editors.graphql.subscription.events': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} eveniment',
      few: '{count} evenimente',
      other: '{count} de evenimente',
    }),
  'workbench.editors.graphql.subscription.errorsSummary':
    'Abonamentul a răspuns cu o listă errors[] — un câmp a eșuat într-un eveniment sau operația a fost refuzată înainte de a începe.',
  'workbench.editors.graphql.subscription.close.badRequest': 'Cerere incorectă',
  'workbench.editors.graphql.subscription.close.unauthorized': 'Neautorizat',
  'workbench.editors.graphql.subscription.close.forbidden': 'Interzis',
  'workbench.editors.graphql.subscription.close.subprotocolNotAcceptable': 'Subprotocol neacceptabil',
  'workbench.editors.graphql.subscription.close.connectionInitTimeout':
    'Timp de așteptare expirat la inițializarea conexiunii',
  'workbench.editors.graphql.subscription.close.subscriberAlreadyExists': 'Abonatul există deja',
  'workbench.editors.graphql.subscription.close.tooManyInitRequests': 'Prea multe cereri de inițializare',
} as const satisfies Catalog;
