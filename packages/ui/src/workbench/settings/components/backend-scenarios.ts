/**
 * Scenario descriptors for the add/edit wizard's first step — what kind
 * of back-end is being joined. Tier zero (`in-browser` on the extension,
 * the embedded engine on desktop) is never a scenario here: it is always
 * on and never a connections-list entry, so only the three joinable
 * kinds appear. The two daemon tiers stay preview-only ("Soon") until
 * the standalone daemon ships — their tiles render the tier diagrams but
 * can't proceed.
 */

import type { Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import type { BackendIconKey } from './backend-icons';

export interface ScenarioDescriptor {
  mode: BackendMode;
  /** Matches the back-end-tier glyph key. */
  icon: BackendIconKey;
  title: string;
  /** One-line hint under the tile title. */
  hint: string;
  /** Preview-only — the tier isn't joinable yet. */
  soon: boolean;
  /** Hosts where this scenario is selectable. */
  validHosts: readonly Host[];
}

export const ADD_SCENARIOS: readonly ScenarioDescriptor[] = [
  {
    mode: 'desktop-app',
    icon: 'desktop',
    title: 'Desktop Application',
    hint: 'The Open Headers app on this machine',
    soon: false,
    validHosts: ['extension', 'web'],
  },
  {
    mode: 'local-self-hosted',
    icon: 'daemon',
    title: 'Local / LAN',
    hint: 'A server on this machine or your network',
    soon: true,
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'remote-self-hosted',
    icon: 'vm',
    title: 'Remote / WAN',
    hint: 'A server you self-host on your own VM',
    soon: true,
    validHosts: ['extension', 'desktop', 'web'],
  },
];

/** Scenarios selectable on this host, in display order. */
export function scenariosForHost(host: Host): readonly ScenarioDescriptor[] {
  return ADD_SCENARIOS.filter((s) => s.validHosts.includes(host));
}
