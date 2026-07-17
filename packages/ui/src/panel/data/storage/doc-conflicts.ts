/**
 * Doc-local conflict tracker for storage document editors — the
 * conflict tier over slice A's free auto-merge.
 *
 * The editors' merge advances the document canonical WHOLESALE on
 * every sync (`doc.canonical` / `doc.value` / `doc.text` are always
 * the live browser truth), so the conflict comparison needs a second
 * baseline that does NOT ride along: the value the user last saw
 * seeded into the form. This hook owns that baseline plus the
 * dismissal state, and derives per-field conflicts from the same
 * three-way predicate the workbench tracker uses:
 *
 *   conflicted(f) ⇔ form[f] ≠ canonical[f]   (my draft diverges)
 *               AND form[f] ≠ baseline[f]    (I touched the field)
 *               AND canonical[f] ≠ baseline[f] (the browser diverged too)
 *
 * Fields are compared on a flat string projection the editor derives
 * (see `editFormConflictProjection` for the cookie form; DOM / IDB
 * project their single value leaf). Take-theirs is editor-owned — the
 * editor writes the canonical value into its form, the field falls
 * out as form === canonical, and the catch-up effect below advances
 * the baseline. No override map needed.
 *
 * Baseline life cycle:
 *   - `seed(canonical)` on every loud (re-)fetch — mount, Refresh,
 *     post-Save — also clears dismissals.
 *   - Per-field catch-up whenever form and canonical agree on a field
 *     the baseline disagrees on: the user either never touched it (the
 *     merge adopted the live value), converged on it by hand, or
 *     take-theirs'd it. Advancing keeps a later local edit from
 *     diffing against a value the user never saw (a stale baseline
 *     would mint a false three-way conflict).
 *
 * Dismissal is until-the-next-divergence: dismissing records the
 * canonical value at dismiss time and hides the chip while the
 * canonical still holds it; a further external change re-surfaces the
 * conflict.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface DocFieldConflict {
  /** The value the form was last seeded with — what the user saw. */
  base: string;
  /** The live browser value diverging under the draft. */
  theirs: string;
}

export interface UseStorageDocConflictsArgs<F extends string> {
  /** Gate — callers pass false until the document loaded and while the
   *  whole-document gone state supersedes per-field conflicts. */
  enabled: boolean;
  /** Flat projection of the current form / drafts. */
  form: Readonly<Record<F, string>> | null;
  /** Flat projection of the live canonical (advances on every sync). */
  canonical: Readonly<Record<F, string>> | null;
}

export interface StorageDocConflictsApi<F extends string> {
  /** Per-field conflicts, empty while disabled or unseeded. */
  conflicts: ReadonlyMap<F, DocFieldConflict>;
  /** Re-prime the baseline on a loud fetch; clears dismissals. */
  seed: (canonical: Readonly<Record<F, string>>) => void;
  /** Hide the field's chip until the canonical diverges again. */
  dismiss: (field: F) => void;
  /** Snapshot of the full baseline — the review surfaces' base pane
   *  reads it at open time (the conflict map only carries the
   *  conflicted fields' bases). */
  getBaseline: () => Readonly<Record<F, string>> | null;
}

export function useStorageDocConflicts<F extends string>({
  enabled,
  form,
  canonical,
}: UseStorageDocConflictsArgs<F>): StorageDocConflictsApi<F> {
  const baselineRef = useRef<Record<F, string> | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlyMap<F, string>>(() => new Map());

  const seed = useCallback((next: Readonly<Record<F, string>>) => {
    baselineRef.current = { ...next };
    setDismissed((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  const getBaseline = useCallback(() => (baselineRef.current === null ? null : { ...baselineRef.current }), []);

  const dismiss = useCallback(
    (field: F) => {
      if (!canonical) return;
      const theirs = canonical[field];
      setDismissed((prev) => {
        if (prev.get(field) === theirs) return prev;
        const next = new Map(prev);
        next.set(field, theirs);
        return next;
      });
    },
    [canonical],
  );

  // Per-field baseline catch-up — see the module doc. Runs post-render;
  // the fields it advances are exactly those the conflict predicate
  // already skips (form === canonical), so the timing is invisible.
  useEffect(() => {
    if (!enabled || !form || !canonical) return;
    const baseline = baselineRef.current;
    if (!baseline) return;
    const caughtUp: F[] = [];
    for (const field of Object.keys(canonical) as F[]) {
      if (form[field] === canonical[field] && baseline[field] !== canonical[field]) {
        baseline[field] = canonical[field];
        caughtUp.push(field);
      }
    }
    if (caughtUp.length === 0) return;
    setDismissed((prev) => {
      if (!caughtUp.some((f) => prev.has(f))) return prev;
      const next = new Map(prev);
      for (const f of caughtUp) next.delete(f);
      return next;
    });
  }, [enabled, form, canonical]);

  const conflicts = useMemo(() => {
    const out = new Map<F, DocFieldConflict>();
    const baseline = baselineRef.current;
    if (!enabled || !form || !canonical || !baseline) return out;
    for (const field of Object.keys(canonical) as F[]) {
      const local = form[field];
      const theirs = canonical[field];
      const base = baseline[field];
      if (local === theirs) continue;
      if (local === base) continue;
      if (theirs === base) continue;
      if (dismissed.get(field) === theirs) continue;
      out.set(field, { base, theirs });
    }
    return out;
  }, [enabled, form, canonical, dismissed]);

  return useMemo(() => ({ conflicts, seed, dismiss, getBaseline }), [conflicts, seed, dismiss, getBaseline]);
}

/** Chip-popover display cap for value documents — a multi-kilobyte
 *  localStorage blob would otherwise dump whole into the popover. The
 *  resolution actions always use the real value, never the clipped one. */
export function clipConflictValue(t: Translate, value: string, max = 2000): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}${t('panel.storage.doc.clippedSuffix', { count: value.length - max })}`;
}
