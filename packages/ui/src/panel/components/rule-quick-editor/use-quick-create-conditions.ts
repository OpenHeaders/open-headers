/**
 * Conditions state for the quick-editor CREATE bodies. Seeds once per
 * popover session from the captured draft (URL per the workspace's
 * draft-URL strategy + request methods — the same derivation the
 * workbench applies to a handoff draft), then hands the list to the
 * Conditions row for editing. The save paths pass the edited array
 * through unchanged — no re-derive on save.
 */

import type { RuleCondition, RuleDraftBase } from '@openheaders/core/types';
import type { DraftUrlStrategy } from '@openheaders/core/utils';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { buildDraftConditions } from '@openheaders/ui/workbench/draft-conditions';
import { type Dispatch, type RefObject, type SetStateAction, useRef, useState } from 'react';

export interface QuickCreateConditionsApi {
  conditions: RuleCondition[];
  setConditions: Dispatch<SetStateAction<RuleCondition[]>>;
  /** Live mirror for the save flow's async closure. */
  conditionsRef: RefObject<RuleCondition[]>;
  /** True once the user changed the seeded list — joins the body's
   *  derived dirty flag (awareness only; create Save has no dirty gate). */
  isDirty: boolean;
}

export function useQuickCreateConditions(draft: RuleDraftBase, strategy: DraftUrlStrategy): QuickCreateConditionsApi {
  const [seed] = useState<RuleCondition[]>(() => buildDraftConditions(draft, strategy));
  const [conditions, setConditions] = useState<RuleCondition[]>(seed);
  const conditionsRef = useRef(conditions);
  conditionsRef.current = conditions;
  const isDirty = stableStringify(conditions) !== stableStringify(seed);
  return { conditions, setConditions, conditionsRef, isDirty };
}
