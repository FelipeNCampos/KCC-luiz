import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";
import { cashFlowService } from "./cashflow";

vi.mock("./api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    defaults: {
      baseURL: "/api/v1"
    }
  }
}));

describe("cashFlowService public sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads a shared cashflow without an administrative request", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], net_total: "0.00" } });

    await expect(cashFlowService.getPublicShare("public-token")).resolves.toEqual({
      items: [],
      net_total: "0.00"
    });
    expect(api.get).toHaveBeenCalledWith("/cashflow/shared/public-token");
  });

  it("loads only the links for the selected cashflow scope", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [] } });

    await cashFlowService.listShareLinks("cashflow52");

    expect(api.get).toHaveBeenCalledWith("/cashflow/share-links", {
      params: { scope: "cashflow52" }
    });
  });

  it("does not duplicate the API prefix in a public receipt URL", () => {
    expect(cashFlowService.publicUrl("/api/v1/cashflow/shared/public-token/records/2/invoice")).toBe(
      "/api/v1/cashflow/shared/public-token/records/2/invoice"
    );
  });

  it("sends an edited record date using the backend field name", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: {} });

    await cashFlowService.update(10, { recordDate: "2026-04-15" });

    expect(api.patch).toHaveBeenCalledWith("/cashflow/10", { record_date: "2026-04-15" });
  });
});
