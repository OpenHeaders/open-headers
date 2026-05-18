export function extractFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/');
    return segments[segments.length - 1] || path;
  } catch {
    return url;
  }
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 1 ? u.pathname : '');
  } catch {
    return url;
  }
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(0)} ms`;
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// Webpack-style sources look like `webpack:///./src/runtime/load_script.js`.
// Strip protocol + path, keep the trailing filename, drop trailing `.js`/`.ts`.
// Matches Chrome's `load_script:64` rendering when the file is `load_script.js`.
export function basenameOfSource(source: string): string {
  const stripped = source.replace(/^[^:]+:\/+/, '');
  const parts = stripped.split('/');
  const last = parts[parts.length - 1] || stripped;
  return last.replace(/\.[a-z]+$/i, '');
}
