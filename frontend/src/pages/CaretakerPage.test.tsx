import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaretakerPage } from "./CaretakerPage";
import { oakhillService } from "../services/oakhill";

vi.mock("../components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../components/InvoiceModalContractor", () => ({ InvoiceModalContractor: () => null }));
vi.mock("../services/oakhill", () => ({
  oakhillService: {
    contractorVisits: vi.fn(), contractorCheckOut: vi.fn(), updateContractorVisit: vi.fn(),
    maintenanceCategories: vi.fn(), maintenanceSchedules: vi.fn(), maintenanceHistory: vi.fn(),
    createMaintenanceCategory: vi.fn(), createMaintenanceSchedule: vi.fn()
  }
}));

const record = {
  id: "visit-1", name: "Carlos", company: "Fix Co", flat: "50", building_name: "Flat 50", job_description: "Repair", mobile: "62911111111",
  in_at: "2026-07-10T10:00:00Z", out_at: "2026-07-10T12:00:00Z", condominio_id: "condo-1",
  extra_media_name: null, extra_media_data: null, extra_media_2_name: null, extra_media_2_data: null,
  extra_media_3_name: null, extra_media_3_data: null, extra_media_4_name: null, extra_media_4_data: null
};

describe("CaretakerPage record editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(oakhillService.contractorVisits).mockResolvedValue({ data: [record], count: 1 });
    vi.mocked(oakhillService.updateContractorVisit).mockResolvedValue(record);
    vi.mocked(oakhillService.maintenanceCategories).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.maintenanceSchedules).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.maintenanceHistory).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.createMaintenanceCategory).mockResolvedValue({ id: "category-1", name: "Plumbing", created_at: "2026-07-21T10:00:00Z", condominio_id: "condo-1" });
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("opens an editable contractor record when its name is clicked", async () => {
    render(<CaretakerPage />);

    fireEvent.click(await screen.findByText("Carlos"));

    expect(await screen.findByRole("heading", { name: "Edit contractor record" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Carla" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(oakhillService.updateContractorVisit).toHaveBeenCalledWith("visit-1", expect.objectContaining({ name: "Carla" })));
  });

  it("opens Maintenance and adds a category from its schedule popup", async () => {
    render(<CaretakerPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Maintenance" })[0]);

    expect(await screen.findByRole("heading", { name: "Maintenance" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Category" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Tag" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Report" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Frequency" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Category" }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Plumbing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() => expect(oakhillService.createMaintenanceCategory).toHaveBeenCalledWith("Plumbing"));
  });

  it("shows schedule status and the automatic contractor history in separate tabs", async () => {
    vi.mocked(oakhillService.maintenanceSchedules).mockResolvedValue({
      data: [
        { id: "late", category_id: "category-1", category_name: "Plumbing", tag: "Boiler 1", report: "Safety check", frequency_days: 30, notes: "Bring gauge", cellphone: "62911111111", latest_in_at: "2026-05-01T10:00:00Z", latest_out_at: "2026-05-01T12:00:00Z", is_overdue: true, created_at: "2026-01-01T10:00:00Z", updated_at: "2026-05-01T12:00:00Z", condominio_id: "condo-1" },
        { id: "current", category_id: "category-1", category_name: "Plumbing", tag: "Boiler 2", report: "Safety check", frequency_days: 30, notes: "Current", cellphone: null, latest_in_at: null, latest_out_at: null, is_overdue: false, created_at: "2026-01-01T10:00:00Z", updated_at: "2026-01-01T10:00:00Z", condominio_id: "condo-1" }
      ],
      count: 2
    });
    vi.mocked(oakhillService.maintenanceHistory).mockResolvedValue({
      data: [{ id: "history-1", maintenance_id: "late", category_name: "Plumbing", tag: "Boiler 1", report: "Safety check", contractor_visit_id: "visit-1", contractor_name: "Carlos", contractor_mobile: "62911111111", in_at: "2026-05-01T10:00:00Z", out_at: "2026-05-01T12:00:00Z", condominio_id: "condo-1" }],
      count: 1
    });
    render(<CaretakerPage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Maintenance" })[0]);
    const overdueRow = (await screen.findByText("Boiler 1")).closest("tr");
    const currentRow = screen.getByText("Boiler 2").closest("tr");
    expect(overdueRow?.className).toContain("bg-red-50");
    expect(currentRow?.className).toContain("bg-emerald-50");

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByRole("columnheader", { name: "Contractor" })).toBeTruthy();
    expect(screen.getAllByText("Carlos").length).toBe(2);
    expect(screen.queryByText("Open")).toBeNull();
  });
});
