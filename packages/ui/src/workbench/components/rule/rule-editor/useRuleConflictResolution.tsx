import { canonicalizeRule, parseRule, serializeRule } from '@openheaders/core/codec/yaml';
import { freshDocument } from '@openheaders/core/schemas';
import type { Rule } from '@openheaders/core/types';
import { hasDialogOnlyConflict, useAutoMergeForm } from '@openheaders/ui/shared/conflicts';
import type { FieldConflictsApi } from '@openheaders/ui/shared/conflicts/Field';
import type { FormInstance } from 'antd';
import { type Dispatch, type RefObject, type SetStateAction, useCallback, useMemo, useState } from 'react';
import { buildRule } from '../../rule-fields/build-rule';
import { applyResolutionToForm } from '../../rule-fields/rule-form-resolver';
import { type PathConflict, useRuleConflicts } from '../../rule-fields/use-rule-conflicts';

interface UseRuleConflictResolutionArgs {
  liveRule: Rule | null | undefined;
  isDirty: boolean;
  isCreateMode: boolean;
  form: FormInstance;
  formValues: Record<string, unknown> | undefined;
  ruleName: string;
  isEnabled: boolean;
  populateFormFromRule: (rule: Omit<Rule, 'uid' | 'path'>) => void;
  /** Bridges reprime's `onPrimed` to the conflict tracker's baseline
   *  setter. The hook writes `conflicts.setBaseline` into this ref at
   *  call time; `onPrimed` (defined in the component, earlier in render
   *  order) reads `.current` later, so no forward declaration is needed. */
  setBaselineRef: RefObject<(r: Rule) => void>;
  /** Snapshot of the rule the form was last seeded from — advanced by
   *  the component's `onPrimed`. Read here for the merge-editor Show Base
   *  layout so the common ancestor matches the tracker's baseline notion. */
  baselineRuleRef: RefObject<Rule | null>;
}

export interface RuleConflictResolution {
  fieldConflictsApi: FieldConflictsApi;
  allConflicts: Map<string, PathConflict>;
  dialogOnlyConflict: boolean;
  isConflictDialogOpen: boolean;
  setConflictDialogOpen: Dispatch<SetStateAction<boolean>>;
  handleKeepAllMine: () => void;
  handleUseAllSaved: () => void;
  handleResolveText: (text: string) => void;
  savedYaml: string;
  mineText: string;
  baseYaml: string | undefined;
  /** Returned solely so the component's save flow can clear dismissed
   *  paths once the publish batch lands. */
  clearDismissed: () => void;
}

/**
 * Conflict-resolution + auto-merge subsystem for the rule editor.
 *
 * Owns the conflict tracker (`useRuleConflicts`), the entity-level
 * aggregation the banner + diff dialog read from, the per-leaf /
 * reorder auto-merge wiring (`useAutoMergeForm`), the review-dialog
 * state, the three whole-form resolution handlers, and the three
 * merge-editor YAML payloads.
 *
 * The two baseline coordination refs stay in the component — they are
 * the shared layer between reprime (writes them via `onPrimed`), this
 * hook (wires `conflicts.setBaseline` into `setBaselineRef`, reads
 * `baselineRuleRef` for `baseYaml`), and the save flow (reads
 * `baselineRuleRef` in `mergeRuleForSave`). Placed where `useRuleConflicts`
 * used to sit — after `isDirty` — so reprime's earlier `onPrimed`
 * forward reference to `setBaselineRef.current` still resolves.
 */
