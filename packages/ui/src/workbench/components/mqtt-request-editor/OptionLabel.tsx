/**
 * OptionLabel — label cell of an options-popover grid: the short
 * protocol name; the explanation lives behind the standard (i) popover
 * with the shared example session, never inline. `strong` makes it a
 * section title. Shared by the topic-options and message-properties
 * popovers.
 */

import { Typography } from 'antd';
import type React from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

const OptionLabel: React.FC<{ text: string; info: InfoPopoverContent; strong?: boolean }> = ({
  text,
  info,
  strong,
}) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <Text
      type={strong === true ? undefined : 'secondary'}
      strong={strong}
      style={{ fontSize: 11, whiteSpace: 'nowrap' }}
    >
      {text}
    </Text>
    <InfoTrigger content={info} />
  </span>
);

export default OptionLabel;
