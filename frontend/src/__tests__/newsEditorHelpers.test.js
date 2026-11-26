import { describe, expect, it } from "vitest";
import { htmlToDoc } from "../features/news/utils/htmlToDoc";
import { hrefOf, mergeNewest, toFeedItem } from "../features/news/utils/feed";

describe("older news text opens in the story editor", () => {
  it("keeps paragraphs, headings, lists, links and emphasis", () => {
    const doc = htmlToDoc('<h2>Title</h2><p>Hello <strong>bold</strong> <a href="https://x.org">link</a></p><ul><li>One</li></ul>');
    expect(doc.content.map((n) => n.type)).toEqual(["heading", "paragraph", "bulletList"]);
    const marks = doc.content[1].content.flatMap((n) => (n.marks || []).map((m) => m.type));
    expect(marks).toEqual(["bold", "link"]);
  });
  it("gives an empty document for empty text and drops unsafe links", () => {
    expect(htmlToDoc("").type).toBe("doc");
    const doc = htmlToDoc('<p><a href="javascript:alert(1)">x</a></p>');
    expect(JSON.stringify(doc)).not.toContain("javascript");
  });
});

describe("news in the story feeds", () => {
  const story = { id: 1, slug: "s", published_at: "2026-11-01T00:00:00Z" };
  const news = toFeedItem({ slug: "n", title: "N", standfirst: "Lead", published_at: "2026-11-20T00:00:00Z", author: "Ada", reading_minutes: 2 });
  it("merges newest first and links each kind to its own page", () => {
    const merged = mergeNewest([story], [news]);
    expect(merged.map((x) => x.id)).toEqual(["news-n", 1]);
    expect(hrefOf(news)).toBe("/news/n");
    expect(hrefOf(story)).toBe("/stories/s");
    expect(news.excerpt).toBe("Lead");
  });
});
