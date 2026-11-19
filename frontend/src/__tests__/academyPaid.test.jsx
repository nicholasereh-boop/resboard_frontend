import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: 5, email: "a@b.c" }, ready: true, isStaff: false, logout: vi.fn() };
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth, AuthProvider: ({ children }) => children }));
vi.mock("../academy/api/academy", () => ({ ACADEMY_BASE: "/academy", getAcademyConfig: vi.fn() }));
vi.mock("../academy/api/learning", () => ({ getCourse: vi.fn(), enrollInCourse: vi.fn(), getLesson: vi.fn(), listLessonComments: vi.fn(), getMyLearning: vi.fn(), listCourses: vi.fn() }));
vi.mock("../academy/api/authoring", () => ({ adminListCourses: vi.fn() }));
vi.mock("../academy/api/paid", () => ({
  startCourseCheckout: vi.fn(), verifyCoursePayment: vi.fn(), getMyOrders: vi.fn(),
  adminListOrders: vi.fn(), adminRefundOrder: vi.fn(), adminCourseAccess: vi.fn(), adminGrantAccess: vi.fn(), adminRevokeAccess: vi.fn(),
}));
vi.mock("../academy/components/redirect", () => ({ redirectTo: vi.fn() }));
import { getAcademyConfig } from "../academy/api/academy";
import { adminListCourses } from "../academy/api/authoring";
import { getCourse } from "../academy/api/learning";
import * as paid from "../academy/api/paid";
import { redirectTo } from "../academy/components/redirect";
import { academyRoutes } from "../academy/routes";

const lesson = (id, o = {}) => ({ id, title: `Lesson ${id}`, position: id, duration_seconds: 600, is_intro: false, is_preview: false, state: "locked", can_view: false, reason: "purchase_required", requires_comment: false, ...o });
const course = (viewer = {}) => ({
  id: 2, slug: "pro-react", title: "Pro React", summary: "Deep dive", description: "", level: "advanced", category: "React", thumbnail: null, access_type: "paid", price: "49.00", currency: "USD",
  lesson_count: 2, duration_seconds: 1200, lessons: [lesson(1, { is_preview: true, can_view: true, reason: null, state: "available" }), lesson(2)],
  viewer: { authenticated: true, enrolled: false, entitled: false, completed: 0, total: 2, percent: 0, next_lesson_id: 1, ...viewer },
});
const order = (o = {}) => ({ id: 1, reference: "rbac_abc", status: "success", amount: "73500.00", currency: "NGN", list_price: "49.00", list_currency: "USD", created_at: "2026-10-30T10:00:00Z", verified_at: null, refunded_at: null,
  course: { id: 2, slug: "pro-react", title: "Pro React", access_type: "paid" }, has_access: true, learner_email: "a@b.c", ...o });
const err = (friendly, fieldErrors = {}) => Object.assign(new Error("x"), { friendly, fieldErrors });
const pageOf = (items) => ({ items, pagination: { page: 1, total_pages: 1, has_next: false } });

function renderAt(path) {
  const router = createMemoryRouter([...academyRoutes, { path: "*", element: <p>public</p> }, { path: "/login", element: <p>login page</p> }], { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 5, email: "a@b.c" }; auth.isStaff = false;
  getAcademyConfig.mockResolvedValue({ currency: "USD", payments_enabled: true, progress_update_interval_seconds: 15 });
  getCourse.mockResolvedValue(course());
  paid.getMyOrders.mockResolvedValue(pageOf([order()]));
});
afterEach(() => vi.useRealTimers());

