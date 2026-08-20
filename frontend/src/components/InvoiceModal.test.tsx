import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvoiceModal } from "./InvoiceModal";
import { InvoiceModalContractor } from "./InvoiceModalContractor";
import { cashFlowService } from "../services/cashflow";

vi.mock("../services/cashflow", () => ({
  cashFlowService: {
    create: vi.fn(),
    updateSystemInvoice: vi.fn(),
    getNextPaymentNumber: vi.fn()
  }
}));
vi.mock("../utils/pdfPreview", () => ({ renderPdfFirstPageToDataUrl: vi.fn() }));

const pdfTextCalls = vi.hoisted(() => ({
  fontSize: 0,
  calls: [] as Array<{ content: unknown; fontSize: number; x: number; y: number; options?: unknown }>,
}));

vi.mock("jspdf", () => ({
  jsPDF: function MockJsPdf() {
    return {
      internal: {
        pageSize: {
          getWidth: () => 595.28,
          getHeight: () => 841.89,
        },
      },
      setFont: () => undefined,
      setFontSize: (fontSize: number) => {
        pdfTextCalls.fontSize = fontSize;
      },
      setTextColor: () => undefined,
      setFillColor: () => undefined,
      setDrawColor: () => undefined,
      rect: () => undefined,
      text: (content: unknown, x: number, y: number, options?: unknown) => {
        pdfTextCalls.calls.push({ content, fontSize: pdfTextCalls.fontSize, x, y, options });
      },
      splitTextToSize: (content: unknown) => (Array.isArray(content) ? content.map(String) : [String(content)]),
      addPage: () => undefined,
      getImageProperties: () => ({ width: 1, height: 1 }),
      addImage: () => undefined,
      output: () => new Blob(),
      save: () => undefined,
    };
  },
}));

function completeInvoice() {
  fireEvent.click(screen.getByRole("radio", { name: "Total invoice value" }));
  fireEvent.change(screen.getByLabelText("Invoice total"), { target: { value: "120" } });
}

