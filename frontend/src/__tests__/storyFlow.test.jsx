import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/public", () => ({ getStories: vi.fn() }));
import { getStories } from "../api/public";
import StoryFlow from "../components/public/StoryFlow";

const story = (id) => ({ id, slug: `s-${id}`, title: `Story ${id}`, author: "Ann", published_at: "2026-01-05T10:00:00Z", cover: null });
const page = (n) => ({ items: Array.from({ length: n }, (_, i) => story(i + 1)), pagination: {} });

function show(props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><StoryFlow {...props} /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => getStories.mockReset());

describe("flowing stories box", () => {
  it("lists other stories, leaves out the ones already on the page, and links to them", async () => {
    getStories.mockResolvedValue(page(6));
    const { container } = show({ exclude: [1, 2] });
    await screen.findByRole("heading", { name: "More stories to explore" });
    const links = [...container.querySelectorAll(".flow-group:first-child a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/stories/s-3");
    expect(links).not.toContain("/stories/s-1");
    expect(links).not.toContain("/stories/s-2");
  });

  it("runs in two identical laps, and the second lap is hidden from screen readers and the tab key", async () => {
    getStories.mockResolvedValue(page(4));
    const { container } = show({});
    await screen.findByRole("heading", { name: "More stories to explore" });
    const [a, b] = container.querySelectorAll(".flow-group");
    expect(b.getAttribute("aria-hidden")).toBe("true");
    expect(a.children.length).toBe(b.children.length);
    expect(a.children.length).toBeGreaterThanOrEqual(10); // a short list is repeated to fill a wide screen
    expect(b.querySelector("a").getAttribute("tabindex")).toBe("-1");
  });

  it("can be paused and played", async () => {
    getStories.mockResolvedValue(page(5));
    const { container } = show({});
    const button = await screen.findByRole("button", { name: /Pause/ });
    fireEvent.click(button);
    expect(container.querySelector(".flow").className).toContain("is-paused");
    expect(screen.getByRole("button", { name: /Play/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is hidden when there are no stories", async () => {
    getStories.mockResolvedValue(page(0));
    const { container } = show({});
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(getStories).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
  });
});
