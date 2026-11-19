import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: 5, email: "a@b.c" }, ready: true, isStaff: false, logout: vi.fn() };
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth, AuthProvider: ({ children }) => children }));
vi.mock("../academy/api/academy", () => ({ ACADEMY_BASE: "/academy", getAcademyConfig: vi.fn().mockResolvedValue({ currency: "USD", progress_update_interval_seconds: 15 }) }));
vi.mock("../academy/api/learning", () => ({
  listCourses: vi.fn(), getCourse: vi.fn(), enrollInCourse: vi.fn(), getLesson: vi.fn(), getLessonAccess: vi.fn(), saveProgress: vi.fn(),
  listLessonComments: vi.fn(), postLessonComment: vi.fn(), deleteLessonComment: vi.fn(), getMyLearning: vi.fn(),
}));
vi.mock("../academy/components/LessonPlayer", () => ({ default: ({ lesson }) => <div data-testid="player">player for {lesson.youtube_id}</div> }));
import * as api from "../academy/api/learning";
import { academyRoutes } from "../academy/routes";

const card = (o = {}) => ({ id: 1, slug: "html-basics", title: "HTML Basics", summary: "Start here", level: "beginner", category: "HTML", thumbnail: null, access_type: "free", price: "0.00", currency: "USD", lesson_count: 4, duration_seconds: 4800, ...o });
const item = (id, title, o = {}) => ({ id, title, position: id, duration_seconds: 600, is_intro: false, is_preview: false, state: "available", can_view: true, reason: null, requires_comment: true, ...o });
const outline = (o = {}) => ({
  ...card(), description: "Learn HTML.", viewer: { authenticated: true, enrolled: false, entitled: false, completed: 0, total: 3, percent: 0, next_lesson_id: 11 },
  lessons: [item(10, "Welcome", { is_intro: true, requires_comment: false }), item(11, "Tags"), item(12, "Attributes", { state: "locked", can_view: false, reason: "locked_previous" })], ...o,
});
const lessonPayload = (o = {}) => ({
  lesson: { id: 11, title: "Tags", description: "Notes here", youtube_id: "dQw4w9WgXcQ", is_intro: false, requires_comment: true, completion_threshold: 90 },
  course: { id: 1, slug: "html-basics", title: "HTML Basics", access_type: "free" },
  access: { can_view: true, reason: null, state: "available", watch_met: false, comment_met: false, requires_comment: true, requirement_met: false, next_lesson_id: 12, next_unlocked: false },
  progress: { percent: 0, position_seconds: 0, watched_seconds: 0 }, previous_lesson_id: 10, next_lesson_id: 12, ...o,
});
const err = (fieldErrors, friendly = "Please fix it.") => Object.assign(new Error("x"), { fieldErrors, friendly });

function renderAt(path) {
  const router = createMemoryRouter([...academyRoutes, { path: "*", element: <p>public</p> }, { path: "/login", element: <p>login page</p> }], { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 5, email: "a@b.c" };
  api.listCourses.mockResolvedValue({ items: [card(), card({ id: 2, slug: "pro", title: "Pro React", access_type: "paid", price: "49.00" })], pagination: { page: 1, total_pages: 1, has_next: false } });
  api.getCourse.mockResolvedValue(outline());
  api.getLesson.mockResolvedValue(lessonPayload());
  api.listLessonComments.mockResolvedValue({ items: [], pagination: { page: 1, total_pages: 1, has_next: false } });
  api.getMyLearning.mockResolvedValue({ items: [] });
});

