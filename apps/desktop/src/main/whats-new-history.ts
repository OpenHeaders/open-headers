/**
 * Main-process half of the What's New online history
 * (the changelog plan §4.3): enhancement-only static GETs against the
 * changelog feed's desktop stream, answering the renderer's
 * `oh.whatsNew.*` bridge RPCs. Runs here because the renderer's CSP
 * (`default-src 'self'`) blocks dialing the feed directly. Same
 * posture as the severity manifest fetch: anonymous GET of a static
 * file, no payload, no identifier — and strictly on demand, only when
 * the user opens the What's New tab with the section's capability
 * registered. Every failure reads as null (the section hides); the
 * bundled current entry never depends on any of this.
 */

import {
  type ChangelogIndexRow,
  changelogEntryUrl,
  changelogStreamUrl,
  isChangelogVersion,
  parseChangelogEntryBody,
  parseChangelogIndexRows,
} from '@openheaders/core/changelog-feed';

export async function fetchWhatsNewHistory(fetchFn: typeof fetch = fetch): Promise<ChangelogIndexRow[] | null> {
  try {
    const response = await fetchFn(changelogStreamUrl('desktop'), { redirect: 'follow' });
    if (!response.ok) return null;
    return parseChangelogIndexRows(await response.json());
  } catch {
    return null;
  }
}

export async function fetchWhatsNewEntryBody(version: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  if (!isChangelogVersion(version)) return null;
  try {
    const response = await fetchFn(changelogEntryUrl('desktop', version), { redirect: 'follow' });
    if (!response.ok) return null;
    return parseChangelogEntryBody(await response.json());
  } catch {
    return null;
  }
}
