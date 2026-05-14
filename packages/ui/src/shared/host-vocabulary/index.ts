/**
 * host-vocabulary — adapter for user-facing strings whose unit depends on
 * the host platform.
 *
 * Code identifiers are canonical (`per-window-or-tab`, `editingScopeWorkspaceId`).
 * User-facing labels MUST adapt: a Chrome user thinks "tab", a desktop user
 * thinks "window". This module is the single seam — every string the user
 * reads in the workspace-switch-scope context routes through these helpers.
 *
 * Lives in `@openheaders/ui` so every host's UI bundle shares one
 * vocabulary. The host this bundle runs in is supplied at boot via
 * {@link setCurrentHost} — mirrors the `setHostLogger` / `setHostStorage`
 * install seams. Defaults to `'extension'` (today's only host) so a host
 * that hasn't wired the seam still renders sensible copy.
 */

export type Host = 'extension' | 'web' | 'desktop';

interface HostVocabulary {
  /** Singular unit ("tab" / "window") for inline copy. */
  instanceLabel: string;
  /** Plural unit ("tabs" / "windows"). */
  instanceLabelPlural: string;
}

const HOST_VOCABULARY: Record<Host, HostVocabulary> = {
  extension: { instanceLabel: 'tab', instanceLabelPlural: 'tabs' },
  web: { instanceLabel: 'tab', instanceLabelPlural: 'tabs' },
  desktop: { instanceLabel: 'window', instanceLabelPlural: 'windows' },
};

let currentHost: Host = 'extension';

/** Install the running host. Called once per entry point at boot. */
export function setCurrentHost(host: Host): void {
  currentHost = host;
}

/** The host this UI bundle is running in. */
export function getCurrentHost(): Host {
  return currentHost;
}

export function instanceLabel(host: Host = currentHost): string {
  return HOST_VOCABULARY[host].instanceLabel;
}

export function instanceLabelPlural(host: Host = currentHost): string {
  return HOST_VOCABULARY[host].instanceLabelPlural;
}

/**
 * Title-cased singular unit — for setting labels and pill prefixes.
 * Example: "Per tab" / "Per window".
 */
export function instanceLabelTitleCase(host: Host = currentHost): string {
  const label = instanceLabel(host);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
