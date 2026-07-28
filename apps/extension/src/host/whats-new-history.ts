/**
 * Extension half of the What's New online history
 * (CHANGELOG_PLAN.md §4.3): enhancement-only static GETs against the
 * changelog feed's extension stream, fetched directly from the calling
 * surface — the manifest's host permissions exempt extension pages
 * from the feed's origin-scoped CORS. Strictly on demand (only the
 * What's New tab's history section calls it) and null on any failure,
 * including Firefox installs where the optional host permission was
 * declined: the section hides, the bundled current entry above never
 * depends on it.
 */

import type { WhatsNewHistoryApi } from '@openheaders/core/capabilities';
import {
  changelogEntryUrl,
  changelogStreamUrl,
  isChangelogVersion,
  parseChangelogEntryBody,
  parseChangelogIndexRows,
} from '@openheaders/core/changelog-feed';

export function createWhatsNewHistoryApi(fetchFn: typeof fetch = fetch): WhatsNewHistoryApi {
  return {
    async list() {
      try {
        const response = await fetchFn(changelogStreamUrl('extension'), { redirect: 'follow' });
        if (!response.ok) return null;
        return parseChangelogIndexRows(await response.json());
      } catch {
        return null;
      }
    },
    async entryBody(version) {
      if (!isChangelogVersion(version)) return null;
      try {
        const response = await fetchFn(changelogEntryUrl('extension', version), { redirect: 'follow' });
        if (!response.ok) return null;
        return parseChangelogEntryBody(await response.json());
      } catch {
        return null;
      }
    },
  };
}
