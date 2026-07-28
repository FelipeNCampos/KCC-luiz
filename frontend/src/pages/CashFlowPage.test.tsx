import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CashFlowPage } from "./CashFlowPage";
import { cashFlowService } from "../services/cashflow";

vi.mock("../components/DashboardShell", () => ({
  DashboardShell: ({ children, rightSlot }: { children: React.ReactNode; rightSlot?: React.ReactNode }) => (
    <main>{rightSlot}{children}</main>
  )
}));

vi.mock("../components/CashFlowShareLinksPanel", () => ({
  CashFlowShareLinksPanel: () => null
}));

vi.mock("../services/cashflow", () => ({
  cashFlowService: {
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    getInvoiceMedia: vi.fn(),
    updateInvoiceMedia: vi.fn(),
    previewReport: vi.fn(),
    sendReport: vi.fn()
  }
}));

describe("CashFlowPage record movement", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "75.00",
      current_balance: "75.00",
      items: [{
        id: 10,
        payment_number: 1,
        has_invoice: false,
        invoice_number: null,
        invoice_media_name: null,
        record_date: "2026-04-12",
        amount: "75.00",
        description: "Added to the wrong cashflow",
        supplier: null,
        flat: "Flat 50",
        balance: "75.00",
        created_by_user_id: 1,
        created_at: "2026-04-12T12:00:00Z"
      }]
    });
    vi.mocked(cashFlowService.update).mockResolvedValue({} as never);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("reveals record actions from the clicked row and moves it to Cashflow 52", async () => {
    render(<CashFlowPage />);

    expect(screen.queryByRole("columnheader", { name: "Action" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move to Cashflow 52" })).toBeNull();

    const recordRow = (await screen.findByText("Added to the wrong cashflow")).closest("tr");
    expect(recordRow).not.toBeNull();
    fireEvent.click(recordRow!);

    fireEvent.click(await screen.findByRole("button", { name: "Move to Cashflow 52" }));

    await waitFor(() => expect(cashFlowService.update).toHaveBeenCalledWith(10, { scope: "cashflow52" }));
  });

  it("labels the main cashflow destination as Cashflow penthouse", async () => {
    render(<CashFlowPage scope="cashflow52" showFlat={false} />);

    const recordRow = (await screen.findByText("Added to the wrong cashflow")).closest("tr");
    expect(recordRow).not.toBeNull();
    fireEvent.click(recordRow!);

    expect(await screen.findByRole("button", { name: "Move to Cashflow penthouse" })).toBeTruthy();
  });

  it("indicates that search also accepts an amount", () => {
    render(<CashFlowPage />);

    expect(screen.getByPlaceholderText("Search by Description, Supplier, Flat or Amount")).toBeTruthy();
  });
});
