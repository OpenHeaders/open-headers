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
  'workbench.variables.table.smStatus.notTested': 'Sin probar',
  'workbench.variables.table.smStatus.connected': 'Conectado',
  'workbench.variables.table.smStatus.connectedDetail': 'El último contacto se realizó correctamente a las {time}.',
  'workbench.variables.table.smStatus.notInstalled': 'No disponible en este dispositivo',
  'workbench.variables.table.smStatus.integrationDisabled': 'Integración deshabilitada',
  'workbench.variables.table.smStatus.noCredentials': 'Sin credenciales configuradas',
  'workbench.variables.table.smStatus.locked': 'Bloqueado',
  'workbench.variables.table.smStatus.denied': 'Acceso denegado',
  'workbench.variables.table.smStatus.unreachable': 'Inaccesible',
  'workbench.variables.table.smStatus.brokerUnreachable': 'Conecta la aplicación de escritorio',
  'workbench.variables.table.smStatus.noConnection': 'Ninguna conexión seleccionada',
  'workbench.variables.table.smStatus.guidance.onepassword.connected':
    '1Password vuelve a pedir aprobación tras 10 minutos de inactividad; el siguiente uso muestra la solicitud.',
  'workbench.variables.table.smStatus.guidance.onepassword.unreachable':
    'La aplicación de 1Password no aceptó la conexión. Comprueba que el nombre de la cuenta coincide con su barra lateral y que Ajustes › Desarrollador › Integrar con los SDK de 1Password está activado.',
  'workbench.variables.table.smConnection': 'Conexión',
  'workbench.variables.table.smConnectionPlaceholder': 'Conexión…',
  'workbench.variables.table.smConnectionDesktopOnly': 'Se configura en la aplicación de escritorio',
  'workbench.variables.table.smConnectionConnectDesktop': 'Conecta la aplicación de escritorio',
  'workbench.variables.table.smConnectionNone': 'Todavía no hay conexiones para este proveedor',
  'workbench.variables.table.smConnectionManage': 'Gestionar…',
  'workbench.variables.table.smField.auth': 'Autenticación',
  'workbench.variables.table.smField.auth.app': 'Aplicación de escritorio (biometría)',
  'workbench.variables.table.smField.auth.serviceAccount': 'Token de cuenta de servicio (entorno)',
  'workbench.variables.table.smField.auth.appHint':
    'Requiere la aplicación de 1Password con Ajustes › Desarrollador › Integrar con los SDK de 1Password activado; el nombre de la cuenta es el que muestra su barra lateral.',
  'workbench.variables.table.smField.namespace': 'Espacio de nombres',
  'workbench.variables.table.smField.authMethod': 'Método de autenticación',
  'workbench.variables.table.smField.authMethod.token': 'Token',
  'workbench.variables.table.smField.authMethod.approle': 'AppRole',
  'workbench.variables.table.smField.authMethod.oidc': 'OIDC',
  'workbench.variables.secretManagers.count': 'CONEXIONES ({count})',
  'workbench.variables.secretManagers.add': 'Añadir conexión',
  'workbench.variables.secretManagers.empty': 'Todavía no hay conexiones con gestores de secretos',
  'workbench.variables.secretManagers.emptyHint':
    'Conecte un gestor de secretos una sola vez; las entradas del almacén referencian después los secretos por ruta a través de él, y el secreto solo se obtiene cuando se ejecuta una solicitud.',
  'workbench.variables.secretManagers.header.label': 'Nombre',
  'workbench.variables.secretManagers.header.provider': 'Proveedor',
  'workbench.variables.secretManagers.header.target': 'Cuenta o servidor',
  'workbench.variables.secretManagers.header.status': 'Estado',
  'workbench.variables.secretManagers.row.test': 'Probar',
  'workbench.variables.secretManagers.row.edit': 'Editar',
  'workbench.variables.secretManagers.row.remove': 'Eliminar',
  'workbench.variables.secretManagers.form.provider': 'Proveedor',
  'workbench.variables.secretManagers.form.label': 'Nombre',
  'workbench.variables.secretManagers.form.labelPlaceholder': 'Trabajo',
  'workbench.variables.secretManagers.form.save': 'Guardar',
  'workbench.variables.secretManagers.form.cancel': 'Cancelar',
  'workbench.variables.secretManagers.form.incomplete': 'Rellene los campos obligatorios.',
  'workbench.variables.secretManagers.test.ok': 'Conectado: {label} está autorizado en este dispositivo.',
  'workbench.variables.secretManagers.test.failed': 'No se pudo conectar: {detail}',
  'workbench.variables.secretManagers.saveFailedDetail': 'No se pudo guardar la conexión: {message}',
  'workbench.variables.secretManagers.browserNote':
    'Las conexiones con gestores de secretos residen en la aplicación de escritorio. Ábrala para añadir o probar una.',
  'workbench.variables.secretManagers.browserNoteConnected':
    'Estas conexiones son de la aplicación de escritorio. Pruébalas desde aquí; añádelas o edítalas en la aplicación de escritorio.',
  'workbench.variables.table.smInfo.exampleCaption': 'Ejemplo de conexión y referencia',
  'workbench.variables.table.smInfo.referenceTitle': 'Referencia',
  'workbench.variables.table.smInfo.fieldsHeading': 'Campos',
  'workbench.variables.table.smInfo.reference':
    'La ruta a un secreto dentro del gestor. El valor se obtiene a través de la conexión solo cuando se ejecuta una solicitud y nunca se guarda aquí.',
  'workbench.variables.table.smInfo.label':
    'Tu propio nombre para esta conexión — lo que muestra el selector de conexión de la fila del almacén. Nunca llega al gestor.',
  'workbench.variables.table.smInfo.provider.onepassword':
    'Los secretos se quedan en 1Password. Una entrada del almacén nombra un vault, un elemento y un campo; el valor se obtiene a través de la app de 1Password en este dispositivo (te pide aprobación) o de un token de cuenta de servicio, solo cuando se ejecuta una solicitud.',
  'workbench.variables.table.smInfo.provider.bitwarden':
    'Los secretos se quedan en Bitwarden Secrets Manager. Una entrada del almacén nombra un secreto por su ID; el valor se obtiene con el token de acceso de cuenta de máquina que guarda este dispositivo, solo cuando se ejecuta una solicitud.',
  'workbench.variables.table.smInfo.provider.oskeychain':
    'Los secretos se quedan en el almacén de credenciales de este equipo — el Llavero de macOS, el Administrador de credenciales de Windows o Secret Service en Linux. Una entrada del almacén nombra un servicio y una cuenta; el valor se lee solo cuando se ejecuta una solicitud.',
  'workbench.variables.table.smInfo.provider.awssm':
    'Los secretos se quedan en AWS Secrets Manager. Una entrada del almacén nombra un secreto y, opcionalmente, una etapa; el valor se obtiene con las credenciales de AWS que guarda este dispositivo, solo cuando se ejecuta una solicitud.',
  'workbench.variables.table.smInfo.provider.azurekv':
    'Los secretos se quedan en Azure Key Vault. Una entrada del almacén nombra un secreto y, opcionalmente, una versión en un Key Vault; el valor se obtiene con la identidad de Azure que guarda este dispositivo, solo cuando se ejecuta una solicitud.',
  'workbench.variables.table.smInfo.provider.hashivault':
    'Los secretos se quedan en HashiCorp Vault. Una entrada del almacén nombra un punto de montaje, una ruta y una clave; el valor se obtiene del servidor con el método de autenticación que elijas, solo cuando se ejecuta una solicitud.',
  'workbench.variables.table.smInfo.connection.onepassword.account':
    'El nombre de la cuenta exactamente como lo muestra la app de 1Password en su barra lateral — la app compara por este nombre.',
  'workbench.variables.table.smInfo.connection.onepassword.auth':
    'Cómo inicia sesión este dispositivo: con la app de escritorio de 1Password, que te pide aprobar cada sesión (Touch ID donde esté disponible), o con un token de cuenta de servicio leído de OP_SERVICE_ACCOUNT_TOKEN en el entorno de esta app para equipos sin la app.',
  'workbench.variables.table.smInfo.connection.bitwarden.serverUrl':
    'Déjalo en blanco para bitwarden.com; indica la dirección de un servidor autoalojado o de la UE.',
  'workbench.variables.table.smInfo.connection.awssm.profile':
    'El perfil con nombre del archivo de credenciales de AWS en este dispositivo; en blanco usa la cadena de credenciales predeterminada.',
  'workbench.variables.table.smInfo.connection.awssm.region':
    'La región donde viven los secretos; en blanco usa la región predeterminada del perfil o del entorno.',
  'workbench.variables.table.smInfo.connection.azurekv.vaultUrl':
    'La URL propia del Key Vault (https://<name>.vault.azure.net) — una conexión por Key Vault.',
  'workbench.variables.table.smInfo.connection.hashivault.serverUrl':
    'La dirección del servidor de HashiCorp Vault, con el puerto.',
  'workbench.variables.table.smInfo.connection.hashivault.namespace':
    'El espacio de nombres en un servidor Enterprise; en blanco para el espacio raíz.',
  'workbench.variables.table.smInfo.connection.hashivault.authMethod':
    'Cómo se autentica este dispositivo ante el servidor: con un token, un AppRole u OIDC a través de tu proveedor de identidad.',
  'workbench.variables.table.smInfo.locator.onepassword.vault':
    'El vault de 1Password que contiene el elemento, por nombre.',
  'workbench.variables.table.smInfo.locator.onepassword.item': 'El título del elemento, tal como lo muestra 1Password.',
  'workbench.variables.table.smInfo.locator.onepassword.field':
    'El campo dentro del elemento — password, credential o la etiqueta de un campo personalizado; escribe sección/campo cuando el campo está en una sección.',
  'workbench.variables.table.smInfo.locator.bitwarden.secretId':
    'El ID del secreto en Bitwarden Secrets Manager — el UUID de su página.',
  'workbench.variables.table.smInfo.locator.oskeychain.service':
    'El servicio bajo el que se guarda la entrada — el nombre del elemento en Acceso a Llaveros o el destino en el Administrador de credenciales.',
  'workbench.variables.table.smInfo.locator.oskeychain.account': 'El nombre de cuenta de esa entrada.',
  'workbench.variables.table.smInfo.locator.awssm.name': 'El nombre del secreto o su ARN completo.',
  'workbench.variables.table.smInfo.locator.awssm.stage': 'La etiqueta de etapa que se lee; en blanco lee AWSCURRENT.',
  'workbench.variables.table.smInfo.locator.azurekv.name': 'El nombre del secreto en el Key Vault.',
  'workbench.variables.table.smInfo.locator.azurekv.version':
    'Una versión concreta que leer; en blanco lee la más reciente.',
  'workbench.variables.table.smInfo.locator.hashivault.mount':
    'La ruta del punto de montaje del motor de secretos — secret para el motor KV predeterminado.',
  'workbench.variables.table.smInfo.locator.hashivault.path': 'La ruta al secreto bajo ese punto de montaje.',
  'workbench.variables.table.smInfo.locator.hashivault.key': 'La clave dentro del secreto cuyo valor se lee.',
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
  'workbench.variables.vault.trustedRootsNote':
    '¿Buscas certificados CA? Los certificados de confianza son datos del espacio de trabajo, no secretos — ' +
    'tienen su propia pestaña.',
  'workbench.variables.vault.trustedRootsLink': 'Abrir certificados de confianza',
  'workbench.variables.vault.secretManagersNote':
    'Las cuentas y servidores de los gestores de secretos son ajustes del dispositivo, no entradas del almacén.',
  'workbench.variables.vault.secretManagersLink': 'Abrir gestores de secretos',
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
  'workbench.variables.panel.errors.reason.secretBrokerUnreachable': 'aplicación de escritorio no conectada',

  // ── TOTP preview (workbench-pane-shared component) ─────────────────
  'workbench.totpPreview.copyCode': 'Copiar el código',
  'workbench.totpPreview.copied': 'Copiado',
  'workbench.totpPreview.refreshesTooltip': 'Se actualiza en {seconds}s',
  'workbench.totpPreview.refreshesAria': 'El código TOTP se actualiza en {seconds} segundos',
} as const satisfies Catalog;
