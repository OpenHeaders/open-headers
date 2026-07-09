/**
 * Conflict tier for the cookie attribute form — shared by the full
 * editor-tab document and the quick-edit popover, so the two surfaces
 * can never drift on chip anatomy, review-pane projections, or merge
 * parsing (the same reason both render CookieEditFields).
 *
 * Owns the doc-local three-way tracker (form vs live canonical vs
 * seed-time baseline), the per-field ConflictDiffChip affixes the
 * attribute grid mounts on its labels, the entity banner, and the lazy
 * Monaco review dialog. Take-theirs and a completed merge write
 * STRAIGHT into the caller's form state — the form stays dirty and the
 * caller's Save commits to the jar.
 */

import ConflictDiffChip from '@openheaders/ui/shared/awareness/ConflictDiffChip';
import EntityConflictBanner from '@openheaders/ui/shared/conflicts/EntityConflictBanner';
import { App } from 'antd';
import {
  type Dispatch,
  lazy,
  type ReactNode,
  type SetStateAction,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  applyConflictFieldFromCanonical,
  type CookieConflictField,
  type CookieEditFormValues,
  editFormConflictProjection,
  editFormFromConflictText,
} from '../../../data/cookies/cookie-edit';
import { useStorageDocConflicts } from '../../../data/storage/doc-conflicts';

// Lazy like every other Monaco consumer — the review dialog rides the
// merge editor, and a static import would pull Monaco into the panel's
// initial chunk (also why this is a file-path import, not the barrel).
const EntityConflictDialog = lazy(() => import('@openheaders/ui/shared/conflicts/EntityConflictDialog'));

interface UseCookieConflictTierArgs {
  /** Gate — callers pass false until the canonical exists and while a
   *  whole-document state (gone / read-only) supersedes field chips. */
  enabled: boolean;
  values: CookieEditFormValues;
  setValues: Dispatch<SetStateAction<CookieEditFormValues>>;
  /** The live canonical — advances on every sync. */
  canonical: CookieEditFormValues | null;
  /** Post-merge hook — the document clears its save-error note here. */
  onMergeApplied?: () => void;
}

export interface CookieConflictTier {
  /** Re-prime the baseline on a loud (re-)fetch — mount, Refresh,
   *  post-Save. Clears dismissals. */
  seed: (canonical: CookieEditFormValues) => void;
  /** Per-field chips for the attribute grid's label affixes. */
  affixes: Partial<Record<CookieConflictField, ReactNode>> | undefined;
  /** Entity banner (own visibility rules) — mount above the form. */
  banner: ReactNode;
  /** The review merge dialog, non-null while open — mount beside the banner. */
  dialog: ReactNode;
}

