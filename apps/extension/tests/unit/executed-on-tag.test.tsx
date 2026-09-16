// @vitest-environment jsdom
/**
 * ExecutedOnTag — the shared "Sent from <place>" attribution tag the
 * four snapshot kinds' meta strips mount from the record's stamp.
 */

import ExecutedOnTag from '@openheaders/ui/workbench/components/request-editor/response/ExecutedOnTag';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('ExecutedOnTag', () => {
  it('names the answering place from the stamp', () => {
    render(<ExecutedOnTag executedOn={{ kind: 'backend', name: 'acme-runner' }} />);
    const tag = screen.getByTestId('oh-response-executed-on');
    expect(tag.textContent).toBe('Sent from acme-runner');
  });
});
