/**
 * FileTypeIcon — the per-type glyph before a changes-tree row name
 * (IDE reference): `{}` for JSON, `</>` for markup, a JS/TS badge,
 * ⊘ for git dotfiles, plain file glyphs for text/images/rest. Colored
 * text glyphs mirror the IDE's file-type tints; outline icons stay on
 * the tertiary text color.
 */

import { FileImageOutlined, FileOutlined, FileTextOutlined, StopOutlined } from '@ant-design/icons';
import { theme } from 'antd';
import type React from 'react';

const GLYPH_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  flex: '0 0 auto',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1,
};

export const FileTypeIcon: React.FC<{ path: string }> = ({ path }) => {
  const { token } = theme.useToken();
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const ext = name.slice(name.lastIndexOf('.') + 1);

  if (name === '.gitignore' || name === '.gitattributes') {
    return <StopOutlined style={{ ...GLYPH_STYLE, fontSize: 15, color: token.colorTextTertiary }} />;
  }
  if (ext === 'json') return <span style={{ ...GLYPH_STYLE, color: '#9876AA' }}>{'{}'}</span>;
  if (ext === 'xml' || ext === 'html' || ext === 'svg') {
    return <span style={{ ...GLYPH_STYLE, fontSize: 12, color: '#E8A33D' }}>{'</>'}</span>;
  }
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') {
    return <span style={{ ...GLYPH_STYLE, fontSize: 11, color: '#E9CA4B' }}>JS</span>;
  }
  if (ext === 'ts' || ext === 'tsx') return <span style={{ ...GLYPH_STYLE, fontSize: 11, color: '#548AF7' }}>TS</span>;
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'ico') {
    return <FileImageOutlined style={{ ...GLYPH_STYLE, fontSize: 15, color: token.colorTextTertiary }} />;
  }
  if (ext === 'yaml' || ext === 'yml' || ext === 'md' || ext === 'txt' || ext === 'log') {
    return <FileTextOutlined style={{ ...GLYPH_STYLE, fontSize: 15, color: token.colorTextTertiary }} />;
  }
  return <FileOutlined style={{ ...GLYPH_STYLE, fontSize: 15, color: token.colorTextTertiary }} />;
};
