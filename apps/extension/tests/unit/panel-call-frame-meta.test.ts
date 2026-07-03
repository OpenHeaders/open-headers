import {
  computeCallFrameMeta,
  computeFrameLocation,
  formatCallStackForCopy,
} from '@openheaders/ui/panel/data/initiator/call-frame-meta';
import { describe, expect, it } from 'vitest';

describe('computeCallFrameMeta', () => {
  it('flags anonymous when no function name is present', () => {
    const m = computeCallFrameMeta({ url: 'https://openheaders.io/app.js' }, null);
    expect(m.isAnonymous).toBe(true);
    expect(m.displayName).toBe('(anonymous)');
  });

  it('keeps the original function name when supplied', () => {
    expect(computeCallFrameMeta({ functionName: 'handleClick' }, null).displayName).toBe('handleClick');
  });

  it('recognises minified single-character names', () => {
    expect(computeCallFrameMeta({ functionName: 'a' }, null).isMinifiedName).toBe(true);
    expect(computeCallFrameMeta({ functionName: 'xy' }, null).isMinifiedName).toBe(true);
  });

  it('recognises all-digit identifiers (e.g. 78193) as minified', () => {
    expect(computeCallFrameMeta({ functionName: '78193' }, null).isMinifiedName).toBe(true);
  });

  it('does not flag full names as minified', () => {
    expect(computeCallFrameMeta({ functionName: 'handleClick' }, null).isMinifiedName).toBe(false);
  });

  it('treats V8 property-access names (e.g. `b.l`) as anonymous', () => {
    const m = computeCallFrameMeta({ functionName: 'b.l' }, null);
    expect(m.isAnonymous).toBe(true);
    expect(m.displayName).toBe('(anonymous)');
    expect(m.isMinifiedName).toBe(false);
  });

  it('treats multi-segment property-access names (e.g. `b.f.j`) as anonymous', () => {
    expect(computeCallFrameMeta({ functionName: 'b.f.j' }, null).displayName).toBe('(anonymous)');
  });

  it('classifies third-party by origin diff', () => {
    expect(computeCallFrameMeta({ url: 'https://cdn.example.com/lib.js' }, 'https://openheaders.io').isThirdParty).toBe(
      true,
    );
    expect(computeCallFrameMeta({ url: 'https://openheaders.io/app.js' }, 'https://openheaders.io').isThirdParty).toBe(
      false,
    );
  });

  it('flags noise only when name is anon/minified AND url looks bundler-generated', () => {
    expect(computeCallFrameMeta({ url: 'https://cdn.example.com/chunk-7654.js' }, null).isLikelyNoise).toBe(true); // anonymous + chunk-
    expect(
      computeCallFrameMeta({ functionName: 'a', url: 'https://cdn.example.com/chunk-7654.js' }, null).isLikelyNoise,
    ).toBe(true); // minified + chunk-
    expect(
      computeCallFrameMeta({ functionName: 'handleClick', url: 'https://cdn.example.com/chunk-7654.js' }, null)
        .isLikelyNoise,
    ).toBe(false); // real name protects
    expect(computeCallFrameMeta({ functionName: 'a', url: 'https://openheaders.io/app.js' }, null).isLikelyNoise).toBe(
      false,
    ); // non-bundle URL protects
  });

  it('recognises hash-only bundle filenames as noise URLs', () => {
    expect(
      computeCallFrameMeta({ url: 'https://github.githubassets.com/assets/2694-6e858cef002fd527.js' }, null)
        .isLikelyNoise,
    ).toBe(true);
  });
});

describe('computeFrameLocation', () => {
  it('returns empty when no URL is available', () => {
    expect(computeFrameLocation({})).toEqual({ filename: '', pretty: '', lineSuffix: '' });
  });

  it('extracts filename from URL path', () => {
    const out = computeFrameLocation({ url: 'https://openheaders.io/path/to/app.js', lineNumber: 41 });
    expect(out.filename).toBe('app.js');
    expect(out.lineSuffix).toBe(':42'); // 0-indexed → human 1-indexed
    expect(out.pretty).toBe('app.js:42');
  });

  it('includes column when supplied', () => {
    const out = computeFrameLocation({ url: 'https://x/y.js', lineNumber: 9, columnNumber: 4 });
    expect(out.lineSuffix).toBe(':10:5');
  });

  it('falls back to hostname when path has no filename', () => {
    expect(computeFrameLocation({ url: 'https://openheaders.io/' }).filename).toBe('openheaders.io');
  });
});

describe('formatCallStackForCopy', () => {
  it('renders frames as "at name (url:line)"', () => {
    const text = formatCallStackForCopy([
      { callFrames: [{ functionName: 'handleClick', url: 'https://openheaders.io/app.js', lineNumber: 9 }] },
    ]);
    expect(text).toBe('    at handleClick (https://openheaders.io/app.js:10)');
  });

  it('preserves async section separators', () => {
    const text = formatCallStackForCopy([
      { callFrames: [{ functionName: 'a', url: 'https://x/y.js', lineNumber: 0 }] },
      { description: 'Promise.then', callFrames: [{ functionName: 'b', url: 'https://x/y.js', lineNumber: 1 }] },
    ]);
    expect(text).toContain('--- Promise.then ---');
  });

  it('renders anonymous frames as (anonymous)', () => {
    const text = formatCallStackForCopy([{ callFrames: [{ url: 'https://x/y.js', lineNumber: 0 }] }]);
    expect(text).toContain('(anonymous)');
  });
});
