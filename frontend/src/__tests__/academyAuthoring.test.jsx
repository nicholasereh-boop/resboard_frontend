import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: 1, is_staff: true, mfa: null }, ready: true, isStaff: true, logout: vi.fn() };
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth, AuthProvider: ({ children }) => children }));
vi.mock("../academy/api/academy", () => ({ ACADEMY_BASE: "/academy", getAcademyConfig: vi.fn().mockResolvedValue({ currency: "USD" }) }));
vi.mock("../academy/api/authoring", () => ({
  adminListCourses: vi.fn(), adminGetCourse: vi.fn(), adminCreateCourse: vi.fn(), adminUpdateCourse: vi.fn(), adminDeleteCourse: vi.fn(),
  adminCourseAction: vi.fn(), adminListLessons: vi.fn(), adminCreateLesson: vi.fn(), adminUpdateLesson: vi.fn(), adminDeleteLesson: vi.fn(), adminReorderLessons: vi.fn(),
}));
import * as api from "../academy/api/authoring";
import { academyRoutes } from "../academy/routes";

const course = (o = {}) => ({ id: 7, slug: "html-basics", title: "HTML Basics", summary: "Start", description: "About", level: "beginner", category: "HTML", thumbnail: null, status: "draft", access_type: "free", price: "0.00", currency: "USD", video_rights_confirmed: false, lesson_count: 2, published_lesson_count: 1, learner_count: 3, locked_type: false, ...o });
const lesson = (id, title, o = {}) => ({ id, course_id: 7, title, description: "", position: id, youtube_id: "dQw4w9WgXcQ", duration_seconds: 600, is_intro: false, is_preview: false, requires_comment_to_unlock_next: true, completion_threshold: 90, is_published: true, ...o });
const err = (fieldErrors, friendly = "Please fix the form.") => Object.assign(new Error("x"), { fieldErrors, friendly });

function renderAt(path) {
  const router = createMemoryRouter([...academyRoutes, { path: "*", element: <p>public home</p> }], { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 1, is_staff: true, mfa: null };
  api.adminListCourses.mockResolvedValue({ items: [course(), course({ id: 8, title: "Pro React", access_type: "paid", price: "49.00", status: "published", slug: "pro-react" })], pagination: { page: 1, total_pages: 1, has_next: false } });
  api.adminGetCourse.mockResolvedValue(course());
  api.adminListLessons.mockResolvedValue([lesson(1, "Intro tags"), lesson(2, "Attributes")]);
  api.adminReorderLessons.mockResolvedValue([]);
});

