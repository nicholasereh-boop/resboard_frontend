import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StoryExtras from "../components/story/StoryExtras";

afterEach(() => vi.restoreAllMocks());

describe("story page extras", () => {
  it("fills the reading bar as the page is scrolled, and shows Back to top only after scrolling down", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { cb(0); return 1; });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 3000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
    const { container } = render(<StoryExtras />);
    const top = screen.getByRole("button", { name: "Back to the top" });
    expect(top.className).not.toContain("is-visible");

    Object.defineProperty(window, "scrollY", { configurable: true, value: 1000 });
    act(() => { fireEvent.scroll(window); });
    expect(container.querySelector(".sp-progress").style.getPropertyValue("--p")).toBe("0.5");
    expect(top.className).toContain("is-visible");

    fireEvent.click(top);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
