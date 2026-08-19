/**
 * Daemon-admin family — Spanish. Mirrors
 * `catalogs/en/workbench-server-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.com/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and `daemon` as the product loanword
 * (m., web.ts precedent). Seat vocabulary (`plaza individual`, the
 * `oh-license.…` placeholder) reuses `web.ts` verbatim. Mints: pool =
 * reserva; solo/team tier = nivel solo / nivel de equipo.
 */

import type { Catalog } from '../../types';

export const workbenchServerAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.serverAdmin.title': 'Administración del servidor',
  'workbench.serverAdmin.intro':
    'Los usuarios del directorio inician sesión con un token vinculado o por SSO y ven exactamente los ' +
    'espacios de trabajo concedidos aquí. La desactivación revoca los tokens del usuario y lo desconecta de ' +
    'inmediato.',
  'workbench.serverAdmin.deniedDescription': 'Administrar este servidor requiere la capacidad daemon.admin.',
  'workbench.serverAdmin.cancel': 'Cancelar',

  // ── Release-notes card ─────────────────────────────────────────────
  'workbench.serverAdmin.notes.sectionTitle': 'Notas de la versión',
  'workbench.serverAdmin.notes.sectionHint': 'Lo que incluye el build del servidor que administra esta consola.',
  'workbench.serverAdmin.notes.versionLine': 'Servidor {version}',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.serverAdmin.users.sectionTitle': 'Usuarios',
  'workbench.serverAdmin.users.sectionHint':
    'Admite un usuario y luego concédele roles por espacio de trabajo abajo. El email une los inicios de ' +
    'sesión SSO a la ficha.',
  'workbench.serverAdmin.users.nameRequired': 'El nombre es obligatorio',
  'workbench.serverAdmin.users.displayNamePlaceholder': 'Nombre para mostrar',
  'workbench.serverAdmin.users.emailPlaceholder': 'Email (opcional — obligatorio para SSO)',
  'workbench.serverAdmin.users.seatKeyPlaceholder': 'Clave de plaza individual (oh-license.…)',
  'workbench.serverAdmin.users.addUser': 'Añadir usuario',
  'workbench.serverAdmin.users.seatLimit':
    'Este servidor está en su límite de plazas. Añade plazas a tu licencia de equipo, o pega arriba la clave de ' +
    'plaza individual del usuario que se incorpora — lo admite sin consumir una plaza de la reserva.',
  'workbench.serverAdmin.users.seatsSoldAt': 'Las plazas individuales se venden en',
  'workbench.serverAdmin.users.emptyDirectory':
    'Aún no hay usuarios en el directorio — el servidor funciona en su nivel solo. Añade un usuario para abrir ' +
    'el nivel de equipo.',
  'workbench.serverAdmin.users.deactivatedOn': 'Desactivado el {date}',
  'workbench.serverAdmin.users.addedOn': 'añadido el {date}',
  'workbench.serverAdmin.users.loadFailed': 'No se pudo cargar el directorio de usuarios: {message}',
  'workbench.serverAdmin.users.addFailed': 'No se pudo añadir el usuario: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.serverAdmin.seat.tag': 'Plaza individual',
  'workbench.serverAdmin.seat.healthyTooltip':
    'Admitido por su propia plaza individual ({id}) — no cuenta contra la reserva de este servidor.',
  'workbench.serverAdmin.seat.lapsedTooltip':
    'Su plaza individual ({id}) está {status}. Sigue con la sesión iniciada — un vencimiento nunca expulsa — ' +
    'pero la plaza ya no se renueva.',
  'workbench.serverAdmin.seat.absorbTitle': '¿Absorber esta plaza en la reserva?',
  'workbench.serverAdmin.seat.absorbDescription':
    'El usuario pasa a ser una plaza normal de la reserva y su licencia individual deja de renovarse aquí. ' +
    'Esto no se puede deshacer.',
  'workbench.serverAdmin.seat.absorbOk': 'Absorber',
  'workbench.serverAdmin.seat.absorbCta': 'Absorber en la reserva',
  'workbench.serverAdmin.seat.absorbed': 'Plaza absorbida en la reserva.',
  'workbench.serverAdmin.seat.absorbFailed': 'No se pudo absorber la plaza: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.serverAdmin.deactivate.title': '¿Desactivar este usuario?',
  'workbench.serverAdmin.deactivate.description':
    'Sus tokens quedan revocados y sus conexiones activas cerradas. Readmítelo más tarde añadiendo de nuevo ' +
    'el mismo email.',
  'workbench.serverAdmin.deactivate.cta': 'Desactivar',
  'workbench.serverAdmin.deactivate.done':
    'Usuario desactivado. Sus tokens fueron revocados y sus conexiones activas cerradas.',
  'workbench.serverAdmin.deactivate.failed': 'No se pudo desactivar: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.serverAdmin.grants.roleViewer': 'Lector',
  'workbench.serverAdmin.grants.roleEditor': 'Editor',
  'workbench.serverAdmin.grants.roleOwner': 'Propietario',
  'workbench.serverAdmin.grants.none': 'Aún sin acceso a ningún espacio de trabajo.',
  'workbench.serverAdmin.grants.idpTooltip':
    'Concedido por el mapeo del proveedor de identidad. La revocación solo se mantiene hasta su siguiente ' +
    'inicio de sesión SSO, que lo vuelve a aplicar.',
  'workbench.serverAdmin.grants.workspacePlaceholder': 'Espacio de trabajo',
  'workbench.serverAdmin.grants.grantCta': 'Conceder',
  'workbench.serverAdmin.grants.everyWorkspace': 'Concedido en todos los espacios de trabajo.',
  'workbench.serverAdmin.grants.grantFailed': 'No se pudo conceder: {message}',
  'workbench.serverAdmin.grants.revokeFailed': 'No se pudo revocar la concesión: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.serverAdmin.password.setTitle': 'Definir contraseña — {name}',
  'workbench.serverAdmin.password.resetTitle': 'Restablecer contraseña — {name}',
  'workbench.serverAdmin.password.explainer':
    'El usuario inicia sesión con su email y esta contraseña en el portal web del servidor. Compártela ' +
    'directamente con esa persona — está guardada con hash en el servidor y no se puede volver a leer.',
  'workbench.serverAdmin.password.placeholder': 'Nueva contraseña (mínimo 8 caracteres)',
  'workbench.serverAdmin.password.setCta': 'Definir contraseña',
  'workbench.serverAdmin.password.resetCta': 'Restablecer contraseña',
  'workbench.serverAdmin.password.removeCta': 'Quitar contraseña',
  'workbench.serverAdmin.password.setDone': 'Contraseña definida.',
  'workbench.serverAdmin.password.removedDone': 'Contraseña eliminada.',
  'workbench.serverAdmin.password.updateFailed': 'No se pudo actualizar la contraseña: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.serverAdmin.gitEmail.setTitle': 'Definir el email de Git — {name}',
  'workbench.serverAdmin.gitEmail.changeTitle': 'Cambiar el email de Git — {name}',
  'workbench.serverAdmin.gitEmail.explainer':
    'Los commits que llevan el trabajo de este usuario se firman con esta dirección, así que enlazan con su ' +
    'perfil del alojamiento Git. Sin una, se usa el email del directorio y luego una dirección noreply.',
  'workbench.serverAdmin.gitEmail.placeholder': 'email del autor de los commits',
  'workbench.serverAdmin.gitEmail.setCta': 'Definir el email de Git',
  'workbench.serverAdmin.gitEmail.changeCta': 'Cambiar el email de Git',
  'workbench.serverAdmin.gitEmail.removeCta': 'Quitar la invalidación',
  'workbench.serverAdmin.gitEmail.setDone': 'Email de Git definido.',
  'workbench.serverAdmin.gitEmail.removedDone': 'Invalidación del email de Git eliminada.',
  'workbench.serverAdmin.gitEmail.updateFailed': 'No se pudo actualizar el email de Git: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.serverAdmin.git.sectionTitle': 'Git',
  'workbench.serverAdmin.git.sectionHint':
    'Vincula un espacio de trabajo del servidor a un repositorio y dirige commit, pull, push y ramas en remoto. ' +
    'Las rutas están en el sistema de archivos del propio servidor.',
  'workbench.serverAdmin.git.workspaceLabel': 'Espacio de trabajo',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.serverAdmin.audit.sectionTitle': 'Informes',
  'workbench.serverAdmin.audit.sectionHint':
    'Cada decisión de permisos que toma este servidor, y cada admisión de dispositivo, como un registro de ' +
    'auditoría filtrable. La exportación respeta los filtros activos.',
  'workbench.serverAdmin.audit.capAdmission': 'Admisión (conexión)',
  'workbench.serverAdmin.audit.capAdminPlane': 'Plano de administración',
  'workbench.serverAdmin.audit.capSsoGrant': 'Concesión SSO (mapeo)',
  'workbench.serverAdmin.audit.capSsoRevoke': 'Revocación SSO (mapeo)',
  'workbench.serverAdmin.audit.capWorkspaceRead': 'Lectura de espacio de trabajo',
  'workbench.serverAdmin.audit.capWorkspaceWrite': 'Escritura de espacio de trabajo',
  'workbench.serverAdmin.audit.capWorkspaceList': 'Lista de espacios de trabajo',
  'workbench.serverAdmin.audit.rangeLastHour': 'Última hora',
  'workbench.serverAdmin.audit.rangeLast24Hours': 'Últimas 24 horas',
  'workbench.serverAdmin.audit.rangeLast7Days': 'Últimos 7 días',
  'workbench.serverAdmin.audit.rangeLast30Days': 'Últimos 30 días',
  'workbench.serverAdmin.audit.colTime': 'Hora',
  'workbench.serverAdmin.audit.colEvent': 'Evento',
  'workbench.serverAdmin.audit.colCapability': 'Capacidad',
  'workbench.serverAdmin.audit.colWorkspace': 'Espacio de trabajo',
  'workbench.serverAdmin.audit.colActor': 'Actor',
  'workbench.serverAdmin.audit.eventAdmission': 'Admisión',
  'workbench.serverAdmin.audit.eventAdmissionRefused': 'Admisión rechazada',
  'workbench.serverAdmin.audit.eventSsoGrant': 'Concesión SSO',
  'workbench.serverAdmin.audit.eventSsoRevoke': 'Revocación SSO',
  'workbench.serverAdmin.audit.eventAllow': 'Permitido',
  'workbench.serverAdmin.audit.eventDeny': 'Denegado',
  'workbench.serverAdmin.audit.filterActor': 'Actor',
  'workbench.serverAdmin.audit.filterCapability': 'Capacidad',
  'workbench.serverAdmin.audit.filterDecision': 'Decisión',
  'workbench.serverAdmin.audit.filterWorkspace': 'Espacio de trabajo',
  'workbench.serverAdmin.audit.filterAnyTime': 'Cualquier momento',
  'workbench.serverAdmin.audit.decisionAllow': 'Permitido',
  'workbench.serverAdmin.audit.decisionDeny': 'Denegado',
  'workbench.serverAdmin.audit.refresh': 'Actualizar',
  'workbench.serverAdmin.audit.exportJsonl': 'Exportar JSONL',
  'workbench.serverAdmin.audit.emptyText': 'Ninguna fila de auditoría coincide.',
  'workbench.serverAdmin.audit.loadMore': 'Cargar más',
} as const satisfies Catalog;
