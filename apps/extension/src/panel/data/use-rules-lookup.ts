/**
 * Panel-side read-only view of the extension's rule registry.
 *
 * `InspectorFire` records only carry a `ruleUid` — the panel needs
 * rule definitions to answer "which of this request's headers were
 * added/modified/removed by Open Headers?". The full `RuleContext`
 * used by popup/workspace does too much (CRUD, templates, folders)
 * for our purposes, so this hook is the minimum needed: a live
 * `Map<uid, Rule>` that reflects the background's rule store.
 *
 * Subscribes to the same `rulesUpdated` broadcast the workspace uses,
 * so rule edits propagate here without a page reload.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { useEffect, useState } from 'react';

export type RulesByUid = ReadonlyMap<string, V5.Rule>;

const EMPTY: RulesByUid = new Map();

function indexRules(rules: readonly V5.Rule[]): RulesByUid {
  const map = new Map<string, V5.Rule>();
  for (const r of rules) map.set(r.uid, r);
  return map;
}

export function useRulesLookup(): RulesByUid {
  const [byUid, setByUid] = useState<RulesByUid>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    // Initial fetch. `popupOpen` also returns `connected`, pause
    // markers, etc. — we only want the rules.
    call('popupOpen')
      .then((resp) => {
        if (cancelled) return;
        setByUid(indexRules(resp.rules ?? []));
      })
      .catch(() => {
        // Background may be asleep; we'll refresh on the next
        // `rulesUpdated` broadcast.
      });

    const unsub = subscribe('rulesUpdated', (payload) => {
      if (cancelled) return;
      if (Array.isArray(payload.rules)) setByUid(indexRules(payload.rules));
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return byUid;
}
