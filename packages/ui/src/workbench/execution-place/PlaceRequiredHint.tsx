/**
 * PlaceRequiredHint — the hover on a primary button (Send, Connect,
 * Invoke) that this surface cannot run itself: the one sentence and a
 * button that opens the place picker, so the way around — the desktop
 * app, or a server where no desktop app can be installed — is one
 * click from the disabled button rather than a discovery. Inactive,
 * it renders its child alone.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Popover, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

export interface PlaceRequiredHintProps {
  /** Render the hint; false passes the child through untouched. */
  active: boolean;
  /** The reader's reason sentence for the disabled primary. */
  reason: string;
  /** Open the place picker. */
  onChoose: () => void;
  children: React.ReactNode;
}

export const PlaceRequiredHint: React.FC<PlaceRequiredHintProps> = ({ active, reason, onChoose, children }) => {
  const t = useT();
  if (!active) return <>{children}</>;
  return (
    <Popover
      trigger="hover"
      placement="bottom"
      content={
        <div
          data-testid="execution-place-hint"
          style={{ maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}
        >
          <Text style={{ fontSize: 12 }}>{t('shared.executionPlace.hint.cannotRunHere')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {reason}
          </Text>
          <Button size="small" type="primary" onClick={onChoose} style={{ fontSize: 11 }}>
            {t('shared.executionPlace.hint.choose')}
          </Button>
        </div>
      }
    >
      <span style={{ display: 'inline-flex' }}>{children}</span>
    </Popover>
  );
};
