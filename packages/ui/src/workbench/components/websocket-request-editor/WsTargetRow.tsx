/**
 * WsTargetRow — the editor header's title slot: the URL, and nothing
 * else (the flavor already shows as the tab pill; the scheme is the
 * URL's own text). Owns the bidirectional URL↔Params sync exactly as
 * the HTTP bar does: the displayed value folds the structured params
 * back in via `buildUrlDisplay`, and editing the URL re-parses its
 * query into the params table, preserving row metadata via
 * `mergeParamsFromUrl`.
 */

import { buildUrlDisplay, parseUrlQuery } from '@openheaders/core/utils';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { draftParamsToQueryParams, mergeParamsFromUrl } from '../request-editor/draft';
import { TemplateInput } from '../template-input';
import type { WebSocketDraft } from './draft';

interface WsTargetRowProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
}

const WsTargetRow: React.FC<WsTargetRowProps> = ({ draft, setDraft }) => {
  const t = useT();
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TemplateInput
        value={buildUrlDisplay(draft.url, draftParamsToQueryParams(draft.params))}
        onChange={(next) => {
          const parsed = parseUrlQuery(next);
          setDraft((d) => ({ ...d, url: parsed.base, params: mergeParamsFromUrl(parsed.params, d.params) }));
        }}
        placeholder={t('workbench.editors.request.url.placeholder')}
        size="small"
        flagUnresolved
        expandOnFocus
        style={{ width: '100%', fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        data-testid="websocket-url-input"
      />
    </div>
  );
};

export default WsTargetRow;
