/**
 * Daemon-admin family — Spanish. Mirrors
 * `catalogs/en/workbench-daemon-admin.ts` key for key. Raw by design
 * inside keyed sentences: capability ids (`daemon.admin`),
 * admission-status enum values and audit `reason` strings ({status} /
 * {reason} holes carry server data), license ids ({id}), the
 * `oh-license.` key prefix and `openheaders.io/pricing` URL, `IdP` /
 * `SSO` / `JSONL` vocabulary, and `daemon` as the product loanword
 * (m., web.ts precedent). Seat vocabulary (`plaza individual`, the
 * `oh-license.…` placeholder) reuses `web.ts` verbatim. Mints: pool =
 * reserva; solo/team tier = nivel solo / nivel de equipo.
 */

import type { Catalog } from '../../types';

export const workbenchDaemonAdmin = {
  // ── Console shell ──────────────────────────────────────────────────
  'workbench.daemonAdmin.title': 'Administración del Team Server',
  'workbench.daemonAdmin.intro':
    'Los usuarios del directorio inician sesión con un token vinculado o por SSO y ven exactamente los ' +
    'espacios de trabajo concedidos aquí. La desactivación revoca los tokens del usuario y lo desconecta de ' +
    'inmediato.',
  'workbench.daemonAdmin.deniedDescription': 'Administrar este Team Server requiere la capacidad daemon.admin.',
  'workbench.daemonAdmin.cancel': 'Cancelar',

  // ── Users section ──────────────────────────────────────────────────
  'workbench.daemonAdmin.users.sectionTitle': 'Usuarios',
  'workbench.daemonAdmin.users.sectionHint':
    'Admite un usuario y luego concédele roles por espacio de trabajo abajo. El email une los inicios de ' +
    'sesión SSO a la ficha.',
  'workbench.daemonAdmin.users.nameRequired': 'El nombre es obligatorio',
  'workbench.daemonAdmin.users.displayNamePlaceholder': 'Nombre para mostrar',
  'workbench.daemonAdmin.users.emailPlaceholder': 'Email (opcional — obligatorio para SSO)',
  'workbench.daemonAdmin.users.seatKeyPlaceholder': 'Clave de plaza individual (oh-license.…)',
  'workbench.daemonAdmin.users.addUser': 'Añadir usuario',
  'workbench.daemonAdmin.users.seatLimit':
    'Este Team Server está en su límite de plazas. Añade plazas a tu licencia de equipo, o pega arriba la clave de ' +
    'plaza individual del usuario que se incorpora — lo admite sin consumir una plaza de la reserva.',
  'workbench.daemonAdmin.users.seatsSoldAt': 'Las plazas individuales se venden en',
  'workbench.daemonAdmin.users.emptyDirectory':
    'Aún no hay usuarios en el directorio — el Team Server funciona en su nivel solo. Añade un usuario para abrir ' +
    'el nivel de equipo.',
  'workbench.daemonAdmin.users.deactivatedOn': 'Desactivado el {date}',
  'workbench.daemonAdmin.users.addedOn': 'añadido el {date}',
  'workbench.daemonAdmin.users.loadFailed': 'No se pudo cargar el directorio de usuarios: {message}',
  'workbench.daemonAdmin.users.addFailed': 'No se pudo añadir el usuario: {message}',

  // ── Personal-seat admission tag ────────────────────────────────────
  'workbench.daemonAdmin.seat.tag': 'Plaza individual',
  'workbench.daemonAdmin.seat.healthyTooltip':
    'Admitido por su propia plaza individual ({id}) — no cuenta contra la reserva de este Team Server.',
  'workbench.daemonAdmin.seat.lapsedTooltip':
    'Su plaza individual ({id}) está {status}. Sigue con la sesión iniciada — un vencimiento nunca expulsa — ' +
    'pero la plaza ya no se renueva.',
  'workbench.daemonAdmin.seat.absorbTitle': '¿Absorber esta plaza en la reserva?',
  'workbench.daemonAdmin.seat.absorbDescription':
    'El usuario pasa a ser una plaza normal de la reserva y su licencia individual deja de renovarse aquí. ' +
    'Esto no se puede deshacer.',
  'workbench.daemonAdmin.seat.absorbOk': 'Absorber',
  'workbench.daemonAdmin.seat.absorbCta': 'Absorber en la reserva',
  'workbench.daemonAdmin.seat.absorbed': 'Plaza absorbida en la reserva.',
  'workbench.daemonAdmin.seat.absorbFailed': 'No se pudo absorber la plaza: {message}',

  // ── Deactivation ───────────────────────────────────────────────────
  'workbench.daemonAdmin.deactivate.title': '¿Desactivar este usuario?',
  'workbench.daemonAdmin.deactivate.description':
    'Sus tokens quedan revocados y sus conexiones activas cerradas. Readmítelo más tarde añadiendo de nuevo ' +
    'el mismo email.',
  'workbench.daemonAdmin.deactivate.cta': 'Desactivar',
  'workbench.daemonAdmin.deactivate.done':
    'Usuario desactivado. Sus tokens fueron revocados y sus conexiones activas cerradas.',
  'workbench.daemonAdmin.deactivate.failed': 'No se pudo desactivar: {message}',

  // ── Grants editor ──────────────────────────────────────────────────
  'workbench.daemonAdmin.grants.roleViewer': 'Lector',
  'workbench.daemonAdmin.grants.roleEditor': 'Editor',
  'workbench.daemonAdmin.grants.roleOwner': 'Propietario',
  'workbench.daemonAdmin.grants.none': 'Aún sin acceso a ningún espacio de trabajo.',
  'workbench.daemonAdmin.grants.idpTooltip':
    'Concedido por el mapeo del proveedor de identidad. La revocación solo se mantiene hasta su siguiente ' +
    'inicio de sesión SSO, que lo vuelve a aplicar.',
  'workbench.daemonAdmin.grants.workspacePlaceholder': 'Espacio de trabajo',
  'workbench.daemonAdmin.grants.grantCta': 'Conceder',
  'workbench.daemonAdmin.grants.everyWorkspace': 'Concedido en todos los espacios de trabajo.',
  'workbench.daemonAdmin.grants.grantFailed': 'No se pudo conceder: {message}',
  'workbench.daemonAdmin.grants.revokeFailed': 'No se pudo revocar la concesión: {message}',

  // ── Password modal ─────────────────────────────────────────────────
  'workbench.daemonAdmin.password.setTitle': 'Definir contraseña — {name}',
  'workbench.daemonAdmin.password.resetTitle': 'Restablecer contraseña — {name}',
  'workbench.daemonAdmin.password.explainer':
    'El usuario inicia sesión con su email y esta contraseña en el portal web del Team Server. Compártela ' +
    'directamente con esa persona — está guardada con hash en el Team Server y no se puede volver a leer.',
  'workbench.daemonAdmin.password.placeholder': 'Nueva contraseña (mínimo 8 caracteres)',
  'workbench.daemonAdmin.password.setCta': 'Definir contraseña',
  'workbench.daemonAdmin.password.resetCta': 'Restablecer contraseña',
  'workbench.daemonAdmin.password.removeCta': 'Quitar contraseña',
  'workbench.daemonAdmin.password.setDone': 'Contraseña definida.',
  'workbench.daemonAdmin.password.removedDone': 'Contraseña eliminada.',
  'workbench.daemonAdmin.password.updateFailed': 'No se pudo actualizar la contraseña: {message}',

  // ── Git email modal ────────────────────────────────────────────────
  'workbench.daemonAdmin.gitEmail.setTitle': 'Definir el email de Git — {name}',
  'workbench.daemonAdmin.gitEmail.changeTitle': 'Cambiar el email de Git — {name}',
  'workbench.daemonAdmin.gitEmail.explainer':
    'Los commits que llevan el trabajo de este usuario se firman con esta dirección, así que enlazan con su ' +
    'perfil del alojamiento Git. Sin una, se usa el email del directorio y luego una dirección noreply.',
  'workbench.daemonAdmin.gitEmail.placeholder': 'email del autor de los commits',
  'workbench.daemonAdmin.gitEmail.setCta': 'Definir el email de Git',
  'workbench.daemonAdmin.gitEmail.changeCta': 'Cambiar el email de Git',
  'workbench.daemonAdmin.gitEmail.removeCta': 'Quitar la invalidación',
  'workbench.daemonAdmin.gitEmail.setDone': 'Email de Git definido.',
  'workbench.daemonAdmin.gitEmail.removedDone': 'Invalidación del email de Git eliminada.',
  'workbench.daemonAdmin.gitEmail.updateFailed': 'No se pudo actualizar el email de Git: {message}',

  // ── Git section ────────────────────────────────────────────────────
  'workbench.daemonAdmin.git.sectionTitle': 'Git',
  'workbench.daemonAdmin.git.sectionHint':
    'Vincula un espacio de trabajo del Team Server a un repositorio y dirige commit, pull, push y ramas en remoto. ' +
    'Las rutas están en el sistema de archivos del propio Team Server.',
  'workbench.daemonAdmin.git.workspaceLabel': 'Espacio de trabajo',

  // ── Audit reports ──────────────────────────────────────────────────
  'workbench.daemonAdmin.audit.sectionTitle': 'Informes',
  'workbench.daemonAdmin.audit.sectionHint':
    'Cada decisión de permisos que toma este Team Server, y cada admisión de dispositivo, como un registro de ' +
    'auditoría filtrable. La exportación respeta los filtros activos.',
  'workbench.daemonAdmin.audit.capAdmission': 'Admisión (conexión)',
  'workbench.daemonAdmin.audit.capAdminPlane': 'Plano de administración',
  'workbench.daemonAdmin.audit.capSsoGrant': 'Concesión SSO (mapeo)',
  'workbench.daemonAdmin.audit.capSsoRevoke': 'Revocación SSO (mapeo)',
  'workbench.daemonAdmin.audit.capWorkspaceRead': 'Lectura de espacio de trabajo',
  'workbench.daemonAdmin.audit.capWorkspaceWrite': 'Escritura de espacio de trabajo',
  'workbench.daemonAdmin.audit.capWorkspaceList': 'Lista de espacios de trabajo',
  'workbench.daemonAdmin.audit.rangeLastHour': 'Última hora',
  'workbench.daemonAdmin.audit.rangeLast24Hours': 'Últimas 24 horas',
  'workbench.daemonAdmin.audit.rangeLast7Days': 'Últimos 7 días',
  'workbench.daemonAdmin.audit.rangeLast30Days': 'Últimos 30 días',
  'workbench.daemonAdmin.audit.colTime': 'Hora',
  'workbench.daemonAdmin.audit.colEvent': 'Evento',
  'workbench.daemonAdmin.audit.colCapability': 'Capacidad',
  'workbench.daemonAdmin.audit.colWorkspace': 'Espacio de trabajo',
  'workbench.daemonAdmin.audit.colActor': 'Actor',
  'workbench.daemonAdmin.audit.eventAdmission': 'Admisión',
  'workbench.daemonAdmin.audit.eventAdmissionRefused': 'Admisión rechazada',
  'workbench.daemonAdmin.audit.eventSsoGrant': 'Concesión SSO',
  'workbench.daemonAdmin.audit.eventSsoRevoke': 'Revocación SSO',
  'workbench.daemonAdmin.audit.eventAllow': 'Permitido',
  'workbench.daemonAdmin.audit.eventDeny': 'Denegado',
  'workbench.daemonAdmin.audit.filterActor': 'Actor',
  'workbench.daemonAdmin.audit.filterCapability': 'Capacidad',
  'workbench.daemonAdmin.audit.filterDecision': 'Decisión',
  'workbench.daemonAdmin.audit.filterWorkspace': 'Espacio de trabajo',
  'workbench.daemonAdmin.audit.filterAnyTime': 'Cualquier momento',
  'workbench.daemonAdmin.audit.decisionAllow': 'Permitido',
  'workbench.daemonAdmin.audit.decisionDeny': 'Denegado',
  'workbench.daemonAdmin.audit.refresh': 'Actualizar',
  'workbench.daemonAdmin.audit.exportJsonl': 'Exportar JSONL',
  'workbench.daemonAdmin.audit.emptyText': 'Ninguna fila de auditoría coincide.',
  'workbench.daemonAdmin.audit.loadMore': 'Cargar más',
} as const satisfies Catalog;
