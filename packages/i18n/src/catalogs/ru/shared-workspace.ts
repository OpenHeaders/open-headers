/**
 * Workspace-org family — Russian. Mirrors `catalogs/en/shared-workspace.ts`
 * key for key; Org names, workspace names, backend labels, LAN/WAN and
 * the → glyph ride raw. `Org` rides raw (zh-CN / ja / ko precedent) and
 * is an indeclinable noun, f. by its Russian head организация (в этой
 * Org, этой Org по умолчанию) — no case ending ever touches it; the
 * `via {label}` annotations read `через {label}`. Mints: через = via; повторное сопряжение =
 * re-pair; локальные копии = local copies; локальная сеть (LAN) /
 * интернет (WAN) with the acronym parenthesized; АКТИВНО = ACTIVE
 * (caps-for-caps); открывается = lands on; Резервное копирование и
 * синхронизация = Backup and Sync (the shared-components mint, quoted
 * verbatim by the settings files later).
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints (second-person home-Org sub-labels) ────────
  'shared.org.hint.browser': 'Этот браузер',
  'shared.org.hint.desktop': 'Этот компьютер',
  'shared.org.hint.serverLocal': 'Локальный сервер',
  'shared.org.hint.serverRemote': 'Удалённый сервер',

  // ── Org places — what a joined Org's group header reads as ─────────
  'shared.org.place.desktopApp': 'Этот компьютер · настольное приложение',
  'shared.org.place.desktopAppNamed': '{name} · настольное приложение',
  'shared.org.place.server': '{name} · сервер',

  // ── Org sync-provenance annotations ("via <backend>") ──────────────
  'shared.org.sync.removed': 'больше не синхронизируется',
  'shared.org.sync.off': 'через {label} — выключено, не синхронизируется',
  'shared.org.sync.connecting': 'через {label} — подключение…',
  'shared.org.sync.synced': 'через {label}',
  'shared.org.sync.repair': 'через {label} — требуется повторное сопряжение',
  'shared.org.sync.disconnected': 'через {label} — нет соединения',
  'shared.org.sync.orphaned': 'соединение удалено — локальные копии',

  // ── Org states beside a place (the switcher headers name the place) ─
  'shared.org.state.off': 'выключено, не синхронизируется',
  'shared.org.state.repair': 'требуется повторное сопряжение',
  'shared.org.state.disconnected': 'нет соединения',

  // ── Org scope descriptions (WorkspaceOrgBadge tooltip) ─────────────
  'shared.org.scope.local.browser': 'Остаётся на этом устройстве, внутри этого браузера. Никуда не синхронизируется.',
  'shared.org.scope.local.desktopClient':
    'Остаётся на этом устройстве, внутри настольного приложения. Никуда не синхронизируется.',
  'shared.org.scope.local.desktopLan': 'Остаётся на ваших устройствах. Синхронизируется по локальной сети (LAN).',
  'shared.org.scope.local.desktopLoopback':
    'Остаётся на этом устройстве — синхронизируется между настольным приложением и подключёнными браузерами.',
  'shared.org.scope.local.serverLan': 'Общее на этом сервере. Синхронизируется по локальной сети (LAN).',
  'shared.org.scope.local.serverWan': 'Общее на этом сервере. Синхронизируется через интернет (WAN).',
  'shared.org.scope.local.serverLoopback': 'Находится на этом сервере — подключиться может только эта машина.',
  'shared.org.scope.local.generic': 'Остаётся на этом устройстве.',
  'shared.org.scope.personal.desktop':
    'Остаётся на этом устройстве — синхронизируется между этим браузером и настольным приложением.',
  'shared.org.scope.personal.serverWan': 'Синхронизируется с вашим сервером через интернет (WAN).',
  'shared.org.scope.personal.serverLan': 'Синхронизируется с вашим сервером по локальной сети (LAN).',
  'shared.org.scope.personal.generic': 'Синхронизируется между вашими устройствами.',
  'shared.org.scope.team.wan': 'Общее для команды через интернет (WAN).',
  'shared.org.scope.team.lan': 'Общее для команды по локальной сети (LAN).',
  'shared.org.scope.team.generic': 'Общее для всех участников этой команды.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': 'Поиск рабочих пространств…',
  'shared.workspaceDropdown.noMatch': 'Нет рабочих пространств, соответствующих запросу.',
  'shared.workspaceDropdown.empty': 'Рабочих пространств пока нет.',
  'shared.workspaceDropdown.activeTag': 'АКТИВНО',
  'shared.workspaceDropdown.activePopoverTitle': 'Активное рабочее пространство',
  'shared.workspaceDropdown.activePopoverBody':
    'Движок правил внедряет HTTP-правила этого рабочего пространства для изменения живого трафика. В каждом ' +
    'браузере одновременно может быть активно только одно рабочее пространство.',
  'shared.workspaceDropdown.setActiveTooltip': 'Сделать активным',
  'shared.workspaceDropdown.checkActiveTooltip': 'Активное рабочее пространство',
  'shared.workspaceDropdown.makeActiveAria': 'Сделать «{name}» активным рабочим пространством',
  'shared.workspaceDropdown.orphanedOrgHeader': 'Больше не синхронизируется',
  'shared.workspaceDropdown.noAccessRow': 'Нет рабочих пространств — доступ не предоставлен',
  'shared.workspaceDropdown.openPlace': 'Открыть {place}',
  'shared.workspaceDropdown.activeFooterLabel': 'Активно:',
  'shared.workspaceDropdown.export': 'Экспорт',
  'shared.workspaceDropdown.import': 'Импорт',
  'shared.workspaceDropdown.manage': 'Управление рабочими пространствами',

  // ── The one entry row into Backup and Sync (the plan D2) ────────────
  'shared.workspaceDropdown.backupAndSync': 'Резервное копирование и синхронизация…',

  // ── Org-switch header (inline landing annotation + why-tooltip) ─────
  'shared.workspaceDropdown.orgSwitch.aria': 'Переключиться на {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Переключиться на {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    'Откроется «{name}» — это рабочее пространство, которое вы последним использовали в этой Org.',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    'Откроется «{name}» — это рабочее пространство этой Org по умолчанию.',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst': 'Откроется «{name}» — это первое рабочее пространство этой Org.',
} as const satisfies Catalog;
