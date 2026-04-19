/**
 * useInitialLanding — one-shot "open the configured landing tab on
 * startup" effect for the workspace shell.
 *
 * Complements useWorkspaceIntentRouter (which handles deep links) and
 * useEditorGroups' session-restore pass (which handles openTo=last).
 * Runs after data is loaded and all other routing has had a chance to
 * open its own tabs; if nothing has and openTo is not "last", opens
 * the Home / Rules / Collections landing tab for that variant.
 */

import { useEffect, useRef } from 'react';
import { get as getSetting } from '../settings/store';
import type { LandingView, RulesTab } from '../types';

interface UseInitialLandingOptions {
  isStatusLoaded: boolean;
  allTabs: RulesTab[];
  openLandingTab: (view: LandingView) => void;
}

export function useInitialLanding({ isStatusLoaded, allTabs, openLandingTab }: UseInitialLandingOptions): void {
  const ranRef = useRef(false);
  const openerRef = useRef(openLandingTab);
  openerRef.current = openLandingTab;

  useEffect(() => {
    if (ranRef.current) return;
    if (!isStatusLoaded) return;

    // Hash routes (deep links) and session restore both open tabs
    // synchronously on first load — if any tab is already present by
    // the time this effect runs, we defer to whatever put it there.
    if (allTabs.length > 0) {
      ranRef.current = true;
      return;
    }

    // openTo=last is handled by useEditorGroups' session-restore pass.
    // Every other value maps 1:1 to a landing view.
    let openTo: string;
    try {
      openTo = getSetting('general.openTo');
    } catch {
      openTo = 'last';
    }
    if (openTo === 'last') {
      ranRef.current = true;
      return;
    }
    if (openTo === 'home' || openTo === 'rules' || openTo === 'collections') {
      ranRef.current = true;
      openerRef.current(openTo);
    }
  }, [isStatusLoaded, allTabs]);
}
