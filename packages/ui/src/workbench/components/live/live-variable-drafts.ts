/**
 * Draft shapes for `LiveVariableEditor`'s two modes. Create mode starts
 * from an empty draft; edit mode primes from the persisted entity and
 * derives dirty from the fingerprint (form-vs-canonical equality).
 */

import type { LiveVariable } from '@openheaders/core/types';

export interface CreateDraft {
  name: string;
  description: string;
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  workflowUid: string;
  stepId: string;
  captureName: string;
}

export function emptyCreateDraft(): CreateDraft {
  return {
    name: '',
    description: '',
    enabled: true,
    requireFreshOnRuleBuild: false,
    workflowUid: '',
    stepId: '',
    captureName: '',
  };
}

export interface EditDraft {
  name: string;
  description: string;
  enabled: boolean;
  requireFreshOnRuleBuild: boolean;
  workflowUid: string;
  stepId: string;
  captureName: string;
  manualOverride: { value: string; until: number | null } | null;
}

export function editDraftFromVariable(lv: LiveVariable): EditDraft {
  return {
    name: lv.name,
    description: lv.description ?? '',
    enabled: lv.enabled,
    requireFreshOnRuleBuild: Boolean(lv.requireFreshOnRuleBuild),
    workflowUid: lv.workflowUid,
    stepId: lv.stepId,
    captureName: lv.captureName,
    manualOverride: lv.manualOverride
      ? {
          value: lv.manualOverride.value,
          until: typeof lv.manualOverride.until === 'number' ? lv.manualOverride.until : null,
        }
      : null,
  };
}

export function fingerprintEdit(d: EditDraft): string {
  return JSON.stringify(d);
}
