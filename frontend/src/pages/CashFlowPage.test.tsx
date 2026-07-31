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

vi.mock("../components/InvoiceModal", () => ({
  InvoiceModal: ({ editingRecordId }: { editingRecordId?: number }) =>
    editingRecordId ? <p>Editing system invoice {editingRecordId}</p> : null
}));

vi.mock("../components/InvoiceModalContractor", () => ({
  InvoiceModalContractor: ({ editingRecordId }: { editingRecordId?: number }) =>
    editingRecordId ? <p>Editing contractor invoice {editingRecordId}</p> : null
}));

vi.mock("../services/cashflow", () => ({
  cashFlowService: {
    list: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    getInvoiceMedia: vi.fn(),
    updateInvoiceMedia: vi.fn(),
    getSystemInvoice: vi.fn(),
    previewReport: vi.fn(),
    sendReport: vi.fn()
  }
}));

describe("CashFlowPage records", () => {
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
        system_invoice_type: null,
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

  it("opens one complete editor from a row click without inline table controls", async () => {
    render(<CashFlowPage />);

    expect(screen.queryByRole("columnheader", { name: "Action" })).toBeNull();

    const recordRow = (await screen.findByText("Added to the wrong cashflow")).closest("tr");
    expect(recordRow).not.toBeNull();
    expect(recordRow?.querySelector("button")).toBeNull();
    fireEvent.click(recordRow!);

    expect(await screen.findByRole("heading", { name: "Edit record" })).toBeTruthy();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-04-12");
    expect((screen.getByLabelText("Value") as HTMLInputElement).value).toBe("75.00");
    expect((screen.getByLabelText("Comments") as HTMLTextAreaElement).value).toBe("Added to the wrong cashflow");
    expect(screen.queryByRole("button", { name: "Edit invoice media" })).toBeNull();
    expect(screen.getByRole("button", { name: "Download invoice media" })).toBeTruthy();

    const textColumnFooter = screen.getByRole("button", { name: "Save changes" }).closest("footer");
    expect(textColumnFooter?.className).toContain("mt-auto");

    const deleteButton = screen.getByRole("button", { name: "Delete record" });
    expect(deleteButton.textContent).toBe("");
    expect(textColumnFooter?.className).toContain("flex-nowrap");
    expect(textColumnFooter?.querySelector("button")).toBe(deleteButton);
  });

  it("saves the textual changes made in the row editor", async () => {
    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Added to the wrong cashflow")).closest("tr")!);
    await screen.findByRole("heading", { name: "Edit record" });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-04-15" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "99.50" } });
    fireEvent.change(screen.getByLabelText("Comments"), { target: { value: "Corrected entry" } });
    fireEvent.change(screen.getByLabelText("Supplier"), { target: { value: "Oak Services" } });
    fireEvent.change(screen.getByLabelText("Flat"), { target: { value: "Flat 51" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(cashFlowService.update).toHaveBeenCalledWith(10, {
        recordDate: "2026-04-15",
        value: "99.50",
        description: "Corrected entry",
        supplier: "Oak Services",
        flat: "Flat 51"
      })
    );
  });

  it("indicates that search also accepts an amount", () => {
    render(<CashFlowPage />);

    expect(screen.getByPlaceholderText("Search by Description, Supplier, Flat or Amount")).toBeTruthy();
  });

  it("searches all records when All is selected", async () => {
    render(<CashFlowPage />);

    fireEvent.click(screen.getByRole("checkbox", { name: "All" }));

    await waitFor(() =>
      expect(cashFlowService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ all: true, scope: "main" })
      )
    );
  });

  it("takes an All-search result to its month before opening its editor", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
    const marchInvoice = {
      id: 11,
      payment_number: 2,
      has_invoice: true,
      invoice_number: "INV-2026-03",
      invoice_media_name: null,
      system_invoice_type: null,
      record_date: "2026-03-12",
      amount: "200.00",
      description: "March invoice",
      supplier: "Oak Services",
      flat: "Flat 50",
      balance: "200.00",
      created_by_user_id: 1,
      created_at: "2026-03-12T12:00:00Z"
    };
    vi.mocked(cashFlowService.list).mockImplementation(({ all, month }) =>
      Promise.resolve({
        month: all ? "All" : month,
        monthly_total: "200.00",
        current_balance: "200.00",
        items: [marchInvoice]
      } as never)
    );

    render(<CashFlowPage />);

    fireEvent.change(screen.getByPlaceholderText("Search by Description, Supplier, Flat or Amount"), {
      target: { value: "March invoice" }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "All" }));
    fireEvent.click((await screen.findByText("March invoice")).closest("tr")!);

    await waitFor(() =>
      expect(cashFlowService.list).toHaveBeenLastCalledWith({
        month: "2026-03",
        search: "March invoice",
        scope: "main",
        all: false
      })
    );

    const focusedRow = (await screen.findByText("March invoice")).closest("tr");
    expect((screen.getByLabelText("Month") as HTMLInputElement).value).toBe("2026-03");
    expect(focusedRow?.dataset.highlighted).toBe("true");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(screen.queryByRole("heading", { name: "Edit record" })).toBeNull();

    fireEvent.click(focusedRow!);

    expect(await screen.findByRole("heading", { name: "Edit record" })).toBeTruthy();
  });

  it("opens the editable system invoice over its media preview only after clicking the media pencil", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-75.00",
      current_balance: "-75.00",
      items: [{
        id: 42,
        payment_number: 1,
        has_invoice: true,
        invoice_number: "Inv-0042",
        invoice_media_name: "invoice.pdf",
        system_invoice_type: "cleaner",
        record_date: "2026-04-12",
        amount: "-75.00",
        description: "Cleaning",
        supplier: null,
        flat: "Flat 52",
        balance: "-75.00",
        created_by_user_id: 1,
        created_at: "2026-04-12T12:00:00Z"
      }]
    } as never);
    vi.mocked(cashFlowService.getSystemInvoice).mockResolvedValue({
      system_invoice_type: "cleaner",
      system_invoice_data: { invoiceNumber: "Inv-0042", items: [] }
    } as never);

    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Cleaning")).closest("tr")!);
    expect(await screen.findByRole("heading", { name: "Edit record" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit invoice media" })).toBeTruthy();
    expect(cashFlowService.getSystemInvoice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Edit invoice media" }));

    expect(await screen.findByText("Editing system invoice 42")).toBeTruthy();
    expect(cashFlowService.getSystemInvoice).toHaveBeenCalledWith(42);
  });

  it("opens the Contractor editor from the media pencil", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-120.00",
      current_balance: "-120.00",
      items: [{
        id: 43,
        payment_number: 2,
        has_invoice: true,
        invoice_number: "Inv-0043",
        invoice_media_name: "contractor.pdf",
        system_invoice_type: "contractor",
        record_date: "2026-04-13",
        amount: "-120.00",
        description: "Plumbing",
        supplier: "Oak Plumbing",
        flat: "Flat 51",
        balance: "-120.00",
        created_by_user_id: 1,
        created_at: "2026-04-13T12:00:00Z"
      }]
    } as never);
    vi.mocked(cashFlowService.getSystemInvoice).mockResolvedValue({
      system_invoice_type: "contractor",
      system_invoice_data: { invoiceNumber: "Inv-0043", items: [] }
    } as never);

    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Plumbing")).closest("tr")!);
    expect(await screen.findByRole("heading", { name: "Edit record" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit invoice media" }));

    expect(await screen.findByText("Editing contractor invoice 43")).toBeTruthy();
    expect(cashFlowService.getSystemInvoice).toHaveBeenCalledWith(43);
  });
});
