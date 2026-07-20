/**
 * Desktop-feature vocabulary for the teaser surfaces.
 *
 * A `DesktopFeature` names a capability-gated feature that only the
 * desktop app can run. Registries that want a gated entry to stay
 * visible on browser hosts (dock tool windows, settings categories)
 * declare `teaserWhenUnavailable: <feature>` — the surface then renders
 * {@link DesktopTeaser} for that feature instead of dropping the entry,
 * so browser users discover what the desktop app adds.
 *
 * The copy map lives here (not in the component) so registries can
 * reference features as plain data without pulling component code.
 */

import type { MessageKey } from '@openheaders/i18n';

export type DesktopFeature = 'terminal' | 'git' | 'proxy' | 'mcp';

export interface DesktopTeaserCopy {
  title: MessageKey;
  body: MessageKey;
}

export const DESKTOP_TEASER_COPY: Record<DesktopFeature, DesktopTeaserCopy> = {
  terminal: {
    title: 'shared.desktopTeaser.terminal.title',
    body: 'shared.desktopTeaser.terminal.body',
  },
  git: {
    title: 'shared.desktopTeaser.git.title',
    body: 'shared.desktopTeaser.git.body',
  },
  proxy: {
    title: 'shared.desktopTeaser.proxy.title',
    body: 'shared.desktopTeaser.proxy.body',
  },
  mcp: {
    title: 'shared.desktopTeaser.mcp.title',
    body: 'shared.desktopTeaser.mcp.body',
  },
};
