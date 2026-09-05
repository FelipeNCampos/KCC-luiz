import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
        has_invoice_media: false,
        invoice_number: null,
        invoice_media_name: null,
        system_invoice_type: null,
        record_date: "2026-04-12",
        amount: "75.00",
        description: "Added to the wrong cashflow",
        notes: "Paid at reception",
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
    expect(within(recordRow!).getByRole("button", { name: "View invoice" })).toBeTruthy();
    fireEvent.click(recordRow!);

    expect(await screen.findByRole("heading", { name: "Edit record" })).toBeTruthy();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-04-12");
    expect((screen.getByLabelText("Value") as HTMLInputElement).value).toBe("75.00");
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Added to the wrong cashflow");
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).value).toBe("Paid at reception");
    expect(screen.getByRole("button", { name: "Edit invoice media" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download invoice media" })).toBeTruthy();

    const textColumnFooter = screen.getByRole("button", { name: "Save changes" }).closest("footer");
    expect(textColumnFooter?.className).toContain("mt-auto");

    const deleteButton = screen.getByRole("button", { name: "Delete record" });
    expect(deleteButton.textContent).toBe("");
    expect(textColumnFooter?.className).toContain("flex-nowrap");
    expect(textColumnFooter?.querySelector("button")).toBe(deleteButton);
  });

  it("focuses the editable record details from the popup Edit button", async () => {
    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Added to the wrong cashflow")).closest("tr")!);
    const invoiceNumber = await screen.findByLabelText("Invoice number");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(document.activeElement).toBe(invoiceNumber);
  });

  it("shows the selected flats as checkboxes in the record editor", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "75.00",
      current_balance: "75.00",
      items: [{
        id: 10,
        payment_number: 1,
        has_invoice: false,
        has_invoice_media: false,
        invoice_number: null,
        invoice_media_name: null,
        system_invoice_type: null,
        record_date: "2026-04-12",
        amount: "75.00",
        description: "Shared invoice",
        notes: null,
        supplier: null,
        flat: "Flat 50, Flat 52",
        balance: "75.00",
        created_by_user_id: 1,
        created_at: "2026-04-12T12:00:00Z"
      }]
    });

    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Shared invoice")).closest("tr")!);
    const flat50 = await screen.findByRole("checkbox", { name: "Flat 50" }) as HTMLInputElement;
    const flat51 = screen.getByRole("checkbox", { name: "Flat 51" }) as HTMLInputElement;
    const flat52 = screen.getByRole("checkbox", { name: "Flat 52" }) as HTMLInputElement;

    expect(flat50.checked).toBe(true);
    expect(flat51.checked).toBe(false);
    expect(flat52.checked).toBe(true);
  });

  it("allows multiple flats to be selected with checkboxes when creating a record", async () => {
    render(<CashFlowPage />);

    fireEvent.click(screen.getByRole("button", { name: "New record" }));
    const flat50 = screen.getByRole("checkbox", { name: "Flat 50" }) as HTMLInputElement;
    const flat52 = screen.getByRole("checkbox", { name: "Flat 52" }) as HTMLInputElement;

    fireEvent.click(flat50);
    fireEvent.click(flat52);
    expect(flat50.checked).toBe(true);
    expect(flat52.checked).toBe(true);
    expect(screen.getByLabelText("Description")).toBeTruthy();
    expect(screen.getByLabelText("Notes")).toBeTruthy();
  });

  it("saves the textual changes made in the row editor", async () => {
    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Added to the wrong cashflow")).closest("tr")!);
    await screen.findByRole("heading", { name: "Edit record" });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-04-15" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "99.50" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Corrected entry" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Updated note" } });
    fireEvent.change(screen.getByLabelText("Supplier"), { target: { value: "Oak Services" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Flat 50" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Flat 51" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(cashFlowService.update).toHaveBeenCalledWith(10, {
        recordDate: "2026-04-15",
        value: "99.50",
        description: "Corrected entry",
        notes: "Updated note",
        supplier: "Oak Services",
        flat: "Flat 51"
      })
    );
  });

  it("indicates that search also accepts an amount", () => {
    render(<CashFlowPage />);

    expect(screen.getByPlaceholderText("Search by Description, Notes, Supplier, Flat or Amount")).toBeTruthy();
  });

  it("shows Description and Notes columns in both cashflows", async () => {
    const { rerender } = render(<CashFlowPage />);

    await screen.findByText("Added to the wrong cashflow");
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Comments" })).toBeNull();
    expect(screen.getByRole("button", { name: "View notes" })).toBeTruthy();

    rerender(<CashFlowPage scope="cashflow52" showFlat={false} />);

    await screen.findByText("Added to the wrong cashflow");
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Comments" })).toBeNull();
    expect(screen.getByPlaceholderText("Search by Description, Notes, Supplier or Amount")).toBeTruthy();
  });

  it("shows notes in a popup without expanding the table row", async () => {
    render(<CashFlowPage />);

    const row = (await screen.findByText("Added to the wrong cashflow")).closest("tr");
    expect(within(row!).queryByText("Paid at reception")).toBeNull();

    fireEvent.click(within(row!).getByRole("button", { name: "View notes" }));

    expect(await screen.findByRole("dialog", { name: "Notes" })).toBeTruthy();
    expect(screen.getByText("Paid at reception")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Edit record" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close notes" }));
    expect(screen.queryByRole("dialog", { name: "Notes" })).toBeNull();
  });

  it("shows a View invoice control in the invoice column", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "0.00",
      current_balance: "0.00",
      items: [
        {
          id: 12,
          payment_number: 2,
          has_invoice: true,
          has_invoice_media: false,
          invoice_number: null,
          invoice_media_name: null,
          system_invoice_type: null,
          record_date: "2026-04-13",
          amount: "-10.00",
          description: "Invoice number only",
          supplier: null,
          flat: null,
          balance: "65.00",
          created_by_user_id: 1,
          created_at: "2026-04-13T12:00:00Z"
        },
        {
          id: 13,
          payment_number: 3,
          has_invoice: true,
          has_invoice_media: true,
          invoice_number: "INV-13",
          invoice_media_name: "invoice.pdf",
          system_invoice_type: null,
          record_date: "2026-04-14",
          amount: "10.00",
          description: "Invoice with media",
          supplier: null,
          flat: null,
          balance: "75.00",
          created_by_user_id: 1,
          created_at: "2026-04-14T12:00:00Z"
        }
      ]
    } as never);

    render(<CashFlowPage />);

    const noMediaRow = (await screen.findByText("Invoice number only")).closest("tr");
    const mediaRow = screen.getByText("Invoice with media").closest("tr");
    expect(within(noMediaRow!).getByRole("button", { name: "View invoice" })).toBeTruthy();
    expect(within(mediaRow!).getByRole("button", { name: "View invoice" })).toBeTruthy();
  });

  it("opens the invoice media popup from View without opening the record editor", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-10.00",
      current_balance: "-10.00",
      items: [{
        id: 13,
        payment_number: 3,
        has_invoice: true,
        has_invoice_media: true,
        invoice_number: "INV-13",
        invoice_media_name: "Costco_01-08-2026_£19.18.pdf",
        system_invoice_type: null,
        record_date: "2026-04-14",
        amount: "-19.18",
        description: "KS Trip satin",
        supplier: "Costco",
        flat: null,
        balance: "825.83",
        created_by_user_id: 1,
        created_at: "2026-04-14T12:00:00Z"
      }]
    } as never);
    vi.mocked(cashFlowService.getInvoiceMedia).mockResolvedValue({
      blob: new Blob(["%PDF-invoice"], { type: "application/pdf" }),
      contentType: "application/pdf"
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:invoice-media")
    });

    render(<CashFlowPage />);

    const row = (await screen.findByText("KS Trip satin")).closest("tr");
    fireEvent.click(within(row!).getByRole("button", { name: "View invoice" }));

    expect(await screen.findByText("INVOICE MEDIA")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Costco_01-08-2026_£19.18.pdf" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace image or PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open in new tab" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update media" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Edit record" })).toBeNull();
    expect(cashFlowService.getInvoiceMedia).toHaveBeenCalledWith(13);
  });

  it("updates invoice media from the dedicated popup after a replacement is selected", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-10.00",
      current_balance: "-10.00",
      items: [{
        id: 13,
        payment_number: 3,
        has_invoice: true,
        has_invoice_media: true,
        invoice_number: "INV-13",
        invoice_media_name: "invoice.pdf",
        system_invoice_type: null,
        record_date: "2026-04-14",
        amount: "-10.00",
        description: "Invoice with media",
        supplier: "Costco",
        flat: null,
        balance: "65.00",
        created_by_user_id: 1,
        created_at: "2026-04-14T12:00:00Z"
      }]
    } as never);
    vi.mocked(cashFlowService.getInvoiceMedia).mockResolvedValue({
      blob: new Blob(["%PDF-invoice"], { type: "application/pdf" }),
      contentType: "application/pdf"
    });
    vi.mocked(cashFlowService.updateInvoiceMedia).mockResolvedValue({ id: 13 } as never);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:invoice-media")
    });

    render(<CashFlowPage />);

    const row = (await screen.findByText("Invoice with media")).closest("tr");
    fireEvent.click(within(row!).getByRole("button", { name: "View invoice" }));

    const fileInput = await screen.findByLabelText("Select invoice media");
    const file = new File(["replacement"], "replacement.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Update media" }));

    await waitFor(() =>
      expect(cashFlowService.updateInvoiceMedia).toHaveBeenCalledWith(13, { invoiceMedia: file })
    );
  });

  it("loads legacy invoice media even when its filename is missing", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-10.00",
      current_balance: "-10.00",
      items: [{
        id: 14,
        payment_number: 4,
        has_invoice: true,
        has_invoice_media: true,
        invoice_number: "INV-14",
        invoice_media_name: null,
        system_invoice_type: null,
        record_date: "2026-04-15",
        amount: "-10.00",
        description: "Legacy invoice media",
        supplier: null,
        flat: null,
        balance: "65.00",
        created_by_user_id: 1,
        created_at: "2026-04-15T12:00:00Z"
      }]
    } as never);
    vi.mocked(cashFlowService.getInvoiceMedia).mockResolvedValue({
      blob: new Blob(["%PDF-legacy invoice"], { type: "application/pdf" }),
      contentType: "application/pdf"
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:legacy-invoice")
    });

    render(<CashFlowPage />);
    fireEvent.click((await screen.findByText("Legacy invoice media")).closest("tr")!);

    await waitFor(() => expect(cashFlowService.getInvoiceMedia).toHaveBeenCalledWith(14));
    expect(screen.getByTitle("Invoice preview")).toBeTruthy();
  });

  it("lets an invoice without media add it from the details popup", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-10.00",
      current_balance: "-10.00",
      items: [{
        id: 12,
        payment_number: 2,
        has_invoice: true,
        has_invoice_media: false,
        invoice_number: "INV-12",
        invoice_media_name: null,
        system_invoice_type: null,
        record_date: "2026-04-13",
        amount: "-10.00",
        description: "Invoice without media",
        supplier: null,
        flat: null,
        balance: "65.00",
        created_by_user_id: 1,
        created_at: "2026-04-13T12:00:00Z"
      }]
    } as never);
    vi.mocked(cashFlowService.updateInvoiceMedia).mockResolvedValue({ id: 12 } as never);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:invoice")
    });

    render(<CashFlowPage />);
    fireEvent.click((await screen.findByText("Invoice without media")).closest("tr")!);

    const downloadButton = await screen.findByRole("button", { name: "Download invoice media" });
    const editButton = screen.getByRole("button", { name: "Edit invoice media" });
    expect(downloadButton.nextElementSibling).toBe(editButton);
    expect((downloadButton as HTMLButtonElement).disabled).toBe(true);

    const fileInput = screen.getByLabelText("Select invoice media") as HTMLInputElement;
    const openFilePicker = vi.spyOn(fileInput, "click");
    fireEvent.click(editButton);
    expect(openFilePicker).toHaveBeenCalledOnce();

    const file = new File(["invoice"], "invoice.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(cashFlowService.updateInvoiceMedia).toHaveBeenCalledWith(12, { invoiceMedia: file })
    );
  });

  it("filters both cashflows by a custom date period and labels the month as Custom", async () => {
    const applyCustomPeriod = async (scope: "main" | "cashflow52") => {
      fireEvent.click(screen.getByRole("button", { name: "Customize period" }));
      await screen.findByRole("heading", { name: "Customize cashflow period" });
      fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-04-10" } });
      fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-04-20" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply period" }));

      await waitFor(() =>
        expect(cashFlowService.list).toHaveBeenLastCalledWith(
          expect.objectContaining({
            dateFrom: "2026-04-10",
            dateTo: "2026-04-20",
            scope,
            all: false
          })
        )
      );
      expect((screen.getByLabelText("Month") as HTMLInputElement).value).toBe("Custom");
    };

    const main = render(<CashFlowPage />);
    await applyCustomPeriod("main");
    main.unmount();

    render(<CashFlowPage scope="cashflow52" showFlat={false} />);
    await applyCustomPeriod("cashflow52");
  });

  it("returns a customized period to the existing single-month picker when Month is clicked", async () => {
    const showPicker = vi.fn();
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker
    });

    render(<CashFlowPage />);
    fireEvent.click(screen.getByRole("button", { name: "Customize period" }));
    await screen.findByRole("heading", { name: "Customize cashflow period" });
    fireEvent.click(screen.getByRole("button", { name: "Apply period" }));

    const monthInput = screen.getByLabelText("Month") as HTMLInputElement;
    expect(monthInput.value).toBe("Custom");
    fireEvent.click(monthInput);

    await waitFor(() => expect((screen.getByLabelText("Month") as HTMLInputElement).type).toBe("month"));
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(showPicker).toHaveBeenCalled();
  });

  it("switches both cashflow reports from month to an inclusive date range", async () => {
    vi.mocked(cashFlowService.previewReport).mockResolvedValue(new Blob(["report"]) as never);
    vi.mocked(cashFlowService.sendReport).mockResolvedValue({ message: "Cash flow report sent" } as never);
    render(<CashFlowPage scope="cashflow52" showFlat={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    await screen.findByRole("heading", { name: "Send report" });

    expect((screen.getByLabelText("Start month") as HTMLInputElement).type).toBe("month");
    expect(screen.queryByText("Add invoice table before media pages")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    expect((screen.getByLabelText("Start date") as HTMLInputElement).type).toBe("date");
    expect((screen.getByLabelText("End date") as HTMLInputElement).type).toBe("date");

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-04-10" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-04-20" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "report@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    await waitFor(() =>
      expect(cashFlowService.sendReport).toHaveBeenCalledWith({
        email: "report@example.com",
        scope: "cashflow52",
        date_from: "2026-04-10",
        date_to: "2026-04-20"
      })
    );
  });

  it("shows the amount total beside the balance total in both cashflows", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-125.50",
      current_balance: "75.00",
      items: []
    } as never);

    const { rerender } = render(<CashFlowPage />);

    await screen.findByText("No records for this month.");
    let totalLabels = screen.getAllByText("Total:");
    expect(totalLabels).toHaveLength(2);
    expect(totalLabels[0].className).not.toContain("uppercase");
    expect(totalLabels[0].nextElementSibling?.textContent).toBe("-£125.50");
    expect(totalLabels[1].nextElementSibling?.textContent).toBe("£75.00");

    rerender(<CashFlowPage showFlat={false} />);

    totalLabels = await screen.findAllByText("Total:");
    expect(totalLabels).toHaveLength(2);
    expect(totalLabels[0].nextElementSibling?.textContent).toBe("-£125.50");
    expect(totalLabels[1].nextElementSibling?.textContent).toBe("£75.00");
  });

  it("keeps the totals visible in the scrollable table for both cashflows", async () => {
    const { rerender } = render(<CashFlowPage />);

    await screen.findByText("Added to the wrong cashflow");
    let table = screen.getByRole("table");
    expect(table.parentElement?.className).toContain("max-h-[calc(100dvh-24rem)]");
    expect(table.parentElement?.className).toContain("overflow-y-auto");
    expect(table.querySelector("tfoot")?.className).toContain("sticky");
    expect(table.querySelector("tfoot")?.className).toContain("bottom-0");

    rerender(<CashFlowPage scope="cashflow52" showFlat={false} />);

    table = await screen.findByRole("table");
    expect(table.parentElement?.className).toContain("max-h-[calc(100dvh-24rem)]");
    expect(table.parentElement?.className).toContain("overflow-y-auto");
    expect(table.querySelector("tfoot")?.className).toContain("sticky");
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
      has_invoice_media: false,
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

    fireEvent.change(screen.getByPlaceholderText("Search by Description, Notes, Supplier, Flat or Amount"), {
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
        has_invoice_media: true,
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

  it("hides the raw value and excludes it from edits to a system invoice record", async () => {
    vi.mocked(cashFlowService.list).mockResolvedValue({
      month: "2026-04",
      monthly_total: "-75.00",
      current_balance: "-75.00",
      items: [{
        id: 42,
        payment_number: 1,
        has_invoice: true,
        has_invoice_media: true,
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

    render(<CashFlowPage />);

    fireEvent.click((await screen.findByText("Cleaning")).closest("tr")!);
    await screen.findByRole("heading", { name: "Edit record" });
    expect(screen.queryByLabelText("Value")).toBeNull();

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Corrected cleaning" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(cashFlowService.update).toHaveBeenCalledWith(42, {
        recordDate: "2026-04-12",
        description: "Corrected cleaning",
        notes: null,
        supplier: null,
        flat: "Flat 52"
      })
    );
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
        has_invoice_media: true,
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
