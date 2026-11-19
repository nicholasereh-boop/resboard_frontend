import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { card, detail, offer, page, renderAt, resetBrowser } from "./extensionHarness";

vi.mock("../api/client", async (importOriginal) => ({ ...(await importOriginal()), ensureCsrf: vi.fn().mockResolvedValue({}) }));
vi.mock("../api", () => ({ me: vi.fn(() => Promise.reject(new Error("no session"))), login: vi.fn(), logout: vi.fn(), providers: vi.fn().mockResolvedValue({ google: false }) }));
vi.mock("../api/engagement", () => ({ getLikes: vi.fn(), likeStory: vi.fn(), unlikeStory: vi.fn(), listComments: vi.fn(), createComment: vi.fn(), editComment: vi.fn(), deleteComment: vi.fn(), reportComment: vi.fn() }));
vi.mock("../analytics/tracker", async (importOriginal) => ({ ...(await importOriginal()), sendPageView: vi.fn() }));
vi.mock("../api/public", () => ({ getStories: vi.fn(), getStory: vi.fn(), getRelatedStories: vi.fn(), getCategories: vi.fn(), getCategoryStories: vi.fn(), getTags: vi.fn(), searchStories: vi.fn() }));
vi.mock("../api/security", () => ({ getPublicConfig: vi.fn().mockResolvedValue({ site_name: "StoryBoard", consent_mode: "notice", analytics_enabled: false, contact_email: "" }), getPrivacyPolicy: vi.fn() }));
vi.mock("../api/marketplace", () => ({
  listProjects: vi.fn(), listTechnologies: vi.fn(), getProject: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(), deleteProject: vi.fn(),
  myProjects: vi.fn(), myProject: vi.fn(), submitProject: vi.fn(), unpublishProject: vi.fn(), archiveProject: vi.fn(),
  uploadScreenshots: vi.fn(), deleteScreenshot: vi.fn(), uploadPackage: vi.fn(), importFromGitHub: vi.fn(), removePackage: vi.fn(),
  getMarketplaceConfig: vi.fn(), startCheckout: vi.fn(), verifyPayment: vi.fn(), myPurchases: vi.fn(), downloadPackage: vi.fn(), adminProjects: vi.fn(), moderateProject: vi.fn(),
}));
import * as mp from "../api/marketplace";

const projects = [card({ id: 1, slug: "a", title: "Alpha Kit" }), card({ id: 2, slug: "b", title: "Beta Kit", has_video: true }), card({ id: 3, slug: "c", title: "Gamma Kit" })];

beforeEach(() => {
  resetBrowser();
  mp.listTechnologies.mockResolvedValue([{ name: "React", slug: "react" }, { name: "Django", slug: "django" }]);
  mp.getMarketplaceConfig.mockResolvedValue({ currency: "USD", backend_requires_payment: true, max_price: 10000, payments_enabled: true });
  mp.listProjects.mockResolvedValue(page(projects));
});

describe("marketplace page design", () => {
  it("is a black page, shows the first project big, and a flowing strip of technologies that filter the list", async () => {
    const { container } = renderAt("/marketplace");
    await screen.findByRole("heading", { name: "Alpha Kit" });
    expect(container.querySelector(".public-shell").className).toContain("page-market");
    expect(container.querySelectorAll(".mk-feature").length).toBe(1);
    expect(container.querySelector(".mk-feature").textContent).toContain("Alpha Kit");
    expect(container.querySelectorAll(".mk-card").length).toBe(3);
    expect(container.querySelector(".mk-badge").textContent).toContain("Video");
    const tech = container.querySelector(".mk-flow-group a");
    expect(tech.getAttribute("href")).toBe("/marketplace?tech=react");
    expect(container.querySelector(".mk-count").textContent).toContain("3 projects");
  });

  it("says which technology the list is filtered by, and can clear it", async () => {
    renderAt("/marketplace?tech=react");
    expect(await screen.findByText("react", { selector: "strong" })).toBeTruthy();
    mp.listProjects.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    await screen.findByRole("heading", { name: "Alpha Kit" });
    expect(mp.listProjects).toHaveBeenLastCalledWith({ q: undefined, tech: undefined, free: undefined, page: 1 });
  });
});

describe("project page design", () => {
  it("is black, with a get-the-code box and a row of other projects (not the project itself)", async () => {
    mp.getProject.mockResolvedValue(detail({ id: 1, slug: "a", title: "Alpha Kit", offers: [offer({ kind: "backend", price: "49.00", is_free: false })], viewer: { is_owner: false, packages: { backend: { can_download: false } } } }));
    const { container } = renderAt("/marketplace/projects/a");
    await screen.findByRole("heading", { name: "Get the code" });
    expect(container.querySelector(".public-shell").className).toContain("page-market");
    expect(screen.getByText(/Secure checkout with Paystack/)).toBeTruthy();
    const more = await screen.findByRole("heading", { name: "More source code" });
    const rail = more.closest("section");
    expect(rail.textContent).toContain("Beta Kit");
    expect(rail.textContent).not.toContain("Alpha Kit");
  });

  it("does not talk about payment on a free project", async () => {
    mp.getProject.mockResolvedValue(detail({ id: 1, slug: "a", title: "Alpha Kit" }));
    renderAt("/marketplace/projects/a");
    await screen.findByRole("heading", { name: "Get the code" });
    expect(screen.queryByText(/Paystack/)).toBeNull();
    expect(screen.getByText("Free to download as a zip.")).toBeTruthy();
  });

  it("the seller's edit page keeps its own look", async () => {
    mp.myProject.mockResolvedValue(detail({ id: 1 }));
    const { container } = renderAt("/marketplace/projects/1/edit");
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector(".public-shell")?.className ?? "").not.toContain("page-market");
  });
});
