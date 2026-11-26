import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ArticleEditorPage from "./ArticleEditorPage";
import NewsEditPage from "./NewsEditPage";
import { getNewsroomArticle } from "../api/newsroom";

// /admin/news/articles/new and /:id. Articles we write ourselves open in the story-style editor; imported or licensed ones keep the
// full rights screen (source, credit, licence, assets), because those details matter for them.
export default function NewsEditRoute() {
  const { id } = useParams();
  const article = useQuery({ queryKey: ["newsroom", "article", id], queryFn: () => getNewsroomArticle(id), enabled: Boolean(id), gcTime: 0, staleTime: 0 });
  if (!id) return <NewsEditPage />;
  if (article.isLoading) return <p className="muted">Loading…</p>;
  if (article.isError) return <p className="nw-error" role="alert">Could not load this article.</p>;
  const a = article.data;
  if (a.article_type !== "original") return <ArticleEditorPage />;
  return <NewsEditPage article={a} />;
}