describe("Academy staff pages", () => {
  it("lists the courses with status, price and lesson counts for staff", async () => {
    renderAt("/academy/admin");
    expect(await screen.findByRole("heading", { name: "HTML Basics" })).toBeTruthy();
    expect(screen.getAllByText("1 of 2 lessons published · 3 learners").length).toBe(2);
    expect(screen.getByText("$49.00")).toBeTruthy();
    expect(screen.getByRole("link", { name: "New course" }).getAttribute("href")).toBe("/academy/admin/courses/new");
  });

  it("sends a reader away (the server refuses them anyway)", async () => {
    auth.user = { id: 2, is_staff: false };
    renderAt("/academy/admin");
    expect(await screen.findByText("public home")).toBeTruthy();
    expect(api.adminListCourses).not.toHaveBeenCalled();
  });

  it("creates a course, then moves on to its editor", async () => {
    api.adminCreateCourse.mockResolvedValue(course({ id: 9, title: "New one" }));
    api.adminGetCourse.mockResolvedValue(course({ id: 9, title: "New one" }));
    renderAt("/academy/admin/courses/new");
    fireEvent.change(await screen.findByLabelText("Course title"), { target: { value: "New one" } });
    fireEvent.click(screen.getByLabelText(/I confirm I have the right/));
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    await waitFor(() => expect(api.adminCreateCourse).toHaveBeenCalled());
    expect(api.adminCreateCourse.mock.calls[0][0]).toMatchObject({ title: "New one", access_type: "free", price: "0", video_rights_confirmed: true });
    expect(await screen.findByRole("heading", { name: "New one" })).toBeTruthy();
  });

  it("a paid course shows a price field, and a server error is shown under it", async () => {
    api.adminCreateCourse.mockRejectedValue(err({ price: ["A paid course needs a price above 0."] }));
    renderAt("/academy/admin/courses/new");
    fireEvent.change(await screen.findByLabelText("Type"), { target: { value: "paid" } });
    expect(screen.getByLabelText(/Price \(USD\)/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Course title"), { target: { value: "Pro" } });
    fireEvent.change(screen.getByLabelText(/Price \(USD\)/), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    expect(await screen.findByText("A paid course needs a price above 0.")).toBeTruthy();
  });

  it("locks the free/paid type once the course has learners", async () => {
    api.adminGetCourse.mockResolvedValue(course({ locked_type: true }));
    renderAt("/academy/admin/courses/7");
    const type = await screen.findByLabelText("Type");
    expect(type.disabled).toBe(true);
    expect(screen.getByText(/already has learners or orders/)).toBeTruthy();
  });

  it("lists why a course cannot be published yet", async () => {
    api.adminCourseAction.mockRejectedValue(err({ publish: ["Publish at least one lesson.", "Confirm that you have the right to use the videos in this course."] }));
    renderAt("/academy/admin/courses/7");
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    const box = await screen.findByRole("alert");
    expect(within(box).getByText("Publish at least one lesson.")).toBeTruthy();
    expect(api.adminCourseAction).toHaveBeenCalledWith("7", "publish");
  });

  it("shows the lessons and reorders them with the keyboard-friendly buttons", async () => {
    renderAt("/academy/admin/courses/7");
    expect(await screen.findByText("Intro tags")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move Intro tags down" }));
    await waitFor(() => expect(api.adminReorderLessons).toHaveBeenCalledWith("7", [2, 1]));
    expect(screen.getByRole("button", { name: "Move Intro tags up" }).disabled).toBe(true);
  });

  it("adds a lesson with a YouTube link, and shows the server's message for a bad link", async () => {
    api.adminCreateLesson.mockRejectedValueOnce(err({ youtube_url: ["Enter a YouTube link (https://www.youtube.com/watch?v=... or https://youtu.be/...)."] }));
    renderAt("/academy/admin/courses/7");
    fireEvent.click(await screen.findByRole("button", { name: "Add lesson" }));
    fireEvent.change(screen.getByLabelText("Lesson title"), { target: { value: "Links" } });
    fireEvent.change(screen.getByLabelText("YouTube link"), { target: { value: "https://evil.example/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));
    expect(await screen.findByText(/Enter a YouTube link/)).toBeTruthy();
    api.adminCreateLesson.mockResolvedValueOnce(lesson(3, "Links"));
    fireEvent.change(screen.getByLabelText("YouTube link"), { target: { value: "https://youtu.be/dQw4w9WgXcQ" } });
    fireEvent.click(screen.getByRole("button", { name: "Save lesson" }));
    await waitFor(() => expect(api.adminCreateLesson).toHaveBeenCalledTimes(2));
    expect(api.adminCreateLesson.mock.calls[1]).toEqual(["7", expect.objectContaining({ title: "Links", youtube_url: "https://youtu.be/dQw4w9WgXcQ", completion_threshold: 90 })]);
  });

  it("the introduction lesson can never require a comment", async () => {
    api.adminListLessons.mockResolvedValue([lesson(1, "Welcome", { is_intro: true, requires_comment_to_unlock_next: false })]);
    renderAt("/academy/admin/courses/7");
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/A comment is needed to unlock the next lesson/).disabled).toBe(true);
  });
});
