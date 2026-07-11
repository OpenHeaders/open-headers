/**
 * DetectedValueInput — a TemplateInput with the value edit action wired
 * in (`useValueEditAction`), shaped for AntD `<Form.Item>`: value /
 * onChange stay optional so the form can inject them at clone time.
 * Rule editors use this for action-side value fields (header values,
 * auth credentials, query-param values, redirect targets) so a detected
 * JWT / base64 / structured header value gets the in-field edit icon
 * and modal. Everything else passes through to TemplateInput untouched
 * — the grid counterpart with explicit value/onChange is
 * `GridValueField`.
 */

import type React from 'react';
import { TemplateInput, type TemplateInputProps } from '../template-input';
import { useValueEditAction, type ValueEditActionOptions } from './useValueEditAction';

export type DetectedValueInputProps = Omit<TemplateInputProps, 'onValueEdit' | 'editTooltip'> & {
  /** `compact` swaps the editor modals for the inline
   *  `CompactValueEditor` — for popover hosts (the panel's rule
   *  quick-editor) where a portal modal can't live. */
  editorVariant?: ValueEditActionOptions['variant'];
  /** Compact variant only — the inline editor's footer offers "Open as
   *  document" when set (see `ValueEditActionOptions.onOpenDocument`). */
  onOpenDocument?: ValueEditActionOptions['onOpenDocument'];
};

const noopChange = (): void => {};

export const DetectedValueInput: React.FC<DetectedValueInputProps> = ({
  value,
  onChange,
  editorVariant,
  onOpenDocument,
  ...rest
}) => {
  const { editProps, editorModal } = useValueEditAction(value, onChange ?? noopChange, {
    variant: editorVariant,
    onOpenDocument,
  });
  return (
    <>
      <TemplateInput {...rest} {...editProps} value={value} onChange={onChange} />
      {editorModal}
    </>
  );
};
