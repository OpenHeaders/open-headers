/**
 * org-copy — render-side wording for the Org identity plane. Core
 * classifies (`orgHostHintKind`, `providingBackendKind`); these
 * resolvers translate each classification, so the second-person
 * host-kind hint and the place an Org reads as render in the viewer's
 * locale with the raw names riding inside the keyed values.
 */

import type { OrgDescriptor, OrgHostHintKind } from '@openheaders/core/identity';
import { orgHostHintKind } from '@openheaders/core/identity';
import type { BackendReach } from '@openheaders/core/protocol';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { BackendPlace } from '../backend/backend-place';

const HINT_KEYS: Record<OrgHostHintKind, MessageKey> = {
  browser: 'shared.org.hint.browser',
  desktop: 'shared.org.hint.desktop',
  'daemon-local': 'shared.org.hint.serverLocal',
  'daemon-remote': 'shared.org.hint.serverRemote',
};

/** Second-person host-kind hint for the home Org — `null` for a joined Org. */
export function orgHostHintText(t: Translate, descriptor: OrgDescriptor, reach?: BackendReach | null): string | null {
  const kind = orgHostHintKind(descriptor, reach);
  return kind ? t(HINT_KEYS[kind]) : null;
}

/**
 * The place an Org reads as (the Backup and Sync UX plan D3): the home
 * Org by its hint alone — "This browser", "This computer" — and a
 * joined Org by its providing backend's place — "This computer ·
 * desktop app", "<label> · desktop app", "<name> · server". `place` is
 * the joined Org's (`backendPlace`); the home Org ignores it, and a
 * joined Org without one reads by its stored name.
 */
export function orgPlaceText(
  t: Translate,
  descriptor: OrgDescriptor,
  reach: BackendReach | null,
  place: BackendPlace | null,
): string {
  const hint = orgHostHintText(t, descriptor, reach);
  if (hint) return hint;
  if (!place) return descriptor.name;
  if (place.kind === 'desktop-app') {
    return place.name ? t('shared.org.place.desktopAppNamed', { name: place.name }) : t('shared.org.place.desktopApp');
  }
  return t('shared.org.place.server', { name: place.name ?? descriptor.name });
}
