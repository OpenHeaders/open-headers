/**
 * DomainTags — tag-based domain input matching the desktop "Add Header Rule" modal.
 *
 * Features:
 * - Chip-style tags with close button
 * - Click-to-edit inline
 * - "+ Add Domain" button
 * - Comma / Enter to add, Backspace to delete last
 * - Paste multiple comma-separated domains
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { Input, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface DomainTagsProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
}

function processDomain(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

const DomainTags: React.FC<DomainTagsProps> = ({ value = [], onChange }) => {
  const { token } = theme.useToken();
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editIndex, setEditIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<InputRef>(null);
  const editInputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (inputVisible) inputRef.current?.focus();
  }, [inputVisible]);

  useEffect(() => {
    if (editIndex > -1) editInputRef.current?.focus();
  }, [editIndex]);

  const addDomains = (raw: string) => {
    const parts = raw.split(/[,\n]/).map(processDomain).filter(Boolean);
    if (parts.length === 0) return;
    const unique = [...new Set([...value, ...parts])];
    onChange?.(unique);
  };

  const handleClose = (tag: string) => {
    onChange?.(value.filter((t) => t !== tag));
  };

  const showInput = () => {
    setInputVisible(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Comma triggers immediate add
    if (val.includes(',')) {
      const parts = val.split(',');
      const toAdd = parts.slice(0, -1).map(processDomain).filter(Boolean);
      if (toAdd.length > 0) {
        const unique = [...new Set([...value, ...toAdd])];
        onChange?.(unique);
      }
      setInputValue(parts[parts.length - 1]);
      return;
    }
    setInputValue(val);
  };

  const handleInputConfirm = () => {
    const domain = processDomain(inputValue);
    if (domain && !value.includes(domain)) {
      onChange?.([...value, domain]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const domain = processDomain(inputValue);
      if (domain && !value.includes(domain)) {
        onChange?.([...value, domain]);
      }
      setInputValue('');
      // Keep input open for adding more
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      e.preventDefault();
      onChange?.(value.slice(0, -1));
    } else if (e.key === 'Escape') {
      setInputVisible(false);
      setInputValue('');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    addDomains(text);
    setInputValue('');
  };

  const handleEditConfirm = () => {
    if (editIndex > -1 && editValue.trim()) {
      const updated = [...value];
      updated[editIndex] = processDomain(editValue);
      onChange?.(updated);
    }
    setEditIndex(-1);
    setEditValue('');
  };

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        padding: '8px 12px',
        minHeight: 36,
        background: token.colorBgContainer,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {value.map((tag, index) => {
          if (editIndex === index) {
            return (
              <Input
                ref={editInputRef}
                key={`edit-${tag}`}
                size="small"
                style={{
                  width: Math.max(80, tag.length * 8 + 20),
                  height: 24,
                  borderRadius: 4,
                }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleEditConfirm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditConfirm();
                  else if (e.key === 'Escape') {
                    setEditIndex(-1);
                    setEditValue('');
                  }
                }}
              />
            );
          }

          const isLong = tag.length > 24;
          const display = isLong ? `${tag.slice(0, 24)}...` : tag;

          const tagEl = (
            <Tag
              key={tag}
              closable
              closeIcon={<CloseOutlined style={{ fontSize: 10 }} />}
              onClose={(e) => {
                e.preventDefault();
                handleClose(tag);
              }}
              style={{
                userSelect: 'none',
                margin: 0,
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: 12,
                cursor: 'pointer',
                height: 24,
                lineHeight: '20px',
              }}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditIndex(index);
                  setEditValue(tag);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setEditIndex(index);
                    setEditValue(tag);
                  }
                }}
                title="Click to edit"
              >
                {display}
              </span>
            </Tag>
          );

          return isLong ? (
            <Tooltip title={tag} key={tag}>
              {tagEl}
            </Tooltip>
          ) : (
            tagEl
          );
        })}

        {inputVisible ? (
          <Input
            ref={inputRef}
            size="small"
            placeholder="Type domain and press Enter or comma"
            style={{ width: 280, height: 24, borderRadius: 4 }}
            value={inputValue}
            onChange={handleInputChange}
            onPaste={handlePaste}
            onBlur={handleInputConfirm}
            onKeyDown={handleInputKeyDown}
          />
        ) : (
          <button
            type="button"
            onClick={showInput}
            style={{
              height: 24,
              fontSize: 12,
              border: `1px dashed ${token.colorBorder}`,
              borderRadius: 4,
              background: 'transparent',
              cursor: 'pointer',
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: token.colorTextSecondary,
            }}
          >
            <PlusOutlined style={{ fontSize: 10 }} />
            Add Domain
          </button>
        )}
      </div>
    </div>
  );
};

export default DomainTags;
