/**
 * MarkdownView — the app-standard markdown renderer (react-markdown +
 * GitHub-flavored markdown). Renders to React elements, never through
 * `innerHTML`, so team-synced content (request docs, shared notes) is
 * safe to display as-is. Typography is compact 13px to match the
 * workbench forms; see `markdown.css`.
 *
 * Request-aware extras:
 *   • `{{variable}}` references — bare in prose or written as inline
 *     code — render as the same code chips the rest of the app uses
 *     for template references (`remark-variable-chips`).
 *   • Fenced code blocks delegate to the host's `renderCodeBlock`
 *     when provided (the workbench passes a Monaco-tokenized
 *     highlighter with a copy button); without it they fall back to
 *     the plain styled <code>.
 */

import type React from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkVariableChips } from './remark-variable-chips';
import './markdown.css';

const VAR_CHIP = /^\{\{[A-Za-z0-9_][\w.-]*\}\}$/;

export interface MarkdownViewProps {
  /** Markdown source. */
  children: string;
  className?: string;
  /** Custom fenced-code renderer: receives the block's raw text and
   *  its fence language (undefined for bare ``` fences). */
  renderCodeBlock?: (code: string, lang?: string) => React.ReactNode;
}

const REMARK_PLUGINS = [remarkGfm, remarkVariableChips];

function textOf(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ children, className, renderCodeBlock }) => {
  const components: Components = {
    // Docs can link out (issue trackers, API references) — open in a
    // fresh tab so the workbench tab isn't navigated away.
    a: ({ node: _node, children: linkChildren, ...props }) => (
      <a {...props} target="_blank" rel="noreferrer">
        {linkChildren}
      </a>
    ),
    code: ({ node: _node, className: codeClass, children: codeChildren, ...props }) => {
      const text = textOf(codeChildren);
      const langMatch = /language-([\w+-]+)/.exec(codeClass ?? '');
      const isBlock = langMatch !== null || text.includes('\n');
      if (!isBlock) {
        if (VAR_CHIP.test(text)) return <code className="oh-markdown-var-chip">{text}</code>;
        return (
          <code className={codeClass} {...props}>
            {codeChildren}
          </code>
        );
      }
      if (renderCodeBlock) return renderCodeBlock(text.replace(/\n$/, ''), langMatch?.[1]);
      return (
        <code className={codeClass} {...props}>
          {codeChildren}
        </code>
      );
    },
  };
  return (
    <div className={`oh-markdown${className ? ` ${className}` : ''}`}>
      <Markdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {children}
      </Markdown>
    </div>
  );
};
