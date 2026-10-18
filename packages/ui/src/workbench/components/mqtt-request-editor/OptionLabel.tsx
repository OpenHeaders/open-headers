/**
 * OptionLabel — label cell of an options-popover grid: the short
 * protocol name; the explanation lives behind the standard (i) popover
 * with the shared example session, never inline. `strong` makes it a
 * section title; `mark` hangs a raw wire token after the text (the
 * gear popovers' section rows wear their PACKET — the one word that
 * tells the four user-property homes apart, in the cards' kicker
 * dress).
 * Shared by the topic-options and message-properties popovers.
 */

import { Typography, theme } from 'antd';
import type React from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

const OptionLabel: React.FC<{ text: string; info: InfoPopoverContent; strong?: boolean; mark?: string }> = ({
  text,
  info,
  strong,
  mark,
}) => {
  const { token } = theme.useToken();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Text
        type={strong === true ? undefined : 'secondary'}
        strong={strong}
        style={{ fontSize: 11, whiteSpace: 'nowrap' }}
      >
        {text}
      </Text>
      {mark !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.06em',
            lineHeight: '14px',
            padding: '0 4px',
            marginLeft: 2,
            borderRadius: 3,
            border: `1px solid ${token.colorBorderSecondary}`,
            color: token.colorTextTertiary,
          }}
          data-testid="oh-option-label-mark"
        >
          {mark}
        </span>
      )}
      <InfoTrigger content={info} />
    </span>
  );
};

export default OptionLabel;
