/**
 * useMqttSavedSelection — the saved-messages selection plane (the
 * reference client's model): while rows exist one of them is SELECTED,
 * the compose surface is that row's editor, and every compose edit
 * writes through to it. Lives at the orchestrator so the binding
 * survives rail collapse and tab switches.
 *
 *   - `setBoundDraft` wraps the draft setter: after any update it
 *     mirrors the compose into the selected row IN THE SAME state
 *     update (`mirrorComposeIntoSaved` is identity-stable, so a
 *     no-change mirror costs nothing). External repopulates (reprime)
 *     keep the RAW setter — sync must never fabricate edits.
 *   - `selectSavedMessage` selects a row and loads it into the
 *     compose; on mount the selection restores by CONTENT match (in
 *     steady state the compose always equals the last-selected row).
 *   - A selected row that vanishes (deleted here or remotely) releases
 *     the selection instead of pointing at nothing.
 */

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSavedMessageIntoCompose, type MqttDraft, mirrorComposeIntoSaved, savedRowMatchesCompose } from './draft';

export interface MqttSavedSelection {
  selectedSavedUid: string | null;
  /** Select a row and load it into the compose (`null` clears). */
  selectSavedMessage: (uid: string | null) => void;
  /** The draft setter compose edits ride — mirrors into the selected row. */
  setBoundDraft: Dispatch<SetStateAction<MqttDraft>>;
}

export function useMqttSavedSelection(
  draft: MqttDraft,
  setDraft: Dispatch<SetStateAction<MqttDraft>>,
): MqttSavedSelection {
  const [selectedSavedUid, setSelectedSavedUid] = useState<string | null>(
    () => draft.savedMessages.find((row) => savedRowMatchesCompose(draft, row))?.uid ?? null,
  );
  // The bound setter reads the selection through a ref so its identity
  // never churns with selection changes (children memo against it).
  const selectedRef = useRef(selectedSavedUid);
  selectedRef.current = selectedSavedUid;

  const setBoundDraft = useCallback<Dispatch<SetStateAction<MqttDraft>>>(
    (action) => {
      setDraft((prev) => {
        const next = typeof action === 'function' ? action(prev) : action;
        return mirrorComposeIntoSaved(next, selectedRef.current);
      });
    },
    [setDraft],
  );

  const selectSavedMessage = useCallback(
    (uid: string | null) => {
      setSelectedSavedUid(uid);
      if (uid === null) return;
      setDraft((d) => {
        const row = d.savedMessages.find((r) => r.uid === uid);
        return row !== undefined ? loadSavedMessageIntoCompose(d, row) : d;
      });
    },
    [setDraft],
  );

  useEffect(() => {
    if (selectedSavedUid !== null && !draft.savedMessages.some((row) => row.uid === selectedSavedUid)) {
      setSelectedSavedUid(null);
    }
  }, [draft.savedMessages, selectedSavedUid]);

  return { selectedSavedUid, selectSavedMessage, setBoundDraft };
}
