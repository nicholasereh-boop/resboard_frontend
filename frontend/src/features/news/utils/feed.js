// News articles shaped like stories, so the story cards, the home feed and the "Discover more" feed can show both with one design.
// A news item carries its own address (href) and kind; everything else (title, excerpt, cover, author, published_at, reading_minutes) has the same name as on a story.
export const toFeedItem = (a) => ({
  id: `news-${a.slug}`, kind: "news", slug: a.slug, href: a.path || `/news/${a.slug}`, title: a.title,
  excerpt: a.excerpt || a.standfirst || "", cover: a.cover || null, author: a.author || a.author_name || "",
  published_at: a.published_at, reading_minutes: a.reading_minutes || 0, category: a.category || null,
});

const time = (s) => { const t = Date.parse(s?.published_at || ""); return Number.isNaN(t) ? 0 : t; };

// Stories and news together, newest first, without the same item twice.
export function mergeNewest(stories = [], news = []) {
  const seen = new Set();
  return [...stories, ...news].filter((s) => s && (seen.has(s.id) ? false : seen.add(s.id))).sort((a, b) => time(b) - time(a));
}

// Where a card leads: news items carry their own address, stories live under /stories.
export const hrefOf = (item) => item.href || `/stories/${item.slug}`;
