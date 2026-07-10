/**
 * TemplateInput — contentEditable-backed field with inline `{{ref}}`
 * highlighting + suggestion popover.
 *
 * The editable element itself renders the styled spans (no mirror
 * overlay, no transparent-text hack). That collapses the textarea /
 * mirror two-layer design into a single source of truth and removes
 * the computed-style-sync machinery that was needed to keep the
 * layers aligned — whatever padding / font / letter-spacing the
 * caller sets applies to the only element that exists.
 *
 * Value lifecycle:
 *   - External `value` prop → `innerHTML = highlightText(value)`
 *     when `textContent` differs, preserving caret via a char-offset
 *     save/restore.
 *   - User input → read `textContent`, fire `onChange`, re-highlight
 *     with the same save/restore.
 *   - While the caret sits inside a `{{...}}` range, that span uses
 *     the neutral `editing` class so classification doesn't flicker
 *     red/blue on every keystroke; it snaps back to resolved /
 *     unresolved once the caret leaves.
 */

import { CloseCircleFilled } from '@ant-design/icons';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { theme } from 'antd';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
// Co-located styles travel with the component — anyone who imports
// TemplateInput automatically gets `{{ref}}` highlighting + suggestion
// popover chrome without per-app CSS plumbing.
import './template-input.css';
import { useSettingValue } from '../../settings/hooks';
import { getCaretOffset, setCaretOffset } from './caret';
import { buildEditableStyle, splitLayoutSurfaceStyle } from './editable-style';
import { type RefState, renderHighlightedHtml, TEMPLATE_REGEX } from './highlight';
import { useAutoSuggestionContext } from './SuggestionContextProvider';
import SuggestionPopover from './SuggestionPopover';
import type { TemplateInputProps } from './types';
import { useGripResize } from './use-grip-resize';
import { useSelectionContextMenu } from './use-selection-context-menu';
import { useTemplateSuggestions } from './use-template-suggestions';

