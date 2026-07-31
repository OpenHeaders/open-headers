/**
 * Per-section unsaved-vs-saved comparison behind the request editor
 * tab labels' dirty (salmon) tones — the section-level sibling of the
 * per-knob settings-unsaved.ts. Both sides are the SAME projection
 * derived dirty fingerprints (`buildRequestUpdates` /
 * `canonicalRequestProjection`), sliced per tab, so the per-tab tones
 * always sum up to exactly why the Save button is dirty (method, URL,
 * and name aside — they have no tab). No extra normalization on
 * purpose: a section reads unsaved precisely when its slice of the
 * whole-document fingerprint differs.
 */

import { stableStringify } from '@openheaders/ui/shared/forms';
import type { RequestUpdates } from './draft';

export interface UnsavedSections {
  docs: boolean;
  params: boolean;
  auth: boolean;
  headers: boolean;
  body: boolean;
  /** Per-hook, so the Scripts tab's Pre-request / Post-response rail
   *  rows can carry their own tone; the tab label ORs the pair. */
  preRequestScript: boolean;
  postResponseScript: boolean;
}

/** Shared all-clean value for surfaces rendered without a baseline. */
export const NO_UNSAVED_SECTIONS: UnsavedSections = {
  docs: false,
  params: false,
  auth: false,
  headers: false,
  body: false,
  preRequestScript: false,
  postResponseScript: false,
};

/** Sections whose slice of the draft projection differs from the
 *  saved one. Scalar slices compare strictly; structured slices via
 *  the same stable stringify the whole-document fingerprint uses. */
export function unsavedSections(draft: RequestUpdates, saved: RequestUpdates): UnsavedSections {
  const differs = (pick: (u: RequestUpdates) => unknown): boolean =>
    stableStringify(pick(draft)) !== stableStringify(pick(saved));
  return {
    docs: draft.description !== saved.description,
    params: differs((u) => u.params),
    auth: differs((u) => u.auth),
    headers: differs((u) => u.headers),
    body: differs((u) => u.body),
    preRequestScript: draft.preRequestScript !== saved.preRequestScript,
    postResponseScript: draft.postResponseScript !== saved.postResponseScript,
  };
}