describe("invoice cashflow destination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfTextCalls.fontSize = 0;
    pdfTextCalls.calls.splice(0);
    vi.mocked(cashFlowService.getNextPaymentNumber).mockResolvedValue(85);
    vi.mocked(cashFlowService.create).mockResolvedValue({ payment_number: 85 } as never);
    vi.mocked(cashFlowService.updateSystemInvoice).mockResolvedValue({ id: 42 } as never);
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

  it("uses the cleaner bank account name as the cashflow supplier", async () => {
    render(
      <InvoiceModal
        open
        sourceLabel="Cleaner"
        defaultDescription="Cleaner service invoice"
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Account name"), { target: { value: "Maria Silva Cleaning" } });
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "52" }));

    await waitFor(() =>
      expect(cashFlowService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplier: "Maria Silva Cleaning"
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

  it("uses the contractor bank account name as the cashflow supplier", async () => {
    render(
      <InvoiceModalContractor
        open
        sourceLabel="Contractor"
        defaultDescription="Contractor service invoice"
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Bank account name"), { target: { value: "Oak Plumbing Ltd" } });
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Penthouse" }));

    await waitFor(() =>
      expect(cashFlowService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplier: "Oak Plumbing Ltd"
        })
      )
    );
  });

  it("updates a cleaner invoice in its original cashflow instead of creating another record", async () => {
    render(
      <InvoiceModal
        open
        sourceLabel="Cleaner"
        defaultDescription="Cleaner service invoice"
        editingRecordId={42}
        editingScope="cashflow52"
        editingDraft={{
          invoiceDate: "2026-04-10",
          invoiceNumber: "Inv-0042",
          to: "Flat 52",
          flat: ["52"],
          pricingMode: "per_item",
          items: [{ id: "item-1", date: "2026-04-10", description: "Cleaning", qty: "2", rate: "25" }],
        }}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Account name"), { target: { value: "Ana Costa" } });
    fireEvent.click(screen.getByRole("button", { name: "Save invoice changes" }));

    await waitFor(() =>
      expect(cashFlowService.updateSystemInvoice).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          systemInvoiceType: "cleaner",
          date: "2026-04-10",
          value: "-50.00",
          invoiceNumber: "Inv-0042",
          supplier: "Ana Costa",
          invoiceMedia: expect.any(File),
        })
      )
    );
    expect(cashFlowService.create).not.toHaveBeenCalled();
  });

  it("updates a contractor invoice in its original cashflow instead of creating another record", async () => {
    render(
      <InvoiceModalContractor
        open
        sourceLabel="Contractor"
        defaultDescription="Contractor service invoice"
        editingRecordId={43}
        editingScope="main"
        editingDraft={{
          invoiceDate: "2026-04-10",
          invoiceNumber: "Inv-0043",
          to: "Flat 50",
          flat: ["50"],
          pricingMode: "per_item",
          items: [{ id: "item-1", date: "2026-04-10", description: "Repair", total: "75" }],
        }}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Bank account name"), { target: { value: "Oak Plumbing Ltd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save invoice changes" }));

    await waitFor(() =>
      expect(cashFlowService.updateSystemInvoice).toHaveBeenCalledWith(
        43,
        expect.objectContaining({
          systemInvoiceType: "contractor",
          date: "2026-04-10",
          value: "-75.00",
          invoiceNumber: "Inv-0043",
          supplier: "Oak Plumbing Ltd",
          invoiceMedia: expect.any(File),
        })
      )
    );
    expect(cashFlowService.create).not.toHaveBeenCalled();
  });

  it("removes the cleaner account-name row and left-aligns description in total-invoice PDFs", async () => {
    render(
      <InvoiceModal
        open
        sourceLabel="Cleaner"
        defaultDescription="Cleaner service invoice"
        onClose={vi.fn()}
      />
    );

    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    await waitFor(() => expect(pdfTextCalls.calls).not.toHaveLength(0));

    expect(pdfTextCalls.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: ["-"], y: 92, options: { align: "center" } }),
      ])
    );
    expect(pdfTextCalls.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "DESCRIPTION", options: { align: "left" } }),
        expect.objectContaining({ content: ["Cleaner service invoice"], options: { align: "left" } }),
      ])
    );
  });

  it("removes the contractor account-name row and left-aligns description in total-invoice PDFs", async () => {
    render(
      <InvoiceModalContractor
        open
        sourceLabel="Contractor"
        defaultDescription="Contractor service invoice"
        onClose={vi.fn()}
      />
    );

    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    await waitFor(() => expect(pdfTextCalls.calls).not.toHaveLength(0));

    expect(pdfTextCalls.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: ["-"], y: 92, options: { align: "center" } }),
      ])
    );
    expect(pdfTextCalls.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "DESCRIPTION", options: { align: "left" } }),
        expect.objectContaining({ content: ["Contractor service invoice"], options: { align: "left" } }),
      ])
    );
  });

  it("renders a cleaner title as a left-aligned line above the table", async () => {
    render(
      <InvoiceModal
        open
        sourceLabel="Cleaner"
        defaultDescription="Cleaner service invoice"
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Title")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Deep clean" } });
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    await waitFor(() => expect(pdfTextCalls.calls).not.toHaveLength(0));

    expect(pdfTextCalls.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "Deep clean", fontSize: 8.67, options: { align: "left" }, x: 144 }),
        expect.objectContaining({ content: ["Cleaner service invoice"], options: { align: "left" } }),
      ])
    );
    expect(pdfTextCalls.calls).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "TITLE" })])
    );
  });

  it("omits the contractor title line when no title is provided", async () => {
    render(
      <InvoiceModalContractor
        open
        sourceLabel="Contractor"
        defaultDescription="Contractor service invoice"
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("Title")).not.toBeNull();
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    await waitFor(() => expect(pdfTextCalls.calls).not.toHaveLength(0));

    expect(pdfTextCalls.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "TITLE" }),
        expect.objectContaining({ content: [" "], options: { align: "left" } }),
      ])
    );
  });

  it("aligns the contractor title with the description column at two-thirds of its original size", async () => {
    render(
      <InvoiceModalContractor
        open
        sourceLabel="Contractor"
        defaultDescription="Contractor service invoice"
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Electrical repair" } });
    completeInvoice();
    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    await waitFor(() => expect(pdfTextCalls.calls).not.toHaveLength(0));

    expect(pdfTextCalls.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: "Electrical repair", fontSize: 8.67, options: { align: "left" }, x: 144 }),
      ])
    );
  });
});
