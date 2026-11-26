import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FEATURE_NEWS } from "../../../features";
import { listNewsArticles } from "../api/news";
import { toFeedItem } from "../utils/feed";

// The latest public news as story-shaped feed items. A bonus for the home page and the "Discover more" feed:
// when News is off, not public yet or cannot answer, this is simply an empty list and nothing else changes.
export function useNewsFeedItems(size = 24) {
  const q = useQuery({
    queryKey: ["news", "feed-items", size],
    queryFn: () => listNewsArticles({ page_size: size }),
    enabled: FEATURE_NEWS, staleTime: 60_000, retry: false,
  });
  return useMemo(() => (FEATURE_NEWS ? (q.data?.items || []).map(toFeedItem) : []), [q.data]);
}
