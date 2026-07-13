/**
 * Scenario descriptors for the add/edit wizard's first step — what kind
 * of back-end is being joined. Tier zero (`in-browser` on the extension,
 * the embedded engine on desktop) is never a scenario here: it is always
 * on and never a connections-list entry, so only the three joinable
 * kinds appear. All three are joinable — the standalone daemon serves
 * the Local / LAN and Remote / WAN tiers.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import type { BackendIconKey } from './backend-icons';

export interface ScenarioDescriptor {
  mode: BackendMode;
  /** Matches the back-end-tier glyph key. */
  icon: BackendIconKey;
  titleKey: MessageKey;
  /** One-line hint under the tile title. */
  hintKey: MessageKey;
  /** Preview-only — the tier isn't joinable yet. */
  soon: boolean;
  /** Hosts where this scenario is selectable. */
  validHosts: readonly Host[];
}

export const ADD_SCENARIOS: readonly ScenarioDescriptor[] = [
  {
    mode: 'desktop-app',
    icon: 'desktop',
    titleKey: 'workbench.settings.backendPane.scenario.desktop-app.title',
    hintKey: 'workbench.settings.backendPane.scenario.desktop-app.hint',
    soon: false,
    validHosts: ['extension', 'web'],
  },
  {
    mode: 'local-self-hosted',
    icon: 'daemon',
    titleKey: 'workbench.settings.backendPane.scenario.local-self-hosted.title',
    hintKey: 'workbench.settings.backendPane.scenario.local-self-hosted.hint',
    soon: false,
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'remote-self-hosted',
    icon: 'vm',
    titleKey: 'workbench.settings.backendPane.scenario.remote-self-hosted.title',
    hintKey: 'workbench.settings.backendPane.scenario.remote-self-hosted.hint',
    soon: false,
    validHosts: ['extension', 'desktop', 'web'],
  },
];

/** Scenarios selectable on this host, in display order. */
export function scenariosForHost(host: Host): readonly ScenarioDescriptor[] {
  return ADD_SCENARIOS.filter((s) => s.validHosts.includes(host));
}
