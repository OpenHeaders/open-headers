import { useMemo } from 'react';
import {
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleMimeType,
  lifecycleTransferredBytes,
} from '../data/inspector-row-projection';
import { classifyBodyState, classifyResponseSnapshot, snapshotMime } from '../data/response-body-state';
import BodyStateView from './detail/BodyStateView';
import OverrideBodyButton from './detail/OverrideBodyButton';
import SplitBodyView from './detail/SplitBodyView';

interface ResponseBodyViewProps {
  row: InspectorRowWithFires;
  searchHighlight?: string;
  searchLineNumber?: number;
  /** N-th occurrence of `searchHighlight` in this body (0-based). */
  searchMatchIndex?: number;
  /** Open the create-rule editor pre-filled to mock this response. */
  onOverrideResponse?: () => void;
}

/**
 * The Response tab. Renders the body the page received — and, when a response
 * rule modified a real (`network`-source) exchange, the real server response
 * beside it (Served | Original). The body rendering itself lives in the shared
 * {@link BodyStateView}; this component only decides single-pane vs split and
 * classifies each side.
 */
export function ResponseBodyView({ row, searchHighlight, searchMatchIndex, onOverrideResponse }: ResponseBodyViewProps) {
  const lc = row.lifecycle;
  const declaredMime = lifecycleMimeType(lc) ?? currentHarEntry(lc)?.response?.content?.mimeType ?? '';
  const servedState = useMemo(() => classifyBodyState(lc), [lc]);
  const fallbackBytes = lifecycleTransferredBytes(lc) ?? 0;
  const overrideAction = onOverrideResponse ? (
    <OverrideBodyButton
      label="Override Response"
      title="Create a rule that serves this response as an editable mock"
      onClick={onOverrideResponse}
    />
  ) : undefined;

  const servedPane = (
    <BodyStateView
      state={servedState}
      declaredMime={declaredMime}
      searchHighlight={searchHighlight}
      searchMatchIndex={searchMatchIndex}
      toolbarAction={overrideAction}
      fallbackByteCount={fallbackBytes}
    />
  );

  // Two-sided: a network-source rule served a modified body over a real reply.
  // Show the real server response beside the served one — the original pane is
  // read-only (no Override CTA).
  const original = lc.responseOverride?.original;
  if (original) {
    return (
      <SplitBodyView
        startLabel="Served · Open Headers"
        start={servedPane}
        endLabel="Original · server"
        end={
          <BodyStateView
            state={classifyResponseSnapshot(original)}
            declaredMime={snapshotMime(original) || declaredMime}
            fallbackByteCount={fallbackBytes}
          />
        }
      />
    );
  }

  return servedPane;
}