export function useCookieConflictTier({
  enabled,
  values,
  setValues,
  canonical,
  onMergeApplied,
}: UseCookieConflictTierArgs): CookieConflictTier {
  const { message } = App.useApp();

  // Compares the form and the live canonical on their flat string
  // projections against a seed-time baseline the wholesale canonical
  // advance never touches.
  const conflictForm = useMemo(() => editFormConflictProjection(values), [values]);
  const conflictCanonical = useMemo(
    () => (canonical === null ? null : editFormConflictProjection(canonical)),
    [canonical],
  );
  const {
    conflicts,
    seed: seedConflicts,
    dismiss: dismissConflict,
    getBaseline: getConflictBaseline,
  } = useStorageDocConflicts<CookieConflictField>({
    enabled: enabled && canonical !== null,
    form: canonical === null ? null : conflictForm,
    canonical: conflictCanonical,
  });

  const seed = useCallback(
    (next: CookieEditFormValues) => {
      seedConflicts(editFormConflictProjection(next));
    },
    [seedConflicts],
  );

  // Latest-canonical mirror — take-theirs fires from chips rendered a
  // tick earlier and must write the CURRENT live value.
  const canonicalRef = useRef(canonical);
  canonicalRef.current = canonical;
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Take-theirs: write the live canonical's value at the field into the
  // form — the field falls out as form === canonical and the tracker's
  // catch-up advances its baseline. No separate accept bookkeeping.
  const takeTheirs = useCallback(
    (field: CookieConflictField): void => {
      const current = canonicalRef.current;
      if (current === null) return;
      setValues((prev) => applyConflictFieldFromCanonical(prev, field, current));
    },
    [setValues],
  );

  // Chip per conflicted field, mounted on the field's label. The
  // wrapper mirrors InfoTrigger's guard — inside the toggle labels a
  // plain click would forward to the Switch and flip it.
  const affixes = useMemo(() => {
    if (conflicts.size === 0) return undefined;
    const out: Partial<Record<CookieConflictField, ReactNode>> = {};
    for (const [field, conflict] of conflicts) {
      out[field] = (
        // biome-ignore lint/a11y/useKeyWithClickEvents: click guard keeps toggle labels from flipping their Switch
        // biome-ignore lint/a11y/noStaticElementInteractions: click guard keeps toggle labels from flipping their Switch
        <span
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <ConflictDiffChip
            theirs={conflict.theirs}
            base={conflict.base}
            local={conflictForm[field]}
            onTakeTheirs={() => takeTheirs(field)}
            onKeepMine={() => dismissConflict(field)}
            style={{ marginLeft: 4 }}
          />
        </span>
      );
    }
    return out;
  }, [conflicts, conflictForm, takeTheirs, dismissConflict]);

  const [reviewOpen, setReviewOpen] = useState(false);

  // Review panes, computed at open — all three are the same flat JSON
  // projection the conflict comparison runs on, so the merge diff
  // lights up exactly the conflicted lines.
  const reviewSavedText = useMemo(
    () => (reviewOpen && conflictCanonical !== null ? JSON.stringify(conflictCanonical, null, 2) : ''),
    [reviewOpen, conflictCanonical],
  );
  const reviewMineText = useMemo(
    () => (reviewOpen ? JSON.stringify(conflictForm, null, 2) : ''),
    [reviewOpen, conflictForm],
  );
  const reviewBaseText = useMemo(() => {
    if (!reviewOpen) return undefined;
    const baseline = getConflictBaseline();
    return baseline === null ? undefined : JSON.stringify(baseline, null, 2);
  }, [reviewOpen, getConflictBaseline]);

  // Merge commit: parse the merged projection back onto the form (a
  // throw renders inline in the modal) and dismiss the remaining
  // conflicts — fields merged to the saved value fall out via the
  // baseline catch-up, kept-mine fields stay quiet until the browser
  // diverges again. The form stays dirty; Save commits to the jar.
  const handleResolveReview = useCallback(
    (text: string) => {
      const next = editFormFromConflictText(valuesRef.current, text);
      setValues(next);
      onMergeApplied?.();
      for (const field of conflicts.keys()) dismissConflict(field);
      message.success('Merge applied to the form — Save writes it to the browser');
    },
    [setValues, onMergeApplied, conflicts, dismissConflict, message],
  );

  const banner = (
    <EntityConflictBanner
      count={conflicts.size}
      onReview={() => setReviewOpen(true)}
      onKeepAllMine={() => {
        for (const field of conflicts.keys()) dismissConflict(field);
      }}
      onUseAllSaved={() => {
        for (const field of conflicts.keys()) takeTheirs(field);
      }}
      style={{ marginBottom: 0 }}
    />
  );

  const dialog = reviewOpen ? (
    <Suspense fallback={null}>
      <EntityConflictDialog
        open
        savedText={reviewSavedText}
        mineText={reviewMineText}
        baseText={reviewBaseText}
        language="json"
        onResolveText={handleResolveReview}
        onClose={() => setReviewOpen(false)}
      />
    </Suspense>
  ) : null;

  return { seed, affixes, banner, dialog };
}
