/**
 * "Copy as" snippet actions — resolve a request or draft to its wire
 * shape via the `resolveRequestWire` bridge channel (the host
 * substitutes every `{{ref}}` and folds auth exactly as a Send would),
 * render it with the pure formatters in `@openheaders/core/snippet`,
 * and land the text on the clipboard. Shared by the sidebar request
 * row's context menu and the request editor's ⋯ menu; failures
 * (unresolved variables, a missing request) surface as a toast carrying
 * the host's message.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { formatCurlSnippet, formatFetchSnippet } from '@openheaders/core/snippet';
import type { Request } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App } from 'antd';
import { useCallback } from 'react';

export type SnippetFormat = 'curl' | 'fetch';

/** Display names are spec vocabulary — raw by design, never localized. */
const FORMAT_LABEL: Record<SnippetFormat, string> = { curl: 'cURL', fetch: 'fetch' };

export type CopyRequestSnippet = (
  input: { requestUid?: string; draft?: Request },
  format: SnippetFormat,
) => Promise<void>;

export function useCopyRequestSnippet(): CopyRequestSnippet {
  const { message } = App.useApp();
  const t = useT();
  return useCallback<CopyRequestSnippet>(
    async (input, format) => {
      try {
        const resp = await hostBridge.call('resolveRequestWire', input);
        if (!resp.success || !resp.wire) {
          message.error(
            resp.error
              ? t('workbench.copySnippet.failedDetail', { message: resp.error })
              : t('workbench.copySnippet.failed'),
          );
          return;
        }
        const text = format === 'curl' ? formatCurlSnippet(resp.wire) : formatFetchSnippet(resp.wire);
        await navigator.clipboard.writeText(text);
        message.success(t('workbench.copySnippet.copied', { format: FORMAT_LABEL[format] }));
      } catch (err) {
        message.error(t('workbench.copySnippet.failedDetail', { message: (err as Error).message }));
      }
    },
    [message, t],
  );
}
