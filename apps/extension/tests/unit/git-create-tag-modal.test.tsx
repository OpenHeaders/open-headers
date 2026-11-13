// @vitest-environment jsdom
/**
 * The log's New Tag… dialog (S47): the title names the short sha, the
 * name starts empty and Create holds until one is typed; Create calls
 * the tag verb with the FULL sha and reports the created tag; `exists`
 * reads inline and keeps the dialog open.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

import CreateTagModal from '@openheaders/ui/workbench/components/panels/git/rail/CreateTagModal';

const SHA = 'a'.repeat(40);

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(cleanup);

function mount(onCreated = vi.fn(), onClose = vi.fn()) {
  render(
    <AntApp>
      <CreateTagModal workspaceId="ws-1" sha={SHA} onClose={onClose} onCreated={onCreated} />
    </AntApp>,
  );
  return { onCreated, onClose };
}

// The locale context answers English here, so the pin reads the words.
const okButton = (): HTMLElement => screen.getByText('Create').closest('button') as HTMLElement;

describe('CreateTagModal', () => {
  beforeEach(() => {
    mockCall.mockReset();
  });

  it('names the short sha, starts with an empty name and Create disabled', () => {
    mount();
    expect(screen.getByText(`Create Tag at ${SHA.slice(0, 7)}`)).toBeTruthy();
    const input = screen.getByTestId('git-tool-create-tag-name') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(okButton().hasAttribute('disabled')).toBe(true);
  });

  it('Create calls the verb with the full sha and reports the tag', async () => {
    mockCall.mockResolvedValue({ ok: true, name: 'v1', sha: SHA });
    const { onCreated, onClose } = mount();
    fireEvent.change(screen.getByTestId('git-tool-create-tag-name'), { target: { value: ' v1 ' } });
    fireEvent.click(okButton());
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('v1', SHA));
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.createTag', { workspaceId: 'ws-1', name: 'v1', sha: SHA });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a taken name reads inline and the dialog stays open', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'exists' });
    const { onCreated, onClose } = mount();
    fireEvent.change(screen.getByTestId('git-tool-create-tag-name'), { target: { value: 'v1' } });
    fireEvent.click(okButton());
    await waitFor(() =>
      expect(screen.getByTestId('git-tool-create-tag-error').textContent).toBe('Tag v1 already exists.'),
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
