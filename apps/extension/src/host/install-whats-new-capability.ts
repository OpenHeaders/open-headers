/**
 * Release notes bundled at build time from the running version's
 * canonical changelog entry (`changelog/extension/<year>/<version>.md`,
 * frontmatter stripped by the config's whats-new-entry plugin — never
 * fetched at runtime). Backs the workbench What's New tab and the
 * in-surface modal behind the timeline's "See what's new"; a version
 * without an entry reports null and the affordances stay hidden.
 */

import whatsNewNotes from 'virtual:whats-new';
import { registerCapability } from '@openheaders/core/capabilities';

registerCapability('getWhatsNew', () => (whatsNewNotes.length > 0 ? whatsNewNotes : null));
