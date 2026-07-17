import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("moves a record from the main cashflow to Cashflow 52", async () => {
    render(<CashFlowPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Move to Cashflow 52" }));

    await waitFor(() => expect(cashFlowService.update).toHaveBeenCalledWith(10, { scope: "cashflow52" }));
  });
});
