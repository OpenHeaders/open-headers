/**
 * Workspace-org family — Spanish. Mirrors `catalogs/en/shared-workspace.ts`
 * key for key; Org names (esta Org, f.), workspace names, backend
 * labels/URLs, LAN/WAN and the → glyph stay raw. Mints: via = vía;
 * multi-* titles close up (Multinavegador / Multidispositivo /
 * Multiusuario); "Lands on" = Te lleva a.
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'Este navegador',
  'shared.org.hint.desktop': 'Este dispositivo',
  'shared.org.hint.serverLocal': 'Servidor local',
  'shared.org.hint.serverRemote': 'Servidor remoto',
  'shared.org.fullLabel': '{hint}: {name}',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': 'ya no se sincroniza',
  'shared.org.sync.off': 'vía {label} — desactivado, sin sincronizar',
  'shared.org.sync.connecting': 'vía {label} — conectando…',
  'shared.org.sync.synced': 'vía {label}',
  'shared.org.sync.repair': 'vía {label} — hay que volver a emparejar',
  'shared.org.sync.disconnected': 'vía {label} — desconectado',
  'shared.org.sync.orphaned': 'back-end eliminado — copias locales',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser':
    'Se queda en este dispositivo, dentro de este navegador. Nunca se sincroniza a ninguna parte.',
  'shared.org.scope.local.desktopClient':
    'Se queda en este dispositivo, dentro de la aplicación de escritorio. Nunca se sincroniza a ninguna parte.',
  'shared.org.scope.local.desktopLan': 'Se queda en tus dispositivos. Se sincroniza por la red local (LAN).',
  'shared.org.scope.local.desktopLoopback':
    'Se queda en este dispositivo — se sincroniza entre la aplicación de escritorio y los navegadores conectados.',
  'shared.org.scope.local.serverLan': 'Compartido en este servidor. Se sincroniza por la red local (LAN).',
  'shared.org.scope.local.serverWan': 'Compartido en este servidor. Se sincroniza por internet (WAN).',
  'shared.org.scope.local.serverLoopback': 'Vive en este servidor — solo esta máquina puede conectarse.',
  'shared.org.scope.local.generic': 'Se queda en este dispositivo.',
  'shared.org.scope.personal.desktop':
    'Se queda en este dispositivo — se sincroniza entre este navegador y la aplicación de escritorio.',
  'shared.org.scope.personal.serverWan': 'Se sincroniza con tu servidor por internet (WAN).',
  'shared.org.scope.personal.serverLan': 'Se sincroniza con tu servidor por la red local (LAN).',
  'shared.org.scope.personal.generic': 'Se sincroniza entre tus dispositivos.',
  'shared.org.scope.team.wan': 'Compartido con el equipo por internet (WAN).',
  'shared.org.scope.team.lan': 'Compartido con el equipo por la red local (LAN).',
  'shared.org.scope.team.generic': 'Compartido con todos los miembros de este equipo.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'Buscar espacios de trabajo…',
  'shared.workspaceDropdown.noMatch': 'Ningún espacio de trabajo coincide con tu búsqueda.',
  'shared.workspaceDropdown.empty': 'Aún no hay espacios de trabajo.',
  'shared.workspaceDropdown.activeTag': 'ACTIVO',
  'shared.workspaceDropdown.activePopoverTitle': 'Espacio de trabajo activo',
  'shared.workspaceDropdown.activePopoverBody':
    'El motor de reglas inyecta las reglas http de este espacio de trabajo para modificar el tráfico en vivo. ' +
    'Solo un espacio de trabajo puede estar activo a la vez, por navegador.',
  'shared.workspaceDropdown.setActiveTooltip': 'Definir como activo',
  'shared.workspaceDropdown.checkActiveTooltip': 'Espacio de trabajo activo',
  'shared.workspaceDropdown.makeActiveAria': 'Convertir «{name}» en el espacio de trabajo activo',
  'shared.workspaceDropdown.orphanedOrgHeader': 'Ya no se sincroniza',
  'shared.workspaceDropdown.activeFooterLabel': 'Activo:',
  'shared.workspaceDropdown.export': 'Exportar',
  'shared.workspaceDropdown.import': 'Importar',
  'shared.workspaceDropdown.manage': 'Gestionar espacios de trabajo',

  // ── "Extend your reach" footer rows + popovers ──────────────────────
  'shared.workspaceDropdown.reach.multiBrowser': 'Sincronizar entre los navegadores de este dispositivo',
  'shared.workspaceDropdown.reach.multiBrowserTitle': 'Multinavegador',
  'shared.workspaceDropdown.reach.multiBrowserBody':
    'Instala la aplicación de escritorio — cada navegador de este dispositivo comparte entonces los mismos ' +
    'espacios de trabajo.',
  'shared.workspaceDropdown.reach.multiDevice': 'Sincronizar entre tus dispositivos',
  'shared.workspaceDropdown.reach.multiDeviceTitle': 'Multidispositivo',
  'shared.workspaceDropdown.reach.multiDeviceBody':
    'En la aplicación de escritorio, activa «Sincronizar con los dispositivos de tu red» para que tus ' +
    'dispositivos en la misma red compartan los espacios de trabajo.',
  'shared.workspaceDropdown.reach.multiUser': 'Sincronizar con tu equipo',
  'shared.workspaceDropdown.reach.multiUserTitle': 'Multiusuario',
  'shared.workspaceDropdown.reach.multiUserBody':
    'Conéctate a un servidor compartido — en tu red o por internet — para que todos los que estén en él ' +
    'trabajen en los mismos espacios de trabajo.',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': 'Cambiar a {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Cambiar a {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    'Te lleva a «{name}» porque es el último espacio de trabajo que usaste en esta Org.',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    'Te lleva a «{name}» porque es el espacio de trabajo por defecto de esta Org.',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst':
    'Te lleva a «{name}» porque es el primer espacio de trabajo de esta Org.',
} as const satisfies Catalog;
