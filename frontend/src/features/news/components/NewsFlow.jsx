import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { timeAgo } from "../../../utils/homeFeed";
import { listNewsArticles } from "../api/news";
import "../news-public.css";

// The news twin of the story page's flowing box: other news cards drift past on their own (the .flow styles are shared with StoryFlow).
// It stops while the reader hovers over it or tabs into it, and has a Pause button. Articles already on the page are left out;
// it is a bonus, so it is hidden when it cannot load or when there is too little else to show.
const MIN_ITEMS = 10;

function Card({ article, hidden }) {
  const meta = [article.source?.name, timeAgo(article.published_at)].filter(Boolean).join(" · ");
  return (
    <li className="flow-card">
      <Link to={`/news/${article.slug}`} tabIndex={hidden ? -1 : undefined}>
        <span className="flow-thumb">
          {article.lead_image?.url ? <img src={article.lead_image.url} alt="" loading="lazy" draggable="false" /> : null}
        </span>
        <span className="flow-title">{article.title}</span>
        {meta ? <span className="flow-meta">{meta}</span> : null}
      </Link>
    </li>
  );
}

export default function NewsFlow({ exclude = [], title = "More news to explore" }) {
  const [paused, setPaused] = useState(false);
  const query = useQuery({ queryKey: ["news", "flow"], queryFn: () => listNewsArticles({ page_size: 12 }), staleTime: 60 * 1000, retry: false });
  const skip = new Set(exclude);
  const others = (query.data?.items || []).filter((a) => !skip.has(a.slug));
  if (query.isError || others.length < 2) return null;

  const lap = [];
  while (lap.length < MIN_ITEMS) lap.push(...others);
  const seconds = Math.max(30, lap.length * 4);

  return (
    <section className={`flow np-flow${paused ? " is-paused" : ""}`} aria-labelledby="news-flow-heading">
      <div className="flow-head">
        <h2 id="news-flow-heading">{title}</h2>
        <button type="button" className="flow-toggle" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
      </div>
      <div className="flow-viewport">
        <div className="flow-track" style={{ "--flow-seconds": `${seconds}s` }}>
          <ul className="flow-group">{lap.map((a, i) => <Card key={`a-${i}-${a.slug}`} article={a} />)}</ul>
          <ul className="flow-group" aria-hidden="true">{lap.map((a, i) => <Card key={`b-${i}-${a.slug}`} article={a} hidden />)}</ul>
        </div>
      </div>
    </section>
  );
}
