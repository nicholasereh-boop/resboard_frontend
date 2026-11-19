import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const created = [];
const fakeYT = {
  PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
  Player: class {
    constructor(el, opts) { this.el = el; this.opts = opts; this.time = 0; this.destroyed = false; created.push(this); }
    getCurrentTime() { return this.time; }
    getDuration() { return 600; }
    destroy() { this.destroyed = true; }
  },
};
vi.mock("../academy/player/youtubeApi", () => ({ loadYouTubeApi: () => Promise.resolve(fakeYT) }));
import { useLessonPlayer } from "../academy/player/useLessonPlayer";

function Harness(props) {
  const { host, status } = useLessonPlayer(props);
  return <div><div ref={host} data-testid="host" /><span>{status}</span></div>;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { vi.useFakeTimers(); created.length = 0; });
afterEach(() => vi.useRealTimers());

describe("lesson player hook", () => {
  it("creates a privacy-friendly player at the saved position", async () => {
    render(<Harness videoId="dQw4w9WgXcQ" startSeconds={42} onReport={() => {}} />);
    await flush();
    expect(created).toHaveLength(1);
    expect(created[0].opts).toMatchObject({ host: "https://www.youtube-nocookie.com", videoId: "dQw4w9WgXcQ" });
    expect(created[0].opts.playerVars).toMatchObject({ start: 42, rel: 0 });
  });

  it("adds up playing seconds and reports on the interval, on pause and when the page is left", async () => {
    const reports = [];
    const { unmount } = render(<Harness videoId="dQw4w9WgXcQ" baselineWatched={100} intervalSeconds={15} onReport={(r) => reports.push(r)} />);
    await flush();
    const p = created[0];
    act(() => { p.opts.events.onStateChange({ data: 1 }); });
    act(() => { p.time = 20; vi.advanceTimersByTime(15000); });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toEqual({ position_seconds: 20, watched_seconds: 115, duration_seconds: 600 }); // 100 earlier + 15 now
    act(() => { p.time = 25; vi.advanceTimersByTime(5000); p.opts.events.onStateChange({ data: 2 }); });
    expect(reports).toHaveLength(2);
    expect(reports[1].watched_seconds).toBe(120);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(reports).toHaveLength(2); // paused: nothing counts and nothing is sent
    act(() => { p.opts.events.onStateChange({ data: 1 }); vi.advanceTimersByTime(3000); });
    unmount();
    expect(reports).toHaveLength(3);
    expect(reports[2].watched_seconds).toBe(123);
    expect(p.destroyed).toBe(true);
  });

  it("does nothing when the video is not allowed yet (no id)", async () => {
    render(<Harness videoId={null} enabled={false} onReport={() => {}} />);
    await flush();
    expect(created).toHaveLength(0);
  });

  it("builds a new player when the lesson changes, and tidies the old one", async () => {
    const { rerender } = render(<Harness videoId="aaaaaaaaaaa" onReport={() => {}} />);
    await flush();
    rerender(<Harness videoId="bbbbbbbbbbb" onReport={() => {}} />);
    await flush();
    expect(created).toHaveLength(2);
    expect(created[0].destroyed).toBe(true);
  });
});
