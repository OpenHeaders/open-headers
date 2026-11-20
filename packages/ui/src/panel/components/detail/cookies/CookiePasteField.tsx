/**
 * The Add cookie form's paste row — a `Set-Cookie` or `Cookie` header
 * pasted here fills the fields below it.
 *
 * It must never read as the form's first field: it is a shortcut, set
 * apart by a dashed outline and the fill glyph, with a caption that is
 * ALWAYS there — idle it says the row is optional and what it does,
 * after a paste it says what was read and offers Undo, on text it
 * can't use it says why. One line that changes its words, so nothing
 * below it shifts. The same glyph then marks each field the paste
 * filled (the form mounts it on the labels).
 *
 * Reading is a transform, never a write: nothing reaches the jar until
 * Save, so the fill happens on the paste itself (or Enter on typed
 * text) with no confirm step, replacing whatever the form held. The way
 * back is per field (the form's label marks) and, here, all at once —
 * for as long as something the paste changed is still in the form.
 *
 * Text holding SEVERAL cookies fills nothing: where the host takes a
 * batch (`onList`) it becomes the form's checklist, otherwise the
 * caption says to paste one at a time.
 */

import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input } from 'antd';
import { useState } from 'react';
import type { CookieEditFormValues } from '../../../data/cookies/cookie-edit';
import {
  type CookiePasteFill,
  fillFromPaste,
  type PastedCookie,
  readCookiePaste,
} from '../../../data/cookies/cookie-paste';
import { CookiePasteInfo } from './CookieEditFieldInfo';

type PasteFailure = { kind: 'several'; count: number } | { kind: 'unreadable' };

interface CookiePasteFieldProps {
  values: CookieEditFormValues;
  /** The fill still standing in the form — `null` once nothing it
   *  changed is left. */
  fill: CookiePasteFill | null;
  onFill: (fill: CookiePasteFill) => void;
  onUndo: () => void;
  disabled: boolean;
  /** How many cookies the form's checklist currently holds, `null` when
   *  the form is a single cookie. */
  listed: number | null;
  /** Enter the checklist with these cookies, or leave it with `null`.
   *  Absent on a host that takes no batch. */
  onList?: (cookies: readonly PastedCookie[] | null) => void;
}

export function CookiePasteField({ values, fill, onFill, onUndo, disabled, listed, onList }: CookiePasteFieldProps) {
  const t = useT();
  const [text, setText] = useState('');
  const [failure, setFailure] = useState<PasteFailure | null>(null);

  const read = (raw: string): void => {
    if (raw.trim() === '') return;
    const now = Date.now();
    const cookies = readCookiePaste(raw, now);
    if (cookies.length > 1 && onList !== undefined) {
      setText('');
      setFailure(null);
      onList(cookies);
      return;
    }
    if (cookies.length !== 1) {
      setText(raw);
      setFailure(cookies.length === 0 ? { kind: 'unreadable' } : { kind: 'several', count: cookies.length });
      return;
    }
    setText('');
    setFailure(null);
    onList?.(null);
    onFill(fillFromPaste(values, cookies[0], now));
  };

  const placeholder = t('panel.inspector.cookies.edit.paste.placeholder');
  const undo = (label: string, run: () => void) => (
    <Button type="link" size="small" disabled={disabled} onClick={run}>
      {label}
    </Button>
  );

  return (
    <div className="dt-cookie-paste">
      <Input
        size="small"
        className="dt-cookie-paste-input"
        prefix={<ThunderboltOutlined />}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        allowClear
        status={failure !== null ? 'error' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setFailure(null);
        }}
        onPaste={(e) => {
          e.preventDefault();
          read(e.clipboardData.getData('text'));
        }}
        onPressEnter={() => read(text)}
      />
      {failure !== null ? (
        <div className="dt-cookie-paste-status dt-cookie-paste-status--error">
          <span>
            {failure.kind === 'several'
              ? t('panel.inspector.cookies.edit.paste.several', { count: failure.count })
              : t('panel.inspector.cookies.edit.paste.unreadable')}
            <CookiePasteInfo />
          </span>
        </div>
      ) : listed !== null ? (
        <div className="dt-cookie-paste-status dt-cookie-paste-status--done">
          <span>
            <CheckOutlined />
            {t('panel.inspector.cookies.edit.paste.listed', { count: listed })}
          </span>
          {undo(t('panel.inspector.cookies.edit.paste.undo'), () => onList?.(null))}
        </div>
      ) : fill !== null ? (
        <div className="dt-cookie-paste-status dt-cookie-paste-status--done">
          <span>
            <CheckOutlined />
            {[
              fill.fromSetCookie
                ? t('panel.inspector.cookies.edit.paste.filledSetCookie')
                : t('panel.inspector.cookies.edit.paste.filledPair'),
              fill.ignored.length > 0
                ? t('panel.inspector.cookies.edit.paste.ignored', { list: fill.ignored.join(', ') })
                : '',
              fill.expired ? t('panel.inspector.cookies.edit.paste.expired') : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {undo(t('panel.inspector.cookies.edit.paste.undoAll'), onUndo)}
        </div>
      ) : (
        <div className="dt-cookie-paste-status">
          <span>
            {t('panel.inspector.cookies.edit.paste.hint')}
            <CookiePasteInfo />
          </span>
        </div>
      )}
    </div>
  );
}
