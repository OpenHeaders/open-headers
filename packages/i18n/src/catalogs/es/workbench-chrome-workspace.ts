/**
 * Workbench chrome — the workspace plane — Spanish. Mirrors
 * `catalogs/en/workbench-chrome-workspace.ts` key for key. Workspace
 * and org names ride raw inside keyed values ({name} / {source} /
 * {org} / {orgs} / {hint} holes); `Org` stays the raw product noun
 * (f., shared-workspace precedent); `OAuth`, format names (PNG, JPEG,
 * WebP, SVG) and the `KB` unit ride raw as en writes them.
 */

import type { Catalog } from '../../types';

export const workbenchChromeWorkspace = {
  // ── Workspace: manager page ─────────────────────────────────────────
  'workbench.workspace.title': 'Espacios de trabajo',
  'workbench.workspace.newWorkspace': 'Nuevo espacio de trabajo',
  'workbench.workspace.intro':
    'Cada espacio de trabajo contiene sus propias reglas, colecciones, carpetas, plantillas, variables e ' +
    'historial de ejecuciones de tests. Arrastra para reordenar.',
  'workbench.workspace.deleteTitle': '¿Eliminar «{name}»?',
  'workbench.workspace.deleteBody':
    'Elimina permanentemente el espacio de trabajo y todas sus reglas, colecciones, carpetas, plantillas, ' +
    'variables e historial de ejecuciones de tests. Esta acción no se puede deshacer.',
  'workbench.workspace.deleteOk': 'Eliminar',
  'workbench.workspace.deleteFailed': 'No se pudo eliminar el espacio de trabajo',
  'workbench.workspace.deletedToast': '«{name}» eliminado',
  'workbench.workspace.createOk': 'Crear',
  'workbench.workspace.createFailed': 'No se pudo crear el espacio de trabajo',
  'workbench.workspace.createdToastPrefix': 'Espacio de trabajo creado',
  'workbench.workspace.duplicateTitle': 'Duplicar «{name}»',
  'workbench.workspace.duplicateTitleFallback': 'Duplicar el espacio de trabajo',
  'workbench.workspace.duplicateOk': 'Duplicar',
  'workbench.workspace.duplicateFailed': 'No se pudo duplicar el espacio de trabajo',
  'workbench.workspace.duplicatedToast': '«{source}» duplicado → «{name}»',
  'workbench.workspace.publishFailed': 'No se pudo publicar el espacio de trabajo',
  'workbench.workspace.publishedToast': '«{name}» publicado en {org}',
  'workbench.workspace.selectedOrgFallback': 'la Org seleccionada',
  'workbench.workspace.editTitle': 'Editar el espacio de trabajo',
  'workbench.workspace.saveOk': 'Guardar',
  'workbench.workspace.updatedToast': '«{name}» actualizado',
  'workbench.workspace.deletedElsewhere': 'Este espacio de trabajo se eliminó desde otra pestaña',
  'workbench.workspace.updateFailed': 'No se pudo actualizar el espacio de trabajo',
  'workbench.workspace.updateFailedWithMessage': 'No se pudo actualizar el espacio de trabajo: {message}',
  'workbench.workspace.newWorkspacesGoTo': 'Los nuevos espacios de trabajo van a',
  'workbench.workspace.orgPrefHint':
    'Cámbialo cuando quieras — los espacios de trabajo existentes se quedan donde están.',
  'workbench.workspace.otherWorkspaces': 'Otros espacios de trabajo',
  'workbench.workspace.dragToReorder': 'Arrastra para reordenar',
  'workbench.workspace.activePill': 'Activo',
  'workbench.workspace.switch': 'Cambiar',
  'workbench.workspace.renameAria': 'Renombrar el espacio de trabajo',
  'workbench.workspace.duplicateAria': 'Duplicar el espacio de trabajo',
  'workbench.workspace.publishAria': 'Publicar el espacio de trabajo en un back-end',
  'workbench.workspace.deleteAria': 'Eliminar el espacio de trabajo',
  'workbench.workspace.prefixLabel': 'Prefijo',
  'workbench.workspace.nameLabel': 'Nombre',
  'workbench.workspace.nameRequired': 'El nombre es obligatorio',
  'workbench.workspace.nameTooLong': 'Mantén los nombres por debajo de 60 caracteres',
  'workbench.workspace.namePlaceholder': 'Mi espacio de trabajo',
  'workbench.workspace.descriptionLabel': 'Descripción (opcional)',
  'workbench.workspace.copyOfName': 'Copia de {name}',
  'workbench.workspace.copyOfPlaceholder': 'Copia de …',
  'workbench.workspace.intoOrg': 'En la Org',
  'workbench.workspace.includeSecrets': 'Incluir el contenido del vault (secretos)',
  'workbench.workspace.includeSecretsHint':
    'Vuelve a introducir los secretos en la copia si hace falta. Las conexiones OAuth se reautorizan en ' +
    'cualquier caso.',

  // ── Workspace: switcher ─────────────────────────────────────────────
  'workbench.workspace.makeActiveTitle': '¿Hacer de «{name}» el espacio de trabajo activo?',
  'workbench.workspace.makeActiveBody':
    'El popup, el panel lateral y los nuevos {units} que no estén fijados a un espacio de trabajo concreto ' +
    'cambiarán a «{name}».',
  'workbench.workspace.makeActiveOk': 'Hacer activo',
  'workbench.workspace.cancel': 'Cancelar',
  'workbench.workspace.nowActiveToast': '«{name}» es ahora el espacio de trabajo activo',
  'workbench.workspace.switcherAria': 'Este {unit} edita el espacio de trabajo: {name}. Haz clic para cambiar.',

  // ── Workspace: publish modal ────────────────────────────────────────
  'workbench.workspace.publishTitle': 'Publicar «{name}»',
  'workbench.workspace.publishTitleFallback': 'Publicar el espacio de trabajo',
  'workbench.workspace.publishToOk': 'Publicar en {org}',
  'workbench.workspace.publishOk': 'Publicar',
  'workbench.workspace.publishIntro':
    'Publicar copia este espacio de trabajo en la Org elegida, donde se sincroniza a través de ese back-end. ' +
    'El original se queda aquí.',
  'workbench.workspace.toOrg': 'A la Org',
  'workbench.workspace.pickTargetOrg': 'Elige una Org de destino',
  'workbench.workspace.includeSecretsPublishHint':
    'Vuelve a introducir los secretos en la copia publicada si hace falta. Las conexiones OAuth se ' +
    'reautorizan en cualquier caso.',

  // ── Workspace: home-Org identity card ───────────────────────────────
  'workbench.workspace.org.logoButton': 'Logo',
  'workbench.workspace.org.logoAria': 'Cambiar el logo de esta organización',
  'workbench.workspace.org.renameButton': 'Renombrar',
  'workbench.workspace.org.renameAria': 'Renombrar esta organización',
  'workbench.workspace.org.renameTitle': 'Renombrar {hint}',
  'workbench.workspace.org.renameTitleFallback': 'Renombrar',
  'workbench.workspace.org.nameUpdated': 'Nombre actualizado',
  'workbench.workspace.org.identityLoading': 'La identidad aún se está cargando — inténtalo de nuevo en un momento',
  'workbench.workspace.org.renameExtra':
    'Se muestra en el selector de espacios de trabajo y a cualquiera con quien compartas espacios de trabajo.',
  'workbench.workspace.org.nameTooLong': 'Mantén los nombres por debajo de {max} caracteres',
  'workbench.workspace.org.namePlaceholder': 'Mi portátil del trabajo',
  'workbench.workspace.org.logoTitle': 'Logo de {hint}',
  'workbench.workspace.org.logoTitleFallback': 'Logo de la organización',
  'workbench.workspace.org.logoAlt': 'Logo actual de la organización',
  'workbench.workspace.org.replace': 'Reemplazar…',
  'workbench.workspace.org.upload': 'Subir…',
  'workbench.workspace.org.remove': 'Quitar',
  'workbench.workspace.org.logoUpdated': 'Logo actualizado',
  'workbench.workspace.org.logoRemoved': 'Logo quitado',
  'workbench.workspace.org.fileReadFailed': 'Ese archivo no se pudo leer.',
  'workbench.workspace.org.logoHint':
    'PNG, JPEG, WebP o SVG, de hasta {kb} KB. Las imágenes cuadradas quedan mejor. Se muestra a todos los ' +
    'que se sincronizan con esta organización.',
  'workbench.workspace.org.logoReject.notImage': 'Ese archivo no se pudo leer como imagen.',
  'workbench.workspace.org.logoReject.corruptImage': 'Ese archivo no es una imagen válida de su tipo declarado.',
  'workbench.workspace.org.logoReject.unsupportedFormat': 'Usa un archivo PNG, JPEG, WebP o SVG.',
  'workbench.workspace.org.logoReject.tooLarge': 'Mantén el logo por debajo de {kb} KB.',
  'workbench.workspace.org.logoReject.unsafeSvg':
    'Este SVG contiene scripts o referencias externas — exporta un SVG simple y autocontenido.',

  // ── Workspace: grant arrival + zero-grant banner ────────────────────
  'workbench.workspace.grant.arrivedActiveTitle': 'Ahora tienes acceso a un espacio de trabajo',
  'workbench.workspace.grant.arrivedTitle': 'Un espacio de trabajo ya está disponible',
  'workbench.workspace.grant.open': 'Abrir el espacio de trabajo',
  'workbench.workspace.grant.notifTitleActive': 'Ahora tienes acceso a «{name}»',
  'workbench.workspace.grant.notifTitle': 'El espacio de trabajo «{name}» ya está disponible',
  'workbench.workspace.grant.notifBodyActive': 'Un admin te concedió acceso — ya estás trabajando en él.',
  'workbench.workspace.grant.notifBody': 'Un admin te concedió acceso — aparece en el selector de espacios de trabajo.',
  'workbench.workspace.grant.orgFallback': 'tu organización',
  'workbench.workspace.grant.zeroBanner':
    'Conectado a {orgs} — aún no se te ha concedido ningún espacio de trabajo. Estás trabajando en un espacio ' +
    'de trabajo local; los espacios concedidos aparecen aquí automáticamente en cuanto un admin te da acceso.',

  // ── Workspace: identity picker ──────────────────────────────────────
  'workbench.workspace.picker.colorAria': 'Color {name}',
  'workbench.workspace.picker.searchIcons': 'Buscar iconos...',
  'workbench.workspace.picker.noIconTooltip': 'Sin icono — mostrar solo el cuadrado de color',
  'workbench.workspace.picker.noIconAria': 'Sin icono',
  'workbench.workspace.picker.triggerAria': 'Elegir el prefijo del espacio de trabajo (color o icono)',
} as const satisfies Catalog;
