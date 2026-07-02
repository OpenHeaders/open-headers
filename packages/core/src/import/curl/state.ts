import type { AuthConfig, HttpMethod, MultipartPart } from '../../types/request';

// ── Parser state ────────────────────────────────────────────────────

export interface ParserState {
  method: HttpMethod | null;
  url: string | null;
  headers: Array<{ key: string; value: string }>;
  /**
   * Accumulated body parts. Multiple `-d` flags on a single command
   * are joined with `&` — that's the curl convention. Later we map
   * that to a single body.content string.
   */
  dataParts: string[];
  /**
   * Kind of the first data flag that was seen. `raw` = no URL
   * encoding applied, `encoded` = URL-encoded (`-d`), `urlencoded`
   * = `--data-urlencode` (we pass the raw string through — curl's
   * actual behavior is more nuanced but for imported requests users
   * expect their body to land as-entered).
   */
  dataKind: 'raw' | 'encoded' | 'urlencoded' | null;
  auth: AuthConfig | null;
  /**
   * Multipart parts assembled from `-F` / `--form` flags. Text
   * fields (`key=value`) map to `{kind: 'text'}`; file fields
   * (`key=@path`) map to `{kind: 'file'}` with a PLACEHOLDER FileRef
   * (filename taken from the path). The user reconciles the
   * placeholder after import via the multipart body editor's
   * "Upload" button.
   */
  multipartParts: MultipartPart[];
}
