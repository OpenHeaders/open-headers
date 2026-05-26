import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useMemo } from 'react';
import { computeInitiatorRowMeta } from '../../../data/initiator-row-meta';
import type { InspectorRowWithFires } from '../../../data/inspector-row-projection';
import { computeUpstreamChain } from '../../../data/upstream-chain';
import ResourceIcon from '../../traffic/ResourceIcon';
import { RowChips } from './RowChips';

export function UpstreamChain({
  row,
  getRowByUrl,
  pageOrigin,
  onOpenRequest,
}: {
  row: InspectorRowWithFires;
  getRowByUrl: (url: string) => InspectorRowWithFires | null;
  pageOrigin: string | null;
  onOpenRequest?: (requestId: string) => void;
}) {
  const lookupLifecycle = useMemo(
    () =>
      (url: string): RequestLifecycle | null => getRowByUrl(url)?.lifecycle ?? null,
    [getRowByUrl],
  );
  const chain = useMemo(
    () => computeUpstreamChain(row.lifecycle, lookupLifecycle),
    [row.lifecycle, lookupLifecycle],
  );
  if (chain.length <= 1) return null; // No ancestors — nothing to show.
  return (
    <details className="dt-section" open>
      <summary>Request initiator chain</summary>
      <div className="dt-initiator-chain">
        {chain.map((entry, i) => {
          const isCurrent = entry.lifecycle?.requestId === row.lifecycle.requestId;
          const openable = !!onOpenRequest && !!entry.lifecycle && !isCurrent;
          const meta = entry.lifecycle ? computeInitiatorRowMeta(entry.lifecycle, pageOrigin) : null;
          const urlClass = [
            'dt-initiator-chain-url',
            isCurrent ? 'dt-initiator-chain-url--anchor' : null,
            meta?.isFailed ? 'dt-initiator-chain-url--failed' : null,
          ]
            .filter(Boolean)
            .join(' ');
          const targetId = entry.lifecycle?.requestId;
          return (
            <div
              key={`${entry.url}-${i}`}
              className={`dt-initiator-chain-row${isCurrent ? ' dt-initiator-chain-row--focused' : ''}`}
              style={{ paddingLeft: 4 + i * 16, cursor: openable ? 'pointer' : 'default' }}
              onClick={() => {
                if (openable && targetId) onOpenRequest?.(targetId);
              }}
            >
              <span className="dt-initiator-chain-toggle dt-initiator-chain-toggle--leaf" aria-hidden="true" />
              {entry.lifecycle?.resourceType ? (
                <span className="dt-initiator-row-icon" aria-hidden="true">
                  <ResourceIcon type={entry.lifecycle.resourceType} />
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
