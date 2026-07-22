import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CleanerPage } from "./CleanerPage";
import { oakhillService } from "../services/oakhill";

vi.mock("../components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../components/InvoiceModal", () => ({ InvoiceModal: () => null }));
vi.mock("../services/oakhill", () => ({
  oakhillService: { buildings: vi.fn(), listAccess: vi.fn(), funcionarios: vi.fn(), updateAccess: vi.fn(), timeOutAccess: vi.fn(), deleteAccess: vi.fn() }
}));

const access = {
  id: "in-1", status: true, data: "2026-07-10T10:00:00Z", operacao: 0 as const, building_id: "50", funcionario_id: "cleaner-1", checkout_checklist_items: []
};

describe("CleanerPage record editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(oakhillService.buildings).mockResolvedValue({ data: [{ id: "50", nome: "Flat 50", condominio_id: "condo-1" }], count: 1 });
    vi.mocked(oakhillService.listAccess).mockResolvedValue({ data: [access], count: 1 });
    vi.mocked(oakhillService.funcionarios).mockResolvedValue({ data: [], count: 0 });
    vi.mocked(oakhillService.updateAccess).mockResolvedValue(access);
  });

  afterEach(() => vi.restoreAllMocks());

  it("opens an editable cleaner record when its flat is clicked", async () => {
    render(<CleanerPage />);

    fireEvent.click(await screen.findByText("Flat 50"));

    expect(await screen.findByRole("heading", { name: "Edit cleaner record" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(oakhillService.updateAccess).toHaveBeenCalledWith("in-1", expect.any(Object)));
  });
});
