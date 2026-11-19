import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const auth = { user: null, ready: true, isStaff: false, logout: vi.fn() };
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth, AuthProvider: ({ children }) => children }));

import { academyRoutes } from "../academy/routes";
import { FEATURES, EXTENSION_NAV_LINKS } from "../features";

function renderAt(path) {
  const router = createMemoryRouter([...academyRoutes, { path: "*", element: <p>public 404</p> }], { initialEntries: [path] });
  return render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
}

describe("Academy foundation", () => {
  it("is switched on by default and appears in the public navigation", () => {
    expect(FEATURES.academy).toBe(true);
    expect(EXTENSION_NAV_LINKS.some((l) => l.to === "/academy" && l.label === "Academy")).toBe(true);
  });

  it("has its own layout, navigation and landing page, separate from the main site", async () => {
    const { container } = renderAt("/academy");
    expect(await screen.findByRole("heading", { level: 1, name: /Learn to build websites/ })).toBeTruthy();
    expect(container.querySelector(".ac-shell")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Academy" });
    ["Home", "Free tutorials", "Paid tutorials", "My learning"].forEach((name) => expect(nav.textContent).toContain(name));
    expect(nav.textContent).not.toContain("Manage"); // staff-only link
    expect(screen.getByRole("link", { name: /Start free/ }).getAttribute("href")).toBe("/academy/free");
  });

  it("explains the free-course rule: watch, comment, unlock, with the intro exempt", async () => {
    renderAt("/academy");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText(/The course introduction is always open/)).toBeTruthy();
  });

  it("shows the Manage link to staff only", async () => {
    auth.isStaff = true;
    renderAt("/academy");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("link", { name: "Manage" }).getAttribute("href")).toBe("/academy/admin");
    auth.isStaff = false;
  });

  it("an unknown Academy address shows the Academy's not-found page inside its layout", async () => {
    const { container } = renderAt("/academy/nope/at/all");
    expect(await screen.findByText("That Academy page does not exist.")).toBeTruthy();
    expect(container.querySelector(".ac-shell")).toBeTruthy();
  });
});
