import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CleanerPage } from "./CleanerPage";
import { oakhillService } from "../services/oakhill";

vi.mock("../components/DashboardShell", () => ({ DashboardShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("../components/InvoiceModal", () => ({ InvoiceModal: () => null }));
vi.mock("../services/oakhill", () => ({
  oakhillService: { buildings: vi.fn(), listAccess: vi.fn(), funcionarios: vi.fn(), updateAccess: vi.fn(), timeOutAccess: vi.fn(), createAccessCounterpart: vi.fn(), deleteAccess: vi.fn() }
}));

const testMonth = new Date().toISOString().slice(0, 7);
const access = {
  id: "in-1", status: true, data: `${testMonth}-10T10:00:00Z`, operacao: 0 as const, building_id: "50", funcionario_id: "cleaner-1", checkout_checklist_items: []
};

describe("CleanerPage record editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(oakhillService.buildings).mockResolvedValue({ data: [{ id: "50", nome: "Flat 50", condominio_id: "condo-1" }], count: 1 });
    vi.mocked(oakhillService.listAccess).mockResolvedValue({ data: [access], count: 1 });
    vi.mocked(oakhillService.funcionarios).mockResolvedValue({ data: [{ id: "cleaner-1", nome: "Maria Cleaner", mobile: "62 90000 0000" }], count: 1 } as never);
    vi.mocked(oakhillService.updateAccess).mockResolvedValue(access);
    vi.mocked(oakhillService.timeOutAccess).mockResolvedValue({ ...access, id: "out-1", operacao: 1 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the cleaner name and record actions when a row is clicked", async () => {
    render(<CleanerPage />);

    fireEvent.click(await screen.findByText("Flat 50"));

    expect(screen.getByText("Maria Cleaner")).toBeTruthy();
    expect(screen.queryByText("Actions")).toBeNull();
    expect(await screen.findByRole("heading", { name: "Cleaner record" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("always shows IN and OUT fields and creates a missing OUT record", async () => {
    render(<CleanerPage />);

    fireEvent.click(await screen.findByText("Flat 50"));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByLabelText("IN date")).toBeTruthy();
    expect(screen.getByLabelText("OUT date")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("OUT date"), { target: { value: `${testMonth}-10` } });
    fireEvent.change(screen.getByLabelText("OUT time"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(oakhillService.timeOutAccess).toHaveBeenCalledWith("in-1", expect.objectContaining({ data: expect.any(String) })));
  });

  it("keeps IN and OUT records paired with the cleaner who registered them", async () => {
    const mariaOut = { ...access, id: "out-1", data: `${testMonth}-10T12:00:00Z`, operacao: 1 as const };
    const anaIn = { ...access, id: "in-2", data: `${testMonth}-10T11:00:00Z`, funcionario_id: "cleaner-2" };
    const anaOut = { ...anaIn, id: "out-2", data: `${testMonth}-10T13:00:00Z`, operacao: 1 as const };
    vi.mocked(oakhillService.listAccess).mockResolvedValue({ data: [access, anaIn, mariaOut, anaOut], count: 4 });
    vi.mocked(oakhillService.funcionarios).mockResolvedValue({
      data: [
        { id: "cleaner-1", nome: "Maria Cleaner", mobile: "62 90000 0000" },
        { id: "cleaner-2", nome: "Ana Cleaner", mobile: "62 91111 1111" },
      ],
      count: 2,
    } as never);

    render(<CleanerPage />);

    const mariaRow = (await screen.findByText("Maria Cleaner")).closest("tr");
    expect(mariaRow?.textContent).toContain("07:00");
    expect(mariaRow?.textContent).toContain("09:00");
  });

  it("keeps concurrent flats paired to the same cleaner", async () => {
    const inFlat52 = { ...access, id: "in-52", data: `${testMonth}-10T10:00:00Z`, building_id: "52" };
    const outFlat50 = { ...access, id: "out-50", data: `${testMonth}-10T12:00:00Z`, operacao: 1 as const };
    const outFlat52 = { ...inFlat52, id: "out-52", data: `${testMonth}-10T13:00:00Z`, operacao: 1 as const };
    vi.mocked(oakhillService.buildings).mockResolvedValue({
      data: [
        { id: "50", nome: "Flat 50", condominio_id: "condo-1" },
        { id: "52", nome: "Flat 52", condominio_id: "condo-1" },
      ],
      count: 2,
    });
    vi.mocked(oakhillService.listAccess).mockResolvedValue({ data: [access, inFlat52, outFlat50, outFlat52], count: 4 });

    render(<CleanerPage />);

    const flat50Row = (await screen.findAllByText("Flat 50")).find((element) => element.closest("tr"))?.closest("tr");
    expect(flat50Row?.textContent).toContain("09:00");
  });

  it("notifies the public OUT form after deleting a cleaner record", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    localStorage.removeItem("oakhill-cleaner-access-updated");
    render(<CleanerPage />);

    fireEvent.click(await screen.findByText("Flat 50"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(oakhillService.deleteAccess).toHaveBeenCalledWith("in-1"));
    expect(localStorage.getItem("oakhill-cleaner-access-updated")).toBeTruthy();
    confirm.mockRestore();
  });
});
