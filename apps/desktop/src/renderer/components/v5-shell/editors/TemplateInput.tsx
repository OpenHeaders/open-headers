/**
 * TemplateInput — contentEditable input with inline variable highlighting,
 * hover popovers, and autocomplete suggestions on {{ trigger.
 *
 * Adapted from the wat2 browser-extension MVP TemplateInput.
 */

import { RightOutlined } from '@ant-design/icons';
import { List, Popover, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TemplateInput.css';

const { Text } = Typography;

interface EnvVarInfo {
  value: string;
  isSecret: boolean;
}

export interface TemplateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  envVars?: Record<string, EnvVarInfo>;
  activeEnvironment?: string;
  borderless?: boolean;
  fontSize?: number;
  mono?: boolean;
  onPressEnter?: () => void;
  /** Allow multi-line input (newlines on Enter) */
  multiline?: boolean;
  /** Minimum height for multi-line mode */
  minRows?: number;
  /** Current TOTP code for [[TOTP_CODE]] popover display. */
  totpCode?: string;
  /** Whether TOTP is enabled and has a secret configured. */
  totpReady?: boolean;
  style?: React.CSSProperties;
}

interface VarOverlay {
  varName: string;
  rect: DOMRect;
}

interface TotpOverlay {
  placeholder: string;
  rect: DOMRect;
}

// ── Cursor helpers ────────────────────────────────────────────────

function saveCursorPosition(el: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(el);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function restoreCursorPosition(el: HTMLElement, position: number): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  let charCount = 0;
  let found = false;

  const walk = (node: Node): void => {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent || '').length;
      if (charCount + len >= position) {
        range.setStart(node, position - charCount);
        range.setEnd(node, position - charCount);
        found = true;
      }
      charCount += len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
        if (found) break;
      }
    }
  };

  walk(el);
  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// ── Main component ────────────────────────────────────────────────

