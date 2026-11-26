import { Link } from "react-router-dom";
import { SITE_NAME } from "../../../config";
import { timeAgo } from "../../../utils/homeFeed";

// A news card, drawn exactly like the story cards in "Discover more" (styles/story-page.css, .sf-*).
export default function ArticleCard({ article }) {
  const name = article.author || article.source?.name || SITE_NAME;
  const ago = timeAgo(article.published_at);
  const cover = article.cover || article.lead_image;
  return (
    <li className="sf-card">
      <Link to={`/news/${article.slug}`}>
        <span className="sf-thumb">
          {cover?.url ? <img src={cover.url} alt="" loading="lazy" draggable="false" /> : <span className="sf-noimg" aria-hidden="true">{article.title.slice(0, 1).toUpperCase()}</span>}
        </span>
        <span className="sf-text">
          <span className="sf-meta"><span className="sf-dot" aria-hidden="true" />{name}{ago ? ` · ${ago}` : ""}{article.is_breaking ? <span className="sf-kind">Breaking</span> : <span className="sf-kind">News</span>}</span>
          <span className="sf-title">{article.title}</span>
          {(article.excerpt || article.standfirst) ? <span className="sf-excerpt">{article.excerpt || article.standfirst}</span> : null}
          <span className="sf-foot">{[article.category?.name, article.reading_minutes ? `${article.reading_minutes} min read` : null].filter(Boolean).join(" · ")}</span>
        </span>
      </Link>
    </li>
  );
}
