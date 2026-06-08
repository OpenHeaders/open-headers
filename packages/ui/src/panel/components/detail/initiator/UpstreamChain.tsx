import { computeInitiatorRowMeta } from '../../../data/initiator-row-meta';
import type { InspectorRowWithFires } from '../../../data/inspector-row-projection';
import type { UpstreamChainEntry } from '../../../data/upstream-chain';
import ResourceIcon from '../../traffic/ResourceIcon';
import { RowChips } from './RowChips';

export function UpstreamChain({
  row,
  chain,
  pageOrigin,
  onOpenRequest,
}: {
  row: InspectorRowWithFires;
  /** Precomputed by the parent (which also gates the empty state on it). */
  chain: readonly UpstreamChainEntry[];
  pageOrigin: string | null;
  onOpenRequest?: (requestId: string) => void;
}) {
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
