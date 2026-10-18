/**
 * OptionLabel — label cell of an options-popover grid: the short
 * protocol name; the explanation lives behind the standard (i) popover
 * with the shared example session, never inline. `strong` makes it a
 * section title; `mark` hangs a raw wire token after the text (the
 * gear popovers' section rows wear their PACKET — the one word that
 * tells the four user-property homes apart, in the cards' kicker
 * dress); `modified` / `unsaved` add the Settings rows' accent dot
 * (neutral while the knob is off its default, salmon while it differs
 * from the saved request — the S6 palette, salmon winning): a knob row
 * carries it in a reserved slot BEFORE the text, so the label column
 * keeps one left edge and the dot reads in the gutter beside it; a
 * section row carries it after the text, the group headers' way, with
 * no gutter. Shared by the topic-options and message-properties
 * popovers.
 */

import { ModifiedDot } from '@openheaders/ui/shared/settings-rows';
import { Typography, theme } from 'antd';
import type React from 'react';
import { InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';

const { Text } = Typography;

const OptionLabel: React.FC<{
  text: string;
  info: InfoPopoverContent;
  strong?: boolean;
  mark?: string;
  modified?: boolean;
  unsaved?: boolean;
}> = ({ text, info, strong, mark, modified, unsaved }) => {
  const { token } = theme.useToken();
  const dotted = unsaved === true || modified === true;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} data-testid="oh-option-label">
      {/* A knob row's dot slot leads the row and is always laid out —
        the user's call: every knob label starts the same distance in
        and the dot lands in the gutter, so a row never shifts when it
        earns or loses its dot. A section row (strong) keeps the group
        headers' trailing dot and no gutter. */}
      {strong !== true && (
        <span style={{ display: 'inline-flex', justifyContent: 'center', width: 16, flexShrink: 0 }}>
          {dotted && <ModifiedDot unsaved={unsaved} />}
        </span>
      )}
      <Text
        type={strong === true ? undefined : 'secondary'}
        strong={strong}
        style={{ fontSize: 11, whiteSpace: 'nowrap' }}
      >
        {text}
      </Text>
      {strong === true && dotted && <ModifiedDot unsaved={unsaved} />}
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
