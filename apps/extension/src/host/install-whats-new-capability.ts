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
import { createWhatsNewHistoryApi } from './whats-new-history';

registerCapability('getWhatsNew', () => (whatsNewNotes.length > 0 ? whatsNewNotes : null));

// Online release history for the What's New tab's "Previous releases"
// section — direct enhancement-only fetches of the feed's extension
// stream (host permissions exempt extension pages from the feed's
// CORS scoping). Null answers hide the section.
const whatsNewHistoryApi = createWhatsNewHistoryApi();
registerCapability('whatsNewHistory', () => whatsNewHistoryApi);