describe("buying a course", () => {
  it("shows the price, starts the checkout and sends the browser to Paystack", async () => {
    paid.startCourseCheckout.mockResolvedValue({ authorization_url: "https://checkout.paystack.com/abc", reference: "rbac_abc" });
    renderAt("/academy/paid/courses/pro-react");
    fireEvent.click(await screen.findByRole("button", { name: "Buy for $49.00" }));
    await waitFor(() => expect(paid.startCourseCheckout).toHaveBeenCalledWith(2));
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("https://checkout.paystack.com/abc"));
    expect(screen.getByText(/equivalent amount in naira/)).toBeTruthy();
  });

  it("asks a visitor to log in first", async () => {
    auth.user = null;
    getCourse.mockResolvedValue(course({ authenticated: false }));
    renderAt("/academy/paid/courses/pro-react");
    expect(await screen.findByRole("link", { name: "Log in to buy" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Buy for/ })).toBeNull();
  });

  it("shows the server's message when the payment cannot start, and never redirects", async () => {
    paid.startCourseCheckout.mockRejectedValue(err("Payments are not available right now. Please try again shortly."));
    renderAt("/academy/paid/courses/pro-react");
    fireEvent.click(await screen.findByRole("button", { name: /Buy for/ }));
    expect(await screen.findByText(/Payments are not available right now/)).toBeTruthy();
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it("disables buying when payments are switched off", async () => {
    getAcademyConfig.mockResolvedValue({ currency: "USD", payments_enabled: false });
    renderAt("/academy/paid/courses/pro-react");
    await screen.findByText(/Payments are not available right now\./);
    expect(screen.getByRole("button", { name: /Buy for/ }).disabled).toBe(true);
  });

  it("an owner sees Continue learning instead of a buy button", async () => {
    getCourse.mockResolvedValue(course({ entitled: true, enrolled: true, completed: 1 }));
    renderAt("/academy/paid/courses/pro-react");
    expect(await screen.findByText(/You own this course/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue learning" }).getAttribute("href")).toBe("/academy/learn/1");
    expect(screen.queryByRole("button", { name: /Buy for/ })).toBeNull();
  });
});

describe("coming back from Paystack", () => {
  it("asks the server to verify the payment and then shows the confirmed order", async () => {
    paid.verifyCoursePayment.mockResolvedValue(order());
    renderAt("/academy/orders?reference=rbac_abc");
    expect(await screen.findByText(/Payment confirmed/)).toBeTruthy();
    expect(paid.verifyCoursePayment).toHaveBeenCalledTimes(1);
    expect(paid.verifyCoursePayment).toHaveBeenCalledWith("rbac_abc");
    expect(screen.getByRole("link", { name: "Start learning" }).getAttribute("href")).toBe("/academy/paid/courses/pro-react");
  });

  it("says plainly when the payment failed and the order was not charged", async () => {
    paid.verifyCoursePayment.mockResolvedValue(order({ status: "failed", has_access: false }));
    renderAt("/academy/orders?reference=rbac_abc");
    expect(await screen.findByText(/did not go through/)).toBeTruthy();
    expect(screen.queryByText(/Payment confirmed/)).toBeNull();
  });

  it("keeps checking while the payment is still pending, then confirms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    paid.verifyCoursePayment.mockResolvedValueOnce(order({ status: "pending", has_access: false })).mockResolvedValue(order());
    renderAt("/academy/orders?reference=rbac_abc");
    expect(await screen.findByText(/still being confirmed/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(4100); });
    expect(await screen.findByText(/Payment confirmed/)).toBeTruthy();
    expect(paid.verifyCoursePayment).toHaveBeenCalledTimes(2);
  });

  it("lets the learner try again when the check itself fails", async () => {
    paid.verifyCoursePayment.mockRejectedValueOnce(err("down")).mockResolvedValue(order());
    renderAt("/academy/orders?reference=rbac_abc");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Payment confirmed/)).toBeTruthy();
  });

  it("lists past orders with the price and what was charged", async () => {
    renderAt("/academy/orders");
    const row = (await screen.findByRole("link", { name: "Pro React" })).closest("tr");
    expect(within(row).getByText("$49.00")).toBeTruthy();
    expect(within(row).getByText(/₦/)).toBeTruthy();
    expect(within(row).getByText("Paid")).toBeTruthy();
  });
});

describe("staff orders and access", () => {
  beforeEach(() => {
    auth.user = { id: 1, is_staff: true }; auth.isStaff = true;
    adminListCourses.mockResolvedValue(pageOf([{ id: 2, title: "Pro React" }]));
    paid.adminListOrders.mockResolvedValue(pageOf([order()]));
    paid.adminCourseAccess.mockResolvedValue([]);
  });

  it("grants complimentary access by email and shows the server's message for a bad email", async () => {
    paid.adminGrantAccess.mockRejectedValueOnce(err("x", { email: ["No active account has that email address."] }));
    renderAt("/academy/admin/orders");
    await screen.findByRole("option", { name: "Pro React" });
    fireEvent.change(screen.getByLabelText("Paid course"), { target: { value: "2" } });
    fireEvent.change(await screen.findByLabelText("Learner's email"), { target: { value: "nobody@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Grant access" }));
    expect(await screen.findByText(/No active account/)).toBeTruthy();
    paid.adminGrantAccess.mockResolvedValueOnce({ id: 1 });
    fireEvent.change(screen.getByLabelText("Learner's email"), { target: { value: "ann@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Grant access" }));
    await waitFor(() => expect(paid.adminGrantAccess).toHaveBeenLastCalledWith("2", { email: "ann@x.com", note: "" }));
  });

  it("lists who has access and can remove it after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    paid.adminCourseAccess.mockResolvedValue([{ id: 1, learner_email: "ann@x.com", source: "grant", status: "active", expires_at: null, note: "Prize" }]);
    paid.adminRevokeAccess.mockResolvedValue({ revoked: 1 });
    renderAt("/academy/admin/orders");
    await screen.findByRole("option", { name: "Pro React" });
    fireEvent.change(screen.getByLabelText("Paid course"), { target: { value: "2" } });
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(paid.adminRevokeAccess).toHaveBeenCalledWith("2", "ann@x.com"));
  });

  it("refunds a paid order only after confirming", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    paid.adminRefundOrder.mockResolvedValue(order({ status: "refunded" }));
    renderAt("/academy/admin/orders");
    const button = await screen.findByRole("button", { name: "Refund" });
    fireEvent.click(button);
    expect(paid.adminRefundOrder).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(paid.adminRefundOrder).toHaveBeenCalled());
    expect(paid.adminRefundOrder.mock.calls[0][0]).toBe(1);
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("keeps the staff pages away from learners", async () => {
    auth.user = { id: 2, is_staff: false }; auth.isStaff = false;
    renderAt("/academy/admin/orders");
    expect(await screen.findByText("public")).toBeTruthy();
    expect(paid.adminListOrders).not.toHaveBeenCalled();
  });
});
