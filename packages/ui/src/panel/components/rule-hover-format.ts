/**
 * Pure formatters and predicates backing the rule hover popover.
 *
 * Everything here is presentation-free derivation over the snapshot /
 * attribution / applicability data: no React, no antd. Consumed by
 * `RuleHoverPopover` and its snapshot block.
 */

import type { HeaderModification, Rule, RuleSnapshotHeaderMod } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { HeaderAttribution, RuleAttributionContext } from '../data/headers/header-attribution';
import type { RuleApplicability } from '../data/rule-create/rule-applicability';

export function ruleCtxFromAttribution(attribution: HeaderAttribution | undefined): RuleAttributionContext | null {
  if (!attribution) return null;
  if (attribution.kind === 'added' || attribution.kind === 'modified' || attribution.kind === 'removed') {
    return attribution.ctx;
  }
  return null;
}

export function snapshotAppliedValue(mod: RuleSnapshotHeaderMod): string {
  return mod.valueResolved ?? mod.valueTemplate ?? '';
}

export function tagLabelFor(t: Translate, kind: RuleApplicability['kind']): string {
  switch (kind) {
    case 'rule-disabled':
      return t('panel.ruleHover.tagDisabled');
    case 'mod-gone':
      return t('panel.ruleHover.tagModRemoved');
    case 'conditions-mismatch':
      return t('panel.ruleHover.tagConditionsMismatch');
    case 'name-template-unresolved':
    case 'value-template-unresolved':
    case 'separator-template-unresolved':
      return t('panel.ruleHover.tagWontFire');
    default:
      return '';
  }
}

export function tagTitleFor(t: Translate, kind: RuleApplicability['kind']): string {
  switch (kind) {
    case 'rule-disabled':
      return t('panel.ruleHover.tagTitle.ruleDisabled');
    case 'mod-gone':
      return t('panel.ruleHover.tagTitle.modGone');
    case 'conditions-mismatch':
      return t('panel.ruleHover.tagTitle.conditionsMismatch');
    case 'name-template-unresolved':
      return t('panel.ruleHover.tagTitle.nameUnresolved');
    case 'value-template-unresolved':
      return t('panel.ruleHover.tagTitle.valueUnresolved');
    case 'separator-template-unresolved':
      return t('panel.ruleHover.tagTitle.separatorUnresolved');
    default:
      return '';
  }
}

/**
 * Maps a `RuleApplicability` verdict + drift state into a tagged
 * Future-row description. Pulled out so the JSX stays declarative
 * and the branching logic lives in one place.
 */
export type FutureKind =
  | { kind: 'none' }
  | { kind: 'rule-deleted' }
  | { kind: 'rule-disabled' }
  | { kind: 'mod-gone' }
  | { kind: 'conditions-mismatch' }
  | { kind: 'name-template-unresolved'; template: string }
  | { kind: 'value-template-unresolved'; template: string }
  | { kind: 'separator-template-unresolved'; template: string }
  | { kind: 'removed' }
  | { kind: 'resolved'; value: string };

export function computeFutureKind(
  applicability: RuleApplicability | null,
  liveRule: Rule | null,
  currentMod: HeaderModification | null,
  mod: RuleSnapshotHeaderMod,
  currentResolvedValue: string | null,
): FutureKind {
  // No applicability provided (e.g. legacy caller path) — fall back
  // to the live rule + current mod for a coarse structural verdict.
  if (!applicability) {
    if (liveRule == null) return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'rule-deleted' };
    if (currentMod == null) return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'mod-gone' };
  }
  switch (applicability?.kind) {
    case 'rule-deleted':
      return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'rule-deleted' };
    case 'rule-disabled':
      return { kind: 'rule-disabled' };
    case 'mod-gone':
      return mod.operation === 'remove' ? { kind: 'none' } : { kind: 'mod-gone' };
    case 'conditions-mismatch':
      return { kind: 'conditions-mismatch' };
    case 'name-template-unresolved':
      return { kind: 'name-template-unresolved', template: applicability.template };
    case 'value-template-unresolved':
      return { kind: 'value-template-unresolved', template: applicability.template };
    case 'separator-template-unresolved':
      return { kind: 'separator-template-unresolved', template: applicability.template };
    default: {
      // Live rule still fires — surface the drift cases relative to
      // the snapshot.
      if (currentMod?.operation === 'remove' && mod.operation !== 'remove') {
        return { kind: 'removed' };
      }
      if (
        mod.operation !== 'remove' &&
        currentResolvedValue != null &&
        mod.valueResolved != null &&
        mod.valueResolved !== currentResolvedValue &&
        isSnapshotResolutionReliable(mod)
      ) {
        return { kind: 'resolved', value: currentResolvedValue };
      }
      return { kind: 'none' };
    }
  }
}

/**
 * True when the snapshot's `valueResolved` is a reliable wire-value
 * baseline for drift comparison against the current resolution.
 *
 * Unreliable cases (skip drift detection):
 *   - `{{vault.TOTP_*}}`: TOTP codes never bake into compiled DNR
 *     rules (SW uses `reject` mode for deferred vault entries), so the
 *     snapshot's `valueResolved` is the literal template. The
 *     renderer's `defer` mode returns an empty string instead. Modes
 *     differ → naive comparison always shows drift, so we suppress.
 *   - Templates whose vars failed to resolve at fire time (broken ref,
 *     env not selected, etc.) — same shape: `valueResolved` ===
 *     `valueTemplate` AND template contains `{{`.
 */
export function isSnapshotResolutionReliable(mod: RuleSnapshotHeaderMod): boolean {
  if (mod.valueTemplate === undefined) return true;
  if (!mod.valueTemplate.includes('{{')) return true;
  return mod.valueTemplate !== mod.valueResolved;
}
