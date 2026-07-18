/**
 * Workbench editors — the API spec editor: outline/overview pane,
 * validation strip, and section chrome. OpenAPI/Protobuf structural
 * vocabulary (Paths / Schemas / rpc names) rides raw where it names
 * document structure.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': 'Specification not found.',
  'workbench.editors.spec.deletedElsewhere': 'This specification was deleted in another session.',
  'workbench.editors.spec.saveFailed': 'Could not save the specification.',
  'workbench.editors.spec.validation.clean': 'No problems found',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} error', other: '{count} errors' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} warning', other: '{count} warnings' }),
  'workbench.editors.spec.outline.title': 'Overview',
  'workbench.editors.spec.outline.show': 'Show overview',
  'workbench.editors.spec.outline.hide': 'Hide overview',
  'workbench.editors.spec.outline.empty': 'The outline appears once the document parses.',
  'workbench.editors.spec.outline.rootBadge': 'ROOT',
  'workbench.editors.spec.outline.makeRoot': 'Mark as Root file',
  'workbench.editors.spec.outline.fileMenuAria': 'File actions',
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
  'workbench.editors.spec.outline.groups.files': 'Files',
  'workbench.editors.spec.outline.streaming.unary': 'Unary',
  'workbench.editors.spec.outline.streaming.server': 'Server streaming',
  'workbench.editors.spec.outline.streaming.client': 'Client streaming',
  'workbench.editors.spec.outline.streaming.bidi': 'Bidirectional streaming',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'Add server',
  'workbench.editors.spec.outline.add.tag': 'Add tag',
  'workbench.editors.spec.outline.add.path': 'Add path',
  'workbench.editors.spec.outline.add.operation': 'Add operation',
  'workbench.editors.spec.outline.add.schema': 'Add schema',
  'workbench.editors.spec.outline.add.securityScheme': 'Add security scheme',
  'workbench.editors.spec.outline.add.securityRequirement': 'Add security requirement',
  'workbench.editors.spec.generate.button': 'Generate Collection',
  'workbench.editors.spec.generate.collectionsButton': 'Collections',
  'workbench.editors.spec.generate.popoverTitle': 'Generated collections',
  'workbench.editors.spec.generate.modalTitle': 'GENERATE COLLECTION',
  'workbench.editors.spec.generate.blurb':
    'Generate a collection from this specification. Operations become requests under a baseUrl collection variable, tags become folders, and security schemes map to auth. The collection stays linked to this spec.',
  'workbench.editors.spec.generate.namePlaceholder': 'Collection name',
  'workbench.editors.spec.generate.nameRequired': 'The collection needs a name',
  'workbench.editors.spec.generate.dirtyHint':
    'Unsaved editor changes are not included — generation uses the last saved document.',
  'workbench.editors.spec.generate.parseFailed': "This specification doesn't parse",
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} request', other: '{count} requests' }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} folder', other: '{count} folders' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} collection variable', other: '{count} collection variables' }),
  'workbench.editors.spec.generate.action': 'Generate',
  'workbench.editors.spec.generate.success': 'Generated "{name}" — {summary}',
  'workbench.editors.spec.generate.failed': 'Could not create the collection.',
  'workbench.editors.spec.generate.linkFailed':
    'The collection was generated, but recording its spec link failed — it will not appear in this list.',
  'workbench.editors.spec.generateProto.blurb':
    'Generate a collection from this specification. Service methods become gRPC requests with their example messages pre-filled, grouped in a folder per service. The collection stays linked to this spec.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} gRPC request', other: '{count} gRPC requests' }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} service', other: '{count} services' }),
  'workbench.editors.spec.generateProto.empty': 'The document declares no service methods to generate from.',
  'workbench.editors.spec.generateProto.partial': 'Generated with gaps — {created} created, {failed} failed.',
  'workbench.editors.spec.generateWs.blurb':
    'Generate a collection from this specification. Operations become WebSocket requests targeting the document’s ws/wss server, with an example message pre-filled from the channel’s schema. The collection stays linked to this spec.',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} WebSocket request', other: '{count} WebSocket requests' }),
  'workbench.editors.spec.generateWs.empty': 'The document declares no operations to generate from.',
  'workbench.editors.spec.generateWs.noWsServer': 'The document declares no ws or wss server to connect to.',
  'workbench.editors.spec.generateWs.partial': 'Generated with gaps — {created} created, {failed} failed.',
  'workbench.editors.spec.generateWs.skipped': 'Skipped {operation}: {reason}.',
  'workbench.editors.spec.update.button': 'Update',
  'workbench.editors.spec.update.protoUnavailable':
    'Updating from a Protobuf spec is not available yet — generate a fresh collection to pick up changes.',
  'workbench.editors.spec.update.inSyncBadge': 'In sync with the saved document',
  'workbench.editors.spec.update.driftedBadge': 'The specification changed since the last update',
  'workbench.editors.spec.update.modalTitle': 'UPDATE COLLECTION',
  'workbench.editors.spec.update.blurb':
    'Review the differences between the saved document and "{name}", then apply the selected updates. Unchecked rows are left untouched.',
  'workbench.editors.spec.update.dirtyHint':
    'Unsaved editor changes are not included — the update uses the last saved document.',
  'workbench.editors.spec.update.parseFailed': "This specification doesn't parse",
  'workbench.editors.spec.update.inSync':
    'No request-level differences — applying marks the collection in sync with the saved document.',
  'workbench.editors.spec.update.groupAdded': 'Added ({count})',
  'workbench.editors.spec.update.groupChanged': 'Changed ({count})',
  'workbench.editors.spec.update.groupRemoved': 'Removed from spec ({count})',
  'workbench.editors.spec.update.removeHint': 'Unchecked requests stay in the collection.',
  'workbench.editors.spec.update.groupCollection': 'Collection',
  'workbench.editors.spec.update.variablesRow': 'Collection variables',
  'workbench.editors.spec.update.authRow': 'Collection auth',
  'workbench.editors.spec.update.field.name': 'name',
  'workbench.editors.spec.update.field.description': 'description',
  'workbench.editors.spec.update.field.headers': 'headers',
  'workbench.editors.spec.update.field.params': 'params',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'body',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), { one: 'Apply {count} update', other: 'Apply {count} updates' }),
  'workbench.editors.spec.update.markInSync': 'Mark in sync',
  'workbench.editors.spec.update.hashNote':
    'Applying records this document version on the collection link, so the link reads in sync even if rows were left unchecked.',
  'workbench.editors.spec.update.success': 'Updated "{name}" — {count} applied',
  'workbench.editors.spec.update.partial':
    '{applied} applied, {failed} failed — the collection may be partially updated.',
  'workbench.editors.spec.update.failed': 'Could not update the collection.',
} as const satisfies Catalog;
