/**
 * org-copy — render-side wording for the Org identity plane. Core
 * classifies (`orgHostHintKind`); these resolvers translate each
 * classification, so the second-person host-kind hint and the full
 * "hint: name" label render in the viewer's locale with the raw Org
 * name riding inside the keyed value.
 */

import type { OrgDescriptor, OrgHostHintKind } from '@openheaders/core/identity';
import { orgHostHintKind } from '@openheaders/core/identity';
import type { BackendReach } from '@openheaders/core/protocol';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

const HINT_KEYS: Record<OrgHostHintKind, MessageKey> = {
  browser: 'shared.org.hint.browser',
  desktop: 'shared.org.hint.desktop',
  'daemon-local': 'shared.org.hint.daemonLocal',
  'daemon-remote': 'shared.org.hint.daemonRemote',
};

/** Second-person host-kind hint for the home Org — `null` for a joined Org. */
export function orgHostHintText(t: Translate, descriptor: OrgDescriptor, reach?: BackendReach | null): string | null {
  const kind = orgHostHintKind(descriptor, reach);
  return kind ? t(HINT_KEYS[kind]) : null;
}

/**
 * Full single-line Org label — "This browser: Chrome", "This device:
 * my-mac". Joined Orgs (no hint) fall through to the stored name.
 */
export function orgFullLabelText(t: Translate, descriptor: OrgDescriptor, reach?: BackendReach | null): string {
  const hint = orgHostHintText(t, descriptor, reach);
  return hint ? t('shared.org.fullLabel', { hint, name: descriptor.name }) : descriptor.name;
}
