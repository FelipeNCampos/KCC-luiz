import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ReadingsFormPage, ReadingsPage } from "./ReadingsPage";
import { oakhillService } from "../services/oakhill";

vi.mock("../components/DashboardShell", () => ({ DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main> }));
vi.mock("../services/oakhill", () => ({
  oakhillService: { readings: vi.fn(), saveReadings: vi.fn() }
}));

const reading = {
  id: "reading-1", flat: "50", building_name: "Flat 50", reading_date: "2026-01-06", days: 36,
  energy: 5340, energy_used: 49, energy_change_percent: 88.46,
  gas: 32309, gas_used: 293, gas_change_percent: 24.15,
};

describe("Readings pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(oakhillService.readings).mockResolvedValue({ data: [reading], count: 1 });
    vi.mocked(oakhillService.saveReadings).mockResolvedValue({ data: [reading], count: 3 });
  });

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("lists energy and gas consumption for the selected flat", async () => {
    render(<MemoryRouter><ReadingsPage /></MemoryRouter>);

    expect((await screen.findAllByText("Flat 50")).length).toBe(2);
    expect(screen.getByRole("button", { name: "Flat 51" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Energy" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Gas" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Low" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Normal" })).toBeNull();
    expect(screen.getByText("49")).toBeTruthy();
    expect(screen.getByText("293")).toBeTruthy();
  });

  it("shows a form for all three flats and saves their readings together", async () => {
    render(<MemoryRouter><ReadingsFormPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Add readings" })).toBeTruthy();
    expect(screen.getByLabelText("Flat 50 energy")).toBeTruthy();
    expect(screen.getByLabelText("Flat 51 gas")).toBeTruthy();
    expect(screen.getByLabelText("Flat 52 energy")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Flat 50 energy"), { target: { value: "5340" } });
    fireEvent.change(screen.getByLabelText("Flat 50 gas"), { target: { value: "32309" } });
    fireEvent.change(screen.getByLabelText("Flat 51 energy"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Flat 51 gas"), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("Flat 52 energy"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Flat 52 gas"), { target: { value: "4000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save readings" }));

    await waitFor(() => expect(oakhillService.saveReadings).toHaveBeenCalledWith(expect.objectContaining({
      readings: [
        { flat: "50", energy: 5340, gas: 32309 },
        { flat: "51", energy: 1000, gas: 2000 },
        { flat: "52", energy: 3000, gas: 4000 },
      ],
    })));
  });
});
