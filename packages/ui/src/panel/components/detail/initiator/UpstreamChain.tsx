import { useMemo } from 'react';
import { computeUpstreamChain } from '../../../data/upstream-chain';
import { computeInitiatorRowMeta } from '../../../data/initiator-row-meta';
import type { InspectorRequest } from '../../../data/types';
import ResourceIcon from '../../traffic/ResourceIcon';
import { RowChips } from './RowChips';

export function UpstreamChain({
  request,
  getRequestByUrl,
  pageOrigin,
  onOpenRequest,
}: {
  request: InspectorRequest;
  getRequestByUrl: (url: string) => InspectorRequest | null;
  pageOrigin: string | null;
  onOpenRequest?: (entryId: string) => void;
}) {
  const chain = useMemo(() => computeUpstreamChain(request, getRequestByUrl), [request, getRequestByUrl]);
  if (chain.length <= 1) return null; // No ancestors — nothing to show.
  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <div className="dt-initiator-chain">
        {chain.map((entry, i) => {
          const isCurrent = entry.request?.id === request.id;
          const openable = !!onOpenRequest && !!entry.request && !isCurrent;
          const meta = entry.request ? computeInitiatorRowMeta(entry.request, pageOrigin) : null;
          const urlClass = [
            'dt-initiator-chain-url',
            isCurrent ? 'dt-initiator-chain-url--anchor' : null,
            meta?.isFailed ? 'dt-initiator-chain-url--failed' : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={`${entry.url}-${i}`}
              className={`dt-initiator-chain-row${isCurrent ? ' dt-initiator-chain-row--focused' : ''}`}
              style={{ paddingLeft: 4 + i * 16, cursor: openable ? 'pointer' : 'default' }}
              onClick={() => {
                if (openable) onOpenRequest?.(entry.request!.id);
              }}
            >
              <span className="dt-initiator-chain-toggle dt-initiator-chain-toggle--leaf" aria-hidden="true" />
              {entry.request?.resourceType ? (
                <span className="dt-initiator-row-icon" aria-hidden="true">
                  <ResourceIcon type={entry.request.resourceType} />
                </span>
              ) : null}
              <span className={urlClass} title={entry.url}>
                {entry.url}
              </span>
              {meta && <RowChips meta={meta} subtree={null} />}
            </div>
          );
        })}
      </div>
    </details>
  );
}
