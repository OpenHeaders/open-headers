/**
 * WsTargetRow — the editor header's title slot: the URL, and nothing
 * else (the flavor already shows as the tab pill; the scheme is the
 * URL's own text). Owns the bidirectional URL↔Params sync exactly as
 * the HTTP bar does: the displayed value folds the structured params
 * back in via `buildUrlDisplay`, and editing the URL re-parses its
 * query into the params table, preserving row metadata via
 * `mergeParamsFromUrl`.
 *
 * The socketio flavor adds the URL↔Namespace sync on the same law:
 * the draft keeps `url` as the authority and `namespace` as its path
 * (the official client reads a Socket.IO URL's path as the
 * namespace), the display joins them, and an edit re-splits — typing
 * `/admin` here lands in the Settings row and vice versa.
 */

import { buildUrlDisplay, parseUrlQuery, splitUrlPath } from '@openheaders/core/utils';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { draftParamsToQueryParams, mergeParamsFromUrl } from '../request-editor/draft';
import { TemplateInput } from '../template-input';
import type { WebSocketDraft } from './draft';

interface WsTargetRowProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
}

/** The namespace as a URL path: a typed `admin` displays as `/admin`. */
function namespaceAsPath(namespace: string): string {
  if (namespace === '') return '';
  return namespace.startsWith('/') ? namespace : `/${namespace}`;
}

const WsTargetRow: React.FC<WsTargetRowProps> = ({ draft, setDraft, socketioFlavor }) => {
  const t = useT();
  const base = socketioFlavor ? `${draft.url}${namespaceAsPath(draft.namespace)}` : draft.url;
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TemplateInput
        value={buildUrlDisplay(base, draftParamsToQueryParams(draft.params))}
        onChange={(next) => {
          const parsed = parseUrlQuery(next);
          const params = (d: WebSocketDraft) => mergeParamsFromUrl(parsed.params, d.params);
          if (!socketioFlavor) {
            setDraft((d) => ({ ...d, url: parsed.base, params: params(d) }));
            return;
          }
          const split = splitUrlPath(parsed.base);
          setDraft((d) => ({ ...d, url: split.authority, namespace: split.path, params: params(d) }));
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
