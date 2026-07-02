import { useMemo } from 'react';
import { currentHarEntry, type InspectorRowWithFires, lifecycleMimeType, lifecycleTransferredBytes } from '../../data/inspector-row-projection';
import { classifyBodyState, classifyResponseSnapshot, snapshotMime } from '../../data/response-body-state';
import OverrideBodyButton from './OverrideBodyButton';
import PreviewPane from './PreviewPane';
import SplitBodyView from './SplitBodyView';

interface PreviewViewProps {
  row: InspectorRowWithFires;
  /** Open the create-rule editor pre-filled to mock this response. */
  onOverrideResponse?: () => void;
}

/**
 * The Preview tab — pretty-printed body the page received, and (for a
 * network-source response rule) the real server response beside it
 * (Modified | Original). The rendering lives in the shared {@link PreviewPane};
 * this component decides single-pane vs split and classifies each side.
 */
export default function PreviewView({ row, onOverrideResponse }: PreviewViewProps) {
  const lc = row.lifecycle;
  const har = currentHarEntry(lc);
  const mime = lifecycleMimeType(lc) ?? har?.response?.content?.mimeType ?? '';
  const size = lifecycleTransferredBytes(lc) ?? har?.response?.content?.size ?? 0;
  const servedState = useMemo(() => classifyBodyState(lc), [lc]);
  // The override CTA is a rule scaffold, not a mirror of the captured response
  // — it shows in every state (even no-body ones).
  const overrideButton = onOverrideResponse ? (
    <OverrideBodyButton
      label="Override Response"
      title="Create a rule that serves this response as an editable mock"
      onClick={onOverrideResponse}
    />
  ) : null;

  const servedPane = <PreviewPane state={servedState} mime={mime} size={size} action={overrideButton} />;

  const original = lc.responseOverride?.original;
  if (original) {
    const originalMime = snapshotMime(original) || mime;
    return (
      <SplitBodyView
        startLabel="Modified · Open Headers"
        start={servedPane}
        endLabel="Original · server"
        end={<PreviewPane state={classifyResponseSnapshot(original)} mime={originalMime} size={size} />}
      />
    );
  }

  return servedPane;
}
