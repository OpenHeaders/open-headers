/**
 * PlaceRequiredHint — the hover on a primary button (Send, Connect,
 * Invoke, Query) that will not run as configured: the headline names
 * the case — a kind this surface cannot run itself, or a place the
 * user chose that the surface cannot honour (the request could run
 * here; the user said elsewhere) — over the reader's reason sentence
 * and a button that opens the place picker, so the way around is one
 * click from the disabled button rather than a discovery. Choosing
 * closes the hint itself: the pointer is still over it when the picker
 * opens, and two popovers must never stack. Inactive, it renders its
 * child alone.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Popover, Typography } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { executionPlaceHintTitle } from './execution-place-copy';
import type { ExecutionPlaceResolution } from './resolve-execution-place';

const { Text } = Typography;

export interface PlaceRequiredHintProps {
  /** Render the hint; false passes the child through untouched. */
  active: boolean;
  /** The reader's resolution — the headline follows its reason. */
  resolution: ExecutionPlaceResolution;
  /** The reason sentence for the disabled primary. */
  reason: string;
  /** Open the place picker. */
  onChoose: () => void;
  children: React.ReactNode;
}

export const PlaceRequiredHint: React.FC<PlaceRequiredHintProps> = ({
  active,
  resolution,
  reason,
  onChoose,
  children,
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!active) return <>{children}</>;
  return (
    <Popover
      trigger="hover"
      placement="bottom"
      open={open}
      onOpenChange={setOpen}
      content={
        <div
          data-testid="execution-place-hint"
          style={{ maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}
        >
          <Text style={{ fontSize: 12 }}>{executionPlaceHintTitle(resolution, t)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {reason}
          </Text>
          <Button
            size="small"
            type="primary"
            data-testid="execution-place-hint-choose"
            onClick={() => {
              setOpen(false);
              onChoose();
            }}
            style={{ fontSize: 11 }}
          >
            {t('shared.executionPlace.hint.choose')}
          </Button>
        </div>
      }
    >
      <span style={{ display: 'inline-flex' }}>{children}</span>
    </Popover>
  );
};
