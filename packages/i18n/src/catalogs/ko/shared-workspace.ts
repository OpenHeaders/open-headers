/**
 * Workspace-org family — Korean. Mirrors `catalogs/en/shared-workspace.ts`
 * key for key; Org names, workspace names, backend labels, LAN/WAN and
 * the → glyph ride raw. `Org` rides raw (zh-CN / ja precedent) and
 * takes a head noun (Org 안에서, Org 목록의) rather than a particle;
 * the `via {label}` annotations read `{label} 경유`. Mints: 경유 = via;
 * 다시 페어링 = re-pair; 사본 = copies; 로컬 네트워크(LAN) / 인터넷(WAN)
 * with the acronym parenthesized; 활성 = ACTIVE (caps-for-caps plain
 * noun); 이동합니다 = lands on.
 */

import type { Catalog } from '../../types';

export const sharedWorkspace = {
  // ── Org host-kind hints ────────────────────────────────────────────
  'shared.org.hint.browser': '이 브라우저',
  'shared.org.hint.desktop': '이 컴퓨터',
  'shared.org.hint.serverLocal': '로컬 서버',
  'shared.org.hint.serverRemote': '원격 서버',

  // ── Org places ─────────────────────────────────────────────────────
  'shared.org.place.desktopApp': '이 컴퓨터 · 데스크톱 앱',
  'shared.org.place.desktopAppNamed': '{name} · 데스크톱 앱',
  'shared.org.place.server': '{name} · 서버',

  // ── Org sync-provenance annotations ────────────────────────────────
  'shared.org.sync.removed': '더 이상 동기화하지 않음',
  'shared.org.sync.off': '{label} 경유: 꺼짐, 동기화하지 않음',
  'shared.org.sync.connecting': '{label} 경유: 연결 중…',
  'shared.org.sync.synced': '{label} 경유',
  'shared.org.sync.repair': '{label} 경유: 다시 페어링 필요',
  'shared.org.sync.disconnected': '{label} 경유: 연결 끊김',
  'shared.org.sync.orphaned': '연결 제거됨: 로컬 사본',

  // ── Org states beside a place ──────────────────────────────────────
  'shared.org.state.off': '꺼짐, 동기화하지 않음',
  'shared.org.state.repair': '다시 페어링 필요',
  'shared.org.state.disconnected': '연결 끊김',

  // ── Org scope descriptions ─────────────────────────────────────────
  'shared.org.scope.local.browser': '이 기기의 이 브라우저 안에만 있습니다. 어디에도 동기화되지 않습니다.',
  'shared.org.scope.local.desktopClient': '이 기기의 데스크톱 앱 안에만 있습니다. 어디에도 동기화되지 않습니다.',
  'shared.org.scope.local.desktopLan': '내 기기들에만 있습니다. 로컬 네트워크(LAN)로 동기화됩니다.',
  'shared.org.scope.local.desktopLoopback':
    '이 기기에만 있습니다. 데스크톱 앱과 연결된 브라우저 사이에서 동기화됩니다.',
  'shared.org.scope.local.serverLan': '이 서버에서 공유됩니다. 로컬 네트워크(LAN)로 동기화됩니다.',
  'shared.org.scope.local.serverWan': '이 서버에서 공유됩니다. 인터넷(WAN)으로 동기화됩니다.',
  'shared.org.scope.local.serverLoopback': '이 서버에만 있습니다. 이 컴퓨터만 연결할 수 있습니다.',
  'shared.org.scope.local.generic': '이 기기에만 있습니다.',
  'shared.org.scope.personal.desktop': '이 기기에만 있습니다. 이 브라우저와 데스크톱 앱 사이에서 동기화됩니다.',
  'shared.org.scope.personal.serverWan': '인터넷(WAN)으로 내 서버와 동기화됩니다.',
  'shared.org.scope.personal.serverLan': '로컬 네트워크(LAN)로 내 서버와 동기화됩니다.',
  'shared.org.scope.personal.generic': '내 기기 간에 동기화됩니다.',
  'shared.org.scope.team.wan': '인터넷(WAN)으로 팀과 공유됩니다.',
  'shared.org.scope.team.lan': '로컬 네트워크(LAN)로 팀과 공유됩니다.',
  'shared.org.scope.team.generic': '이 팀의 모든 구성원과 공유됩니다.',

  // ── Workspace dropdown body ─────────────────────────────────────────
  'shared.workspaceDropdown.searchPlaceholder': '워크스페이스 검색…',
  'shared.workspaceDropdown.noMatch': '검색과 일치하는 워크스페이스가 없습니다.',
  'shared.workspaceDropdown.empty': '아직 워크스페이스가 없습니다.',
  'shared.workspaceDropdown.activeTag': '활성',
  'shared.workspaceDropdown.activePopoverTitle': '활성 워크스페이스',
  'shared.workspaceDropdown.activePopoverBody':
    '규칙 엔진이 이 워크스페이스의 http 규칙을 삽입해 실시간 트래픽을 변경하고 있습니다. 브라우저마다 한 번에 하나의 워크스페이스만 활성화할 수 있습니다.',
  'shared.workspaceDropdown.setActiveTooltip': '활성으로 설정',
  'shared.workspaceDropdown.checkActiveTooltip': '활성 워크스페이스',
  'shared.workspaceDropdown.makeActiveAria': '“{name}” 워크스페이스를 활성으로 설정',
  'shared.workspaceDropdown.orphanedOrgHeader': '더 이상 동기화하지 않음',
  'shared.workspaceDropdown.activeFooterLabel': '활성:',
  'shared.workspaceDropdown.export': '내보내기',
  'shared.workspaceDropdown.import': '가져오기',
  'shared.workspaceDropdown.manage': '워크스페이스 관리',

  // ── The one entry row into Backup and Sync ──────────────────────────
  'shared.workspaceDropdown.backupAndSync': '백업 및 동기화…',

  // ── Org-switch header ───────────────────────────────────────────────
  'shared.workspaceDropdown.orgSwitch.aria': 'Org 전환: {label}',
  'shared.workspaceDropdown.orgSwitch.ariaWithTarget': 'Org 전환: {label} → {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnInline': '→ {name}',
  'shared.workspaceDropdown.orgSwitch.landsOnLastUsed':
    '이 Org 안에서 마지막으로 사용한 워크스페이스이므로 “{name}” 워크스페이스로 이동합니다.',
  'shared.workspaceDropdown.orgSwitch.landsOnDefault':
    '이 Org 기본 워크스페이스이므로 “{name}” 워크스페이스로 이동합니다.',
  'shared.workspaceDropdown.orgSwitch.landsOnFirst':
    '이 Org 목록의 첫 번째 워크스페이스이므로 “{name}” 워크스페이스로 이동합니다.',
} as const satisfies Catalog;
