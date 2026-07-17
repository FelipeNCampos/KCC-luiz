import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";
import { useAuth } from "../hooks/useAuth";

vi.mock("../hooks/useAuth", () => ({
  useAuth: vi.fn()
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
  });

  it("explains that the service is still starting when login receives a bad gateway", async () => {
    const error = new AxiosError("Bad Gateway");
    error.response = { status: 502 } as typeof error.response;
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      status: "anonymous",
      login: vi.fn().mockRejectedValue(error),
      register: vi.fn(),
      logout: vi.fn()
    });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByText("The service is starting. Please try again in a few seconds.")).toBeTruthy();
    });
  });
});
