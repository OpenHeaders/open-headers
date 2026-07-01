import type { Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import type { BackendIconKey } from './backend-icons';

export interface ScenarioDescriptor {
  mode: BackendMode;
  /** Matches the back-end-tier glyph key. */
  icon: BackendIconKey;
  title: string;
  /**
   * Hosts where this scenario is selectable. The browser extension can
   * be any of the four; the desktop app can't run `in-browser` (no SW
   * for workspace data); a web bundle is always a client of something
   * (desktop on localhost, daemon on LAN, or your VM).
   */
  validHosts: readonly Host[];
}

export const SCENARIOS: readonly ScenarioDescriptor[] = [
  {
    mode: 'in-browser',
    icon: 'browser',
    title: 'Browser Extension',
    validHosts: ['extension'],
  },
  {
    mode: 'desktop-app',
    icon: 'desktop',
    title: 'Desktop Application',
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'local-self-hosted',
    icon: 'daemon',
    title: 'Local / LAN',
    validHosts: ['extension', 'desktop', 'web'],
  },
  {
    mode: 'remote-self-hosted',
    icon: 'vm',
    title: 'Remote / WAN',
    validHosts: ['extension', 'desktop', 'web'],
  },
];

export function firstValidMode(host: Host): BackendMode {
  return (SCENARIOS.find((s) => s.validHosts.includes(host))?.mode ?? SCENARIOS[0].mode) as BackendMode;
}

export function isModeValidForHost(mode: BackendMode, host: Host): boolean {
  return SCENARIOS.find((s) => s.mode === mode)?.validHosts.includes(host) ?? false;
}
