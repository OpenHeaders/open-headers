/**
 * FileTypeIcon — the per-type icon before a changes-tree row name,
 * resolved from the file's extension and porcelain status to one of
 * the 16px icons in `file-type-icons`: markdown, shell, YAML, JSON,
 * XML, HTML, TS / JS badges, image, module, the ⊘ glyph for git
 * dotfiles, text lines for plain text and for any unknown extension
 * that still exists, `?` for a deleted file whose type cannot be read
 * (a type is sniffed from content, which a deleted file no longer
 * has). A symlink row — a type change (`T`) or a row the host flagged
 * (an untracked or newly added link) — carries the link arrow overlay.
 * The theme picks the light or dark variant's fills.
 */

import type React from 'react';
import { useTheme } from '@openheaders/ui/context';
import {
  type FileTypeIconComponent,
  FolderIcon,
  HtmlIcon,
  IgnoredIcon,
  ImageIcon,
  JavaScriptIcon,
  JsonIcon,
  MarkdownIcon,
  ModuleIcon,
  ShellIcon,
  TextIcon,
  TypeScriptIcon,
  UnknownIcon,
  XmlIcon,
  YamlIcon,
} from './file-type-icons';

export interface FileTypeIconProps {
  path: string;
  /** Porcelain status letter — `D` reads `?` on unknown types, `T` carries the symlink arrow. */
  status?: string;
  /** The host's symlink flag — the arrow overlay on rows porcelain cannot type. */
  symlink?: boolean;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg']);
const TEXT_EXTS = new Set(['txt', 'log', 'env', 'cfg', 'ini', 'conf', 'properties', 'csv']);
const SHELL_EXTS = new Set(['sh', 'bash', 'zsh', 'fish']);

function resolve(ext: string, name: string, status: string | undefined): FileTypeIconComponent {
  if (name === '.gitignore' || name === '.gitattributes') return IgnoredIcon;
  if (ext === 'md' || ext === 'markdown') return MarkdownIcon;
  if (ext === 'yaml' || ext === 'yml') return YamlIcon;
  if (ext === 'json') return JsonIcon;
  if (ext === 'xml') return XmlIcon;
  if (ext === 'html' || ext === 'htm') return HtmlIcon;
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return JavaScriptIcon;
  if (ext === 'ts' || ext === 'tsx') return TypeScriptIcon;
  if (ext === 'iml') return ModuleIcon;
  if (SHELL_EXTS.has(ext)) return ShellIcon;
  if (IMAGE_EXTS.has(ext)) return ImageIcon;
  if (status === 'D' && !TEXT_EXTS.has(ext)) return UnknownIcon;
  return TextIcon;
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({ path, status, symlink }) => {
  const { isDarkMode } = useTheme();
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot + 1);
  const Icon = resolve(ext, name, status);
  const linked = status === 'T' || symlink === true;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 16,
        flex: '0 0 auto',
      }}
      data-testid="commit-tool-file-icon"
      data-ext={ext}
      data-linked={linked ? 'true' : undefined}
    >
      <Icon dark={isDarkMode} linked={linked} />
    </span>
  );
};

/** The directory row's folder, in the theme's fills — every changes tree shares it. */
export const FolderTypeIcon: React.FC = () => {
  const { isDarkMode } = useTheme();
  return <FolderIcon dark={isDarkMode} />;
};
