import { useQuery } from "@tanstack/react-query";
import AdSlot from "../../../components/ads/AdSlot";
import { AD_SLOTS } from "../../../components/ads/adConfig";
import { HeroCarousel, StoryTile } from "../../../components/home/HomeFeed";
import StoryMoreFeed from "../../../components/story/StoryMoreFeed";
import { usePublicMeta } from "../../../hooks/usePublicMeta";
import { buildBatch } from "../../../utils/homeFeed";
import { getNewsFeatured, listNewsArticles } from "../api/news";
import NewsNav from "../components/NewsNav";
import { mergeNewest, toFeedItem } from "../utils/feed";
import "../../../styles/home-feed.css";
import "../../../styles/story-page.css";
import "../news.css";

// /news: the home page's design (big rotating card, cards beside it, then more), made only of news; "Discover more" below mixes in stories.
export default function NewsHomePage() {
  usePublicMeta({ title: "News", description: "The latest news from the team.", path: "/news" });
  const latest = useQuery({ queryKey: ["news", "latest-page"], queryFn: () => listNewsArticles({ page_size: 24 }) });
  const featured = useQuery({ queryKey: ["news", "featured"], queryFn: getNewsFeatured });
  // Featured articles lead the big rotating card, then everything else newest first.
  const lead = (featured.data || []).map(toFeedItem);
  const leadIds = new Set(lead.map((s) => s.id));
  const items = [...lead, ...mergeNewest([], (latest.data?.items || []).map(toFeedItem)).filter((s) => !leadIds.has(s.id))];
  const { hero, small } = buildBatch(items, [], 0);
  const rest = items.slice(hero.length + small.length);
  return (
    <div className="container">
      <h1 className="nw-h1">News</h1>
      <NewsNav />
      {latest.isLoading && <p className="nw-muted">Loading the latest news…</p>}
      {latest.isError && <p className="nw-error" role="alert">Could not load the news. Please try again.</p>}
      {latest.data && items.length === 0 && <p className="nw-empty">No news has been published yet.</p>}
      {items.length > 0 && (
        <div className="hf">
          <ul className="hf-grid">
            <HeroCarousel items={hero} />
            {/* ADSENSE: news home ad, after the big card */}
            {AD_SLOTS.newsHome && <li className="hf-card hf-ad"><AdSlot slot={AD_SLOTS.newsHome} /></li>}
            {[...small, ...rest].map((s) => <StoryTile key={s.id} story={s} />)}
          </ul>
        </div>
      )}
      {/* ADSENSE: news home bottom ad */}
      {items.length > 0 && <AdSlot slot={AD_SLOTS.newsHomeBottom} />}
      <StoryMoreFeed />
    </div>
  );
}
