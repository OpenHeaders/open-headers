export default function ResourceIcon({ type }: { type: string }) {
  const rt = type.toLowerCase();
  const cls = `dt-resource-icon dt-resource-icon--${rt}`;
  if (rt === 'document' || rt === 'main_frame' || rt === 'sub_frame')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <path d="M2 1h5l3 3v7H2V1z" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <path d="M7 1v3h3" fill="none" stroke="currentColor" strokeWidth={1} />
      </svg>
    );
  if (rt === 'script' || rt === 'js')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <text x="6" y="8.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="currentColor">
          JS
        </text>
      </svg>
    );
  if (rt === 'stylesheet' || rt === 'css')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <path d="M4 4h4M3 6h6M4 8h4" stroke="currentColor" strokeWidth={0.9} />
      </svg>
    );
  if (rt === 'image' || rt === 'img')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <circle cx="4" cy="4.5" r="1.2" fill="currentColor" />
        <path d="M1 9l3-3 2 2 2-1.5L11 9" fill="none" stroke="currentColor" strokeWidth={1} />
      </svg>
    );
  if (rt === 'font')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <text x="6" y="9.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor">
          F
        </text>
      </svg>
    );
  if (rt === 'media')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <polygon points="3,2 10,6 3,10" fill="currentColor" />
      </svg>
    );
  if (rt === 'websocket' || rt === 'ws')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.5} />
      </svg>
    );
  if (rt === 'fetch' || rt === 'xmlhttprequest' || rt === 'xhr')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <path d="M6 1.5v9M1.5 6h9" fill="none" stroke="currentColor" strokeWidth={0.8} />
      </svg>
    );
  if (rt === 'preflight')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <path
          d="M4 6l1.5 1.5L8 5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (rt === 'manifest')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <path d="M3 4h6M3 6h6M3 8h4" stroke="currentColor" strokeWidth={0.9} />
      </svg>
    );
  if (rt === 'wasm')
    return (
      <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth={1.2} />
        <text x="6" y="8.5" textAnchor="middle" fontSize="5" fontWeight="bold" fill="currentColor">
          W
        </text>
      </svg>
    );
  return (
    <svg className={cls} viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth={1.2} />
    </svg>
  );
}
