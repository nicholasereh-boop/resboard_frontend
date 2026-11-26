import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getStories } from "../../../api/public";
import { SITE_NAME } from "../../../config";
import { takeCircular, timeAgo } from "../../../utils/homeFeed";
import { listNewsArticles, listNewsCategories } from "../api/news";
import "../../../styles/story-page.css"; // the shared "Discover more" card styles (.sf-*) live here
import "../news-public.css";

// "Discover more" for the News pages, built like the one under a story: wide list cards (picture left, words right) in a fixed set that
// a Refresh button replaces with the next set. News and stories are mixed, one after the other. A bonus: hidden when there is nothing to show.
const PER_SET = 16;

function mix(news, stories) {
  const out = [];
  for (let i = 0; i < Math.max(news.length, stories.length); i += 1) {
    if (news[i]) out.push({ type: "news", key: `n-${news[i].slug}`, item: news[i] });
    if (stories[i]) out.push({ type: "story", key: `s-${stories[i].slug}`, item: stories[i] });
  }
  return out;
}

function NewsRow({ article }) {
  const ago = timeAgo(article.published_at);
  return (
    <li className="sf-card">
      <Link to={`/news/${article.slug}`}>
        <span className="sf-thumb">
          {article.lead_image?.url ? <img src={article.lead_image.url} alt="" loading="lazy" draggable="false" /> : <span className="sf-noimg" aria-hidden="true">{(article.title || "N").slice(0, 1).toUpperCase()}</span>}
        </span>
        <span className="sf-text">
          <span className="sf-meta"><span className="np-kind np-kind-news">News</span>{[article.source?.name, ago].filter(Boolean).join(" · ")}</span>
          <span className="sf-title">{article.title}</span>
          {article.standfirst ? <span className="sf-excerpt">{article.standfirst}</span> : null}
          {article.category ? <span className="sf-foot">{article.category.name}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function StoryRow({ story }) {
  const ago = timeAgo(story.published_at);
  return (
    <li className="sf-card">
      <Link to={`/stories/${story.slug}`}>
        <span className="sf-thumb">
          {story.cover?.url ? <img src={story.cover.url} alt="" loading="lazy" draggable="false" /> : <span className="sf-noimg" aria-hidden="true">{(story.title || "S").slice(0, 1).toUpperCase()}</span>}
        </span>
        <span className="sf-text">
          <span className="sf-meta"><span className="np-kind np-kind-story">Story</span>{[story.author || SITE_NAME, ago].filter(Boolean).join(" · ")}</span>
          <span className="sf-title">{story.title}</span>
          {story.excerpt ? <span className="sf-excerpt">{story.excerpt}</span> : null}
          {story.reading_minutes ? <span className="sf-foot">{story.reading_minutes} min read</span> : null}
        </span>
      </Link>
    </li>
  );
}

export default function NewsMoreFeed({ exclude = [], title = "Discover more news and stories" }) {
  const newsQ = useQuery({ queryKey: ["news", "feed"], queryFn: () => listNewsArticles({ page_size: 48 }), staleTime: 60 * 1000, retry: false });
  const storyQ = useQuery({ queryKey: ["news", "feed-stories"], queryFn: () => getStories({ page_size: 24 }), staleTime: 60 * 1000, retry: false });
  const cats = useQuery({ queryKey: ["news", "categories"], queryFn: listNewsCategories, staleTime: 5 * 60_000 });

  const [batch, setBatch] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const section = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const skip = new Set(exclude);
  const news = (newsQ.data?.items || []).filter((a) => !skip.has(a.slug));
  const stories = storyQ.data?.items || [];
  const all = mix(news, stories);
  if (all.length === 0) return null;
  const shown = takeCircular(all, batch * PER_SET, Math.min(PER_SET, all.length));
  const topics = (cats.data || []).slice(0, 6);

  const refresh = () => {
    setBatch((b) => b + 1);
    setSpinning(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSpinning(false), 700);
    section.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="sf np-feed" ref={section} aria-labelledby="np-feed-heading">
      <div className="sf-head">
        <h2 id="np-feed-heading">{title}</h2>
        <button type="button" className={`sf-refresh${spinning ? " is-spinning" : ""}`} onClick={refresh}>
          <span className="sf-spin" aria-hidden="true">↻</span> Refresh
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{batch > 0 ? "Showing a new set of news and stories" : ""}</p>
      <ul className="sf-topics" aria-label="Browse topics">
        {topics.map((c) => <li key={c.slug}><Link to={`/news/category/${c.slug}`}>{c.name}</Link></li>)}
        <li><Link to="/stories">All stories</Link></li>
      </ul>
      <ul className="sf-grid" key={batch}>
        {shown.map((e) => (e.type === "news" ? <NewsRow key={e.key} article={e.item} /> : <StoryRow key={e.key} story={e.item} />))}
      </ul>
      <div className="sf-more"><button type="button" className="sf-more-btn" onClick={refresh}>Show me a new set</button></div>
    </section>
  );
}
