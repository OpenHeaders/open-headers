export const RESOURCE_LABEL: Record<string, string> = {
  main_frame: 'document',
  sub_frame: 'document',
  document: 'document',
  xmlhttprequest: 'xhr',
  xhr: 'xhr',
  fetch: 'fetch',
  eventsource: 'eventsource',
  script: 'script',
  stylesheet: 'stylesheet',
  image: 'image',
  font: 'font',
  media: 'media',
  websocket: 'websocket',
  ping: 'ping',
  preflight: 'preflight',
  other: 'other',
};

const KNOWN_TYPES = new Set([
  'main_frame',
  'sub_frame',
  'document',
  'xmlhttprequest',
  'xhr',
  'fetch',
  'eventsource',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'websocket',
  'manifest',
  'wasm',
]);

export function normalizeResourceType(raw: string | undefined): string {
  if (!raw) return 'other';
  return raw.toLowerCase();
}

function matchesCategory(rt: string, category: string): boolean {
  if (category === 'xhr') return rt === 'xmlhttprequest' || rt === 'xhr' || rt === 'fetch' || rt === 'eventsource';
  if (category === 'doc') return rt === 'main_frame' || rt === 'sub_frame' || rt === 'document';
  if (category === 'js') return rt === 'script';
  if (category === 'css') return rt === 'stylesheet';
  if (category === 'img') return rt === 'image';
  if (category === 'media') return rt === 'media';
  if (category === 'font') return rt === 'font';
  if (category === 'ws') return rt === 'websocket';
  if (category === 'manifest') return rt === 'manifest';
  if (category === 'wasm') return rt === 'wasm';
  if (category === 'other') return !KNOWN_TYPES.has(rt);
  return false;
}

export function matchesResourceType(resourceType: string | undefined, filter: ReadonlySet<string>): boolean {
  if (filter.size === 0) return true;
  const rt = normalizeResourceType(resourceType);
  for (const cat of filter) {
    if (matchesCategory(rt, cat)) return true;
  }
  return false;
}
