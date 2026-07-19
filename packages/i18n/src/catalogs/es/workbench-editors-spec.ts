/**
 * Workbench editors — the API spec editor, Spanish. Extends the es
 * register contract (`es/shared.ts`). Outline group labels mirror the
 * document's own keywords (`paths:`, `components:`, `schemas:`,
 * AsyncAPI `channels:`/`operations:`, proto
 * `package`/`import`/`service`/`message`/`enum`) and ride raw; `Files`
 * is app grouping and translates (`Archivos`). The AsyncAPI
 * Send/Receive badges mirror the document's `action` enum and stay
 * raw — a different referent from the Send button mint `Enviar`.
 * MINTS: outline (document tree) = `índice` (esquema stays schema);
 * path = `ruta`; streaming modes = `Unario` / `Streaming de servidor` /
 * `Streaming de cliente` / `Streaming bidireccional` (editors-grpc must
 * reuse). `tags` rides raw (m.) in prose; `baseUrl` verbatim.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchEditorsSpec = {
  // ── Spec editor (API specification documents) ─────────────────────
  'workbench.editors.spec.notFound': 'Especificación no encontrada.',
  'workbench.editors.spec.deletedElsewhere': 'Esta especificación se eliminó en otra sesión.',
  'workbench.editors.spec.saveFailed': 'No se pudo guardar la especificación.',
  'workbench.editors.spec.validation.clean': 'No se encontraron problemas',
  'workbench.editors.spec.validation.errors': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} error', many: '{count} errores', other: '{count} errores' }),
  'workbench.editors.spec.validation.warnings': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} advertencia',
      many: '{count} advertencias',
      other: '{count} advertencias',
    }),
  'workbench.editors.spec.outline.title': 'Vista general',
  'workbench.editors.spec.outline.show': 'Mostrar la vista general',
  'workbench.editors.spec.outline.hide': 'Ocultar la vista general',
  'workbench.editors.spec.outline.empty': 'El índice aparece una vez que el documento se analiza.',
  'workbench.editors.spec.outline.rootBadge': 'RAÍZ',
  'workbench.editors.spec.outline.makeRoot': 'Marcar como archivo raíz',
  'workbench.editors.spec.outline.fileMenuAria': 'Acciones del archivo',
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
  'workbench.editors.spec.outline.groups.files': 'Archivos',
  'workbench.editors.spec.outline.streaming.unary': 'Unario',
  'workbench.editors.spec.outline.streaming.server': 'Streaming de servidor',
  'workbench.editors.spec.outline.streaming.client': 'Streaming de cliente',
  'workbench.editors.spec.outline.streaming.bidi': 'Streaming bidireccional',
  'workbench.editors.spec.outline.action.send': 'Send',
  'workbench.editors.spec.outline.action.receive': 'Receive',
  'workbench.editors.spec.outline.add.server': 'Añadir servidor',
  'workbench.editors.spec.outline.add.tag': 'Añadir tag',
  'workbench.editors.spec.outline.add.path': 'Añadir ruta',
  'workbench.editors.spec.outline.add.operation': 'Añadir operación',
  'workbench.editors.spec.outline.add.schema': 'Añadir esquema',
  'workbench.editors.spec.outline.add.securityScheme': 'Añadir esquema de seguridad',
  'workbench.editors.spec.outline.add.securityRequirement': 'Añadir requisito de seguridad',
  'workbench.editors.spec.generate.button': 'Generar colección',
  'workbench.editors.spec.generate.collectionsButton': 'Colecciones',
  'workbench.editors.spec.generate.popoverTitle': 'Colecciones generadas',
  'workbench.editors.spec.generate.modalTitle': 'GENERAR COLECCIÓN',
  'workbench.editors.spec.generate.blurb':
    'Genera una colección a partir de esta especificación. Las operaciones se convierten en solicitudes bajo una ' +
    'variable de colección baseUrl, los tags se convierten en carpetas y los esquemas de seguridad se asignan a ' +
    'la autenticación. La colección permanece vinculada a esta especificación.',
  'workbench.editors.spec.generate.namePlaceholder': 'Nombre de la colección',
  'workbench.editors.spec.generate.nameRequired': 'La colección necesita un nombre',
  'workbench.editors.spec.generate.dirtyHint':
    'Los cambios sin guardar del editor no se incluyen — la generación usa el último documento guardado.',
  'workbench.editors.spec.generate.parseFailed': 'Esta especificación no se puede analizar',
  'workbench.editors.spec.generate.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud',
      many: '{count} solicitudes',
      other: '{count} solicitudes',
    }),
  'workbench.editors.spec.generate.foldersCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} carpeta', many: '{count} carpetas', other: '{count} carpetas' }),
  'workbench.editors.spec.generate.variablesCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable de colección',
      many: '{count} variables de colección',
      other: '{count} variables de colección',
    }),
  'workbench.editors.spec.generate.action': 'Generar',
  'workbench.editors.spec.generate.success': 'Se generó «{name}» — {summary}',
  'workbench.editors.spec.generate.failed': 'No se pudo crear la colección.',
  'workbench.editors.spec.generate.linkFailed':
    'La colección se generó, pero no se pudo registrar su vínculo con la especificación — no aparecerá en esta ' +
    'lista.',
  'workbench.editors.spec.generateProto.blurb':
    'Genera una colección a partir de esta especificación. Los métodos de servicio se convierten en solicitudes ' +
    'gRPC con sus mensajes de ejemplo prerrellenados, agrupadas en una carpeta por servicio. La colección ' +
    'permanece vinculada a esta especificación.',
  'workbench.editors.spec.generateProto.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud gRPC',
      many: '{count} solicitudes gRPC',
      other: '{count} solicitudes gRPC',
    }),
  'workbench.editors.spec.generateProto.servicesCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} servicio', many: '{count} servicios', other: '{count} servicios' }),
  'workbench.editors.spec.generateProto.empty':
    'El documento no declara métodos de servicio a partir de los cuales generar.',
  'workbench.editors.spec.generateProto.partial': 'Generación incompleta — {created} creadas, {failed} fallidas.',
  'workbench.editors.spec.generateWs.blurb':
    'Genera una colección a partir de esta especificación. Las operaciones se convierten en solicitudes ' +
    'WebSocket dirigidas al servidor ws/wss del documento, con un mensaje de ejemplo prerrellenado a partir del ' +
    'esquema del canal. La colección permanece vinculada a esta especificación.',
  'workbench.editors.spec.generateWs.requestsCount': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} solicitud WebSocket',
      many: '{count} solicitudes WebSocket',
      other: '{count} solicitudes WebSocket',
    }),
  'workbench.editors.spec.generateWs.empty': 'El documento no declara operaciones a partir de las cuales generar.',
  'workbench.editors.spec.generateWs.noWsServer': 'El documento no declara ningún servidor ws o wss al que conectarse.',
  'workbench.editors.spec.generateWs.partial': 'Generación incompleta — {created} creadas, {failed} fallidas.',
  'workbench.editors.spec.generateWs.skipped': 'Se omitió {operation}: {reason}.',
  'workbench.editors.spec.update.button': 'Actualizar',
  'workbench.editors.spec.update.protoUnavailable':
    'Actualizar desde una especificación Protobuf aún no está disponible — genera una colección nueva para ' +
    'recoger los cambios.',
  'workbench.editors.spec.update.inSyncBadge': 'Sincronizada con el documento guardado',
  'workbench.editors.spec.update.driftedBadge': 'La especificación cambió desde la última actualización',
  'workbench.editors.spec.update.modalTitle': 'ACTUALIZAR COLECCIÓN',
  'workbench.editors.spec.update.blurb':
    'Revisa las diferencias entre el documento guardado y «{name}» y aplica las actualizaciones seleccionadas. ' +
    'Las filas sin marcar quedan intactas.',
  'workbench.editors.spec.update.dirtyHint':
    'Los cambios sin guardar del editor no se incluyen — la actualización usa el último documento guardado.',
  'workbench.editors.spec.update.parseFailed': 'Esta especificación no se puede analizar',
  'workbench.editors.spec.update.inSync':
    'Sin diferencias a nivel de solicitud — aplicar marca la colección como sincronizada con el documento ' +
    'guardado.',
  'workbench.editors.spec.update.groupAdded': 'Añadidas ({count})',
  'workbench.editors.spec.update.groupChanged': 'Modificadas ({count})',
  'workbench.editors.spec.update.groupRemoved': 'Retiradas de la especificación ({count})',
  'workbench.editors.spec.update.removeHint': 'Las solicitudes sin marcar permanecen en la colección.',
  'workbench.editors.spec.update.groupCollection': 'Colección',
  'workbench.editors.spec.update.variablesRow': 'Variables de colección',
  'workbench.editors.spec.update.authRow': 'Autenticación de la colección',
  'workbench.editors.spec.update.field.name': 'nombre',
  'workbench.editors.spec.update.field.description': 'descripción',
  'workbench.editors.spec.update.field.headers': 'encabezados',
  'workbench.editors.spec.update.field.params': 'parámetros',
  'workbench.editors.spec.update.field.auth': 'auth',
  'workbench.editors.spec.update.field.body': 'cuerpo',
  'workbench.editors.spec.update.action': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: 'Aplicar {count} actualización',
      many: 'Aplicar {count} actualizaciones',
      other: 'Aplicar {count} actualizaciones',
    }),
  'workbench.editors.spec.update.markInSync': 'Marcar como sincronizada',
  'workbench.editors.spec.update.hashNote':
    'Aplicar registra esta versión del documento en el vínculo de la colección, por lo que el vínculo se lee ' +
    'como sincronizado aunque algunas filas quedaran sin marcar.',
  'workbench.editors.spec.update.success': 'Se actualizó «{name}» — {count} aplicadas',
  'workbench.editors.spec.update.partial':
    '{applied} aplicadas, {failed} fallidas — la colección puede quedar actualizada solo parcialmente.',
  'workbench.editors.spec.update.failed': 'No se pudo actualizar la colección.',
} as const satisfies Catalog;
