/**
 * useSecretsStorageNotice — bridges the host's observed at-rest-cipher
 * state into the Notifications panel's Suggestions section.
 *
 * While the cipher is `unavailable` a standing suggestion offers the
 * platform-appropriate remedy with a "Relaunch app" follow-through; the
 * moment the state leaves `unavailable` (or the next session boots with
 * a working cipher) the producer retires it. Hosts without the
 * `oh.secrets.*` RPCs never see a state, so nothing ever pushes.
 *
 * The footer's System status pill carries the same fact as a red
 * `secrets` row (reported host-side); this hook is the discoverable
 * "what should I do about it" copy of that signal.
 */

import { useEffect } from 'react';
import { requestSecretsRelaunch, secretsStorageRemedy, useSecretsStorageState } from '../hooks/useSecretsStorageState';
import { dismissSuggestionByKey, pushSuggestion } from './store';

const SUGGESTION_KEY = 'secrets-storage-locked';

export function useSecretsStorageNotice(): void {
  const state = useSecretsStorageState();
  const locked = state?.status === 'unavailable';
  const platform = state?.platform ?? '';

  useEffect(() => {
    if (!locked) {
      dismissSuggestionByKey(SUGGESTION_KEY);
      return;
    }
    pushSuggestion({
      severity: 'error',
      title: 'Secrets storage is locked',
      description: `Vault secrets and OAuth tokens cannot be read or saved this session. ${secretsStorageRemedy(platform)}`,
      dedupeKey: SUGGESTION_KEY,
      actions: [{ label: 'Relaunch app', run: requestSecretsRelaunch }],
    });
  }, [locked, platform]);
}
