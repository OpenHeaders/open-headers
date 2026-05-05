/**
 * host-vocabulary — adapter for user-facing strings whose unit depends on
 * the host platform.
 *
 * Code identifiers are canonical (`per-window-or-tab`, `editingScopeWorkspaceId`).
 * User-facing labels MUST adapt: a Chrome user thinks "tab", a desktop user
 * thinks "window". This module is the single seam — every string the user
 * reads in the workspace-switch-scope context routes through these helpers.
 *
 * The web app and desktop app reuse this module's shape; the eventual
 * cross-app extraction lives in `packages/core` once those hosts ship.
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

/**
 * The host this build runs in. Currently fixed to `'extension'` because
 * this module lives in the extension app; when the desktop / web app
 * adopt it, this becomes a build-time constant or a runtime probe.
 */
export const CURRENT_HOST: Host = 'extension';

export function instanceLabel(host: Host = CURRENT_HOST): string {
  return HOST_VOCABULARY[host].instanceLabel;
}

export function instanceLabelPlural(host: Host = CURRENT_HOST): string {
  return HOST_VOCABULARY[host].instanceLabelPlural;
}

/**
 * Title-cased singular unit — for setting labels and pill prefixes.
 * Example: "Per tab" / "Per window".
 */
export function instanceLabelTitleCase(host: Host = CURRENT_HOST): string {
  const label = instanceLabel(host);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