const TemplateInput = forwardRef<HTMLDivElement, TemplateInputProps>(
  (
    {
      value,
      onChange,
      suggestionContext,
      multiline = false,
      expandOnFocus = false,
      wrap = false,
      expanded,
      maxRows = 5,
      resizable = false,
      onResizeX,
      allowClear = false,
      placeholder = '',
      size = 'middle',
      variant = 'outlined',
      disableSuggestions = false,
      style,
      className,
      onPressEnter,
      onFocus,
      onBlur,
      autoFocus,
      id,
      'aria-label': ariaLabel,
      status,
      secret = false,
      flagUnresolved = false,
    },
    ref,
  ) => {
    const editableRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useCallback(
      (instance: HTMLDivElement | null) => {
        editableRef.current = instance;
        if (typeof ref === 'function') ref(instance);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = instance;
      },
      [ref],
    );

    const autoContext = useAutoSuggestionContext();
    const effectiveContext = suggestionContext ?? autoContext;
    const resolver = useVariableResolver();
    const autocompleteEnabled = useSettingValue('rulesEngine.variableAutocomplete');
    const effectiveDisable = disableSuggestions || !autocompleteEnabled;
    const { token } = theme.useToken();

    const [isFocused, setIsFocused] = useState(false);

    // Classifier: delegates to the live resolver. Memoised by (resolver,
    // collectionId) so the `renderHighlightedHtml` recompute doesn't
    // build a new closure every render.
    const classify = useCallback(
      (inner: string): RefState => {
        const context = effectiveContext.collectionId ? { collectionId: effectiveContext.collectionId } : undefined;
        const { errors } = resolver.resolveTemplate(`{{${inner}}}`, context);
        return errors.length === 0 ? 'resolved' : 'unresolved';
      },
      [resolver, effectiveContext.collectionId],
    );

    // Whether the value holds an UNRESOLVED ref — drives the optional
    // right-end dot. Reuses the highlighter's classifier so the dot stays
    // in lockstep with the red ref highlight; only walked when opted in.
    const hasUnresolvedRef = useMemo(() => {
      if (!flagUnresolved || !value) return false;
      for (const m of value.matchAll(new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags))) {
        if (classify(m[1]) === 'unresolved') return true;
      }
      return false;
    }, [flagUnresolved, value, classify]);

    const {
      isOpen,
      suggestions,
      activeIndex,
      setActiveIndex,
      measureDouble,
      popoverCoords,
      createTarget,
      insertReference,
      triggerCreate,
      closeSuggestions,
      handleInput,
      handleKeyDown,
      handleKeyUpOrMouseUp,
      handlePaste,
      handleEditableMouseOver,
      handleEditableMouseOut,
      recordExternal,
    } = useTemplateSuggestions({
      editableRef,
      value,
      onChange,
      onPressEnter,
      multiline,
      effectiveContext,
      effectiveDisable,
      classify,
    });

    // Sync external `value` prop → innerHTML. Only writes when the
    // current text content differs from `value` (prevents every
    // external re-render from clobbering the caret).
    useEffect(() => {
      const root = editableRef.current;
      if (!root) return;
      const next = value ?? '';
      const current = root.textContent ?? '';
      // A genuinely external swap (form reset, another surface's commit —
      // NOT the round-trip of our own onChange) becomes an undo boundary.
      if (current !== next) recordExternal(next);
      const focused = document.activeElement === root;
      const caretWas = focused ? getCaretOffset(root) : null;
      const html = renderHighlightedHtml(next, caretWas, classify);
      if (root.innerHTML !== html) {
        root.innerHTML = html;
        if (focused && caretWas !== null && current === next) {
          // Re-highlight only — restore previous caret position.
          setCaretOffset(root, caretWas);
        } else if (focused) {
          // External value change — anchor caret at end.
          setCaretOffset(root, next.length);
        }
      }
    }, [value, classify, recordExternal]);

    // `autoFocus` equivalent — contentEditable doesn't honor the HTML
    // attribute, so we focus imperatively after mount.
    useEffect(() => {
      if (!autoFocus) return;
      editableRef.current?.focus();
    }, [autoFocus]);

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        setIsFocused(true);
        // Re-render so the ref the caret lands in renders neutral.
        handleKeyUpOrMouseUp();
        onFocus?.(e);
      },
      [onFocus, handleKeyUpOrMouseUp],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        setIsFocused(false);
        closeSuggestions();
        // Re-classify refs now that the caret isn't tracked.
        const root = editableRef.current;
        if (root) {
          const text = root.textContent ?? '';
          const html = renderHighlightedHtml(text, null, classify);
          if (root.innerHTML !== html) root.innerHTML = html;
        }
        onBlur?.(e);
      },
      [onBlur, classify, closeSuggestions],
    );

    const [layoutStyle, surfaceStyle] = useMemo(() => splitLayoutSurfaceStyle(style), [style]);

    // Wrapped, growable surface: always for `multiline`, or for an
    // `expandOnFocus` field while it's active. "Active" is the controlled
    // `expanded` prop when supplied (so a row can expand all its cells
    // together), else the field's own focus. Collapsed-ellipsis is the
    // inactive state of an `expandOnFocus` field.
    const expandActive = expanded ?? isFocused;
    const displayExpanded = multiline || wrap || (expandOnFocus && expandActive);
    const displayCollapsed = expandOnFocus && !wrap && !expandActive;

    const { manualHeight, handleGripPointerDown, handleGripPointerMove, handleGripPointerUp, handleGripDoubleClick } =
      useGripResize(editableRef, onResizeX);

    // Right-click on a selection → custom menu (Set as variable,
    // clipboard trio, Encode/Decode). A collapsed caret falls through
    // to the browser's native menu.
    const { handleContextMenu, contextMenuLayer } = useSelectionContextMenu({
      editableRef,
      value: value ?? '',
      onChange,
      collectionId: effectiveContext.collectionId,
    });

    // AntD-parity clear affordance: clears both the DOM (covers
    // uncontrolled use) and the controlled value, keeping focus in the
    // field so the user can type the replacement straight away.
    const showClear = allowClear && (value ?? '').length > 0;
    const handleClear = useCallback(() => {
      const root = editableRef.current;
      if (root) {
        root.innerHTML = '';
        root.focus();
      }
      onChange?.('');
    }, [onChange]);

    const editableStyle = buildEditableStyle({
      size,
      variant,
      status,
      isFocused,
      token,
      showClear,
      displayExpanded,
      displayCollapsed,
      resizable,
      manualHeight,
      maxRows,
      secret,
      surfaceStyle,
    });

    return (
      <span
        className={`oh-template-input-wrapper${hasUnresolvedRef ? ' oh-template-input-wrapper--flagged' : ''}${className ? ` ${className}` : ''}`}
        style={layoutStyle}
      >
        <div
          ref={mergedRef}
          className={`oh-template-input-editable${displayExpanded ? ' oh-template-input-editable--expanded' : ''}${secret ? ' oh-template-input-secret' : ''}`}
          contentEditable
          suppressContentEditableWarning
          role="combobox"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          spellCheck={false}
          id={id}
          data-placeholder={placeholder}
          style={editableStyle}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUpOrMouseUp}
          onMouseUp={handleKeyUpOrMouseUp}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseOver={handleEditableMouseOver}
          onMouseOut={handleEditableMouseOut}
          onContextMenu={handleContextMenu}
        />
        {contextMenuLayer}
        {resizable && (
          <div
            className={`oh-template-input-resize-grip${onResizeX ? ' oh-template-input-resize-grip--2d' : ''}`}
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onDoubleClick={handleGripDoubleClick}
            aria-hidden="true"
          />
        )}
        {showClear && (
          <CloseCircleFilled
            className="oh-template-input-clear"
            aria-label="Clear value"
            style={{
              // Inset left of the resize grip's column (a one-row expanded
              // field puts "top-right" and "bottom-right" at the same
              // spot, so side-by-side is the only non-overlapping layout —
              // same as AntD TextArea's allowClear + resize). Also clears
              // the unresolved dot when flagged. Top-right on an expanded
              // surface, centered on a single line.
              // Expanded: sit immediately left of the 6px scrollbar column
              // (the grip below never collides — the scrollbar track stops
              // above it). Single line: hug the right edge. When flagged,
              // the wrapper's 14px dot gutter insets the editable — and its
              // scrollbar — by that much, so the offset shifts by the FULL
              // gutter width to stay clear of the bar, not just the dot.
              right: (displayExpanded ? 10 : 6) + (hasUnresolvedRef ? 14 : 0),
              // Expanded: pin to the first line's center (size-dependent —
              // small fields have no vertical padding). Single line:
              // center in the field.
              ...(displayExpanded ? { top: size === 'small' ? 4 : 9 } : { top: '50%', transform: 'translateY(-50%)' }),
            }}
            // preventDefault keeps the editable focused through the click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          />
        )}
        {isOpen &&
          popoverCoords &&
          // A lone `{` only opens the popover once it has a match —
          // `{{` (clear template intent) always opens, even to show
          // "No matches" — so a literal brace in a value doesn't flash
          // an empty list.
          (suggestions.length > 0 || measureDouble) &&
          createPortal(
            <div
              className="oh-template-popover-anchor"
              style={{ top: popoverCoords.top, bottom: popoverCoords.bottom, left: popoverCoords.left }}
            >
              <SuggestionPopover
                suggestions={suggestions}
                activeIndex={activeIndex}
                maxListHeight={popoverCoords.maxListHeight}
                onActiveIndexChange={setActiveIndex}
                onSelect={insertReference}
                createAction={
                  createTarget
                    ? {
                        label: createTarget.scopeLabel ? (
                          <>
                            Create “{createTarget.name}” variable in {createTarget.scopeLabel}
                          </>
                        ) : (
                          // Bare reference — the create popover's "Add to"
                          // picker chooses the destination scope.
                          <>Create “{createTarget.name}” variable</>
                        ),
                        onSelect: triggerCreate,
                      }
                    : undefined
                }
              />
            </div>,
            document.body,
          )}
        {hasUnresolvedRef && (
          <span
            className="oh-template-input-unresolved-dot"
            aria-hidden="true"
            title="Contains an unresolved variable"
          />
        )}
      </span>
    );
  },
);

TemplateInput.displayName = 'TemplateInput';

export default TemplateInput;
