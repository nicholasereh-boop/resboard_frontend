import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectGallery from "../components/marketplace/ProjectGallery";

const shots = [1, 2, 3].map((n) => ({ id: n, url: `/media/s${n}.png`, width: 800, height: 500, alt_text: `shot ${n}` }));
// jsdom has no PointerEvent, so build the pointer events by hand (pointerover/pointerout are what React turns into enter/leave).
const point = (el, type, pointerType) => {
  const ev = new Event(type, { bubbles: true });
  ev.pointerType = pointerType;
  act(() => { el.dispatchEvent(ev); });
};
const current = () => document.querySelector(".mp-slide.is-active img").getAttribute("alt");

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("screenshot slideshow", () => {
  it("moves to the next screenshot by itself every 3 seconds and wraps around", () => {
    render(<ProjectGallery screenshots={shots} title="T" />);
    expect(current()).toBe("shot 1");
    act(() => { vi.advanceTimersByTime(2900); });
    expect(current()).toBe("shot 1");
    act(() => { vi.advanceTimersByTime(100); });
    expect(current()).toBe("shot 2");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(current()).toBe("shot 3");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(current()).toBe("shot 1");
  });

  it("can be paused and resumed, and clicking a thumbnail restarts the 3 seconds", () => {
    render(<ProjectGallery screenshots={shots} title="T" />);
    fireEvent.click(screen.getByLabelText("Pause slideshow"));
    act(() => { vi.advanceTimersByTime(10000); });
    expect(current()).toBe("shot 1");
    fireEvent.click(screen.getByLabelText("Play slideshow"));
    fireEvent.click(screen.getByLabelText("Show screenshot 3 of 3"));
    expect(current()).toBe("shot 3");
    act(() => { vi.advanceTimersByTime(2900); });
    expect(current()).toBe("shot 3");
    act(() => { vi.advanceTimersByTime(100); });
    expect(current()).toBe("shot 1");
  });

  it("waits while a mouse is over it, but a touch does not stop it", () => {
    const { container } = render(<ProjectGallery screenshots={shots} title="T" />);
    const box = container.querySelector(".mp-gallery");
    point(box, "pointerover", "mouse");
    act(() => { vi.advanceTimersByTime(9000); });
    expect(current()).toBe("shot 1");
    point(box, "pointerout", "mouse");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(current()).toBe("shot 2");
    point(box, "pointerover", "touch");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(current()).toBe("shot 3");
  });

  it("has arrows, arrow keys and swipe, and a single screenshot needs no controls", () => {
    const { container, rerender } = render(<ProjectGallery screenshots={shots} title="T" />);
    fireEvent.click(screen.getByLabelText("Next screenshot"));
    expect(current()).toBe("shot 2");
    fireEvent.click(screen.getByLabelText("Previous screenshot"));
    fireEvent.keyDown(container.querySelector(".mp-gallery"), { key: "ArrowLeft" });
    expect(current()).toBe("shot 3");
    const box = container.querySelector(".mp-gallery");
    fireEvent.touchStart(box, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(box, { changedTouches: [{ clientX: 100 }] });
    expect(current()).toBe("shot 1");
    rerender(<ProjectGallery screenshots={shots.slice(0, 1)} title="T" />);
    expect(screen.queryByLabelText("Next screenshot")).toBeNull();
    act(() => { vi.advanceTimersByTime(9000); });
    expect(current()).toBe("shot 1");
  });

  it("renders nothing without usable images", () => {
    const { container } = render(<ProjectGallery screenshots={[{ id: 1, url: "javascript:alert(1)" }]} title="T" />);
    expect(container.firstChild).toBeNull();
  });
});