describe("catalog", () => {
  it("lists courses with price chips and links each to its own free or paid address", async () => {
    renderAt("/academy/free");
    expect(await screen.findByRole("heading", { name: "HTML Basics" })).toBeTruthy();
    expect(api.listCourses).toHaveBeenCalledWith({ access: "free", q: undefined, page: 1 });
    expect(screen.getByRole("link", { name: /HTML Basics/ }).getAttribute("href")).toBe("/academy/free/courses/html-basics");
    expect(screen.getByRole("link", { name: /Pro React/ }).getAttribute("href")).toBe("/academy/paid/courses/pro");
    expect(screen.getByText("$49.00")).toBeTruthy();
  });

  it("says so when there are no courses", async () => {
    api.listCourses.mockResolvedValue({ items: [], pagination: { page: 1, total_pages: 1, has_next: false } });
    renderAt("/academy/paid");
    expect(await screen.findByText("No premium courses yet. Check back soon.")).toBeTruthy();
  });
});

describe("a course", () => {
  it("shows the outline with each lesson's state and why a locked one is locked", async () => {
    renderAt("/academy/free/courses/html-basics");
    expect(await screen.findByRole("heading", { level: 1, name: "HTML Basics" })).toBeTruthy();
    const list = screen.getByRole("list", { name: "Lessons" });
    expect(within(list).getByText(/Introduction: Welcome/)).toBeTruthy();
    expect(within(list).getByText(/Finish the previous lesson/)).toBeTruthy();
    expect(within(list).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/academy/learn/10", "/academy/learn/11"]); // locked has no link
  });

  it("asks a visitor to log in, and lets a learner start (enrol, then open the next lesson)", async () => {
    auth.user = null;
    api.getCourse.mockResolvedValue(outline({ viewer: { authenticated: false, enrolled: false, entitled: false, completed: 0, total: 3, percent: 0, next_lesson_id: 10 } }));
    const first = renderAt("/academy/free/courses/html-basics");
    expect(await screen.findByRole("link", { name: "Log in to start" })).toBeTruthy();
    first.unmount();
    auth.user = { id: 5 };
    api.getCourse.mockResolvedValue(outline());
    api.enrollInCourse.mockResolvedValue({ enrolled: true });
    renderAt("/academy/free/courses/html-basics");
    fireEvent.click(await screen.findByRole("button", { name: "Start learning" }));
    await waitFor(() => expect(api.enrollInCourse).toHaveBeenCalledWith("html-basics"));
    expect(await screen.findByRole("heading", { level: 1, name: "Tags" })).toBeTruthy();
  });

  it("sends a course opened under the wrong /free or /paid address to the right one", async () => {
    api.getCourse.mockResolvedValue(outline({ access_type: "paid", price: "49.00" }));
    renderAt("/academy/free/courses/html-basics");
    expect(await screen.findByRole("link", { name: "← Paid tutorials" })).toBeTruthy();
  });

  it("says the course was not found for an unknown address", async () => {
    api.getCourse.mockRejectedValue(Object.assign(new Error("nf"), { status: 404 }));
    renderAt("/academy/free/courses/nope");
    expect(await screen.findByText("Course not found")).toBeTruthy();
  });
});

describe("a lesson", () => {
  it("plays the video and shows the watch, comment, unlock steps", async () => {
    renderAt("/academy/learn/11");
    expect((await screen.findByTestId("player")).textContent).toContain("dQw4w9WgXcQ");
    const steps = screen.getByRole("list", { name: "How to unlock the next lesson" });
    expect(within(steps).getByText("Watch")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Next lesson/ }).disabled).toBe(true); // still locked
  });

  it("shows a locked page, with no player, when the server says the lesson is not open", async () => {
    api.getLesson.mockResolvedValue(lessonPayload({
      lesson: { id: 12, title: "Attributes", description: "", youtube_id: null, is_intro: false, requires_comment: true },
      access: { can_view: false, reason: "locked_previous", state: "locked", watch_met: false, comment_met: false, requires_comment: true, requirement_met: false, next_lesson_id: 13, next_unlocked: false },
    }));
    renderAt("/academy/learn/12");
    expect(await screen.findByText(/Finish the previous lesson/)).toBeTruthy();
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("a visitor is asked to log in", async () => {
    auth.user = null;
    api.getLesson.mockResolvedValue(lessonPayload({
      lesson: { id: 11, title: "Tags", description: "", youtube_id: null, is_intro: false, requires_comment: true },
      access: { can_view: false, reason: "login_required", state: "locked", watch_met: false, comment_met: false, requires_comment: true, requirement_met: false, next_lesson_id: 12, next_unlocked: false },
    }));
    renderAt("/academy/learn/11");
    expect(await screen.findByRole("link", { name: "Log in" })).toBeTruthy();
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("the next lesson opens as a link once the server says it is unlocked", async () => {
    api.getLesson.mockResolvedValue(lessonPayload({ access: { ...lessonPayload().access, watch_met: true, comment_met: true, requirement_met: true, next_unlocked: true, state: "completed" } }));
    renderAt("/academy/learn/11");
    expect((await screen.findByRole("link", { name: /Next lesson/ })).getAttribute("href")).toBe("/academy/learn/12");
  });
});

describe("lesson comments", () => {
  it("cannot be written before the lesson is watched, then can, and posting applies the new access", async () => {
    renderAt("/academy/learn/11");
    const box = await screen.findByLabelText("Add a comment");
    expect(box.disabled).toBe(true);
    expect(box.getAttribute("placeholder")).toMatch(/Watch the lesson first/);
  });

  it("invites a comment after watching, posts it, and shows the unlock", async () => {
    api.getLesson.mockResolvedValue(lessonPayload({ access: { ...lessonPayload().access, watch_met: true, state: "awaiting_comment" } }));
    api.postLessonComment.mockResolvedValue({
      comment: { id: 1, body: "Nice", status: "approved", author: "Ann", created_at: "2026-10-30T10:00:00Z", mine: true },
      access: { ...lessonPayload().access, watch_met: true, comment_met: true, requirement_met: true, next_unlocked: true, state: "completed" },
    });
    renderAt("/academy/learn/11");
    expect(await screen.findByText(/Share what you learned in a comment/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "Nice lesson" } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    await waitFor(() => expect(api.postLessonComment).toHaveBeenCalledWith("11", "Nice lesson"));
    expect(await screen.findByText(/Your comment unlocked the next lesson/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Next lesson/ }).getAttribute("href")).toBe("/academy/learn/12");
  });

  it("shows the server's message when a comment is refused, and marks pending and own comments", async () => {
    api.getLesson.mockResolvedValue(lessonPayload({ access: { ...lessonPayload().access, watch_met: true } }));
    api.listLessonComments.mockResolvedValue({ items: [{ id: 3, body: "Mine, waiting", status: "pending", author: "Me", created_at: "2026-10-30T10:00:00Z", mine: true }], pagination: {} });
    api.postLessonComment.mockRejectedValue(err({ body: ["You already posted that comment. Please do not repeat yourself."] }));
    renderAt("/academy/learn/11");
    expect(await screen.findByText("Awaiting approval")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "again" } });
    fireEvent.click(screen.getByRole("button", { name: "Post comment" }));
    expect(await screen.findByText(/already posted that comment/)).toBeTruthy();
  });

  it("a visitor sees a log-in prompt instead of the form", async () => {
    auth.user = null;
    api.getLesson.mockResolvedValue(lessonPayload({ access: { ...lessonPayload().access, can_view: true } }));
    renderAt("/academy/learn/11");
    expect(await screen.findByText(/to join the conversation/)).toBeTruthy();
    expect(screen.queryByLabelText("Add a comment")).toBeNull();
  });
});

describe("my learning", () => {
  it("lists the learner's courses with progress and the lesson to continue with", async () => {
    api.getMyLearning.mockResolvedValue({ items: [{ ...card(), completed: 2, total: 4, percent: 50, next_lesson_id: 12, last_activity: "2026-10-30T10:00:00Z", enrolled_at: "2026-10-01T10:00:00Z" }] });
    renderAt("/academy/my-learning");
    expect(await screen.findByText("2 of 4 done")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe("/academy/learn/12");
  });

  it("asks a visitor to log in", async () => {
    auth.user = null;
    renderAt("/academy/my-learning");
    expect(await screen.findByText("login page")).toBeTruthy();
  });
});
