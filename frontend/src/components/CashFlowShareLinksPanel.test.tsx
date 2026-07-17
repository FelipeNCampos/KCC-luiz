import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CashFlowShareLinksPanel } from "./CashFlowShareLinksPanel";
import { cashFlowService } from "../services/cashflow";

vi.mock("../services/cashflow", () => ({
  cashFlowService: {
    listShareLinks: vi.fn(),
    createShareLink: vi.fn(),
    revokeShareLink: vi.fn()
  }
}));

describe("CashFlowShareLinksPanel", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashFlowService.listShareLinks).mockResolvedValue([]);
    vi.mocked(cashFlowService.createShareLink).mockResolvedValue({
      id: "link-1",
      scope: "main",
      date_from: "2026-04-01",
      date_to: "2026-04-02",
      expires_at: "2026-05-01T10:00:00Z",
      created_at: "2026-04-01T10:00:00Z",
      revoked_at: null,
      status: "active",
      token: "public-token",
      share_url: "https://app.example/cash-flow/share/public-token"
    });
  });

  it("creates a link with an exact date range without showing a second URL card", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CashFlowShareLinksPanel scope="main" defaultDate="2026-04-01" />);

    fireEvent.click(screen.getByRole("button", { name: /share link/i }));
    await screen.findByText("Manage links");
    const dates = screen.getAllByDisplayValue("2026-04-01");
    fireEvent.change(dates[1], { target: { value: "2026-04-02" } });
    fireEvent.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() => expect(cashFlowService.createShareLink).toHaveBeenCalled());
    expect(cashFlowService.createShareLink).toHaveBeenCalledWith(expect.objectContaining({
      scope: "main",
      date_from: "2026-04-01",
      date_to: "2026-04-02"
    }));
    expect(screen.queryByText("https://app.example/cash-flow/share/public-token")).toBeNull();
    expect(cashFlowService.listShareLinks).toHaveBeenCalledTimes(2);
  });

  it("opens revoke options from a clickable active link card and copies from its link column", async () => {
    const link = {
      id: "link-active",
      scope: "main" as const,
      date_from: "2026-04-01",
      date_to: "2026-04-02",
      expires_at: "2026-05-01T10:00:00Z",
      created_at: "2026-04-01T10:00:00Z",
      revoked_at: null,
      status: "active" as const,
      token: "public-token",
      share_url: "https://app.example/cash-flow/share/public-token"
    };
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: copy } });
    vi.mocked(cashFlowService.listShareLinks).mockResolvedValue([
      link,
      { ...link, id: "link-expired", status: "expired", token: "expired-token" }
    ]);
    render(<CashFlowShareLinksPanel scope="main" defaultDate="2026-04-01" />);

    fireEvent.click(screen.getByRole("button", { name: /share link/i }));
    const card = await screen.findByTestId("share-link-card-link-active");
    expect(card.className).toContain("bg-emerald-50");
    expect(screen.getByTestId("share-link-card-link-expired").className).toContain("bg-red-50");
    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.queryByText("Actions")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: /link options for 2026-04-01 to 2026-04-02/i }));
    const menu = screen.getByRole("menu");
    expect(menu.className).toContain("absolute");
    expect(menu.className).toContain("right-0");
    expect(menu.className).toContain("bg-black");
    expect(screen.getByRole("menuitem", { name: /revoke/i }).className).toContain("text-red-400");

    fireEvent.click(within(card).getByRole("button", { name: /copy link for 2026-04-01 to 2026-04-02/i }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(link.share_url));
  });

  it("shows a revoked link in red and lets the manager hide it", async () => {
    const link = {
      id: "link-to-revoke",
      scope: "main" as const,
      date_from: "2026-04-01",
      date_to: "2026-04-02",
      expires_at: "2026-05-01T10:00:00Z",
      created_at: "2026-04-01T10:00:00Z",
      revoked_at: null,
      status: "active" as const,
      token: "public-token",
      share_url: "https://app.example/cash-flow/share/public-token"
    };
    vi.mocked(cashFlowService.listShareLinks)
      .mockResolvedValueOnce([link])
      .mockResolvedValueOnce([{ ...link, revoked_at: "2026-04-03T10:00:00Z", status: "revoked" }]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CashFlowShareLinksPanel scope="main" defaultDate="2026-04-01" />);

    fireEvent.click(screen.getByRole("button", { name: /share link/i }));
    const card = await screen.findByTestId("share-link-card-link-to-revoke");
    fireEvent.click(within(card).getByRole("button", { name: /link options/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /revoke/i }));

    await waitFor(() => expect(cashFlowService.revokeShareLink).toHaveBeenCalledWith(link.id));
    const revokedCard = await screen.findByTestId("share-link-card-link-to-revoke");
    expect(revokedCard.className).toContain("bg-red-50");
    fireEvent.click(within(revokedCard).getByRole("button", { name: /link options/i }));
    expect(screen.queryByRole("menuitem", { name: /revoke/i })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /hide/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("share-link-card-link-to-revoke")).toBeNull();
    });
  });
});
