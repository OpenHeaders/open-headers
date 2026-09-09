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
  'workbench.workspace.leaveTitle': '¿Salir de «{name}»?',
  'workbench.workspace.leaveBody':
    'Renuncias a tu propio acceso a este espacio de trabajo: desaparece de todas tus pestañas abiertas. ' +
    'Los demás conservan el suyo, y un administrador puede concedértelo de nuevo.',
  'workbench.workspace.leaveOk': 'Salir',
  'workbench.workspace.leaveFailed': 'No se pudo salir del espacio de trabajo',
  'workbench.workspace.leftToast': 'Has salido de «{name}»',
  'workbench.workspace.leaveAria': 'Salir del espacio de trabajo',
  'workbench.workspace.members.title': 'Miembros de «{name}»',
  'workbench.workspace.members.openAria': 'Gestionar miembros',
  'workbench.workspace.members.loadFailed': 'No se pudieron cargar los miembros',
  'workbench.workspace.members.updateFailed': 'No se pudieron actualizar los miembros',
  'workbench.workspace.members.operatorTag': 'Operador del servidor',
  'workbench.workspace.members.managedTag': 'Gestionado',
  'workbench.workspace.members.managedTooltip': 'Este acceso lo gestiona el proveedor de identidad.',
  'workbench.workspace.members.removeConfirm': '¿Quitar a {name} de este espacio de trabajo?',
  'workbench.workspace.members.removeOk': 'Quitar',
  'workbench.workspace.members.removeAria': 'Quitar miembro',
  'workbench.workspace.members.removedToast': '{name} quitado',
  'workbench.workspace.members.updatedToast': '{name} actualizado',
  'workbench.workspace.members.addedToast': '{name} añadido',
  'workbench.workspace.members.addPlaceholder': 'Añadir una persona o cuenta de servicio…',
  'workbench.workspace.members.addButton': 'Añadir',
  'workbench.workspace.members.noneToAdd': 'Todos en este servidor ya tienen acceso.',
  'workbench.workspace.members.readOnlyHint': 'Solo un propietario del espacio de trabajo puede cambiar los miembros.',
  'workbench.workspace.members.visibilityLabel': 'Acceso',
  'workbench.workspace.members.visibilityPrivate': 'Privado',
  'workbench.workspace.members.visibilityInternal': 'Interno',
  'workbench.workspace.members.visibilityPrivateHint':
    'Solo los miembros invitados pueden ver este espacio de trabajo.',
  'workbench.workspace.members.visibilityInternalHint':
    'Todos los miembros de este servidor pueden ver este espacio de trabajo. Solo los miembros añadidos pueden editarlo.',
  'workbench.workspace.members.visibilityUpdatedToast': 'Acceso al espacio de trabajo actualizado',
  'workbench.workspace.members.visibilityPublic': 'Público',
  'workbench.workspace.members.visibilityPublicHint':
    'Cualquiera con el enlace puede ver una instantánea compartida de solo lectura de este espacio de trabajo. ' +
    'Solo los miembros que añadas pueden editar.',
  'workbench.workspace.publicShare.heading': 'Enlace público',
  'workbench.workspace.publicShare.loadFailed': 'No se pudo cargar el estado del uso compartido público',
  'workbench.workspace.publicShare.disabledHint':
    'Los espacios de trabajo públicos están desactivados en este servidor. Un operador puede activarlos con ' +
    'publicWorkspaces en daemon.json.',
  'workbench.workspace.publicShare.notShared':
    'Aún no se ha compartido ninguna instantánea — el enlace se activa cuando compartas una.',
  'workbench.workspace.publicShare.sharedAt': 'Instantánea compartida {when}',
  'workbench.workspace.publicShare.shareButton': 'Compartir públicamente…',
  'workbench.workspace.publicShare.updateButton': 'Actualizar la copia pública…',
  'workbench.workspace.publicShare.stopButton': 'Dejar de compartir',
  'workbench.workspace.publicShare.stopConfirm':
    '¿Dejar de compartir este espacio de trabajo? El enlace público dejará de funcionar de inmediato.',
  'workbench.workspace.publicShare.stopOk': 'Dejar de compartir',
  'workbench.workspace.publicShare.stoppedToast': 'Enlace público eliminado',
  'workbench.workspace.publicShare.sharedToast': 'Instantánea pública compartida',
  'workbench.workspace.publicShare.copyLink': 'Copiar enlace',
  'workbench.workspace.publicShare.copiedToast': 'Enlace copiado',
  'workbench.workspace.publicShare.reviewTitle': 'Compartir «{name}» públicamente',
  'workbench.workspace.publicShare.reviewIntro':
    'Cualquiera con el enlace verá una instantánea de solo lectura de este espacio de trabajo tal como está ' +
    'ahora. Revisa lo que se publica antes de confirmar:',
  'workbench.workspace.publicShare.reviewUpdateNote':
    'Compartir de nuevo reemplaza la copia pública en el mismo enlace.',
  'workbench.workspace.publicShare.reviewStripped':
    'Nunca se incluyen: entradas del vault, tokens OAuth, valores en vivo, contenidos de archivos y los valores ' +
    'de variables secretas.',
  'workbench.workspace.publicShare.reviewStrippedCount':
    '{count} valores de variables secretas permanecen ocultos — sus nombres siguen visibles.',
  'workbench.workspace.publicShare.reviewContents': 'Contenido',
  'workbench.workspace.publicShare.reviewEmpty':
    'Este espacio de trabajo está vacío — la instantánea publicada también lo estará.',
  'workbench.workspace.publicShare.reviewVariables': 'Variables ({count})',
  'workbench.workspace.publicShare.reviewNoVariables': 'Sin variables.',
  'workbench.workspace.publicShare.reviewValueHidden': 'oculto',
  'workbench.workspace.publicShare.confirmShare': 'Compartir instantánea',
  'workbench.workspace.publicShare.previewFailed': 'No se pudo preparar la vista previa de la instantánea',
  'workbench.workspace.publicShare.shareFailed': 'No se pudo compartir la instantánea',
  'workbench.workspace.publicShare.scope.workspace': 'Espacio de trabajo',
  'workbench.workspace.publicShare.scope.environment': 'Entorno',
  'workbench.workspace.publicShare.scope.collection': 'Colección',
  'workbench.workspace.publicShare.cat.requests': '{count} solicitudes',
  'workbench.workspace.publicShare.cat.collections': '{count} colecciones',
  'workbench.workspace.publicShare.cat.folders': '{count} carpetas',
  'workbench.workspace.publicShare.cat.rules': '{count} reglas',
  'workbench.workspace.publicShare.cat.environments': '{count} entornos',
  'workbench.workspace.publicShare.cat.examples': '{count} ejemplos de respuesta',
  'workbench.workspace.publicShare.cat.specs': '{count} especificaciones de API',
  'workbench.workspace.publicShare.cat.scripts': '{count} paquetes de scripts',
  'workbench.workspace.publicShare.cat.templates': '{count} plantillas',
  'workbench.workspace.publicShare.cat.live': '{count} flujos en vivo',
  'workbench.workspace.publicShare.cat.files': '{count} archivos',
  'workbench.workspace.publicView.bannerTag': 'Instantánea pública',
  'workbench.workspace.publicView.banner':
    'Copia pública de solo lectura de «{name}». Los cambios que hagas aquí no se guardan en ningún sitio.',
  'workbench.workspace.publicView.loadFailed': 'Este enlace de espacio de trabajo público no está disponible.',
  'workbench.workspace.createOk': 'Crear',
  'workbench.workspace.createFailed': 'No se pudo crear el espacio de trabajo',
  'workbench.workspace.createdToastPrefix': 'Espacio de trabajo creado',
  'workbench.workspace.duplicateTitle': 'Duplicar «{name}»',
  'workbench.workspace.duplicateTitleFallback': 'Duplicar el espacio de trabajo',
  'workbench.workspace.duplicateOk': 'Duplicar',
  'workbench.workspace.duplicateFailed': 'No se pudo duplicar el espacio de trabajo',
  'workbench.workspace.duplicatedToast': '«{source}» duplicado → «{name}»',
  'workbench.workspace.publishFailed': 'No se pudo copiar el espacio de trabajo',
  'workbench.workspace.publishedToast': '«{name}» copiado en {place}',
  'workbench.workspace.selectedOrgFallback': 'el destino elegido',
  'workbench.workspace.editTitle': 'Editar el espacio de trabajo',
  'workbench.workspace.saveOk': 'Guardar',
  'workbench.workspace.updatedToast': '«{name}» actualizado',
  'workbench.workspace.deletedElsewhere': 'Este espacio de trabajo se eliminó desde otra pestaña',
  'workbench.workspace.updateFailed': 'No se pudo actualizar el espacio de trabajo',
  'workbench.workspace.updateFailedWithMessage': 'No se pudo actualizar el espacio de trabajo: {message}',
  'workbench.workspace.otherWorkspaces': 'Otros espacios de trabajo',
  'workbench.workspace.dragToReorder': 'Arrastra para reordenar',
  'workbench.workspace.activePill': 'Activo',
  'workbench.workspace.switch': 'Cambiar',
  'workbench.workspace.renameAria': 'Renombrar el espacio de trabajo',
  'workbench.workspace.duplicateAria': 'Duplicar el espacio de trabajo',
  'workbench.workspace.publishAria': 'Copiar el espacio de trabajo en una aplicación de escritorio o un servidor',
  'workbench.workspace.deleteAria': 'Eliminar el espacio de trabajo',
  'workbench.workspace.prefixLabel': 'Prefijo',
  'workbench.workspace.nameLabel': 'Nombre',
  'workbench.workspace.nameRequired': 'El nombre es obligatorio',
  'workbench.workspace.nameTooLong': 'Mantén los nombres por debajo de 60 caracteres',
  'workbench.workspace.namePlaceholder': 'Mi espacio de trabajo',
  'workbench.workspace.descriptionLabel': 'Descripción (opcional)',
  'workbench.workspace.copyOfName': 'Copia de {name}',
  'workbench.workspace.copyOfPlaceholder': 'Copia de …',
  'workbench.workspace.intoOrg': 'Destino',
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
  'workbench.workspace.publishTitle': 'Copiar «{name}»',
  'workbench.workspace.publishTitleFallback': 'Copiar el espacio de trabajo',
  'workbench.workspace.publishToOk': 'Copiar en {place}',
  'workbench.workspace.publishOk': 'Copiar',
  'workbench.workspace.publishIntro':
    'Una copia de este espacio de trabajo llega a la aplicación de escritorio o al servidor que elijas y se ' +
    'sincroniza desde allí. El original se queda aquí.',
  'workbench.workspace.toOrg': 'Copiar en',
  'workbench.workspace.pickTargetOrg': 'Elige adónde va la copia',

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
