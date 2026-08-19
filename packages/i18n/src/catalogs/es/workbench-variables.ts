/**
 * Workbench variables station — Spanish. Mirrors
 * `catalogs/en/workbench-variables.ts` key for key; extends the es
 * register contract (`es/shared.ts`). Technical plane raw inside keyed
 * sentences: `{{live.NAME}}` reference syntax, TOTP algorithm names,
 * PEM / Base32 / TOTP spec vocabulary, {name} / {message} holes. Page
 * titles reuse the sidebar names minted by the variables doc body
 * (`Variables del espacio de trabajo`, `Variables Live`, `Vault` raw);
 * the Scope panel section titles reuse its `En el ámbito` / `Todos los
 * ámbitos` labels, `ámbito` throughout (S59 two-word law), `referencia
 * sin prefijo` for bare refs and `semilla` for the TOTP seed. MINTS:
 * resolver = `el resolvedor` (falls back = `recae`); binding =
 * `vinculación`.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const workbenchVariables = {
  // ── Shared table chrome (VariableTable + VariableTableRow) ─────────
  'workbench.variables.table.headerVariable': 'Variable',
  'workbench.variables.table.headerSecret': 'Secreto',
  'workbench.variables.table.headerValue': 'Valor',
  'workbench.variables.table.namePlaceholder': 'Nombre',
  'workbench.variables.table.valuePlaceholder': 'Valor',
  'workbench.variables.table.addVariable': 'Añadir variable…',
  'workbench.variables.table.addSecret': 'Añadir secreto…',
  'workbench.variables.table.enableRow': 'Activar la variable',
  'workbench.variables.table.disableRow': 'Desactivar la variable',
  'workbench.variables.table.markSensitive': 'Marcar como sensible',
  'workbench.variables.table.unmarkSensitive': 'Dejar de marcar como sensible',
  'workbench.variables.table.showValue': 'Mostrar el valor',
  'workbench.variables.table.hideValue': 'Ocultar el valor',
  'workbench.variables.table.kindText': 'Texto',
  'workbench.variables.table.kindTotp': 'TOTP',
  'workbench.variables.table.kindCertificate': 'Certificado',
  'workbench.variables.table.kindSecretManager': 'Gestor de secretos',
  'workbench.variables.table.smProvider.onepassword': '1Password',
  'workbench.variables.table.smProvider.bitwarden': 'Bitwarden',
  'workbench.variables.table.smProvider.oskeychain': 'Almacén de credenciales del sistema',
  'workbench.variables.table.smProvider.awssm': 'AWS Secrets Manager',
  'workbench.variables.table.smProvider.azurekv': 'Azure Key Vault',
  'workbench.variables.table.smProvider.hashivault': 'HashiCorp Vault',
  'workbench.variables.table.smField.provider': 'Proveedor',
  'workbench.variables.table.smField.vault': 'Vault',
  'workbench.variables.table.smField.item': 'Elemento',
  'workbench.variables.table.smField.field': 'Campo',
  'workbench.variables.table.smField.account': 'Cuenta',
  'workbench.variables.table.smField.secretId': 'ID del secreto',
  'workbench.variables.table.smField.service': 'Servicio',
  'workbench.variables.table.smField.name': 'Nombre',
  'workbench.variables.table.smField.stage': 'Etapa',
  'workbench.variables.table.smField.region': 'Región',
  'workbench.variables.table.smField.profile': 'Perfil',
  'workbench.variables.table.smField.vaultUrl': 'URL del vault',
  'workbench.variables.table.smField.version': 'Versión',
  'workbench.variables.table.smField.mount': 'Punto de montaje',
  'workbench.variables.table.smField.path': 'Ruta',
  'workbench.variables.table.smField.key': 'Clave',
  'workbench.variables.table.smField.serverUrl': 'URL del servidor',
  'workbench.variables.table.smFieldOptional': '{label} (opcional)',
  'workbench.variables.table.smStatus.available': 'Disponible',
  'workbench.variables.table.smStatus.notInstalled': 'No disponible en este dispositivo',
  'workbench.variables.table.smStatus.integrationDisabled': 'Integración deshabilitada',
  'workbench.variables.table.smStatus.noCredentials': 'Sin credenciales configuradas',
  'workbench.variables.table.smStatus.locked': 'Bloqueado',
  'workbench.variables.table.smStatus.unreachable': 'Inaccesible',
  'workbench.variables.table.certPlaceholder': 'Certificado (PEM)',
  'workbench.variables.table.certKeyPlaceholder': 'Clave privada (PEM)',
  'workbench.variables.table.passphrasePlaceholder': 'Frase de contraseña de la clave (opcional)',
  'workbench.variables.table.showCertificate': 'Mostrar el certificado',
  'workbench.variables.table.hideCertificate': 'Ocultar el certificado',
  'workbench.variables.table.seedPlaceholder': 'Semilla Base32',
  'workbench.variables.table.showSeed': 'Mostrar la semilla',
  'workbench.variables.table.hideSeed': 'Ocultar la semilla',
  'workbench.variables.table.totpSummary': '{algorithm} · {digits} dígitos · {period}s',
  'workbench.variables.table.totpSummaryIssuer': '{algorithm} · {digits} dígitos · {period}s · {issuer}',
  'workbench.variables.table.issuerPlaceholder': 'Emisor',

  // ── Shared page chrome ──────────────────────────────────────────────
  'workbench.variables.variablesCount': 'VARIABLES ({count})',

  // ── Workspace variables page ────────────────────────────────────────
  'workbench.variables.workspace.title': 'Variables del espacio de trabajo',
  'workbench.variables.workspace.description':
    'Compartidas entre todos los entornos de este espacio de trabajo. La prioridad más baja — sustituidas por ' +
    'los ámbitos de colección, entorno y vault.',
  'workbench.variables.workspace.saveFailed': 'No se pudieron guardar las variables del espacio de trabajo',
  'workbench.variables.workspace.saveFailedDetail':
    'No se pudieron guardar las variables del espacio de trabajo: {message}',

  // ── Environment page ────────────────────────────────────────────────
  'workbench.variables.environment.notFound': 'Entorno no encontrado.',
  'workbench.variables.environment.activeTag': 'Activo',
  'workbench.variables.environment.defaultTag': 'Por defecto',
  'workbench.variables.environment.defaultTooltip':
    'El resolvedor recae aquí cuando al entorno activo le falta una variable.',
  'workbench.variables.environment.setActive': 'Hacer activo',
  'workbench.variables.environment.setDefault': 'Definir como por defecto',
  'workbench.variables.environment.unsetDefault': 'Quitar como por defecto',
  'workbench.variables.environment.setDefaultTooltip':
    'Definir como por defecto — el resolvedor recae aquí cuando al entorno activo le falta una variable.',
  'workbench.variables.environment.unsetDefaultTooltip':
    'Quitar como por defecto — el resolvedor dejará de recaer en este entorno.',
  'workbench.variables.environment.deletedElsewhere': 'El entorno se eliminó desde otra pestaña',
  'workbench.variables.environment.updateFailed': 'No se pudo actualizar el entorno',
  'workbench.variables.environment.updateFailedDetail': 'No se pudo actualizar el entorno: {message}',

  // ── Collection variables page ───────────────────────────────────────
  'workbench.variables.collection.notFound': 'Colección no encontrada.',
  'workbench.variables.collection.title': '{name} · Variables',
  'workbench.variables.collection.descriptionRule':
    'Variables disponibles para todas las reglas de esta colección. Sustituidas por los ámbitos de entorno y ' +
    'vault; sustituyen al ámbito del espacio de trabajo. Se guardan en texto plano — usa el Vault para los ' +
    'secretos.',
  'workbench.variables.collection.descriptionRequest':
    'Variables disponibles para todas las solicitudes de esta colección. Sustituidas por los ámbitos de ' +
    'entorno y vault; sustituyen al ámbito del espacio de trabajo. Se guardan en texto plano — usa el Vault ' +
    'para los secretos.',
  'workbench.variables.collection.descriptionTemplate':
    'Variables disponibles para todas las plantillas de esta colección. Sustituidas por los ámbitos de entorno ' +
    'y vault; sustituyen al ámbito del espacio de trabajo. Se guardan en texto plano — usa el Vault para los ' +
    'secretos.',
  'workbench.variables.collection.deletedElsewhere': 'La colección se eliminó desde otra pestaña',
  'workbench.variables.collection.saveFailed': 'No se pudieron guardar las variables de colección',
  'workbench.variables.collection.saveFailedDetail': 'No se pudieron guardar las variables de colección: {message}',

  // ── Vault page ──────────────────────────────────────────────────────
  'workbench.variables.vault.title': 'Vault',
  'workbench.variables.vault.infoBanner':
    'Los secretos del vault se cifran en reposo, nunca salen de este dispositivo y tienen prioridad sobre ' +
    'todos los demás ámbitos.',
  'workbench.variables.vault.cipherLocked':
    'El almacenamiento de secretos está bloqueado — el sistema denegó el acceso a su llavero, así que los ' +
    'secretos del vault no se pueden leer ni guardar en esta sesión.',
  'workbench.variables.vault.cipherLockedRelaunch': 'Relanzar la aplicación',
  'workbench.variables.vault.lockedTitle': 'Vault bloqueado — clave en reposo perdida',
  'workbench.variables.vault.lockedDescription':
    'Los secretos de este vault siguen almacenados en este dispositivo pero ya no se pueden descifrar: la ' +
    'clave en reposo que los sellaba desapareció (datos de navegación borrados, un perfil nuevo o una clave ' +
    'de extensión restablecida). La edición está desactivada para que una entrada nueva no pueda sobrescribir ' +
    'los datos sellados. Vuelve a introducir los secretos para desbloquear el vault — las entradas existentes ' +
    'se reemplazarán.',
  'workbench.variables.vault.secretsCount':
    'SECRETOS ({strings} string · {totps} TOTP · {certs} certificado · {refs} gestor de secretos)',
  'workbench.variables.vault.saveFailed': 'No se pudo guardar el vault',
  'workbench.variables.vault.saveFailedDetail': 'No se pudo guardar el vault: {message}',

  // ── Live variables list page ────────────────────────────────────────
  'workbench.variables.live.title': 'Variables Live',
  'workbench.variables.live.newVariable': 'Nueva variable live',
  'workbench.variables.live.descriptionPrefix':
    'Cada vinculación asocia un nombre a una captura de un Workflow (una cadena de solicitudes programada). ' +
    'Se referencia en reglas y solicitudes como',
  'workbench.variables.live.descriptionSuffix': '.',
  'workbench.variables.live.headerName': 'Nombre',
  'workbench.variables.live.headerValue': 'Valor',
  'workbench.variables.live.headerWorkflow': 'Workflow',
  'workbench.variables.live.empty':
    'Aún no hay variables live. Crea una para vincular un nombre al valor capturado de un workflow.',
  'workbench.variables.live.draftMarker': 'borrador',
  'workbench.variables.live.offMarker': 'inactiva',
  'workbench.variables.live.overrideMarker': 'sustitución',
  'workbench.variables.live.clickEyeToReveal': 'Haz clic en el ojo para revelar',
  'workbench.variables.live.showValue': 'Mostrar el valor',
  'workbench.variables.live.hideValue': 'Ocultar el valor',
  'workbench.variables.live.notCapturedYet': 'aún sin capturar',
  'workbench.variables.live.missingWorkflow': 'falta el workflow',
  'workbench.variables.live.refreshNow': 'Actualizar el workflow ahora',
  'workbench.variables.live.refreshAria': 'Actualizar {name}',
  'workbench.variables.live.editBinding': 'Editar la vinculación (nombre / activada / sustitución)',
  'workbench.variables.live.editAria': 'Editar {name}',
  'workbench.variables.live.delete': 'Eliminar',
  'workbench.variables.live.deleteAria': 'Eliminar {name}',
  'workbench.variables.live.deleteFailed': 'No se pudo eliminar «{name}»',

  // ── Variable Scope tool window (Scope panel) ────────────────────────
  'workbench.variables.panel.scope.vault': 'Vault',
  'workbench.variables.panel.scope.environment': 'Entorno',
  'workbench.variables.panel.scope.collection': 'Colección',
  'workbench.variables.panel.scope.workspace': 'Espacio de trabajo',
  'workbench.variables.panel.scope.live': 'Live',
  'workbench.variables.panel.inContextTitle': 'En el ámbito',
  'workbench.variables.panel.inContextTitleNamed': 'En el ámbito: {name}',
  'workbench.variables.panel.inContextSummary':
    'Las variables que referencia la regla, solicitud o plantilla activa — cada una resuelta a través de todos ' +
    'los ámbitos, para que veas el valor exacto que se aplicará. Vacío hasta que abras una.',
  'workbench.variables.panel.allScopesTitle': 'Todos los ámbitos',
  'workbench.variables.panel.allScopesSummary':
    'Todas las variables definidas en todos los ámbitos, agrupadas por prioridad de resolución. Abre el (i) de ' +
    'un ámbito para ver cómo referenciarlo y en qué posición queda.',
  'workbench.variables.panel.sectionAboutAria': 'Acerca de {title}',
  'workbench.variables.panel.scopeAboutAria': 'Acerca de las variables de {scope}',
  'workbench.variables.panel.scopeSummary.vault': 'Secretos por usuario, guardados en tu vault y nunca sincronizados.',
  'workbench.variables.panel.scopeSummary.environment':
    'Variables del entorno activo, con el entorno por defecto como respaldo.',
  'workbench.variables.panel.scopeSummary.collection': 'Variables limitadas a la colección activa.',
  'workbench.variables.panel.scopeSummary.workspace': 'Variables compartidas en todo el espacio de trabajo.',
  'workbench.variables.panel.scopeSummary.live':
    'Un valor respaldado por un workflow, resuelto de la última ejecución.',
  'workbench.variables.panel.scopeInfo.title': '{label} {qualifier}',
  'workbench.variables.panel.scopeInfo.qualifierSecret': 'secreto',
  'workbench.variables.panel.scopeInfo.qualifierVariable': 'variable',
  'workbench.variables.panel.scopeInfo.writePrefix': 'Escribe',
  'workbench.variables.panel.scopeInfo.liveOnlyMiddle': 'solamente — nunca como',
  'workbench.variables.panel.scopeInfo.orJustMiddle': 'o simplemente',
  'workbench.variables.panel.scopeInfo.sentenceEnd': '.',
  'workbench.variables.panel.scopeInfo.barePrefix': 'La referencia sin prefijo',
  'workbench.variables.panel.scopeInfo.bareSuffix': 'se resuelve por prioridad:',
  'workbench.variables.panel.scopeInfo.liveOutside': 'Live queda fuera de este orden.',
  'workbench.variables.panel.env.subtitleActiveDefault': '{active} · por defecto: {default}',
  'workbench.variables.panel.env.subtitleNoneDefault': 'Sin entorno · por defecto: {default}',
  'workbench.variables.panel.env.subtitleNone': 'Sin entorno',
  'workbench.variables.panel.env.editTooltip': 'Abrir el editor de variables de entorno',
  'workbench.variables.panel.env.createTooltip': 'Crea tu primer entorno',
  'workbench.variables.panel.env.selectTooltip': 'Elegir el entorno activo',
  'workbench.variables.panel.collection.noneActive': 'Sin colección activa',
  'workbench.variables.panel.live.resolvedCount': '{resolved}/{total} resueltas',
  'workbench.variables.panel.live.noneDefined': 'sin variables live definidas',
  'workbench.variables.panel.action.edit': 'Editar',
  'workbench.variables.panel.action.editTooltip': 'Abrir el editor de variables de {scope}',
  'workbench.variables.panel.action.create': 'Crear',
  'workbench.variables.panel.action.select': 'Seleccionar',
  'workbench.variables.panel.emptyScopeSecrets': 'No hay secretos definidos.',
  'workbench.variables.panel.emptyScopeVariables': 'No hay variables definidas.',
  'workbench.variables.panel.openHint': 'Abre una solicitud o una regla para ver las variables que referencia.',
  'workbench.variables.panel.noneReferenced': 'No hay variables referenciadas en esta {noun}.',
  'workbench.variables.panel.noun.rule': 'regla',
  'workbench.variables.panel.noun.request': 'solicitud',
  'workbench.variables.panel.noun.template': 'plantilla',
  'workbench.variables.panel.allResolved': ({ count }, locale) =>
    plural(locale, Number(count), {
      one: '{count} variable resuelta',
      many: 'Todas las {count} variables resueltas',
      other: 'Todas las {count} variables resueltas',
    }),
  'workbench.variables.panel.unresolvedCount': '{count} sin resolver',
  'workbench.variables.panel.valueUnresolved': 'sin resolver',
  'workbench.variables.panel.valueEmpty': '(vacío)',
  'workbench.variables.panel.showValue': 'Mostrar el valor',
  'workbench.variables.panel.hideValue': 'Ocultar el valor',
  'workbench.variables.panel.copyValue': 'Copiar el valor',
  'workbench.variables.panel.copied': 'Copiado',
  'workbench.variables.panel.errors.title': 'Problemas de resolución ({count})',
  'workbench.variables.panel.errors.referenceTooltip': 'La referencia en bruto dentro de {{…}}',
  'workbench.variables.panel.errors.reason.unresolved': 'sin resolver',
  'workbench.variables.panel.errors.reason.unsetInScope': 'fuera del ámbito',
  'workbench.variables.panel.errors.reason.unknownNamespace': 'espacio de nombres desconocido',
  'workbench.variables.panel.errors.reason.stepOutOfContext': 'referencia de paso fuera de contexto',
  'workbench.variables.panel.errors.reason.empty': 'vacía',
  'workbench.variables.panel.errors.reason.invalidResolvedValue': 'valor no válido',
  'workbench.variables.panel.errors.reason.secretAuthorizationRequired': 'autorización requerida',
  'workbench.variables.panel.errors.reason.secretNotFound': 'secreto no encontrado',
  'workbench.variables.panel.errors.reason.secretUnavailable': 'gestor no disponible',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Copiar el código',
  'workbench.totpPreview.copied': 'Copiado',
  'workbench.totpPreview.refreshesTooltip': 'Se actualiza en {seconds}s',
  'workbench.totpPreview.refreshesAria': 'El código TOTP se actualiza en {seconds} segundos',
} as const satisfies Catalog;
