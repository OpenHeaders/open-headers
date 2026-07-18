/**
 * StreamRowViewAction — the hover view eye on a WS frame / SSE event
 * row whose payload is one detected encoded value (base64, JWT, JSON,
 * …). The row-level twin of the preview pane's Decode chip: the eye
 * anchors the shared glance → modal / snapshot-tab ladder, so a frame
 * announces WHAT it carries before the user commits a click to the
 * preview. Detection runs over the full stored payload (the rolling
 * ring holds it — never a clipped cell) and is memoized per payload;
 * plain frames render nothing. Mounted only for the virtualized
 * visible slice, so scroll cost stays bounded.
 */

import { EyeOutlined } from '@ant-design/icons';
import { detectValueType } from '@openheaders/ui/shared/value-detection';
import { useValueViewAction } from '@openheaders/ui/workbench/components/value-editors/useValueViewAction';
import { useMemo } from 'react';
import { useOpenValueViewDocument } from '../../../data/value-view-intent';

export function StreamRowViewAction({ payload }: { payload: string }) {
  const detected = useMemo(() => detectValueType(payload), [payload]);
  const openValueView = useOpenValueViewDocument();
  const { viewProps, glance, viewerModal } = useValueViewAction(detected, { openAsTab: openValueView });
  if (!('viewTooltip' in viewProps)) return null;
  return (
    <>
      {glance(
        <button
          type="button"
          className="dt-btn dt-btn-primary dt-ws-action dt-ws-action--icon"
          title={viewProps.viewTooltip}
          aria-label={viewProps.viewTooltip}
          // The eye must never double as the row's select gesture — the
          // glance is its own layer (rc-trigger runs its own handler on
          // this same click, so the popover still opens).
          onClick={(e) => e.stopPropagation()}
        >
          <EyeOutlined />
        </button>,
      )}
      {viewerModal}
    </>
  );
}
