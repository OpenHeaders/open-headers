/**
 * Workbench editors — the API spec editor — Romanian. Mirrors
 * `catalogs/en/workbench-editors-spec.ts` key for key. Outline group
 * labels mirror the document's own keywords (`paths:`, `components:`,
 * `schemas:`, AsyncAPI `channels:`/`operations:`, proto `package` /
 * `import` / `service` / `message` / `enum`) and ride raw; `Files` is
 * app grouping and translates (Fișiere). The AsyncAPI Send/Receive
 * badges mirror the document's `action` enum and stay raw — a
 * different referent from the Send button mint Trimitere. `ROOT` badge
 * raw; `baseUrl` verbatim as a bare variable name (never compounded).
 * Field chips translate per the de/es parity lock (nume / descriere /
 * antete / parametri / corp) with `auth` riding raw as the code-ish
 * field id. specificație = spec; colecție = collection; Prezentare
 * generală = the Overview pane title (the outline). MINTS: streaming
 * modes Unar / Streaming pe server / Streaming pe client / Streaming
 * bidirecțional (streaming raw as the protocol loanword) —
 * editors-grpc ro reuses; fișier Root = Root file (Root raw);
 * Sincronizat = in sync; deviere = the drift (the specification
 * changed since the last update) / diferențe = the differences.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': 'Specificația nu a fost găsită.',
  'workbench.editors.spec.deletedElsewhere': 'Această specificație a fost ștearsă într-o altă sesiune.',
  'workbench.editors.spec.saveFailed': 'Specificația nu a putut fi salvată.',
  'workbench.editors.spec.validation.clean': 'Nicio problemă găsită',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} eroare', few: '{count} erori', other: '{count} de erori' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} avertisment',
      few: '{count} avertismente',
      other: '{count} de avertismente',
    }),
  'workbench.editors.spec.outline.title': 'Prezentare generală',
  'workbench.editors.spec.outline.show': 'Afișare prezentare generală',
  'workbench.editors.spec.outline.hide': 'Ascundere prezentare generală',
  'workbench.editors.spec.outline.empty': 'Schița apare odată ce documentul se parsează.',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': 'Marcare ca fișier Root',
  'workbench.editors.spec.outline.fileMenuAria': 'Acțiuni pentru fișier',
  'workbench.editors.spec.outline.groups.servers': 'Servers',
  'workbench.editors.spec.outline.groups.tags': 'Tags',
  'workbench.editors.spec.outline.groups.paths': 'Paths',
  'workbench.editors.spec.outline.groups.components': 'Components',
  'workbench.editors.spec.outline.groups.schemas': 'Schemas',
  'workbench.editors.spec.outline.groups.securitySchemes': 'Security Schemes',
  'workbench.editors.spec.outline.groups.security': 'Security',
  'workbench.editors.spec.outline.groups.package': 'Package',
  'workbench.editors.spec.outline.groups.imports': 'Imports',
  'workbench.editors.spec.outline.groups.services': 'Services',
  'workbench.editors.spec.outline.groups.messages': 'Messages',
  'workbench.editors.spec.outline.groups.enums': 'Enums',
  'workbench.editors.spec.outline.groups.channels': 'Channels',
  'workbench.editors.spec.outline.groups.operations': 'Operations',
  'workbench.editors.spec.outline.groups.query': 'Query',
  'workbench.editors.spec.outline.groups.mutation': 'Mutation',
  'workbench.editors.spec.outline.groups.subscription': 'Subscription',
  'workbench.editors.spec.outline.groups.types': 'Types',
  'workbench.editors.spec.outline.groups.interfaces': 'Interfaces',
  'workbench.editors.spec.outline.groups.unions': 'Unions',
  'workbench.editors.spec.outline.groups.inputs': 'Inputs',
  'workbench.editors.spec.outline.groups.scalars': 'Scalars',
  'workbench.editors.spec.outline.groups.directives': 'Directives',
  'workbench.editors.spec.outline.groups.files': 'Fișiere',
  'workbench.editors.spec.outline.streaming.unary': 'Unar',
  'workbench.editors.spec.outline.streaming.server': 'Streaming pe server',
  'workbench.editors.spec.outline.streaming.client': 'Streaming pe client',
  'workbench.editors.spec.outline.streaming.bidi': 'Streaming bidirecțional',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'Adăugare server',
  'workbench.editors.spec.outline.add.tag': 'Adăugare etichetă',
  'workbench.editors.spec.outline.add.path': 'Adăugare cale',
  'workbench.editors.spec.outline.add.operation': 'Adăugare operație',
  'workbench.editors.spec.outline.add.schema': 'Adăugare schemă',
  'workbench.editors.spec.outline.add.securityScheme': 'Adăugare schemă de securitate',
  'workbench.editors.spec.outline.add.securityRequirement': 'Adăugare cerință de securitate',
  'workbench.editors.spec.generate.button': 'Generare colecție',
  'workbench.editors.spec.generate.collectionsButton': 'Colecții',
  'workbench.editors.spec.generate.popoverTitle': 'Colecții generate',
  'workbench.editors.spec.generate.modalTitle': 'GENERARE COLECȚIE',
  'workbench.editors.spec.generate.blurb':
    'Generați o colecție din această specificație. Operațiile devin cereri sub o variabilă de colecție baseUrl, etichetele devin foldere, iar schemele de securitate se mapează la autentificare. Colecția rămâne legată de această specificație.',
  'workbench.editors.spec.generate.namePlaceholder': 'Nume colecție',
  'workbench.editors.spec.generate.nameRequired': 'Colecția are nevoie de un nume',
  'workbench.editors.spec.generate.dirtyHint':
    'Modificările nesalvate din editor nu sunt incluse — generarea folosește ultimul document salvat.',
  'workbench.editors.spec.generate.parseFailed': 'Această specificație nu se parsează',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cerere', few: '{count} cereri', other: '{count} de cereri' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} folder', few: '{count} foldere', other: '{count} de foldere' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variabilă de colecție',
      few: '{count} variabile de colecție',
      other: '{count} de variabile de colecție',
    }),
  'workbench.editors.spec.generate.action': 'Generare',
  'workbench.editors.spec.generate.success': '„{name}” a fost generată — {summary}',
  'workbench.editors.spec.generate.failed': 'Colecția nu a putut fi creată.',
  'workbench.editors.spec.generate.linkFailed':
    'Colecția a fost generată, dar înregistrarea legăturii cu specificația a eșuat — nu va apărea în această listă.',
  'workbench.editors.spec.generateProto.blurb':
    'Generați o colecție din această specificație. Metodele serviciilor devin cereri gRPC cu mesajele lor exemplu precompletate, grupate într-un folder per serviciu. Colecția rămâne legată de această specificație.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere gRPC',
      few: '{count} cereri gRPC',
      other: '{count} de cereri gRPC',
    }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} serviciu', few: '{count} servicii', other: '{count} de servicii' }),
  'workbench.editors.spec.generateProto.empty':
    'Documentul nu declară nicio metodă de serviciu din care să se genereze.',
  'workbench.editors.spec.generateProto.partial': 'Generată cu lacune — create: {created}, eșuate: {failed}.',
  'workbench.editors.spec.generateWs.blurb':
    'Generați o colecție din această specificație. Operațiile devin cereri WebSocket care țintesc serverul ws/wss al documentului sau cereri MQTT care țintesc serverul său mqtt, cu un mesaj exemplu precompletat din schema canalului. Colecția rămâne legată de această specificație.',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere WebSocket',
      few: '{count} cereri WebSocket',
      other: '{count} de cereri WebSocket',
    }),
  'workbench.editors.spec.generateWs.mqttRequestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere MQTT',
      few: '{count} cereri MQTT',
      other: '{count} de cereri MQTT',
    }),
  'workbench.editors.spec.generateWs.empty': 'Documentul nu declară nicio operație din care să se genereze.',
  'workbench.editors.spec.generateWs.noServer':
    'Documentul nu declară niciun server ws, wss sau mqtt la care să se conecteze.',
  'workbench.editors.spec.generateWs.partial': 'Generată cu lacune — create: {created}, eșuate: {failed}.',
  'workbench.editors.spec.generateWs.skipped': 'Omisă {operation}: {reason}.',
  'workbench.editors.spec.generateGraphql.blurb':
    'Generați o colecție din această schemă. Câmpurile rădăcină Query și Mutation devin cereri GraphQL cu documentul și variabilele exemplu precompletate, grupate într-un folder per tip rădăcină când există ambele; câmpurile de abonament sunt lăsate deoparte. Colecția rămâne legată de această specificație.',
  'workbench.editors.spec.generateGraphql.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} cerere GraphQL',
      few: '{count} cereri GraphQL',
      other: '{count} de cereri GraphQL',
    }),
  'workbench.editors.spec.generateGraphql.empty':
    'Schema nu declară niciun câmp Query sau Mutation din care să se genereze.',
  'workbench.editors.spec.generateGraphql.partial': 'Generată cu lacune — create: {created}, eșuate: {failed}.',
  'workbench.editors.spec.generateGraphql.urlPlaceholder': 'https://api.openheaders.com/graphql',
  'workbench.editors.spec.generateGraphql.urlHint':
    'Fiecare cerere generată țintește acest punct final; lăsați-l gol pentru a completa adresa URL mai târziu.',
  'workbench.editors.spec.generateGraphql.subscriptionsSkipped': ({ count, fields }, locale) =>
    `${plural(locale, Number(count), {
      one: '{count} câmp de abonament lăsat deoparte',
      few: '{count} câmpuri de abonament lăsate deoparte',
      other: '{count} de câmpuri de abonament lăsate deoparte',
    })} (${fields}) — abonamentele nu sunt acceptate.`,
  'workbench.editors.spec.generateGraphql.problem': 'Problemă de schemă: {message}',
  'workbench.editors.spec.update.button': 'Actualizare',
  'workbench.editors.spec.update.protoUnavailable':
    'Actualizarea dintr-o specificație Protobuf nu este încă disponibilă — generați o colecție nouă pentru a prelua modificările.',
  'workbench.editors.spec.update.graphqlUnavailable':
    'Actualizarea dintr-o schemă GraphQL nu este încă disponibilă — generați o colecție nouă pentru a prelua modificările.',
  'workbench.editors.spec.update.inSyncBadge': 'Sincronizat cu documentul salvat',
  'workbench.editors.spec.update.driftedBadge': 'Specificația s-a schimbat de la ultima actualizare',
  'workbench.editors.spec.update.modalTitle': 'ACTUALIZARE COLECȚIE',
  'workbench.editors.spec.update.blurb':
    'Revizuiți diferențele dintre documentul salvat și „{name}”, apoi aplicați actualizările selectate. Rândurile nebifate rămân neatinse.',
  'workbench.editors.spec.update.dirtyHint':
    'Modificările nesalvate din editor nu sunt incluse — actualizarea folosește ultimul document salvat.',
  'workbench.editors.spec.update.parseFailed': 'Această specificație nu se parsează',
  'workbench.editors.spec.update.inSync':
    'Nicio diferență la nivel de cerere — aplicarea marchează colecția ca sincronizată cu documentul salvat.',
  'workbench.editors.spec.update.groupAdded': 'Adăugate ({count})',
  'workbench.editors.spec.update.groupChanged': 'Modificate ({count})',
  'workbench.editors.spec.update.groupRemoved': 'Eliminate din specificație ({count})',
  'workbench.editors.spec.update.removeHint': 'Cererile nebifate rămân în colecție.',
  'workbench.editors.spec.update.groupCollection': 'Colecție',
  'workbench.editors.spec.update.variablesRow': 'Variabile de colecție',
  'workbench.editors.spec.update.authRow': 'Autentificarea colecției',
  'workbench.editors.spec.update.field.name': 'nume',
  'workbench.editors.spec.update.field.description': 'descriere',
  'workbench.editors.spec.update.field.headers': 'antete',
  'workbench.editors.spec.update.field.params': 'parametri',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'corp',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Aplicare {count} actualizare',
      few: 'Aplicare {count} actualizări',
      other: 'Aplicare {count} de actualizări',
    }),
  'workbench.editors.spec.update.markInSync': 'Marcare ca sincronizat',
  'workbench.editors.spec.update.hashNote':
    'Aplicarea înregistrează această versiune a documentului pe legătura colecției, astfel încât legătura apare sincronizată chiar dacă unele rânduri au rămas nebifate.',
  'workbench.editors.spec.update.success': '„{name}” a fost actualizată — aplicate: {count}',
  'workbench.editors.spec.update.partial':
    'Aplicate: {applied}, eșuate: {failed} — colecția poate fi parțial actualizată.',
  'workbench.editors.spec.update.failed': 'Colecția nu a putut fi actualizată.',
} as const satisfies Catalog;
