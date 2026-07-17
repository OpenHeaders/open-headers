/**
 * DevTools panel — storage tool window: section nav, scope bar, the
 * four grids' chrome, quota card, clear gestures, document editor
 * tabs, and the cookie-edit round-trip vocabulary (SameSite labels /
 * On/Off projection — rendered AND parsed from the same keys; never
 * convert one side alone).
 *
 * Storage grid column headers and `(i)` titles stay raw (S37 parity
 * lock); localStorage/sessionStorage/WebSQL are platform names.
 */

import { plural } from '../../runtime';
import type { Catalog } from '../../types';

export const panelStorage = {
  // ── Storage tool window — shell, grids, sections, quota card, footer
  // lines. Raw by design: grid COLUMN HEADERS and their (i) titles
  // (Key / Value / Name / Domain · Path / Expires / Sec / Request /
  // Method / Size / Time — the S37 grid-header lock), the
  // localStorage / sessionStorage API globals, example-card payloads,
  // char / byte / MB figures, the '(iframe)' token, '—' em dashes,
  // the Key / Value input placeholders (they name their raw columns),
  // and data-plane not-sent reasons riding as holes. ─────────────────
  'panel.storage.nav.aria': 'Storage type',
  'panel.storage.nav.local': 'Local storage',
  'panel.storage.nav.session': 'Session storage',
  'panel.storage.nav.cookies': 'Cookies',
  'panel.storage.nav.indexeddb': 'IndexedDB',
  'panel.storage.nav.cachestorage': 'Cache Storage',
  'panel.storage.nav.quota': 'Usage',
  'panel.storage.nav.badgeTitle': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} match', other: '{count} matches' }),
  'panel.storage.filterAria': 'Filter storage entries',
  'panel.storage.revealedHidden': 'Revealed row is hidden by the active filter',
  'panel.storage.addCookieTitle': 'Add a cookie to the browser jar (including HttpOnly)',
  'panel.storage.addCookieAria': 'Add cookie',
  'panel.storage.addEntryTitle': 'Add entry',
  'panel.storage.addEntryAria': 'Add storage entry',
  'panel.storage.addReadOnly.indexeddb': 'IndexedDB is read-only here',
  'panel.storage.addReadOnly.cachestorage': 'Cache Storage is read-only here',
  'panel.storage.addReadOnly.quota': 'Usage is read-only',
  'panel.storage.refreshTitle': 'Refresh',
  'panel.storage.refreshAria': 'Refresh storage',
  'panel.storage.originAria': 'Storage origin',
  'panel.storage.partitionedChip': 'partitioned',
  'panel.storage.partitionedTitle':
    "Partitioned storage — this origin's data here is keyed under {site}.\nStorage key: {raw}",
  'panel.storage.partitionFallback': 'a partition',
  // Count lines — shared by the scope note and the footer status line.
  'panel.storage.count.items': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} item', other: '{count} items' }),
  'panel.storage.count.itemsOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} item', other: '{count} items' });
    return `${String(shown)} of ${total}`;
  },
  'panel.storage.count.cookies': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cookie', other: '{count} cookies' }),
  'panel.storage.count.cookiesOf': ({ shown, count }, locale) => {
    const total = plural(locale, Number(count), { one: '{count} cookie', other: '{count} cookies' });
    return `${String(shown)} of ${total}`;
  },
  'panel.storage.count.databases': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} database', other: '{count} databases' }),
  'panel.storage.count.caches': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} cache', other: '{count} caches' }),
  'panel.storage.count.quotaUsed': '{used} of {total} used',
  'panel.storage.count.sectionsMatch': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} section matches', other: '{count} sections match' }),
  'panel.storage.note.writeFailed': 'write failed',
  'panel.storage.note.deleteFailed': 'delete failed',
  'panel.storage.note.readFailed': 'read failed — showing last data',
  'panel.storage.note.truncated': 'list truncated',
  // Clear gestures — whole-sentence per-section titles (no noun stitching).
  'panel.storage.clear.label.local': 'Clear local storage',
  'panel.storage.clear.label.session': 'Clear session storage',
  'panel.storage.clear.label.cookies': 'Clear cookies',
  'panel.storage.clear.label.indexeddb': 'Clear IndexedDB',
  'panel.storage.clear.label.cachestorage': 'Clear Cache Storage',
  'panel.storage.clear.title.local': 'Clear every localStorage entry',
  'panel.storage.clear.title.session': 'Clear every sessionStorage entry',
  'panel.storage.clear.title.cookies': 'Clear every cookie in this site’s jar',
  'panel.storage.clear.title.indexeddb': 'Clear every IndexedDB database',
  'panel.storage.clear.title.cachestorage': 'Clear every cache',
  'panel.storage.clear.armedTitle.local': 'Deletes every localStorage entry for this origin',
  'panel.storage.clear.armedTitle.session': 'Deletes every sessionStorage entry for this origin',
  'panel.storage.clear.armedTitle.cookies': 'Deletes every cookie in this site’s jar for this origin',
  'panel.storage.clear.armedTitle.indexeddb': 'Deletes every IndexedDB database for this origin',
  'panel.storage.clear.armedTitle.cachestorage': 'Deletes every cache for this origin',
  'panel.storage.confirmClear': 'Confirm clear?',
  'panel.storage.confirmDelete': 'Confirm delete?',
  'panel.storage.confirmSuffixAria': '{action} — click again to confirm',
  'panel.storage.cleared': '✓ cleared',
  'panel.storage.clearFailed': 'clear failed',
  // Empty / error states.
  'panel.storage.empty.loading': 'Loading…',
  'panel.storage.empty.notAvailableTitle': 'Storage inspection isn’t available here',
  'panel.storage.empty.notAvailableSub': 'This host doesn’t expose the inspected tab’s application storage.',
  'panel.storage.empty.noOriginsTitle': 'No inspectable origins',
  'panel.storage.empty.noOriginsDomSub':
    'This tab has no http(s) frames with DOM storage — browser-internal pages can’t be inspected.',
  'panel.storage.empty.noOriginsSub': 'This tab has no http(s) frames — browser-internal pages can’t be inspected.',
  'panel.storage.empty.noOriginsCookiesSub':
    'This tab has no http(s) frames — browser-internal pages carry no site cookies.',
  'panel.storage.empty.unavailableTitle': 'Storage unavailable',
  'panel.storage.empty.unavailableSub': 'The frame for {origin} can’t be read right now — it may have navigated away.',
  'panel.storage.thisOrigin': 'this origin',
  'panel.storage.empty.noItems': 'No items in {area} for {origin}.',
  'panel.storage.empty.noItemsMatch': 'No items match your filter.',
  'panel.storage.empty.cookiesUnavailableTitle': 'Cookies aren’t available here',
  'panel.storage.empty.cookiesUnavailableSub': 'This host doesn’t expose the browser cookie jar.',
  'panel.storage.empty.noCookies': 'No cookies for {origin}.',
  'panel.storage.empty.noCookiesMatch': 'No cookies match your filter.',
  // Jar cookie grid column headers — 'Domain · Path' carries the raw
  // attribute vocabulary inside the keyed value.
  'panel.storage.cookies.col.name': 'Name',
  'panel.storage.cookies.col.value': 'Value',
  'panel.storage.cookies.col.scope': 'Domain · Path',
  'panel.storage.cookies.col.sec': 'Sec',
  // DOM storage grid.
  'panel.storage.grid.col.key': 'Key',
  'panel.storage.grid.col.value': 'Value',
  'panel.storage.grid.keyPlaceholder': 'Key',
  'panel.storage.grid.valuePlaceholder': 'Value',
  'panel.storage.grid.aria': 'Storage entries',
  'panel.storage.grid.clipped': 'clipped ({length})',
  'panel.storage.grid.editTitle': 'Edit this entry',
  'panel.storage.grid.editAria': 'Edit {key}',
  'panel.storage.grid.deleteTitle': 'Delete this entry',
  'panel.storage.grid.deleteAria': 'Delete {key}',
  'panel.storage.grid.newKeyAria': 'New entry key',
  'panel.storage.grid.newValueAria': 'New entry value',
  'panel.storage.grid.keyAria': 'Entry key',
  'panel.storage.grid.valueAria': 'Entry value',
  'panel.storage.grid.addSaveHint': 'Write the new entry to storage',
  'panel.storage.grid.editSaveHint': 'Write the edited entry back to storage',
  'panel.storage.grid.emptyKeyHint': "The key can't be empty",
  'panel.storage.grid.cancelTitle': 'Cancel',
  'panel.storage.grid.cancelAddAria': 'Cancel add',
  'panel.storage.grid.cancelEditAria': 'Cancel edit',
  'panel.storage.grid.tooLarge': 'Too large to edit here — the full value exceeds the edit ceiling.',
  'panel.storage.grid.fetchFailed': 'The full value can’t be read right now.',
  'panel.storage.grid.loadingFullValue': 'Loading full value…',
  'panel.storage.save.label': 'Save',
  'panel.storage.save.noChanges': 'No changes to save',
  // Cookies section (jar grid rows).
  'panel.storage.cookieRow.notSentTitle': 'Not sent to this page — {reason}',
  'panel.storage.cookieRow.notSentAria': 'Cookie {name} is not sent to this page: {reason}',
  'panel.storage.cookieRow.partitionedUnder': 'Partitioned under {key}',
  'panel.storage.cookieRow.editTitle': 'Edit this cookie in the browser jar',
  'panel.storage.cookieRow.editAria': 'Edit cookie {name}',
  'panel.storage.cookieRow.deleteTitle': 'Delete this cookie from the browser jar',
  'panel.storage.cookieRow.deleteAria': 'Delete cookie {name}',
  // IndexedDB section.
  'panel.storage.idb.cantReadTitle': 'IndexedDB can’t be read',
  'panel.storage.idb.cantReadSub': 'This frame doesn’t expose its databases right now — it may have navigated away.',
  'panel.storage.idb.noDatabases': 'No IndexedDB databases for this origin.',
  'panel.storage.idb.versionTitle': 'Database version {version}',
  'panel.storage.idb.storeCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} store', other: '{count} stores' }),
  'panel.storage.idb.metaKeyPath': 'key: {path}',
  'panel.storage.idb.metaAutoIncrement': 'auto-increment keys',
  'panel.storage.idb.metaOutOfLine': 'out-of-line keys',
  'panel.storage.idb.indexCount': ({ count }, locale) =>
    plural(locale, Number(count), { one: '{count} index', other: '{count} indexes' }),
  'panel.storage.idb.deleteDbTitle': 'Delete the {name} database',
  'panel.storage.idb.deleteDbConfirmTitle':
    'Deletes {name} and every store in it — a page holding it open blocks the delete',
  'panel.storage.idb.deleteDbAria': 'Delete database {name}',
  'panel.storage.idb.openStoreTitle': 'Open {database} › {store}',
  'panel.storage.idb.clearStoreTitle': 'Clear all records in {store}',
  'panel.storage.idb.clearStoreConfirmTitle': 'Deletes every record in {database} › {store}',
  'panel.storage.idb.clearStoreAria': 'Clear store {store}',
  'panel.storage.idb.noStores': 'no object stores',
  'panel.storage.idb.backTitle': 'Back to databases',
  'panel.storage.idb.cursorAria': 'Record cursor',
  'panel.storage.idb.cursorTitle': 'Read the store through one of its indexes — the key column becomes the index key',
  'panel.storage.idb.primaryKeyOption': 'primary key',
  'panel.storage.idb.indexOption': 'index: {name}',
  'panel.storage.idb.noRecords': 'No records in {store}.',
  'panel.storage.idb.noRecordsPage': 'No records in {store} on this page.',
  'panel.storage.idb.noRecordsMatch': 'No records match your filter.',
  'panel.storage.idb.gridAria': 'IndexedDB records',
  'panel.storage.idb.col.key': 'Key',
  'panel.storage.idb.col.value': 'Value',
  'panel.storage.idb.openRecordTitle': 'Open this record in the editor',
  'panel.storage.idb.keyCellTitle': 'Key: {key}\nPrimary key: {primaryKey}',
  'panel.storage.idb.deleteRecordTitle': 'Delete this record',
  'panel.storage.idb.deleteRecordAria': 'Delete record {key}',
  'panel.storage.pager.prevTitle': 'Previous page',
  'panel.storage.pager.nextTitle': 'Next page',
  'panel.storage.pager.page': 'page {page}',
  // Cache Storage section.
  'panel.storage.cache.cantReadTitle': 'Cache Storage can’t be read',
  'panel.storage.cache.cantReadSub':
    'The API only exists in secure contexts (https) — or this frame can’t be read right now.',
  'panel.storage.cache.noCaches': 'No caches for this origin.',
  'panel.storage.cache.noCachesMatch': 'No caches match your filter.',
  'panel.storage.cache.openTitle': 'Open the {name} cache',
  'panel.storage.cache.deleteTitle': 'Delete the {name} cache',
  'panel.storage.cache.deleteConfirmTitle': 'Deletes {name} and every entry in it',
  'panel.storage.cache.deleteAria': 'Delete cache {name}',
  'panel.storage.cache.backTitle': 'Back to caches',
  'panel.storage.cache.noEntries': 'No entries in {name}.',
  'panel.storage.cache.noEntriesPage': 'No entries in {name} on this page.',
  'panel.storage.cache.noEntriesMatch': 'No entries match your filter.',
  'panel.storage.cache.gridAria': 'Cache entries',
  'panel.storage.cache.col.request': 'Request',
  'panel.storage.cache.col.method': 'Method',
  'panel.storage.cache.col.size': 'Size',
  'panel.storage.cache.col.time': 'Time',
  'panel.storage.cache.deleteEntryTitle': 'Delete this entry',
  'panel.storage.cache.deleteEntryConfirmTitle': 'Deletes the stored response — click again to confirm',
  'panel.storage.cache.deleteEntryAria': 'Delete entry {url}',
  // Usage (quota) section.
  'panel.storage.quota.cantReadTitle': 'Usage can’t be read',
  'panel.storage.quota.cantReadSub':
    'The API only exists in secure contexts (https) — or this frame can’t be read right now.',
  'panel.storage.quota.used': '{size} used',
  'panel.storage.quota.ofTotal': 'of {size} ({percent}%)',
  'panel.storage.quota.type.serviceWorkers': 'Service workers',
  'panel.storage.quota.type.fileSystems': 'File systems',
  'panel.storage.quota.type.other': 'Other',
  'panel.storage.quota.noBreakdown': 'No per-type usage reported for this origin.',
  'panel.storage.quota.debugHint': 'Enable Debug mode to see the per-type breakdown.',
  'panel.storage.quota.sessionNote': 'Session storage is per-tab — this clears the inspected tab’s frame',
  'panel.storage.quota.targetsCaption': 'Clear everything targets',
  'panel.storage.quota.targetsTitle':
    'Clear everything (top right) deletes exactly the checked data types for this origin',
  'panel.storage.quota.simulateLabel': 'Simulate custom quota',
  'panel.storage.quota.simulateTitle':
    'Make the browser report and enforce a smaller quota for this origin — for testing how the page behaves when storage runs out',
  'panel.storage.quota.simulateSave': 'Save',
  'panel.storage.quota.simulateCancel': 'Cancel',
  'panel.storage.quota.simulateReset': 'Reset',
  'panel.storage.quota.simulateResetTitle': 'Remove the simulated quota',
  'panel.storage.quota.simulateRange': 'enter 0–{max} MB',
  'panel.storage.quota.simulateFailed': 'simulation failed',
  'panel.storage.quota.clearEverything': 'Clear everything',
  'panel.storage.quota.clearArmedTitle': 'Deletes the checked data types for this origin',
  'panel.storage.quota.clearTitle': 'Clear the checked data types for this origin',
  // Column (i) corpora — titles stay raw column nouns; kickers reuse
  // the nav keys; example payloads ride raw.
  'panel.storage.domCol.exampleCaption': 'Example write',
  'panel.storage.domCol.key.summary':
    "The entry's name — a case-sensitive string, unique within this origin's {area}. Writing an existing key overwrites its value.",
  'panel.storage.domCol.key.description':
    'Renaming an entry here writes the new key first, then removes the old one — a failed write never loses the original.',
  'panel.storage.domCol.value.summary':
    'The stored payload — always a string; pages keep structured data serialized, usually as JSON.',
  'panel.storage.domCol.value.description':
    'The grid shows a one-line preview and clips very long values — opening or editing an entry fetches the full text. Click a row to open it as an editor tab; double-click (or the pencil) edits inline.',
  'panel.storage.cookieCol.name.summary':
    'The cookie identifier. Browsers key on (name, domain, path) — the same name with a different scope is a separate cookie.',
  'panel.storage.cookieCol.name.description':
    'A warning triangle marks a site-jar cookie the browser would NOT attach to a request to the inspected page — hover it for the reason (path scoped elsewhere, Secure-only on http, subdomain scoped, …).',
  'panel.storage.cookieCol.value.summary': 'The cookie payload — what the browser sends back in the Cookie header.',
  'panel.storage.cookieCol.value.description':
    'Click a row to open the cookie as an editor tab with the full value and parsed views; the pencil edits inline.',
  'panel.storage.cookieCol.scope.summary':
    'Where the browser attaches this cookie — its Domain plus, when narrower than /, its Path.',
  'panel.storage.cookieCol.scope.description':
    'A domain-wide cookie (stored with a leading dot) flows to subdomains too; a host-only cookie is pinned to exactly its host. The path is a prefix — /api means only requests under /api carry it.',
  'panel.storage.cookieCol.expires.summary':
    'When the browser deletes the cookie, shown relative to now — hover for the absolute date.',
  'panel.storage.cookieCol.expires.description':
    'Session means no Expires / Max-Age — the browser drops the cookie when the session ends.',
  'panel.storage.cacheCol.exampleCaption': 'Example entry',
  // Fragment between the size and time tokens in the example card's
  // meta line ('1.2 kB · stored Jan 4 …').
  'panel.storage.cacheCol.exampleStored': '· stored',
  'panel.storage.cacheCol.request.summary': "The stored request's URL — the key the cache matches fetches against.",
  'panel.storage.cacheCol.request.description':
    'Hovering a row adds a bounded preview of the stored request headers. Click a row to open the stored response as an editor tab; the grid keeps metadata only.',
  'panel.storage.cacheCol.method.summary':
    "The stored request's HTTP method — part of the cache key alongside the URL.",
  'panel.storage.cacheCol.method.description': 'Almost always GET: the Cache API rejects put / add for other methods.',
  'panel.storage.cacheCol.size.summary': "The stored response's size, read from its content-length header.",
  'panel.storage.cacheCol.size.description':
    "An em dash means the stored response carries no content-length — the body is still there, in the entry's editor tab.",
  'panel.storage.cacheCol.time.summary': 'When the response was stored in the cache.',
  'panel.storage.cacheCol.time.description':
    "Only derivable on attached tabs — an em dash means the host couldn't read it for this scope.",
  'panel.storage.idbCol.exampleCaption': 'Example record',
  'panel.storage.idbCol.key.summary':
    "The record's key under the current cursor — the store's primary key by default; picking an index in the breadcrumb reads through it, and this column becomes the index key.",
  'panel.storage.idbCol.key.description':
    'Hovering a row shows both keys (cursor key and primary key). Keys can be numbers, strings, dates, or arrays of those.',
  'panel.storage.idbCol.value.summary':
    "A one-line preview of the record's structured-clone value, serialized in the page.",
  'panel.storage.idbCol.value.description':
    'Click a row to open the full record as an editor tab with the expandable tree; the grid keeps only the preview.',
  // Storage editor-tab documents. Shared doc chrome first (same control
  // across the four tabs); per-document copy keys separately even where
  // the English coincides (separate referents). Crumbs, status lines,
  // and localStorage/sessionStorage names stay raw.
  'panel.storage.doc.reveal': 'Reveal in Storage',
  'panel.storage.doc.refreshConfirm': 'Discards your edits — click again to refresh',
  'panel.storage.doc.discardEdits': 'Discard my edits',
  'panel.storage.doc.openMergeView': 'Open merge view',
  'panel.storage.doc.preview': 'Preview',
  'panel.storage.doc.source': 'Source',
  'panel.storage.doc.unavailableSub':
    'It may have been deleted, or the frame can’t be read right now — Refresh retries.',
  'panel.storage.doc.clippedSuffix': ({ count }, locale) =>
    plural(locale, Number(count), { one: '… ({count} more character)', other: '… ({count} more characters)' }),
  // Cookie document.
  'panel.storage.doc.cookie.saveFailed.collision':
    'A cookie with that name, domain and path already exists — saving would overwrite it. Pick a different identity.',
  'panel.storage.doc.cookie.saveFailed.write': 'Save failed — the browser jar rejected the write.',
  'panel.storage.doc.cookie.saveFailed.remove':
    'The new cookie was written but the original couldn’t be removed — both exist. Refresh re-reads the jar.',
  'panel.storage.doc.cookie.saveHint': 'Write the edited cookie back to the browser jar',
  'panel.storage.doc.cookie.blockedHint': 'The form is incomplete or a reference doesn’t resolve',
  'panel.storage.doc.cookie.refreshTitle': 'Re-read the cookie',
  'panel.storage.doc.cookie.refreshAria': 'Refresh cookie',
  'panel.storage.doc.cookie.revealTitle': 'Open Cookies in the Storage tool window',
  'panel.storage.doc.cookie.readOnlyNote':
    'This host’s cookie jar is read-only — the document reflects the jar but can’t write back.',
  'panel.storage.doc.cookie.goneNote':
    'This cookie was deleted in the browser — your unsaved edits are kept. Save writes it back.',
  'panel.storage.doc.cookie.unavailableTitle': 'Cookie no longer in the jar',
  'panel.storage.doc.cookie.unavailableSub':
    'It may have been deleted or expired, or the jar can’t be read on this host — Refresh retries.',
  // DOM storage entry document.
  'panel.storage.doc.dom.saveFailed.collision':
    'An entry with that key already exists — saving would overwrite it. Pick a different key.',
  'panel.storage.doc.dom.saveFailed.gone': 'The entry can’t be reached — it may have been deleted. Refresh re-checks.',
  'panel.storage.doc.dom.saveFailed.quota':
    'Save failed — the storage quota was exceeded. The original entry is unchanged.',
  'panel.storage.doc.dom.saveFailed.write': 'Save failed — the write was rejected.',
  'panel.storage.doc.dom.modeAria': 'Entry view mode',
  'panel.storage.doc.dom.previewTitle': 'Collapsible tree over the parsed value',
  'panel.storage.doc.dom.previewNeedsJson': 'Preview needs a JSON value',
  'panel.storage.doc.dom.sourceTitle': 'Raw value view',
  'panel.storage.doc.dom.saveHint': 'Write the edited entry back to storage',
  'panel.storage.doc.dom.blockedHint': 'The key can’t be empty',
  'panel.storage.doc.dom.refreshTitle': 'Re-read the entry',
  'panel.storage.doc.dom.refreshAria': 'Refresh entry',
  'panel.storage.doc.dom.revealTitle': 'Open {area} in the Storage tool window',
  'panel.storage.doc.dom.keyLabel': 'Key',
  'panel.storage.doc.dom.keyAria': 'Entry key',
  'panel.storage.doc.dom.conflictNote': 'The value changed in the browser while you were editing.',
  'panel.storage.doc.dom.mergeToast': 'Merge applied to the draft — Save writes it to the browser',
  'panel.storage.doc.dom.goneNote':
    'This entry was deleted in the browser — your unsaved edits are kept. Save writes it back.',
  'panel.storage.doc.dom.unavailableTitle': 'Entry no longer available',
  'panel.storage.doc.dom.tooLargeTitle': 'Too large to open',
  'panel.storage.doc.dom.tooLargeSub': 'The value is past the editor’s ceiling and stays read-only.',
  'panel.storage.doc.dom.previewAria': 'Entry value tree',
  // IndexedDB record document.
  'panel.storage.doc.idb.saveFailed.parse': 'Not valid JSON — fix the syntax and save again.',
  'panel.storage.doc.idb.saveFailed.keyChanged':
    'The key changed — saving would create a new record. Restore the original key.',
  'panel.storage.doc.idb.saveFailed.gone': 'The record can’t be reached — it may have been deleted. Refresh re-checks.',
  'panel.storage.doc.idb.saveFailed.write': 'Save failed — the write was rejected.',
  'panel.storage.doc.idb.modeAria': 'Record view mode',
  'panel.storage.doc.idb.previewTitle': 'Collapsible tree over the record value',
  'panel.storage.doc.idb.previewNeedsDoc': 'Preview needs a well-formed document',
  'panel.storage.doc.idb.sourceTitle': 'Full-document source view',
  'panel.storage.doc.idb.saveHint': 'Write the edited value back to the record',
  'panel.storage.doc.idb.refreshTitle': 'Re-read the record',
  'panel.storage.doc.idb.refreshAria': 'Refresh record',
  'panel.storage.doc.idb.revealTitle': 'Open {database} › {store} in the Storage tool window',
  'panel.storage.doc.idb.truncatedNote': 'Truncated at the size cap — read-only.',
  'panel.storage.doc.idb.nonJsonNote':
    'Contains non-JSON types (Date, Map, binary, …) — shown as a read-only rendering.',
  'panel.storage.doc.idb.conflictNote': 'The record changed in the browser while you were editing.',
  'panel.storage.doc.idb.mergeToast': 'Merge applied to the draft — Save writes it to the record',
  'panel.storage.doc.idb.goneNote':
    'This record was deleted or changed shape in the browser — your unsaved edits are kept. Save writes them back.',
  'panel.storage.doc.idb.unavailableTitle': 'Record no longer available',
  'panel.storage.doc.idb.previewAria': 'Record value tree',
  // Cache Storage entry document (read-only; delete is the only mutation).
  'panel.storage.doc.cache.deleteTitle': 'Delete this entry from the cache',
  'panel.storage.doc.cache.deleteConfirmTitle': 'Deletes the stored response — click again to confirm',
  'panel.storage.doc.cache.deleteAria': 'Delete cache entry',
  'panel.storage.doc.cache.refreshTitle': 'Re-read the stored response',
  'panel.storage.doc.cache.refreshAria': 'Refresh cache entry',
  'panel.storage.doc.cache.revealTitle': 'Open the {cache} cache in the Storage tool window',
  'panel.storage.doc.cache.deleteFailed': 'Delete failed — the entry may already be gone.',
  'panel.storage.doc.cache.unavailableTitle': 'Cache entry no longer available',
  'panel.storage.doc.cache.truncatedNote': 'Body truncated at the size cap — {size} stored.',
  'panel.storage.doc.cache.headersSummary': 'Response headers ({count})',
  'panel.storage.doc.cache.filterPlaceholder': 'Filter headers',
  'panel.storage.doc.cache.filterAria': 'Filter response headers',
  'panel.storage.doc.cache.noHeaders': 'No headers stored.',
  'panel.storage.doc.cache.noHeadersMatch': 'No headers match your filter.',
  'panel.storage.doc.cache.bodySummary': 'Response body',
  'panel.storage.doc.cache.imageAria': 'Stored image body',
  'panel.storage.doc.cache.imageAlt': 'Stored response body for {url}',
  'panel.storage.doc.cache.binaryBody': 'Binary body — {size} stored.',
  'panel.storage.doc.cache.emptyBody': 'Empty body.',
} as const satisfies Catalog;