export function useRuleConflictResolution({
  liveRule,
  isDirty,
  isCreateMode,
  form,
  formValues,
  ruleName,
  isEnabled,
  populateFormFromRule,
  setBaselineRef,
  baselineRuleRef,
}: UseRuleConflictResolutionArgs): RuleConflictResolution {
  const conflicts = useRuleConflicts({
    liveRule: liveRule ?? null,
    isDirty,
    enabled: !isCreateMode,
  });
  setBaselineRef.current = conflicts.setBaseline;

  // Field-tree conflicts API exposed to per-type rule-fields/* via
  // context. `<ScalarConflictChip>` + `<FieldConflictChip>` +
  // `<SetRowChip>` all subscribe through the provider so the per-type
  // editors stop prop-drilling the conflict bridge through every leaf.
  const fieldConflictsApi = useMemo<FieldConflictsApi>(
    () => ({
      getConflict: conflicts.getConflict,
      getSetConflict: conflicts.getSetConflict,
      acceptTheirs: conflicts.acceptTheirs,
      dismiss: conflicts.dismiss,
    }),
    [conflicts.getConflict, conflicts.getSetConflict, conflicts.acceptTheirs, conflicts.dismiss],
  );

  // Entity-level conflict aggregation. The banner + diff dialog read
  // through the same `getAllConflicts` projection — same source of
  // truth as the per-field chips, so any resolution path keeps all
  // three surfaces in sync.
  const formProjection = useMemo(() => {
    if (!formValues) return null;
    const built = buildRule(formValues, ruleName, isEnabled);
    if (!built || !liveRule) return null;
    // `extractBaseline` keys by `uid` and reads from a full Rule
    // shape — splice the live rule's uid + path onto the built form
    // projection so the path-keyed projection lines up with baseline.
    return conflicts.projectRule({ ...built, uid: liveRule.uid, path: liveRule.path } as Rule);
  }, [formValues, ruleName, isEnabled, liveRule, conflicts]);

  // Form-side ordered uid arrays per set-modeled path. The conflict
  // tracker uses these for `set-reorder` detection — order is lost
  // when the form gets projected to a path map.
  const formSetOrders = useMemo(() => {
    const out = new Map<string, string[]>();
    if (!formValues) return out;
    const collect = (key: string, setPath: string) => {
      const arr = formValues[key] as Array<{ uid?: string }> | undefined;
      if (!Array.isArray(arr)) return;
      const order = arr.map((r) => r?.uid).filter((u): u is string => typeof u === 'string');
      if (order.length > 0) out.set(setPath, order);
    };
    collect('requestHeaders', 'action.requestHeaders');
    collect('responseHeaders', 'action.responseHeaders');
    collect('params', 'action.params');
    collect('queryParams', 'action.params');
    collect('conditions', 'conditions');
    return out;
  }, [formValues]);

  const allConflicts = useMemo(
    () => (formProjection ? conflicts.getAllConflicts(formProjection, formSetOrders) : new Map<string, PathConflict>()),
    [formProjection, formSetOrders, conflicts],
  );

  // Dialog-only conflicts (no inline anchor: set-reorder, set-add,
  // union-swap) need the banner to stay visible even at count 1 so
  // the user can open the dialog. Set-remove + leaf both have inline
  // chips and let the banner hide at count 1.
  const dialogOnlyConflict = useMemo(() => hasDialogOnlyConflict(allConflicts), [allConflicts]);

  // Per-leaf auto-rebase via the shared `useAutoMergeForm` — when a peer
  // commits to a leaf the user hasn't touched in this tab, silently catch
  // the form up even when other leaves are dirty. Whole-form reprime gates
  // on every leaf clean and stops working the moment one leaf is dirty;
  // this complements it for the partial-dirty case (§6.2 killer demo).
  // Real conflicts (same leaf edited in both tabs) are filtered out by
  // `getAutoMergeable`'s form !== baseline guard and continue surfacing as
  // chips.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!liveRule) return;
      applyResolutionToForm(form, liveRule, path, { base: '', theirs });
    },
    [form, liveRule],
  );
  // Silent reorder rebase: peer reordered a uid-keyed set whose order
  // I haven't touched. uids carry per-row identity through the move,
  // so my in-flight per-leaf edits on rows that just shifted keep their
  // values + Form.List `field.key` keeps the DOM (and the cursor) in
  // place. Falls back to the dialog's `set-reorder` row when my form
  // ALSO diverged from baseline — only the untouched-side case auto-
  // applies.
  const applyAutoMergeReorder = useCallback(
    (setPath: string, savedOrder: readonly string[]) => {
      const formName =
        setPath === 'action.requestHeaders'
          ? 'requestHeaders'
          : setPath === 'action.responseHeaders'
            ? 'responseHeaders'
            : setPath === 'action.params'
              ? 'queryParams'
              : setPath === 'conditions'
                ? 'conditions'
                : null;
      if (!formName) return;
      const current = (form.getFieldValue(formName) as { uid?: string }[] | undefined) ?? [];
      if (current.length === 0) return;
      const byUid = new Map<string, { uid?: string }>();
      for (const row of current) if (row?.uid) byUid.set(row.uid, row);
      const next: { uid?: string }[] = [];
      for (const uid of savedOrder) {
        const row = byUid.get(uid);
        if (row) {
          next.push(row);
          byUid.delete(uid);
        }
      }
      // Locally-added rows (not in saved order) keep their relative
      // order and append to the tail — same convention as the manual
      // "Use saved order" path.
      for (const row of current) if (row?.uid && byUid.has(row.uid)) next.push(row);
      form.setFieldValue(formName, next);
    },
    [form],
  );
  useAutoMergeForm({
    conflicts,
    formProjection,
    formSetOrders,
    applyToForm: applyAutoMerge,
    applyToFormReorder: applyAutoMergeReorder,
  });

  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) {
      conflicts.dismiss(path);
    }
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!liveRule) return;
    for (const [path, conflict] of allConflicts) {
      applyResolutionToForm(form, liveRule, path, conflict);
      conflicts.acceptTheirs(path, conflict.theirs);
    }
  }, [allConflicts, conflicts, form, liveRule]);

  // Phase 6 commit seam for the merge-editor surface. The user has
  // edited the result text directly; parse it back to a Rule, populate
  // the form, and dismiss every conflict path so chips disappear. The
  // next Save broadcasts diverged leaves; reprime then rebases the
  // tracker baseline cleanly. Throws on parse failure — the merge
  // modal renders the error inline and stays open.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!liveRule) return;
      const parsed = parseRule(text, { path: liveRule.path });
      populateFormFromRule(parsed.value);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [liveRule, populateFormFromRule, allConflicts, conflicts],
  );

  // Diff dialog payloads. Saved (left pane) is the canonical rule
  // serialized via the YAML codec — same shape teammates see in `git
  // diff` / PR review (Phase D forward). Local (right pane) is built
  // from the form values with the user's pending per-row picks applied,
  // so the diff updates as soon as the user clicks "Use saved" /
  // "Keep mine" — same model IDE merge tools use.
  const savedYaml = useMemo(() => {
    if (!isConflictDialogOpen || !liveRule) return '';
    try {
      return serializeRule(freshDocument(canonicalizeRule(liveRule)));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRule]);

  // Baseline YAML feeds the merge-editor preview's Show Base layouts.
  // Computed at dialog-open from the per-tab baseline rule so the
  // common ancestor is the rule as it was when the form last seeded
  // (matches the conflict tracker's baseline notion).
  const baseYaml = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineRuleRef.current;
    if (!baseline) return undefined;
    try {
      return serializeRule(freshDocument(canonicalizeRule(baseline)));
    } catch {
      return undefined;
    }
    // baselineRuleRef is a ref; deliberately stale-on-purpose so the
    // value is captured when the dialog opens and stays stable while
    // it is open.
  }, [isConflictDialogOpen]);

  // Local projection serialized for the merge editor's mine pane.
  // Splices entity-managed metadata (schemaVersion, published) from
  // the live rule — `buildRule` only knows form-owned fields.
  const mineText = useMemo(() => {
    if (!isConflictDialogOpen || !liveRule || !formValues) return '';
    const localBuilt = buildRule(formValues, ruleName, isEnabled);
    if (!localBuilt) return '';
    const localRule = {
      ...localBuilt,
      uid: liveRule.uid,
      path: liveRule.path,
      schemaVersion: liveRule.schemaVersion,
      published: liveRule.published,
    } as Rule;
    try {
      return serializeRule(freshDocument(canonicalizeRule(localRule)));
    } catch {
      return '';
    }
  }, [isConflictDialogOpen, liveRule, formValues, ruleName, isEnabled]);

  return {
    fieldConflictsApi,
    allConflicts,
    dialogOnlyConflict,
    isConflictDialogOpen,
    setConflictDialogOpen,
    handleKeepAllMine,
    handleUseAllSaved,
    handleResolveText,
    savedYaml,
    mineText,
    baseYaml,
    clearDismissed: conflicts.clearDismissed,
  };
}
