import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getCategories, getStories } from "../../api/public";
import { listProjects } from "../../api/marketplace";
import HomeFeed, { FeedSkeleton } from "../../components/home/HomeFeed";
import QueryState from "../../components/public/QueryState";
import { SITE_DESCRIPTION, SITE_NAME } from "../../config";
import { FEATURES } from "../../features";
import { usePublicMeta } from "../../hooks/usePublicMeta";
import { useNewsFeedItems } from "../../features/news/hooks/useNewsFeedItems";
import { mergeNewest } from "../../features/news/utils/feed";
import "../../styles/home-feed.css";

// The home page is a dark, news-feed style page: one big card that changes from story to story, two cards beside it and a
// second row of four. "Refresh stories" swaps in other stories, and every refresh also brings a few marketplace products.
// Every loaded page together, newest first, without the same story twice.
function poolOf(pages) {
  const seen = new Set();
  return (Array.isArray(pages) ? pages : [])
  .flatMap((p) => Array.isArray(p?.items) ? p.items : [])
  .filter((s) => s && (seen.has(s.id) ? false : seen.add(s.id)));
}

export default function HomePage() {
  usePublicMeta({ home: true, description: SITE_DESCRIPTION, path: "/" });

  // The stories come page by page as the reader scrolls (an endless feed); all pages together are the pool.
  const stories = useInfiniteQuery({
    queryKey: ["public", "stories", "feed"],
    queryFn: ({ pageParam }) => getStories({ page_size: 36, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pagination?.has_next ? last.pagination.page + 1 : undefined),
  });
  const news = useNewsFeedItems(24); // in-house news shown in the same cards, newest first (empty when News is off)
  const categories = useQuery({ queryKey: ["public", "categories"], queryFn: getCategories });
  // Products are a bonus: if the marketplace is off or cannot answer, the home page simply shows no product box.
  const products = useQuery({
    queryKey: ["public", "home-products"],
    queryFn: () => listProjects({ page_size: 24 }),
    enabled: FEATURES.marketplace,
    staleTime: 60 * 1000,
    retry: false,
  });

  return (
    <>
      <h1 className="sr-only">{SITE_NAME}</h1>
      <QueryState
        query={stories}
        skeleton={<FeedSkeleton />}
        isEmpty={(d) => (!Array.isArray(d?.pages?.[0]?.items) || d.pages[0].items.length === 0) && news.length === 0}
        empty={<div className="hf"><div className="empty">No stories have been published yet. Please check back soon.</div></div>}
      >
        {(d) => (
          <HomeFeed
            stories={mergeNewest(poolOf(d.pages), news)}
            products={products.data?.items || []}
            categories={categories.data || []}
            hasMore={Boolean(stories.hasNextPage)}
            loadingMore={stories.isFetchingNextPage}
            onLoadMore={() => stories.fetchNextPage()}
          />
        )}
      </QueryState>
      {/* The "More stories" strip is left out here: this page already shows a fixed set of cards, and the strip only repeats them. */}
    </>
  );
}
