// @vitest-environment jsdom
/**
 * ResponseErrorState — the HTTP response pane's failure: the fact in the
 * text tone, the classified advice (what to check) under it in the
 * secondary tone, both under the one test id a reader of the error
 * state gets.
 */

import ResponseErrorState from '@openheaders/ui/workbench/components/request-editor/response/ResponseErrorState';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('ResponseErrorState', () => {
  it('paints the fact and the advice as two lines under one test id', () => {
    render(
      <ResponseErrorState
        error="127.0.0.1 refused the connection on port 59117 (net::ERR_CONNECTION_REFUSED). Nothing is listening there."
        advice="Is the service running, and on this port?"
        layout="vertical"
      />,
    );
    const state = screen.getByTestId('oh-response-error');
    expect(state.textContent).toContain('Nothing is listening there.');
    expect(state.textContent).toContain('Is the service running, and on this port?');
    const advice = screen.getByTestId('oh-response-error-advice');
    expect(advice.textContent).toBe('Is the service running, and on this port?');
    expect(advice.classList.contains('ant-typography-secondary')).toBe(true);
  });

  it('shows the fact alone when the failure carries no advice', () => {
    render(<ResponseErrorState error="Request timed out after 5000 ms." layout="vertical" />);
    expect(screen.getByTestId('oh-response-error').textContent).toBe('Request timed out after 5000 ms.');
    expect(screen.queryByTestId('oh-response-error-advice')).toBeNull();
  });
});
