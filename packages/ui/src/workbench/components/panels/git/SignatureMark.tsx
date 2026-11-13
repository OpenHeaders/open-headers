/**
 * SignatureMark — a signed commit's mark in the log's GPG Signature
 * column: verified (a checked shield), signed but not vouched for (a
 * warning), or not valid (a cross) — each its own glyph AND tone, never
 * told apart by colour alone — with the signer and the key in the hover. A
 * commit that carries no signature has no mark.
 */

import { CloseCircleOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { GIT_TEXT_SIZE } from './git-type-scale';
import type { CommitSignature } from './use-commit-signatures';

export interface SignatureMarkProps {
  /** Absent = the commit is not signed (or not answered yet). */
  signature: CommitSignature | undefined;
}

const SignatureMark: React.FC<SignatureMarkProps> = ({ signature }) => {
  const t = useT();
  const { token } = theme.useToken();
  if (signature === undefined) return null;
  const face =
    signature.state === 'good'
      ? { glyph: <SafetyCertificateOutlined />, color: token.colorSuccess, label: t('workbench.gitLog.signature.good') }
      : signature.state === 'bad'
        ? { glyph: <CloseCircleOutlined />, color: token.colorError, label: t('workbench.gitLog.signature.bad') }
        : { glyph: <WarningOutlined />, color: token.colorWarning, label: t('workbench.gitLog.signature.unverified') };
  const lines = [
    face.label,
    ...(signature.signer === undefined ? [] : [t('workbench.gitLog.signature.signer', { signer: signature.signer })]),
    ...(signature.key === undefined ? [] : [t('workbench.gitLog.signature.key', { key: signature.key })]),
  ];
  return (
    <span
      role="img"
      aria-label={face.label}
      title={lines.join('\n')}
      style={{ display: 'inline-flex', fontSize: GIT_TEXT_SIZE, color: face.color }}
      data-testid="git-tool-row-signature-mark"
      data-state={signature.state}
    >
      {face.glyph}
    </span>
  );
};

export default SignatureMark;