export function TemplateInput({
  value,
  onChange,
  placeholder = '',
  envVars,
  activeEnvironment,
  borderless,
  fontSize,
  mono,
  onPressEnter,
  multiline,
  minRows,
  totpCode,
  totpReady,
  style,
}: TemplateInputProps) {
  const { token } = theme.useToken();
  const editableRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [varOverlays, setVarOverlays] = useState<VarOverlay[]>([]);
  const [totpOverlays, setTotpOverlays] = useState<TotpOverlay[]>([]);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Var names that have a non-empty value (truly resolved)
  const resolvedVars = useMemo(() => {
    const set = new Set<string>();
    if (envVars) {
      for (const [name, info] of Object.entries(envVars)) {
        if (info.value) set.add(name);
      }
    }
    return set;
  }, [envVars]);

  // All variables as suggestions
  const allSuggestions = useMemo(() => {
    if (!envVars) return [];
    return Object.entries(envVars).map(([name, info]) => ({
      name,
      value: info.isSecret ? '••••••••' : info.value,
      scope: 'environment' as const,
    }));
  }, [envVars]);

  // Filtered suggestions
  const suggestions = useMemo(() => {
    if (!searchTerm) return allSuggestions.slice(0, 30);
    return allSuggestions.filter((v) => v.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 30);
  }, [searchTerm, allSuggestions]);

  // Build highlighted HTML from text
  const highlightText = useCallback(
    (text: string): string => {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Highlight {{VAR}} references
      const withVars = escaped.replace(/(\{\{([^}]*)\}\})/g, (_match, fullMatch: string, varName: string) => {
        const trimmed = varName.trim();
        const cls = resolvedVars.has(trimmed) ? 'template-var-resolved' : 'template-var-unresolved';
        return `<span class="${cls}" data-var="${trimmed}">${fullMatch}</span>`;
      });
      // Highlight [[TOTP_CODE]] placeholders — purple if TOTP is ready, red if not
      const totpCls = totpReady ? 'template-totp-resolved' : 'template-totp-unresolved';
      return withVars.replace(
        /(\[\[([^\]]*)\]\])/g,
        (_match, fullMatch: string) => `<span class="${totpCls}">${fullMatch}</span>`,
      );
    },
    [resolvedVars, totpReady],
  );

  // Collect overlay positions for popover targets
  const updateOverlays = useCallback(() => {
    if (!editableRef.current) return;
    const spans = editableRef.current.querySelectorAll('.template-var-resolved, .template-var-unresolved');
    const overlays: VarOverlay[] = [];
    for (const span of Array.from(spans)) {
      const varName = (span as HTMLElement).getAttribute('data-var');
      if (varName) {
        overlays.push({ varName, rect: span.getBoundingClientRect() });
      }
    }
    setVarOverlays(overlays);

    // TOTP placeholders
    const totpSpans = editableRef.current.querySelectorAll('.template-totp-resolved, .template-totp-unresolved');
    const tOverlays: TotpOverlay[] = [];
    for (const span of Array.from(totpSpans)) {
      tOverlays.push({ placeholder: span.textContent || '', rect: span.getBoundingClientRect() });
    }
    setTotpOverlays(tOverlays);
  }, []);

  // Check if autocomplete should show
  const checkAutocomplete = useCallback((text: string, cursorPos: number) => {
    const beforeCursor = text.substring(0, cursorPos);
    const lastOpenIndex = beforeCursor.lastIndexOf('{{');
    const lastCloseIndex = beforeCursor.lastIndexOf('}}');

    if (lastOpenIndex > -1 && lastOpenIndex > lastCloseIndex) {
      const afterCursor = text.substring(cursorPos);
      const nextCloseIndex = afterCursor.indexOf('}}');
      if (nextCloseIndex === -1) {
        setSearchTerm(beforeCursor.substring(lastOpenIndex + 2));
        setShowAutocomplete(true);
        setSelectedIndex(0);

        const selection = window.getSelection();
        if (selection?.rangeCount) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          setAutocompletePos({ top: rect.bottom + 4, left: rect.left });
        }
        return;
      }
    } else if (beforeCursor.endsWith('{') && !beforeCursor.endsWith('{{')) {
      setSearchTerm('');
      setShowAutocomplete(true);
      setSelectedIndex(0);

      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        setAutocompletePos({ top: rect.bottom + 4, left: rect.left });
      }
      return;
    }

    setShowAutocomplete(false);
  }, []);

  // Insert variable from autocomplete
  const insertVariable = useCallback(
    (varName: string) => {
      if (!editableRef.current) return;

      const text = editableRef.current.textContent || '';
      const cursorPos = saveCursorPosition(editableRef.current);
      const beforeCursor = text.substring(0, cursorPos);
      const afterCursor = text.substring(cursorPos);

      const insertText = `{{${varName}}}`;
      let startPos = -1;

      const doubleBraceMatch = beforeCursor.match(/\{\{([^}]*)$/);
      const singleBraceMatch = beforeCursor.match(/(?<!\{)\{([^{]*)$/);

      if (doubleBraceMatch) {
        startPos = beforeCursor.length - doubleBraceMatch[0].length;
      } else if (singleBraceMatch) {
        startPos = beforeCursor.length - singleBraceMatch[0].length;
      } else if (beforeCursor.endsWith('{')) {
        startPos = beforeCursor.length - 1;
      }

      if (startPos !== -1) {
        const newText = text.substring(0, startPos) + insertText + afterCursor;
        onChange(newText);

        setTimeout(() => {
          if (editableRef.current) {
            editableRef.current.innerHTML = highlightText(newText);
            restoreCursorPosition(editableRef.current, startPos + insertText.length);
            setTimeout(updateOverlays, 10);
          }
        }, 0);
      }

      setShowAutocomplete(false);
      setSearchTerm('');
    },
    [onChange, highlightText, updateOverlays],
  );

  // Handle input
  const handleInput = useCallback(() => {
    if (!editableRef.current) return;
    const cursorPos = saveCursorPosition(editableRef.current);
    const text = editableRef.current.textContent || '';
    onChange(text);
    editableRef.current.innerHTML = highlightText(text);
    restoreCursorPosition(editableRef.current, cursorPos);
    setTimeout(updateOverlays, 10);
    checkAutocomplete(text, cursorPos);
  }, [onChange, highlightText, updateOverlays, checkAutocomplete]);

  // Handle paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      selection.deleteFromDocument();
      const textNode = document.createTextNode(text);
      selection.getRangeAt(0).insertNode(textNode);
      const range = document.createRange();
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      handleInput();
    },
    [handleInput],
  );

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (showAutocomplete && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          insertVariable(suggestions[selectedIndex].name);
          return;
        }
        if (e.key === 'Escape') {
          setShowAutocomplete(false);
          return;
        }
      }
      if (e.key === 'Enter') {
        if (!multiline) {
          e.preventDefault();
          onPressEnter?.();
        } else {
          // Insert a plain newline instead of letting the browser create a <div>
          e.preventDefault();
          const selection = window.getSelection();
          if (selection?.rangeCount) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode('\n');
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            handleInput();
          }
        }
      }
    },
    [showAutocomplete, suggestions, selectedIndex, insertVariable, onPressEnter, multiline, handleInput],
  );

  // Sync innerHTML when value or vars change externally
  useEffect(() => {
    if (!editableRef.current) return;
    const currentText = editableRef.current.textContent || '';
    if (currentText !== value) {
      editableRef.current.innerHTML = highlightText(value);
      setTimeout(updateOverlays, 10);
    } else {
      const newHTML = highlightText(value);
      if (editableRef.current.innerHTML !== newHTML) {
        const cursorPos = saveCursorPosition(editableRef.current);
        editableRef.current.innerHTML = newHTML;
        restoreCursorPosition(editableRef.current, cursorPos);
        setTimeout(updateOverlays, 10);
      }
    }
  }, [value, highlightText, updateOverlays]);

  // Update overlays on scroll/resize
  useEffect(() => {
    const handler = () => updateOverlays();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [updateOverlays]);

  // Close autocomplete on outside click
  useEffect(() => {
    if (!showAutocomplete) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAutocomplete]);

  const borderStyle = borderless ? {} : { border: `1px solid ${token.colorBorder}`, borderRadius: 6 };

  return (
    <div className="template-input-wrapper" style={style}>
      <div
        ref={editableRef}
        className="template-input"
        contentEditable
        role="textbox"
        tabIndex={0}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        spellCheck={false}
        style={{
          minHeight: multiline ? (minRows || 6) * 22 : 24,
          maxHeight: multiline ? 400 : undefined,
          overflowY: multiline ? 'auto' : undefined,
          padding: '4px 11px',
          outline: 'none',
          fontSize: fontSize || 12,
          lineHeight: '22px',
          fontFamily: mono ? "'SF Mono', 'Fira Code', monospace" : 'inherit',
          cursor: 'text',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          color: token.colorText,
          background: 'transparent',
          ...borderStyle,
        }}
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && suggestions.length > 0 && (
        <div
          ref={autocompleteRef}
          className="template-autocomplete"
          style={{
            position: 'fixed',
            top: autocompletePos.top,
            left: autocompletePos.left,
            zIndex: 1050,
            display: 'flex',
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
            boxShadow: token.boxShadowSecondary,
            overflow: 'hidden',
          }}
        >
          <div style={{ minWidth: 200, maxWidth: 260, maxHeight: 250, overflowY: 'auto' }}>
            <List
              size="small"
              dataSource={suggestions}
              renderItem={(item, index) => (
                <List.Item
                  onClick={() => insertVariable(item.name)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    padding: '6px 12px',
                    cursor: 'pointer',
                    backgroundColor: index === selectedIndex ? token.colorPrimaryBg : 'transparent',
                    borderBottom: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Tag
                      color={item.scope === 'environment' ? 'green' : 'purple'}
                      style={{
                        margin: '0 8px 0 0',
                        fontWeight: 'bold',
                        minWidth: 22,
                        textAlign: 'center',
                        fontSize: 11,
                      }}
                    >
                      {item.scope === 'environment' ? 'E' : 'G'}
                    </Tag>
                    <Text style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}>{item.name}</Text>
                  </div>
                </List.Item>
              )}
            />
          </div>

          {/* Side panel showing selected variable details */}
          {suggestions[selectedIndex] && (
            <div
              style={{
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
                padding: 12,
                minWidth: 160,
                background: token.colorBgElevated,
              }}
            >
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                Current Value
              </Text>
              <div
                style={{
                  marginTop: 4,
                  padding: '4px 8px',
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: "'SF Mono', monospace",
                  wordBreak: 'break-all',
                  maxHeight: 60,
                  overflow: 'auto',
                  marginBottom: 8,
                }}
              >
                {suggestions[selectedIndex].value || <Text type="secondary">No value</Text>}
              </div>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                Scope
              </Text>
              <div style={{ marginTop: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 12 }}>{activeEnvironment || 'Environment'}</Text>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={() => window.dispatchEvent(new CustomEvent('showVariablesPanel'))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') window.dispatchEvent(new CustomEvent('showVariablesPanel'));
                }}
                style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
              >
                Variables in request
                <RightOutlined style={{ marginLeft: 4, fontSize: 10 }} />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invisible overlay divs for Popover hover targets */}
      {envVars &&
        activeEnvironment &&
        varOverlays.map(({ varName, rect }, i) => {
          const variable = envVars[varName];
          const resolved = !!variable;
          const displayValue = variable?.isSecret ? '••••••••' : variable?.value;

          return (
            <Popover
              key={`${varName}-${i}`}
              placement="bottom"
              trigger="hover"
              mouseEnterDelay={0.15}
              content={
                <div style={{ minWidth: 180 }}>
                  <div style={{ marginBottom: 6 }}>
                    <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}>
                      {varName}
                    </Text>
                  </div>
                  <div
                    style={{
                      padding: '4px 8px',
                      background: token.colorBgElevated,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: 4,
                      fontFamily: "'SF Mono', monospace",
                      fontSize: 12,
                      wordBreak: 'break-all',
                      marginBottom: 6,
                    }}
                  >
                    {resolved ? displayValue : <Text type="danger">Not defined</Text>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 8 }}>
                    <span style={{ color: '#3498db', fontWeight: 700 }}>E</span>
                    <span>{activeEnvironment}</span>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => window.dispatchEvent(new CustomEvent('showVariablesPanel'))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') window.dispatchEvent(new CustomEvent('showVariablesPanel'));
                    }}
                    style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                  >
                    Variables in request
                    <RightOutlined style={{ marginLeft: 4, fontSize: 10 }} />
                  </span>
                </div>
              }
            >
              <div
                style={{
                  position: 'fixed',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  background: 'transparent',
                  pointerEvents: 'auto',
                  zIndex: 1,
                }}
              />
            </Popover>
          );
        })}

      {/* TOTP placeholder popovers */}
      {totpOverlays.map(({ placeholder, rect }, i) => (
        <Popover
          key={`totp-${i}`}
          placement="bottom"
          trigger="hover"
          mouseEnterDelay={0.15}
          content={
            <div style={{ minWidth: 180 }}>
              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontFamily: "'SF Mono', monospace", fontSize: 12 }}>
                  {placeholder}
                </Text>
              </div>
              <div
                style={{
                  padding: '4px 8px',
                  background: token.colorBgElevated,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 4,
                  fontFamily: "'SF Mono', monospace",
                  fontSize: 12,
                  wordBreak: 'break-all',
                  marginBottom: 6,
                }}
              >
                {totpReady ? (
                  totpCode ? (
                    <span style={{ letterSpacing: 2 }}>{totpCode}</span>
                  ) : (
                    <Text type="secondary">Click Test in Settings to generate</Text>
                  )
                ) : (
                  <Text type="danger">TOTP not configured</Text>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: '#722ed1', fontWeight: 700 }}>T</span>
                <span>{totpReady ? 'TOTP enabled' : 'Enable in Settings tab'}</span>
              </div>
            </div>
          }
        >
          <div
            style={{
              position: 'fixed',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              background: 'transparent',
              pointerEvents: 'auto',
              zIndex: 1,
            }}
          />
        </Popover>
      ))}
    </div>
  );
}
