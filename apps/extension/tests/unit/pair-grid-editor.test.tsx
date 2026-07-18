// @vitest-environment jsdom
/**
 * PairGridEditor — the name/value grid body for pair-shaped detected
 * values. A structured view over the decoded line-per-segment text:
 * rows decode from the incoming buffer, every cell edit / add /
 * remove / reorder serializes straight back to the same line format
 * (the write path stays the codec's), flag rows render with a flag
 * placeholder and become pairs when typed into, blank added rows
 * don't dirty the buffer, and external buffer movement re-derives the
 * rows.
 */

import type { PairGridType } from '@openheaders/ui/shared/value-detection';
import { PairGridEditor } from '@openheaders/ui/workbench/components/value-editors/PairGridEditor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const onChangeSpy = vi.fn();

/** Stateful harness standing in for the document tab / modal buffer
 *  owner — hands edits back down like the draft round-trip does. */
function Harness({ gridType, initial }: { gridType: PairGridType; initial: string }) {
  const [text, setText] = useState(initial);
  return (
    <PairGridEditor
      gridType={gridType}
      value={text}
      onChange={(next) => {
        onChangeSpy(next);
        setText(next);
      }}
    />
  );
}

const cell = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', { name });

afterEach(() => {
  cleanup();
  onChangeSpy.mockReset();
});

describe('rows from the decoded buffer', () => {
  it('renders one row per segment with name/value cells, flags with a flag placeholder', () => {
    render(<Harness gridType="cookie" initial={'session=abc\nPath=/\nSecure'} />);
    expect(cell('Row 1 name').value).toBe('session');
    expect(cell('Row 1 value').value).toBe('abc');
    expect(cell('Row 2 name').value).toBe('Path');
    expect(cell('Row 2 value').value).toBe('/');
    expect(cell('Row 3 name').value).toBe('Secure');
    expect(cell('Row 3 value').value).toBe('');
    expect(cell('Row 3 value').placeholder).toBe('flag');
  });

  it('labels query-string columns Key/Value and keeps duplicate keys as rows', () => {
    render(<Harness gridType="query-string" initial={'tag=a\ntag=b'} />);
    expect(cell('Row 1 key').value).toBe('tag');
    expect(cell('Row 2 key').value).toBe('tag');
    expect(cell('Row 2 value').value).toBe('b');
  });
});

describe('edits serialize back to the line format', () => {
  it('cell edits emit the re-joined text', () => {
    render(<Harness gridType="cookie" initial={'session=abc\nSecure'} />);
    fireEvent.change(cell('Row 1 value'), { target: { value: 'xyz' } });
    expect(onChangeSpy).toHaveBeenLastCalledWith('session=xyz\nSecure');
  });

  it('typing into a flag row value cell turns it into a pair', () => {
    render(<Harness gridType="cookie" initial={'id=1\nSecure'} />);
    fireEvent.change(cell('Row 2 value'), { target: { value: 'yes' } });
    expect(onChangeSpy).toHaveBeenLastCalledWith('id=1\nSecure=yes');
  });

  it('delete removes the row; move down reorders', () => {
    render(<Harness gridType="query-string" initial={'a=1\nb=2\nc=3'} />);
    fireEvent.click(button('Delete row 2'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('a=1\nc=3');
    fireEvent.click(button('Move row 1 down'));
    expect(onChangeSpy).toHaveBeenLastCalledWith('c=3\na=1');
  });

  it('an added blank row does not dirty the buffer until named', () => {
    render(<Harness gridType="query-string" initial={'a=1'} />);
    fireEvent.click(screen.getByRole('button', { name: /Add row/ }));
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(cell('Row 2 key'));
    fireEvent.change(cell('Row 2 key'), { target: { value: 'b' } });
    expect(onChangeSpy).toHaveBeenLastCalledWith('a=1\nb=');
    fireEvent.change(cell('Row 2 value'), { target: { value: '2' } });
    expect(onChangeSpy).toHaveBeenLastCalledWith('a=1\nb=2');
  });
});

describe('nested value view — per-pair eye', () => {
  const jwt = (() => {
    const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'user@openheaders.io' })}.sig`;
  })();

  it('a detected pair value gets the view eye; plain cells stay bare', () => {
    render(<Harness gridType="cookie" initial={`token=${jwt}\ntheme=dark`} />);
    expect(screen.getAllByRole('button', { name: 'View JWT' })).toHaveLength(1);
  });

  it('the read-only grid keeps the eye — viewing writes nothing', () => {
    render(<PairGridEditor gridType="cookie" value={`token=${jwt}`} onChange={onChangeSpy} readOnly />);
    expect(screen.getAllByRole('button', { name: 'View JWT' })).toHaveLength(1);
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});

describe('external buffer movement', () => {
  it('re-derives the rows when the value prop changes underneath', () => {
    const { rerender } = render(<PairGridEditor gridType="cookie" value="a=1" onChange={onChangeSpy} />);
    expect(cell('Row 1 value').value).toBe('1');
    rerender(<PairGridEditor gridType="cookie" value={'b=2\nSecure'} onChange={onChangeSpy} />);
    expect(cell('Row 1 name').value).toBe('b');
    expect(cell('Row 2 name').value).toBe('Secure');
  });
});
