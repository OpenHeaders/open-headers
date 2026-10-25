/**
 * PathParamHoverPopover — the popover a `:name` token in the HTTP URL
 * bar opens on hover, the twin of `VariableHoverPopover` for the one
 * token kind that is a request field rather than a variable: the
 * pill names the segment, the field holds the row's value (a template
 * field — a `{{reference}}` inside resolves before the send), Save
 * writes the Path Parameters row through the bar. The tag under the
 * field says what the send does with the row as it stands: a blank
 * row or an unresolved reference inside it goes on the wire as
 * written, a value replaces the segment.
 *
 * Mounted by `VariablePopoverHost` for its `path-param` kind, so the
 * hover grace, the click-in commitment and the dismissal are the
 * variable popover's — one popover open at a time across the two
 * token kinds.
 */

import { SaveOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useUiTheme } from '@openheaders/ui/context/ui-theme';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/dom/useSaveShortcut';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { Button, Tag, theme, Tooltip } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import { TEMPLATE_REGEX } from './highlight';
import TemplateInput from './TemplateInput';
import { useRefClassifier } from './use-ref-classifier';

export interface PathParamHoverPopoverProps {
  anchorEl: HTMLElement;
  /** The parameter's name — the identifier after the colon. */
  name: string;
  /** The row's value as the bar last saw it. */
  value: string;
  /** Writes the row's value; the bar maps it onto its draft by name. */
  onSave: (name: string, value: string) => void;
  collectionId?: string;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Host-controlled visibility for the open/close transition. */
  visible?: boolean;
}

const POPOVER_WIDTH = 380;

type RowState = 'blank' | 'unresolved' | 'resolved';

const STATE_KEY = {
  blank: 'shared.templateInput.pathParam.blank',
  unresolved: 'shared.templateInput.pathParam.unresolved',
  resolved: 'shared.templateInput.pathParam.resolved',
} as const;

const PathParamHoverPopover: React.FC<PathParamHoverPopoverProps> = ({
  anchorEl,
  name,
  value,
  onSave,
  collectionId,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}) => {
  const { token } = theme.useToken();
  const { saveAccent } = useUiTheme();
  const t = useT();
  const classify = useRefClassifier(collectionId);
  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH);
  const [draft, setDraft] = useState(value);
  // The save path reads the ref, never the closure — the save chord's
  // keydown can run before React commits the keystroke's setDraft.
  const draftRef = useRef(value);
  const dirty = draft !== value;
  const { saveLabel, handleSaveRef } = useSaveShortcut();

  // What the send does with the row as the DRAFT stands, so the tag
  // answers the value being typed, not the one saved.
  const state: RowState = (() => {
    if (draft.trim() === '') return 'blank';
    for (const m of draft.matchAll(new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags))) {
      if (classify(m[1]) === 'unresolved') return 'unresolved';
    }
    return 'resolved';
  })();

  const handleSave = (): void => {
    onSave(name, draftRef.current);
    onClose();
  };
  handleSaveRef.current = dirty ? handleSave : null;

  return (
    <div
      ref={popoverRef as React.RefCallback<HTMLDivElement>}
      role="dialog"
      data-variable-popover-root=""
      data-testid="oh-path-param-popover"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: 12,
        // The variable popover's reveal: opacity (never visibility, which
        // the field would inherit and refuse focus under) ANDed with the
        // placement hook's settle flag and the host's close animation.
        opacity: measured && visible ? 1 : 0,
        pointerEvents: measured ? undefined : 'none',
        transform: measured && visible ? 'scale(1)' : 'scale(0.96)',
        transformOrigin: `${position.side === 'above' ? 'bottom' : 'top'} left`,
        transition: 'opacity 120ms ease-out, transform 120ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          data-testid="oh-path-param-popover-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 4,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            border: `1px solid ${token.colorPrimaryBorder}`,
            fontFamily: token.fontFamilyCode,
            fontSize: 12,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {`:${name}`}
        </span>
      </div>

      <TemplateInput
        value={draft}
        onChange={(v) => {
          draftRef.current = v;
          setDraft(v);
        }}
        wrap
        maxRows={8}
        allowClear
        placeholder={t('shared.templateInput.enterValue')}
        aria-label={`:${name}`}
        style={{ width: '100%', fontFamily: token.fontFamilyCode, fontSize: 12 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
        <Tag
          color={state === 'resolved' ? 'default' : 'warning'}
          data-testid="oh-path-param-popover-state"
          style={{ marginInlineEnd: 0, whiteSpace: 'normal' }}
        >
          {t(STATE_KEY[state])}
        </Tag>
        <Tooltip
          title={<ShortcutHintTitle label={saveLabel}>{t('shared.action.save')}</ShortcutHintTitle>}
          placement="bottomRight"
          zIndex={1090}
        >
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            disabled={!dirty}
            onClick={handleSave}
            style={{ fontSize: 11, flexShrink: 0, ...(dirty ? { background: saveAccent, borderColor: saveAccent } : {}) }}
          >
            {t('shared.action.save')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default PathParamHoverPopover;
