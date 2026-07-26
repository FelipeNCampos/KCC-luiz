import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvoiceModal } from "./InvoiceModal";
import { InvoiceModalContractor } from "./InvoiceModalContractor";
import { cashFlowService } from "../services/cashflow";

vi.mock("../services/cashflow", () => ({
  cashFlowService: {
    create: vi.fn(),
    getNextPaymentNumber: vi.fn()
  }
}));
vi.mock("../utils/pdfPreview", () => ({ renderPdfFirstPageToDataUrl: vi.fn() }));

function completeInvoice() {
  fireEvent.click(screen.getByRole("radio", { name: "Total invoice value" }));
  fireEvent.change(screen.getByLabelText("Invoice total"), { target: { value: "120" } });
}

describe("invoice cashflow destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashFlowService.getNextPaymentNumber).mockResolvedValue(85);
    vi.mocked(cashFlowService.create).mockResolvedValue({ payment_number: 85 } as never);
  });

  afterEach(cleanup);

  it("sends a cleaner invoice to Cashflow 52 and keeps download icon-only", async () => {
    render(
      <InvoiceModal
        open
        sourceLabel="Cleaner"
        defaultDescription="Cleaner service invoice"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Download invoice" }).textContent).toBe("");
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "52" }));

    await waitFor(() =>
      expect(cashFlowService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "cashflow52",
          invoiceMedia: expect.any(File)
        })
      )
    );
  });

  it("sends a contractor invoice to Cashflow penthouse and keeps download icon-only", async () => {
    render(
      <InvoiceModalContractor
        open
        sourceLabel="Contractor"
        defaultDescription="Contractor service invoice"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Download invoice" }).textContent).toBe("");
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Penthouse" }));

    await waitFor(() =>
      expect(cashFlowService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "main",
          invoiceMedia: expect.any(File)
        })
      )
    );
  });
});
