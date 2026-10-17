/**
 * BodyViewPicker — the one view picker every read-only body viewer
 * wears: the HTTP response body's picker (born there) shared with the
 * timeline message viewers and the SSE event viewer. One button —
 * icon + the view in force + chevron — over one menu: the languages
 * above the divider (picking one means Pretty under that grammar),
 * the byte-level encoding views (Raw / Hex / Base64) below it. The
 * host owns the state: it passes the language and the encoding view
 * in force and takes the picks back; `open` / `onOpenChange` are
 * optional so the HTTP body can keep its Preview two-way toggle on the
 * trigger while the timelines leave the menu uncontrolled.
 */

import { DownOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Dropdown, type MenuProps, theme } from 'antd';
import type React from 'react';
import { getLanguage, LANGUAGE_LIST, type LanguageId } from '../../languages/registry';
import { ViewPickerIcon } from '../request-editor/response/ViewPickerIcons';

/** The byte-level views — how the body's bytes read, no grammar. */
export type EncodingView = 'raw' | 'hex' | 'base64';

export const ENCODING_VIEWS: ReadonlyArray<{ mode: EncodingView; label: string }> = [
  { mode: 'raw', label: 'Raw' },
  { mode: 'hex', label: 'Hex' },
  { mode: 'base64', label: 'Base64' },
];

/** Language half of the picker — every registry language a body can
 *  plausibly be, i.e. all but graphql (no response media type and no
 *  Monaco grammar). */
export const PICKER_LANGUAGES: readonly LanguageId[] = LANGUAGE_LIST.filter((l) => l.id !== 'graphql').map(
  (l) => l.id,
);

const LANGUAGE_BY_KEY = new Map(PICKER_LANGUAGES.map((id) => [`lang:${id}`, id]));

function PickerLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <ViewPickerIcon id={icon} size={16} />
      {text}
    </span>
  );
}

interface BodyViewPickerProps {
  /** The grammar in force — the picker's label while no encoding view
   *  is, and the language half's selected row. */
  language: LanguageId;
  /** The encoding view in force, or `null` for Pretty under `language`. */
  view: EncodingView | null;
  /** Hide the language half — a binary body has no grammar to read under. */
  languagesHidden?: boolean;
  onPickLanguage: (language: LanguageId) => void;
  onPickView: (view: EncodingView) => void;
  /** The trigger's quiet selected fill — off while another control
   *  (the HTTP body's Preview) holds the selection. Defaults to on. */
  selected?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  ariaLabel: string;
  testId: string;
}

const BodyViewPicker: React.FC<BodyViewPickerProps> = ({
  language,
  view,
  languagesHidden = false,
  onPickLanguage,
  onPickView,
  selected = true,
  open,
  onOpenChange,
  ariaLabel,
  testId,
}) => {
  const { token } = theme.useToken();
  const items: MenuProps['items'] = [
    ...(languagesHidden
      ? []
      : [
          ...PICKER_LANGUAGES.map((id) => ({
            key: `lang:${id}`,
            label: <PickerLabel icon={id} text={getLanguage(id).label} />,
          })),
          { type: 'divider' as const },
        ]),
    ...ENCODING_VIEWS.map((encoding) => ({
      key: `view:${encoding.mode}`,
      label: <PickerLabel icon={encoding.mode} text={encoding.label} />,
    })),
  ];
  const onClick: MenuProps['onClick'] = ({ key }) => {
    const lang = LANGUAGE_BY_KEY.get(key);
    if (lang !== undefined) {
      onPickLanguage(lang);
      return;
    }
    const encoding = ENCODING_VIEWS.find((candidate) => key === `view:${candidate.mode}`);
    if (encoding !== undefined) onPickView(encoding.mode);
  };
  const active = view === null ? null : ENCODING_VIEWS.find((candidate) => candidate.mode === view);
  const selectedKey = active ? `view:${active.mode}` : `lang:${language}`;
  const icon = active ? active.mode : language;
  const label = active ? active.label : getLanguage(language).label;
  return (
    <ConfigProvider theme={{ token: { fontSize: 12 }, components: { Dropdown: { paddingBlock: 3 } } }}>
      <Dropdown
        menu={{ items, onClick, selectable: true, selectedKeys: [selectedKey] }}
        trigger={['click']}
        {...(open !== undefined ? { open } : {})}
        {...(onOpenChange !== undefined ? { onOpenChange } : {})}
      >
        <Button
          size="small"
          type="text"
          data-testid={testId}
          aria-label={ariaLabel}
          style={selected ? { background: token.colorBgTextActive } : undefined}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ViewPickerIcon id={icon} size={14} />
            <span data-testid={`${testId}-label`}>{label}</span>
            {selected && <DownOutlined style={{ fontSize: 9, opacity: 0.65 }} />}
          </span>
        </Button>
      </Dropdown>
    </ConfigProvider>
  );
};

export default BodyViewPicker;
