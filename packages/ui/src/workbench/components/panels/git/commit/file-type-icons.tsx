/**
 * file-type-icons — the Commit window's 16px file-type icon set, drawn
 * in-house: four text lines, the markdown M with a down arrow, the
 * shell box with a prompt, the YAML page with its Y, JSON braces, the
 * XML and HTML chevrons, filled TS / JS badges, the picture frame, the
 * `?` page for a file whose type cannot be read, the module box, and
 * the ⊘ ignored glyph, and the filled folder every changes tree
 * puts before a directory row. Every icon carries both themes' fills, chosen
 * by the caller; a symlink lays the link arrow over the base icon
 * (the markdown icon drops its own arrow underneath).
 */

import type React from 'react';

export interface FileTypeIconProps {
  dark: boolean;
  /** A symlink — the top-right link arrow overlays the type's icon. */
  linked?: boolean;
}

export type FileTypeIconComponent = React.FC<FileTypeIconProps>;

const BOX: React.CSSProperties = { display: 'block', width: 16, height: 16, flex: '0 0 auto' };

const Svg: React.FC<React.PropsWithChildren> = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={BOX} aria-hidden>
    {children}
  </svg>
);

/** Stroke attributes shared by every line-drawn glyph. */
const LINE = { strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** The gray family's ink and fill per theme. */
const ink = (dark: boolean): string => (dark ? '#BFC2C9' : '#70747F');
const fill = (dark: boolean): string => (dark ? '#3C3F45' : '#EDEEF2');
const blue = (dark: boolean): string => (dark ? '#5A8DEE' : '#2E6BDF');

/** The link arrow in the top-right corner. */
const LinkOverlay: React.FC<{ dark: boolean }> = ({ dark }) => (
  <path d="M10.5 5.5L15 1M11.5 1H15v3.5" stroke={ink(dark)} {...LINE} />
);

/** The directory row's filled folder (the reference's 16px shape): a tab on the left, a body below. */
export const FolderIcon: React.FC<{ dark: boolean }> = ({ dark }) => (
  <Svg>
    <path
      d="M1.5 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 .7.3L7.6 4.4a1 1 0 0 0 .7.3h5.2a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
      fill={dark ? '#9DA2AB' : '#8C919B'}
    />
    <path d="M1.5 6.5h13" stroke={dark ? '#2B2D30' : '#FFFFFF'} strokeWidth="1" />
  </Svg>
);

export const TextIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h7" stroke={ink(dark)} {...LINE} />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const MarkdownIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <path d="M2 12V4.5l3 3.5 3-3.5V12" stroke={blue(dark)} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    {linked ? <LinkOverlay dark={dark} /> : <path d="M12.5 5v6M10.3 8.8l2.2 2.2 2.2-2.2" stroke={blue(dark)} {...LINE} />}
  </Svg>
);

export const ShellIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill={fill(dark)} stroke={ink(dark)} />
    <path d="M4.5 6l2.5 2-2.5 2M8.5 10.5h3" stroke={ink(dark)} {...LINE} />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const YamlIcon: FileTypeIconComponent = ({ dark, linked }) => {
  const red = dark ? '#E06C75' : '#C9323F';
  return (
    <Svg>
      <path d="M4.5 1.5h5l3 3v10h-8z" fill={dark ? '#3A2A2C' : '#FFF2F2'} stroke={red} {...LINE} />
      <path d="M9.5 1.5v3h3" stroke={red} {...LINE} />
      <path d="M6.5 7.5l1.75 2.25L10 7.5M8.25 9.75v2.75" stroke={red} {...LINE} />
      {linked && <LinkOverlay dark={dark} />}
    </Svg>
  );
};

export const ImageIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <rect x="2" y="2.5" width="12" height="11" rx="2" fill={dark ? '#283552' : '#E6EEFC'} stroke={blue(dark)} />
    <circle cx="10.5" cy="6" r="1.3" stroke={blue(dark)} />
    <path d="M2.5 11l3-3 2.5 2.5 2-2 4 3.5" stroke={blue(dark)} {...LINE} />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const UnknownIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill={fill(dark)} stroke={ink(dark)} />
    <path d="M6.2 6.6a1.8 1.8 0 1 1 2.7 1.6c-.6.4-.9.8-.9 1.4M8 11.4v.2" stroke={ink(dark)} {...LINE} />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const XmlIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <path d="M5 5l-3 3 3 3M11 5l3 3-3 3M9.5 3l-3 10" stroke={dark ? '#D98B4A' : '#D9661F'} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const HtmlIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <path d="M6 4.5L2 8l4 3.5M10 4.5L14 8l-4 3.5" stroke={dark ? '#5BA86A' : '#2F8F49'} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const JsonIcon: FileTypeIconComponent = ({ dark, linked }) => {
  const purple = dark ? '#B58AE8' : '#7D45D6';
  return (
    <Svg>
      <path
        d="M6.5 2.5c-1.5 0-2 .6-2 1.6v2.2c0 .8-.5 1.4-1.5 1.7 1 .3 1.5.9 1.5 1.7v2.2c0 1 .5 1.6 2 1.6M9.5 2.5c1.5 0 2 .6 2 1.6v2.2c0 .8.5 1.4 1.5 1.7-1 .3-1.5.9-1.5 1.7v2.2c0 1-.5 1.6-2 1.6"
        stroke={purple}
        {...LINE}
      />
      {linked && <LinkOverlay dark={dark} />}
    </Svg>
  );
};

export const IgnoredIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <circle cx="8" cy="8" r="6" fill={fill(dark)} stroke={ink(dark)} />
    <path d="M4 12l8-8" stroke={ink(dark)} {...LINE} />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const ModuleIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Svg>
    <rect x="2.5" y="3" width="11" height="10" rx="2" fill={fill(dark)} stroke={ink(dark)} />
    <path d="M5 10.5h4" stroke={ink(dark)} {...LINE} />
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

/** A filled language badge with its two letters. */
const Badge: React.FC<{ fill: string; letters: string; letterFill: string; linked?: boolean; dark: boolean }> = ({
  fill: badgeFill,
  letters,
  letterFill,
  linked,
  dark,
}) => (
  <Svg>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill={badgeFill} />
    <text
      x="8"
      y="11.2"
      textAnchor="middle"
      fontSize="7.5"
      fontWeight="700"
      fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      fill={letterFill}
    >
      {letters}
    </text>
    {linked && <LinkOverlay dark={dark} />}
  </Svg>
);

export const TypeScriptIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Badge fill={dark ? '#4F86EA' : '#2F6FDF'} letters="TS" letterFill="#FFFFFF" linked={linked} dark={dark} />
);

export const JavaScriptIcon: FileTypeIconComponent = ({ dark, linked }) => (
  <Badge fill={dark ? '#EFC75E' : '#F5B81D'} letters="JS" letterFill="#1F2024" linked={linked} dark={dark} />
);
