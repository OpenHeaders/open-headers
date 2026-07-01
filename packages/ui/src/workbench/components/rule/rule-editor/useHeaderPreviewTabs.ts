import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';

export interface HeaderPreviewTabs {
  headerActiveTab: string;
  headerReqCount: number;
  headerResCount: number;
  handleHeaderTabChange: (tab: string) => void;
  setDefaultHeaderTab: (reqLen: number, resLen: number) => void;
  setHeaderReqCount: Dispatch<SetStateAction<number>>;
  setHeaderResCount: Dispatch<SetStateAction<number>>;
}

/**
 * Header-preview tab + badge state, lifted out of HeaderRuleFields so the
 * parent owns the truth (useWatch has inherent first-render timing issues).
 * Tracks the active Request/Response tab and the per-direction row counts.
 *
 * Once the user explicitly clicks a tab their choice is sticky — incoming
 * live-update re-primes never override it. Without this, a broadcast-driven
 * re-prime (clean editor, peer commits an unrelated mutation) would snap
 * back to the auto-default tab.
 *
 * The raw count setters + `setDefaultHeaderTab` are returned so the
 * populate / template-apply / draft-overlay paths can push counts in from
 * known data without waiting on a useWatch round-trip.
 */
export function useHeaderPreviewTabs(): HeaderPreviewTabs {
  const [headerActiveTab, setHeaderActiveTab] = useState('request');
  const [headerReqCount, setHeaderReqCount] = useState(0);
  const [headerResCount, setHeaderResCount] = useState(0);
  const userPickedHeaderTabRef = useRef(false);
  const handleHeaderTabChange = useCallback((tab: string) => {
    userPickedHeaderTabRef.current = true;
    setHeaderActiveTab(tab);
  }, []);
  const setDefaultHeaderTab = useCallback((reqLen: number, resLen: number) => {
    if (userPickedHeaderTabRef.current) return;
    setHeaderActiveTab(resLen > 0 && reqLen === 0 ? 'response' : 'request');
  }, []);

  return {
    headerActiveTab,
    headerReqCount,
    headerResCount,
    handleHeaderTabChange,
    setDefaultHeaderTab,
    setHeaderReqCount,
    setHeaderResCount,
  };
}
