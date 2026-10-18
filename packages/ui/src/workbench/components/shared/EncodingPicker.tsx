/**
 * EncodingPicker — the compose bars' encoding control in the body
 * viewers' picker dress (`BodyViewPicker`): one button — glyph + the
 * encoding in force + chevron — over one menu of the host's encodings,
 * the grammars above the divider and the byte spellings below it,
 * each row glyph + label. The host hands it the options (value, label,
 * glyph id from `ViewPickerIcons`) and where the divider falls; the
 * MQTT compose bars (Message, Last Will, the example view) and the
 * WebSocket compose bars (format, binary spelling) wear it — the
 * user's call, S8: a reader moving between a compose bar and a viewer
 * meets the same control.
 */

import { DownOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Dropdown, type MenuProps, theme } from 'antd';
import type React from 'react';
import { ViewPickerIcon } from '../request-editor/response/ViewPickerIcons';

export interface EncodingPickerOption<V extends string> {
  value: V;
  label: string;
  /** A `ViewPickerIcons` mark id. */
  icon: string;
}

function PickerLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <ViewPickerIcon id={icon} size={16} />
      {text}
    </span>
  );
}

export function EncodingPicker<V extends string>({
  value,
  options,
  divideAfter,
  onChange,
  testId,
}: {
  value: V;
  options: ReadonlyArray<EncodingPickerOption<V>>;
  /** Count of options above the divider (the grammars); none = no divider. */
  divideAfter?: number;
  onChange: (value: V) => void;
  testId: string;
}): React.ReactElement {
  const { token } = theme.useToken();
  const items: MenuProps['items'] = options.flatMap((option, index) => [
    { key: option.value, label: <PickerLabel icon={option.icon} text={option.label} /> },
    ...(divideAfter !== undefined && index === divideAfter - 1 && index < options.length - 1
      ? [{ type: 'divider' as const }]
      : []),
  ]);
  const onClick: MenuProps['onClick'] = ({ key }) => {
    const picked = options.find((option) => option.value === key);
    if (picked !== undefined) onChange(picked.value);
  };
  const active = options.find((option) => option.value === value) ?? options[0];
  return (
    <ConfigProvider theme={{ token: { fontSize: 12 }, components: { Dropdown: { paddingBlock: 3 } } }}>
      <Dropdown menu={{ items, onClick, selectable: true, selectedKeys: [value] }} trigger={['click']}>
        <Button size="small" type="text" data-testid={testId} style={{ background: token.colorBgTextActive }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ViewPickerIcon id={active.icon} size={14} />
            <span data-testid={`${testId}-label`}>{active.label}</span>
            <DownOutlined style={{ fontSize: 9, opacity: 0.65 }} />
          </span>
        </Button>
      </Dropdown>
    </ConfigProvider>
  );
}

export default EncodingPicker;
