import { useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdSlot from "../../../components/ads/AdSlot";
import { AD_SLOTS } from "../../../components/ads/adConfig";
import StorySideAds from "../../../components/ads/StorySideAds";
import QueryState from "../../../components/public/QueryState";
import ShareButtons from "../../../components/public/ShareButtons";
import StoryExtras from "../../../components/story/StoryExtras";
import StoryMoreFeed from "../../../components/story/StoryMoreFeed";
import StoryRenderer from "../../../components/StoryRenderer";
import { SITE_NAME } from "../../../config";
import { usePublicMeta } from "../../../hooks/usePublicMeta";
import { fmtDate } from "../../../utils/format";
import { articleJsonLd } from "../../../utils/seo";
import { countNewsView, getNewsArticle } from "../api/news";
import ArticleBody from "../components/ArticleBody";
import NewsComments from "../components/NewsComments";
import { useNewsConfig } from "../hooks/useNewsConfig";
import "../../../styles/story-page.css";
import "../news.css";

// An article from before the story editor existed (imported or licensed): its pictures and videos are separate, rights-cleared assets.
function Credit({ asset }) {
  const text = [asset.caption, asset.credit || asset.creator, asset.licence].filter(Boolean);
  return (
    <figure className="story-cover">
      {asset.kind === "image" && asset.image?.url && <img src={asset.image.url} alt={asset.alt || ""} width={asset.image.width || undefined} height={asset.image.height || undefined} />}
      {asset.kind === "video" && asset.video_id && (
        <div className="yt-embed"><iframe title={asset.alt || asset.caption || "Video"} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(asset.video_id)}`} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
      )}
      {text.length > 0 && <figcaption>{text.join(" · ")}</figcaption>}
    </figure>
  );
}

function NotFound() {
  return (
    <div className="story-page">
      <h1 className="story-title">Article not found</h1>
      <p className="lede">This article does not exist or is no longer available.</p>
      <p><Link to="/news">← Back to the news</Link></p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="story-page" aria-hidden="true">
      <div className="skeleton line short" /><div className="skeleton title-line" /><div className="skeleton line short" /><div className="skeleton cover-block" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton line" />)}
    </div>
  );
}

// /news/:slug: the same page as a story (progress bar, big title, cover, reading text, share, comments, "Discover more").
export default function NewsArticlePage() {
  const { slug } = useParams();
  const config = useNewsConfig();
  const query = useQuery({ queryKey: ["news", "article", slug], queryFn: () => getNewsArticle(slug), retry: false });
  const a = query.data;
  const origin = window.location.origin;

  const jsonLd = useMemo(() => (a ? articleJsonLd({ title: a.title, excerpt: a.standfirst, cover: a.cover, author: a.author_name, published_at: a.published_at, updated_at: a.published_at }, { origin, siteName: SITE_NAME }) : undefined), [a, origin]);
  usePublicMeta({ title: a?.title, description: a?.standfirst || a?.title, path: a ? `/news/${a.slug}` : undefined, image: a?.cover?.url, type: "article", robots: a ? "index,follow" : "noindex,follow", jsonLd });

  // Some licences require a page-view counter: count one view per opened article, never block the page on it.
  const counted = a?.counter_required;
  useEffect(() => { if (counted) countNewsView(slug).catch(() => {}); }, [counted, slug]);
  const sentinel = useRef(null);

  const inHouse = a?.article_type === "original";
  const assets = a?.assets || [];
  const useAssets = a && !a.cover && assets.length > 0;
  return (
    <div className="container">
      <StoryExtras />
      <div className="sp-layout">
        <div className="sp-main">
          <QueryState query={query} skeleton={<Skeleton />} notFound={<NotFound />}>
            {(art) => (
              <article className="story-page" lang={art.language || undefined}>
                <span ref={sentinel} className="read-sentinel" aria-hidden="true" />
                <p className="kicker">
                  {art.is_breaking && <span className="nw-chip-breaking">Breaking</span>}
                  <Link to="/news">News</Link>
                  {art.category && <> · <Link to={`/news/category/${art.category.slug}`}>{art.category.name}</Link></>}
                </p>
                <h1 className="story-title">{art.title}</h1>
                <p className="byline muted">
                  {[art.author_name && `By ${art.author_name}`, fmtDate(art.published_at), art.reading_minutes ? `${art.reading_minutes} min read` : null].filter(Boolean).join(" · ")}
                </p>
                {art.standfirst && <p className="lede">{art.standfirst}</p>}
                {art.cover?.url && (
                  <figure className="story-cover">
                    <img src={art.cover.url} alt={art.cover.alt_text || ""} width={art.cover.width || undefined} height={art.cover.height || undefined} fetchpriority="high" />
                  </figure>
                )}
                {useAssets && <Credit asset={assets[0]} />}
                {art.content_json ? <StoryRenderer content={art.content_json} /> : <div className="prose"><ArticleBody html={art.body} /></div>}
                {useAssets && assets.slice(1).map((x) => <Credit key={x.id} asset={x} />)}
                <AdSlot slot={AD_SLOTS.storyInline} />
                {!inHouse && (
                  <aside className="sp-licence" aria-label="Source and licence">
                    <p>{art.attribution}</p>
                    {art.original_url && <p><a href={art.original_url} rel="noopener noreferrer nofollow" target="_blank">Read the original article</a></p>}
                    {art.licence && <p className="muted">Licence: {art.licence}</p>}
                  </aside>
                )}
                <ShareButtons url={`${origin}/news/${art.slug}`} title={art.title} />
                <p className="sp-newsline">
                  Published by {art.source.name}. <Link to="/news/report">Report a copyright or accuracy problem</Link>
                  {config.copyright_contact && <> or write to <a href={`mailto:${config.copyright_contact}`}>{config.copyright_contact}</a></>}.
                </p>
              </article>
            )}
          </QueryState>
          {a && config.comments && <NewsComments slug={a.slug} />}
        </div>
        {a && <StorySideAds />}
      </div>
      {a && <AdSlot slot={AD_SLOTS.storyBottom} />}
      {a && <StoryMoreFeed excludeId={`news-${a.slug}`} />}
    </div>
  );
}
