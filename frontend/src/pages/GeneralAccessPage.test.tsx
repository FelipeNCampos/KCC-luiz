import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GeneralAccessPage } from "./GeneralAccessPage";
import { oakhillService } from "../services/oakhill";

vi.mock("../services/oakhill", () => ({
  oakhillService: {
    cleanerOpen: vi.fn(), contractorOpen: vi.fn(), cleanerChecklist: vi.fn(), cleanerCheckInMany: vi.fn(), cleanerCheckOut: vi.fn(), contractorCheckInMany: vi.fn(), contractorCheckOutMany: vi.fn(),
  },
}));
vi.mock("../utils/closePublicPage", () => ({ closePublicPage: vi.fn() }));

describe("GeneralAccessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(oakhillService.cleanerOpen).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.contractorOpen).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.cleanerCheckInMany).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.contractorCheckInMany).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.contractorCheckOutMany).mockResolvedValue({ data: [], count: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("submits every selected flat for a cleaner check-in", async () => {
    render(<GeneralAccessPage />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Maria Cleaner" } });
    fireEvent.change(screen.getByLabelText("Mobile"), { target: { value: "62 90000 0000" } });
    fireEvent.click(screen.getByLabelText("Flat 50"));
    fireEvent.click(screen.getByLabelText("Flat 52"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm IN" }));

    await waitFor(() => expect(oakhillService.cleanerCheckInMany).toHaveBeenCalledWith({
      name: "Maria Cleaner",
      mobile: "62 90000 0000",
      building_ids: ["50", "52"],
    }));
  });

  it("submits every selected flat for a contractor check-in", async () => {
    render(<GeneralAccessPage />);

    fireEvent.click(screen.getByRole("button", { name: "Contractor" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Carlos Contractor" } });
    fireEvent.change(screen.getByLabelText("Mobile"), { target: { value: "62 91111 1111" } });
    fireEvent.change(screen.getByLabelText("Job description"), { target: { value: "Maintenance" } });
    fireEvent.click(screen.getByLabelText("Flat 50"));
    fireEvent.click(screen.getByLabelText("Flat 51"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm IN" }));

    await waitFor(() => expect(oakhillService.contractorCheckInMany).toHaveBeenCalledWith({
      name: "Carlos Contractor",
      company: "Contractor",
      building_ids: ["50", "51"],
      job_description: "Maintenance",
      mobile: "62 91111 1111",
    }));
  });

  it("checks a contractor out of every open flat", async () => {
    vi.mocked(oakhillService.contractorOpen).mockResolvedValue({
      data: [
        { id: "visit-50", name: "Carlos Contractor", flat: "50", building_name: "Flat 50", job_description: "Maintenance", mobile: "62 91111 1111", in_at: "2026-08-16T10:00:00Z" },
        { id: "visit-51", name: "Carlos Contractor", flat: "51", building_name: "Flat 51", job_description: "Maintenance", mobile: "62 91111 1111", in_at: "2026-08-16T10:00:00Z" },
      ],
      count: 2,
    } as never);
    render(<GeneralAccessPage />);

    fireEvent.click(screen.getByRole("button", { name: "Contractor" }));
    fireEvent.click(screen.getByRole("button", { name: "OUT" }));
    fireEvent.change(await screen.findByLabelText("Mobile"), { target: { value: "62 91111 1111" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm OUT" }));

    await waitFor(() => expect(oakhillService.contractorCheckOutMany).toHaveBeenCalledWith({ mobile: "62 91111 1111" }));
  });

  it("refreshes the cleaner OUT dropdown after a cleaner record is deleted", async () => {
    vi.mocked(oakhillService.cleanerOpen)
      .mockResolvedValueOnce({
        data: [{ name: "Maria Cleaner", mobile: "62 90000 0000", in_at: "2026-08-16T10:00:00Z", building_id: "50", building_name: "Flat 50" }],
        count: 1,
      })
      .mockResolvedValueOnce({
        data: [{ name: "Maria Cleaner", mobile: "62 90000 0000", in_at: "2026-08-16T10:00:00Z", building_id: "50", building_name: "Flat 50" }],
        count: 1,
      })
      .mockResolvedValue({ data: [], count: 0 });
    render(<GeneralAccessPage />);

    fireEvent.click(screen.getByRole("button", { name: "OUT" }));
    await screen.findByRole("option", { name: "62 90000 0000 - Maria Cleaner" });
    window.dispatchEvent(new StorageEvent("storage", { key: "oakhill-cleaner-access-updated" }));

    await waitFor(() => expect(screen.queryByRole("option", { name: "62 90000 0000 - Maria Cleaner" })).toBeNull());
  });
});
