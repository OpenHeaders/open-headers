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
import { useValueEditAction } from './useValueEditAction';

export type DetectedValueInputProps = Omit<TemplateInputProps, 'onValueEdit' | 'editTooltip'>;

const noopChange = (): void => {};

export const DetectedValueInput: React.FC<DetectedValueInputProps> = ({ value, onChange, ...rest }) => {
  const { editProps, editorModal } = useValueEditAction(value, onChange ?? noopChange);
  return (
    <>
      <TemplateInput {...rest} {...editProps} value={value} onChange={onChange} />
      {editorModal}
    </>
  );
};
