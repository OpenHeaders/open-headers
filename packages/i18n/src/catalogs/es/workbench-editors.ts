/**
 * Workbench editors — shared editor chrome — Spanish. Mirrors
 * `catalogs/en/workbench-editors.ts` key for key. Raw by design:
 * snippet code bodies and `oh.*` API names (never keyed), the
 * {column} / {header} / {key} / {name} / {language} / {message} holes,
 * `snippet` as the dev loanword (m.) and `Tests` / `Workflows` raw;
 * package = paquete (script-packages precedent). Package-flow strings
 * shared with `workbench-script-packages.ts` (duplicate name,
 * not-found, save failed) reuse its es sentences verbatim; `Heredar`
 * mints the Inherit option label — `workbench-editors-request.ts`
 * must reuse it. Format = Formatear (the S62 panel mint).
 */

import type { Catalog } from '../../types';

export const workbenchEditors = {
  'workbench.editors.sectionInfo.moreInformation': 'Más información',

  // ── Editable-grid chrome (shared: request editor + response-example) ─
  'workbench.editors.grid.key': 'Clave',
  'workbench.editors.grid.value': 'Valor',
  'workbench.editors.grid.description': 'Descripción',
  'workbench.editors.grid.showColumns': 'Mostrar columnas',
  'workbench.editors.grid.tableOptions': 'Opciones de la tabla',
  'workbench.editors.grid.bulk': 'En bloque',
  'workbench.editors.grid.keyValue': 'Clave-Valor',
  'workbench.editors.grid.selectAllAria': 'Activar o desactivar todas las filas',
  'workbench.editors.grid.selectAllTitle': 'Activar / desactivar todo',
  // {column} interpolates the internal column id (key/value/description).
  'workbench.editors.grid.resizeColumnAria': 'Redimensionar la columna {column}',
  'workbench.editors.grid.overriddenBy': 'Duplicado — sustituido por la fila {header} que añadiste.',
  'workbench.editors.grid.suggestionValueAria': 'Valor de {key}',

  // ── Ancestor scripts editor (collection/folder script slots) ───────
  'workbench.editors.ancestorScripts.titleCollection': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.titleFolder': 'Scripts — {name}',
  'workbench.editors.ancestorScripts.descriptionCollection':
    'Estos scripts se ejecutan para cada solicitud de esta colección — el script pre-solicitud antes de cada ' +
    'envío, el script post-respuesta después de cada respuesta. Se ejecutan primero: los scripts de la ' +
    'colección, luego los de la carpeta y luego los propios de la solicitud.',
  'workbench.editors.ancestorScripts.descriptionFolder':
    'Estos scripts se ejecutan para cada solicitud de esta carpeta — el script pre-solicitud antes de cada ' +
    'envío, el script post-respuesta después de cada respuesta. Se ejecutan después de los scripts de la ' +
    'colección y antes de los propios de la solicitud.',
  'workbench.editors.ancestorScripts.notFoundCollection': 'Colección de solicitudes no encontrada.',
  'workbench.editors.ancestorScripts.notFoundFolder': 'Carpeta no encontrada.',
  'workbench.editors.ancestorScripts.saveFailed': 'No se pudieron guardar los scripts.',
  'workbench.editors.ancestorScripts.saveFailedDetail': 'No se pudieron guardar los scripts: {message}',
  'workbench.editors.ancestorScripts.deletedElsewhere': 'Este elemento se eliminó en otra ventana.',

  // ── Ancestor auth editor (collection/folder default authorization) ──
  'workbench.editors.ancestorAuth.titleCollection': 'Autorización — {name}',
  'workbench.editors.ancestorAuth.titleFolder': 'Autorización — {name}',
  'workbench.editors.ancestorAuth.descriptionCollection':
    'Las solicitudes configuradas en Heredar usan esta autorización. La autorización propia de una carpeta ' +
    'tiene prioridad, y la autorización explícita de una solicitud siempre gana. Heredar aquí significa que ' +
    'no hay nada configurado en este nivel.',
  'workbench.editors.ancestorAuth.descriptionFolder':
    'Las solicitudes configuradas en Heredar usan esta autorización antes que la de la colección. La ' +
    'autorización explícita de una solicitud siempre gana. Heredar aquí significa que no hay nada configurado ' +
    'en este nivel — las solicitudes recurren a la colección.',
  'workbench.editors.ancestorAuth.notFoundCollection': 'Colección de solicitudes no encontrada.',
  'workbench.editors.ancestorAuth.notFoundFolder': 'Carpeta no encontrada.',
  'workbench.editors.ancestorAuth.saveFailed': 'No se pudo guardar la autorización.',
  'workbench.editors.ancestorAuth.saveFailedDetail': 'No se pudo guardar la autorización: {message}',
  'workbench.editors.ancestorAuth.deletedElsewhere': 'Este elemento se eliminó en otra ventana.',

  // ── Response-example editor ────────────────────────────────────────
  'workbench.editors.responseExample.loading': 'Cargando el ejemplo…',
  'workbench.editors.responseExample.notFound': 'Ejemplo no encontrado.',
  'workbench.editors.responseExample.toast.deletedOtherTab': 'El ejemplo se eliminó desde otra pestaña',
  'workbench.editors.responseExample.toast.saveFailed': 'No se pudo guardar el ejemplo',
  'workbench.editors.responseExample.toast.saveFailedDetail': 'No se pudo guardar el ejemplo: {message}',
  'workbench.editors.responseExample.openAsRequest': 'Abrir como solicitud',
  'workbench.editors.responseExample.openAsRequestTooltip':
    'Crea un nuevo borrador de solicitud sembrado a partir de la solicitud de este ejemplo',
  'workbench.editors.responseExample.editStatus': 'Editar el código de estado',
  'workbench.editors.responseExample.statusPlaceholder': 'Introduce el código de respuesta',
  'workbench.editors.responseExample.capturedTooltip': 'Capturado el {date}',
  'workbench.editors.responseExample.moreActionsAria': 'Más acciones de respuesta',
  'workbench.editors.responseExample.tab.body': 'Cuerpo',
  'workbench.editors.responseExample.tab.headers': 'Encabezados ({count})',
  'workbench.editors.responseExample.bodyLanguageAria': 'Lenguaje del cuerpo',
  'workbench.editors.responseExample.format': 'Formatear',
  'workbench.editors.responseExample.formatBody': 'Formatear el cuerpo',
  'workbench.editors.responseExample.noFormatter': 'No hay formateador para {language}',

  // ── Script editor (snippets/packages menus, save-to-package flow,
  //    ScriptsTab's own Monaco context-menu actions). Snippet code
  //    bodies and `oh.*` API names stay raw; Encode/DecodeURIComponent
  //    menu entries are code names and stay raw. ─────────────────────
  'workbench.editors.scriptEditor.snippets': 'Snippets',
  'workbench.editors.scriptEditor.packages': 'Paquetes',
  'workbench.editors.scriptEditor.searchSnippets': 'Buscar snippets',
  'workbench.editors.scriptEditor.searchPackages': 'Buscar paquetes',
  'workbench.editors.scriptEditor.noSnippetFound': 'No se encontró ningún snippet',
  'workbench.editors.scriptEditor.noPackagesInWorkspace': 'Aún no hay paquetes en este espacio de trabajo',
  'workbench.editors.scriptEditor.noPackageFound': 'No se encontró ningún paquete',
  'workbench.editors.scriptEditor.openPackageLibrary': 'Abrir la Biblioteca de paquetes →',
  'workbench.editors.scriptEditor.saveToPackage': 'Guardar en la Biblioteca de paquetes',
  'workbench.editors.scriptEditor.newPackage': 'Nuevo paquete',
  'workbench.editors.scriptEditor.newPackageName': 'Nombre del nuevo paquete',
  'workbench.editors.scriptEditor.back': 'Atrás',
  'workbench.editors.scriptEditor.create': 'Crear',
  'workbench.editors.scriptEditor.orAppend': 'O añadir a un paquete existente:',
  'workbench.editors.scriptEditor.noPackagesYet': 'Aún no hay paquetes',
  'workbench.editors.scriptEditor.savedTo': 'Guardado en «{name}»',
  'workbench.editors.scriptEditor.packageCreated': 'Paquete «{name}» creado',
  'workbench.editors.scriptEditor.duplicatePackage':
    'Ya existe un paquete llamado «{name}» en este espacio de trabajo.',
  'workbench.editors.scriptEditor.packageNotFound': 'Paquete no encontrado — puede que haya sido eliminado.',
  'workbench.editors.scriptEditor.saveFailed': 'No se pudo guardar',
  'workbench.editors.scriptEditor.menuFind': 'Buscar',
  'workbench.editors.scriptEditor.find': 'Buscar',
  'workbench.editors.scriptEditor.replace': 'Reemplazar',
  'workbench.editors.scriptEditor.beautify': 'Embellecer',
  'workbench.editors.scriptEditor.group.request': 'Solicitud',
  'workbench.editors.scriptEditor.group.workflows': 'Workflows',
  'workbench.editors.scriptEditor.group.packages': 'Paquetes',
  'workbench.editors.scriptEditor.group.variables': 'Variables',
  'workbench.editors.scriptEditor.group.tests': 'Tests',
  'workbench.editors.scriptEditor.snippet.sendRequest': 'Enviar una solicitud HTTP',
  'workbench.editors.scriptEditor.snippet.sendRequestJsonBody': 'Enviar una solicitud HTTP con un cuerpo JSON',
  'workbench.editors.scriptEditor.snippet.getVariable': 'Leer una variable',
  'workbench.editors.scriptEditor.snippet.setVariable': 'Definir una variable',
  'workbench.editors.scriptEditor.snippet.getVaultSecret': 'Leer un secreto del vault',
  'workbench.editors.scriptEditor.snippet.usePackage': 'Usar un paquete',
  'workbench.editors.scriptEditor.snippet.setHeader': 'Definir un encabezado',
  'workbench.editors.scriptEditor.snippet.removeHeader': 'Quitar un encabezado',
  'workbench.editors.scriptEditor.snippet.setQueryParam': 'Definir un parámetro de consulta',
  'workbench.editors.scriptEditor.snippet.removeQueryParam': 'Quitar un parámetro de consulta',
  'workbench.editors.scriptEditor.snippet.setUrl': 'Definir la URL',
  'workbench.editors.scriptEditor.snippet.setMethod': 'Definir el método',
  'workbench.editors.scriptEditor.snippet.setJsonBody': 'Definir un cuerpo JSON',
  'workbench.editors.scriptEditor.snippet.statusCode200': 'El código de estado es 200',
  'workbench.editors.scriptEditor.snippet.bodyContains': 'El cuerpo de la respuesta contiene una cadena',
  'workbench.editors.scriptEditor.snippet.bodyEquals': 'El cuerpo de la respuesta es igual a una cadena',
  'workbench.editors.scriptEditor.snippet.jsonValueCheck': 'Comprobación de un valor JSON del cuerpo de la respuesta',
  'workbench.editors.scriptEditor.snippet.headerCheck': 'Comprobación de un encabezado de respuesta',
  'workbench.editors.scriptEditor.snippet.responseTime': 'El tiempo de respuesta es inferior a 200 ms',
  'workbench.editors.scriptEditor.snippet.saveResponseValue': 'Guardar un valor de la respuesta en una variable',
} as const satisfies Catalog;
