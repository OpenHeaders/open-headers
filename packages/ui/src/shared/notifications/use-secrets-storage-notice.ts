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

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSettingsReady } from '@openheaders/ui/workbench/settings/hooks';
import { useEffect } from 'react';
import { requestSecretsRelaunch, secretsStorageRemedy, useSecretsStorageState } from '../hooks/useSecretsStorageState';
import { dismissSuggestionByKey, pushSuggestion } from './store';

const SUGGESTION_KEY = 'secrets-storage-locked';

export function useSecretsStorageNotice(): void {
  const t = useT();
  const state = useSecretsStorageState();
  const locked = state?.status === 'unavailable';
  const platform = state?.platform ?? '';
  // Suggestions capture copy at push time — wait for the settings store
  // so a bridge state arriving before `general.language` hydrates can't
  // bake the default locale in (dedupe drops the re-push).
  const ready = useSettingsReady();

  useEffect(() => {
    if (!ready) return;
    if (!locked) {
      dismissSuggestionByKey(SUGGESTION_KEY);
      return;
    }
    pushSuggestion({
      severity: 'error',
      title: t('shared.notifications.secrets.title'),
      description: t('shared.notifications.secrets.description', { remedy: secretsStorageRemedy(t, platform) }),
      dedupeKey: SUGGESTION_KEY,
      actions: [{ label: t('shared.notifications.secrets.relaunch'), run: requestSecretsRelaunch }],
    });
  }, [ready, locked, platform, t]);
}
