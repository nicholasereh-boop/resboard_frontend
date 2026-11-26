import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../features/news/api/newsroom", () => ({
  createNewsArticle: vi.fn(), createNewsAsset: vi.fn(), deleteNewsAsset: vi.fn(), getNewsroomArticle: vi.fn(), listNewsCategoriesAdmin: vi.fn(),
  listNewsRevisions: vi.fn(), listSources: vi.fn(), newsArticleAction: vi.fn(), newsAssetAction: vi.fn(), updateNewsArticle: vi.fn(), updateNewsAsset: vi.fn(),
}));
vi.mock("../api", () => ({ listMedia: vi.fn() }));
import * as api from "../features/news/api/newsroom";
import ArticleEditorPage from "../features/news/pages/ArticleEditorPage";
import { STATUS_LABEL, STATUS_TABS } from "../features/news/utils/text";

const wrap = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={["/admin/news/articles/new"]}>
      <Routes><Route path="/admin/news/articles/new" element={<ArticleEditorPage />} /><Route path="/admin/news/articles/:id" element={<p>Opened article</p>} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  api.listSources.mockResolvedValue({ items: [] });
  api.listNewsCategoriesAdmin.mockResolvedValue([]);
});

describe("Writing news without an outside source", () => {
  it("does not require a source and sends none", async () => {
    api.createNewsArticle.mockResolvedValue({ id: 9, status: "draft" });
    wrap();
    expect((await screen.findByLabelText(/^Source/)).required).toBe(false);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Our own story" } });
    fireEvent.change(screen.getByLabelText(/Article text/), { target: { value: "<p>Hello</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.createNewsArticle).toHaveBeenCalled());
    expect(api.createNewsArticle.mock.calls[0][0].source).toBeUndefined();
  });

  it("Save and publish creates the article and then publishes it", async () => {
    api.createNewsArticle.mockResolvedValue({ id: 9, status: "draft" });
    api.newsArticleAction.mockResolvedValue({ id: 9, status: "published" });
    wrap();
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Our own story" } });
    fireEvent.change(screen.getByLabelText(/Article text/), { target: { value: "<p>Hello</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and publish" }));
    await waitFor(() => expect(api.newsArticleAction).toHaveBeenCalledWith(9, "publish"));
    expect(await screen.findByText("Opened article")).toBeTruthy();
  });

  it("knows the archived status", () => {
    expect(STATUS_LABEL.archived).toMatch(/Archived/);
    expect(STATUS_TABS.some((t) => t.value === "archived")).toBe(true);
  });
});
