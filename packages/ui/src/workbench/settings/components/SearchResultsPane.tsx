/**
 * SearchResultsPane — flat results view shown while the user is searching.
 *
 * Results are grouped by category, one card per category, with the
 * category's path from its root as a small breadcrumb header above each
 * card. Clicking the breadcrumb jumps the user to that category and
 * clears the search.
 *
 * Rows mount progressively: a first batch with the keystroke, the rest
 * as the user scrolls toward them. A short query can match most of the
 * registry, and a setting row is a full form control — mounting every
 * match at once would hold the keystroke for the whole list.
 *
 * The pane publishes the query's terms to the rows under it, so each
 * shows why it matched: hits painted in its label and in the category
 * breadcrumb, and a line of its description for a match the label
 * doesn't carry.
 */

import { theme } from 'antd';
import type React from 'react';
import { type RefObject, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useProgressiveCount } from '@openheaders/ui/shared/hooks/dom/useProgressiveCount';
import SettingRow from '../fields/SettingRow';
import { categoryPath } from '../localize';
import { allCategories } from '../registry';
import { groupByCategory, type SettingsSearchResult, takeRows } from '../search';
import { parseSearchQuery } from '../search/query';
import { SearchTermsContext } from '../search/terms-context';
import { SearchMatchText } from './search-match';

/** Rows per batch — more than the tallest settings window shows at once. */
const ROW_BATCH = 40;
/** The next batch mounts once the last mounted row is within this distance of the viewport. */
const LOOKAHEAD_PX = 800;

interface SearchResultsPaneProps {
  results: readonly SettingsSearchResult[];
  query: string;
  onJumpToCategory: (categoryId: string) => void;
  /** The element that scrolls the pane. */
  scrollRootRef: RefObject<HTMLElement | null>;
}

const SearchResultsPane: React.FC<SearchResultsPaneProps> = ({ results, query, onJumpToCategory, scrollRootRef }) => {
  const { token } = theme.useToken();
  const t = useT();

  const groups = useMemo(
    () =>
      groupByCategory(
        results.map((result) => result.def),
        allCategories(),
      ),
    [results],
  );
  const { count, sentinelRef } = useProgressiveCount<HTMLDivElement>(results.length, results, {
    batch: ROW_BATCH,
    lookaheadPx: LOOKAHEAD_PX,
    rootRef: scrollRootRef,
  });
  const mounted = useMemo(() => takeRows(groups, count), [groups, count]);
  const terms = useMemo(() => parseSearchQuery(query).terms, [query]);

  if (results.length === 0) {
    return (
      <div style={{ padding: '64px 32px', textAlign: 'center', color: token.colorTextSecondary, fontSize: 13 }}>
        {t('workbench.settings.shell.noMatchesFor')} <strong style={{ color: token.colorText }}>{query.trim()}</strong>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {t('workbench.settings.shell.searchResults')}
        </h2>
        <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
          {t('workbench.settings.shell.matchesFor', { count: results.length })} <em>{query.trim()}</em>
        </p>
      </header>
      <SearchTermsContext.Provider value={terms}>
        {mounted.map(({ category, defs }) => (
          <section key={category.id} style={{ marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => onJumpToCategory(category.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                margin: '0 0 5px 4px',
                padding: 0,
                border: 'none',
                background: 'transparent',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: token.colorTextTertiary,
                cursor: 'pointer',
              }}
              title={t('workbench.settings.shell.jumpToCategory')}
            >
              <span style={{ fontSize: 12, opacity: 0.85 }}>{category.icon}</span>
              {categoryPath(category, t).map((segment, i) => (
                <span key={segment} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && (
                    <span aria-hidden style={{ fontWeight: 400 }}>
                      ›
                    </span>
                  )}
                  <span>
                    <SearchMatchText text={segment} />
                  </span>
                </span>
              ))}
            </button>
            <div>
              {defs.map((def) => (
                <SettingRow key={def.key} def={def} />
              ))}
            </div>
          </section>
        ))}
      </SearchTermsContext.Provider>
      {count < results.length && <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />}
    </div>
  );
};

export default SearchResultsPane;
