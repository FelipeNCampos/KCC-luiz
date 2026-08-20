import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CashFlowSharedPage } from "./CashFlowSharedPage";
import { cashFlowService } from "../services/cashflow";

vi.mock("../services/cashflow", () => ({
  cashFlowService: {
    getPublicShare: vi.fn(),
    publicUrl: vi.fn((path: string) => path)
  }
}));

describe("CashFlowSharedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders public records and receipts without administrative actions", async () => {
    vi.mocked(cashFlowService.getPublicShare).mockResolvedValue({
      date_from: "2026-04-01",
      date_to: "2026-04-02",
      credit_total: "100.00",
      debit_total: "-25.00",
      net_total: "75.00",
      items: [{
        record_date: "2026-04-01",
        amount: "100.00",
        description: "Rent",
        notes: "Bank transfer",
        supplier: "Tenant",
        flat: "Flat 50",
        has_invoice: true,
        invoice_number: "INV-1",
        invoice_media_name: "receipt.pdf",
        invoice_media_mime: "application/pdf",
        invoice_media_url: "/api/v1/cashflow/shared/public-token/records/1/invoice"
      }]
    });
    render(<MemoryRouter initialEntries={["/cash-flow/share/public-token"]}><Routes><Route path="/cash-flow/share/:token" element={<CashFlowSharedPage />} /></Routes></MemoryRouter>);

    expect(await screen.findByText("Cashflow records")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();
    expect(screen.getByText("Rent")).toBeTruthy();
    expect(screen.getByText("Bank transfer")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View receipt" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /new record|share link|revoke/i })).toBeNull();
  });

  it("shows a neutral unavailable screen for an invalid link", async () => {
    vi.mocked(cashFlowService.getPublicShare).mockRejectedValue(new Error("not found"));
    render(<MemoryRouter initialEntries={["/cash-flow/share/nope"]}><Routes><Route path="/cash-flow/share/:token" element={<CashFlowSharedPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Link unavailable")).toBeTruthy();
  });
});
