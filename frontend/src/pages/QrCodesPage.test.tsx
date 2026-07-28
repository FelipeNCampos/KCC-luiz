import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QrCodesPage } from "./QrCodesPage";

vi.mock("../components/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("QrCodesPage", () => {
  it("shows separate QR codes for the public energy and gas readings forms", () => {
    render(<QrCodesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Readings" }));

    expect(screen.getByRole("heading", { name: "Energy readings" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Gas readings" })).toBeTruthy();

    const links = screen.getAllByRole("link", { name: "Open" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `${window.location.origin}/readings/energy`,
      `${window.location.origin}/readings/gas`,
    ]);
  });
});
