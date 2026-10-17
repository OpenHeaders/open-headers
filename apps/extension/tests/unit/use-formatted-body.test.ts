/**
 * useFormattedBody — the markup gate: Prettier's HTML parser accepts
 * any text and reflows it as prose, so the markup formatters run only
 * over text that carries a tag; a JSON payload read under the HTML
 * grammar keeps the layout it came with.
 */

import { looksLikeMarkup } from '@openheaders/ui/workbench/components/request-editor/response/use-formatted-body';
import { describe, expect, it } from 'vitest';

describe('looksLikeMarkup', () => {
  it('sees a tag, a closing tag, a comment, a doctype and a processing instruction', () => {
    expect(looksLikeMarkup('<div>hi</div>')).toBe(true);
    expect(looksLikeMarkup('text </p>')).toBe(true);
    expect(looksLikeMarkup('<!-- note -->')).toBe(true);
    expect(looksLikeMarkup('<!DOCTYPE html>')).toBe(true);
    expect(looksLikeMarkup('<?xml version="1.0"?>')).toBe(true);
  });

  it('leaves JSON, plain prose and a bare comparison alone', () => {
    expect(looksLikeMarkup('{\n  "product": "Live JSON generator",\n  "demo": true\n}')).toBe(false);
    expect(looksLikeMarkup('plain payload')).toBe(false);
    expect(looksLikeMarkup('1 < 2 and 3 <4')).toBe(false);
    expect(looksLikeMarkup('')).toBe(false);
  });
});
