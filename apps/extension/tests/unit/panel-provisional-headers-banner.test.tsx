/**
 * Provisional-headers warning — the in-app banner shown above the Request
 * Headers list when the lifecycle's request headers are still the cooked
 * (provisional) set. Two wording variants (cache vs. non-cache); the explainer
 * is in-app (the shared info-popover), never an external link.
 */

import { ProvisionalHeadersBanner } from '@openheaders/ui/panel/components/detail/headers/ProvisionalHeadersBanner';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('ProvisionalHeadersBanner', () => {
  it('renders the non-cached wording when the request is not a cache hit', () => {
    const { container } = render(<ProvisionalHeadersBanner cached={false} />);
    const text = container.querySelector('.dt-provisional-banner-text')?.textContent ?? '';
    expect(text).toContain('Provisional headers are shown');
    expect(text).toContain('on-the-wire set hasn’t been confirmed');
    expect(text).not.toContain('cache');
  });

  it('renders the cache-specific wording for a cache hit', () => {
    const { container } = render(<ProvisionalHeadersBanner cached={true} />);
    const text = container.querySelector('.dt-provisional-banner-text')?.textContent ?? '';
    expect(text).toContain('Provisional headers are shown');
    expect(text).toContain('served from cache');
  });

  it('offers an in-app explainer (info-popover trigger), not an external link', () => {
    const { container } = render(<ProvisionalHeadersBanner cached={false} />);
    expect(container.querySelector('.dt-header-info-trigger')).not.toBeNull();
    expect(container.querySelector('a[href]')).toBeNull();
  });
});
